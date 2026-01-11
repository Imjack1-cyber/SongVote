'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Users, Play, BarChart3, Radio } from 'lucide-react';

interface AdminDashboardProps {
  kpis: {
    totalHosts: number;
    totalSessions: number;
    activeSessions: number;
    totalVotes: number;
  };
  hosts: {
    id: string;
    username: string;
    createdAt: Date;
    sessionCount: number;
  }[];
  chartData: {
    date: string;
    count: number;
  }[];
}

export default function AdminDashboard({ kpis, hosts, chartData }: AdminDashboardProps) {
  return (
    <div className="space-y-8">
      
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start opacity-60">
             <span className="text-sm font-bold uppercase">Total Hosts</span>
             <Users className="w-5 h-5" />
          </div>
          <div className="text-4xl font-bold mt-2">{kpis.totalHosts}</div>
        </div>
        
        <div className="card p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start opacity-60">
             <span className="text-sm font-bold uppercase">Total Sessions</span>
             <Radio className="w-5 h-5" />
          </div>
          <div className="text-4xl font-bold mt-2">{kpis.totalSessions}</div>
        </div>

        <div className="card p-6 flex flex-col justify-between bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800 text-green-800 dark:text-green-400">
          <div className="flex justify-between items-start">
             <span className="text-sm font-bold uppercase">Active Now</span>
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
          <div className="text-4xl font-bold mt-2">{kpis.activeSessions}</div>
        </div>

        <div className="card p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start opacity-60">
             <span className="text-sm font-bold uppercase">Total Votes</span>
             <BarChart3 className="w-5 h-5" />
          </div>
          <div className="text-4xl font-bold mt-2 text-[var(--accent)]">{kpis.totalVotes.toLocaleString()}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Chart Section */}
        <div className="lg:col-span-2 card p-6">
           <h2 className="text-xl font-bold mb-6">Activity (Songs Queued - Last 30 Days)</h2>
           <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis 
                        dataKey="date" 
                        tick={{fontSize: 10, fill: 'var(--foreground)', opacity: 0.5}} 
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis 
                        tick={{fontSize: 10, fill: 'var(--foreground)', opacity: 0.5}} 
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip 
                        contentStyle={{ 
                            backgroundColor: 'var(--surface)', 
                            border: '1px solid var(--border)', 
                            borderRadius: '8px' 
                        }}
                    />
                    <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Host List Section */}
        <div className="card p-6 overflow-hidden flex flex-col">
            <h2 className="text-xl font-bold mb-4">Recent Hosts</h2>
            <div className="overflow-y-auto flex-1 pr-2 space-y-3">
                {hosts.map(host => (
                    <div key={host.id} className="p-3 bg-[var(--foreground)]/5 rounded-lg flex justify-between items-center text-sm">
                        <div>
                            <div className="font-bold">{host.username}</div>
                            <div className="text-[10px] opacity-50">Joined {new Date(host.createdAt).toLocaleDateString()}</div>
                        </div>
                        <div className="text-right">
                            <div className="font-mono font-bold">{host.sessionCount}</div>
                            <div className="text-[9px] uppercase tracking-wider opacity-50">Sessions</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
}