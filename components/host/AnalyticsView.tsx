// ========================================================================
// FILE: components/host/AnalyticsView.tsx
// ========================================================================

'use client';

import { useState, useEffect } from 'react';
import { getSessionAnalytics } from '@/app/actions';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart3 } from 'lucide-react';

export default function AnalyticsView({ sessionId }: { sessionId: string }) {
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        getSessionAnalytics(sessionId).then(setData);
    }, [sessionId]);

    if (!data) return <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />;

    const chartData = data.topSongs.map((item: any) => ({
        name: item.song.title.substring(0, 15) + '...',
        votes: item.voteCount
    }));

    return (
        <div className="space-y-8">
            <h2 className="text-xl font-bold flex items-center gap-2">
                <BarChart3 className="w-5 h-5" /> Analytics
            </h2>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-center">
                    <div className="text-4xl font-bold text-[var(--accent)]">{data.totalVotes}</div>
                    <div className="text-sm opacity-60 uppercase tracking-wider mt-1">Total Votes</div>
                </div>
                <div className="p-6 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-center">
                    <div className="text-4xl font-bold text-green-500">{data.topSongs.length}</div>
                    <div className="text-sm opacity-60 uppercase tracking-wider mt-1">Unique Songs</div>
                </div>
            </div>

            <div className="h-64 w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
                <h3 className="text-sm font-bold mb-4 opacity-70">Top Voted Songs</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical">
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                        <Bar dataKey="votes" fill="var(--accent)" radius={[0, 4, 4, 0]}>
                            {chartData.map((_: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--accent)' : '#cbd5e1'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}