import { Skeleton } from "@/components/ui/Skeleton";

export default function AdminLoading() {
  return (
    <div className="space-y-8 pb-20">
        
        {/* Controls Row */}
        <div className="flex justify-end">
            <Skeleton className="h-9 w-32 rounded-lg" />
        </div>

        {/* System Health / Announcement Row */}
        <div className="grid lg:grid-cols-2 gap-8">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
        </div>
        
        {/* Analytics Row */}
        <div className="grid lg:grid-cols-2 gap-8">
            <Skeleton className="h-[400px] rounded-xl" />
            <Skeleton className="h-[400px] rounded-xl" />
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
        </div>

        {/* Charts & Table */}
        <div className="grid lg:grid-cols-3 gap-8">
             <div className="lg:col-span-2">
                 <Skeleton className="h-[400px] rounded-xl" />
             </div>
             <div>
                 <Skeleton className="h-[400px] rounded-xl" />
             </div>
        </div>
    </div>
  );
}