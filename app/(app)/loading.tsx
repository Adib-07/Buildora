import { SkeletonBlock, SkeletonRows } from "@/components/feedback";

/**
 * Route-level loading state.
 *
 * `aria-busy` and a live region so a screen reader hears that something is
 * loading rather than silence.
 *
 * The skeleton mirrors the dashboard's real geometry -- a circular score ring
 * beside a column, then the two-column card grid -- so nothing jumps when the
 * data lands. A generic spinner or a stack of full-width bars reads as a
 * different page that is being replaced, which is exactly the flash this
 * replaces.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>

      {/* PageHeader: title + description, then actions on the right. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-48 rounded bg-border" aria-hidden="true" />
          <div className="h-4 w-72 rounded bg-bg" aria-hidden="true" />
        </div>
        <div className="flex gap-2" aria-hidden="true">
          <div className="h-9 w-24 rounded-control bg-bg" />
          <div className="h-9 w-32 rounded-control bg-bg" />
        </div>
      </div>

      {/* StatCard row: four equal tiles. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonBlock key={i} className="h-24" />
        ))}
      </div>

      {/* Readiness card (1fr) beside the disputes card (2fr): the ring is round
          and the meters are full-width bars, which a generic block would miss. */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div
          className="flex flex-col gap-6 rounded-card border border-border bg-card p-(--card-spacing)"
          aria-hidden="true"
        >
          <div className="flex items-center gap-6">
            <div className="size-28 shrink-0 rounded-full bg-bg" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-4 w-full rounded bg-bg" />
              <div className="h-4 w-4/5 rounded bg-bg" />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <div className="h-3 w-28 rounded bg-bg" />
                  <div className="h-3 w-10 rounded bg-bg" />
                </div>
                <div className="h-1.5 w-full rounded-full bg-bg" />
              </div>
            ))}
          </div>
        </div>
        <SkeletonBlock className="h-64" />
      </div>

      <SkeletonRows rows={4} />
    </div>
  );
}
