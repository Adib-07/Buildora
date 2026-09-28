"use client";

import { useActionState, useState } from "react";
import { Loader2Icon } from "lucide-react";

import { resolveDisputeAction } from "@/app/actions";
import { IDLE, messageFor, type ActionState } from "@/app/action-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DisputeDetail } from "@/contracts";

/**
 * Resolve a dispute, as either decision.
 *
 * `corrected` writes the supervisor's values onto the record and marks the
 * worker as agreeing with them. `upheld` leaves the record alone and keeps the
 * reason. Both require a note -- an upheld dispute with no note is rejected by
 * the database, because "we were right" with no explanation is not a decision
 * anyone can audit.
 */
export function DisputeResolver({ dispute }: { dispute: DisputeDetail }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    resolveDisputeAction,
    IDLE,
  );
  const [outcome, setOutcome] = useState<"corrected" | "upheld">("corrected");

  if (dispute.status !== "open") {
    return (
      <p className="text-sm text-ink-muted">
        Resolved as <strong>{dispute.status}</strong>
        {dispute.resolutionNote ? ` — “${dispute.resolutionNote}”` : "."}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="disputeId" value={dispute.id} />
      <input type="hidden" name="outcome" value={outcome} />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">Decision</legend>
        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-control border border-border p-3">
            <input
              type="radio"
              name="outcomeChoice"
              value="corrected"
              checked={outcome === "corrected"}
              onChange={() => setOutcome("corrected")}
              className="mt-1 size-4 accent-primary"
            />
            <span>
              <span className="block font-medium text-ink">Correct the record</span>
              <span className="block text-sm text-ink-muted">
                The worker is right. Save the values below as the record of truth.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-control border border-border p-3">
            <input
              type="radio"
              name="outcomeChoice"
              value="upheld"
              checked={outcome === "upheld"}
              onChange={() => setOutcome("upheld")}
              className="mt-1 size-4 accent-primary"
            />
            <span>
              <span className="block font-medium text-ink">Keep the original record</span>
              <span className="block text-sm text-ink-muted">
                The record stands. Give the reason so it can be reviewed later.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      {outcome === "corrected" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="status" className="text-sm text-ink-muted">
              Status
            </label>
            <Select name="status" defaultValue={dispute.record.status}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="half_day">Half day</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="hours" className="text-sm text-ink-muted">
              Hours
            </label>
            <Input
              id="hours"
              name="hours"
              type="number"
              step="0.5"
              min="0"
              max="16"
              defaultValue={dispute.record.hours}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-ink-muted">Late</span>
            <label className="flex h-12 cursor-pointer items-center gap-2 rounded-control border border-input bg-surface px-3">
              <input
                type="checkbox"
                name="late"
                value="true"
                defaultChecked={dispute.record.late}
                className="size-4 accent-primary"
              />
              <span className="text-sm text-ink">Mark late</span>
            </label>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="note" className="text-sm text-ink-muted">
          Note {outcome === "upheld" ? "(required)" : "(optional)"}
        </label>
        <Textarea
          id="note"
          name="note"
          rows={2}
          maxLength={200}
          required={outcome === "upheld"}
          placeholder={
            outcome === "upheld"
              ? "Why the record stands as it is."
              : "Optional: what changed and why."
          }
        />
      </div>

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

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        Record decision
      </Button>
    </form>
  );
}
