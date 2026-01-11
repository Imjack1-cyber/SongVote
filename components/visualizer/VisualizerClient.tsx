'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '@/hooks/useSocket';
import QRCode from 'react-qr-code';
import Image from 'next/image';
import { Music2, Maximize, Minimize } from 'lucide-react';
import ReactionOverlay from '@/components/host/ReactionOverlay';

interface VisualizerProps {
  voteId: string;
  initialQueue: any[];
  initialCurrent: any;
  sessionTitle: string;
  hostname: string;
  enableReactions: boolean;
}

export default function VisualizerClient({ 
    voteId, initialQueue, initialCurrent, sessionTitle, hostname, enableReactions 
}: VisualizerProps) {
  const { socket } = useSocket(voteId);
  const [queue, setQueue] = useState(initialQueue);
  const [currentSong, setCurrentSong] = useState(initialCurrent);
  const [joinUrl, setJoinUrl] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
      if (typeof window !== 'undefined') {
          setJoinUrl(`${window.location.origin}/join`);
      }
  }, []);

  // --- FULL SCREEN LOGIC ---
  const toggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((e) => {
            console.error(`Error attempting to enable fullscreen: ${e.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // --- SOCKET SYNC ---
  useEffect(() => {
    if (!socket) return;
    
    socket.on('state-update', ({ queue, current }) => {
        setQueue(queue.slice(0, 5)); 
        setCurrentSong(current);
    });

    socket.emit('join-room', voteId);
    
    return () => { 
        socket.off('state-update'); 
    };
  }, [socket, voteId]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col overflow-hidden font-sans relative selection:bg-[var(--accent)] selection:text-white">
      
      {/* Feature: Reactions */}
      {enableReactions && <ReactionOverlay sessionId={voteId} />}

      {/* Background Ambience */}
      {currentSong && (
          <div 
            className="absolute inset-0 opacity-20 scale-110 blur-3xl transition-all duration-[2000ms]"
            style={{ 
                backgroundImage: `url(${currentSong.song.albumArtUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            }}
          />
      )}

      {/* Header */}
      <header className="relative z-10 p-8 flex justify-between items-start border-b border-white/10 bg-black/40 backdrop-blur-sm">
          <div className="space-y-1">
              <h1 className="text-4xl font-black tracking-tight">{sessionTitle}</h1>
              <p className="text-xl opacity-60">Hosted by <span className="text-[var(--accent)]">{hostname}</span></p>
          </div>
          
          <div className="flex items-start gap-6">
              {/* Full Screen Toggle */}
              <button 
                onClick={toggleFullScreen}
                className="p-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/5 transition-all text-white/70 hover:text-white hover:scale-105 active:scale-95"
                title={isFullscreen ? "Exit Full Screen" : "Enter Full Screen"}
              >
                 {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
              </button>

              <div className="text-center">
                <div className="bg-white p-3 rounded-2xl inline-block shadow-2xl">
                    {joinUrl && <QRCode value={joinUrl} size={120} />}
                </div>
                <p className="mt-2 font-mono font-bold tracking-[0.2em] text-sm text-center opacity-80">SCAN TO VOTE</p>
              </div>
          </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex gap-12 p-12 items-stretch">
          
          {/* NOW PLAYING (Left) */}
          <div className="flex-1 flex flex-col justify-center items-center text-center space-y-8 relative">
              <div className="relative w-[50vh] h-[50vh] rounded-3xl overflow-hidden shadow-2xl ring-4 ring-white/10">
                  {currentSong ? (
                      <Image src={currentSong.song.albumArtUrl} alt="Art" fill className="object-cover" />
                  ) : (
                      <div className="w-full h-full bg-neutral-900 flex items-center justify-center border-4 border-white/5 rounded-3xl">
                          <Music2 className="w-32 h-32 opacity-20" />
                      </div>
                  )}
              </div>
              <div className="space-y-4 max-w-2xl">
                  <h2 className="text-6xl font-black leading-tight line-clamp-2 drop-shadow-2xl">
                      {currentSong ? currentSong.song.title : "Waiting for music..."}
                  </h2>
                  <p className="text-3xl opacity-70 font-light tracking-wide">
                      {currentSong?.song.artist}
                  </p>
              </div>
          </div>

          {/* UP NEXT (Right) */}
          <div className="w-1/3 bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 flex flex-col shadow-2xl">
              <h3 className="text-2xl font-bold mb-8 flex items-center gap-4 uppercase tracking-widest opacity-90">
                  <span className="w-1.5 h-8 bg-[var(--accent)] rounded-full shadow-[0_0_15px_var(--accent)]"/> 
                  Up Next
              </h3>
              
              <div className="flex-1 space-y-4 overflow-hidden relative">
                  {queue.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center opacity-30 text-center space-y-4">
                          <Music2 className="w-12 h-12" />
                          <div className="text-xl font-medium">Queue is empty</div>
                      </div>
                  )}
                  
                  {queue.map((item, i) => (
                      <div key={item.id} className="flex items-center gap-5 p-4 rounded-2xl bg-black/40 border border-white/5 hover:bg-black/60 transition-colors">
                          <div className="text-2xl font-mono font-bold opacity-30 w-8 text-center">#{i+1}</div>
                          <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-white/10 flex-shrink-0 shadow-lg">
                              <Image src={item.song.albumArtUrl} alt="" fill className="object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                              <div className="font-bold text-lg truncate leading-snug">{item.song.title}</div>
                              <div className="opacity-60 truncate text-sm mt-0.5">{item.song.artist}</div>
                          </div>
                          <div className="text-center bg-white/10 px-4 py-2.5 rounded-xl border border-white/5">
                              <div className="text-2xl font-bold leading-none">{item.voteCount}</div>
                              <div className="text-[9px] uppercase tracking-wider opacity-50 mt-1">Votes</div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>

      </main>
    </div>
  );
}