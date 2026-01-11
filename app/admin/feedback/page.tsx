import { getSystemFeedback } from '@/app/actions';
import FeedbackList from '@/components/admin/FeedbackList';
import { MessageSquare } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminFeedbackPage() {
    const feedback = await getSystemFeedback();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <MessageSquare className="w-6 h-6 text-indigo-500" /> User Feedback
                </h2>
                <Link href="/admin" className="text-sm font-medium hover:underline opacity-60">
                    &larr; Back to Dashboard
                </Link>
            </div>

            <FeedbackList items={feedback} />
        </div>
    );
}