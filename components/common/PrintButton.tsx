'use client';

import { Printer } from 'lucide-react';

export default function PrintButton() {
  return (
    <button 
        onClick={() => window.print()} 
        className="px-4 py-2 bg-black text-white rounded flex items-center gap-2 hover:bg-gray-800 transition"
    >
        <Printer className="w-4 h-4" /> Print Now
    </button>
  );
}