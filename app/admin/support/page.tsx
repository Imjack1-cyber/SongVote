import { getAllTicketsAdmin } from '@/app/actions';
import TicketList from '@/components/admin/TicketList';
import Link from 'next/link';
import { ArrowLeft, Ticket } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminSupportPage() {
    const tickets = await getAllTicketsAdmin();
    const user = await getCurrentUser();

    if (!user) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Ticket className="w-6 h-6 text-indigo-500" /> Support Tickets
                    </h2>
                    <p className="text-sm opacity-60">Manage support requests from hosts.</p>
                </div>
                <Link href="/admin" className="text-sm font-medium hover:underline opacity-60 flex items-center gap-1">
                    <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </Link>
            </div>

            <TicketList initialTickets={tickets} />
        </div>
    );
}