import {
  CheckCircle2Icon,
  CircleSlashIcon,
  Clock3Icon,
  ShieldAlertIcon,
  TriangleAlertIcon,
} from "lucide-react";

import type { AttStatus, HazardStatus, Severity, WorkerState } from "@/contracts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/ui/utils";

/**
 * Status vocabulary, defined once.
 *
 * Every badge pairs a colour with a word and an icon, never colour alone --
 * "confirmed" and "not replied" are the difference between a signed-off shift
 * and an unpaid worker, and red/green alone is unreadable to a red-green colour
 * blind supervisor and invisible in a screenshot printed in black and white.
 */

const WORKER_STATE: Record<
  WorkerState,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  confirmed: {
    label: "Confirmed",
    className: "bg-state-confirmed-bg text-state-confirmed",
    icon: CheckCircle2Icon,
  },
  disputed: {
    label: "Disputed",
    className: "bg-state-disputed-bg text-state-disputed",
    icon: TriangleAlertIcon,
  },
  no_reply: {
    label: "Awaiting reply",
    className: "bg-state-noreply-bg text-state-noreply",
    icon: Clock3Icon,
  },
};

export function WorkerStateBadge({ state }: { state: WorkerState }) {
  const config = WORKER_STATE[state];
  const Icon = config.icon;
  return (
    <Badge className={config.className}>
      <Icon />
      {config.label}
    </Badge>
  );
}

const ATT_STATUS: Record<AttStatus, { label: string; className: string }> = {
  present: { label: "Present", className: "bg-state-confirmed-bg text-state-confirmed" },
  half_day: { label: "Half day", className: "bg-state-noreply-bg text-state-noreply" },
  absent: { label: "Absent", className: "bg-state-disputed-bg text-state-disputed" },
};

export function AttendanceStatusBadge({ status }: { status: AttStatus }) {
  const config = ATT_STATUS[status];
  return <Badge className={config.className}>{config.label}</Badge>;
}

const HAZARD_STATUS: Record<HazardStatus, { label: string; className: string }> = {
  reported: { label: "Reported", className: "bg-state-noreply-bg text-state-noreply" },
  assigned: { label: "Assigned", className: "bg-primary-soft text-primary" },
  fixed_awaiting_reporter: { label: "Awaiting worker", className: "bg-primary-soft text-primary" },
  closed: { label: "Closed", className: "bg-state-confirmed-bg text-state-confirmed" },
  closed_unverified: { label: "Closed, unverified", className: "bg-bg text-ink-muted" },
  reopened: { label: "Reopened", className: "bg-state-disputed-bg text-state-disputed" },
};

export function HazardStatusBadge({ status }: { status: HazardStatus }) {
  const config = HAZARD_STATUS[status];
  return <Badge className={config.className}>{config.label}</Badge>;
}

const SEVERITY: Record<Severity, { label: string; className: string }> = {
  3: { label: "High", className: "bg-state-disputed-bg text-state-disputed" },
  2: { label: "Medium", className: "bg-state-noreply-bg text-state-noreply" },
  1: { label: "Low", className: "bg-bg text-ink-muted" },
};

export function SeverityBadge({ severity }: { severity: Severity | null }) {
  if (severity === null) {
    return (
      <Badge variant="outline" className="text-ink-muted">
        <CircleSlashIcon />
        Not triaged
      </Badge>
    );
  }
  return <Badge className={SEVERITY[severity].className}>{SEVERITY[severity].label}</Badge>;
}

export function UntriagedIcon({ className }: { className?: string }) {
  return <ShieldAlertIcon className={cn('size-4 text-state-noreply', className)} />;
}

/**
 * A headline number. The label and the figure are one unit of information:
 * a number on its own is meaningless on a dashboard full of them.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
  className,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: 'default' | 'positive' | 'warning' | 'critical';
  className?: string;
}) {
  const toneClass = {
    default: 'text-ink',
    positive: 'text-state-confirmed',
    warning: 'text-state-noreply',
    critical: 'text-state-disputed',
  }[tone];

  return (
    <div className={cn('flex flex-col gap-1 rounded-card border border-border bg-surface p-4', className)}>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className={cn('text-3xl leading-none font-semibold tracking-tight', toneClass)}>{value}</p>
      {hint ? <p className="text-sm text-ink-muted">{hint}</p> : null}
    </div>
  );
}

/**
 * Confirmation rate as a bar.
 *
 * The number is always printed as well as the bar: a bar alone is unreadable at
 * a glance, and this is the figure a supervisor is asked about.
 */
export function RateBar({ confirmed, total, className }: { confirmed: number; total: number; className?: string }) {
  const rate = total === 0 ? 0 : confirmed / total;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm text-ink-muted">Confirmed by workers</p>
        <p className="text-sm font-semibold text-ink">
          {confirmed}/{total}
          {total > 0 ? <span className="ml-1 font-normal text-ink-muted">{Math.round(rate * 100)}%</span> : null}
        </p>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-bg"
        role="img"
        aria-label={`${confirmed} of ${total} workers confirmed`}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-150',
            rate === 1 ? 'bg-state-confirmed' : rate >= 0.6 ? 'bg-primary' : 'bg-state-noreply',
          )}
          style={{ width: `${Math.round(rate * 100)}%` }}
        />
      </div>
    </div>
  );
}
