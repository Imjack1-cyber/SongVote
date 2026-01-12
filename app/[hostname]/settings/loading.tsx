import { Skeleton } from "@/components/ui/Skeleton";

export default function GlobalSettingsLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* YouTube Section */}
      <div className="space-y-6">
        <Skeleton className="h-6 w-48" />
        <div className="card p-6 border-l-4 border-l-[var(--foreground)]/10">
            <div className="flex justify-between mb-4">
                <div className="space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-3 w-56" />
                </div>
            </div>
            <Skeleton className="h-24 w-full rounded-lg mb-4" /> {/* Help Box */}
            <Skeleton className="h-10 w-full" /> {/* Input */}
            <Skeleton className="h-10 w-full mt-4" /> {/* Button */}
        </div>
      </div>

      {/* Library Section */}
      <div className="space-y-6">
        <Skeleton className="h-6 w-32" />
        <div className="card p-6 space-y-4">
            <div className="flex justify-between">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-8 w-24" />
            </div>
            {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-10 w-full" />
            ))}
        </div>
      </div>

      {/* Appearance Section */}
      <div className="space-y-6">
        <Skeleton className="h-6 w-32" />
        <div className="grid md:grid-cols-2 gap-8">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </div>
  );
}