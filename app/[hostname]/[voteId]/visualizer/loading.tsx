import { Skeleton } from "@/components/ui/Skeleton";
import { MusicBars } from "@/components/ui/Loaders";

export default function VisualizerLoading() {
  return (
    <div className="min-h-screen bg-black text-white p-12 flex flex-col gap-12 overflow-hidden font-sans">
      
      {/* Header */}
      <div className="flex justify-between items-start border-b border-white/10 pb-8">
          <div className="space-y-4">
              <Skeleton className="h-10 w-96 bg-white/10" />
              <Skeleton className="h-6 w-48 bg-white/10" />
          </div>
          <div className="flex gap-6">
              <Skeleton className="h-12 w-12 rounded-xl bg-white/10" />
              <div className="flex flex-col items-center gap-2">
                 <Skeleton className="h-32 w-32 rounded-2xl bg-white/10" />
                 <Skeleton className="h-4 w-24 bg-white/10" />
              </div>
          </div>
      </div>

      <div className="flex-1 flex gap-12 items-stretch">
          
          {/* Now Playing (Left) */}
          <div className="flex-1 flex flex-col justify-center items-center space-y-8">
              <div className="relative w-[50vh] h-[50vh] rounded-3xl overflow-hidden ring-4 ring-white/5 bg-neutral-900 flex items-center justify-center">
                   <MusicBars size="lg" className="opacity-30" />
              </div>
              <div className="space-y-6 w-full max-w-xl flex flex-col items-center">
                  <Skeleton className="h-16 w-3/4 bg-white/10" />
                  <Skeleton className="h-8 w-1/2 bg-white/10" />
              </div>
          </div>

          {/* Up Next (Right) */}
          <div className="w-1/3 bg-white/5 rounded-3xl p-8 border border-white/10 flex flex-col gap-8">
              <Skeleton className="h-8 w-40 bg-white/10" />
              
              <div className="space-y-4">
                  {[1, 2, 3, 4].map(i => (
                      <div key={i} className="flex items-center gap-5 p-4 rounded-2xl bg-black/40 border border-white/5">
                          <Skeleton className="w-8 h-8 bg-white/5" />
                          <Skeleton className="w-16 h-16 rounded-xl bg-white/10" />
                          <div className="flex-1 space-y-2">
                              <Skeleton className="h-6 w-32 bg-white/10" />
                              <Skeleton className="h-4 w-20 bg-white/5" />
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </div>
    </div>
  );
}