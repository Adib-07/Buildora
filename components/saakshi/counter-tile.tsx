import { CircleCheck, Clock, TriangleAlert, type LucideIcon } from "lucide-react";

import type { WorkerState } from "@/contracts";
import { cn } from "@/lib/ui/utils";

export type CounterTone = WorkerState | "neutral";

const TONE: Record<CounterTone, { icon: LucideIcon | null; fg: string; bg: string; border: string }> = {
  confirmed: { icon: CircleCheck, fg: "text-state-confirmed", bg: "bg-state-confirmed-bg", border: "border-state-confirmed" },
  disputed: { icon: TriangleAlert, fg: "text-state-disputed", bg: "bg-state-disputed-bg", border: "border-state-disputed" },
  no_reply: { icon: Clock, fg: "text-state-noreply", bg: "bg-state-noreply-bg", border: "border-state-noreply" },
  neutral: { icon: null, fg: "text-ink", bg: "bg-bg", border: "border-primary" },
};

// A filter chip: aria-pressed carries the on/off state, and the tinted fill
// plus a 2px border repeat it visually, so pressed never relies on colour
// alone against an unpressed neighbour of the same tone.
export function CounterTile({
  label,
  count,
  tone = "neutral",
  pressed,
  onClick,
  className,
}: {
  label: string;
  count: number;
  tone?: CounterTone;
  pressed: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const { icon: Icon, fg, bg, border } = TONE[tone];
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex min-h-14 min-w-0 flex-1 flex-col items-start gap-0.5 rounded-card border px-3 py-2 text-left transition-colors",
        pressed ? cn(bg, border) : "border-border bg-surface hover:bg-bg",
        className
      )}
    >
      <span className={cn("flex items-center gap-1.5 text-sm font-medium", pressed ? fg : "text-ink-muted")}>
        {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
        {label}
      </span>
      <span className={cn("text-2xl leading-none font-semibold tabular-nums", pressed ? fg : "text-ink")}>{count}</span>
    </button>
  );
}
