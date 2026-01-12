'use client';

import { useState } from 'react';
import { Library, Plus, Upload, Loader2, Music } from 'lucide-react';
import { createCollection, bulkImportSongs } from '@/app/actions';
import { toast } from 'sonner';
import { clientLogger } from '@/lib/clientLogger';

interface Collection {
    id: string;
    title: string;
    _count: { items: number };
}

interface LibraryManagerProps {
    collections: Collection[];
    sessionId: string;
}

export default function LibraryManager({ collections, sessionId }: LibraryManagerProps) {
    const [mode, setMode] = useState<'create' | 'import'>('create');
    const [importing, setImporting] = useState(false);

    const handleImport = async (formData: FormData) => {
        setImporting(true);
        const rawText = formData.get('rawText') as string;
        const lineCount = rawText ? rawText.split('\n').length : 0;
        
        clientLogger.info('Host Bulk Import Initiated', { lineCount, sessionId });

        try {
            await bulkImportSongs(formData);
            toast.success("Import processing complete");
            clientLogger.info('Host Bulk Import Success', { sessionId });
            setMode('create');
        } catch (e) {
            toast.error("Import failed");
            clientLogger.error('Host Bulk Import Failed', { error: e, sessionId });
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Library className="w-5 h-5" /> My Collections
                </h2>
                <div className="flex bg-[var(--foreground)]/5 rounded-lg p-1">
                    <button 
                        onClick={() => setMode('create')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition ${mode === 'create' ? 'bg-[var(--surface)] shadow-sm text-[var(--accent)]' : 'opacity-60'}`}
                    >
                        Create
                    </button>
                    <button 
                        id="import-btn-toggle"
                        onClick={() => setMode('import')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition ${mode === 'import' ? 'bg-[var(--surface)] shadow-sm text-[var(--accent)]' : 'opacity-60'}`}
                    >
                        Import
                    </button>
                </div>
            </div>

            {mode === 'create' ? (
                <form action={createCollection} className="flex gap-2">
                    <input type="hidden" name="sessionId" value={sessionId} />
                    <input 
                        id="playlist-create-input"
                        name="title" 
                        type="text" 
                        placeholder="New Collection Name..." 
                        required
                        className="flex-1 p-2 rounded border border-[var(--border)] bg-[var(--background)] text-sm"
                    />
                    <button id="playlist-create-btn" type="submit" className="btn-primary text-xs px-3 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Create
                    </button>
                </form>
            ) : (
                <form id="import-section" action={handleImport} className="space-y-3 bg-[var(--foreground)]/5 p-4 rounded-xl border border-[var(--border)]">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                        <Upload className="w-4 h-4" /> Bulk Import from Text / Spotify
                    </h3>
                    <p className="text-xs opacity-60">
                        Select songs in Spotify (Ctrl+A), Copy, and Paste here. Or paste a list of "Artist - Title".
                    </p>
                    
                    <select name="collectionId" required className="w-full p-2 rounded text-sm bg-[var(--background)] border border-[var(--border)]">
                        <option value="">-- Select Target Collection --</option>
                        {collections.map(c => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                    </select>

                    <textarea 
                        name="rawText" 
                        placeholder={`Michael Jackson - Thriller\nQueen - Bohemian Rhapsody\n...`}
                        className="w-full h-24 p-2 rounded text-xs bg-[var(--background)] border border-[var(--border)] font-mono"
                        required
                    />

                    <button type="submit" disabled={importing} className="btn-primary w-full text-xs">
                        {importing ? <><Loader2 className="w-3 h-3 animate-spin mr-2"/> Searching YouTube...</> : 'Start Import'}
                    </button>
                </form>
            )}

            <div className="space-y-2 mt-4 max-h-48 overflow-y-auto">
                {collections.length === 0 && <div className="text-xs opacity-50 text-center py-2">No collections yet.</div>}
                {collections.map(c => (
                    <div key={c.id} className="p-2 border border-[var(--border)] rounded flex justify-between items-center text-sm bg-[var(--background)]">
                        <span className="font-medium truncate flex items-center gap-2">
                            <Music className="w-3 h-3 opacity-50" /> {c.title}
                        </span>
                        <span className="text-xs bg-[var(--foreground)]/5 px-2 py-0.5 rounded opacity-70">
                            {c._count.items} songs
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}