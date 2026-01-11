'use client';

import { 
    Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, 
    Maximize2, Minimize2, Zap, AlertCircle, Loader2, Music2,
    Eye, EyeOff, RefreshCcw 
} from 'lucide-react';
import { useState, useEffect, memo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useSocket } from '@/hooks/useSocket';

const YouTube = dynamic(() => import('react-youtube'), { ssr: false }) as any;

interface Song {
    id: string;
    songId: string;
    song: {
        title: string;
        artist: string;
        albumArtUrl: string | null;
    };
}

interface HostPlayerProps {
  currentSong: Song | null; 
  nextUp: Song | null;      
  voteId: string;
  onSongStarted: (itemId: string) => void;
  onSongEnded: (itemId: string) => void;
  onSongBack: () => void;
  onForcePlay: (url: string) => void;
  initialSyncState?: any;
}

const HostPlayer = memo(function HostPlayer(props: HostPlayerProps) {
  const [remountKey, setRemountKey] = useState(0);

  const handleHardReset = () => {
      if(confirm("Restart player?")) {
          setRemountKey(prev => prev + 1);
      }
  };

  return (
      <InternalPlayer 
        key={remountKey} 
        onHardReset={handleHardReset}
        {...props} 
      />
  );
});

export default HostPlayer;

function InternalPlayer({ 
    currentSong, 
    nextUp, 
    voteId,
    onSongStarted, 
    onSongEnded, 
    onSongBack,
    onForcePlay,
    initialSyncState,
    onHardReset
}: HostPlayerProps & { onHardReset: () => void }) {

  const { socket } = useSocket(voteId);

  const [player, setPlayer] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const [isVideoVisible, setIsVideoVisible] = useState(true);
  const [isVideoExpanded, setIsVideoExpanded] = useState(true);
  
  const [showForceInput, setShowForceInput] = useState(false);
  const [forceUrl, setForceUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  // --- AUTO START ---
  useEffect(() => {
      if (!currentSong && nextUp) {
          onSongStarted(nextUp.id);
      }
  }, [currentSong, nextUp, onSongStarted]);

  useEffect(() => { setError(null); }, [currentSong?.id]);

  // --- SYNC ---
  useEffect(() => {
      if (!socket) return;
      const handleSync = (state: any) => {
          if (!player || typeof player.seekTo !== 'function') return;
          if (state.videoId !== currentSong?.songId) return;

          const now = Date.now();
          if (state.status === 'playing') {
              const target = (now - state.startTime) / 1000;
              setIsPlaying(true);
              if (Math.abs(player.getCurrentTime() - target) > 2) {
                  player.seekTo(target, true);
              }
              if (player.getPlayerState() !== 1) player.playVideo();
          } else {
              setIsPlaying(false);
              player.pauseVideo();
              const target = state.currentPosition / 1000;
              if (Math.abs(player.getCurrentTime() - target) > 0.5) {
                  player.seekTo(target, true);
              }
          }
      };
      socket.on('player-sync', handleSync);
      return () => { socket.off('player-sync', handleSync); };
  }, [socket, player, currentSong]);

  const broadcastStatus = useCallback((status: 'playing' | 'paused') => {
      if (!socket || !currentSong || !player || typeof player.getCurrentTime !== 'function') return;
      socket.emit('player-update', {
          sessionId: voteId,
          state: { status, position: player.getCurrentTime(), videoId: currentSong.songId }
      });
  }, [socket, voteId, currentSong, player]);

  // Progress Bar
  useEffect(() => {
      if (!player || !isPlaying) return;
      const interval = setInterval(() => {
          try {
              if (typeof player.getCurrentTime === 'function') {
                  setCurrentTime(player.getCurrentTime());
                  setDuration(player.getDuration());
              }
          } catch(e) {}
      }, 1000);
      return () => clearInterval(interval);
  }, [player, isPlaying]);

  const onReady = (event: any) => {
    const p = event.target;
    setPlayer(p);
    p.setVolume(volume);
    
    if (initialSyncState && initialSyncState.videoId === currentSong?.songId) {
        const now = Date.now();
        if (initialSyncState.status === 'playing') {
             p.seekTo((now - initialSyncState.startTime) / 1000, true);
             p.playVideo();
        } else {
             p.seekTo(initialSyncState.currentPosition / 1000, true);
             p.pauseVideo();
        }
    } else if (currentSong && !error) {
        p.playVideo();
        setTimeout(() => broadcastStatus('playing'), 1500);
    }
  };

  const onStateChange = (event: any) => {
    if (event.data === 1) {
        setIsPlaying(true);
        broadcastStatus('playing');
    }
    if (event.data === 2) {
        setIsPlaying(false);
        broadcastStatus('paused');
    }
  };

  const onError = (event: any) => {
      if ([100, 101, 150].includes(event.data)) {
          setError("Video unavailable. Skipping...");
          setTimeout(() => handleSkip(), 3000);
      } else {
          setError("Playback Error");
      }
  };

  const handleSkip = () => { if (currentSong) onSongEnded(currentSong.id); };
  
  const handlePrevious = () => {
      if (player && typeof player.getCurrentTime === 'function' && player.getCurrentTime() > 3) {
          player.seekTo(0);
          broadcastStatus('playing');
      } else {
          onSongBack();
      }
  };

  const togglePlay = () => {
    if (!player) return;
    isPlaying ? player.pauseVideo() : player.playVideo();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value);
      setVolume(val);
      if (player) {
          player.setVolume(val);
          player.unMute();
          setIsMuted(false);
      }
  };

  const toggleMute = () => {
      if (!player) return;
      if (isMuted) { player.unMute(); setIsMuted(false); } 
      else { player.mute(); setIsMuted(true); }
  };

  const handleForceSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!forceUrl.trim()) return;
      onForcePlay(forceUrl);
      setForceUrl('');
      setShowForceInput(false);
  };

  const formatTime = (seconds: number) => {
      if (!seconds || isNaN(seconds)) return "0:00";
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const activeSong = currentSong || nextUp;
  const isTransitioning = !currentSong && !!nextUp;

  if (!activeSong) {
      return (
        <div id="host-player" className="card p-8 mb-8 flex flex-col items-center justify-center text-center opacity-60 border-2 border-dashed border-[var(--border)]">
            <Music2 className="w-12 h-12 mb-4 opacity-20" />
            <p className="font-medium">Queue is empty</p>
            <p className="text-sm opacity-60 mb-6">Suggestions will appear here automatically.</p>
            <button id="force-play-btn" onClick={() => setShowForceInput(true)} className="btn-primary text-sm flex items-center gap-2">
                <Zap className="w-4 h-4" /> Force Play URL
            </button>
            {showForceInput && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="card p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95">
                        <h3 className="font-bold text-lg mb-4">Force Play Song</h3>
                        <form onSubmit={handleForceSubmit} className="space-y-4">
                            <input type="text" autoFocus placeholder="Paste YouTube Link..." value={forceUrl} onChange={(e) => setForceUrl(e.target.value)} className="w-full p-3 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:ring-2 focus:ring-[var(--accent)] outline-none" />
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setShowForceInput(false)} className="px-4 py-2 text-sm font-medium hover:bg-[var(--foreground)]/5 rounded-lg">Cancel</button>
                                <button type="submit" className="btn-primary">Play Immediately</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
      );
  }

  return (
    <div id="host-player" className="card p-0 mb-8 overflow-hidden shadow-xl border border-[var(--border)] bg-[var(--surface)] transition-all duration-500 relative">
      
      <div className={`relative bg-black transition-all duration-500 ease-in-out overflow-hidden ${!isVideoVisible ? 'h-0 opacity-0' : (isVideoExpanded ? 'aspect-video' : 'h-24 sm:h-32')}`}>
        <div className="absolute inset-0">
             <YouTube
                videoId={activeSong.songId}
                opts={{
                    height: '100%',
                    width: '100%',
                    playerVars: { 
                        autoplay: 1, 
                        controls: 0, 
                        modestbranding: 1, 
                        rel: 0,
                        origin: typeof window !== 'undefined' ? window.location.origin : undefined
                    }
                }}
                onReady={onReady}
                onStateChange={onStateChange}
                onEnd={() => currentSong && onSongEnded(currentSong.id)}
                onError={onError}
                className="w-full h-full"
            />
        </div>
        <div className={`absolute inset-0 bg-cover bg-center transition-opacity duration-500 ${isVideoExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} style={{ backgroundImage: `url(${activeSong.song.albumArtUrl || '/placeholder.png'})` }}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
        </div>
        {(error || isTransitioning) && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-white">
                {error ? (
                    <>
                        <AlertCircle className="w-8 h-8 mb-2 text-red-500" />
                        <p className="text-sm font-medium">{error}</p>
                    </>
                ) : (
                    <>
                        <Loader2 className="w-8 h-8 animate-spin mb-2 text-[var(--accent)]" />
                        <p className="text-sm font-medium animate-pulse">Loading Next Track...</p>
                    </>
                )}
            </div>
        )}
        {isVideoVisible && (
            <button onClick={() => setIsVideoExpanded(!isVideoExpanded)} className="absolute top-4 right-4 z-30 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 focus:opacity-100">
                {isVideoExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
        )}
      </div>

      <div className="p-4 sm:p-6 space-y-6">
          <div className="flex flex-col gap-2">
              <div className="flex justify-between items-end">
                  <div className="min-w-0 flex-1 mr-4">
                      <h2 className="text-xl font-bold truncate leading-tight" title={activeSong.song.title}>{activeSong.song.title}</h2>
                      <p className="text-sm opacity-60 truncate">{activeSong.song.artist}</p>
                  </div>
                  <div className="text-xs font-mono opacity-50 whitespace-nowrap">{formatTime(currentTime)} / {formatTime(duration)}</div>
              </div>
              <div className="h-1.5 w-full bg-[var(--foreground)]/10 rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--accent)] transition-all duration-1000 ease-linear" style={{ width: `${(duration > 0 ? currentTime / duration : 0) * 100}%` }} />
              </div>
          </div>

          <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button id="force-play-btn" onClick={() => setShowForceInput(true)} className="p-2 rounded-lg hover:bg-[var(--foreground)]/5 text-[var(--foreground)]/50 hover:text-[var(--accent)] transition" title="Force Play"><Zap className="w-5 h-5" /></button>
                <button id="close-video-btn" onClick={() => setIsVideoVisible(!isVideoVisible)} className={`p-2 rounded-lg hover:bg-[var(--foreground)]/5 transition ${!isVideoVisible ? 'text-[var(--accent)]' : 'text-[var(--foreground)]/50 hover:text-[var(--foreground)]'}`} title={isVideoVisible ? "Hide Video" : "Show Video"}>
                    {isVideoVisible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
                <button id="reset-player-btn" onClick={onHardReset} className="p-2 rounded-lg hover:bg-[var(--foreground)]/5 text-red-500/70 hover:text-red-600 transition" title="Restart Player (Fix bugs)">
                    <RefreshCcw className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-4 sm:gap-6">
                  <button onClick={handlePrevious} className="p-2 sm:p-3 text-[var(--foreground)]/70 hover:text-[var(--foreground)] hover:bg-[var(--foreground)]/5 rounded-full transition" title="Previous / Replay">
                      <SkipBack className="w-5 h-5 sm:w-6 sm:h-6 rotate-180" /> 
                  </button>

                  <button onClick={togglePlay} className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center bg-[var(--accent)] text-[var(--accent-fg)] rounded-full shadow-lg shadow-[var(--accent)]/30 hover:scale-105 active:scale-95 transition-all">
                      {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
                  </button>

                  <button onClick={handleSkip} className="p-2 sm:p-3 text-[var(--foreground)]/70 hover:text-[var(--foreground)] hover:bg-[var(--foreground)]/5 rounded-full transition" title="Skip Song">
                      <SkipForward className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
              </div>

              <div className="flex items-center gap-2 group">
                  <button onClick={toggleMute} className="text-[var(--foreground)]/50 hover:text-[var(--foreground)] transition">{isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}</button>
                  <div className="w-0 overflow-hidden group-hover:w-20 transition-all duration-300 ease-in-out">
                      <input type="range" min="0" max="100" value={isMuted ? 0 : volume} onChange={handleVolumeChange} className="w-20 h-1 bg-[var(--foreground)]/20 rounded-lg appearance-none cursor-pointer accent-[var(--accent)]" />
                  </div>
              </div>
          </div>
      </div>

      {showForceInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="card p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-[var(--accent)]" /> Force Play Song</h3>
                <form onSubmit={handleForceSubmit} className="space-y-4">
                    <input type="text" autoFocus placeholder="https://youtube.com/watch?v=..." value={forceUrl} onChange={(e) => setForceUrl(e.target.value)} className="w-full p-3 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:ring-2 focus:ring-[var(--accent)] outline-none" />
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setShowForceInput(false)} className="px-4 py-2 text-sm font-medium hover:bg-[var(--foreground)]/5 rounded-lg transition">Cancel</button>
                        <button type="submit" className="btn-primary">Play Immediately</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}