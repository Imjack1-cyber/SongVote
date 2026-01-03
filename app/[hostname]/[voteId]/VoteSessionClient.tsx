'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { Share2, Settings, Wifi, WifiOff, ShieldAlert, Check, Send, Clock, AlertCircle, Info, Trash2, Ban, History, Search, QrCode, Pause, SkipForward, Printer } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import SongSearch from '@/components/vote/SongSearch';
import QueueList from '@/components/vote/QueueList';
import ModerationQueue from '@/components/host/ModerationQueue';
import HostPlayer from '@/components/host/HostPlayer';
import QRCodeModal from '@/components/common/QRCodeModal';
import { toast } from 'sonner';

interface VoteSessionClientProps {
  hostName: string;
  voteId: string;
  isHost: boolean;
  voterId: string | null;
  initialQueue: any[];
  initialCurrent: any | null;
  initialHistory: any[];
  initialPlaybackState: any;
  votesPerUser: number;
  cycleDelayMinutes: number;
  initialSubmittedIds: string[];
  initialTimeLeft: number;
  userPermissions?: any;
}

export default function VoteSessionClient({ 
  hostName, 
  voteId, 
  isHost, 
  voterId,
  initialQueue,
  initialCurrent,
  initialHistory,
  initialPlaybackState,
  votesPerUser,
  cycleDelayMinutes,
  initialSubmittedIds,
  initialTimeLeft,
  userPermissions
}: VoteSessionClientProps) {
  
  const { socket, isConnected } = useSocket(voteId);
  
  const [queue, setQueue] = useState<any[]>(initialQueue);
  const [currentSong, setCurrentSong] = useState<any | null>(initialCurrent);
  const [history, setHistory] = useState<any[]>(initialHistory);
  const [playbackState, setPlaybackState] = useState<any>(initialPlaybackState);
  const [pendingQueue, setPendingQueue] = useState<any[]>([]);
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()); 
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set(initialSubmittedIds));
  const [timeLeft, setTimeLeft] = useState(initialTimeLeft);
  
  const [showShareTooltip, setShowShareTooltip] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('');

  const remainingVotes = votesPerUser - submittedIds.size;
  const canControlPlayer = isHost || userPermissions?.controlPlayer;
  const canPrint = isHost || userPermissions?.printCards;

  // Filter History
  const filteredHistory = useMemo(() => {
      if (!historyFilter) return history;
      const lower = historyFilter.toLowerCase();
      return history.filter(item => 
          item.song.title.toLowerCase().includes(lower) || 
          item.song.artist.toLowerCase().includes(lower)
      );
  }, [history, historyFilter]);

  // Countdown Logic
  useEffect(() => {
    if (timeLeft <= 0) {
        if (submittedIds.size > 0 && initialTimeLeft > 0 && cycleDelayMinutes > 0) {
             setSubmittedIds(new Set());
             toast.info("New voting round started!");
        }
        return;
    }
    const interval = setInterval(() => {
        setTimeLeft((prev) => {
            const next = Math.max(0, prev - 1);
            if (next === 0) {
                setSubmittedIds(new Set()); 
                setSelectedIds(new Set());
                toast.info("Round reset. You can vote again.");
            }
            return next;
        });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft, initialTimeLeft, cycleDelayMinutes, submittedIds.size]);

  // Socket Listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('state-update', ({ queue, current, playbackState }: any) => {
        setQueue(queue);
        
        setCurrentSong((prev: any) => {
            if (prev && current && prev.id !== current.id) {
                setHistory(h => [prev, ...h]);
            } else if (prev && !current) {
                setHistory(h => [prev, ...h]);
            }
            return current;
        });

        if (playbackState) setPlaybackState(playbackState);
    });

    socket.on('player-sync', (state: any) => setPlaybackState(state));

    socket.on('vote-success', ({ confirmedIds, cooldownSeconds }: any) => {
        setSubmittedIds(prev => {
            const next = new Set(prev);
            confirmedIds.forEach((id: string) => next.add(id));
            return next;
        });
        setSelectedIds(new Set());
        if (cooldownSeconds > 0) setTimeLeft(cooldownSeconds);
        toast.success("Votes submitted!");
    });
    
    socket.on('session-cleared', () => {
        setQueue([]);
        setCurrentSong(null);
        setHistory([]);
        setPlaybackState(null);
        toast.info("Host cleared all session data.");
    });

    socket.on('timer-reset', ({ targetUserId }: { targetUserId: string | null }) => {
        if (!targetUserId || targetUserId === voterId) {
            setTimeLeft(0);
            setSubmittedIds(new Set());
            setSelectedIds(new Set());
            toast.info("Your timer has been reset by the host!");
        }
    });

    socket.on('error', (msg: string) => toast.error(msg));

    if (isHost && isConnected) {
        socket.emit('join-host-room', voteId);
        socket.on('pending-update', (pending: any[]) => setPendingQueue(pending));
    }

    return () => {
      socket.off('state-update');
      socket.off('player-sync');
      socket.off('vote-success');
      socket.off('session-cleared');
      socket.off('timer-reset');
      socket.off('error');
      socket.off('pending-update');
    };
  }, [socket, isHost, isConnected, voteId, voterId]);

  // Handlers
  const handleSuggest = (songData: any) => {
    if (!socket || !voterId) return toast.error("Please join first.");
    socket.emit('suggest-song', { sessionId: voteId, songData, suggestedBy: voterId });
    toast.success("Suggestion sent!");
  };

  const handleToggleVote = (queueItemId: string) => {
    if (!socket || !voterId) return toast.error("Please join to vote.");
    if (timeLeft > 0) return toast.warning(`Round cooldown active. Wait ${formatTime(timeLeft)}`);
    if (submittedIds.has(queueItemId)) return;

    const newSelection = new Set(selectedIds);
    if (newSelection.has(queueItemId)) newSelection.delete(queueItemId);
    else {
        if (newSelection.size >= remainingVotes) return toast.error(`Limit reached: ${votesPerUser} votes.`);
        newSelection.add(queueItemId);
    }
    setSelectedIds(newSelection);
  };

  const handleSubmitVotes = () => {
      if (!socket || !voterId) return;
      socket.emit('batch-vote', { sessionId: voteId, queueItemIds: Array.from(selectedIds), voterId });
  };

  const handleSongStarted = useCallback((queueItemId: string) => {
      if (!socket) return;
      // Optimistic Update
      const songToStart = queue.find(item => item.id === queueItemId);
      if (songToStart) {
          setCurrentSong(songToStart);
          setQueue(prevQueue => prevQueue.filter(item => item.id !== queueItemId));
      }
      socket.emit('song-started', { sessionId: voteId, queueItemId });
  }, [socket, queue, voteId]);

  const handleSongEnded = useCallback((queueItemId: string) => {
      if (!socket) return;
      
      const nextSong = queue.length > 0 ? queue[0] : null;
      const nextId = nextSong ? nextSong.id : null;

      // Optimistic Update
      if (currentSong) setHistory(h => [currentSong, ...h]);
      setCurrentSong(nextSong);
      if (nextSong) setQueue(q => q.slice(1));
      
      socket.emit('song-transition', { sessionId: voteId, prevId: queueItemId, nextId, voterId });
  }, [socket, queue, currentSong, voteId, voterId]);

  const handleSongBack = useCallback(() => {
      if (!socket) return;
      socket.emit('song-back', { sessionId: voteId, voterId });
  }, [socket, voteId, voterId]);

  const handleForcePlay = async (url: string) => {
      if (!socket) return;
      try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(url)}&host=${hostName}`);
          const data = await res.json();
          if (data.tracks?.items?.length > 0) {
              socket.emit('force-play', { sessionId: voteId, songData: data.tracks.items[0], voterId });
              toast.success("Playing forced song...");
          } else {
              toast.error("Video not found.");
          }
      } catch (e) { toast.error("Error processing URL."); }
  };

  const handleRemoveSong = (itemId: string) => {
      if (confirm("Remove this song from queue?")) {
          socket?.emit('remove-song', { sessionId: voteId, queueItemId: itemId, voterId });
          setQueue(prev => prev.filter(i => i.id !== itemId));
          toast.success("Song removed");
      }
  };

  const handleBanUser = (itemId: string) => {
      if (confirm("Ban this user from suggesting?")) {
          socket?.emit('ban-suggester', { sessionId: voteId, queueItemId: itemId, voterId });
          toast.success("User banned");
      }
  };

  const handleApprove = (itemId: string) => socket?.emit('approve-song', { itemId, sessionId: voteId });
  const handleReject = (itemId: string) => socket?.emit('reject-song', { itemId, sessionId: voteId });

  const handleShare = () => {
      navigator.clipboard.writeText(window.location.href);
      setShowShareTooltip(true);
      setTimeout(() => setShowShareTooltip(false), 2000);
      toast.success("Link copied!");
  };

  const formatTime = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-32">
      
      <div className="flex items-start justify-between">
        <div>
            <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">Session Vote</h1>
                <div className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1 ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    {isConnected ? 'Live' : '...'}
                </div>
                {isHost && <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-bold border border-indigo-200">Host</span>}
            </div>
            <p className="opacity-60">Vote for the next track.</p>
        </div>
        <div className="flex gap-2">
            {canPrint && <Link href={`/${hostName}/${voteId}/print`} target="_blank" className="p-2 rounded-lg border bg-[var(--surface)] hover:bg-[var(--foreground)]/5 text-[var(--foreground)] transition"><Printer className="w-5 h-5" /></Link>}
            <button onClick={() => setShowQR(true)} className="p-2 rounded-lg border bg-[var(--surface)] hover:bg-[var(--foreground)]/5 text-[var(--foreground)] transition" title="Show Join Code"><QrCode className="w-5 h-5" /></button>
            <button onClick={handleShare} className="p-2 rounded-lg border bg-[var(--surface)] hover:bg-[var(--foreground)]/5">{showShareTooltip ? <Check className="w-5 h-5 text-green-600" /> : <Share2 className="w-5 h-5" />}</button>
            {isHost && <Link href={`/${hostName}/${voteId}/settings`} target="_blank" className="p-2 rounded-lg border bg-[var(--surface)] hover:bg-[var(--foreground)]/5"><Settings className="w-5 h-5" /></Link>}
        </div>
      </div>

      {isHost && (
          <HostPlayer 
            currentSong={currentSong} 
            nextUp={queue.length > 0 ? queue[0] : null} 
            voteId={voteId} 
            onSongStarted={handleSongStarted} 
            onSongEnded={handleSongEnded}
            onSongBack={handleSongBack}
            onForcePlay={handleForcePlay}
            initialSyncState={playbackState}
          />
      )}

      {!isHost && canControlPlayer && currentSong && (
        <div className="card p-4 mb-6 bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800">
            <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" /> Remote Control
                </div>
                <div className="flex gap-4">
                   <button onClick={() => socket.emit('player-update', { sessionId: voteId, state: { status: 'paused', videoId: currentSong.songId, position: 0 }, voterId })}>
                       <Pause className="w-5 h-5" />
                   </button>
                   <button onClick={() => handleSongEnded(currentSong.id)}>
                       <SkipForward className="w-5 h-5" />
                   </button>
                </div>
            </div>
        </div>
      )}

      {isHost && <ModerationQueue pendingItems={pendingQueue} onApprove={handleApprove} onReject={handleReject} />}

      {!isHost && currentSong && (
          <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl flex items-center gap-4 shadow-sm animate-in slide-in-from-top-2">
              <div className="w-12 h-12 bg-black rounded-lg overflow-hidden relative">
                  <img src={currentSong.song.albumArtUrl || ''} className="object-cover w-full h-full" alt="" />
              </div>
              <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] mb-0.5">Now Playing</div>
                  <div className="font-bold text-sm line-clamp-1">{currentSong.song.title}</div>
                  <div className="text-xs opacity-60">{currentSong.song.artist}</div>
              </div>
          </div>
      )}

      {voterId ? (
          timeLeft > 0 ? (
              <div className="p-6 bg-[var(--surface)] border border-[var(--border)] rounded-xl flex flex-col items-center justify-center text-center">
                  <Clock className="w-8 h-8 mb-2 text-orange-500" />
                  <h3 className="font-bold text-lg">Next Round in {formatTime(timeLeft)}</h3>
                  <p className="text-sm opacity-60">Voting is paused.</p>
              </div>
          ) : (
              <div className="sticky top-[80px] z-30 bg-[var(--background)]/80 backdrop-blur-md pb-4 pt-2 -mt-2">
                 <SongSearch hostName={hostName} onSuggest={handleSuggest} />
              </div>
          )
      ) : (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm text-center">View Only Mode</div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">Up Next <span className="bg-[var(--foreground)]/10 text-xs px-2 py-1 rounded-full">{queue.length}</span></h3>
            {voterId && (
                <div className="text-xs font-medium">
                    {timeLeft > 0 ? 
                        <span className="text-orange-600">Next round: {formatTime(timeLeft)}</span> : 
                        (remainingVotes === 0 ? <div className="group relative flex items-center gap-1.5 text-red-600 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-md cursor-help"><AlertCircle className="w-3.5 h-3.5" /><span>Limit Reached</span><Info className="w-3.5 h-3.5 opacity-50" /><div className="absolute top-full right-0 mt-2 w-64 p-3 bg-black text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">Limit: {votesPerUser} votes per round.</div></div> : <span>Votes left: {remainingVotes}</span>)
                    }
                </div>
            )}
        </div>
        <QueueList items={queue} onToggle={handleToggleVote} selectedIds={selectedIds} submittedIds={submittedIds} isHost={isHost} onRemove={handleRemoveSong} onBan={handleBanUser} />
      </div>

      {history.length > 0 && (
          <div className="mt-12 pt-8 border-t border-[var(--border)]">
              <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                      <History className="w-5 h-5 opacity-60" /> Previously Played
                  </h3>
                  <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Filter history..." 
                        value={historyFilter}
                        onChange={(e) => setHistoryFilter(e.target.value)}
                        className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] w-40"
                      />
                      <Search className="w-3 h-3 absolute left-2.5 top-2.5 opacity-40" />
                  </div>
              </div>
              <div className="space-y-2 opacity-60 hover:opacity-100 transition-opacity">
                  {filteredHistory.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--foreground)]/5 transition">
                          <div className="w-10 h-10 relative bg-black rounded overflow-hidden flex-shrink-0 grayscale">
                              <Image src={item.song.albumArtUrl} alt="" fill className="object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                              <div className="font-bold text-sm truncate">{item.song.title}</div>
                              <div className="text-xs truncate opacity-70">{item.song.artist}</div>
                          </div>
                      </div>
                  ))}
                  {filteredHistory.length === 0 && historyFilter && <div className="text-xs text-center p-4">No matching songs.</div>}
              </div>
          </div>
      )}

      {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-0 right-0 px-4 flex justify-center z-50">
              <button onClick={handleSubmitVotes} className="bg-[var(--accent)] text-[var(--accent-fg)] px-8 py-3 rounded-full font-bold shadow-2xl flex items-center gap-3 hover:scale-105 transition-transform">
                  <Send className="w-5 h-5" /> Submit {selectedIds.size} Vote{selectedIds.size > 1 ? 's' : ''}
              </button>
          </div>
      )}

      <QRCodeModal isOpen={showQR} onClose={() => setShowQR(false)} sessionTitle={`${hostName}'s Session`} />
    </div>
  );
}