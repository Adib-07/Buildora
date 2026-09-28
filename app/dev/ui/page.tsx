import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Foundations } from "./_sections/foundations";
import { Primitives } from "./_sections/primitives";
import { Product } from "./_sections/product";

export const metadata: Metadata = {
  title: "UI kitchen sink",
  robots: { index: false, follow: false },
};

const SECTIONS = [
  ["colour", "Colour"],
  ["contrast", "Contrast"],
  ["type", "Type"],
  ["shape", "Shape"],
  ["buttons", "Buttons"],
  ["badges", "Badges"],
  ["cards", "Cards"],
  ["forms", "Forms"],
  ["tabs", "Tabs"],
  ["overlays", "Overlays"],
  ["command", "Command"],
  ["feedback", "Feedback"],
  ["p-status", "Status & counts"],
  ["p-lists", "Lists & chrome"],
  ["p-rollcall", "Roll-call & disputes"],
  ["p-tasks", "Tasks"],
  ["p-hazards", "Hazards"],
  ["p-demo", "Demo mode"],
] as const;

// Development only: production builds render the 404 page here.
export default function DevUiPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main id="main-content" className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-ink-muted">Development only</p>
        <h1 className="text-3xl font-semibold">UI kitchen sink</h1>
        <p className="max-w-prose text-ink-muted">
          Every token and primitive in one place. Tab through the page to check focus; resize to 360px to check the
          phone layout.
        </p>
        <nav aria-label="Sections">
          <ul className="flex flex-wrap gap-x-1">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="inline-flex min-h-12 items-center px-2 font-semibold text-primary underline underline-offset-4"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <Foundations />
      <Primitives />
      <Product />
    </main>
  );
}
