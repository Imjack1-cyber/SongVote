import { Skeleton } from "@/components/ui/Skeleton";

export default function SessionSettingsLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-32">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-6 border-b border-[var(--border)]">
            <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-10 w-40 rounded-lg" />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
            
            <div className="lg:col-span-2 space-y-8">
                {/* User Table Skeleton */}
                <div className="card p-6">
                    <div className="flex justify-between mb-4">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-8 w-24" />
                    </div>
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map(i => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </div>
                </div>

                {/* Rules Form Skeleton */}
                <div className="card p-6">
                    <Skeleton className="h-6 w-32 mb-6" />
                    <div className="grid gap-6">
                        <Skeleton className="h-32 w-full rounded-xl" /> {/* Toggles */}
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <Skeleton className="h-16 w-full" />
                                <Skeleton className="h-16 w-full" />
                            </div>
                            <div className="space-y-4">
                                <Skeleton className="h-16 w-full" />
                                <Skeleton className="h-16 w-full" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                <Skeleton className="h-24 w-full rounded-xl" /> {/* Status Card */}
                <Skeleton className="h-64 w-full rounded-xl" /> {/* Library */}
                <Skeleton className="h-64 w-full rounded-xl" /> {/* Blacklist */}
            </div>
        </div>
    </div>
  );
}