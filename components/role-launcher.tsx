"use client";

import { useState, useTransition } from "react";
import { ArrowRightIcon, HardHatIcon, Loader2Icon, ReceiptIcon, WrenchIcon } from "lucide-react";

import { launchDemoRole } from "@/app/demo-actions";

/**
 * One-click role launcher.
 *
 * Each card signs in as a seeded account through the real authentication path
 * and lands on the screen that role is actually allowed to use. It does not
 * bypass sign-in, and it cannot show a role more than the database allows --
 * see `app/demo-actions.ts` for why that distinction is load-bearing.
 *
 * Only rendered when DEMO_MODE is on, which the server decides.
 */

const ROLES = [
  {
    role: "supervisor",
    label: "Supervisor mode",
    blurb: "Shift settlement, attendance edits, task publishing, dispute decisions.",
    destination: "/attendance",
    icon: HardHatIcon,
  },
  {
    role: "engineer",
    label: "Engineer mode",
    blurb: "Day summary and payroll figures. Read-only on crew and disputes.",
    destination: "/summary",
    icon: WrenchIcon,
  },
  {
    role: "owner",
    label: "Owner & audit",
    blurb: "Financial reconciliation and the signed-off payroll export.",
    destination: "/summary",
    icon: ReceiptIcon,
  },
] as const;

export function RoleLauncher() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {ROLES.map((item) => {
          const Icon = item.icon;
          return (
            <form
              key={item.role}
              action={(formData) => {
                setError(null);
                startTransition(async () => {
                  try {
                    await launchDemoRole(formData);
                  } catch (caught) {
                    // `redirect()` throws a control-flow signal, not an error. It
                    // is rethrown by the framework, so anything that reaches here
                    // is a genuine failure worth showing.
                    setError(
                      caught instanceof Error
                        ? caught.message
                        : "Could not open that workspace.",
                    );
                  }
                });
              }}
            >
              <input type="hidden" name="role" value={item.role} />
              <button
                type="submit"
                disabled={pending}
                className="group flex h-full min-h-11 w-full flex-col gap-2 rounded-card border border-border bg-surface p-4 text-left transition-[border-color,box-shadow,transform] duration-200 hover:border-primary/40 hover:shadow-md active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none"
              >
                <span className="flex items-center gap-2">
                  <Icon className="size-4 text-primary" aria-hidden="true" />
                  <span className="font-semibold text-ink">{item.label}</span>
                  <ArrowRightIcon
                    className="ml-auto size-4 text-ink-muted transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
                <span className="text-sm text-ink-muted">{item.blurb}</span>
                <span className="mt-auto text-xs text-ink-muted">
                  Goes to {item.destination}
                </span>
              </button>
            </form>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-state-disputed">
          {error}
        </p>
      ) : null}

      {pending ? (
        <p className="flex items-center gap-2 text-sm text-ink-muted" aria-live="polite">
          <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
          Signing in…
        </p>
      ) : null}
    </div>
  );
}
