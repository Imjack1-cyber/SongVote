import { Skeleton } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8 pb-20">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
            <Skeleton className="h-10 w-40 rounded-lg" />
            <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-6 h-32 flex flex-col justify-between">
            <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-5 rounded-full" />
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      {/* Sessions List Skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="card divide-y divide-[var(--border)]">
           {[1, 2, 3].map((i) => (
               <div key={i} className="p-4 flex items-center gap-4">
                   <Skeleton className="w-12 h-12 rounded-lg" />
                   <div className="space-y-2 flex-1">
                       <Skeleton className="h-5 w-48" />
                       <Skeleton className="h-4 w-32" />
                   </div>
                   <Skeleton className="h-9 w-24 rounded-lg" />
               </div>
           ))}
        </div>
      </div>
    </div>
  );
}