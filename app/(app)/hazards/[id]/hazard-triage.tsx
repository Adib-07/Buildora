"use client";

import { useActionState, useState } from "react";
import { Loader2Icon, SaveIcon } from "lucide-react";

import { triageHazard } from "@/app/actions";
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
import type { Hazard, Worker } from "@/contracts";

/**
 * Triage one hazard: how bad is it, what is it, and who is dealing with it.
 *
 * Severity and owner are the two decisions that matter -- an unjudged severity
 * means nobody knows whether to stop work. Assigning an owner also moves a
 * freshly reported hazard to `assigned`, which is what the database requires
 * before a card can be considered picked up.
 */
export function HazardTriage({
  hazard,
  workers,
}: {
  hazard: Hazard;
  workers: Worker[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    triageHazard,
    IDLE,
  );
  const [ownerKey, setOwnerKey] = useState(
    hazard.owner ? `${hazard.owner.type}:${hazard.owner.id}` : "none",
  );

  const [ownerType, ownerId] =
    ownerKey === "none" ? ["", ""] : ownerKey.split(":");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="hazardId" value={hazard.id} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="severity" className="text-sm text-ink-muted">
            Severity
          </label>
          <Select name="severity" defaultValue={hazard.severity ? String(hazard.severity) : "unset"}>
            <SelectTrigger id="severity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 — Low</SelectItem>
              <SelectItem value="2">2 — Medium</SelectItem>
              <SelectItem value="3">3 — High</SelectItem>
              <SelectItem value="unset" disabled>
                Not triaged
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="owner" className="text-sm text-ink-muted">
            Owner
          </label>
          <Select name="ownerChoice" value={ownerKey} onValueChange={setOwnerKey}>
            <SelectTrigger id="owner">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No owner</SelectItem>
              {workers.map((worker) => (
                <SelectItem key={worker.id} value={`worker:${worker.id}`}>
                  {worker.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* The Select is uncontrolled from the form's point of view, so the
              choice is mirrored into two hidden fields the action validates. */}
          <input type="hidden" name="ownerType" value={ownerType} />
          <input type="hidden" name="ownerId" value={ownerId} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="category" className="text-sm text-ink-muted">
          Type
        </label>
        <Select name="category" defaultValue={hazard.category}>
          <SelectTrigger id="category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fall_edge">Fall or open edge</SelectItem>
            <SelectItem value="electrical">Electrical</SelectItem>
            <SelectItem value="excavation">Excavation</SelectItem>
            <SelectItem value="scaffold">Scaffold</SelectItem>
            <SelectItem value="machinery">Machinery</SelectItem>
            <SelectItem value="fire">Fire</SelectItem>
            <SelectItem value="housekeeping">Housekeeping</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="locationText" className="text-sm text-ink-muted">
          Where
        </label>
        <Input
          id="locationText"
          name="locationText"
          maxLength={200}
          defaultValue={hazard.locationText ?? ""}
          placeholder="Block B floor 3"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="summary" className="text-sm text-ink-muted">
          What is wrong
        </label>
        <Textarea
          id="summary"
          name="summary"
          rows={2}
          maxLength={500}
          required
          defaultValue={hazard.summary}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="dueAt" className="text-sm text-ink-muted">
          Due by
        </label>
        <Input
          id="dueAt"
          name="dueAt"
          type="datetime-local"
          defaultValue={hazard.dueAt ? hazard.dueAt.slice(0, 16) : ""}
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
        {pending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
        Save triage
      </Button>
    </form>
  );
}
