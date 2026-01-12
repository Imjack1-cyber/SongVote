import { Skeleton } from "@/components/ui/Skeleton";

export default function ProfileLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <Skeleton className="h-10 w-64" /> {/* Page Title */}
      
      <div className="grid gap-8">
        
        {/* Account Info Card Skeleton */}
        <div className="card p-8">
            <Skeleton className="h-7 w-48 mb-6" /> {/* Section Title */}
            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-20" /> {/* Label */}
                    <Skeleton className="h-11 w-full rounded-lg" /> {/* Input */}
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-4 w-32" /> {/* Label */}
                    <Skeleton className="h-11 w-full rounded-lg" /> {/* Input */}
                </div>
            </div>
        </div>

        {/* Branding/Avatar Card Skeleton */}
        <div className="card p-8">
            <Skeleton className="h-7 w-48 mb-6" />
            <div className="flex items-start gap-6">
                <Skeleton className="w-24 h-24 rounded-full flex-shrink-0" /> {/* Avatar Circle */}
                <div className="flex-1 space-y-4">
                    <div className="flex gap-4 border-b border-[var(--border)] pb-2">
                        <Skeleton className="h-6 w-20" />
                        <Skeleton className="h-6 w-20" />
                    </div>
                    <Skeleton className="h-10 w-full" /> {/* Input */}
                    <Skeleton className="h-10 w-32" /> {/* Save Button */}
                </div>
            </div>
        </div>

        {/* Support Card Skeleton */}
        <div className="card p-8">
            <Skeleton className="h-7 w-48 mb-6" />
            <div className="space-y-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-40" />
            </div>
        </div>

      </div>
    </div>
  );
}