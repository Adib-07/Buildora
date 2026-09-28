import { AlertTriangleIcon, InboxIcon, Loader2Icon, ShieldAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/ui/utils";

/**
 * The states every data screen can be in, in one place.
 *
 * Each one is a real, reachable state rather than decoration: loading, empty
 * (with the reason it is empty), and a failure that says what happened without
 * leaking a database error. Keeping them together is what stops each page
 * inventing its own version and drifting.
 */

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl leading-tight font-semibold tracking-tight text-ink">
          {title}
        </h1>
        {description ? <p className="max-w-prose text-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

/** A deliberate empty state: says what is missing and what to do about it. */
export function EmptyState({
  title,
  description,
  icon: Icon = InboxIcon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      <Icon className="size-8 text-ink-muted" />
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-ink">{title}</p>
        {description ? (
          <p className="max-w-prose text-sm text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/**
 * A failure the user can act on. The detail is written for a supervisor on a
 * site, not for a log file, and never contains a database message.
 */
export function ErrorState({
  title = "Something went wrong",
  description = "Buildora could not complete that request. Nothing was changed.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-card border border-state-disputed/30 bg-state-disputed-bg px-6 py-10 text-center",
        className,
      )}
    >
      <AlertTriangleIcon className="size-7 text-state-disputed" />
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-ink">{title}</p>
        <p className="max-w-prose text-sm text-ink-muted">{description}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** Shown where a page exists but this role may not use it. */
export function ForbiddenState({ message }: { message?: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface px-6 py-12 text-center"
    >
      <ShieldAlertIcon className="size-8 text-ink-muted" />
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-ink">Not available for your role</p>
        <p className="max-w-prose text-sm text-ink-muted">
          {message ?? 'Ask a site administrator if you need access to this screen.'}
        </p>
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2Icon className={cn('size-5 animate-spin text-ink-muted', className)} />;
}

/** Skeleton for a block of content, used by route-level `loading.tsx` files. */
export function SkeletonBlock({ className }: { className?: string }) {
  return <Skeleton className={cn("h-24 rounded-card", className)} />;
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 rounded-card" />
      ))}
    </div>
  );
}
