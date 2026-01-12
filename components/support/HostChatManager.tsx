'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, X, User, Circle } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { toast } from 'sonner';

interface ChatSession {
    id: string;
    guestId: string;
    guest: { username: string };
    messages: any[];
    hasUnread: boolean;
}

export default function HostChatManager({ sessionId }: { sessionId: string }) {
    const { socket } = useSocket(sessionId);
    const [isOpen, setIsOpen] = useState(false);
    const [chats, setChats] = useState<Record<string, ChatSession>>({});
    const [activeGuestId, setActiveGuestId] = useState<string | null>(null);
    const [input, setInput] = useState('');

    useEffect(() => {
        if (!socket) return;

        socket.on('live-chat-digest', (sessions: any[]) => {
            const mapped = sessions.reduce((acc, s) => {
                acc[s.guestId] = { ...s, hasUnread: true };
                return acc;
            }, {} as Record<string, ChatSession>);
            setChats(prev => ({ ...prev, ...mapped }));
        });

        socket.on('host-chat-alert', (data: any) => {
            setChats(prev => ({
                ...prev,
                [data.guestId]: {
                    id: data.guestId, // temporary ID
                    guestId: data.guestId,
                    guest: { username: data.guestName },
                    messages: prev[data.guestId]?.messages ? [...prev[data.guestId].messages, data.lastMessage] : [data.lastMessage],
                    hasUnread: activeGuestId !== data.guestId
                }
            }));
            if (!isOpen) toast(`New message from ${data.guestName}`);
        });

        return () => {
            socket.off('live-chat-digest');
            socket.off('host-chat-alert');
        };
    }, [socket, sessionId, isOpen, activeGuestId]);

    const sendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !activeGuestId) return;

        const msg = {
            content: input,
            isFromGuest: false,
            createdAt: new Date(),
            id: Date.now().toString()
        };

        // Optimistic update
        setChats(prev => ({
            ...prev,
            [activeGuestId]: {
                ...prev[activeGuestId],
                messages: [...(prev[activeGuestId]?.messages || []), msg]
            }
        }));

        socket?.emit('send-live-chat-message', {
            sessionId,
            guestId: activeGuestId,
            content: input,
            isHostReply: true
        });
        setInput('');
    };

    const hasAnyUnread = Object.values(chats).some(c => c.hasUnread);

    return (
        <>
            <button 
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-20 z-40 p-3 rounded-full bg-[var(--surface)] border border-[var(--border)] shadow-lg hover:bg-[var(--foreground)]/5 transition text-[var(--foreground)]"
                title="Guest Chats"
            >
                <div className="relative">
                    <MessageSquare className="w-5 h-5" />
                    {hasAnyUnread && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white" />}
                </div>
            </button>

            {isOpen && (
                <div className="fixed bottom-20 right-4 w-96 h-[500px] bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden animate-in slide-in-from-right-4">
                    <div className="p-3 border-b border-[var(--border)] flex justify-between items-center bg-[var(--foreground)]/5">
                        <h3 className="font-bold text-sm">Guest Support</h3>
                        <button onClick={() => setIsOpen(false)}><X className="w-4 h-4" /></button>
                    </div>

                    <div className="flex-1 flex overflow-hidden">
                        {/* Sidebar */}
                        <div className="w-1/3 border-r border-[var(--border)] overflow-y-auto bg-[var(--background)]">
                            {Object.values(chats).map(chat => (
                                <button
                                    key={chat.guestId}
                                    onClick={() => { setActiveGuestId(chat.guestId); setChats(p => ({ ...p, [chat.guestId]: { ...p[chat.guestId], hasUnread: false } })); }}
                                    className={`w-full p-3 text-left text-xs truncate border-b border-[var(--border)] hover:bg-[var(--foreground)]/5 ${activeGuestId === chat.guestId ? 'bg-[var(--accent)]/10 text-[var(--accent)] font-bold' : ''}`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span>{chat.guest.username}</span>
                                        {chat.hasUnread && <Circle className="w-2 h-2 fill-red-500 text-red-500" />}
                                    </div>
                                </button>
                            ))}
                            {Object.keys(chats).length === 0 && <div className="p-4 text-[10px] opacity-40 text-center">No active chats</div>}
                        </div>

                        {/* Chat Area */}
                        <div className="flex-1 flex flex-col bg-[var(--surface)]">
                            {activeGuestId && chats[activeGuestId] ? (
                                <>
                                    <div className="flex-1 p-3 overflow-y-auto space-y-2 text-sm bg-[var(--background)]/50">
                                        {chats[activeGuestId].messages?.map((msg, i) => (
                                            <div key={i} className={`p-2 rounded-lg max-w-[90%] break-words ${msg.isFromGuest ? 'bg-[var(--foreground)]/10 mr-auto rounded-tl-none' : 'bg-[var(--accent)] text-[var(--accent-fg)] ml-auto rounded-tr-none'}`}>
                                                {msg.content}
                                            </div>
                                        ))}
                                    </div>
                                    <form onSubmit={sendMessage} className="p-2 border-t border-[var(--border)]">
                                        <input 
                                            autoFocus
                                            className="w-full text-xs p-2 rounded border border-[var(--border)] bg-[var(--background)]"
                                            placeholder="Reply..."
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                        />
                                    </form>
                                </>
                            ) : (
                                <div className="flex-1 flex items-center justify-center opacity-40 text-xs">Select a guest</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}