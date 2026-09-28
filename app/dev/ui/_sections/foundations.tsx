import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { ColourSwatches } from "../_components/colour-swatches";
import { ContrastTable } from "../_components/contrast-table";
import { Section, Subsection } from "../_components/section";

const TYPE_SCALE = [
  { className: "text-sm", label: "text-sm · 14px" },
  { className: "text-base", label: "text-base · 16px" },
  { className: "text-lg", label: "text-lg · 18px" },
  { className: "text-xl", label: "text-xl · 20px" },
  { className: "text-2xl", label: "text-2xl · 24px" },
  { className: "text-3xl", label: "text-3xl · 30px" },
  { className: "text-4xl", label: "text-4xl · 36px" },
];

const WEIGHTS = [
  { className: "font-normal", label: "Regular 400" },
  { className: "font-medium", label: "Medium 500" },
  { className: "font-semibold", label: "Semibold 600" },
  { className: "font-bold", label: "Bold 700" },
];

const HOURS = [
  { name: "Ramesh", hours: "8.0" },
  { name: "Lakshmi", hours: "7.5" },
  { name: "Venkat", hours: "10.0" },
  { name: "Suresh", hours: "4.5" },
];

const SPACING = [
  { className: "w-1", label: "1 · 4px" },
  { className: "w-2", label: "2 · 8px" },
  { className: "w-3", label: "3 · 12px" },
  { className: "w-4", label: "4 · 16px" },
  { className: "w-6", label: "6 · 24px" },
  { className: "w-8", label: "8 · 32px" },
  { className: "w-12", label: "12 · 48px" },
];

export function Foundations() {
  return (
    <>
      <Section
        id="colour"
        title="Colour"
        description="Light theme only. Tailwind's default palette is removed, so these tokens are the only colours available."
      >
        <ColourSwatches />
      </Section>

      <Section
        id="contrast"
        title="Contrast"
        description="Measured live from the rendered tokens. Text needs 4.5:1; focus rings and control borders need 3:1 against what they sit on."
      >
        <ContrastTable />
        <p className="max-w-prose text-sm text-ink-muted">
          The focus ring is only 2.7:1 on ink, so dark surfaces need a white ring instead.
        </p>
      </Section>

      <Section
        id="type"
        title="Type"
        description="Noto Sans with Noto Sans Telugu. 16px base and nothing below 14px: text-xs does not exist. Line height 1.5, or 1.7 for Telugu."
      >
        <Subsection title="Scale">
          <div className="flex flex-col gap-3">
            {TYPE_SCALE.map(({ className, label }) => (
              <div key={className} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
                <code className="w-40 shrink-0 text-sm text-ink-muted">{label}</code>
                <p className={className}>Masonry team, 12 workers</p>
              </div>
            ))}
          </div>
        </Subsection>

        <Subsection title="Weights">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {WEIGHTS.map(({ className, label }) => (
              <p key={className} className={className}>
                {label}
              </p>
            ))}
          </div>
        </Subsection>

        <Subsection title="Telugu">
          <p lang="te" className="text-2xl">
            రమేష్ · లక్ష్మి · వెంకట్ · సురేష్ · కిరణ్
          </p>
          <p lang="te">ఈరోజు హాజరు నిర్ధారించబడింది</p>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" lang="te">
              లక్ష్మి
            </Badge>
            <Button variant="outline" lang="te">
              కిరణ్
            </Button>
          </div>
          <p className="text-sm text-ink-muted">
            Marks above and below the line must not be clipped in any of these, including the badge and button.
          </p>
        </Subsection>

        <Subsection title="Tabular numbers">
          <p className="text-4xl font-semibold tabular-nums">33 of 36</p>
          <table className="w-full max-w-xs text-left">
            <caption className="sr-only">Hours worked, sample</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2 font-semibold">
                  Worker
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  Hours
                </th>
              </tr>
            </thead>
            <tbody>
              {HOURS.map(({ name, hours }) => (
                <tr key={name} className="border-b border-border">
                  <td className="py-2">{name}</td>
                  <td className="py-2 text-right tabular-nums">{hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Subsection>
      </Section>

      <Section id="shape" title="Shape, spacing and focus">
        <Subsection title="Radius and elevation">
          <div className="flex flex-wrap gap-4">
            <div className="flex h-24 w-40 items-center justify-center rounded-control border border-border bg-surface p-3 text-center text-sm">
              rounded-control · 8px inputs, buttons
            </div>
            <div className="flex h-24 w-40 items-center justify-center rounded-card border border-border bg-surface p-3 text-center text-sm">
              rounded-card · 12px cards, sheets
            </div>
            <div className="flex h-24 w-40 items-center justify-center rounded-card bg-surface p-3 text-center text-sm shadow-xs">
              shadow-xs
            </div>
            <div className="flex h-24 w-40 items-center justify-center rounded-card bg-surface p-3 text-center text-sm shadow-sm">
              shadow-sm, the maximum
            </div>
          </div>
        </Subsection>

        <Subsection title="Spacing (4px scale)">
          <ul className="flex flex-col gap-2">
            {SPACING.map(({ className, label }) => (
              <li key={className} className="flex items-center gap-3">
                <span className={`h-4 shrink-0 bg-primary ${className}`} />
                <code className="text-sm text-ink-muted">{label}</code>
              </li>
            ))}
          </ul>
        </Subsection>

        <Subsection title="Touch targets and focus">
          <p className="max-w-prose text-ink-muted">
            Every control is at least 48px. Press Tab: focus shows a 3px ring, 2px away from the control.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-control border-2 border-dashed border-ink-muted text-sm">
              48
            </span>
            <Button>Focus me</Button>
            <Input aria-label="Focus example" placeholder="Or me" className="max-w-56" />
          </div>
        </Subsection>

        <Subsection title="Motion">
          <p className="max-w-prose text-ink-muted">
            Transitions run 150ms with ease. With reduced motion switched on, animations and transitions finish
            instantly.
          </p>
        </Subsection>
      </Section>
    </>
  );
}
