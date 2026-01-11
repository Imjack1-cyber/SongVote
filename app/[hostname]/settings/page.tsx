import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { updateGlobalSettings, saveYoutubeCredentials } from '@/app/actions';
import { CheckCircle, ExternalLink, Key } from 'lucide-react';
import LibraryManager from '@/components/host/LibraryManager';

export default async function GlobalSettingsPage({ params }: { params: { hostname: string } }) {
  const user = await getCurrentUser();
  if (!user || user.username !== params.hostname) redirect(`/${params.hostname}`);

  const host = await prisma.host.findUnique({ 
      where: { id: user.userId }, 
      include: { 
          settings: true,
          collections: { include: { _count: { select: { items: true } } } } 
      } 
  });
  const hasYoutubeKey = !!host?.youtubeApiKey;

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="opacity-60">Manage your music source and page appearance.</p>
      </div>

      {/* --- YOUTUBE INTEGRATION SECTION --- */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
            <h2 className="text-xl font-bold text-red-600 flex items-center gap-2">
                YouTube Integration
            </h2>
        </div>

        <div className={`card p-6 transition-all ${hasYoutubeKey ? 'border-green-500/30 bg-green-50/50 dark:bg-green-900/10' : 'border-l-4 border-l-red-500'}`}>
            <div className="flex justify-between items-start mb-4">
                <div id="youtube-help-text">
                    <h3 className="font-bold flex items-center gap-2">
                        API Key Configuration
                        {hasYoutubeKey && <CheckCircle className="w-4 h-4 text-green-600" />}
                    </h3>
                    <p className="text-sm opacity-60">Required to search YouTube videos.</p>
                </div>
            </div>

            {!hasYoutubeKey && (
                <div id="youtube-help-box" className="mb-6 bg-[var(--surface)] p-4 rounded-lg border border-[var(--border)] text-sm">
                    <p className="font-bold mb-2">How to get a Free Key:</p>
                    <ol className="list-decimal list-inside space-y-1 opacity-80">
                        <li>Go to <a href="https://console.cloud.google.com/" target="_blank" className="text-[var(--accent)] underline">Google Cloud Console</a>.</li>
                        <li>Create a new Project.</li>
                        <li>Enable the <strong>YouTube Data API v3</strong>.</li>
                        <li>Create Credentials --> <strong>API Key</strong>.</li>
                        <li>Paste it below.</li>
                    </ol>
                </div>
            )}

            <form action={saveYoutubeCredentials} className="space-y-4 max-w-lg">
                <div>
                    <label className="block text-sm font-semibold mb-1">YouTube Data API Key</label>
                    <div className="relative">
                        <input 
                            id="youtube-api-input"
                            name="youtubeApiKey" 
                            type="password" 
                            placeholder={hasYoutubeKey ? "•••••••••••••••••••••••• (Saved)" : "AIzaSy..."}
                            className="w-full p-2.5 pl-10 rounded border border-[var(--border)] bg-[var(--background)] font-mono text-sm"
                        />
                        <Key className="absolute left-3 top-2.5 w-4 h-4 opacity-40" />
                    </div>
                </div>
                <button id="save-youtube-btn" type="submit" className="btn-primary w-full">
                    {hasYoutubeKey ? 'Update Key' : 'Save Key'}
                </button>
            </form>
        </div>
      </section>

      {/* --- LIBRARY SECTION --- */}
      <section id="library-section" className="space-y-6">
        <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
            <h2 className="text-xl font-bold">Music Library</h2>
        </div>
        <div className="card p-6">
            {/* We pass IDs inside this component */}
            <LibraryManager collections={host?.collections || []} sessionId="" />
        </div>
      </section>

      {/* --- APPEARANCE SECTION --- */}
      <section id="appearance-section" className="space-y-6 opacity-60 hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
            <h2 className="text-xl font-bold">Appearance</h2>
        </div>
        <form action={updateGlobalSettings} className="grid md:grid-cols-2 gap-8">
            <div className="card p-6 space-y-4">
                <h3 className="font-bold text-sm uppercase tracking-wider opacity-70">Light Theme</h3>
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Background</label>
                    <input type="color" name="bgColor" defaultValue={host?.settings?.bgColor || '#f8fafc'} className="cursor-pointer" />
                </div>
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Text</label>
                    <input type="color" name="fgColor" defaultValue={host?.settings?.fgColor || '#0f172a'} className="cursor-pointer" />
                </div>
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Accent</label>
                    <input type="color" name="accentColor" defaultValue={host?.settings?.accentColor || '#6366f1'} className="cursor-pointer" />
                </div>
            </div>

            <div className="card p-6 space-y-4 bg-slate-900 text-white border-slate-700">
                <h3 className="font-bold text-sm uppercase tracking-wider opacity-70">Dark Theme</h3>
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Background</label>
                    <input type="color" name="darkBgColor" defaultValue={host?.settings?.darkBgColor || '#020617'} className="cursor-pointer bg-transparent" />
                </div>
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Text</label>
                    <input type="color" name="darkFgColor" defaultValue={host?.settings?.darkFgColor || '#f8fafc'} className="cursor-pointer bg-transparent" />
                </div>
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Accent</label>
                    <input type="color" name="darkAccentColor" defaultValue={host?.settings?.darkAccentColor || '#818cf8'} className="cursor-pointer bg-transparent" />
                </div>
            </div>

             <div className="md:col-span-2">
                 <button id="save-appearance-btn" type="submit" className="btn-primary w-full">Save Appearance Settings</button>
             </div>
        </form>
      </section>
    </div>
  );
}