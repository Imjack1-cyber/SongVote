'use client';

import { useState, useRef } from 'react';
import { Upload, Save, Link as LinkIcon, Image as ImageIcon, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { uploadHostAvatar } from '@/app/actions';

interface AvatarUploadFormProps {
    currentAvatarUrl: string | null;
}

export default function AvatarUploadForm({ currentAvatarUrl }: AvatarUploadFormProps) {
    const [preview, setPreview] = useState<string | null>(currentAvatarUrl);
    const [mode, setMode] = useState<'file' | 'url'>('file');
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error("File too large (Max 5MB)");
                return;
            }
            const objectUrl = URL.createObjectURL(file);
            setPreview(objectUrl);
        }
    };

    const handleSubmit = async (formData: FormData) => {
        setLoading(true);
        try {
            await uploadHostAvatar(formData);
            toast.success("Profile picture updated!");
        } catch (e: any) {
            toast.error(e.message || "Upload failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form action={handleSubmit} className="space-y-6">
            <div className="flex items-start gap-6">
                
                {/* Preview Circle */}
                <div className="relative group w-24 h-24 flex-shrink-0">
                    <div className="w-full h-full rounded-full bg-[var(--foreground)]/10 border-2 border-dashed border-[var(--foreground)]/30 overflow-hidden flex items-center justify-center">
                        {preview ? (
                            <Image 
                                src={preview} 
                                alt="Avatar Preview" 
                                fill 
                                className="object-cover" 
                                unoptimized // Needed for local uploads/blob urls
                            />
                        ) : (
                            <ImageIcon className="w-8 h-8 opacity-30" />
                        )}
                    </div>
                    {/* Overlay to trigger file input */}
                    <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
                    >
                        <Upload className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 space-y-4">
                    <div className="flex gap-4 text-sm border-b border-[var(--border)] pb-2">
                        <button 
                            type="button" 
                            onClick={() => setMode('file')}
                            className={`pb-2 -mb-2.5 font-medium transition ${mode === 'file' ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]' : 'opacity-50 hover:opacity-100'}`}
                        >
                            Upload File
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setMode('url')}
                            className={`pb-2 -mb-2.5 font-medium transition ${mode === 'url' ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]' : 'opacity-50 hover:opacity-100'}`}
                        >
                            Use URL
                        </button>
                    </div>

                    {mode === 'file' ? (
                        <div className="space-y-2">
                            <input 
                                ref={fileInputRef}
                                name="avatarFile" 
                                type="file" 
                                accept="image/*"
                                onChange={handleFileChange}
                                className="block w-full text-sm text-slate-500
                                  file:mr-4 file:py-2 file:px-4
                                  file:rounded-full file:border-0
                                  file:text-xs file:font-semibold
                                  file:bg-[var(--accent)] file:text-[var(--accent-fg)]
                                  hover:file:brightness-110 cursor-pointer"
                            />
                            <p className="text-[10px] opacity-50">Max 5MB. JPG, PNG, GIF, WEBP.</p>
                        </div>
                    ) : (
                        <div className="relative">
                            <input 
                                name="avatarUrl" 
                                type="url" 
                                placeholder="https://example.com/image.png"
                                defaultValue={typeof currentAvatarUrl === 'string' && currentAvatarUrl.startsWith('http') ? currentAvatarUrl : ''}
                                onChange={(e) => setPreview(e.target.value)}
                                className="w-full p-2.5 pl-9 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none"
                            />
                            <LinkIcon className="absolute left-3 top-2.5 w-4 h-4 opacity-40" />
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="btn-primary w-full md:w-auto flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                    </button>
                </div>
            </div>
        </form>
    );
}