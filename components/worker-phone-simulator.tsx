"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  Loader2Icon,
  MessageSquareIcon,
  SmartphoneIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui/utils";

/**
 * Worker phone simulator.
 *
 * Buildora's claim is "the shift is only settled when the worker says so", and
 * that claim is invisible on a supervisor screen — it only becomes real when
 * someone replies. This is a worker's basic phone showing the message the system
 * sends, with the two replies a worker can give.
 *
 * What makes it honest rather than a mock: pressing a button posts to the real
 * `/api/demo/sim/inbound` endpoint, which writes into `public.inbound_messages`
 * exactly as the SMS gateway webhook would. The supervisor table beside it then
 * changes because the row in Postgres changed. There is no local state standing
 * in for the database and nothing to reset between judges.
 *
 * What it deliberately does not do is mark the record settled. `processed_at`
 * stays null, because the worker-side processing pipeline is not connected yet,
 * and faking a confirmation would demonstrate a system this codebase does not
 * contain. The toast says so rather than implying the record is now confirmed.
 *
 * Only rendered when DEMO_MODE is on, decided server-side.
 */

type Phase = "idle" | "sending";

export function WorkerPhoneSimulator({
  workerName,
  phone,
  shiftWindow,
  hours,
  language = "English",
}: {
  workerName: string;
  phone: string;
  shiftWindow: string;
  hours: number;
  /** The language the worker is registered with, shown so the reply language is visible. */
  language?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [lastReply, setLastReply] = useState<"confirm" | "dispute" | null>(null);
  const [pending, startTransition] = useTransition();

  async function reply(kind: "confirm" | "dispute") {
    setPhase("sending");
    try {
      const response = await fetch("/api/demo/sim/inbound", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // `line: "confirm"` mirrors what the real gateway passes when a worker
        // replies with a bare "1" or "2" and there is no free text.
        body: JSON.stringify({
          from: phone,
          kind: "sms",
          text: kind === "confirm" ? "1" : "2",
          line: kind === "confirm" ? "confirm" : "hazard",
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? `Request failed (${response.status}).`);
      }

      setLastReply(kind);
      toast.success(
        kind === "confirm"
          ? `${workerName}'s confirmation is in the inbound queue.`
          : `${workerName} disputed. It is in the inbound queue as a dispute line.`,
        { description: "The gateway processing pipeline is not connected yet, so it stays queued." },
      );

      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send that reply.");
    } finally {
      setPhase("idle");
    }
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 lg:bottom-6 lg:right-6"
        data-print="hide"
      >
        <SmartphoneIcon aria-hidden="true" />
        <span className="hidden sm:inline">Worker phone</span>
      </Button>
    );
  }

  return (
    <aside
      role="dialog"
      aria-label={`${workerName}'s phone`}
      data-print="hide"
      className="fixed inset-x-3 bottom-3 z-50 flex flex-col gap-3 rounded-card border border-border bg-surface-raised p-4 shadow-md sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <p className="flex items-center gap-1.5 font-semibold text-ink">
            <SmartphoneIcon className="size-4 text-primary" aria-hidden="true" />
            Worker phone
          </p>
          <p className="truncate text-sm text-ink-muted">
            {workerName} · {language} ·{" "}
            <span className="font-mono">{phone.replace(/\d{4}$/, "••••")}</span>
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
          <XIcon aria-hidden="true" />
        </Button>
      </div>

      {/* The device. A basic phone, deliberately: this audience often has no
          app and no data plan, and the product has to work in an SMS. */}
      <div className="rounded-card border border-border bg-black/40 p-3">
        <div className="mb-3 flex items-center justify-between text-sm text-ink-muted">
          <span className="font-mono">{phone.replace(/\d{4}$/, "••••")}</span>
          <span aria-hidden="true">▂▄▆█</span>
        </div>

        {/* Inbound: what the supervisor's system sent the worker. */}
        <div className="mb-3 rounded-control border border-border bg-surface p-2.5">
          <p className="mb-1 text-sm text-ink-muted">Buildora · SMS</p>
          <p className="text-sm leading-relaxed text-ink">
            Hello {workerName.split(" ")[0]}, your shift at Site A was marked{" "}
            <span className="font-mono">{shiftWindow}</span> ({hours} hrs). Reply{" "}
            <span className="font-mono font-semibold">1</span> to confirm or{" "}
            <span className="font-mono font-semibold">2</span> to dispute.
          </p>
        </div>

        {/* Outbound: the reply the operator just sent. */}
        <div
          className={cn(
            "flex justify-end rounded-control p-2.5 transition-opacity duration-300",
            lastReply === "confirm"
              ? "border border-state-confirmed/25 bg-state-confirmed-bg"
              : lastReply === "dispute"
                ? "border border-state-disputed/25 bg-state-disputed-bg"
                : "border border-dashed border-border opacity-0",
          )}
          aria-live="polite"
        >
          {lastReply ? (
            <p
              className={cn(
                "font-mono text-sm",
                lastReply === "confirm" ? "text-state-confirmed" : "text-state-disputed",
              )}
            >
              {lastReply === "confirm" ? "1" : "2"}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          onClick={() => reply("confirm")}
          disabled={phase === "sending" || pending}
          className="border border-state-confirmed/30 text-state-confirmed hover:bg-state-confirmed-bg"
        >
          {phase === "sending" ? (
            <Loader2Icon className="animate-spin" aria-hidden="true" />
          ) : (
            <CheckIcon aria-hidden="true" />
          )}
          Replies “1”
        </Button>
        <Button
          variant="outline"
          onClick={() => reply("dispute")}
          disabled={phase === "sending" || pending}
          className="border border-state-disputed/30 text-state-disputed hover:bg-state-disputed-bg"
        >
          {phase === "sending" ? (
            <Loader2Icon className="animate-spin" aria-hidden="true" />
          ) : (
            <MessageSquareIcon aria-hidden="true" />
          )}
          Replies “2”
        </Button>
      </div>

      <p className="text-sm text-ink-muted">
        Posts to the real inbound endpoint. The queue updates; settling it needs
        the gateway, which is not connected yet.
      </p>
    </aside>
  );
}
