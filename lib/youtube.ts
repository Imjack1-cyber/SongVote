import { prisma } from './db';
import { decrypt } from './crypto';
import { logger } from './logger';
import { redis } from './redis';

export interface YouTubeSearchResult {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  albumArtUrl: string | null;
  durationMs: number;
  isPlayable?: boolean;  
}

/**
 * Searches YouTube.
 * @param query Search query or Video URL
 * @param hostId ID of the host (to get API key)
 * @param checkRegion If true, performs strict region/embeddable checks (Cost: 1 extra unit per video)
 */
export async function searchYouTube(query: string, hostId: string, checkRegion: boolean = false): Promise<YouTubeSearchResult[]> {
  const startTime = Date.now();
  
  // 1. Get Host Key
  const host = await prisma.host.findUnique({
    where: { id: hostId },
    select: { youtubeApiKey: true }
  });

  if (!host || !host.youtubeApiKey) {
    logger.warn({ hostId }, 'YouTube API Key missing during search');
    throw new Error('YouTube API Key not configured');
  }

  const decryptedKey = decrypt(host.youtubeApiKey);
  
  const urlRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = query.match(urlRegex);

  let data;
  let isVideoLookup = false;

  const parts = checkRegion ? 'snippet,contentDetails,status' : 'snippet';

  try {
      if (match && match[1]) {
          // Direct Link Strategy
          const videoId = match[1];
          const VIDEO_ENDPOINT = 'https://www.googleapis.com/youtube/v3/videos';
          const params = new URLSearchParams({
            part: parts,
            id: videoId,
            key: decryptedKey
          });
          const res = await fetch(`${VIDEO_ENDPOINT}?${params.toString()}`);
          data = await res.json();
          isVideoLookup = true;
      } else {
          // Search Strategy
          const SEARCH_ENDPOINT = 'https://www.googleapis.com/youtube/v3/search';
          const params = new URLSearchParams({
            part: 'snippet',
            maxResults: '10',
            key: decryptedKey,
            type: 'video',
            q: query
          });
          const res = await fetch(`${SEARCH_ENDPOINT}?${params.toString()}`);
          data = await res.json();
      }

      const duration = Date.now() - startTime;
      
      if (data.error) {
          logger.error({ 
              err: data.error, 
              hostId, 
              query,
              duration
          }, 'YouTube API Error Response');
          return [];
      }

      logger.info({ 
          type: isVideoLookup ? 'direct_lookup' : 'search',
          resultsCount: data.items?.length || 0,
          duration
      }, 'YouTube API Call');

  } catch (e) {
      logger.error({ err: e, hostId, query }, 'YouTube Fetch Failed');
      return [];
  }

  if (!data.items) return [];

  return data.items.map((item: any) => {
      const videoId = isVideoLookup ? item.id : item.id.videoId;
      const snippet = item.snippet;
      
      let isPlayable = true;

      // Logic for Region/Embed Check
      if (checkRegion && isVideoLookup) {
          // 1. Check Embeddable
          if (item.status && item.status.embeddable === false) {
              isPlayable = false;
          }
          
          // 2. Check Region Restriction
          if (item.contentDetails && item.contentDetails.regionRestriction) {
              const restriction = item.contentDetails.regionRestriction;
              if (restriction.allowed && !restriction.allowed.includes('US')) {
                  isPlayable = false;
              }
              if (restriction.blocked && restriction.blocked.includes('US')) {
                  isPlayable = false;
              }
          }
      }

      return {
        id: videoId,
        title: snippet.title,
        artist: snippet.channelTitle, 
        album: 'YouTube',
        albumArtUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || null,
        durationMs: 0,
        isPlayable
      };
  });
}

