"use client";

import { useState } from "react";
import { OctagonAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AttStatus, ResolveDisputeRequest } from "@/contracts";

import { AttStatusSegmented, HoursStepper, LateToggle } from "./attendance-fields";

const NOTE_MAX = 200;
const UPHELD_NOTE_MIN = 3;

export function ResolveDisputeForm({
  initialRecord,
  onSubmit,
  submitting = false,
  error,
  className,
}: {
  initialRecord: { status: AttStatus; hours: number; late: boolean };
  onSubmit: (result: ResolveDisputeRequest) => void;
  submitting?: boolean;
  error?: string;
  className?: string;
}) {
  const [outcome, setOutcome] = useState<"corrected" | "upheld">("corrected");
  const [status, setStatus] = useState(initialRecord.status);
  const [hours, setHours] = useState(initialRecord.hours);
  const [late, setLate] = useState(initialRecord.late);
  const [note, setNote] = useState("");
  const [attempted, setAttempted] = useState(false);

  const noteTooShort = outcome === "upheld" && note.trim().length < UPHELD_NOTE_MIN;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAttempted(true);
    if (noteTooShort) return;
    onSubmit(
      outcome === "corrected"
        ? { outcome, status, hours, late, note: note.trim() || undefined }
        : { outcome, note: note.trim() }
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="flex flex-col gap-5">
        <div role="radiogroup" aria-label="Resolution" className="grid grid-cols-2 gap-2">
          {(["corrected", "upheld"] as const).map((option) => {
            const selected = option === outcome;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setOutcome(option)}
                className={
                  "min-h-12 rounded-control border text-base font-semibold capitalize transition-colors " +
                  (selected ? "border-primary bg-primary text-primary-foreground" : "border-input bg-surface text-ink hover:bg-primary-soft")
                }
              >
                {option}
              </button>
            );
          })}
        </div>

        {outcome === "corrected" && (
          <>
            <AttStatusSegmented value={status} onChange={setStatus} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-medium text-ink">Hours worked</span>
              <HoursStepper value={hours} onChange={setHours} disabled={status === "absent"} />
            </div>
            <LateToggle checked={late} onChange={setLate} disabled={status === "absent"} className="self-start" />
          </>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="resolve-note" className="font-medium text-ink">
            Note {outcome === "corrected" ? <span className="font-normal text-ink-muted">(optional)</span> : null}
          </label>
          <Textarea
            id="resolve-note"
            value={note}
            maxLength={NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
            aria-invalid={attempted && noteTooShort}
            aria-describedby={attempted && noteTooShort ? "resolve-note-error" : undefined}
            placeholder={outcome === "upheld" ? "Why the original record stands…" : "What changed, if anything…"}
          />
          {attempted && noteTooShort && (
            <p id="resolve-note-error" className="flex items-center gap-1.5 text-sm font-medium text-state-disputed">
              <OctagonAlert className="size-4 shrink-0" aria-hidden="true" />
              Add a note of at least {UPHELD_NOTE_MIN} characters to uphold.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-state-disputed">
            <OctagonAlert className="size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : outcome === "corrected" ? "Save correction" : "Uphold record"}
        </Button>
      </div>
    </form>
  );
}
