"use client";

import { Minus, Plus } from "lucide-react";

import type { AttStatus } from "@/contracts";
import { cn } from "@/lib/ui/utils";

// Shared building blocks for AttendanceSheet and ResolveDisputeForm's
// "corrected" branch: both edit the same status/hours/late triple.

const STATUS_OPTIONS: { value: AttStatus; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "half_day", label: "Half-day" },
];

export function AttStatusSegmented({
  value,
  onChange,
  className,
}: {
  value: AttStatus;
  onChange: (value: AttStatus) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label="Attendance status" className={cn("grid grid-cols-3 gap-2", className)}>
      {STATUS_OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-12 rounded-control border text-base font-semibold transition-colors",
              selected ? "border-primary bg-primary text-primary-foreground" : "border-input bg-surface text-ink hover:bg-primary-soft"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function LateToggle({
  checked,
  onChange,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "min-h-12 rounded-control border px-4 text-base font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
        checked ? "border-state-noreply bg-state-noreply-bg text-state-noreply" : "border-input bg-surface text-ink hover:bg-primary-soft",
        className
      )}
    >
      Late
    </button>
  );
}

const HOURS_STEP = 0.5;
const HOURS_MIN = 0;
const HOURS_MAX = 16;

export function HoursStepper({
  value,
  onChange,
  disabled,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  const clamp = (n: number) => Math.min(HOURS_MAX, Math.max(HOURS_MIN, n));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button
        type="button"
        aria-label="Decrease hours by half an hour"
        disabled={disabled || value <= HOURS_MIN}
        onClick={() => onChange(clamp(value - HOURS_STEP))}
        className="flex size-12 shrink-0 items-center justify-center rounded-control border border-input bg-surface text-ink disabled:pointer-events-none disabled:opacity-50"
      >
        <Minus className="size-5" aria-hidden="true" />
      </button>
      <output aria-live="polite" className="min-w-16 text-center text-2xl font-semibold tabular-nums">
        {value}h
      </output>
      <button
        type="button"
        aria-label="Increase hours by half an hour"
        disabled={disabled || value >= HOURS_MAX}
        onClick={() => onChange(clamp(value + HOURS_STEP))}
        className="flex size-12 shrink-0 items-center justify-center rounded-control border border-input bg-surface text-ink disabled:pointer-events-none disabled:opacity-50"
      >
        <Plus className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}
