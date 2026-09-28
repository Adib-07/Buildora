"use client";

import { useState } from "react";
import { Mic, PhoneMissed, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SimMessage } from "@/contracts";
import { cn } from "@/lib/ui/utils";

const KEYS = ["1", "2", "H"] as const;

/**
 * A worker's feature phone. `direction: 'out'` is a message the worker's
 * phone sent (their reply), shown on the right; `'in'` is what Saakshi sent
 * them, shown on the left — the same convention as any SMS thread.
 */
export function PhoneSimulator({
  label,
  phone,
  workerName,
  shared = false,
  messages,
  onSend,
  onMissedCall,
  onRecordVoice,
  disabled = false,
  className,
}: {
  label: string;
  phone: string;
  workerName: string;
  shared?: boolean;
  messages: SimMessage[];
  onSend: (text: string) => void;
  onMissedCall: () => void;
  onRecordVoice: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const [text, setText] = useState("");
  const [hazardMode, setHazardMode] = useState(false);

  function pressKey(key: (typeof KEYS)[number]) {
    if (key === "H") {
      setHazardMode(true);
      setText("H ");
    } else {
      setHazardMode(false);
      setText(key);
    }
  }

  function send() {
    const value = text.trim();
    if (!value || (hazardMode && value === "H")) return;
    onSend(value);
    setText("");
    setHazardMode(false);
  }

  const canSend = text.trim().length > 0 && !(hazardMode && text.trim() === "H");

  return (
    <div className={cn("flex w-full max-w-sm flex-col overflow-hidden rounded-card border border-border bg-surface shadow-sm", className)}>
      <div className="flex flex-col gap-0.5 border-b border-border bg-bg px-4 py-3">
        <p className="font-semibold text-ink">{label}</p>
        <p className="text-sm text-ink-muted">
          {workerName} · <span className="tabular-nums">{phone}</span>
        </p>
        {shared && <p className="text-sm text-ink-muted">Shared phone — needs the 4-digit worker code.</p>}
      </div>

      <ol aria-live="polite" aria-label={`Messages on ${label}`} className="flex h-64 flex-col gap-2 overflow-y-auto bg-bg p-3">
        {messages.length === 0 && <li className="m-auto text-sm text-ink-muted">No messages yet.</li>}
        {messages.map((message) => (
          <li key={message.id} className={cn("flex flex-col", message.direction === "out" ? "items-end" : "items-start")}>
            <p
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                message.direction === "out" ? "bg-primary text-primary-foreground" : "border border-border bg-surface text-ink"
              )}
            >
              {message.body}
            </p>
            {message.templateKey && <span className="mt-0.5 text-sm text-ink-muted">{message.templateKey}</span>}
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-2 border-t border-border p-3">
        {hazardMode ? (
          <Input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Hazard report text"
            placeholder="H describe the hazard…"
          />
        ) : (
          <p className="min-h-12 rounded-control border border-input bg-surface px-3 py-2 text-base tabular-nums text-ink" aria-live="polite">
            {text || <span className="text-ink-muted">Tap a key below</span>}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((key) => (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => pressKey(key)}
              className="min-h-12 rounded-control border border-input bg-surface text-lg font-semibold text-ink disabled:pointer-events-none disabled:opacity-50"
            >
              {key}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {/* min-w-0 so flex-1 actually shrinks these — otherwise their
              nowrap text wins and pokes out of the card's overflow-hidden. */}
          <Button variant="outline" onClick={onMissedCall} disabled={disabled} className="min-w-0 flex-1 px-2">
            <PhoneMissed data-icon="inline-start" />
            <span className="truncate">Missed call</span>
          </Button>
          <Button variant="outline" onClick={onRecordVoice} disabled={disabled} className="min-w-0 flex-1 px-2">
            <Mic data-icon="inline-start" />
            <span className="truncate">Record voice</span>
          </Button>
        </div>

        <Button onClick={send} disabled={disabled || !canSend}>
          <Send data-icon="inline-start" />
          Send
        </Button>
      </div>
    </div>
  );
}
