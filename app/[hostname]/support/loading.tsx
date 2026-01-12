import { Skeleton } from "@/components/ui/Skeleton";

export default function SupportLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-3/4 max-w-xl" />
      </div>

      <div className="card h-[400px]">
         <div className="p-4 border-b border-[var(--border)] flex justify-between">
             <Skeleton className="h-6 w-32" />
         </div>
         <div className="p-4 space-y-4">
             <Skeleton className="h-12 w-full rounded-xl" /> {/* New Button */}
             <div className="space-y-2">
                 {[1, 2, 3].map(i => (
                     <Skeleton key={i} className="h-16 w-full rounded-lg" />
                 ))}
             </div>
         </div>
      </div>
    </div>
  );
}