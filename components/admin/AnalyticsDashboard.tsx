'use client';

import { useState, useEffect } from 'react';
import { getDetailedAnalytics } from '@/app/actions';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Music, TrendingUp, Clock } from 'lucide-react';
import Image from 'next/image';

export default function AnalyticsDashboard() {
    const [data, setData] = useState<{ topSongs: any[], hourlyChart: any[] } | null>(null);

    useEffect(() => {
        getDetailedAnalytics().then(setData);
    }, []);

    if (!data) return <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />;

    return (
        <div className="grid lg:grid-cols-2 gap-8">
            
            {/* TOP SONGS */}
            <div className="card p-6 flex flex-col h-[400px]">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Music className="w-5 h-5 text-pink-500" /> Most Played (All Time)
                </h2>
                <div className="overflow-y-auto flex-1 pr-2 space-y-3">
                    {data.topSongs.map((song, i) => (
                        <div key={song.id} className="flex items-center gap-4 p-2 rounded-lg hover:bg-[var(--foreground)]/5 border border-transparent hover:border-[var(--border)] transition">
                            <div className="text-lg font-mono opacity-40 w-6 text-center">{i+1}</div>
                            <div className="relative w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-black">
                                {song.albumArtUrl && <Image src={song.albumArtUrl} alt="" fill className="object-cover" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="font-bold truncate text-sm">{song.title}</div>
                                <div className="text-xs opacity-60 truncate">{song.artist}</div>
                            </div>
                            <div className="font-mono font-bold bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-1 rounded text-xs">
                                {song.playCount}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* HOURLY TRENDS */}
            <div className="card p-6 h-[400px] min-w-0">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-500" /> Peak Usage (UTC Hour)
                </h2>
                <div style={{ width: '100%', height: '300px', position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.hourlyChart}>
                            <XAxis 
                                dataKey="hour" 
                                tick={{fontSize: 10}} 
                                interval={3} 
                                axisLine={false} 
                                tickLine={false} 
                            />
                            <YAxis hide />
                            <Tooltip 
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} 
                                cursor={{fill: 'var(--foreground)', opacity: 0.05}}
                            />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                {data.hourlyChart.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.count > 0 ? 'var(--accent)' : 'transparent'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </div>
    );
}