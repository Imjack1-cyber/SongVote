import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { searchYouTube, YouTubeSearchResult } from '@/lib/youtube';
import { redis } from '@/lib/redis';
import { checkRateLimit } from '@/lib/ratelimit'; // New Import

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');
  const hostName = searchParams.get('host');

  if (!query || !hostName) {
    return NextResponse.json({ error: 'Missing query or host' }, { status: 400 });
  }

  // --- SECURITY: RATE LIMITING ---
  // Identify by IP (forwarded for) or generic fallback
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const limitKey = `search:${ip}`;
  
  // Allow 20 searches per minute per IP
  const isAllowed = await checkRateLimit(limitKey, 20, 60);
  
  if (!isAllowed) {
      return NextResponse.json({ error: 'Too many search requests. Please wait.' }, { status: 429 });
  }
  // -------------------------------

  try {
    const host = await prisma.host.findUnique({ where: { username: hostName } });
    if (!host) return NextResponse.json({ error: 'Host not found' }, { status: 404 });

    const normalizedQuery = query.trim();
    
    // 1. DB Fuzzy Search
    const dbResults = await prisma.song.findMany({
        where: {
            OR: [
                { title: { contains: normalizedQuery, mode: 'insensitive' } },
                { artist: { contains: normalizedQuery, mode: 'insensitive' } }
            ]
        },
        take: 10
    });

    // 2. Redis Cache Check
    const redisKey = `yt_search_v3:${normalizedQuery.toLowerCase()}`;
    const cachedApiJson = await redis.get(redisKey);
    
    let apiResults: YouTubeSearchResult[] = [];

    if (cachedApiJson) {
        apiResults = JSON.parse(cachedApiJson);
    } 
    else {
        // 3. YouTube API Fetch
        try {
            apiResults = await searchYouTube(normalizedQuery, host.id);
            
            // Persist
            if (apiResults.length > 0) {
                await redis.set(redisKey, JSON.stringify(apiResults));
                // Cache search results for 7 days
                await redis.expire(redisKey, 60 * 60 * 24 * 7);
            }

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

        } catch (e) {
            console.error("YouTube Search Failed:", e);
        }
    }

    // 4. Merge
    const combined = [...apiResults];
    const existingIds = new Set(combined.map(s => s.id));

    dbResults.forEach(song => {
        if (!existingIds.has(song.id)) {
            combined.push(song);
            existingIds.add(song.id);
        }
    });

    return NextResponse.json({ tracks: { items: combined } });

  } catch (error) {
    console.error('Search handler error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}