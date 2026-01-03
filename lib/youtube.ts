import { prisma } from './db';
import { decrypt } from './crypto';

export interface YouTubeSearchResult {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  albumArtUrl: string | null;
  durationMs: number;
  isPlayable?: boolean; // New field for Region Check results
}

/**
 * Searches YouTube.
 * @param query Search query or Video URL
 * @param hostId ID of the host (to get API key)
 * @param checkRegion If true, performs strict region/embeddable checks (Cost: 1 extra unit per video)
 */
export async function searchYouTube(query: string, hostId: string, checkRegion: boolean = false): Promise<YouTubeSearchResult[]> {
  // 1. Get Host Key
  const host = await prisma.host.findUnique({
    where: { id: hostId },
    select: { youtubeApiKey: true }
  });

  if (!host || !host.youtubeApiKey) {
    throw new Error('YouTube API Key not configured');
  }

  const decryptedKey = decrypt(host.youtubeApiKey);
  
  const urlRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = query.match(urlRegex);

  let data;
  let isVideoLookup = false;

  // We need contentDetails to check region restriction
  const parts = checkRegion ? 'snippet,contentDetails,status' : 'snippet';

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
      
      // If we need to check regions for SEARCH results, we must do a second call 
      // because 'search' endpoint doesn't return contentDetails.
      // However, to save quota, we only do strict checks on Direct Link or when playing.
      // For search results, we assume they are generally available.
      // We will perform a basic mapping here.
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
              // If 'allowed' list exists, US must be in it (assuming Host is US-based or generic)
              // Ideally, this should be configurable, but 'US' is a safe default for most global tracks.
              if (restriction.allowed && !restriction.allowed.includes('US')) {
                  isPlayable = false;
              }
              // If 'blocked' list exists, US must NOT be in it
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
      console.error("Playlist Fetch Error", e);
      return [];
  }
}