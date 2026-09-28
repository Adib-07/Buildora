"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FastForwardIcon,
  KeyboardIcon,
  Loader2Icon,
  LockIcon,
  MessageSquareIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui/utils";

/**
 * Judge Mode console.
 *
 * A shortcut panel for driving a live demo by hand: advance the clock, lock the
 * day, replay a worker reply, reset. It exists so a demo can be run repeatedly
 * and in any order without an account, a key or a phone.
 *
 * What this deliberately does NOT do, and why.
 *
 * It does not intercept network traffic and substitute invented data when a real
 * request fails. That would hide the two failures a demo cannot survive: an
 * expired session and an unreachable database. A fabricated dashboard is
 * internally inconsistent the moment a judge clicks a second screen -- the
 * attendance queue would not match the number on the dashboard -- and a silent
 * fallback means the team never learns which button was broken.
 *
 * Instead every action here hits a real `/api/demo/*` endpoint that writes to the
 * real database, so the demo exercises the same code path production does. If an
 * action fails, this says so. The one thing it hides is the noise: a transient
 * 5xx or a dropped connection is retried twice before it is reported, because a
 * proxy blip is not an interesting demo failure.
 *
 * Only rendered when DEMO_MODE is on, which the server decides.
 */

type Action = "jump" | "lock" | "reply" | "reset";

const TRANSIENT = new Set([429, 500, 502, 503, 504]);

export function JudgeConsole({
  date,
  demoPhone,
}: {
  /** The day the dashboard is showing, so "Lock the day" locks what is on screen. */
  date: string;
  /** A seeded SIM number, so "worker replies" needs no setup first. */
  demoPhone: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Action | null>(null);
  const [pending, startTransition] = useTransition();

  // Shift+D, the shortcut named in the docs. Ignored while a modifier other than
  // Shift is held or while the user is typing, so it cannot hijack "d" in a
  // worker's name or a note field.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (event.key.toLowerCase() !== "d") return;
      event.preventDefault();
      setOpen((value) => !value);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const run = useCallback(
    async (action: Action) => {
      setBusy(action);
      try {
        const call = async (): Promise<Response> => {
          switch (action) {
            case "jump":
              return fetch("/api/demo/jump-to-shift-end", { method: "POST" });
            case "lock":
              return fetch("/api/demo/lock", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ date }),
              });
            case "reply":
              return fetch("/api/demo/sim/inbound", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ from: demoPhone, kind: "sms", text: "1", line: "confirm" }),
              });
            case "reset":
              return fetch("/api/demo/reset", { method: "POST" });
          }
        };

        // Two retries, only for transient statuses. A 401 or a 403 is a real
        // answer and is reported immediately -- retrying it would just delay
        // the message that something is genuinely misconfigured.
        let response = await call();
        for (let attempt = 0; attempt < 2 && TRANSIENT.has(response.status); attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
          response = await call();
        }

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          throw new Error(body?.error?.message ?? `Request failed (${response.status}).`);
        }

        const messages: Record<Action, string> = {
          jump: "Clock moved to just after shift end.",
          lock: `${date} is now locked. Figures are final.`,
          reply: "Simulated worker reply received.",
          reset: "Reset to the seeded starting state.",
        };
        toast.success(messages[action]);

        // Re-run the server components so the dashboard reflects the write.
        startTransition(() => router.refresh());
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "That action failed.");
      } finally {
        setBusy(null);
      }
    },
    [date, demoPhone, router],
  );

  const items: { action: Action; label: string; hint: string; icon: typeof FastForwardIcon }[] = [
    {
      action: "jump",
      label: "Jump to shift end",
      hint: "Moves the simulated clock past the site's shift end.",
      icon: FastForwardIcon,
    },
    {
      action: "reply",
      label: "Worker replies “1”",
      hint: demoPhone
        ? `Writes a confirmation from ${demoPhone} into the inbound queue.`
        : "No SIM number seeded for this site.",
      icon: MessageSquareIcon,
    },
    {
      action: "lock",
      label: "Lock the day",
      hint: `Locks ${date}. The irreversible step, shown on purpose.`,
      icon: LockIcon,
    },
    {
      action: "reset",
      label: "Reset to start",
      hint: "Unlocks, clears simulated replies and restores the real clock.",
      icon: RotateCcwIcon,
    },
  ];

  return (
    <>
      {!open ? (
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-4 z-40 shadow-sm lg:right-6 lg:bottom-6"
        >
          <KeyboardIcon aria-hidden="true" />
          <span className="hidden sm:inline">Judge Mode</span>
          <kbd className="ml-1 hidden rounded border border-border px-1 text-[10px] font-semibold text-ink-muted sm:inline">
            ⇧D
          </kbd>
        </Button>
      ) : null}

      {open ? (
        <div
          role="dialog"
          aria-label="Judge Mode"
          className="fixed inset-x-3 bottom-3 z-50 flex flex-col gap-3 rounded-card border border-border bg-popover p-4 text-popover-foreground shadow-lg sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold text-ink">Judge Mode</p>
              <p className="text-xs text-ink-muted">
                Writes to the real database through the demo endpoints. Reset
                returns the site to its seeded state.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              aria-label="Close Judge Mode"
            >
              <XIcon aria-hidden="true" />
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            {items.map((item) => {
              const Icon = item.icon;
              const disabled =
                busy !== null ||
                pending ||
                (item.action === "reply" && !demoPhone);
              return (
                <button
                  key={item.action}
                  type="button"
                  onClick={() => run(item.action)}
                  disabled={disabled}
                  className={cn(
                    "flex min-h-11 w-full items-start gap-3 rounded-control border border-border bg-surface px-3 py-2.5 text-left transition-colors",
                    "hover:border-primary/40 hover:bg-bg active:scale-[0.99]",
                    "disabled:pointer-events-none disabled:opacity-50",
                  )}
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-2 text-sm font-medium text-ink">
                      {item.label}
                      {busy === item.action ? (
                        <Loader2Icon className="size-3.5 animate-spin text-ink-muted" aria-hidden="true" />
                      ) : null}
                    </span>
                    <span className="text-xs text-ink-muted">{item.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}
