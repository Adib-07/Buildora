import { OctagonAlert, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui/utils";

export function ErrorState({
  title = "Something went wrong",
  description = "Try again in a moment.",
  requestId,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  requestId?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center gap-3 rounded-card border border-border bg-surface px-6 py-10 text-center", className)}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-state-disputed-bg text-state-disputed">
        <OctagonAlert className="size-6" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-ink">{title}</p>
        <p className="max-w-xs text-sm text-ink-muted">{description}</p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw data-icon="inline-start" />
          Retry
        </Button>
      )}
      {requestId && <p className="text-sm text-ink-muted">Request ID: {requestId}</p>}
    </div>
  );
}
