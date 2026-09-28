import { SkeletonBlock, SkeletonRows } from "@/components/feedback";

/**
 * Route-level loading state.
 *
 * `aria-busy` and a live region so a screen reader hears that something is
 * loading rather than silence. The skeleton mirrors the shape of a real screen
 * — headline, figures, list — so the page does not jump when the data lands.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-col gap-2">
        <div className="h-7 w-48 rounded bg-border" aria-hidden="true" />
        <div className="h-4 w-72 rounded bg-bg" aria-hidden="true" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonBlock key={i} className="h-24" />
        ))}
      </div>
      <SkeletonRows rows={4} />
    </div>
  );
}
