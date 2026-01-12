import { Skeleton } from "@/components/ui/Skeleton";

export default function LoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md border border-slate-100">
        
        {/* Header Area */}
        <div className="mb-8 text-center flex flex-col items-center">
            <Skeleton className="w-10 h-10 rounded-lg mb-4" /> {/* Logo */}
            <Skeleton className="h-8 w-48 mb-2" /> {/* Title */}
            <Skeleton className="h-4 w-64" /> {/* Subtitle */}
        </div>

        {/* Form Fields */}
        <div className="space-y-5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
          
          <Skeleton className="h-12 w-full rounded-lg mt-6" /> {/* Button */}
        </div>
      </div>
    </div>
  );
}