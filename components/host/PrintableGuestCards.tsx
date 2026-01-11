'use client';

import { useRef, useState, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { 
    Printer, ArrowLeft, LayoutGrid,
    Type, Settings2, X, MoveVertical,
    ZoomIn
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
  
  // Configuration State
  const [columns, setColumns] = useState(2);
  const [gap, setGap] = useState(6);
  const [padding, setPadding] = useState(8);
  const [fontScale, setFontScale] = useState(1);
  
  // UI State
  const [scaleFactor, setScaleFactor] = useState(0.4);
  const [showMobileSettings, setShowMobileSettings] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      const a4Width = 794; 
      let availableWidth;
      
      if (isMobile) {
          availableWidth = window.innerWidth - 24;
      } else {
          availableWidth = window.innerWidth - 320 - 64;
      }

      const scale = Math.min(1, availableWidth / a4Width);
      setScaleFactor(scale);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: 'SongVote_Guest_Cards',
  });

  return (
    <div className="h-[100dvh] bg-[var(--background)] text-[var(--foreground)] font-sans flex flex-col md:flex-row overflow-hidden transition-colors duration-300">
      
      <style jsx global>{`
        @media print {
          @page { size: auto; margin: 0mm; }
          body { -webkit-print-color-adjust: exact; }
          .print-preview-container {
            transform: none !important;
            width: 100% !important;
            height: auto !important;
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="hidden md:flex w-80 bg-[var(--surface)] border-r border-[var(--border)] flex-col h-full z-20 shadow-xl flex-shrink-0">
          <div className="p-6 border-b border-[var(--border)]">
              <h1 className="text-xl font-bold flex items-center gap-2">
                  <Printer className="w-5 h-5 text-[var(--accent)]" /> 
                  <span>Print Center</span>
              </h1>
              <p className="text-xs opacity-60 mt-1">Configure & Print Guest Cards</p>
          </div>

          <div className="p-6 space-y-8 flex-1 overflow-y-auto">
              <Controls 
                  columns={columns} setColumns={setColumns}
                  gap={gap} setGap={setGap}
                  padding={padding} setPadding={setPadding}
                  fontScale={fontScale} setFontScale={setFontScale}
              />
          </div>

          <div className="p-6 border-t border-[var(--border)] bg-[var(--background)] space-y-3">
              <button 
                onClick={() => handlePrint()} 
                className="w-full py-3 bg-[var(--accent)] text-[var(--accent-fg)] rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-110 transition shadow-lg active:scale-[0.98]"
              >
                  <Printer className="w-5 h-5" /> Print Now
              </button>
              <Link 
                  id="print-back-desktop" 
                  href={backLink} 
                  className="w-full py-3 border border-[var(--border)] opacity-70 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-[var(--foreground)]/5 hover:opacity-100 transition active:scale-[0.98]"
              >
                  <ArrowLeft className="w-4 h-4" /> Back
              </Link>
          </div>
      </aside>

      {/* --- MAIN PREVIEW AREA --- */}
      <main className="flex-1 relative flex flex-col h-full overflow-hidden bg-[var(--background)]">
          
          {/* Mobile Top Bar */}
          <div className="md:hidden h-14 flex-shrink-0 flex items-center justify-center border-b border-[var(--border)] bg-[var(--surface)] z-10">
              <span className="text-sm font-bold opacity-70">Print Preview</span>
          </div>

          {/* Scrollable Canvas */}
          <div id="print-preview-wrapper" className="flex-1 overflow-auto relative w-full bg-[var(--background)] flex justify-center py-8">
              
              <div className="absolute inset-0 opacity-5 pointer-events-none" 
                   style={{ 
                       backgroundImage: 'radial-gradient(var(--foreground) 1px, transparent 1px)', 
                       backgroundSize: '24px 24px' 
                   }} 
              />

              <div 
                 className="relative origin-top transition-transform duration-200"
                 style={{
                     width: '210mm',
                     height: '297mm',
                     transform: `scale(${scaleFactor})`,
                     marginBottom: `-${297 * (1 - scaleFactor)}mm`,
                     marginRight: `-${210 * (1 - scaleFactor)}mm`
                 }}
              >
                  <div 
                    ref={contentRef}
                    className="print-preview-container bg-white text-black shadow-2xl border border-gray-200 h-full w-full"
                    style={{ padding: '12mm' }}
                  >
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

          {/* --- MOBILE BOTTOM NAVIGATION --- */}
          <div className="md:hidden h-20 bg-[var(--surface)] border-t border-[var(--border)] flex items-center justify-between px-8 z-20 flex-shrink-0 pb-safe">
             
             {/* ID Added here for Mobile Targeting */}
             <Link 
                id="print-back-mobile"
                href={backLink} 
                className="flex flex-col items-center gap-1 opacity-70 hover:opacity-100 active:scale-95 transition"
             >
                 <div className="p-2 rounded-full bg-[var(--foreground)]/5">
                    <ArrowLeft className="w-5 h-5" />
                 </div>
                 <span className="text-[10px] font-bold">Back</span>
             </Link>

             <button 
                onClick={() => setShowMobileSettings(true)}
                className="flex flex-col items-center gap-1 active:scale-95 transition text-[var(--accent)]"
             >
                 <div className="p-3 rounded-full bg-[var(--accent)]/10">
                    <Settings2 className="w-6 h-6" />
                 </div>
                 <span className="text-[10px] font-bold">Customize</span>
             </button>

             <button 
                onClick={() => handlePrint()}
                className="flex flex-col items-center gap-1 opacity-70 hover:opacity-100 active:scale-95 transition"
             >
                 <div className="p-2 rounded-full bg-[var(--foreground)]/5">
                    <Printer className="w-5 h-5" />
                 </div>
                 <span className="text-[10px] font-bold">Print</span>
             </button>
          </div>

          {/* --- MOBILE SETTINGS DRAWER --- */}
          {showMobileSettings && (
             <div className="md:hidden absolute inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                 <div className="flex-1" onClick={() => setShowMobileSettings(false)} />
                 <div className="bg-[var(--surface)] rounded-t-3xl p-6 shadow-2xl border-t border-[var(--border)] animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto">
                     <div className="flex items-center justify-center mb-6 relative">
                         <div className="w-12 h-1.5 bg-[var(--foreground)]/10 rounded-full absolute top-[-10px]" />
                         <h3 className="font-bold text-lg flex items-center gap-2">Layout Settings</h3>
                         <button onClick={() => setShowMobileSettings(false)} className="absolute right-0 p-2 rounded-full hover:bg-[var(--foreground)]/5">
                             <X className="w-5 h-5 opacity-50" />
                         </button>
                     </div>
                     <Controls 
                         columns={columns} setColumns={setColumns}
                         gap={gap} setGap={setGap}
                         padding={padding} setPadding={setPadding}
                         fontScale={fontScale} setFontScale={setFontScale}
                     />
                     <div className="mt-8 pb-4">
                         <button 
                             onClick={() => setShowMobileSettings(false)}
                             className="w-full py-4 bg-[var(--accent)] text-[var(--accent-fg)] font-bold rounded-2xl shadow-lg active:scale-[0.98] transition"
                         >
                             Done
                         </button>
                     </div>
                 </div>
             </div>
          )}
      </main>
    </div>
  );
}

function Controls({ columns, setColumns, gap, setGap, padding, setPadding, fontScale, setFontScale }: any) {
    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider opacity-60 flex items-center gap-2">
                        <LayoutGrid className="w-4 h-4" /> Columns
                    </h3>
                    <span className="text-xs font-mono bg-[var(--foreground)]/10 px-2 py-1 rounded opacity-80">{columns}</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-xs opacity-40">1</span>
                    <input 
                    type="range" min="1" max="4" step="1" 
                    value={columns} onChange={(e) => setColumns(Number(e.target.value))}
                    className="flex-1 h-2 bg-[var(--foreground)]/10 rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                    />
                    <span className="text-xs opacity-40">4</span>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider opacity-60 flex items-center gap-2">
                         <MoveVertical className="w-4 h-4" /> Spacing
                    </h3>
                </div>
                <input 
                  type="range" min="2" max="12" step="1" 
                  value={gap} onChange={(e) => setGap(Number(e.target.value))}
                  className="w-full h-2 bg-[var(--foreground)]/10 rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                />
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider opacity-60 flex items-center gap-2">
                         <ZoomIn className="w-4 h-4" /> Padding
                    </h3>
                </div>
                <input 
                  type="range" min="4" max="16" step="1" 
                  value={padding} onChange={(e) => setPadding(Number(e.target.value))}
                  className="w-full h-2 bg-[var(--foreground)]/10 rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                />
            </div>
            
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider opacity-60 flex items-center gap-2">
                        <Type className="w-4 h-4" /> Font Size
                    </h3>
                </div>
                <input 
                  type="range" min="0.8" max="1.5" step="0.1" 
                  value={fontScale} onChange={(e) => setFontScale(Number(e.target.value))}
                  className="w-full h-2 bg-[var(--foreground)]/10 rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                />
            </div>
        </div>
    );
}

function Card({ guest, padding, fontScale }: any) {
    return (
        <div 
            className="border-2 border-black rounded-xl break-inside-avoid relative flex flex-col justify-between bg-white text-black print-break-avoid"
            style={{ padding: `${padding * 0.25}rem` }}
        >
            <div className="space-y-4 text-center">
                <div>
                    <div className="uppercase font-bold text-gray-500 tracking-widest mb-1" style={{ fontSize: `${0.7 * fontScale}rem` }}>Username</div>
                    <div className="font-mono font-black tracking-tight leading-none break-all" style={{ fontSize: `${1.5 * fontScale}rem` }}>
                        {guest.username}
                    </div>
                </div>
                <div className="w-full h-px bg-gray-200 my-2" />
                <div>
                    <div className="uppercase font-bold text-gray-500 tracking-widest mb-1" style={{ fontSize: `${0.7 * fontScale}rem` }}>Passcode</div>
                    <div className="font-mono font-bold tracking-[0.1em]" style={{ fontSize: `${2 * fontScale}rem` }}>
                        {guest.password}
                    </div>
                </div>
            </div>
            <div className="mt-4 pt-4 border-t border-dashed border-gray-300 text-center text-gray-600" style={{ fontSize: `${0.75 * fontScale}rem` }}>
                Visit: <strong>songvote.com/join</strong>
            </div>
        </div>
    );
}