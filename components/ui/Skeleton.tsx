import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        // Uses foreground color with low opacity to adapt to ANY theme (light/dark/custom)
        "animate-pulse rounded-md bg-[var(--foreground)]/10",
        className
      )}
      {...props}
    />
  );
}