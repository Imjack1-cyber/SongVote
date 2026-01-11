'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, X, Send, Bug, Lightbulb, HelpCircle } from 'lucide-react';
import { submitFeedback } from '@/app/actions';
import { toast } from 'sonner';

export default function FeedbackTrigger() {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        
        const formData = new FormData(e.currentTarget);
        
        try {
            await submitFeedback(formData);
            toast.success("Feedback received! Thank you.");
            setIsOpen(false);
        } catch (err) {
            toast.error("Failed to send feedback.");
        } finally {
            setLoading(false);
        }
    };

    // The modal content
    const modalContent = isOpen ? (
        // BACKDROP: High z-index to sit over header, dark semi-transparent black
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            
            {/* MODAL CONTAINER: Uses CSS Variables for perfect theme matching */}
            <div className="bg-[var(--surface)] text-[var(--foreground)] w-full max-w-md rounded-2xl shadow-2xl p-6 relative border border-[var(--border)] ring-1 ring-black/5 scale-100 animate-in zoom-in-95 duration-200">
                <button 
                    onClick={() => setIsOpen(false)}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-[var(--foreground)]/10 transition opacity-60 hover:opacity-100"
                >
                    <X className="w-5 h-5" />
                </button>

                <h3 className="text-xl font-bold mb-1">Send Feedback</h3>
                <p className="text-sm opacity-60 mb-6">Found a bug or have an idea? Let us know!</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold mb-2 opacity-80">Category</label>
                        <div className="grid grid-cols-3 gap-2">
                            {/* BUG */}
                            <label className="cursor-pointer group">
                                <input type="radio" name="type" value="BUG" className="peer sr-only" required />
                                <div className="p-3 rounded-lg border border-[var(--border)] text-center hover:bg-[var(--foreground)]/5 transition flex flex-col items-center gap-1 opacity-70 peer-checked:opacity-100 peer-checked:border-red-500 peer-checked:bg-red-500/10 peer-checked:text-red-500">
                                    <Bug className="w-5 h-5" />
                                    <span className="text-xs font-bold">Bug</span>
                                </div>
                            </label>

                            {/* IDEA */}
                            <label className="cursor-pointer group">
                                <input type="radio" name="type" value="SUGGESTION" className="peer sr-only" />
                                <div className="p-3 rounded-lg border border-[var(--border)] text-center hover:bg-[var(--foreground)]/5 transition flex flex-col items-center gap-1 opacity-70 peer-checked:opacity-100 peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent)]/10 peer-checked:text-[var(--accent)]">
                                    <Lightbulb className="w-5 h-5" />
                                    <span className="text-xs font-bold">Idea</span>
                                </div>
                            </label>

                            {/* OTHER */}
                            <label className="cursor-pointer group">
                                <input type="radio" name="type" value="OTHER" className="peer sr-only" />
                                <div className="p-3 rounded-lg border border-[var(--border)] text-center hover:bg-[var(--foreground)]/5 transition flex flex-col items-center gap-1 opacity-70 peer-checked:opacity-100 peer-checked:border-[var(--foreground)] peer-checked:bg-[var(--foreground)]/10 peer-checked:text-[var(--foreground)]">
                                    <HelpCircle className="w-5 h-5" />
                                    <span className="text-xs font-bold">Other</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2 opacity-80">Message</label>
                        <textarea 
                            name="content" 
                            required 
                            rows={4} 
                            placeholder="Describe your issue or idea..." 
                            className="w-full p-3 rounded-lg bg-[var(--background)] text-[var(--foreground)] border border-[var(--border)] focus:ring-2 focus:ring-[var(--accent)] outline-none resize-none text-sm placeholder:opacity-40"
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full btn-primary flex items-center justify-center gap-2"
                    >
                        {loading ? 'Sending...' : <><Send className="w-4 h-4" /> Submit Feedback</>}
                    </button>
                </form>
            </div>
        </div>
    ) : null;

    // Use Portal to render at document.body level, escaping Footer stacking context
    return (
        <>
            <button 
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-1 text-sm font-medium hover:text-[var(--accent)] transition-colors opacity-90 hover:opacity-100"
            >
                <MessageSquare className="w-4 h-4" /> Feedback
            </button>
            
            {mounted && createPortal(modalContent, document.body)}
        </>
    );
}