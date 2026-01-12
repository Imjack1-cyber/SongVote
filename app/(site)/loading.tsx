import { Skeleton } from "@/components/ui/Skeleton";
import { Radio } from "lucide-react";

export default function SiteLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Navbar Skeleton */}
      <nav className="w-full px-6 py-4 flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
           <Skeleton className="w-8 h-8 rounded-lg" />
           <Skeleton className="w-24 h-6" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="w-16 h-8" />
          <Skeleton className="w-24 h-8 rounded-lg" />
        </div>
      </nav>

      <main className="flex-1">
        {/* Hero Section Skeleton */}
        <section className="pt-20 pb-32 px-6 max-w-4xl mx-auto flex flex-col items-center gap-6">
          <Skeleton className="w-32 h-6 rounded-full" /> {/* Badge */}
          <div className="space-y-4 flex flex-col items-center w-full">
            <Skeleton className="h-20 w-3/4" /> {/* H1 Line 1 */}
            <Skeleton className="h-20 w-1/2" /> {/* H1 Line 2 */}
          </div>
          <Skeleton className="h-6 w-2/3 max-w-lg mt-4" /> {/* Subtitle */}
          
          <div className="flex gap-4 mt-8">
             <Skeleton className="w-40 h-12 rounded-lg" />
             <Skeleton className="w-40 h-12 rounded-lg" />
          </div>
        </section>
      </main>
    </div>
  );
}