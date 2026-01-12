'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, User, Shield, Check } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { Spinner } from '@/components/ui/Loaders';

interface Message {
    id: string;
    content: string;
    isFromGuest: boolean;
    createdAt: Date;
    pending?: boolean; // New UI state
}

interface LiveHelpBubbleProps {
    sessionId: string;
    guestId: string;
}

export default function LiveHelpBubble({ sessionId, guestId }: LiveHelpBubbleProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [hasUnread, setHasUnread] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { socket } = useSocket(sessionId);

    useEffect(() => {
        if (!socket || !sessionId || !guestId) return;

        socket.emit('join-live-chat', { sessionId, guestId });

        socket.on('chat-history', (history: Message[]) => {
            setMessages(history);
        });

        socket.on('live-chat-message', (msg: Message) => {
            setMessages(prev => {
                const filtered = prev.filter(m => !m.pending); 
                return [...filtered, msg];
            });
            
            if (!msg.isFromGuest && !isOpen) {
                setHasUnread(true);
            }
            if (scrollRef.current) {
                setTimeout(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight), 100);
            }
        });

        return () => {
            socket.off('chat-history');
            socket.off('live-chat-message');
        };
    }, [socket, sessionId, guestId, isOpen]);

    const sendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !socket) return;
        
        setIsSending(true);
        const tempId = 'temp-' + Date.now();
        const content = input;
        
        // Optimistic UI
        const optimisticMsg: Message = {
            id: tempId,
            content: content,
            isFromGuest: true,
            createdAt: new Date(),
            pending: true
        };
        
        setMessages(prev => [...prev, optimisticMsg]);
        setInput('');
       
        socket.emit('send-live-chat-message', {
            sessionId,
            guestId,
            content,
            isHostReply: false
        }, () => {
           setIsSending(false); 
        });
        setTimeout(() => setIsSending(false), 500);
    };

    return (
        <>
            <button 
                onClick={() => { setIsOpen(true); setHasUnread(false); }}
                className={`fixed bottom-24 right-4 z-40 p-3 rounded-full shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2 ${hasUnread ? 'bg-red-500 text-white animate-bounce' : 'bg-[var(--accent)] text-[var(--accent-fg)]'}`}
            >
                <MessageCircle className="w-6 h-6" />
                {hasUnread && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full ring-2 ring-white" />}
            </button>

            {isOpen && (
                <div className="fixed bottom-36 right-4 w-80 h-96 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-4 fade-in">
                    <div className="p-3 bg-[var(--accent)] text-[var(--accent-fg)] flex justify-between items-center">
                        <span className="font-bold text-sm flex items-center gap-2">
                            <Shield className="w-4 h-4" /> Ask the Host
                        </span>
                        <button onClick={() => setIsOpen(false)}><X className="w-4 h-4" /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--background)]" ref={scrollRef}>
                        {messages.length === 0 && (
                            <div className="text-center opacity-50 text-xs mt-10">
                                Send a message to the host. <br/> They will see it instantly.
                            </div>
                        )}
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.isFromGuest ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-2 rounded-xl text-sm relative ${
                                    msg.isFromGuest 
                                        ? 'bg-[var(--accent)] text-[var(--accent-fg)] rounded-tr-none' 
                                        : 'bg-[var(--foreground)]/10 rounded-tl-none'
                                } ${msg.pending ? 'opacity-70' : ''}`}>
                                    {msg.content}
                                    {msg.pending && <Spinner className="w-3 h-3 absolute -bottom-4 right-0 text-[var(--foreground)] opacity-50" />}
                                </div>
                            </div>
                        ))}
                    </div>

                    <form onSubmit={sendMessage} className="p-2 border-t border-[var(--border)] flex gap-2 bg-[var(--surface)]">
                        <input 
                            className="flex-1 text-sm p-2 rounded-lg bg-[var(--background)] border border-[var(--border)]"
                            placeholder="Type a message..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                        />
                        <button 
                            type="submit" 
                            disabled={isSending}
                            className="p-2 rounded-lg bg-[var(--accent)] text-[var(--accent-fg)] disabled:opacity-50"
                        >
                            {isSending ? <Spinner className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                        </button>
                    </form>
                </div>
            )}
        </>
    );
}