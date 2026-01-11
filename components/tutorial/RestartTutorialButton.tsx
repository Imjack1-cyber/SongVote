'use client';

import { RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function RestartTutorialButton() {
    const router = useRouter();

    const handleRestart = async () => {
        await fetch('/api/auth/reset-tutorial', { method: 'POST' });
    };

    return (
        <button className="flex items-center gap-2 text-xs opacity-50 hover:opacity-100 transition">
            <RotateCcw className="w-3 h-3" /> Replay Tutorial
        </button>
    );
}