'use client';

import { useState, useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

interface GlobalBannerProps {
    initialData: { message: string; type: 'info' | 'warning' | 'error' } | null;
}

export default function GlobalBanner({ initialData }: GlobalBannerProps) {
  // Use "global" as a dummy room ID to ensure connection establishment
  const { socket } = useSocket('global');
  const [announcement, setAnnouncement] = useState(initialData);
  const [visible, setVisible] = useState(!!initialData);

  useEffect(() => {
    if (initialData) {
        setAnnouncement(initialData);
        setVisible(true);
    } else {
        setVisible(false);
    }
  }, [initialData]);

  useEffect(() => {
    if (!socket) return;

    const handleAnnouncement = (data: any) => {
        if (!data || !data.message) {
            setVisible(false);
            setAnnouncement(null);
        } else {
            setAnnouncement(data);
            setVisible(true);
        }
    };

    socket.on('global-announcement', handleAnnouncement);

    return () => {
        socket.off('global-announcement', handleAnnouncement);
    };
  }, [socket]);

  if (!visible || !announcement) return null;

  const styles = {
    info: 'bg-indigo-600 text-white',
    warning: 'bg-orange-500 text-white',
    error: 'bg-red-600 text-white'
  };

  const icons = {
    info: <Info className="w-5 h-5" />,
    warning: <AlertTriangle className="w-5 h-5" />,
    error: <AlertCircle className="w-5 h-5" />
  };

  return (
    <div className={`w-full px-4 py-3 flex items-center justify-between shadow-lg relative z-[100] ${styles[announcement.type]}`}>
       <div className="flex items-center gap-3 justify-center w-full">
          {icons[announcement.type]}
          <span className="font-bold text-sm md:text-base">{announcement.message}</span>
       </div>
       <button onClick={() => setVisible(false)} className="p-1 rounded-full hover:bg-white/20 transition">
          <X className="w-4 h-4" />
       </button>
    </div>
  );
}