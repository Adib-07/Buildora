import { OctagonAlert } from "lucide-react";

import type { Severity } from "@/contracts";
import { cn } from "@/lib/ui/utils";

// The number is always in the text, never colour alone: "Severity 3" reads
// the same to a colourblind supervisor as to anyone else.
const TONE: Record<Severity, string> = {
  3: "text-severity-3",
  2: "text-severity-2",
  1: "text-severity-1",
};

export function SeverityBadge({ severity, className }: { severity: Severity | null; className?: string }) {
  if (severity === null) {
    return (
      <span className={cn("inline-flex w-fit items-center rounded-full border border-border px-2.5 py-1 text-sm font-medium text-ink-muted", className)}>
        Not triaged
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-medium whitespace-nowrap",
        "border-current",
        TONE[severity],
        className
      )}
    >
      <OctagonAlert className="size-4 shrink-0" aria-hidden="true" />
      Severity {severity}
    </span>
  );
}
