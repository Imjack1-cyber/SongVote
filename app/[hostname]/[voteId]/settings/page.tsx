import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { updateSessionRules, generateGuests } from '@/app/actions';
import { Clock, Users, Video, AlertTriangle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import GuestList from '@/components/host/GuestList';
import SessionManager from '@/components/host/SessionManager';
import BlacklistManager from '@/components/host/BlacklistManager';
import HistoryView from '@/components/host/HistoryView';
import AnalyticsView from '@/components/host/AnalyticsView';

export default async function VoteSettingsPage({ params }: { params: { hostname: string; voteId: string } }) {
    const user = await getCurrentUser();
    
    // Auth Check
    if (!user || user.username !== params.hostname) {
        redirect(`/${params.hostname}`);
    }

    const session = await prisma.voteSession.findFirst({
        where: { id: params.voteId, hostId: user.userId },
        include: { 
            settings: true,
            host: { select: { youtubeApiKey: true } },
            guests: { orderBy: { createdAt: 'desc' } }
        }
    });

    if (!session) return notFound();

    const isYoutubeReady = !!session.host.youtubeApiKey;

    return (
        <div className="max-w-5xl mx-auto space-y-12 pb-32">
            
            {/* Header */}
            <div className="flex justify-between items-center print:hidden border-b border-[var(--border)] pb-6">
                <div>
                    <h1 className="text-3xl font-bold">{session.title}</h1>
                    <p className="opacity-60">Admin Dashboard</p>
                </div>
                <Link href={`/${params.hostname}/${params.voteId}`} className="btn-primary bg-slate-800 text-white hover:bg-slate-900">
                    Return to Player
                </Link>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                
                {/* LEFT COLUMN (Operational) */}
                <div className="lg:col-span-2 space-y-8">
                    
                    {/* Live Session Manager (With FIX: passed currentUserId) */}
                    <div className="card p-6 print:hidden">
                        <SessionManager sessionId={session.id} currentUserId={user.userId} />
                    </div>

                    {/* Rules Form */}
                    <div className="card p-6 print:hidden">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <Clock className="w-5 h-5" /> Session Rules
                        </h2>
                        <form action={updateSessionRules} className="grid md:grid-cols-2 gap-6">
                            <input type="hidden" name="sessionId" value={session.id} />
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 opacity-80">Votes Per User</label>
                                    <input name="votesPerUser" type="number" defaultValue={session.votesPerUser} className="w-full p-2 rounded bg-[var(--background)] border border-[var(--border)]" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 opacity-80">Cycle Delay (Minutes)</label>
                                    <input name="cycleDelay" type="number" defaultValue={session.cycleDelay} className="w-full p-2 rounded bg-[var(--background)] border border-[var(--border)]" />
                                </div>
                                <div className="flex items-center gap-3 pt-4">
                                    <input type="checkbox" name="requireVerification" defaultChecked={session.requireVerification} id="verify" className="w-5 h-5 rounded border-gray-300 text-[var(--accent)]" />
                                    <label htmlFor="verify" className="text-sm font-medium">Require Verification</label>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 opacity-80">Start Time</label>
                                    <input 
                                        name="startTime" 
                                        type="datetime-local" 
                                        defaultValue={session.startTime ? new Date(session.startTime).toISOString().slice(0, 16) : ''}
                                        className="w-full p-2 rounded bg-[var(--background)] border border-[var(--border)]" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 opacity-80">End Time</label>
                                    <input 
                                        name="endTime" 
                                        type="datetime-local" 
                                        defaultValue={session.endTime ? new Date(session.endTime).toISOString().slice(0, 16) : ''}
                                        className="w-full p-2 rounded bg-[var(--background)] border border-[var(--border)]" 
                                    />
                                </div>
                            </div>

                            <div className="md:col-span-2 pt-4">
                                <button type="submit" className="btn-primary w-full md:w-auto">Save Rules</button>
                            </div>
                        </form>
                    </div>

                    {/* Analytics */}
                    <div className="card p-6 print:hidden">
                        <AnalyticsView sessionId={session.id} />
                    </div>

                    {/* History */}
                    <div className="card p-6 print:hidden">
                        <HistoryView sessionId={session.id} />
                    </div>
                </div>

                {/* RIGHT COLUMN (Config & Access) */}
                <div className="space-y-8">
                    
                    {/* Status Checks */}
                    <div className={`p-4 rounded-xl border ${isYoutubeReady ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                        <div className="flex items-center gap-3 mb-2 font-bold">
                            {isYoutubeReady ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                            Music Source
                        </div>
                        <p className="text-xs opacity-80 mb-3">
                            {isYoutubeReady ? "YouTube API connected." : "YouTube API Key missing."}
                        </p>
                        {!isYoutubeReady && (
                            <Link href={`/${params.hostname}/settings`} className="text-xs underline font-bold">
                                Fix in Global Settings
                            </Link>
                        )}
                    </div>

                    {/* Blacklist */}
                    <div className="card p-6 print:hidden">
                        <BlacklistManager />
                    </div>

                    {/* Guest Management */}
                    <div className="card p-6">
                        <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                            <Users className="w-5 h-5" /> Guests
                        </h2>
                        
                        <form action={generateGuests} className="flex gap-2 mb-6">
                            <input type="hidden" name="sessionId" value={session.id} />
                            <input type="number" name="count" min="1" max="50" defaultValue="5" className="flex-1 p-2 rounded border border-[var(--border)] bg-[var(--background)] text-center text-sm" />
                            <button type="submit" className="btn-primary text-xs px-3">Add</button>
                        </form>

                        <GuestList guests={session.guests} sessionId={session.id} />
                    </div>

                </div>
            </div>
        </div>
    );
}