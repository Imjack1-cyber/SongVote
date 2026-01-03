'use client';

import { useState, useEffect } from 'react';
import { getSessionHistory } from '@/app/actions';
import { Download, History } from 'lucide-react';
import Image from 'next/image';

export default function HistoryView({ sessionId }: { sessionId: string }) {
    const [history, setHistory] = useState<any[]>([]);

    useEffect(() => {
        getSessionHistory(sessionId).then(setHistory);
    }, [sessionId]);

    const downloadCSV = () => {
        const headers = "Title,Artist,Played At,Requested By\n";
        const rows = history.map(item => 
            `"${item.song.title}","${item.song.artist}","${new Date(item.updatedAt).toLocaleString()}","${item.guest?.username || 'Host'}"`
        ).join("\n");
        
        const blob = new Blob([headers + rows], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session_history_${sessionId}.csv`;
        a.click();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <History className="w-5 h-5" /> Session History
                </h2>
                <button onClick={downloadCSV} className="btn-primary flex items-center gap-2 text-sm px-4 py-2">
                    <Download className="w-4 h-4" /> Export CSV
                </button>
            </div>

            <div className="grid gap-2">
                {history.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg">
                        <div className="w-12 h-12 relative bg-black rounded overflow-hidden flex-shrink-0">
                            <Image src={item.song.albumArtUrl} alt="" fill className="object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="font-bold truncate">{item.song.title}</div>
                            <div className="text-xs opacity-60 flex gap-2">
                                <span>{item.song.artist}</span>
                                <span>•</span>
                                <span>{new Date(item.updatedAt).toLocaleTimeString()}</span>
                            </div>
                        </div>
                        <div className="text-xs font-mono bg-[var(--foreground)]/5 px-2 py-1 rounded">
                            {item.guest?.username || 'Host'}
                        </div>
                    </div>
                ))}
                {history.length === 0 && <p className="text-center opacity-50 py-8">No songs played yet.</p>}
            </div>
        </div>
    );
}