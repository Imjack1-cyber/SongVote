import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// 1. Simple Spinner for Buttons/Small areas
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} />;
}

// 2. Brand-Specific EQ Animation
export function MusicBars({ className, size = "md" }: { className?: string, size?: "sm" | "md" | "lg" }) {
  
  const heightClass = size === "sm" ? "h-4" : size === "md" ? "h-8" : "h-16";
  const widthClass = size === "sm" ? "w-1" : size === "md" ? "w-2" : "w-4";
  
  return (
    <div className={cn("flex items-end gap-1", className)} aria-label="Loading...">
      <div className={cn("bg-[var(--accent)] animate-[music-bar_1s_ease-in-out_infinite]", widthClass, heightClass)} style={{ animationDelay: "0ms" }} />
      <div className={cn("bg-[var(--accent)] animate-[music-bar_1s_ease-in-out_infinite]", widthClass, heightClass)} style={{ animationDelay: "150ms" }} />
      <div className={cn("bg-[var(--accent)] animate-[music-bar_1s_ease-in-out_infinite]", widthClass, heightClass)} style={{ animationDelay: "300ms" }} />
      <div className={cn("bg-[var(--accent)] animate-[music-bar_1s_ease-in-out_infinite]", widthClass, heightClass)} style={{ animationDelay: "75ms" }} />
      
      {/* Inline styles for keyframes to avoid polluting global css for a single component */}
      <style>{`
        @keyframes music-bar {
          0%, 100% { height: 20%; opacity: 0.5; }
          50% { height: 100%; opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// 3. Full Page Wrapper
export function FullPageLoader({ label }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--background)]/80 backdrop-blur-sm">
      <MusicBars size="lg" />
      {label && <p className="mt-4 font-bold text-[var(--accent)] animate-pulse">{label}</p>}
    </div>
  );
}