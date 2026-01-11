'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Users, Play, BarChart3, Radio, Ban, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { toggleHostBan, softDeleteHost, restoreHost } from '@/app/actions';
import { toast } from 'sonner';

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
    isBanned: boolean;
    deletedAt: Date | null;
    banReason: string | null;
  }[];
  chartData: {
    date: string;
    count: number;
  }[];
}

export default function AdminDashboard({ kpis, hosts, chartData }: AdminDashboardProps) {
  
  const handleBan = async (id: string, currentStatus: boolean) => {
      if (currentStatus) {
          if(!confirm("Unban this host?")) return;
          await toggleHostBan(id);
          toast.success("Host unbanned");
          return;
      }

      const reason = prompt("Enter a reason for banning this user (visible to them):");
      if (reason === null) return;
      if (!reason.trim()) {
          toast.error("A reason is required to ban a user.");
          return;
      }

      await toggleHostBan(id, reason);
      toast.success("Host banned");
  };

  const handleDelete = async (id: string) => {
      const reason = prompt("Enter a reason for DELETING this user (visible to them):");
      if (reason === null) return;
      if (!reason.trim()) {
          toast.error("A reason is required to delete a user.");
          return;
      }

      await softDeleteHost(id, reason);
      toast.success("Host soft deleted");
  };

  const handleRestore = async (id: string) => {
      if(!confirm("Restore this host account?")) return;
      await restoreHost(id);
      toast.success("Host account restored");
  };

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
        <div className="lg:col-span-2 card p-6 min-w-0">
           <h2 className="text-xl font-bold mb-6">Activity (Songs Queued - Last 30 Days)</h2>
           <div style={{ width: '100%', height: '300px', position: 'relative' }}>
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
        <div className="card p-6 overflow-hidden flex flex-col min-w-0">
            <h2 className="text-xl font-bold mb-4">Recent Hosts</h2>
            <div className="overflow-y-auto flex-1 pr-2 space-y-3">
                {hosts.map(host => (
                    <div key={host.id} className={`p-3 rounded-lg flex justify-between items-center text-sm border ${host.isBanned || host.deletedAt ? 'bg-red-50 border-red-100 dark:bg-red-900/10' : 'bg-[var(--foreground)]/5 border-transparent'}`}>
                        <div>
                            <div className="font-bold flex items-center gap-2">
                                {host.username}
                                {host.isBanned && <span className="text-[10px] bg-red-200 text-red-800 px-1 rounded font-bold" title={host.banReason || 'No reason'}>BANNED</span>}
                                {host.deletedAt && <span className="text-[10px] bg-gray-200 text-gray-800 px-1 rounded font-bold" title={host.banReason || 'No reason'}>DELETED</span>}
                            </div>
                            <div className="text-[10px] opacity-50">Joined {new Date(host.createdAt).toLocaleDateString()}</div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right mr-2">
                                <div className="font-mono font-bold">{host.sessionCount}</div>
                                <div className="text-[9px] uppercase tracking-wider opacity-50">Sessions</div>
                            </div>
                            
                            <button 
                                onClick={() => handleBan(host.id, host.isBanned)}
                                className={`p-1.5 rounded transition ${host.isBanned ? 'bg-red-500 text-white' : 'hover:bg-[var(--foreground)]/10 text-gray-400'}`}
                                title={host.isBanned ? "Unban" : "Ban User"}
                            >
                                <Ban className="w-4 h-4" />
                            </button>
                            
                            {!host.deletedAt ? (
                                <button 
                                    onClick={() => handleDelete(host.id)}
                                    className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition"
                                    title="Soft Delete"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            ) : (
                                <button 
                                    onClick={() => handleRestore(host.id)}
                                    className="p-1.5 rounded hover:bg-green-100 text-green-500 transition"
                                    title="Restore Account"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
}