import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { AttStatus, DisputeStatus } from "@/contracts";
import { formatRelativeAge } from "@/lib/ui/format";
import { cn } from "@/lib/ui/utils";

const ATT_STATUS_LABEL: Record<AttStatus, string> = {
  present: "Present",
  absent: "Absent",
  half_day: "Half-day",
};

const OUTCOME: Record<DisputeStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "border-state-disputed text-state-disputed" },
  corrected: { label: "Corrected", className: "border-state-confirmed text-state-confirmed" },
  upheld: { label: "Upheld", className: "border-border text-ink-muted" },
  escalated: { label: "Escalated", className: "border-state-noreply text-state-noreply" },
};

export function DisputeCard({
  workerName,
  reasonText,
  record,
  status,
  createdAt,
  resolutionNote,
  onPress,
  className,
}: {
  workerName: string;
  reasonText: string | null;
  record: { status: AttStatus; hours: number; late: boolean };
  status: DisputeStatus;
  createdAt: string;
  resolutionNote?: string | null;
  onPress?: () => void;
  className?: string;
}) {
  const outcome = OUTCOME[status];
  const rowClassName = cn(
    "flex w-full flex-col gap-2 rounded-card border border-l-4 border-border bg-surface p-4 text-left shadow-sm",
    status === "open" ? "border-l-state-disputed" : "border-l-border",
    className
  );

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-ink">{workerName}</p>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className={outcome.className}>
            {outcome.label}
          </Badge>
          {onPress && <ChevronRight className="size-5 text-ink-muted" aria-hidden="true" />}
        </div>
      </div>

      <p className="text-sm text-ink-muted">
        {reasonText ? <span>&ldquo;{reasonText}&rdquo;</span> : <span className="italic">No reason given.</span>}
      </p>

      <p className="text-sm text-ink-muted">
        Recorded: {ATT_STATUS_LABEL[record.status]}, <span className="tabular-nums">{record.hours}h</span>
        {record.late && ", late"}
      </p>

      {status !== "open" && resolutionNote && <p className="text-sm text-ink-muted">Note: {resolutionNote}</p>}

      <p className="text-sm text-ink-muted">{formatRelativeAge(createdAt)}</p>
    </>
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
