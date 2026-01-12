'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Circle, Clock, MessageSquare } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { toast } from 'sonner';

export default function TicketList({ initialTickets }: { initialTickets: any[] }) {
    const [tickets, setTickets] = useState(initialTickets);
    const { socket } = useSocket('admin-tickets');

    useEffect(() => {
        if (!socket) return;

        const handleAdminNotification = (data: any) => {
            console.log('[CLIENT] TicketList received:', data);

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
                setTickets(prev => {
                    // 1. Find and update the specific ticket
                    const updatedList = prev.map(t => 
                        t.id === data.ticketId 
                        ? { 
                            ...t, 
                            status: 'OPEN', 
                            updatedAt: new Date().toISOString(), 
                            hasUnreadForAdmin: true // FORCE UNREAD STATE
                          } 
                        : t
                    );
                    
                    // 2. Sort to move updated ticket to top
                    return updatedList.sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
                });
                
                toast.info(`New reply received`);
            }
        };

        socket.on('admin-notification', handleAdminNotification);
        return () => { socket.off('admin-notification', handleAdminNotification); };
    }, [socket]);

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tickets.length === 0 && (
                <div className="col-span-full text-center py-20 opacity-40 bg-[var(--surface)] rounded-xl border border-[var(--border)] border-dashed">
                    No tickets found.
                </div>
            )}

            {tickets.map(ticket => (
                <Link 
                    key={ticket.id}
                    href={`/admin/support/${ticket.id}`}
                    className={`block p-5 rounded-xl border transition-all hover:shadow-md group relative
                        ${ticket.hasUnreadForAdmin 
                            ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800 shadow-sm' 
                            : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--accent)]'
                        }`}
                >
                    {/* Unread Badge */}
                    {ticket.hasUnreadForAdmin && (
                        <div className="absolute -top-1.5 -right-1.5">
                            <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white dark:border-slate-900"></span>
                            </span>
                        </div>
                    )}

                    <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                                ${ticket.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' : 
                                  ticket.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' : 
                                  'bg-[var(--foreground)]/10 text-[var(--foreground)]/70'}`}>
                                {ticket.priority}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                                ${ticket.status === 'OPEN' ? 'bg-green-100 text-green-700' : 
                                  ticket.status === 'CLOSED' ? 'bg-gray-100 text-gray-500' :
                                  'bg-blue-100 text-blue-700'}`}>
                                {ticket.status}
                            </span>
                        </div>
                        <h3 className={`font-bold text-lg leading-tight line-clamp-1 transition-colors ${ticket.hasUnreadForAdmin ? 'text-blue-700 dark:text-blue-400' : 'group-hover:text-[var(--accent)]'}`}>
                            {ticket.subject}
                        </h3>
                    </div>

                    <div className="flex items-center justify-between text-xs opacity-60 mt-4 pt-4 border-t border-[var(--border)] group-hover:border-[var(--accent)]/20 transition-colors">
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-[var(--foreground)]/10 flex items-center justify-center font-bold text-[9px]">
                                {ticket.host.username.slice(0,2).toUpperCase()}
                            </div>
                            <span>{ticket.host.username}</span>
                        </div>
                        <div className="flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            {new Date(ticket.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    );
}