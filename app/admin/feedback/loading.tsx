import { Skeleton } from "@/components/ui/Skeleton";

export default function FeedbackLoading() {
  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
        </div>

        <div className="grid gap-4">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="card p-4 flex gap-4 items-start">
                    <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" /> {/* Icon */}
                    <div className="flex-1 space-y-2">
                        <div className="flex gap-2">
                            <Skeleton className="h-5 w-16 rounded" />
                            <Skeleton className="h-5 w-24 rounded" />
                        </div>
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                    </div>
                    <div className="flex gap-2">
                         <Skeleton className="w-8 h-8 rounded-lg" />
                         <Skeleton className="w-8 h-8 rounded-lg" />
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
}