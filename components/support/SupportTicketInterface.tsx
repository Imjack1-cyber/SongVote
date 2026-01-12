'use client';

import { useState, useEffect, useRef } from 'react';
import { replyToTicket, updateTicketStatus, markTicketRead } from '@/app/actions';
import { Send, CheckCircle, XCircle, Lock } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';

interface TicketInterfaceProps {
    ticket: any;
    isAdmin: boolean;
    currentUserId: string;
}

export default function SupportTicketInterface({ ticket, isAdmin, currentUserId }: TicketInterfaceProps) {
    const [messages, setMessages] = useState<any[]>(ticket.messages);
    const [status, setStatus] = useState(ticket.status);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { socket } = useSocket('ticket-view');

    // Mark read on mount
    useEffect(() => {
        markTicketRead(ticket.id);
    }, [ticket.id]);

    useEffect(() => {
        if (!socket) return;

        socket.emit('join-ticket-room', ticket.id);

        const handleUpdate = (data: any) => {
            if (data.ticketId !== ticket.id) return;

            if (data.type === 'TICKET_REPLY') {
                // Deduplicate: If I sent it, ignore the socket event
                if (data.message.senderId === currentUserId) return;

                setMessages(prev => [...prev, data.message]);
                markTicketRead(ticket.id);
            } else if (data.type === 'TICKET_STATUS') {
                setStatus(data.status);
            }
            
            setTimeout(() => {
                if (scrollRef.current) scrollRef.current.scrollTo(0, scrollRef.current.scrollHeight);
            }, 100);
        };

        socket.on('ticket-update', handleUpdate);
        return () => { socket.off('ticket-update', handleUpdate); };
    }, [socket, ticket.id, currentUserId]);

    const handleReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        setLoading(true);
        try {
            await replyToTicket(ticket.id, input);
            
            const optimisticMsg = {
                id: Date.now().toString(),
                content: input,
                isAdmin: isAdmin,
                createdAt: new Date().toISOString(),
                senderId: currentUserId
            };
            setMessages(prev => [...prev, optimisticMsg]);
            setInput('');
            setTimeout(() => {
                if (scrollRef.current) scrollRef.current.scrollTo(0, scrollRef.current.scrollHeight);
            }, 100);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleStatus = async (newStatus: 'RESOLVED' | 'CLOSED') => {
        if (!confirm(`Mark ticket as ${newStatus}?`)) return;
        await updateTicketStatus(ticket.id, newStatus);
        setStatus(newStatus);
    };

    return (
        <div className="h-full flex flex-col bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden">
            <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--foreground)]/5">
                <div>
                    <h3 className="font-bold">{ticket.subject}</h3>
                    <div className="text-xs opacity-60 flex gap-2">
                        <span>Host: {ticket.host?.username || 'You'}</span>
                        <span>•</span>
                        <span className={`font-bold ${ticket.priority === 'CRITICAL' ? 'text-red-500' : 'text-[var(--accent)]'}`}>{ticket.priority}</span>
                        <span>•</span>
                        <span className="uppercase">{status}</span>
                    </div>
                </div>
                {isAdmin && status !== 'CLOSED' && (
                    <div className="flex gap-2">
                        <button onClick={() => handleStatus('RESOLVED')} className="p-1.5 hover:bg-green-100 text-green-600 rounded" title="Resolve"><CheckCircle className="w-5 h-5" /></button>
                        <button onClick={() => handleStatus('CLOSED')} className="p-1.5 hover:bg-gray-100 text-gray-600 rounded" title="Close"><XCircle className="w-5 h-5" /></button>
                    </div>
                )}
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[var(--background)]" ref={scrollRef}>
                {messages.map((msg: any) => (
                    <div key={msg.id} className={`flex ${msg.isAdmin === isAdmin ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-xl text-sm ${
                            msg.isAdmin === isAdmin 
                                ? 'bg-[var(--accent)] text-[var(--accent-fg)]' 
                                : 'bg-[var(--foreground)]/10'
                        }`}>
                            <div className="text-[10px] opacity-70 mb-1">{msg.isAdmin ? 'Support Agent' : 'Host'}</div>
                            {msg.content}
                        </div>
                    </div>
                ))}
            </div>

            {status === 'CLOSED' ? (
                <div className="p-4 text-center text-sm opacity-50 bg-[var(--foreground)]/5 flex items-center justify-center gap-2">
                    <Lock className="w-4 h-4" /> This ticket is closed.
                </div>
            ) : (
                <form onSubmit={handleReply} className="p-4 border-t border-[var(--border)] flex gap-2">
                    <input 
                        className="flex-1 p-2 rounded border border-[var(--border)] bg-[var(--background)]"
                        placeholder="Type a reply..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                    />
                    <button disabled={loading} type="submit" className="btn-primary p-2">
                        <Send className="w-4 h-4" />
                    </button>
                </form>
            )}
        </div>
    );
}