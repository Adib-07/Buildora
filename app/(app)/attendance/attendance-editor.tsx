"use client";

import { useActionState } from "react";
import { Loader2Icon, SaveIcon } from "lucide-react";

import { updateAttendance } from "@/app/actions";
import { IDLE, messageFor, type ActionState } from "@/app/action-state";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AttendanceRecord } from "@/contracts";

const HOURS = [0, 1, 2, 2.5, 3, 4, 4.5, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 11, 12];

/**
 * Supervisor's edit form for one attendance record.
 *
 * `expectedVersion` is carried in a hidden field rather than trusted from the
 * rendered value: the server compares it against the row and rejects a stale
 * edit with 409. That is what stops two supervisors on the same shift quietly
 * overwriting each other.
 *
 * The form is only rendered for a supervisor -- the page decides that from the
 * session role, and the action re-checks it. A hidden form would be a UI
 * affordance, not a control.
 */
export function AttendanceEditor({
  record,
  disabled,
  disabledReason,
}: {
  record: AttendanceRecord;
  disabled: boolean;
  disabledReason?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateAttendance,
    IDLE,
  );

  if (disabled) {
    return (
      <p className="text-sm text-ink-muted">
        {disabledReason ?? 'Read only.'}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="recordId" value={record.id} />
      <input type="hidden" name="expectedVersion" value={record.version} />

      <div aria-live="polite" aria-atomic="true">
        {state?.status === "error" ? (
          <p role="alert" className="text-sm text-state-disputed">
            {messageFor(state)}
          </p>
        ) : null}
        {state?.status === "ok" ? (
          <p className="text-sm text-state-confirmed">{state.message}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-32 flex-col gap-1">
          <label
            htmlFor={`status-${record.id}`}
            className="text-sm text-ink-muted"
          >
            Status
          </label>
          <Select name="status" defaultValue={record.status}>
            <SelectTrigger id={`status-${record.id}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="present">Present</SelectItem>
              <SelectItem value="half_day">Half day</SelectItem>
              <SelectItem value="absent">Absent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-w-28 flex-col gap-1">
          <label htmlFor={`hours-${record.id}`} className="text-sm text-ink-muted">
            Hours
          </label>
          <Select name="hours" defaultValue={String(record.hours)}>
            <SelectTrigger id={`hours-${record.id}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((hours) => (
                <SelectItem key={hours} value={String(hours)}>
                  {hours}h
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm text-ink-muted">Late</span>
          <label className="flex h-12 min-w-20 cursor-pointer items-center gap-2 rounded-control border border-input bg-surface px-3">
            <input
              type="checkbox"
              name="late"
              value="true"
              defaultChecked={record.late}
              className="size-4 accent-primary"
            />
            <span className="text-sm text-ink">{record.late ? "Yes" : "No"}</span>
          </label>
        </div>

        <Button type="submit" disabled={pending} className="ml-auto">
          {pending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          Save
        </Button>
      </div>
    </form>
  );
}
