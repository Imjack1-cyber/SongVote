import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { updateSessionRules, generateGuests } from '@/app/actions';
import { Clock, Users, AlertTriangle, CheckCircle, Radio, Save, ToggleLeft, Sparkles, Youtube, Network, Ban } from 'lucide-react';
import Link from 'next/link';
import GuestList from '@/components/host/GuestList';
import SessionManager from '@/components/host/SessionManager';
import BlacklistManager from '@/components/host/BlacklistManager';
import HistoryView from '@/components/host/HistoryView';
import AnalyticsView from '@/components/host/AnalyticsView';
import LibraryManager from '@/components/host/LibraryManager';
import Leaderboard from '@/components/host/Leaderboard';

export default async function VoteSettingsPage({ params }: { params: { hostname: string; voteId: string } }) {
    const user = await getCurrentUser();
    if (!user || user.username !== params.hostname) redirect(`/${params.hostname}`);
    
    const session = await prisma.voteSession.findFirst({
        where: { id: params.voteId, hostId: user.userId },
        include: { settings: true, host: { select: { youtubeApiKey: true } }, guests: { orderBy: { createdAt: 'desc' } } }
    });
    if (!session) return notFound();

    const collections = await prisma.songCollection.findMany({
        where: { hostId: user.userId },
        include: { _count: { select: { items: true } } },
        orderBy: { createdAt: 'desc' }
    });
    const isYoutubeReady = !!session.host.youtubeApiKey;

    return (
        <div className="max-w-5xl mx-auto space-y-12 pb-32">
            
            <div className="flex justify-between items-center print:hidden border-b border-[var(--border)] pb-6">
                <div>
                    <h1 className="text-3xl font-bold">{session.title}</h1>
                    <p className="opacity-60">Admin Dashboard</p>
                </div>
                <Link id="back-to-player-btn" href={`/${params.hostname}/${params.voteId}`} className="btn-primary bg-slate-800 text-white hover:bg-slate-900">
                    Return to Player
                </Link>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                
                <div className="lg:col-span-2 space-y-8">
                    <div className="card p-6 print:hidden">
                        <SessionManager sessionId={session.id} currentUserId={user.userId} />
                    </div>

                    <div id="session-rules-form" className="card p-6 print:hidden">
                        <h2 id="session-rules" className="text-xl font-bold mb-6 flex items-center gap-2">
                            <Clock className="w-5 h-5" /> Session Rules
                        </h2>
                        <form action={updateSessionRules} className="grid gap-6">
                            <input type="hidden" name="sessionId" value={session.id} />
                            
                            {/* Toggles */}
                            <div className="grid md:grid-cols-2 gap-4 p-4 bg-[var(--foreground)]/5 rounded-xl border border-[var(--border)]">
                                <h3 className="md:col-span-2 font-bold text-sm uppercase tracking-wider opacity-60 flex items-center gap-2">
                                    <ToggleLeft className="w-4 h-4" /> Feature Toggles
                                </h3>
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">Hype Reactions</label>
                                    <input id="toggle-hype" type="checkbox" name="enableReactions" defaultChecked={session.enableReactions} className="w-5 h-5 accent-[var(--accent)]" />
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">Duplicate Detection</label>
                                    <input id="toggle-dupe" type="checkbox" name="enableDuplicateCheck" defaultChecked={session.enableDuplicateCheck} className="w-5 h-5 accent-[var(--accent)]" />
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">Region Lock Check</label>
                                    <input id="toggle-region" type="checkbox" name="enableRegionCheck" defaultChecked={session.enableRegionCheck} className="w-5 h-5 accent-[var(--accent)]" />
                                </div>
                            </div>

                            {/* Limits */}
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1 opacity-80">Votes Per User</label>
                                        <input id="input-votes-per-user" name="votesPerUser" type="number" defaultValue={session.votesPerUser} className="w-full p-2 rounded bg-[var(--background)] border border-[var(--border)]" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 opacity-80">Cycle Delay (Minutes)</label>
                                        <input id="input-cycle-delay" name="cycleDelay" type="number" defaultValue={session.cycleDelay} className="w-full p-2 rounded bg-[var(--background)] border border-[var(--border)]" />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1 opacity-80">Start Time</label>
                                        <input id="input-start-time" name="startTime" type="datetime-local" defaultValue={session.startTime ? new Date(session.startTime).toISOString().slice(0, 16) : ''} className="w-full p-2 rounded bg-[var(--background)] border border-[var(--border)]" />
                                    </div>
                                    <div className="flex items-center gap-3 pt-8">
                                        <input type="checkbox" name="requireVerification" defaultChecked={session.requireVerification} id="toggle-verify" className="w-5 h-5 rounded border-gray-300 text-[var(--accent)]" />
                                        <label htmlFor="toggle-verify" className="text-sm font-medium">Require Verification</label>
                                    </div>
                                </div>
                            </div>
                            
                            {/* RADIO & AUTO-SAVE */}
                            <div id="radio-config" className="pt-4 border-t border-[var(--border)] space-y-6">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div id="radio-config-container">
                                        <h3 className="font-bold text-sm mb-2 flex items-center gap-2 opacity-80">
                                            <Radio className="w-4 h-4" /> Radio Backup Source
                                        </h3>
                                        <select 
                                            name="backupCollectionId" 
                                            defaultValue={session.backupCollectionId || ''}
                                            className="w-full p-2 rounded bg-[var(--background)] border border-[var(--border)] mb-2"
                                        >
                                            <option value="">-- Internal Library (Preferred) --</option>
                                            {collections.map(c => (
                                                <option key={c.id} value={c.id}>{c.title} ({c._count.items} songs)</option>
                                            ))}
                                        </select>
                                        <input 
                                            id="radio-input"
                                            name="backupPlaylistId" 
                                            type="text" 
                                            placeholder="Or YouTube Playlist URL..." 
                                            defaultValue={session.backupPlaylistId || ''}
                                            className="w-full p-2 rounded bg-[var(--background)] border border-[var(--border)]" 
                                        />
                                    </div>

                                    <div>
                                        <h3 className="font-bold text-sm mb-2 flex items-center gap-2 opacity-80">
                                            <Save className="w-4 h-4" /> Smart Library (Auto-Save)
                                        </h3>
                                        <select 
                                            id="auto-save-select"
                                            name="autoAddToCollectionId" 
                                            defaultValue={session.autoAddToCollectionId || ''}
                                            className="w-full p-2 rounded bg-[var(--background)] border border-[var(--border)]"
                                        >
                                            <option value="">-- Disabled --</option>
                                            {collections.map(c => (
                                                <option key={c.id} value={c.id}>{c.title}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Discovery Mode Selection (Plan 3) */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                                        <h3 className="font-bold text-sm">Smart Discovery Mode</h3>
                                    </div>
                                    <div className="grid md:grid-cols-3 gap-3">
                                        
                                        {/* Option 1: None */}
                                        <label className="cursor-pointer relative">
                                            <input type="radio" name="discoveryMode" value="NONE" defaultChecked={session.discoveryMode === 'NONE'} className="peer sr-only" />
                                            <div className="p-4 rounded-xl border border-[var(--border)] peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent)]/5 hover:bg-[var(--foreground)]/5 transition h-full flex flex-col items-center text-center gap-2">
                                                <Ban className="w-5 h-5 opacity-50" />
                                                <span className="font-bold text-sm">Closed Loop</span>
                                                <p className="text-[10px] opacity-60 leading-tight">
                                                    Only play songs from your backup playlist or history. No external suggestions.
                                                </p>
                                            </div>
                                        </label>

                                        {/* Option 2: Association (Internal) */}
                                        <label className="cursor-pointer relative">
                                            <input type="radio" name="discoveryMode" value="ASSOCIATION" defaultChecked={session.discoveryMode === 'ASSOCIATION'} className="peer sr-only" />
                                            <div className="p-4 rounded-xl border border-[var(--border)] peer-checked:border-purple-500 peer-checked:bg-purple-500/5 hover:bg-[var(--foreground)]/5 transition h-full flex flex-col items-center text-center gap-2">
                                                <Network className="w-5 h-5 text-purple-500" />
                                                <span className="font-bold text-sm text-purple-600">Community Graph</span>
                                                <p className="text-[10px] opacity-60 leading-tight">
                                                    AI learns from song transitions to suggest tracks users naturally queue together.
                                                </p>
                                            </div>
                                        </label>

                                        {/* Option 3: YouTube (External) */}
                                        <label className="cursor-pointer relative">
                                            <input type="radio" name="discoveryMode" value="YOUTUBE" defaultChecked={session.discoveryMode === 'YOUTUBE'} className="peer sr-only" />
                                            <div className="p-4 rounded-xl border border-[var(--border)] peer-checked:border-red-500 peer-checked:bg-red-500/5 hover:bg-[var(--foreground)]/5 transition h-full flex flex-col items-center text-center gap-2">
                                                <Youtube className="w-5 h-5 text-red-500" />
                                                <span className="font-bold text-sm text-red-600">YouTube Brain</span>
                                                <p className="text-[10px] opacity-60 leading-tight">
                                                    Use Google's algorithm to find related tracks. 
                                                    <br/><strong className="text-red-500">Warning: High API Usage.</strong>
                                                </p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <button id="save-session-settings-btn" type="submit" className="btn-primary w-full md:w-auto">Save All Changes</button>
                        </form>
                    </div>

                    <div id="analytics-section" className="card p-6 print:hidden">
                        <AnalyticsView sessionId={session.id} />
                    </div>

                    <div id="history-section" className="card p-6 print:hidden">
                        <HistoryView sessionId={session.id} />
                    </div>
                </div>

                <div className="space-y-8">
                    <div id="api-status-card" className={`p-4 rounded-xl border ${isYoutubeReady ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
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
                    <div id="leaderboard-section" className="print:hidden">
                        <Leaderboard sessionId={session.id} />
                    </div>
                    <div className="card p-6 print:hidden">
                        <LibraryManager collections={collections} sessionId={session.id} />
                    </div>
                    <div id="blacklist-section" className="card p-6 print:hidden">
                        <BlacklistManager />
                    </div>
                    <div id="guest-management" className="card p-6">
                         <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                            <Users className="w-5 h-5" /> Guests
                        </h2>
                        <form action={generateGuests} className="flex gap-2 mb-6">
                            <input type="hidden" name="sessionId" value={session.id} />
                            <input id="guest-count-input" type="number" name="count" min="1" max="50" defaultValue="5" className="flex-1 p-2 rounded border border-[var(--border)] bg-[var(--background)] text-center text-sm" />
                            <button id="guest-add-btn" type="submit" className="btn-primary text-xs px-3">Add</button>
                        </form>
                        <GuestList guests={session.guests} sessionId={session.id} />
                    </div>
                </div>
            </div>
        </div>
    );
}