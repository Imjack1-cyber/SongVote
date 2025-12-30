'use client';

import { useState } from 'react';
import { Search, Plus, Loader2, ArrowRight } from 'lucide-react';
import Image from 'next/image';

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

    setLoading(true);
    setResults([]); // Clear previous
    setHasSearched(true);
    
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&host=${hostName}`);
      const data = await res.json();
      
      if (data.tracks && data.tracks.items) {
        setResults(data.tracks.items);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="relative">
        <input 
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
            className="absolute right-3 top-2.5 p-2 bg-[var(--accent)] text-[var(--accent-fg)] rounded-lg hover:brightness-110 disabled:opacity-50 transition-all"
        >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
        </button>
      </form>

      {/* Results List */}
      {results.length > 0 ? (
        <div className="card divide-y divide-[var(--border)] max-h-[300px] overflow-y-auto shadow-xl z-50 relative animate-in fade-in slide-in-from-top-2">
          {results.map((track) => (
            <div key={track.id} className="p-3 flex items-center justify-between hover:bg-[var(--foreground)]/5 transition">
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
                  <p className="font-medium text-sm truncate" dangerouslySetInnerHTML={{ __html: track.title }} />
                  <p className="text-xs opacity-60 truncate">{track.artist}</p>
                </div>
              </div>
              <button 
                onClick={() => {
                    onSuggest(track);
                    setResults([]);
                    setQuery('');
                    setHasSearched(false);
                }}
                className="p-2 flex-shrink-0 rounded-full hover:bg-[var(--accent)] hover:text-white text-[var(--accent)] transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        // Show "No results" only if we actually searched and found nothing
        hasSearched && !loading && (
            <div className="text-center p-4 opacity-50 text-sm">
                No songs found in database or YouTube.
            </div>
        )
      )}
    </div>
  );
}