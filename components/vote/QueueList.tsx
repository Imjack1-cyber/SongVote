'use client';

import { ThumbsUp, Music, Check, Trash2, Ban, Shield } from 'lucide-react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

interface QueueListProps {
  items: any[];
  onToggle: (itemId: string) => void;
  selectedIds: Set<string>;
  submittedIds: Set<string>;
  isHost?: boolean;
  onRemove?: (itemId: string) => void;
  onBan?: (itemId: string) => void;
}

export default function QueueList({ items, onToggle, selectedIds, submittedIds, isHost, onRemove, onBan }: QueueListProps) {
  if (items.length === 0) {
    return (
        <div className="card min-h-[300px] flex flex-col items-center justify-center p-8 text-center border-dashed border-2 border-[var(--border)] bg-[var(--background)]">
            <div className="w-16 h-16 rounded-full bg-[var(--foreground)]/5 flex items-center justify-center mb-4">
                <Music className="w-6 h-6 opacity-40" />
            </div>
            <h3 className="text-lg font-semibold mb-2">The queue is empty</h3>
            <p className="opacity-60 max-w-sm">Be the first to suggest a track!</p>
        </div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence mode='popLayout'>
      {items.map((item, index) => {
        const isSelected = selectedIds.has(item.id);
        const isSubmitted = submittedIds.has(item.id);
        
        return (
            <motion.div 
                layout
                key={item.id} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                // FIX: Allow Host to click row to toggle vote
                onClick={() => !isSubmitted && onToggle(item.id)}
                className={`card p-4 flex items-center justify-between group transition-all relative overflow-hidden cursor-pointer
                    ${isSelected ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'hover:border-[var(--border)]'}
                    ${isSubmitted ? 'opacity-70 grayscale' : ''}
                `}
            >
            
            {/* Progress Bar Background */}
            <div 
                className="absolute left-0 top-0 bottom-0 bg-[var(--accent)]/5 transition-all duration-500 ease-out z-0"
                style={{ width: `${Math.min(item.voteCount * 5, 100)}%` }} 
            />

            <div className="flex items-center gap-4 relative z-10 overflow-hidden flex-1">
                <div className="flex-shrink-0 font-mono text-lg opacity-40 w-6 text-center">
                    #{index + 1}
                </div>
                <div className="relative w-12 h-12 flex-shrink-0 bg-gray-200 rounded-lg overflow-hidden">
                    {item.song.albumArtUrl ? (
                        <Image 
                            src={item.song.albumArtUrl} 
                            alt="Art" 
                            fill
                            sizes="48px"
                            className="object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-gray-300" />
                    )}
                </div>
                <div className="min-w-0">
                    <h4 className="font-bold text-sm md:text-base line-clamp-1" dangerouslySetInnerHTML={{ __html: item.song.title }} />
                    <p className="text-xs md:text-sm opacity-60 truncate">{item.song.artist}</p>
                </div>
            </div>

            <div className="flex items-center gap-3 relative z-10 flex-shrink-0 ml-2">
                <div className="text-center hidden sm:block">
                    <span className="block font-bold text-lg leading-none">{item.voteCount}</span>
                    <span className="text-[10px] uppercase font-bold opacity-50">Votes</span>
                </div>
                
                {/* VOTE TOGGLE (Available to Everyone) */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0
                    ${isSubmitted 
                        ? 'bg-green-500 text-white' 
                        : isSelected 
                            ? 'bg-[var(--accent)] text-white scale-110' 
                            : 'border-2 border-[var(--border)] text-transparent hover:border-[var(--accent)]'
                    }`}
                >
                    {isSubmitted ? <Check className="w-5 h-5" /> : <ThumbsUp className="w-4 h-4" />}
                </div>

                {/* ADMIN CONTROLS (Host Only - Extra Buttons) */}
                {isHost && (
                    <div className="flex gap-1 pl-2 border-l border-[var(--border)] ml-2">
                        {onBan && (
                            <button onClick={(e) => { e.stopPropagation(); onBan(item.id); }} className="p-2 rounded-full hover:bg-red-100 text-red-500 transition" title="Ban User">
                                <Ban className="w-4 h-4" />
                            </button>
                        )}
                        {onRemove && (
                            <button onClick={(e) => { e.stopPropagation(); onRemove(item.id); }} className="p-2 rounded-full hover:bg-red-100 text-red-500 transition" title="Remove Song">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}
            </div>
            </motion.div>
        );
      })}
      </AnimatePresence>
    </div>
  );
}