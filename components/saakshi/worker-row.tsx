import { ChevronRight } from "lucide-react";

import type { Lang } from "@/contracts";
import { cn } from "@/lib/ui/utils";

/**
 * One row, reused for both Roll-call (trailing = attendance status) and
 * Today (trailing = StateBadge). This component only knows name, team and a
 * trailing slot; the caller decides what status means on that screen.
 */
export function WorkerRow({
  name,
  lang,
  teamName,
  trailing,
  onPress,
  className,
}: {
  name: string;
  lang?: Lang;
  teamName?: string | null;
  trailing?: React.ReactNode;
  onPress?: () => void;
  className?: string;
}) {
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink" lang={lang}>
          {name}
        </p>
        {teamName && <p className="truncate text-sm text-ink-muted">{teamName}</p>}
      </div>
      {trailing}
      {onPress && <ChevronRight className="size-5 shrink-0 text-ink-muted" aria-hidden="true" />}
    </>
  );

  const rowClassName = cn(
    "flex min-h-12 w-full items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 text-left",
    className
  );

  if (onPress) {
    return (
      <button type="button" onClick={onPress} className={rowClassName}>
        {content}
      </button>
    );
  }
  return <div className={rowClassName}>{content}</div>;
}
