'use client';

import { useState, useEffect } from 'react';
import { getSessionStats } from '@/app/actions';
import { Trophy, Medal, Star } from 'lucide-react';

export default function Leaderboard({ sessionId }: { sessionId: string }) {
    const [users, setUsers] = useState<any[]>([]);

    useEffect(() => {
        // Reuse getSessionStats but filter for Karma on client or update server action
        // For now, we assume getSessionStats returns all guests.
        // We will need to update getSessionStats in actions.ts to return karma if it doesn't already.
        // *Correction*: In previous step, I updated schema but getSessionStats needs to select `karma`.
        const load = async () => {
            const data = await getSessionStats(sessionId);
            // Sort by karma desc
            const sorted = data.sort((a: any, b: any) => (b.karma || 0) - (a.karma || 0));
            setUsers(sorted.slice(0, 5)); // Top 5
        };
        load();
        const interval = setInterval(load, 10000);
        return () => clearInterval(interval);
    }, [sessionId]);

    if (users.length === 0) return null;

    return (
        <div className="card p-6 border-yellow-200 bg-yellow-50/50 dark:bg-yellow-900/10 dark:border-yellow-900/30">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-yellow-800 dark:text-yellow-500">
                <Trophy className="w-5 h-5" /> Top DJs
            </h2>
            <div className="space-y-3">
                {users.map((user, i) => (
                    <div key={user.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold 
                                ${i === 0 ? 'bg-yellow-400 text-white' : 
                                  i === 1 ? 'bg-slate-300 text-slate-700' : 
                                  i === 2 ? 'bg-amber-600 text-white' : 'bg-[var(--foreground)]/10'}`}>
                                {i + 1}
                            </div>
                            <span className="font-medium text-sm">{user.name}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-bold opacity-70">
                            {user.karma || 0} <Star className="w-3 h-3 fill-current" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}