"use client";

import { useEffect, useState } from "react";
import { Clock, Lock } from "lucide-react";

import { cn } from "@/lib/ui/utils";

const URGENT_MS = 30 * 60 * 1000;

function format(remainingMs: number): string {
  const totalMinutes = Math.max(0, Math.ceil(remainingMs / 60_000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/**
 * Ticks from the server's clock, never the browser's: `serverNow` is the
 * time as of when the caller fetched `Me`, and every tick adds the elapsed
 * local time to it. A supervisor with a wrong device clock still sees the
 * true cutoff. The offset is only computed after mount, so server and
 * client never have to render the same instant — that would drift by
 * render latency and trip a hydration mismatch.
 */
export function CutoffCountdown({ target, serverNow, className }: { target: string; serverNow: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const offsetMs = new Date(serverNow).getTime() - Date.now();
    const tick = () => setNow(Date.now() + offsetMs);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [serverNow]);

  if (now === null) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted", className)}>
        <Clock className="size-4 shrink-0" aria-hidden="true" />
        <span aria-hidden="true">—</span>
        <span className="sr-only">Loading cutoff time</span>
      </span>
    );
  }

  const remainingMs = new Date(target).getTime() - now;
  const passed = remainingMs <= 0;
  const urgent = !passed && remainingMs <= URGENT_MS;

  if (passed) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted", className)}>
        <Lock className="size-4 shrink-0" aria-hidden="true" />
        Cutoff passed
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-sm font-medium", urgent ? "text-state-noreply" : "text-ink-muted", className)}
    >
      <Clock className="size-4 shrink-0" aria-hidden="true" />
      <span className="tabular-nums">{format(remainingMs)}</span> to cutoff
    </span>
  );
}
