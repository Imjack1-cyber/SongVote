'use client';

import { useState } from 'react';
import { Search, Plus, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Loaders';
import { clientLogger } from '@/lib/clientLogger';

// Simple entity decoder
const decodeHtmlEntities = (str: string) => {
    return str.replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'");
};

interface Song {
  id: string;
  title: string;
  artist: string;
  albumArtUrl: string | null;
}

interface SongSearchProps {
  hostName: string;
  onSuggest: (song: Song) => void;
}

export default function SongSearch({ hostName, onSuggest }: SongSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const start = Date.now();
    setLoading(true);
    setResults([]); 
    setHasSearched(true);
    
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&host=${hostName}`);
      const data = await res.json();
      
      const duration = Date.now() - start;

      if (data.tracks && data.tracks.items) {
        setResults(data.tracks.items);
        clientLogger.debug('Client Search Success', { query, results: data.tracks.items.length, duration });
      } else {
        clientLogger.warn('Client Search No Results', { query, duration });
      }
    } catch (err) {
      clientLogger.error('Client Search Error', { error: err, query });
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestClick = (track: Song) => {
      clientLogger.info('User Selected Song', { songId: track.id, title: track.title });
      onSuggest(track);
      setResults([]);
      setQuery('');
      setHasSearched(false);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="relative">
        <input 
          id="song-search-input"
          type="text" 
          placeholder="Enter song name and press Enter..." 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full p-4 pl-12 pr-12 rounded-xl bg-[var(--surface)] border border-[var(--border)] focus:ring-2 focus:ring-[var(--accent)] outline-none transition-all shadow-sm"
        />
        <Search className="absolute left-4 top-4 w-5 h-5 opacity-40" />
        
        <button 
            type="submit" 
            disabled={loading || !query.trim()}
            className="absolute right-3 top-2.5 p-2 bg-[var(--accent)] text-[var(--accent-fg)] rounded-lg hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center"
        >
            {loading ? <Spinner className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
        </button>
      </form>

      {loading ? (
        /* SKELETON LOADING STATE */
        <div className="card divide-y divide-[var(--border)] max-h-[300px] overflow-hidden shadow-xl z-50 relative animate-in fade-in slide-in-from-top-2">
            {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                        <Skeleton className="w-10 h-10 rounded-md flex-shrink-0" />
                        <div className="space-y-2 flex-1">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    </div>
                    <Skeleton className="w-9 h-9 rounded-full" />
                </div>
            ))}
        </div>
      ) : results.length > 0 ? (
        /* RESULTS STATE */
        <div id="search-results" className="card divide-y divide-[var(--border)] max-h-[300px] overflow-y-auto shadow-xl z-50 relative animate-in fade-in slide-in-from-top-2">
          {results.map((track) => (
            <div key={track.id} className="p-3 flex items-center justify-between hover:bg-[var(--foreground)]/5 transition group">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="relative w-10 h-10 flex-shrink-0 bg-black rounded-md overflow-hidden">
                  {track.albumArtUrl ? (
                    <Image 
                      src={track.albumArtUrl} 
                      alt={track.title} 
                      fill
                      sizes="40px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-700" />
                  )}
                </div>
                <div className="overflow-hidden min-w-0">
                  <p className="font-medium text-sm truncate group-hover:text-[var(--accent)] transition-colors">
                     {decodeHtmlEntities(track.title)}
                  </p>
                  <p className="text-xs opacity-60 truncate">{track.artist}</p>
                </div>
              </div>
              <button 
                onClick={() => handleSuggestClick(track)}
                className="p-2 flex-shrink-0 rounded-full hover:bg-[var(--accent)] hover:text-white text-[var(--accent)] transition-colors"
                title="Add to Queue"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        hasSearched && !loading && (
            <div className="text-center p-4 opacity-50 text-sm animate-in fade-in">
                No songs found in database or YouTube.
            </div>
        )
      )}
    </div>
  );
}