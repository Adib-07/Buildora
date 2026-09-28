import { cn } from "@/lib/ui/utils";

export function PageHeader({
  siteName,
  date,
  action,
  className,
}: {
  siteName: string;
  date: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex min-h-16 items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3", className)}>
      <div className="min-w-0">
        <p className="truncate font-semibold text-ink">{siteName}</p>
        <p className="text-sm text-ink-muted">{date}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
