'use client';

import { useRef, useState, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { 
    Printer, ArrowLeft, LayoutGrid, Maximize, 
    Type, Settings2, X, ChevronUp, Check
} from 'lucide-react';
import Link from 'next/link';

interface Guest {
  id: string;
  username: string;
  password: string;
}

interface PrintableGuestCardsProps {
  guests: Guest[];
  backLink: string;
}

export default function PrintableGuestCards({ guests, backLink }: PrintableGuestCardsProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  
  // --- CONFIGURATION STATE ---
  const [columns, setColumns] = useState(2);
  const [gap, setGap] = useState(6);
  const [padding, setPadding] = useState(8);
  const [fontScale, setFontScale] = useState(1);
  
  // Mobile UI State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [scaleFactor, setScaleFactor] = useState(1);

  // Auto-scale preview on resize to fit mobile screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 800) { // Mobile breakpoint
        // 210mm is approx 794px. We want some padding (e.g. 32px total)
        const availableWidth = window.innerWidth - 32;
        const scale = Math.min(1, availableWidth / 794);
        setScaleFactor(scale);
      } else {
        setScaleFactor(1);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- PRINT HANDLER ---
  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: 'SongVote_Guest_Cards',
    pageStyle: `
      @page { size: auto; margin: 20mm; }
      @media print { 
        body { -webkit-print-color-adjust: exact; } 
      }
    `
  });

  return (
    <div className="h-screen bg-slate-100 text-slate-900 font-sans flex flex-col md:flex-row overflow-hidden">
      
      {/* --- DESKTOP SIDEBAR (Hidden on Mobile) --- */}
      <aside className="hidden md:flex w-80 bg-white border-r border-slate-200 flex-col h-full z-20 shadow-xl">
          <div className="p-6 border-b border-slate-100">
              <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                  <Printer className="w-5 h-5 text-indigo-600" /> 
                  <span>Print Center</span>
              </h1>
              <p className="text-xs text-slate-500 mt-1">Configure & Print Guest Cards</p>
          </div>

          <div className="p-6 space-y-8 flex-1 overflow-y-auto">
              <Controls 
                  columns={columns} setColumns={setColumns}
                  gap={gap} setGap={setGap}
                  padding={padding} setPadding={setPadding}
                  fontScale={fontScale} setFontScale={setFontScale}
              />
          </div>

          <div className="p-6 border-t border-slate-100 bg-slate-50 space-y-3">
              <PrintActions handlePrint={handlePrint} backLink={backLink} />
          </div>
      </aside>

      {/* --- MAIN PREVIEW AREA --- */}
      <main className="flex-1 relative flex flex-col h-full overflow-hidden">
          
          {/* Mobile Header */}
          <header className="md:hidden flex justify-between items-center p-4 bg-white border-b border-slate-200 z-10 shadow-sm">
             <Link href={backLink} className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition">
                 <ArrowLeft className="w-5 h-5 text-slate-600" />
             </Link>
             <h1 className="font-bold text-slate-800">Preview</h1>
             <div className="w-9" /> {/* Spacer for alignment */}
          </header>

          {/* Scrollable Preview Canvas */}
          <div className="flex-1 overflow-auto bg-slate-100/50 relative p-4 md:p-12 flex justify-center">
              
              {/* Background Dot Pattern */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                   style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} 
              />

              {/* THE PAPER (Scaled on Mobile) */}
              <div 
                  className="bg-white shadow-2xl transition-transform duration-300 ease-out origin-top border border-slate-200"
                  style={{
                      width: '210mm',
                      minHeight: '297mm',
                      padding: '12mm',
                      transform: `scale(${scaleFactor})`,
                      marginBottom: `${(297 * scaleFactor)}mm` // Placeholder margin for scrolling
                  }}
              >
                  {/* Actual Print Content */}
                  <div ref={contentRef} className="bg-white h-full">
                      {/* Grid */}
                      <div 
                          style={{ 
                              display: 'grid', 
                              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                              gap: `${gap * 0.25}rem`
                          }}
                      >
                          {guests.map((guest) => (
                              <Card 
                                key={guest.id} 
                                guest={guest} 
                                padding={padding} 
                                fontScale={fontScale} 
                              />
                          ))}
                      </div>
                  </div>
              </div>
          </div>

          {/* --- MOBILE BOTTOM SHEET CONTROLS --- */}
          <div className="md:hidden absolute bottom-0 left-0 right-0 z-30">
              
              {/* Backdrop */}
              {isSettingsOpen && (
                  <div 
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30" 
                    onClick={() => setIsSettingsOpen(false)}
                  />
              )}

              {/* Sheet */}
              <div 
                className={`bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-out z-40 relative flex flex-col ${
                    isSettingsOpen ? 'translate-y-0' : 'translate-y-[calc(100%-80px)]'
                }`}
                style={{ maxHeight: '85vh' }}
              >
                  {/* Handle / Toggle Bar */}
                  <div 
                    className="w-full p-4 flex items-center justify-between border-b border-slate-100 cursor-pointer bg-white rounded-t-2xl"
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  >
                      <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg bg-indigo-50 text-indigo-600 transition-transform ${isSettingsOpen ? 'rotate-180' : ''}`}>
                             <Settings2 className="w-5 h-5" />
                          </div>
                          <div>
                              <p className="font-bold text-slate-800 text-sm">Customize Layout</p>
                              <p className="text-[10px] text-slate-400">{guests.length} cards ready</p>
                          </div>
                      </div>
                      <div className="p-2">
                        <ChevronUp className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isSettingsOpen ? 'rotate-180' : ''}`} />
                      </div>
                  </div>

                  {/* Scrollable Content */}
                  <div className="p-6 overflow-y-auto bg-white pb-24">
                      <Controls 
                          columns={columns} setColumns={setColumns}
                          gap={gap} setGap={setGap}
                          padding={padding} setPadding={setPadding}
                          fontScale={fontScale} setFontScale={setFontScale}
                      />
                  </div>
                  
                  {/* Fixed Bottom Actions */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 flex gap-3">
                      <button 
                        onClick={() => handlePrint()} 
                        className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-lg shadow-indigo-200"
                      >
                          <Printer className="w-5 h-5" /> Print
                      </button>
                  </div>
              </div>
          </div>

      </main>
    </div>
  );
}

