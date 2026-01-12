'use client';

import { useState, useEffect } from 'react';
import { createSupportTicket, getTicketsForHost } from '@/app/actions';
import SupportTicketInterface from './SupportTicketInterface';
import { LifeBuoy, Plus, MessageSquare, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useSocket } from '@/hooks/useSocket';

export default function HostSupportCenter({ currentUserId }: { currentUserId: string }) {
    const [tickets, setTickets] = useState<any[]>([]);
    const [view, setView] = useState<'LIST' | 'CREATE' | 'DETAIL'>('LIST');
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    
    // Connect to global notifications namespace/room
    const { socket } = useSocket('host-support');

    const loadTickets = async () => {
        const data = await getTicketsForHost();
        setTickets(data);
    };

    useEffect(() => { loadTickets(); }, []);

    // Refresh list data when returning to list view to ensure read status is sync'd
    useEffect(() => {
        if (view === 'LIST') loadTickets();
    }, [view]);

    // --- SOCKET LISTENER FOR LIVE UPDATES ---
    useEffect(() => {
        if (!socket) return;

        const handleTicketUpdate = (data: any) => {
            console.log('[CLIENT] HostSupportCenter received update:', data);
            
            // Logic for 'TICKET_REPLY' or 'TICKET_STATUS'
            if (data.type === 'TICKET_REPLY' || data.type === 'TICKET_STATUS') {
                setTickets(prev => {
                    // Update the specific ticket in the list
                    const updatedList = prev.map(t => 
                        t.id === data.ticketId 
                        ? { 
                            ...t, 
                            updatedAt: new Date().toISOString(),
                            status: data.status || t.status,
                            hasUnreadForHost: true // Mark unread
                          } 
                        : t
                    );
                    // Sort by newest activity
                    return updatedList.sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
                });

                // If user is currently viewing THIS ticket, we don't need a toast, 
                // the interface handles the message. But if they are on the list:
                if (view === 'LIST') {
                    toast.info("Support responded to your ticket");
                }
            }
        };

        socket.on('ticket-notification', handleTicketUpdate);
        return () => { socket.off('ticket-notification', handleTicketUpdate); };
    }, [socket, view]);


    const handleCreate = async (formData: FormData) => {
        setLoading(true);
        try {
            await createSupportTicket(formData);
            toast.success("Ticket created");
            await loadTickets();
            setView('LIST');
        } catch (e) {
            toast.error("Failed to create ticket");
        } finally {
            setLoading(false);
        }
    };

    const selectedTicket = tickets.find(t => t.id === selectedTicketId);

    // Render Full Detail View
    if (view === 'DETAIL' && selectedTicket) {
        return (
            <div className="h-[600px] flex flex-col">
                <button 
                    onClick={() => setView('LIST')} 
                    className="flex items-center gap-2 text-sm font-medium mb-4 opacity-60 hover:opacity-100 transition w-fit"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Tickets
                </button>
                <div className="flex-1 border border-[var(--border)] rounded-xl overflow-hidden shadow-sm">
                    <SupportTicketInterface ticket={selectedTicket} isAdmin={false} currentUserId={currentUserId} />
                </div>
            </div>
        );
    }

    // Render List/Create View
    return (
        <div className="card min-h-[400px] flex flex-col">
            <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--surface)]">
                <h3 className="font-bold flex items-center gap-2">
                    <LifeBuoy className="w-5 h-5 text-[var(--accent)]" /> Your Tickets
                </h3>
            </div>

            <div className="p-4 flex-1">
                {view === 'LIST' && (
                    <div className="space-y-4">
                        <button 
                            onClick={() => setView('CREATE')}
                            className="w-full py-3 border border-dashed border-[var(--border)] rounded-xl flex items-center justify-center gap-2 hover:bg-[var(--foreground)]/5 transition opacity-60 hover:opacity-100"
                        >
                            <Plus className="w-4 h-4" /> Open New Ticket
                        </button>

                        <div className="space-y-2">
                            {tickets.map(ticket => (
                                <div 
                                    key={ticket.id}
                                    onClick={() => { setSelectedTicketId(ticket.id); setView('DETAIL'); }}
                                    className={`p-3 rounded-lg border cursor-pointer transition flex justify-between items-center group
                                        ${ticket.hasUnreadForHost 
                                            ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800' 
                                            : 'border-[var(--border)] hover:bg-[var(--foreground)]/5'
                                        }`}
                                >
                                    <div>
                                        <div className="font-bold text-sm flex items-center gap-2">
                                            {ticket.hasUnreadForHost && (
                                                <span className="relative flex h-2.5 w-2.5">
                                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                                </span>
                                            )}
                                            <span className={`transition-colors ${ticket.hasUnreadForHost ? 'text-blue-700 dark:text-blue-400' : 'group-hover:text-[var(--accent)]'}`}>
                                                {ticket.subject}
                                            </span>
                                        </div>
                                        <div className="text-xs opacity-50 flex items-center gap-2 mt-1">
                                            <span>{new Date(ticket.updatedAt).toLocaleDateString()}</span>
                                            <span>•</span>
                                            <span className={`font-bold ${ticket.status === 'OPEN' ? 'text-green-600' : 'text-gray-500'}`}>
                                                {ticket.status}
                                            </span>
                                        </div>
                                    </div>
                                    {ticket.status === 'IN_PROGRESS' && <MessageSquare className="w-4 h-4 text-[var(--accent)] opacity-50" />}
                                </div>
                            ))}
                            {tickets.length === 0 && <p className="text-center text-sm opacity-40 py-4">No tickets yet.</p>}
                        </div>
                    </div>
                )}

                {view === 'CREATE' && (
                    <form action={handleCreate} className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="font-bold text-sm">New Support Request</h4>
                            <button type="button" onClick={() => setView('LIST')} className="text-xs opacity-50 hover:opacity-100">Cancel</button>
                        </div>
                        <div>
                            <label className="text-xs font-bold opacity-70 uppercase tracking-wider mb-1 block">Subject</label>
                            <input name="subject" required className="w-full p-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm" placeholder="Brief summary..." />
                        </div>
                        <div>
                            <label className="text-xs font-bold opacity-70 uppercase tracking-wider mb-1 block">Priority</label>
                            <select name="priority" className="w-full p-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm">
                                <option value="LOW">Low - General Question</option>
                                <option value="NORMAL">Normal - Standard Issue</option>
                                <option value="HIGH">High - Urgent Bug</option>
                                <option value="CRITICAL">Critical - System Down</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold opacity-70 uppercase tracking-wider mb-1 block">Message</label>
                            <textarea name="content" required rows={5} className="w-full p-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm resize-none" placeholder="Describe your issue in detail..." />
                        </div>
                        <button type="submit" disabled={loading} className="btn-primary w-full">Submit Ticket</button>
                    </form>
                )}
            </div>
        </div>
    );
}