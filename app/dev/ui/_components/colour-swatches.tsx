"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/ui/utils";

import { toHex, toRgb } from "./colour";

const GROUPS = [
  {
    title: "Base",
    tokens: [
      { name: "bg", className: "bg-bg", use: "Page background" },
      { name: "surface", className: "bg-surface", use: "Cards, sheets, inputs" },
      { name: "border", className: "bg-border", use: "Decoration and dividers only (1.2:1)" },
      { name: "ink", className: "bg-ink", use: "Text and headings" },
      { name: "ink-muted", className: "bg-ink-muted", use: "Secondary text; control borders (input)" },
    ],
  },
  {
    title: "Primary",
    tokens: [
      { name: "primary", className: "bg-primary", use: "Main actions and links, white text" },
      { name: "primary-soft", className: "bg-primary-soft", use: "Selected and hover tint" },
      { name: "focus", className: "bg-focus", use: "Focus ring, 3px with 2px offset" },
    ],
  },
  {
    title: "Worker state",
    tokens: [
      { name: "state-confirmed", className: "bg-state-confirmed", use: "Confirmed (CircleCheck)" },
      { name: "state-confirmed-bg", className: "bg-state-confirmed-bg", use: "Confirmed background" },
      { name: "state-disputed", className: "bg-state-disputed", use: "Disputed (TriangleAlert)" },
      { name: "state-disputed-bg", className: "bg-state-disputed-bg", use: "Disputed background" },
      { name: "state-noreply", className: "bg-state-noreply", use: "No reply (Clock)" },
      { name: "state-noreply-bg", className: "bg-state-noreply-bg", use: "No reply background" },
    ],
  },
  {
    title: "Hazard severity",
    tokens: [
      { name: "severity-3", className: "bg-severity-3", use: "Severity 3, highest" },
      { name: "severity-2", className: "bg-severity-2", use: "Severity 2" },
      { name: "severity-1", className: "bg-severity-1", use: "Severity 1" },
    ],
  },
];

// Hex values are read from the rendered swatches, so they always match
// app/globals.css.
export function ColourSwatches() {
  const ref = useRef<HTMLDivElement>(null);
  const [hex, setHex] = useState<Record<string, string>>({});

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measured: Record<string, string> = {};
    for (const swatch of root.querySelectorAll<HTMLElement>("[data-swatch]")) {
      const name = swatch.dataset.swatch;
      if (name) measured[name] = toHex(toRgb(getComputedStyle(swatch).backgroundColor));
    }
    setHex(measured);
  }, []);

  return (
    <div ref={ref} className="grid gap-6 lg:grid-cols-2">
      {GROUPS.map((group) => (
        <div key={group.title} className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold">{group.title}</h3>
          <ul className="flex flex-col gap-3">
            {group.tokens.map((token) => (
              <li key={token.name} className="flex items-center gap-3">
                <span
                  data-swatch={token.name}
                  className={cn("size-12 shrink-0 rounded-control border border-border", token.className)}
                />
                <div className="min-w-0">
                  <p className="font-semibold">
                    {token.name}{" "}
                    <span className="font-normal text-ink-muted tabular-nums">{hex[token.name] ?? ""}</span>
                  </p>
                  <p className="text-sm text-ink-muted">{token.use}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
