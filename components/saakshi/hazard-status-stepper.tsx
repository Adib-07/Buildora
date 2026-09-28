import { Check } from "lucide-react";

import type { HazardStatus } from "@/contracts";
import { cn } from "@/lib/ui/utils";

const STEPS: { key: HazardStatus; label: string }[] = [
  { key: "reported", label: "Reported" },
  { key: "assigned", label: "Assigned" },
  { key: "fixed_awaiting_reporter", label: "Fixed, awaiting reporter" },
  { key: "closed", label: "Closed" },
];

// 'closed_unverified' and 'reopened' branch off the four staged steps
// rather than adding new ones, each called out with its own badge so the
// stepper stays a single, always-forward-reading line.
function stepIndex(status: HazardStatus): number {
  if (status === "closed_unverified") return 3;
  if (status === "reopened") return 1;
  return STEPS.findIndex((s) => s.key === status);
}

export function HazardStatusStepper({ status, className }: { status: HazardStatus; className?: string }) {
  const current = stepIndex(status);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <ol className="flex items-start">
        {STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={step.key} className="flex flex-1 flex-col items-center gap-1.5 text-center last:flex-none">
              <div className="flex w-full items-center">
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold",
                    done && "border-state-confirmed bg-state-confirmed text-white",
                    active && "border-primary bg-primary text-white",
                    !done && !active && "border-border bg-surface text-ink-muted"
                  )}
                  aria-hidden="true"
                >
                  {done ? <Check className="size-4" /> : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn("h-0.5 flex-1", i < current ? "bg-state-confirmed" : "bg-border")} />
                )}
              </div>
              <span className={cn("max-w-20 text-sm", active ? "font-semibold text-ink" : "text-ink-muted")}>{step.label}</span>
            </li>
          );
        })}
      </ol>
      {status === "closed_unverified" && (
        <p className="text-sm text-state-noreply">Closed without reporter confirmation.</p>
      )}
      {status === "reopened" && <p className="text-sm text-state-disputed">Reopened after closing.</p>}
    </div>
  );
}
