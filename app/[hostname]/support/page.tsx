import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import HostSupportCenter from '@/components/support/HostSupportCenter';
import { LifeBuoy } from 'lucide-react';

export default async function SupportPage({ params }: { params: { hostname: string } }) {
  const user = await getCurrentUser();
  if (!user || user.username !== params.hostname) redirect(`/${params.hostname}`);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-start justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <div className="bg-[var(--accent)] p-2 rounded-lg text-white">
                    <LifeBuoy className="w-6 h-6" />
                </div>
                Support Center
            </h1>
            <p className="opacity-60 mt-2 max-w-xl">
                Having issues? Create a ticket and the Super Admin will respond as soon as possible.
                Responses usually take less than 24 hours.
            </p>
        </div>
      </div>

      <HostSupportCenter currentUserId={user.userId} />
    </div>
  );
}