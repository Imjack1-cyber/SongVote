'use client';

import { Check, X } from 'lucide-react';
import Image from 'next/image';

interface ModerationQueueProps {
  pendingItems: any[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export default function ModerationQueue({ pendingItems, onApprove, onReject }: ModerationQueueProps) {
  if (pendingItems.length === 0) return null;

  return (
    <div className="card border-l-4 border-l-orange-400 p-6 mb-6 bg-orange-50 dark:bg-orange-900/10 animate-in fade-in slide-in-from-top-4">
      <h3 className="font-bold text-orange-700 dark:text-orange-400 mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
        Pending Approval ({pendingItems.length})
      </h3>
      
      <div className="space-y-3">
        {pendingItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between bg-[var(--surface)] p-3 rounded-lg border border-[var(--border)] shadow-sm">
            <div className="flex items-center gap-3">
               {item.song.albumArtUrl && (
                  <Image src={item.song.albumArtUrl} alt="Art" width={40} height={40} className="rounded-md" />
               )}
               <div className="overflow-hidden max-w-[150px] sm:max-w-xs">
                 <p className="font-bold text-sm truncate">{item.song.title}</p>
                 <p className="text-xs opacity-60 truncate">{item.song.artist}</p>
               </div>
            </div>
            
            <div className="flex gap-2">
                <button 
                  onClick={() => onReject(item.id)}
                  className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                  title="Reject"
                >
                    <X className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => onApprove(item.id)}
                  className="p-2 rounded-lg text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition"
                  title="Approve"
                >
                    <Check className="w-5 h-5" />
                </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}