import { CircleCheck, Clock, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/ui/utils";

const SEGMENTS = [
  { key: "confirmed", label: "Confirmed", icon: CircleCheck, bar: "bg-state-confirmed", fg: "text-state-confirmed" },
  { key: "disputed", label: "Disputed", icon: TriangleAlert, bar: "bg-state-disputed", fg: "text-state-disputed" },
  { key: "noReply", label: "No reply", icon: Clock, bar: "bg-state-noreply", fg: "text-state-noreply" },
] as const;

/**
 * A stacked bar plus a legend. The bar itself is decorative (its
 * proportions repeat what the legend already states in text), so it is
 * hidden from assistive tech and carries one combined aria-label instead of
 * per-segment labels.
 */
export function ConfirmationBar({
  confirmed,
  disputed,
  noReply,
  className,
}: {
  confirmed: number;
  disputed: number;
  noReply: number;
  className?: string;
}) {
  const counts = { confirmed, disputed, noReply };
  const total = confirmed + disputed + noReply;
  const summary = `${confirmed} confirmed, ${disputed} disputed, ${noReply} no reply, out of ${total}`;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div role="img" aria-label={summary} className="flex h-3 w-full overflow-hidden rounded-full bg-border">
        {SEGMENTS.map(({ key, bar }) => {
          const value = counts[key];
          if (value === 0) return null;
          return <div key={key} className={bar} style={{ width: `${(value / (total || 1)) * 100}%` }} />;
        })}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
        {SEGMENTS.map(({ key, label, icon: Icon, fg }) => (
          <li key={key} className={cn("flex items-center gap-1.5 text-sm font-medium", fg)}>
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {label} <span className="tabular-nums">{counts[key]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
