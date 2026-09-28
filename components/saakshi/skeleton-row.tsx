import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/ui/utils";

// One generic loading row, shaped like WorkerRow / HazardCard: a leading
// icon placeholder, two lines of text, and a trailing chip. Render a few in
// a row to placeholder a list.
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-h-12 items-center gap-3 rounded-card border border-border bg-surface px-4 py-3", className)}>
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3.5 w-1/3" />
      </div>
      <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
    </div>
  );
}
