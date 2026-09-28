"use client";

import { useRef } from "react";
import { LoaderCircle, Mic } from "lucide-react";

import { cn } from "@/lib/ui/utils";

export type MicButtonState = "idle" | "recording" | "processing" | "error";

const CLICK_THRESHOLD_MS = 350;

/**
 * Controlled: `state` reflects the real recording status (owned by whatever
 * wires up MediaRecorder later); this component only turns gestures into
 * onStart/onStop calls.
 *
 * Hold and click-to-toggle share one pointerdown/up pair: a press that
 * starts a recording is timed. Released quickly, it reads as a tap and the
 * recording stays on (release again to stop). Held past the threshold, it
 * reads as a hold and stops on release. A quick tap while already recording
 * (i.e. armed by a previous tap) always stops it, however long that second
 * press was held.
 */
export function MicButton({
  state,
  elapsedSeconds,
  errorMessage = "Couldn't record — tap to retry",
  onStart,
  onStop,
  disabled = false,
  className,
}: {
  state: MicButtonState;
  elapsedSeconds?: number;
  errorMessage?: string;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const pressedRef = useRef(false);
  const downAtRef = useRef(0);
  const startedByThisPressRef = useRef(false);

  const canStart = state === "idle" || state === "error";

  function down(e: React.PointerEvent) {
    if (disabled || state === "processing") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pressedRef.current = true;
    downAtRef.current = Date.now();
    startedByThisPressRef.current = canStart;
    if (canStart) onStart();
  }

  function up() {
    if (!pressedRef.current) return;
    pressedRef.current = false;
    const quick = Date.now() - downAtRef.current < CLICK_THRESHOLD_MS;
    if (startedByThisPressRef.current) {
      // This press is the one that started it: a hold stops on release, a
      // tap leaves it recording (armed for the next tap to stop it).
      if (!quick) onStop();
    } else if (state === "recording" && quick) {
      onStop();
    }
  }

  function keyDown(e: React.KeyboardEvent) {
    if (disabled || state === "processing" || e.repeat) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (canStart) onStart();
    else if (state === "recording") onStop();
  }

  const label =
    state === "recording"
      ? elapsedSeconds !== undefined
        ? `Recording, ${elapsedSeconds}s — tap to stop`
        : "Recording — tap to stop"
      : state === "processing"
        ? "Processing…"
        : state === "error"
          ? errorMessage
          : "Hold to record, or tap to start";

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={state === "recording"}
        aria-label="Record a voice task"
        onPointerDown={down}
        onPointerUp={up}
        onPointerLeave={up}
        onKeyDown={keyDown}
        className={cn(
          "relative flex size-16 shrink-0 items-center justify-center rounded-full text-white transition-colors disabled:pointer-events-none disabled:opacity-50",
          state === "recording" && "bg-state-disputed",
          state === "processing" && "bg-primary/60",
          state === "error" && "border-2 border-state-disputed bg-state-disputed-bg text-state-disputed",
          state === "idle" && "bg-primary"
        )}
      >
        {state === "recording" && (
          <span className="absolute inset-0 animate-ping rounded-full bg-state-disputed/50" aria-hidden="true" />
        )}
        {state === "processing" ? (
          <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
        ) : (
          <Mic className="relative size-6" aria-hidden="true" />
        )}
      </button>
      <p role="status" className={cn("text-sm font-medium", state === "error" ? "text-state-disputed" : "text-ink-muted")}>
        {label}
      </p>
    </div>
  );
}