export async function getPlaylistItems(playlistId: string, hostId: string): Promise<YouTubeSearchResult[]> {
  const host = await prisma.host.findUnique({
    where: { id: hostId },
    select: { youtubeApiKey: true }
  });

  if (!host || !host.youtubeApiKey) return [];
  const decryptedKey = decrypt(host.youtubeApiKey);

  const PLAYLIST_ENDPOINT = 'https://www.googleapis.com/youtube/v3/playlistItems';
  const params = new URLSearchParams({
    part: 'snippet',
    maxResults: '50',
    playlistId: playlistId,
    key: decryptedKey
  });

  try {
      const res = await fetch(`${PLAYLIST_ENDPOINT}?${params.toString()}`);
      const data = await res.json();
      
      if (!data.items) return [];

      return data.items.map((item: any) => {
          const snippet = item.snippet;
          if (snippet.title === 'Deleted video' || snippet.title === 'Private video') return null;

          return {
              id: snippet.resourceId.videoId,
              title: snippet.title,
              artist: snippet.channelTitle,
              album: 'Radio Backup',
              albumArtUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || null,
              durationMs: 0
          };
      }).filter(Boolean);
  } catch (e) {
      logger.error({ err: e, playlistId }, "Playlist Fetch Error");
      return [];
  }
}

/**
 * Gets related videos for Infinite Flow.
 * STRATEGY REVISION: `relatedToVideoId` is deprecated.
 * New Strategy: Fetch Artist Name (Channel) -> Search for Artist -> Filter duplicates.
 */
export async function getRelatedVideos(videoId: string, hostId: string): Promise<YouTubeSearchResult[]> {
    // 1. Check Infinite Cache
    const cacheKey = `related_videos_v2:${videoId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    // 2. Fetch Credentials
    const host = await prisma.host.findUnique({
        where: { id: hostId },
        select: { youtubeApiKey: true }
    });

    if (!host || !host.youtubeApiKey) return [];
    const decryptedKey = decrypt(host.youtubeApiKey);

    try {
        // 3. STEP A: Get Video Details to find the Artist (Channel Title)
        // Cost: 1 Unit
        const VIDEO_ENDPOINT = 'https://www.googleapis.com/youtube/v3/videos';
        const vidParams = new URLSearchParams({
            part: 'snippet',
            id: videoId,
            key: decryptedKey
        });
        
        const vidRes = await fetch(`${VIDEO_ENDPOINT}?${vidParams.toString()}`);
        const vidData = await vidRes.json();

        if (!vidData.items || vidData.items.length === 0) {
            logger.warn({ hostId, videoId }, 'Infinite Flow: Source video not found');
            return [];
        }

        const artistName = vidData.items[0].snippet.channelTitle;
        
        // 4. STEP B: Search for music by this Artist
        // Cost: 100 Units
        // Query: "Artist Name music"
        const SEARCH_ENDPOINT = 'https://www.googleapis.com/youtube/v3/search';
        const searchParams = new URLSearchParams({
            part: 'snippet',
            maxResults: '6', // Fetch 6, drop 1 (the original) = 5 suggestions
            type: 'video',
            q: `${artistName} music`, 
            videoCategoryId: '10', // Music Category
            key: decryptedKey
        });

        const searchRes = await fetch(`${SEARCH_ENDPOINT}?${searchParams.toString()}`);
        const searchData = await searchRes.json();

        if (searchData.error) {
            logger.error({ err: searchData.error, hostId, videoId }, 'YouTube Search API Error (Infinite Flow)');
            return [];
        }

        if (!searchData.items) return [];

        // 5. Map & Filter (Remove the seed video from results)
        const results: YouTubeSearchResult[] = searchData.items
            .filter((item: any) => item.id.videoId !== videoId)
            .map((item: any) => ({
                id: item.id.videoId,
                title: item.snippet.title,
                artist: item.snippet.channelTitle,
                album: 'Infinite Flow',
                albumArtUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || null,
                durationMs: 0
            }))
            .slice(0, 5); // Ensure cap at 5

        // 6. Cache Forever
        if (results.length > 0) {
            await redis.set(cacheKey, JSON.stringify(results));
            logger.info({ hostId, videoId, artistName, count: results.length }, 'Fetched & Cached Infinite Flow');
        }

        return results;

    } catch (e) {
        logger.error({ err: e, hostId, videoId }, 'Related Videos Fetch Failed');
        return [];
    }
}