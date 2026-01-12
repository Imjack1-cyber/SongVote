import { Skeleton } from "@/components/ui/Skeleton";

export default function PrintLoading() {
  return (
    <div className="h-screen bg-[var(--background)] flex flex-col md:flex-row overflow-hidden">
      
      {/* Sidebar Skeleton */}
      <aside className="hidden md:flex w-80 bg-[var(--surface)] border-r border-[var(--border)] flex-col h-full p-6 gap-8">
          <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
          </div>
          
          <div className="flex-1 space-y-8">
              {[1, 2, 3].map(i => (
                  <div key={i} className="space-y-3">
                      <div className="flex justify-between">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 w-8" />
                      </div>
                      <Skeleton className="h-2 w-full rounded-full" />
                  </div>
              ))}
          </div>

          <div className="space-y-3 pt-6 border-t border-[var(--border)]">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
          </div>
      </aside>

      {/* Preview Area Skeleton */}
      <main className="flex-1 bg-gray-100 flex items-center justify-center p-8">
          <div className="w-[60%] aspect-[1/1.4] bg-white shadow-xl p-8 grid grid-cols-2 gap-4">
               {[1, 2, 3, 4, 5, 6].map(i => (
                   <div key={i} className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center gap-4">
                       <div className="text-center space-y-2 w-full">
                           <Skeleton className="h-3 w-16 mx-auto bg-gray-100" />
                           <Skeleton className="h-6 w-24 mx-auto bg-gray-100" />
                       </div>
                       <Skeleton className="h-px w-full bg-gray-100" />
                       <div className="text-center space-y-2 w-full">
                           <Skeleton className="h-3 w-16 mx-auto bg-gray-100" />
                           <Skeleton className="h-8 w-32 mx-auto bg-gray-100" />
                       </div>
                   </div>
               ))}
          </div>
      </main>

    </div>
  );
}