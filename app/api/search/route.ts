import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { searchYouTube, YouTubeSearchResult } from '@/lib/youtube';
import { redis } from '@/lib/redis';
import { checkRateLimit } from '@/lib/ratelimit';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// Validation Schema for Search
const SearchQuerySchema = z.object({
  q: z.string().min(1).max(100), // Limit query length to prevent abuse
  host: z.string().min(1).max(50)
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = Date.now();
  
  // 1. Input Validation
  const input = SearchQuerySchema.safeParse({
    q: searchParams.get('q'),
    host: searchParams.get('host')
  });

  if (!input.success) {
    return NextResponse.json({ error: 'Invalid search parameters' }, { status: 400 });
  }

  const { q: query, host: hostName } = input.data;

  // 2. Robust IP Extraction
  const forwardedFor = req.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
  
  // 3. Rate Limiting
  const limitKey = `search:${ip}`;
  const isAllowed = await checkRateLimit(limitKey, 20, 60);
  
  if (!isAllowed) {
      logger.warn({ ip, hostName, query }, 'Search Rate Limit Exceeded');
      return NextResponse.json({ error: 'Too many search requests. Please wait.' }, { status: 429 });
  }

  try {
    const host = await prisma.host.findUnique({ where: { username: hostName } });
    if (!host) {
        logger.warn({ hostName, ip }, 'Search attempted for non-existent host');
        return NextResponse.json({ error: 'Host not found' }, { status: 404 });
    }

    const normalizedQuery = query.trim();
    
    // 4. DB Fuzzy Search
    const dbResults = await prisma.song.findMany({
        where: {
            OR: [
                { title: { contains: normalizedQuery, mode: 'insensitive' } },
                { artist: { contains: normalizedQuery, mode: 'insensitive' } }
            ]
        },
        take: 10
    });

    // 5. Redis Cache Check
    const redisKey = `yt_search_v3:${normalizedQuery.toLowerCase()}`;
    const cachedApiJson = await redis.get(redisKey);
    
    let apiResults: YouTubeSearchResult[] = [];
    let source = 'db_only';

    if (cachedApiJson) {
        apiResults = JSON.parse(cachedApiJson);
        source = 'cache';
    } 
    else {
        // 6. YouTube API Fetch
        try {
            apiResults = await searchYouTube(normalizedQuery, host.id);
            source = 'api';
            
            // Persist valid results
            if (apiResults.length > 0) {
                await redis.set(redisKey, JSON.stringify(apiResults));
                await redis.expire(redisKey, 60 * 60 * 24 * 7);

                const upsertPromises = apiResults.map(track => {
                    return prisma.song.upsert({
                        where: { id: track.id },
                        update: {},
                        create: {
                            id: track.id,
                            title: track.title,
                            artist: track.artist,
                            album: track.album || 'YouTube',
                            albumArtUrl: track.albumArtUrl,
                            durationMs: track.durationMs
                        }
                    });
                });
                
                await Promise.all(upsertPromises);
            }
        } catch (e) {
       }
    }

    // 7. Merge Results
    const combined = [...apiResults];
    const existingIds = new Set(combined.map(s => s.id));

    dbResults.forEach(song => {
        if (!existingIds.has(song.id)) {
            combined.push(song);
            existingIds.add(song.id);
        }
    });

    const duration = Date.now() - start;
    logger.info({ 
        type: 'search_req', 
        hostName, 
        query: normalizedQuery, 
        source, 
        resultCount: combined.length,
        duration
    }, 'Search Request Completed');

    return NextResponse.json({ tracks: { items: combined } });

  } catch (error) {
    logger.error({ err: error, hostName, query }, 'Search Route Handler Error');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}