"use client";

import { OctagonAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { AttStatus } from "@/contracts";

import { AttStatusSegmented, HoursStepper, LateToggle } from "./attendance-fields";

/**
 * A controlled bottom sheet: the caller owns the draft status/late/hours
 * (typically local state seeded from the day's record) and this component
 * only renders the editor and reports changes back up.
 */
export function AttendanceSheet({
  open,
  onOpenChange,
  workerName,
  teamName,
  status,
  late,
  hours,
  onStatusChange,
  onLateChange,
  onHoursChange,
  onSave,
  saving = false,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerName: string;
  teamName?: string | null;
  status: AttStatus;
  late: boolean;
  hours: number;
  onStatusChange: (status: AttStatus) => void;
  onLateChange: (late: boolean) => void;
  onHoursChange: (hours: number) => void;
  onSave: () => void;
  saving?: boolean;
  error?: string;
}) {
  const absent = status === "absent";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{workerName}</SheetTitle>
          {teamName && <SheetDescription>{teamName}</SheetDescription>}
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4">
          <AttStatusSegmented value={status} onChange={onStatusChange} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-medium text-ink">Hours worked</span>
            <HoursStepper value={hours} onChange={onHoursChange} disabled={absent} />
          </div>

          <LateToggle checked={late} onChange={onLateChange} disabled={absent} className="self-start" />

          {error && (
            <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-state-disputed">
              <OctagonAlert className="size-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
        </div>

        <SheetFooter>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
