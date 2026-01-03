'use client';

import { X, Copy, Check } from 'lucide-react';
import QRCode from 'react-qr-code';
import { useState, useEffect } from 'react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionTitle: string;
}

export default function QRCodeModal({ isOpen, onClose, sessionTitle }: QRCodeModalProps) {
  const [joinUrl, setJoinUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // FIX: Use origin + /join
      setJoinUrl(`${window.location.origin}/join`);
    }
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center relative border border-white/10">
        
        <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition"
        >
            <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-bold mb-1">Join the Party</h3>
        <p className="text-sm opacity-60 mb-6">{sessionTitle}</p>

        <div className="bg-white p-4 rounded-xl inline-block mb-6 shadow-inner">
            <QRCode 
                value={joinUrl} 
                size={200} 
                viewBox={`0 0 256 256`}
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
            />
        </div>

        <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-black/30 rounded-lg border border-gray-100 dark:border-white/5">
            <input 
                readOnly 
                value={joinUrl} 
                className="bg-transparent text-xs flex-1 outline-none text-gray-500 truncate"
            />
            <button onClick={handleCopy} className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-md transition">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
        </div>

        <p className="text-xs mt-4 opacity-50">Scan to register as a guest.</p>

      </div>
    </div>
  );
}