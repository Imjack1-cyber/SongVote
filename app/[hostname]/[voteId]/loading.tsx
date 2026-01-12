import { Skeleton } from "@/components/ui/Skeleton";
import { MusicBars } from "@/components/ui/Loaders";

export default function SessionLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-32">
      
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </div>

      {/* Player Skeleton */}
      <div className="card p-0 overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
         <div className="aspect-video bg-black/5 flex items-center justify-center">
             <MusicBars size="lg" className="opacity-50" />
         </div>
         <div className="p-6 space-y-4">
             <div className="space-y-2">
                 <Skeleton className="h-6 w-3/4" />
                 <Skeleton className="h-4 w-1/2" />
             </div>
             <div className="flex items-center justify-between gap-4">
                 <Skeleton className="h-10 w-10 rounded-full" />
                 <Skeleton className="h-12 w-12 rounded-full" />
                 <Skeleton className="h-10 w-10 rounded-full" />
             </div>
         </div>
      </div>

      {/* Search Input Skeleton */}
      <div className="relative">
          <Skeleton className="h-14 w-full rounded-xl" />
      </div>

      {/* Queue List Skeleton */}
      <div className="space-y-4">
         <div className="flex justify-between items-center">
             <Skeleton className="h-6 w-24" />
             <Skeleton className="h-4 w-16" />
         </div>
         
         {[1, 2, 3, 4, 5].map(i => (
             <div key={i} className="card p-3 flex items-center gap-4">
                 <Skeleton className="w-6 h-4" /> {/* Rank */}
                 <Skeleton className="w-12 h-12 rounded-lg" /> {/* Art */}
                 <div className="flex-1 space-y-2">
                     <Skeleton className="h-4 w-40" />
                     <Skeleton className="h-3 w-24" />
                 </div>
                 <Skeleton className="w-8 h-8 rounded-full" /> {/* Vote Btn */}
             </div>
         ))}
      </div>

    </div>
  );
}