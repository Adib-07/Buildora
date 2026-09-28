import Link from "next/link";
import { ArrowRightIcon, CircleAlertIcon, CircleCheckIcon, CircleDotIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/ui/utils";

import type { Readiness } from "@/lib/domain/readiness";

/**
 * Shift readiness.
 *
 * The dashboard's headline number. It exists to answer one question the six
 * counters beneath it cannot: can this shift be closed and sent to payroll, and
 * if not, what is stopping it.
 *
 * A server component -- the score is already computed from the caller's own rows,
 * so there is nothing to fetch on the client and no loading state to design
 * around. Every component score is shown, because a single unexplained number is
 * worse than the counters it replaces: a supervisor should be able to check the
 * arithmetic against the queue it came from.
 */

const TONE = {
  ready: {
    ring: "stroke-state-confirmed",
    text: "text-state-confirmed",
    badge: "border-state-confirmed/30 bg-state-confirmed-bg text-state-confirmed",
    icon: CircleCheckIcon,
  },
  nearly: {
    ring: "stroke-state-noreply",
    text: "text-state-noreply",
    badge: "border-state-noreply/30 bg-state-noreply-bg text-state-noreply",
    icon: CircleDotIcon,
  },
  'at-risk': {
    ring: "stroke-state-disputed",
    text: "text-state-disputed",
    badge: "border-state-disputed/30 bg-state-disputed-bg text-state-disputed",
    icon: CircleAlertIcon,
  },
} as const;

const STATUS_TEXT = {
  good: "text-state-confirmed",
  attention: "text-state-noreply",
  critical: "text-state-disputed",
} as const;

/**
 * Score ring.
 *
 * An SVG circle rather than a progress library: it is one element, it inherits
 * currentColor, and it cannot ship a dependency that fights the theme.
 */
function ScoreRing({ score, className }: { score: number; className?: string }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  // 0 is drawn as a hairline rather than nothing, so the ring reads as a gauge
  // at 0 instead of looking like a rendering failure.
  const filled = Math.max(score, 2);

  return (
    <svg viewBox="0 0 100 100" className={cn("size-28 -rotate-90", className)} aria-hidden="true">
      <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="8" className="stroke-border" />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - filled / 100)}
        className="transition-[stroke-dashoffset] duration-700 ease-out"
      />
    </svg>
  );
}

export function ReadinessScore({ readiness }: { readiness: Readiness }) {
  const tone = TONE[readiness.band];
  const Icon = tone.icon;

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Shift readiness</CardTitle>
            <CardDescription>
              Can this shift be closed and sent to payroll?
            </CardDescription>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
              tone.badge,
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {readiness.band === 'ready'
              ? 'Ready to close'
              : readiness.band === 'nearly'
                ? 'Nearly ready'
                : 'At risk'}
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="relative flex size-28 shrink-0 items-center justify-center">
            <ScoreRing score={readiness.score} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-3xl leading-none font-semibold tracking-tight", tone.text)}>
                {readiness.score}
              </span>
              <span className="mt-0.5 text-xs text-ink-muted">out of 100</span>
            </div>
            {/* The ring is decorative; this is what a screen reader hears. */}
            <span className="sr-only">
              Shift readiness {readiness.score} out of 100. {readiness.headline}
            </span>
          </div>
          <p className="max-w-prose flex-1 text-sm text-ink-muted">{readiness.headline}</p>
        </div>

        <dl className="flex flex-col gap-3">
          {readiness.components.map((component) => (
            <div key={component.key} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm font-medium text-ink">{component.label}</dt>
                <dd className="flex items-baseline gap-2">
                  <span className="text-xs text-ink-muted">weight {component.weight}</span>
                  <span
                    className={cn("text-sm font-semibold tabular-nums", STATUS_TEXT[component.status])}
                  >
                    {component.score}
                  </span>
                </dd>
              </div>
              {/* A hairline meter per component: the relative widths are the
                  argument, and the number above carries the precision. */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-700 ease-out",
                    component.status === 'good'
                      ? "bg-state-confirmed"
                      : component.status === 'attention'
                        ? "bg-state-noreply"
                        : "bg-state-disputed",
                  )}
                  style={{ width: `${Math.max(component.score, 2)}%` }}
                />
              </div>
              <p className="text-xs text-ink-muted">{component.detail}</p>
            </div>
          ))}
        </dl>

        {readiness.improvements.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-card border border-border bg-bg p-4">
            <p className="text-sm font-semibold text-ink">What moves the number</p>
            <ul className="flex flex-col gap-2">
              {readiness.improvements.map((item) => (
                <li key={item.action} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <Link
                    href={item.href}
                    className="-mx-1 inline-flex min-h-9 items-center rounded-control px-1 font-medium text-primary underline underline-offset-4"
                  >
                    {item.action}
                  </Link>
                  <span className="text-sm text-ink-muted">{item.because}</span>
                  <span className="text-xs text-ink-muted tabular-nums">
                    +{item.potential} pts
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="text-xs text-ink-muted">
          Calculated from this site&rsquo;s live records for today.{" "}
          <Link href="/attendance" className="underline underline-offset-4 hover:text-primary">
            Check the underlying numbers
          </Link>
          <ArrowRightIcon className="ml-1 inline size-3" data-icon="inline-end" />
        </p>
      </CardContent>
    </Card>
  );
}
