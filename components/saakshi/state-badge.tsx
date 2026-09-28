import { CircleCheck, Clock, TriangleAlert } from "lucide-react";

import type { WorkerState } from "@/contracts";
import { cn } from "@/lib/ui/utils";

// Icon + word + colour, never colour alone. These three icons are reserved
// for worker state exclusively, everywhere in the app, so a glance always
// means the same thing: TriangleAlert is always "Disputed", never a generic
// warning.
const CONFIG: Record<WorkerState, { label: string; icon: typeof CircleCheck; fg: string; bg: string }> = {
  confirmed: { label: "Confirmed", icon: CircleCheck, fg: "text-state-confirmed", bg: "bg-state-confirmed-bg" },
  disputed: { label: "Disputed", icon: TriangleAlert, fg: "text-state-disputed", bg: "bg-state-disputed-bg" },
  no_reply: { label: "No reply", icon: Clock, fg: "text-state-noreply", bg: "bg-state-noreply-bg" },
};

export function StateBadge({
  state,
  size = "default",
  className,
}: {
  state: WorkerState;
  size?: "default" | "sm";
  className?: string;
}) {
  const { label, icon: Icon, fg, bg } = CONFIG[state];
  return (
    <span
      className={cn(
        // Text stays 14px at every size; "sm" only trims padding and the icon.
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full text-sm font-medium whitespace-nowrap",
        size === "default" ? "px-2.5 py-1" : "px-2 py-0.5",
        fg,
        bg,
        className
      )}
    >
      <Icon className={cn("shrink-0", size === "default" ? "size-4" : "size-3.5")} aria-hidden="true" />
      {label}
    </span>
  );
}
