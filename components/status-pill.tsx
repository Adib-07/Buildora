import { cn } from "@/lib/ui/utils";

/**
 * Status pill with a live pulse dot.
 *
 * The roster is read by scanning a column of these, so each state gets exactly
 * one meaning and one colour, and the colour is the only saturated thing on the
 * row. `live` pulses the dot to mark a state that is still moving — a reply
 * outstanding, a webhook in flight — and is never used for a settled state.
 *
 * The label always carries the meaning in words as well as colour, so the
 * column is still readable in monochrome, in print, and by someone who cannot
 * separate the hues. That is why there is no icon-only variant.
 */

const TONES = {
  confirmed: {
    text: "text-state-confirmed",
    bg: "bg-state-confirmed-bg",
    border: "border-state-confirmed/25",
  },
  disputed: {
    text: "text-state-disputed",
    bg: "bg-state-disputed-bg",
    border: "border-state-disputed/25",
  },
  pending: {
    text: "text-state-noreply",
    bg: "bg-state-noreply-bg",
    border: "border-state-noreply/25",
  },
  geofence: {
    text: "text-state-geofence",
    bg: "bg-primary-soft",
    border: "border-state-geofence/25",
  },
  neutral: {
    text: "text-ink-muted",
    bg: "bg-surface-raised",
    border: "border-border",
  },
} as const;

export type StatusTone = keyof typeof TONES;

export function StatusPill({
  tone = "neutral",
  live = false,
  children,
  className,
}: {
  tone?: StatusTone;
  /** Pulse the dot. Reserve for a state that is still moving. */
  live?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const styles = TONES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-sm font-medium whitespace-nowrap",
        styles.bg,
        styles.border,
        styles.text,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("status-dot", live && "status-dot-live")}
      />
      {children}
    </span>
  );
}

/**
 * Dense data grid.
 *
 * Built for reading down a column rather than across a row, which is how a
 * supervisor compares shifts: sticky header, hairline row rules, no zebra
 * striping (it fights the status colours), and a numeric column that is right
 * aligned with tabular figures so the decimal points line up.
 *
 * The numeric alignment is the part that usually goes wrong -- a right-aligned
 * column of proportional digits looks like a ragged edge and is much slower to
 * scan than a monospaced one.
 */
export function DataGrid({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  /** Describes the grid for assistive tech; the caption is not shown. */
  label: string;
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-card border border-border bg-surface",
        className,
      )}
    >
      <table className="w-full border-collapse text-sm" aria-label={label}>
        {children}
      </table>
    </div>
  );
}

export function GridHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-surface-raised">
      <tr className="border-b border-border">{children}</tr>
    </thead>
  );
}

export function GridHeadCell({
  children,
  numeric = false,
  className,
  ...props
}: React.ComponentProps<"th"> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      data-numeric={numeric || undefined}
      className={cn(
        "px-3 py-2 text-left text-sm font-medium tracking-wide text-ink-muted uppercase",
        numeric && "text-right",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function GridRow({
  children,
  className,
  ...props
}: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "border-b border-border/60 transition-colors last:border-b-0 hover:bg-surface-raised",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function GridCell({
  children,
  numeric = false,
  className,
  ...props
}: React.ComponentProps<"td"> & { numeric?: boolean }) {
  return (
    <td
      data-numeric={numeric || undefined}
      className={cn(
        "px-3 py-2.5 align-middle text-ink",
        numeric && "text-right font-mono text-sm",
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

/**
 * Key figure with a unit. The number is monospaced and the unit is not, because
 * the number is what gets compared down a column.
 */
export function Metric({
  label,
  value,
  unit,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  tone?: "neutral" | "confirmed" | "disputed" | "pending";
}) {
  const valueTone = {
    neutral: "text-ink",
    confirmed: "text-state-confirmed",
    disputed: "text-state-disputed",
    pending: "text-state-noreply",
  }[tone];

  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-card border border-border bg-surface px-3 py-2.5">
      <p className="truncate text-sm text-ink-muted">{label}</p>
      <p className="flex items-baseline gap-1">
        <span
          data-numeric
          className={cn("font-mono text-2xl leading-none font-semibold", valueTone)}
        >
          {value}
        </span>
        {unit ? <span className="text-sm text-ink-muted">{unit}</span> : null}
      </p>
      {hint ? <p className="truncate text-sm text-ink-muted">{hint}</p> : null}
    </div>
  );
}
