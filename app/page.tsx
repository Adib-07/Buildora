import Link from "next/link";
import {
  ArrowRightIcon,
  ClipboardCheckIcon,
  HardHatIcon,
  LanguagesIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
} from "lucide-react";

import { BrandLockup } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/dal";

/**
 * Public landing page.
 *
 * Leads with the problem rather than the feature list: a supervisor closing a
 * shift is chasing paper registers and unreadable SMS replies. The three
 * capabilities below are the ones the product actually implements today, and the
 * security section describes what is enforced rather than what is planned.
 */
export default async function Home() {
  const session = await getSession();

  const PILLARS = [
    {
      icon: ClipboardCheckIcon,
      title: "Attendance the workers accept",
      body: "Each worker's record is theirs to confirm or dispute, and a dispute arrives attached to the exact version they were shown, with their reason kept alongside the decision.",
    },
    {
      icon: HardHatIcon,
      title: "Tasks with a name on them",
      body: "Write the shift down as you say it. Buildora splits it into tasks and matches owners from your roster, and nothing is published until you confirm who owns what.",
    },
    {
      icon: ShieldCheckIcon,
      title: "Hazards triaged, not filed",
      body: "Reports from the site become cards with a severity, an owner and a due date. Duplicates merge instead of multiplying, and nothing closes on its own.",
    },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
          <BrandLockup />
          <div className="ml-auto">
            {session ? (
              <Button asChild>
                <Link href="/dashboard">
                  Open Buildora
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        {/* Hero */}
        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:py-20">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">
              Construction site operations
            </p>
            <h1 className="mt-3 text-4xl leading-tight font-semibold tracking-tight text-ink sm:text-5xl">
              The shift is only settled when the worker says so.
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-ink-muted">
              Buildora sends every worker their attendance record and lets them
              confirm or dispute it in their own language. What comes back is a
              payroll you can defend, not a register you have to trust.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href={session ? "/dashboard" : "/login"}>
                  {session ? "Go to your site" : "Sign in to your site"}
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#how-it-works">How it works</a>
              </Button>
            </div>

            {/* Stated plainly, because the difference matters to anyone
                evaluating this: the site-side product is built, the SMS and
                voice gateway is not connected yet. */}
            <aside className="mt-8 max-w-2xl rounded-card border border-border bg-surface p-4">
              <p className="text-sm font-semibold text-ink">What runs today</p>
              <p className="mt-1 text-sm text-ink-muted">
                Everything a site supervisor does is built and working against a
                real database: attendance, disputes, tasks, safety, the crew and
                the day summary. The worker-side gateway — actually sending the
                SMS and taking the reply back — is modelled in the schema but not
                yet connected to a provider, so records here are seeded and edited
                from the supervisor screens.
              </p>
            </aside>
          </div>
        </section>

        {/* Pillars */}
        <section className="border-y border-border bg-surface">
          <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-14 sm:grid-cols-3">
            {PILLARS.map((pillar) => (
              <article key={pillar.title} className="flex flex-col gap-3">
                <pillar.icon className="size-7 text-primary" />
                <h2 className="text-lg font-semibold text-ink">{pillar.title}</h2>
                <p className="text-ink-muted">{pillar.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mx-auto w-full max-w-6xl px-4 py-14">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">
                Built for the reality of a site, not an office
              </h2>
              <p className="mt-3 text-ink-muted">
                The people using this are standing in the sun, holding a phone
                with one hand and may not read the language the paperwork is
                written in.
              </p>
              <dl className="mt-6 flex flex-col gap-4">
                <div className="flex gap-3">
                  <LanguagesIcon className="mt-0.5 size-5 shrink-0 text-primary" />
                  <div>
                    <dt className="font-semibold text-ink">English, Telugu and Hindi</dt>
                    <dd className="text-sm text-ink-muted">
                      A worker replies in the language they were registered with.
                    </dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <SmartphoneIcon className="mt-0.5 size-5 shrink-0 text-primary" />
                  <div>
                    <dt className="font-semibold text-ink">No smartphone required</dt>
                    <dd className="text-sm text-ink-muted">
                      No app, no data plan. A basic phone and a missed call are
                      enough to reply.
                    </dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-primary" />
                  <div>
                    <dt className="font-semibold text-ink">Sites cannot see each other</dt>
                    <dd className="text-sm text-ink-muted">
                      Enforced in the database, not by the interface. A guess at
                      another site&apos;s ids returns nothing at all.
                    </dd>
                  </div>
                </div>
              </dl>
            </div>

            <ol className="flex flex-col gap-3">
              {[
                {
                  n: '1',
                  t: 'Buildora sends the record',
                  d: 'At shift end each worker is sent their hours by SMS, or a call they can answer by phone.',
                },
                {
                  n: '2',
                  t: 'The worker replies 1 or 2',
                  d: 'One is confirmation. Two opens a dispute, and a voice note is taken when typing is not possible.',
                },
                {
                  n: '3',
                  t: 'You resolve only what needs it',
                  d: 'Confirmed records need nothing. Disputes land in one queue with the full edit history attached.',
                },
                {
                  n: '4',
                  t: 'The day is locked',
                  d: 'Once locked, the figures are fixed and published. A later correction is an amendment, on the record.',
                },
              ].map((step) => (
                <li
                  key={step.n}
                  className="flex gap-4 rounded-card border border-border bg-surface p-4"
                >
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                    aria-hidden="true"
                  >
                    {step.n}
                  </span>
                  <div>
                    <p className="font-semibold text-ink">{step.t}</p>
                    <p className="text-sm text-ink-muted">{step.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Close */}
        <section className="border-t border-border bg-surface">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-4 px-4 py-12 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Open your site</h2>
              <p className="text-ink-muted">
                Staff accounts are issued by your site administrator.
              </p>
            </div>
            <Button asChild size="lg">
              <Link href={session ? "/dashboard" : "/login"}>
                {session ? "Go to your site" : "Sign in"}
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <BrandLockup />
          <p className="text-sm text-ink-muted">
            Attendance, tasks and site safety for construction crews.
          </p>
        </div>
      </footer>
    </div>
  );
}
