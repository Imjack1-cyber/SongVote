'use client';

import { useState, useEffect } from 'react';
import { getSystemHealth } from '@/app/actions';
import { Activity, Database, Server, Cpu } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function SystemHealthMonitor() {
    const [metrics, setMetrics] = useState<any[]>([]);
    const [current, setCurrent] = useState({ memory: '-', connections: 0, dbLatency: 0 });

    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const data = await getSystemHealth();
                setCurrent(data);
                
                setMetrics(prev => {
                    const newMetrics = [...prev, {
                        time: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                        connections: data.connections,
                        latency: data.dbLatency
                    }];
                    if (newMetrics.length > 20) newMetrics.shift();
                    return newMetrics;
                });
            } catch (e) {
                console.error("Health Check Failed");
            }
        };

        fetchHealth();
        const interval = setInterval(fetchHealth, 3000); // 3 seconds poll
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-500" /> System Health
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card p-4 flex items-center gap-4">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                        <Server className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-sm opacity-60 font-bold uppercase">Redis Memory</div>
                        <div className="text-xl font-mono font-bold">{current.memory}</div>
                    </div>
                </div>

                <div className="card p-4 flex items-center gap-4">
                    <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
                        <Cpu className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-sm opacity-60 font-bold uppercase">Live Sockets</div>
                        <div className="text-xl font-mono font-bold">{current.connections}</div>
                    </div>
                </div>

                <div className="card p-4 flex items-center gap-4">
                    <div className="p-3 bg-orange-100 text-orange-600 rounded-lg">
                        <Database className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-sm opacity-60 font-bold uppercase">DB Latency</div>
                        <div className={`text-xl font-mono font-bold ${current.dbLatency > 100 ? 'text-red-500' : 'text-green-600'}`}>
                            {current.dbLatency}ms
                        </div>
                    </div>
                </div>
            </div>

            <div className="card p-4 min-w-0">
                <h3 className="text-sm font-bold mb-4 opacity-70">Real-Time Load (Socket Connections)</h3>
               <div style={{ width: '100%', height: '200px', position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={metrics}>
                            <XAxis dataKey="time" tick={{fontSize: 10}} interval={2} />
                            <YAxis domain={[0, 'auto']} allowDecimals={false} width={30} tick={{fontSize: 10}} />
                            <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                            <Line type="monotone" dataKey="connections" stroke="var(--accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}