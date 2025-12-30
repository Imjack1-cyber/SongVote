// ========================================================================
// FILE: components/host/BlacklistManager.tsx
// ========================================================================

'use client';

import { useState, useEffect } from 'react';
import { Ban, Trash2, Plus } from 'lucide-react';
import { addToBlacklist, removeFromBlacklist, getBlacklist } from '@/app/actions';
import { toast } from 'sonner';

export default function BlacklistManager() {
    const [blacklist, setBlacklist] = useState<any[]>([]);
    const [newValue, setNewValue] = useState('');
    const [type, setType] = useState<'KEYWORD' | 'SONG_ID'>('KEYWORD');

    const load = async () => {
        const data = await getBlacklist();
        setBlacklist(data);
    };

    useEffect(() => { load(); }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newValue.trim()) return;
        await addToBlacklist(type, newValue);
        setNewValue('');
        toast.success("Added to blacklist");
        load();
    };

    const handleRemove = async (id: string) => {
        await removeFromBlacklist(id);
        toast.success("Removed from blacklist");
        load();
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
                <Ban className="w-5 h-5 text-red-500" /> Blocked Songs & Keywords
            </h2>

            <form onSubmit={handleAdd} className="flex gap-2">
                <select 
                    value={type} 
                    onChange={(e) => setType(e.target.value as any)}
                    className="p-2 rounded border bg-[var(--background)] text-sm"
                >
                    <option value="KEYWORD">Keyword</option>
                    <option value="SONG_ID">YouTube ID</option>
                </select>
                <input 
                    type="text" 
                    placeholder={type === 'KEYWORD' ? "e.g. 'Rick Astley'" : "e.g. dQw4w9WgXcQ"}
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="flex-1 p-2 rounded border bg-[var(--background)] text-sm"
                />
                <button type="submit" className="btn-primary flex items-center gap-2 px-4">
                    <Plus className="w-4 h-4" /> Add
                </button>
            </form>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
                {blacklist.length === 0 ? (
                    <div className="p-8 text-center opacity-50">No restrictions active.</div>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="bg-[var(--foreground)]/5 font-medium">
                            <tr>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Value</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {blacklist.map((item) => (
                                <tr key={item.id}>
                                    <td className="px-4 py-3">
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded ${item.type === 'KEYWORD' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                            {item.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-mono">{item.value}</td>
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => handleRemove(item.id)} className="text-red-500 hover:bg-red-50 p-2 rounded">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}