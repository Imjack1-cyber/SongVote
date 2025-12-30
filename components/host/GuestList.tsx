// ========================================================================
// FILE: components/host/GuestList.tsx
// ========================================================================

'use client';

import { Printer, Ban, Trash2, CheckCircle } from 'lucide-react';
import { banGuest } from '@/app/actions';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface GuestListProps {
  guests: any[];
  sessionId: string;
}

export default function GuestList({ guests, sessionId }: GuestListProps) {
  const [printUrl, setPrintUrl] = useState('');

  useEffect(() => {
    // Safely access window on client
    const hostname = window.location.pathname.split('/')[1];
    setPrintUrl(`/${hostname}/${sessionId}/print`);
  }, [sessionId]);

  if (guests.length === 0) {
    return (
        <div className="text-center py-8 opacity-60 italic print:hidden">
            No guest accounts generated yet.
        </div>
    );
  }

  return (
    <div className="space-y-4">
        {/* Actions Bar */}
        <div className="print:hidden flex justify-end">
            {printUrl && (
                <Link 
                    href={printUrl} 
                    target="_blank"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--foreground)]/5 text-sm font-medium transition"
                >
                    <Printer className="w-4 h-4" /> Print Cards
                </Link>
            )}
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 gap-4">
            {guests.map((guest) => (
                <div key={guest.id} className="relative p-4 border border-[var(--border)] rounded-xl bg-[var(--surface)] print:border-black print:break-inside-avoid shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <div className="text-xs uppercase font-bold text-[var(--accent)] tracking-wider flex items-center gap-1">
                            Guest Access
                        </div>
                        <form action={banGuest} className="print:hidden">
                            <input type="hidden" name="guestId" value={guest.id} />
                            <button 
                                type="submit" 
                                className={`text-xs p-1.5 rounded-md transition-colors ${
                                    guest.isBanned 
                                    ? 'bg-red-100 text-red-600 font-bold' 
                                    : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                                }`}
                                title={guest.isBanned ? "Unban" : "Ban User"}
                            >
                                {guest.isBanned ? 'BANNED' : <Ban className="w-4 h-4" />}
                            </button>
                        </form>
                    </div>
                    
                    <div className="text-center py-3 space-y-1">
                        <div className="text-[10px] uppercase font-bold opacity-40 tracking-widest">Username</div>
                        <div className={`text-xl font-mono font-bold ${guest.isBanned ? 'line-through opacity-50' : ''}`}>
                            {guest.username}
                        </div>
                        
                        <div className="h-2" />
                        
                        <div className="text-[10px] uppercase font-bold opacity-40 tracking-widest">Passcode</div>
                        <div className="text-2xl font-mono font-bold tracking-[0.2em] bg-[var(--foreground)]/5 py-1 rounded">
                            {guest.password}
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[var(--border)] text-center">
                        <p className="text-[10px] opacity-50">Go to <strong>songvote.com/join</strong></p>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
}