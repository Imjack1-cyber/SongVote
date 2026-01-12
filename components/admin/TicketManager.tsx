'use client';

import { useState, useEffect } from 'react';
import SupportTicketInterface from '@/components/support/SupportTicketInterface';
import { Circle } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { toast } from 'sonner';

export default function TicketManager({ initialTickets, currentUserId }: { initialTickets: any[], currentUserId: string }) {
    const [tickets, setTickets] = useState(initialTickets);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const selectedTicket = tickets.find(t => t.id === selectedId);
    
    const { socket } = useSocket('admin-tickets');

    useEffect(() => {
        if (!socket) return;

        const handleAdminNotification = (data: any) => {
            if (data.type === 'NEW_TICKET') {
                toast.info(`New Ticket: ${data.data.subject}`);
                const newTicket = {
                    id: data.data.id,
                    subject: data.data.subject,
                    host: { username: data.data.host },
                    status: 'OPEN',
                    priority: 'NORMAL',
                    updatedAt: new Date().toISOString(),
                    hasUnreadForAdmin: true,
                    messages: []
                };
                setTickets(prev => [newTicket, ...prev]);
            }
            else if (data.type === 'TICKET_REPLY') {
                setTickets(prev => prev.map(t => 
                    t.id === data.ticketId 
                    ? { ...t, status: 'OPEN', updatedAt: new Date().toISOString(), hasUnreadForAdmin: t.id !== selectedId } 
                    : t
                ).sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
                
                if (data.ticketId !== selectedId) toast.info(`New reply on ticket`);
            }
        };

        socket.on('admin-notification', handleAdminNotification);
        return () => { socket.off('admin-notification', handleAdminNotification); };
    }, [socket, selectedId]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[600px]">
            <div className="card overflow-y-auto border border-[var(--border)]">
                {tickets.map(ticket => (
                    <div 
                        key={ticket.id}
                        onClick={() => { setSelectedId(ticket.id); setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, hasUnreadForAdmin: false } : t)); }}
                        className={`p-4 border-b border-[var(--border)] cursor-pointer hover:bg-[var(--foreground)]/5 transition ${selectedId === ticket.id ? 'bg-[var(--accent)]/10' : ''}`}
                    >
                        <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-sm truncate pr-2 flex items-center gap-2">
                                {ticket.hasUnreadForAdmin && <span className="w-2 h-2 rounded-full bg-red-500" />}
                                {ticket.subject}
                            </span>
                            {ticket.status === 'OPEN' && <Circle className="w-2 h-2 fill-green-500 text-green-500 flex-shrink-0 mt-1" />}
                        </div>
                        <div className="text-xs opacity-60 flex justify-between">
                            <span>{ticket.host.username}</span>
                            <span>{new Date(ticket.updatedAt).toLocaleDateString()}</span>
                        </div>
                        <div className="mt-2 flex gap-1">
                            <span className="text-[10px] px-1.5 py-0.5 bg-[var(--foreground)]/10 rounded">{ticket.priority}</span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-[var(--foreground)]/10 rounded">{ticket.status}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="md:col-span-2 h-full">
                {selectedTicket ? (
                    <SupportTicketInterface key={selectedTicket.id} ticket={selectedTicket} isAdmin={true} currentUserId={currentUserId} />
                ) : (
                    <div className="h-full card flex items-center justify-center opacity-40">
                        Select a ticket to view details
                    </div>
                )}
            </div>
        </div>
    );
}