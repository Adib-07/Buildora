"use client";

import { useActionState, useState } from "react";
import { Loader2Icon, PlusIcon, UserPlusIcon } from "lucide-react";

import { addWorker, editWorker } from "@/app/actions";
import { IDLE, messageFor, type ActionState } from "@/app/action-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Team, Worker } from "@/contracts";

/**
 * Add a worker to the roster.
 *
 * The phone is typed the way it is read out on site ("98765 43210") and
 * normalised to E.164 server-side, because requiring a supervisor to type "+91"
 * by hand is a good way to get a digit wrong. Consent starts as pending: it is
 * not Buildora's to grant on the worker's behalf.
 */
export function AddWorkerButton({ teams }: { teams: Team[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(addWorker, IDLE);

  if (teams.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        A worker needs a team, and this site has none yet.
      </p>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <UserPlusIcon />
          Add worker
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add a worker</SheetTitle>
        </SheetHeader>
        <form action={formAction} className="flex flex-col gap-4 p-4">
          <div aria-live="polite" aria-atomic="true">
            {state?.status === "error" ? (
              <p role="alert" className="text-sm text-state-disputed">
                {messageFor(state)}
                {state.fields?.phone ? `: ${state.fields.phone}` : ""}
              </p>
            ) : null}
            {state?.status === "ok" ? (
              <p className="text-sm text-state-confirmed">{state.message}</p>
            ) : null}
          </div>

          <Field label="Full name" error={state?.fields?.fullName}>
            <Input name="fullName" required minLength={2} maxLength={60} autoFocus />
          </Field>

          <Field label="Phone" error={state?.fields?.phone} hint="10 digits. Spaces and +91 are fine.">
            <Input name="phone" required inputMode="tel" placeholder="98765 43210" />
          </Field>

          <Field label="Team" error={state?.fields?.teamId}>
            <Select name="teamId">
              <SelectTrigger>
                <SelectValue placeholder="Choose a team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Language" hint="The language their SMS is sent in.">
            <Select name="lang" defaultValue="en">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="te">తెలుగు (Telugu)</SelectItem>
                <SelectItem value="hi">हिन्दी (Hindi)</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Button type="submit" disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
            Add to roster
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/** Change a worker's team, language or active status. */
export function EditWorkerForm({ worker, teams }: { worker: Worker; teams: Team[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(editWorker, IDLE);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="workerId" value={worker.id} />

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

      <Field label="Team">
        <Select name="teamId" defaultValue={worker.teamId ?? "none"}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No team</SelectItem>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Language">
        <Select name="lang" defaultValue={worker.lang}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="te">తెలుగు (Telugu)</SelectItem>
            <SelectItem value="hi">हिन्दी (Hindi)</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="active"
          value="true"
          defaultChecked={worker.active}
          className="size-4 accent-primary"
        />
        On the roster
      </label>

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        Save
      </Button>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="text-sm text-state-disputed">
          {error}
        </span>
      ) : hint ? (
        <span className="text-sm text-ink-muted">{hint}</span>
      ) : null}
    </div>
  );
}
