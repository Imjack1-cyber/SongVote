import { Skeleton } from "@/components/ui/Skeleton";

export default function AdminSupportLoading() {
  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-6 w-32" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] h-40 flex flex-col justify-between">
                    <div>
                        <div className="flex gap-2 mb-2">
                            <Skeleton className="h-4 w-12 rounded" />
                            <Skeleton className="h-4 w-12 rounded" />
                        </div>
                        <Skeleton className="h-6 w-3/4" />
                    </div>
                    <div className="flex justify-between pt-4 border-t border-[var(--border)]">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-16" />
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
}