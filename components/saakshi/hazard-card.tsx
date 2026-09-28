import { ChevronRight, Info, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Hazard } from "@/contracts";
import { formatRelativeAge } from "@/lib/ui/format";
import { cn } from "@/lib/ui/utils";

import { SeverityBadge } from "./severity-badge";

const CATEGORY_LABEL: Record<Hazard["category"], string> = {
  fall_edge: "Fall / edge",
  electrical: "Electrical",
  excavation: "Excavation",
  scaffold: "Scaffold",
  machinery: "Machinery",
  fire: "Fire",
  housekeeping: "Housekeeping",
  other: "Other",
};

const STATUS_LABEL: Record<Hazard["status"], string> = {
  reported: "Reported",
  assigned: "Assigned",
  fixed_awaiting_reporter: "Fixed, awaiting reporter",
  closed: "Closed",
  closed_unverified: "Closed (unverified)",
  reopened: "Reopened",
};

export function HazardCard({
  hazard,
  onPress,
  className,
}: {
  hazard: Pick<
    Hazard,
    "code" | "category" | "locationText" | "severity" | "summary" | "status" | "owner" | "reporterCount" | "createdAt" | "aiStatus"
  >;
  onPress?: () => void;
  className?: string;
}) {
  const rowClassName = cn("flex w-full flex-col gap-3 rounded-card border border-border bg-surface p-4 text-left shadow-sm", className);

  const content = (
    <>
      {hazard.aiStatus === "fallback" && (
        <p className="flex items-center gap-1.5 text-sm text-ink-muted">
          <Info className="size-4 shrink-0" aria-hidden="true" />
          AI unavailable — raw report
        </p>
      )}

      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-ink">{hazard.code}</p>
        <div className="flex shrink-0 items-center gap-2">
          <SeverityBadge severity={hazard.severity} />
          {onPress && <ChevronRight className="size-5 text-ink-muted" aria-hidden="true" />}
        </div>
      </div>

      <p className="text-sm text-ink-muted">
        {CATEGORY_LABEL[hazard.category]} · {hazard.locationText ?? "No location given"}
      </p>

      <p className="line-clamp-2 text-ink">{hazard.summary}</p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
        <Badge variant="outline">{STATUS_LABEL[hazard.status]}</Badge>
        <span className="flex items-center gap-1.5">
          <Users className="size-4 shrink-0" aria-hidden="true" />
          {hazard.reporterCount}
        </span>
        <span>{formatRelativeAge(hazard.createdAt)}</span>
        <span>{hazard.owner ? hazard.owner.name : <span className="italic">Unassigned</span>}</span>
      </div>
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
