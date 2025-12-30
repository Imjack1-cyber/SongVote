import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/crypto';

export interface YouTubeSearchResult {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  albumArtUrl: string | null;
  durationMs: number;
}

export async function searchYouTube(query: string, hostId: string): Promise<YouTubeSearchResult[]> {
  // 1. Get Host Key
  const host = await prisma.host.findUnique({
    where: { id: hostId },
    select: { youtubeApiKey: true }
  });

  if (!host || !host.youtubeApiKey) {
    throw new Error('YouTube API Key not configured');
  }

  const decryptedKey = decrypt(host.youtubeApiKey);
  
  // 2. Check if query is a direct link (Cost: 1 Unit) or search (Cost: 100 Units)
  const urlRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = query.match(urlRegex);

  let data;
  let isVideoLookup = false;

  if (match && match[1]) {
      // Direct Link Strategy
      const videoId = match[1];
      const VIDEO_ENDPOINT = 'https://www.googleapis.com/youtube/v3/videos';
      const params = new URLSearchParams({
        part: 'snippet,contentDetails',
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
        maxResults: '10', // Get 10 results to populate our DB
        key: decryptedKey,
        type: 'video',
        q: query
      });
      const res = await fetch(`${SEARCH_ENDPOINT}?${params.toString()}`);
      data = await res.json();
  }

  if (!data.items) return [];

  // 3. Map Results
  return data.items.map((item: any) => {
      const videoId = isVideoLookup ? item.id : item.id.videoId;
      const snippet = item.snippet;
      
      return {
        id: videoId,
        title: snippet.title,
        artist: snippet.channelTitle, 
        album: 'YouTube',
        albumArtUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || null,
        durationMs: 0 // Duration parsing from ISO8601 would happen here if using 'videos' endpoint
      };
  });
}