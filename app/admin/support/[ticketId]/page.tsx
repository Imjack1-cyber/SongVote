import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SupportTicketInterface from '@/components/support/SupportTicketInterface';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function AdminTicketDetailPage({ params }: { params: { ticketId: string } }) {
    const user = await getCurrentUser();
    
    // Strict Admin Check
    if (!user || user.userId !== process.env.SUPER_ADMIN_ID) {
        redirect('/');
    }

    const ticket = await prisma.supportTicket.findUnique({
        where: { id: params.ticketId },
        include: { 
            host: { select: { username: true, avatarUrl: true } },
            messages: { orderBy: { createdAt: 'asc' } }
        }
    });

    if (!ticket) redirect('/admin/support');

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col">
            <div className="mb-4 flex items-center gap-4">
                <Link 
                    href="/admin/support" 
                    className="p-2 rounded-lg hover:bg-[var(--foreground)]/5 transition"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-xl font-bold">Ticket #{ticket.id.slice(0, 8)}</h1>
                    <p className="text-xs opacity-60">Conversation with {ticket.host.username}</p>
                </div>
            </div>

            <div className="flex-1 overflow-hidden border border-[var(--border)] rounded-xl shadow-sm">
                <SupportTicketInterface 
                    ticket={ticket} 
                    isAdmin={true} 
                    currentUserId={user.userId} 
                />
            </div>
        </div>
    );
}