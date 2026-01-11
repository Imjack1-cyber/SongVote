'use client';

import { ShieldAlert, LogOut } from 'lucide-react';
import { useEffect } from 'react';

interface SuspendedViewProps {
    reason: string | null;
    type: 'BANNED' | 'DELETED';
    isGuest?: boolean;
}

export default function SuspendedView({ reason, type, isGuest = false }: SuspendedViewProps) {
    
    // Auto-logout effect to clear client-side cookies/state
    useEffect(() => {
        if (!isGuest) {
            // Hit the logout endpoint in background to ensure cookies are gone
            fetch('/api/auth/logout').catch(() => {});
        }
    }, [isGuest]);

    const title = type === 'BANNED' ? 'Account Suspended' : 'Account Deleted';
    const subtext = type === 'BANNED' 
        ? 'Your access to this platform has been revoked by an administrator.'
        : 'This account has been permanently deactivated.';

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-900 p-4 text-center">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                        <ShieldAlert className="w-8 h-8" />
                    </div>
                </div>
                
                <h1 className="text-3xl font-bold mb-2 text-gray-900">{title}</h1>
                <p className="text-gray-500 mb-6">{subtext}</p>

                {reason && (
                    <div className="bg-red-50 border border-red-100 rounded-lg p-4 mb-6 text-left">
                        <span className="text-xs font-bold text-red-500 uppercase tracking-wider block mb-1">Reason provided:</span>
                        <p className="text-red-800 text-sm font-medium">{reason}</p>
                    </div>
                )}

                <div className="pt-4 border-t border-gray-100">
                    <a 
                        href="/api/auth/logout" 
                        className="flex items-center justify-center gap-2 w-full py-3 bg-gray-900 text-white rounded-lg font-bold hover:bg-black transition"
                    >
                        <LogOut className="w-4 h-4" /> Sign Out
                    </a>
                </div>
            </div>
        </div>
    );
}