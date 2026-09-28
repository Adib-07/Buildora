import Link from "next/link";
import { CalendarDaysIcon, LockIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ForbiddenState, PageHeader } from "@/components/feedback";
import { HazardStatusBadge, SeverityBadge, StatCard } from "@/components/status";

import { requireSession } from "@/lib/auth/dal";
import { getDaySummary } from "@/lib/domain/summary";
import { latestDayWithRecords } from "@/lib/domain/attendance";
import { isNotFound } from "@/lib/domain/errors";
import { localDate, now } from "@/lib/domain/clock";
import { DateOnlySchema, type DateOnly } from "@/contracts";

/**
 * The day summary: the document the site sends to the client.
 *
 * Engineer and owner only, per the contract. The supervisor works the individual
 * queues this is built from; this is the roll-up for the people accountable for
 * the site. Every figure is computed from the live tables, so it cannot drift
 * from the attendance and dispute screens.
 */
export default async function SummaryPage(props: PageProps<"/summary">) {
  const { db, user, me } = await requireSession("/summary");

  if (user.role === "supervisor") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Day summary"
          description="The end-of-day report is issued to engineers and the owner."
        />
        <ForbiddenState message="Your role works the individual queues instead: attendance, disputes and safety. The roll-up is for engineers and the owner." />
      </div>
    );
  }

  const params = await props.searchParams;
  const requested = typeof params.date === "string" ? params.date : null;
  const parsed = requested ? DateOnlySchema.safeParse(requested) : null;
  const today = localDate(await now(db, user.siteId), me.timezone);
  const date: DateOnly =
    parsed?.success ? parsed.data : (await latestDayWithRecords(db, user.siteId)) ?? today;

  let summary;
  try {
    summary = await getDaySummary(db, user.siteId, date);
  } catch (error) {
    if (isNotFound(error)) {
      return (
        <div className="flex flex-col gap-6">
          <PageHeader title="Day summary" description={formatDay(date, me.timezone)} />
          <EmptyState
            icon={CalendarDaysIcon}
            title="No shift on this date"
            description={`Nothing was rolled over for ${formatDay(date, me.timezone)}.`}
          />
        </div>
      );
    }
    throw error;
  }

  const trendMax = Math.max(...summary.trend.map((t) => t.confirmationRate), 0.01);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Day summary"
        description={`${formatDay(date, me.timezone)} · ${me.siteName}`}
        actions={
          summary.locked ? (
            <Badge variant="outline">
              <LockIcon />
              Locked
            </Badge>
          ) : (
            <Badge variant="outline">Draft — day not locked</Badge>
          )
        }
      />

      {summary.amended ? (
        <div className="rounded-card border border-state-noreply/40 bg-state-noreply-bg px-4 py-3 text-sm text-ink">
          This day was amended after it had been published. You are looking at
          revision {summary.revision}.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="On shift" value={summary.counts.total} />
        <StatCard
          label="Confirmed"
          value={summary.counts.confirmed}
          tone="positive"
          hint={`${Math.round(rate(summary.counts.confirmed, summary.counts.total) * 100)}% of the shift`}
        />
        <StatCard
          label="Disputes"
          value={summary.counts.disputed}
          tone={summary.counts.disputed > 0 ? "critical" : "default"}
          hint={`${summary.counts.disputesOpen} still open`}
        />
        <StatCard
          label="Open hazards"
          value={summary.hazards.open}
          tone={summary.hazards.untriaged > 0 ? "warning" : "positive"}
          hint={`${summary.hazards.untriaged} untriaged`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Confirmation rate, last 7 days</CardTitle>
          <CardDescription>
            Share of workers who confirmed their own record each day.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2" style={{ height: "8rem" }}>
            {summary.trend.map((point) => (
              <div key={point.date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-primary"
                  style={{
                    height: `${Math.max((point.confirmationRate / trendMax) * 100, 2)}%`,
                  }}
                  role="img"
                  aria-label={`${point.date}: ${Math.round(point.confirmationRate * 100)} percent confirmed`}
                />
                <span className="text-center text-xs text-ink-muted">
                  {point.date.slice(8)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {summary.narrative ? (
        <Card>
          <CardHeader>
            <CardTitle>Site narrative</CardTitle>
            <CardDescription>Published with this day&apos;s figures.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Rendered as plain text, never as markup: this is site-authored
                prose and must not be able to inject anything. */}
            <p className="text-ink">{summary.narrative}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By team</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.byTeam.length === 0 ? (
              <p className="text-sm text-ink-muted">No workers were rostered.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-ink-muted">
                    <th scope="col" className="pb-2 font-medium">Team</th>
                    <th scope="col" className="pb-2 text-right font-medium">Total</th>
                    <th scope="col" className="pb-2 text-right font-medium">Confirmed</th>
                    <th scope="col" className="pb-2 text-right font-medium">Disputed</th>
                    <th scope="col" className="pb-2 text-right font-medium">No reply</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byTeam.map((team) => (
                    <tr key={team.teamName} className="border-b border-border last:border-0">
                      <th scope="row" className="py-2 font-medium text-ink">{team.teamName}</th>
                      <td className="py-2 text-right text-ink-muted">{team.total}</td>
                      <td className="py-2 text-right text-state-confirmed">{team.confirmed}</td>
                      <td className="py-2 text-right text-state-disputed">{team.disputed}</td>
                      <td className="py-2 text-right text-state-noreply">{team.noReply}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Disputes on this day</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.disputes.length === 0 ? (
              <p className="text-sm text-ink-muted">Nobody disputed their record.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {summary.disputes.map((dispute, index) => (
                  <li key={index} className="flex flex-col">
                    <span className="font-medium text-ink">
                      {dispute.workerName} <span className="text-ink-muted">— {dispute.outcome}</span>
                    </span>
                    {dispute.note ? (
                      <span className="text-sm text-ink-muted">{dispute.note}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.tasks.length === 0 ? (
              <p className="text-sm text-ink-muted">No tasks were published for this day.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {summary.tasks.map((task, index) => (
                  <li key={index} className="flex flex-col">
                    <span className="font-medium text-ink">{task.title}</span>
                    <span className="text-sm text-ink-muted">{task.ownerName}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hazards</CardTitle>
            <CardDescription>
              {summary.hazards.opened} opened, {summary.hazards.closed} closed,{' '}
              {summary.hazards.open} still open.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary.hazards.items.length === 0 ? (
              <p className="text-sm text-ink-muted">No open hazards.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {summary.hazards.items.map((item) => (
                  <li key={item.code} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{item.code}</span>
                      <SeverityBadge severity={item.severity} />
                      <HazardStatusBadge status={item.status} />
                    </div>
                    <span className="text-sm text-ink-muted">{item.summary}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-sm text-ink-muted">
        Figures are for your site only. See{" "}
        <Link href="/attendance" className="text-primary underline underline-offset-4">
          attendance
        </Link>{" "}
        for the underlying records.
      </p>
    </div>
  );
}

function rate(a: number, b: number) {
  return b === 0 ? 0 : a / b;
}

function formatDay(date: DateOnly, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}