// --- SUB-COMPONENTS ---

function Controls({ columns, setColumns, gap, setGap, padding, setPadding, fontScale, setFontScale }: any) {
    return (
        <div className="space-y-8">
            {/* Grid */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                        <LayoutGrid className="w-4 h-4" /> Columns
                    </h3>
                    <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">{columns}</span>
                </div>
                <input 
                  type="range" min="1" max="4" step="1" 
                  value={columns} onChange={(e) => setColumns(Number(e.target.value))}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between px-1">
                    {[1,2,3,4].map(n => <span key={n} className="text-[10px] text-slate-400">{n}</span>)}
                </div>
            </div>

            {/* Gap */}
            <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Spacing</label>
                <div className="grid grid-cols-4 gap-2">
                    {[2, 4, 6, 8].map((v) => (
                        <button
                            key={v}
                            onClick={() => setGap(v)}
                            className={`py-2 text-xs rounded-lg border font-medium transition-all ${
                                gap === v 
                                ? 'bg-indigo-50 border-indigo-600 text-indigo-700' 
                                : 'bg-white border-slate-200 text-slate-600'
                            }`}
                        >
                            {v === 2 ? 'Tiny' : v === 4 ? 'Small' : v === 6 ? 'Mid' : 'Large'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Scale */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                        <Type className="w-4 h-4" /> Text Size
                    </h3>
                    <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">{fontScale}x</span>
                </div>
                <input 
                  type="range" min="0.8" max="1.5" step="0.1" 
                  value={fontScale} onChange={(e) => setFontScale(Number(e.target.value))}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
            </div>

            {/* Padding */}
            <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Maximize className="w-4 h-4" /> Inner Padding
                </label>
                <div className="grid grid-cols-4 gap-2">
                    {[4, 6, 8, 12].map((v) => (
                        <button
                            key={v}
                            onClick={() => setPadding(v)}
                            className={`py-2 text-xs rounded-lg border font-medium transition-all ${
                                padding === v 
                                ? 'bg-indigo-50 border-indigo-600 text-indigo-700' 
                                : 'bg-white border-slate-200 text-slate-600'
                            }`}
                        >
                            {v}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

function PrintActions({ handlePrint, backLink }: any) {
    return (
        <>
            <button 
              onClick={() => handlePrint()} 
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 active:scale-[0.98]"
            >
                <Printer className="w-5 h-5" /> Print Now
            </button>
            <Link href={backLink} className="w-full py-3 border border-slate-200 text-slate-600 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-slate-50 transition active:scale-[0.98]">
                <ArrowLeft className="w-4 h-4" /> Back
            </Link>
        </>
    );
}

function Card({ guest, padding, fontScale }: any) {
    return (
        <div 
            className="border-2 border-slate-900 rounded-xl break-inside-avoid relative flex flex-col justify-between bg-white"
            style={{ padding: `${padding * 0.25}rem` }}
        >
            <div className="space-y-4 text-center">
                <div>
                    <div className="uppercase font-bold text-slate-400 tracking-widest mb-1" style={{ fontSize: `${0.7 * fontScale}rem` }}>Username</div>
                    <div className="font-mono font-black tracking-tight leading-none text-slate-900 break-all" style={{ fontSize: `${1.5 * fontScale}rem` }}>
                        {guest.username}
                    </div>
                </div>
                
                <div className="w-full h-px bg-slate-100 my-2" />
                
                <div>
                    <div className="uppercase font-bold text-slate-400 tracking-widest mb-1" style={{ fontSize: `${0.7 * fontScale}rem` }}>Passcode</div>
                    <div className="font-mono font-bold text-slate-900 tracking-[0.1em]" style={{ fontSize: `${2 * fontScale}rem` }}>
                        {guest.password}
                    </div>
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-dashed border-slate-200 text-center text-slate-500" style={{ fontSize: `${0.75 * fontScale}rem` }}>
                Visit: <strong className="text-slate-800">songvote.com/join</strong>
            </div>
        </div>
    );
}