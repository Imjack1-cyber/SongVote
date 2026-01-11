'use client';

import { useState, useEffect } from 'react';
import { updateFeedbackStatus, deleteFeedback } from '@/app/actions';
import { Bug, Lightbulb, HelpCircle, CheckCircle, Archive, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useSocket } from '@/hooks/useSocket';

interface Feedback {
    id: string;
    content: string;
    type: 'BUG' | 'SUGGESTION' | 'OTHER';
    status: 'OPEN' | 'RESOLVED' | 'ARCHIVED';
    userId: string | null;
    createdAt: Date | string; // Allow string for serialization
}

export default function FeedbackList({ items }: { items: Feedback[] }) {
    const [filter, setFilter] = useState<'ALL' | 'OPEN'>('OPEN');
    const [feedbackItems, setFeedbackItems] = useState<Feedback[]>(items);
    
    // Connect to global namespace to perform auth check in join-admin-room
    const { socket } = useSocket('admin_dashboard_view');

    useEffect(() => {
        if (!socket) return;

        console.log('[CLIENT] Socket connected:', socket.id);

        // 1. Join secure room
        console.log('[CLIENT] Emitting join-admin-room');
        socket.emit('join-admin-room');

        // 2. Listen for real-time updates
        const handleUpdate = (payload: any) => {
            console.log('[CLIENT] Received admin-update:', payload);
            if (payload.type === 'NEW_FEEDBACK' && payload.data) {
                setFeedbackItems(prev => [payload.data, ...prev]);
                toast.info("New feedback received");
            }
        };

        socket.on('admin-update', handleUpdate);

        return () => {
            socket.off('admin-update', handleUpdate);
        };
    }, [socket]);

    const filteredItems = filter === 'ALL' 
        ? feedbackItems 
        : feedbackItems.filter(i => i.status === 'OPEN');

    const handleStatus = async (id: string, status: 'RESOLVED' | 'ARCHIVED') => {
        setFeedbackItems(prev => prev.map(item => 
            item.id === id ? { ...item, status } : item
        ));
        toast.success(`Marked as ${status}`);
        try { await updateFeedbackStatus(id, status); } catch (e) { toast.error("Failed to update status"); }
    };

    const handleDelete = async (id: string) => {
        if(!confirm("Delete this feedback permanently?")) return;
        setFeedbackItems(prev => prev.filter(item => item.id !== id));
        toast.success("Deleted");
        await deleteFeedback(id);
    };

    const icons = {
        BUG: <Bug className="w-4 h-4 text-red-500" />,
        SUGGESTION: <Lightbulb className="w-4 h-4 text-yellow-500" />,
        OTHER: <HelpCircle className="w-4 h-4 text-gray-500" />
    };

    const statusColors = {
        OPEN: 'bg-green-100 text-green-700',
        RESOLVED: 'bg-blue-100 text-blue-700',
        ARCHIVED: 'bg-gray-100 text-gray-700'
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 bg-[var(--foreground)]/5 p-1 rounded-lg w-fit">
                <button 
                    onClick={() => setFilter('OPEN')}
                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition ${filter === 'OPEN' ? 'bg-[var(--surface)] shadow text-[var(--accent)]' : 'opacity-60'}`}
                >
                    Open
                </button>
                <button 
                    onClick={() => setFilter('ALL')}
                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition ${filter === 'ALL' ? 'bg-[var(--surface)] shadow text-[var(--accent)]' : 'opacity-60'}`}
                >
                    All History
                </button>
            </div>

            <div className="grid gap-4">
                {filteredItems.length === 0 && <div className="text-center opacity-50 py-12">No feedback found.</div>}
                
                {filteredItems.map(item => (
                    <div key={item.id} className="card p-4 flex flex-col md:flex-row gap-4 justify-between items-start animate-in fade-in slide-in-from-top-1 duration-300">
                        <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg bg-[var(--background)] border border-[var(--border)]`}>
                                    {icons[item.type]}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${statusColors[item.status]}`}>
                                            {item.status}
                                        </span>
                                        <span className="text-xs opacity-50 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(item.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="text-xs opacity-40 mt-0.5 font-mono">
                                        User: {item.userId || 'Anonymous'}
                                    </div>
                                </div>
                            </div>
                            <p className="text-sm pl-12 leading-relaxed opacity-90">{item.content}</p>
                        </div>

                        <div className="flex items-center gap-2 pl-12 md:pl-0">
                            {item.status === 'OPEN' && (
                                <button 
                                    onClick={() => handleStatus(item.id, 'RESOLVED')}
                                    className="p-2 rounded-lg hover:bg-green-50 text-green-600 border border-transparent hover:border-green-200 transition"
                                    title="Mark Resolved"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                </button>
                            )}
                            
                            <button 
                                onClick={() => handleStatus(item.id, 'ARCHIVED')}
                                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 border border-transparent hover:border-gray-200 transition"
                                title="Archive"
                            >
                                <Archive className="w-4 h-4" />
                            </button>

                            <button 
                                onClick={() => handleDelete(item.id)}
                                className="p-2 rounded-lg hover:bg-red-50 text-red-500 border border-transparent hover:border-red-200 transition"
                                title="Delete"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}