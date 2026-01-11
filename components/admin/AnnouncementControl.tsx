'use client';

import { useState } from 'react';
import { sendGlobalAnnouncement, clearGlobalAnnouncement } from '@/app/actions';
import { Megaphone, Trash2, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function AnnouncementControl() {
    const [message, setMessage] = useState('');
    const [type, setType] = useState<'info' | 'warning' | 'error'>('info');
    const [loading, setLoading] = useState(false);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await sendGlobalAnnouncement(message, type);
            toast.success('Announcement broadcasted!');
            setMessage('');
        } catch (e) {
            toast.error('Failed to send');
        } finally {
            setLoading(false);
        }
    };

    const handleClear = async () => {
        if (!confirm('Clear active announcement?')) return;
        await clearGlobalAnnouncement();
        toast.info('Announcement cleared');
    };

    return (
        <div className="card p-6 border-l-4 border-l-indigo-500">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-indigo-500" /> Global Announcement
            </h2>
            <p className="text-sm opacity-60 mb-4">Send a message to all connected clients instantly.</p>
            
            <form onSubmit={handleSend} className="space-y-4">
                <div className="flex gap-4">
                    <input 
                        type="text" 
                        placeholder="Message..." 
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="flex-1 p-2 rounded border border-[var(--border)] bg-[var(--background)]"
                        required
                    />
                    <select 
                        value={type} 
                        onChange={(e) => setType(e.target.value as any)}
                        className="p-2 rounded border border-[var(--border)] bg-[var(--background)]"
                    >
                        <option value="info">Info (Blue)</option>
                        <option value="warning">Warning (Orange)</option>
                        <option value="error">Critical (Red)</option>
                    </select>
                </div>
                
                <div className="flex justify-between">
                    <button 
                        type="button" 
                        onClick={handleClear} 
                        className="text-red-500 text-sm hover:underline flex items-center gap-1"
                    >
                        <Trash2 className="w-4 h-4" /> Clear Current
                    </button>
                    
                    <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
                        <Send className="w-4 h-4" /> Broadcast
                    </button>
                </div>
            </form>
        </div>
    );
}