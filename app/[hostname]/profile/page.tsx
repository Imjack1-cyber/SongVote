import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { resetTutorial } from '@/app/actions';
import { RotateCcw } from 'lucide-react';
import AvatarUploadForm from '@/components/host/AvatarUploadForm';

export default async function HostProfilePage() {
  const user = await getCurrentUser();
  if (!user) return redirect('/login');

  const host = await prisma.host.findUnique({ where: { id: user.userId } });

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
      
      <div className="grid gap-8">
        
        <div id="profile-info" className="card p-8">
            <h2 className="text-xl font-semibold mb-6 pb-4 border-b border-[var(--border)]">Account Information</h2>
            <div className="grid md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium mb-2 opacity-70">Username</label>
                    <input disabled type="text" value={host?.username} className="w-full p-2.5 rounded-lg border border-[var(--border)] bg-[var(--foreground)]/5 opacity-50" />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2 opacity-70">Email (Optional)</label>
                    <input type="email" disabled placeholder="Coming soon..." className="w-full p-2.5 rounded-lg border border-[var(--border)] bg-transparent opacity-50 cursor-not-allowed" />
                </div>
            </div>
        </div>

        <div id="profile-branding" className="card p-8">
            <h2 className="text-xl font-semibold mb-6 pb-4 border-b border-[var(--border)]">Channel Branding</h2>
            <AvatarUploadForm currentAvatarUrl={host?.avatarUrl || null} />
        </div>

        <div className="card p-8">
            <h2 className="text-xl font-semibold mb-6 pb-4 border-b border-[var(--border)]">Help & Support</h2>
            <div className="space-y-4">
                <p className="text-sm opacity-60">Missed the introduction? You can restart the guided tour here.</p>
                <form action={resetTutorial}>
                    <button type="submit" className="flex items-center gap-2 text-sm font-medium text-[var(--accent)] hover:underline p-2 -ml-2 rounded-lg hover:bg-[var(--accent)]/10 transition">
                        <RotateCcw className="w-4 h-4" /> Restart Onboarding Tutorial
                    </button>
                </form>
            </div>
        </div>

      </div>
    </div>
  );
}