"use client";

import { useEffect, useRef, useState } from "react";
import { CircleCheck, CircleX, Minus } from "lucide-react";

import { cn } from "@/lib/ui/utils";

import { contrastRatio, toRgb } from "./colour";

type Kind = "text" | "ui" | "decorative";

// text: foreground colour on background, needs 4.5:1.
// ui: border colour on the surface it sits on, needs 3:1 (WCAG 1.4.11).
const CHECKS: { id: string; label: string; className: string; kind: Kind }[] = [
  { id: "ink-bg", label: "ink on bg", className: "bg-bg text-ink", kind: "text" },
  { id: "ink-surface", label: "ink on surface", className: "bg-surface text-ink", kind: "text" },
  { id: "muted-bg", label: "ink-muted on bg", className: "bg-bg text-ink-muted", kind: "text" },
  { id: "muted-surface", label: "ink-muted on surface", className: "bg-surface text-ink-muted", kind: "text" },
  { id: "on-primary", label: "white on primary", className: "bg-primary text-primary-foreground", kind: "text" },
  { id: "primary-surface", label: "primary on surface", className: "bg-surface text-primary", kind: "text" },
  { id: "primary-bg", label: "primary on bg", className: "bg-bg text-primary", kind: "text" },
  { id: "primary-soft", label: "primary on primary-soft", className: "bg-primary-soft text-primary", kind: "text" },
  { id: "ink-soft", label: "ink on primary-soft", className: "bg-primary-soft text-ink", kind: "text" },
  { id: "confirmed", label: "confirmed on confirmed-bg", className: "bg-state-confirmed-bg text-state-confirmed", kind: "text" },
  { id: "disputed", label: "disputed on disputed-bg", className: "bg-state-disputed-bg text-state-disputed", kind: "text" },
  { id: "noreply", label: "no reply on noreply-bg", className: "bg-state-noreply-bg text-state-noreply", kind: "text" },
  { id: "confirmed-surface", label: "confirmed on surface", className: "bg-surface text-state-confirmed", kind: "text" },
  { id: "disputed-surface", label: "disputed on surface", className: "bg-surface text-state-disputed", kind: "text" },
  { id: "noreply-surface", label: "no reply on surface", className: "bg-surface text-state-noreply", kind: "text" },
  { id: "noreply-bg", label: "no reply on bg", className: "bg-bg text-state-noreply", kind: "text" },
  { id: "sev3", label: "severity 3 on surface", className: "bg-surface text-severity-3", kind: "text" },
  { id: "sev2", label: "severity 2 on surface", className: "bg-surface text-severity-2", kind: "text" },
  { id: "sev2-bg", label: "severity 2 on bg", className: "bg-bg text-severity-2", kind: "text" },
  { id: "sev1", label: "severity 1 on surface", className: "bg-surface text-severity-1", kind: "text" },
  { id: "on-sev3", label: "white on severity 3", className: "bg-severity-3 text-white", kind: "text" },
  { id: "on-sev2", label: "white on severity 2", className: "bg-severity-2 text-white", kind: "text" },
  { id: "on-sev1", label: "white on severity 1", className: "bg-severity-1 text-white", kind: "text" },
  { id: "on-ink", label: "white on ink (tooltip)", className: "bg-ink text-white", kind: "text" },
  { id: "input-surface", label: "input border on surface", className: "bg-surface border-input", kind: "ui" },
  { id: "focus-bg", label: "focus ring on bg", className: "bg-bg border-focus", kind: "ui" },
  { id: "focus-surface", label: "focus ring on surface", className: "bg-surface border-focus", kind: "ui" },
  { id: "focus-soft", label: "focus ring on primary-soft", className: "bg-primary-soft border-focus", kind: "ui" },
  { id: "border-surface", label: "border on surface", className: "bg-surface border-border", kind: "decorative" },
];

const MINIMUM: Record<Kind, number | null> = { text: 4.5, ui: 3, decorative: null };

export function ContrastTable() {
  const ref = useRef<HTMLUListElement>(null);
  const [ratios, setRatios] = useState<Record<string, number>>({});

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measured: Record<string, number> = {};
    for (const sample of root.querySelectorAll<HTMLElement>("[data-check]")) {
      const id = sample.dataset.check;
      if (!id) continue;
      const style = getComputedStyle(sample);
      const foreground = sample.dataset.kind === "text" ? style.color : style.borderTopColor;
      measured[id] = contrastRatio(toRgb(foreground), toRgb(style.backgroundColor));
    }
    setRatios(measured);
  }, []);

  return (
    <ul ref={ref} className="grid gap-2 lg:grid-cols-2">
      {CHECKS.map((check) => {
        const ratio = ratios[check.id];
        const minimum = MINIMUM[check.kind];
        return (
          <li
            key={check.id}
            className="grid grid-cols-[4rem_1fr] items-center gap-x-3 gap-y-1 rounded-control border border-border bg-surface px-3 py-2 sm:grid-cols-[4rem_1fr_auto]"
          >
            {check.kind === "text" ? (
              <span
                data-check={check.id}
                data-kind={check.kind}
                className={cn("rounded-control px-2 py-1 text-center font-semibold", check.className)}
              >
                Aa 36
              </span>
            ) : (
              <span
                data-check={check.id}
                data-kind={check.kind}
                aria-hidden="true"
                className={cn("h-8 rounded-control border-3", check.className)}
              />
            )}
            <span className="min-w-0">{check.label}</span>
            <span className="col-start-2 flex items-center gap-3 sm:col-start-auto">
              <span className="min-w-16 font-semibold tabular-nums">
                {ratio ? `${ratio.toFixed(2)}:1` : ""}
              </span>
              <Verdict ratio={ratio} minimum={minimum} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Verdict({ ratio, minimum }: { ratio: number | undefined; minimum: number | null }) {
  if (minimum === null) {
    return (
      <span className="flex w-28 items-center gap-1.5 text-sm text-ink-muted">
        <Minus className="size-4 shrink-0" />
        Decoration
      </span>
    );
  }
  if (ratio === undefined) return <span className="w-28" />;
  const pass = ratio >= minimum;
  return (
    <span
      className={cn(
        "flex w-28 items-center gap-1.5 text-sm font-semibold",
        pass ? "text-state-confirmed" : "text-state-disputed"
      )}
    >
      {pass ? <CircleCheck className="size-4 shrink-0" /> : <CircleX className="size-4 shrink-0" />}
      {pass ? "Pass" : "Fail"} {minimum}:1
    </span>
  );
}
