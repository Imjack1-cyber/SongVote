'use client';

import { useState, useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import QRCode from 'react-qr-code';
import Image from 'next/image';
import { Music2 } from 'lucide-react';
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

  useEffect(() => {
      if (typeof window !== 'undefined') {
          setJoinUrl(`${window.location.origin}/join`);
      }
  }, []);

  useEffect(() => {
    if (!socket) return;
    
    // State Sync
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
    <div className="min-h-screen bg-black text-white flex flex-col overflow-hidden font-sans relative">
      
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
      <header className="relative z-10 p-8 flex justify-between items-center border-b border-white/10 bg-black/40 backdrop-blur-sm">
          <div>
              <h1 className="text-4xl font-black tracking-tight">{sessionTitle}</h1>
              <p className="text-xl opacity-60">Hosted by {hostname}</p>
          </div>
          <div className="text-right flex items-center gap-6">
              <div>
                <div className="bg-white p-2 rounded-xl inline-block shadow-xl">
                    {joinUrl && <QRCode value={joinUrl} size={100} />}
                </div>
                <p className="mt-2 font-mono font-bold tracking-widest text-lg text-center">SCAN TO VOTE</p>
              </div>
          </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex gap-12 p-12">
          
          {/* NOW PLAYING (Left) */}
          <div className="flex-1 flex flex-col justify-center items-center text-center space-y-8 relative">
              <div className="relative w-[50vh] h-[50vh] rounded-3xl overflow-hidden shadow-2xl ring-4 ring-white/10">
                  {currentSong ? (
                      <Image src={currentSong.song.albumArtUrl} alt="Art" fill className="object-cover" />
                  ) : (
                      <div className="w-full h-full bg-neutral-900 flex items-center justify-center">
                          <Music2 className="w-32 h-32 opacity-20" />
                      </div>
                  )}
              </div>
              <div className="space-y-2">
                  <h2 className="text-5xl font-bold leading-tight line-clamp-2">
                      {currentSong ? currentSong.song.title : "Waiting for music..."}
                  </h2>
                  <p className="text-3xl opacity-60 font-light">
                      {currentSong?.song.artist}
                  </p>
              </div>
          </div>

          {/* UP NEXT (Right) */}
          <div className="w-1/3 bg-white/5 backdrop-blur-md rounded-3xl p-8 border border-white/10 flex flex-col">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <span className="w-2 h-8 bg-[var(--accent)] rounded-full"/> 
                  Up Next
              </h3>
              
              <div className="flex-1 space-y-4 overflow-hidden relative">
                  {queue.length === 0 && (
                      <div className="text-center opacity-40 mt-12 text-xl">Queue is empty.</div>
                  )}
                  
                  {queue.map((item, i) => (
                      <div key={item.id} className="flex items-center gap-4 p-4 rounded-xl bg-black/20 border border-white/5">
                          <div className="text-2xl font-mono font-bold opacity-30 w-8">#{i+1}</div>
                          <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                              <Image src={item.song.albumArtUrl} alt="" fill className="object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                              <div className="font-bold text-lg truncate">{item.song.title}</div>
                              <div className="opacity-60 truncate">{item.song.artist}</div>
                          </div>
                          <div className="text-center bg-white/10 px-4 py-2 rounded-lg">
                              <div className="text-2xl font-bold">{item.voteCount}</div>
                              <div className="text-[10px] uppercase tracking-wider opacity-50">Votes</div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>

      </main>
    </div>
  );
}