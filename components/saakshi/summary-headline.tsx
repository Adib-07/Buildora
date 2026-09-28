import { Lock, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/ui/utils";

export function SummaryHeadline({
  confirmed,
  total,
  locked,
  amended,
  className,
}: {
  confirmed: number;
  total: number;
  locked: boolean;
  amended: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <p className="text-3xl font-semibold tabular-nums">
        {confirmed} of {total} confirmed
      </p>
      {locked && (
        <Badge variant="outline">
          <Lock data-icon="inline-start" />
          Locked
        </Badge>
      )}
      {amended && (
        <Badge variant="outline" className="border-state-noreply text-state-noreply">
          <Pencil data-icon="inline-start" />
          Amended
        </Badge>
      )}
    </div>
  );
}
