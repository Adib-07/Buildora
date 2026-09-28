import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-card border border-dashed border-border px-6 py-10 text-center", className)}>
      {Icon && (
        <span className="flex size-12 items-center justify-center rounded-full bg-bg text-ink-muted">
          <Icon className="size-6" aria-hidden="true" />
        </span>
      )}
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-ink">{title}</p>
        {description && <p className="max-w-xs text-sm text-ink-muted">{description}</p>}
      </div>
      {action && (
        <Button variant="outline" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
