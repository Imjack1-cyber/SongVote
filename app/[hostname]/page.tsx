import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus, BarChart, Users, Play, Trash2, Calendar, LifeBuoy, ArrowRight } from 'lucide-react';
import { createSession, deleteSession } from '@/app/actions';

export default async function HostOverviewPage({ params }: { params: { hostname: string } }) {
  const user = await getCurrentUser();
  const isOwner = user?.username === params.hostname;

  const host = await prisma.host.findUnique({
    where: { username: params.hostname },
    include: {
        votes: {
            orderBy: { createdAt: 'desc' },
            include: { queue: true }
        }
    }
  });

  if (!host) redirect('/');
  if (!isOwner) redirect('/login');

  const sessions = host.votes;
  const totalVotes = sessions.reduce((acc, s) => acc + s.queue.reduce((qAcc, q) => qAcc + q.voteCount, 0), 0);
  const activeSession = sessions.find(s => s.isActive);

  return (
    <div className="space-y-8 pb-20">
      
      {/* Welcome Section */}
      <div id="dashboard-header" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="opacity-60 mt-1">Manage your sessions and view analytics.</p>
        </div>
        
        <form action={createSession} className="flex gap-2">
            <input 
                id="create-session-input"
                name="title" 
                type="text" 
                placeholder="Session Name (e.g. Party)" 
                required
                className="px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
            />
            <button id="create-session-btn" type="submit" className="btn-primary whitespace-nowrap">
                <Plus className="w-5 h-5 mr-2" />
                New Session
            </button>
        </form>
      </div>

      {/* Stats Grid */}
      <div id="dashboard-stats" className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6 flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium opacity-60">Total Sessions</span>
            <BarChart className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <span className="text-3xl font-bold">{sessions.length}</span>
        </div>
        
        <div className="card p-6 flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium opacity-60">Total Votes Cast</span>
            <Users className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <span className="text-3xl font-bold">{totalVotes}</span>
        </div>

        <div className={`card p-6 flex flex-col justify-between h-32 ${activeSession ? 'border-[var(--accent)] bg-[var(--accent)]/5' : ''}`}>
          <div className="flex justify-between items-start">
            <span className={`text-sm font-medium ${activeSession ? 'text-[var(--accent)]' : 'opacity-60'}`}>
                Active Status
            </span>
            {activeSession && <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
          </div>
          <span className="text-xl font-bold truncate">
            {activeSession ? activeSession.title : 'No Active Session'}
          </span>
        </div>

        {/* Support Card */}
        <Link 
            href={`/${params.hostname}/support`}
            className="card p-6 flex flex-col justify-between h-32 group hover:border-[var(--accent)] transition-all cursor-pointer bg-[var(--surface)] relative overflow-hidden"
        >
            <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <LifeBuoy className="w-20 h-20 -mr-4 -mt-4 transform rotate-12" />
            </div>
            <div className="flex justify-between items-start relative z-10">
                <span className="text-sm font-medium opacity-60 group-hover:opacity-100 transition-opacity">Need Help?</span>
                <LifeBuoy className="w-5 h-5 text-indigo-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-indigo-600 relative z-10">
                Contact Support <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
        </Link>
      </div>

      {/* Sessions List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Your Sessions</h2>
        {sessions.length === 0 ? (
            <div className="text-center py-12 opacity-50 border-2 border-dashed border-[var(--border)] rounded-xl">
                No sessions created yet. Create one above!
            </div>
        ) : (
            <div className="card divide-y divide-[var(--border)]">
            {sessions.map((session) => (
                <div key={session.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[var(--foreground)]/5 transition">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${session.isActive ? 'bg-[var(--accent)] text-white' : 'bg-[var(--foreground)]/10'}`}>
                            {session.isActive ? <Play className="w-5 h-5" /> : <Calendar className="w-5 h-5 opacity-50" />}
                        </div>
                        <div>
                            <h4 className="font-semibold text-lg">{session.title}</h4>
                            <div className="flex items-center gap-3 text-sm opacity-50">
                                <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                                <span>•</span>
                                <span>{session.queue.length} songs queued</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4 self-end md:self-auto">
                        <Link href={`/${params.hostname}/${session.id}`} className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 transition">
                            Enter Session
                        </Link>
                        <Link href={`/${params.hostname}/${session.id}/settings`} className="px-4 py-2 text-sm font-semibold rounded-lg border border-[var(--border)] hover:bg-[var(--foreground)]/5 transition">
                            Settings
                        </Link>
                        <form action={deleteSession}>
                            <input type="hidden" name="sessionId" value={session.id} />
                            <button 
                                type="submit" 
                                className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition"
                                title="Delete Session"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </form>
                    </div>
                </div>
            ))}
            </div>
        )}
      </div>
    </div>
  );
}