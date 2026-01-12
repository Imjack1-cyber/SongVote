import { Skeleton } from "@/components/ui/Skeleton";

export default function JoinLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <div className="mb-8 text-center flex flex-col items-center">
        <div className="flex items-center gap-2 mb-4">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <Skeleton className="w-24 h-6" />
        </div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-slate-100 space-y-6">
          <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-12 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-12 w-full rounded-lg" />
          </div>
          <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
}