'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, TimerReset, User, Clock, Check, Shield, Lock, Zap, Trash2, ListMusic, Printer, AlertOctagon } from 'lucide-react';
import { getSessionStats, updateGuestPermissions } from '@/app/actions';
import { Permissions } from '@/lib/permissions';
import { useSocket } from '@/hooks/useSocket';
import { toast } from 'sonner';

interface Stats {
    id: string;
    name: string;
    votesUsed: number;
    timeLeft: number;
    permissions?: Permissions;
    isHost: boolean;
    karma?: number;
}

export default function SessionManager({ sessionId, currentUserId }: { sessionId: string, currentUserId: string }) {
    const { socket } = useSocket(sessionId);
    const [stats, setStats] = useState<Stats[]>([]);
    const [loading, setLoading] = useState(false);

    const loadStats = async () => {
        setLoading(true);
        const data = await getSessionStats(sessionId);
        setStats(data as any);
        setLoading(false);
    };

    useEffect(() => {
        loadStats();
        const interval = setInterval(loadStats, 5000);
        return () => clearInterval(interval);
    }, [sessionId]);

    useEffect(() => {
        if (!socket) return;
        socket.on('timer-reset', () => loadStats());
        return () => { socket.off('timer-reset'); };
    }, [socket]);

    const handleResetTimers = (targetUserId?: string) => {
        if (!confirm(targetUserId ? "Reset this user's timer?" : "Reset ALL users?")) return;
        
        if (socket) {
            socket.emit('admin-reset-timer', { sessionId, targetUserId, voterId: currentUserId }); 
            toast.success("Reset command sent");
            
            setStats(prev => prev.map(u => 
                (targetUserId && u.id !== targetUserId) ? u : { ...u, votesUsed: 0, timeLeft: 0 }
            ));
        } else {
            toast.error("Connection lost");
        }
    };

    const handleClearSession = () => {
        if (!confirm("DANGER: This will delete ALL songs from the Queue, History, and stop playback. This cannot be undone. Continue?")) return;

        if (socket) {
            socket.emit('clear-session', { sessionId, voterId: currentUserId });
            toast.success("Clearing session data...");
        }
    };

    const togglePerm = async (userId: string, perm: keyof Permissions, currentVal: boolean) => {
        setStats(prev => prev.map(u => 
            u.id === userId && u.permissions 
            ? { ...u, permissions: { ...u.permissions, [perm]: !currentVal } }
            : u
        ));
        await updateGuestPermissions(userId, { [perm]: !currentVal });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <User className="w-5 h-5" /> Active Users & Permissions
                </h2>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={() => loadStats()} disabled={loading} className="p-2 text-sm border rounded hover:bg-gray-100">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button 
                        id="reset-timer-btn"
                        onClick={() => handleResetTimers()}
                        className="px-3 py-1.5 text-sm border border-orange-200 bg-orange-50 text-orange-700 rounded hover:bg-orange-100 flex items-center gap-2"
                    >
                        <TimerReset className="w-4 h-4" /> Reset Timers
                    </button>
                    <button 
                        id="clear-session-btn"
                        onClick={handleClearSession}
                        className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-2"
                    >
                        <AlertOctagon className="w-4 h-4" /> Clear Queue & History
                    </button>
                </div>
            </div>

            <div id="user-list-table" className="overflow-x-auto border border-[var(--border)] rounded-lg bg-[var(--surface)]">
                <table className="w-full text-sm text-left">
                    <thead className="bg-[var(--foreground)]/5 text-[var(--foreground)]/60 font-medium">
                        <tr>
                            <th className="px-4 py-3">User</th>
                            <th className="px-4 py-3 text-center">Status</th>
                            <th className="px-4 py-3 text-center" title="Control Player"><Shield className="w-4 h-4 mx-auto" /></th>
                            <th className="px-4 py-3 text-center" title="Force Play"><Zap className="w-4 h-4 mx-auto" /></th>
                            <th className="px-4 py-3 text-center" title="Manage Queue"><ListMusic className="w-4 h-4 mx-auto" /></th>
                            <th className="px-4 py-3 text-center" title="Print Cards"><Printer className="w-4 h-4 mx-auto" /></th>
                            <th className="px-4 py-3 text-right">Timer</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                        {stats.map((user) => (
                            <tr key={user.id} className="hover:bg-[var(--foreground)]/5">
                                <td className="px-4 py-3 font-medium">
                                    {user.name}
                                    {user.isHost && <span className="ml-2 text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">HOST</span>}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {user.timeLeft > 0 ? (
                                        <span className="text-orange-500 font-mono text-xs">{Math.ceil(user.timeLeft/60)}m</span>
                                    ) : <Check className="w-4 h-4 text-green-500 mx-auto" />}
                                </td>
                                
                                <PermissionCell user={user} perm="controlPlayer" onToggle={togglePerm} icon={<Shield className="w-4 h-4" />} />
                                <PermissionCell user={user} perm="forcePlay" onToggle={togglePerm} icon={<Zap className="w-4 h-4" />} />
                                <PermissionCell user={user} perm="manageQueue" onToggle={togglePerm} icon={<ListMusic className="w-4 h-4" />} />
                                <PermissionCell user={user} perm="printCards" onToggle={togglePerm} icon={<Printer className="w-4 h-4" />} />

                                <td className="px-4 py-3 text-right">
                                    <button onClick={() => handleResetTimers(user.id)} className="text-xs text-red-500 hover:text-red-700 hover:underline">Reset</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function PermissionCell({ user, perm, onToggle, icon }: any) {
    if (user.isHost) return <td className="text-center opacity-30"><Check className="w-4 h-4 mx-auto" /></td>;
    
    const hasPerm = user.permissions?.[perm] || false;
    return (
        <td className="px-4 py-3 text-center">
            <button 
                onClick={() => onToggle(user.id, perm, hasPerm)}
                className={`p-1.5 rounded transition ${hasPerm ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
            >
                {hasPerm ? icon : <Lock className="w-3 h-3" />}
            </button>
        </td>
    );
}