import Link from "next/link";
import { ArrowRightIcon, CalendarDaysIcon, LockIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/feedback";
import { HazardStatusBadge, RateBar, SeverityBadge, StatCard, WorkerStateBadge } from "@/components/status";

import { requireSession, toRenderable } from "@/lib/auth/dal";
import { getDayAttendance, latestDayWithRecords } from "@/lib/domain/attendance";
import { listDisputes } from "@/lib/domain/disputes";
import { listHazards } from "@/lib/domain/hazards";
import { listDayTasks } from "@/lib/domain/tasks";
import { localDate, now } from "@/lib/domain/clock";

/**
 * "Today" -- what a supervisor needs before the shift ends.
 *
 * Ordered by what has to happen next, not by what is most interesting:
 * disputes waiting on a decision, hazards nobody has judged, attendance that
 * nobody has confirmed, then the day's work. Every figure comes from the live
 * tables for the caller's own site, and every link goes to the queue that
 * produced the number rather than to a dead end.
 */
export default async function DashboardPage() {
  const { db, user, me } = await requireSession("/dashboard");

  const today = localDate(await now(db, user.siteId), me.timezone);

  // Land on a day that has records. A site whose roster for today has not been
  // rolled over yet would otherwise open on an empty screen every morning.
  const date = (await latestDayWithRecords(db, user.siteId)) ?? today;
  const isToday = date === today;

  const [attendance, disputes, hazards, tasks] = await Promise.all([
    // A day with no work day yet is a legitimate "nothing rolled over", not an
    // error, so the 404 is caught and rendered as an empty state.
    getDayAttendance(db, user.siteId, date).catch((error) => {
      const renderable = toRenderable(error);
      return renderable.kind === "not-found" ? null : Promise.reject(error);
    }),
    listDisputes(db, { status: "open" }),
    listHazards(db, { status: "reported" }),
    listDayTasks(db, user.siteId, date).catch(() => []),
  ]);

  if (attendance === null) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={`Today · ${me.siteName}`} description={formatDay(date, me.timezone)} />
        <EmptyState
          icon={CalendarDaysIcon}
          title="No shift has been rolled over yet"
          description={`No attendance records exist for ${formatDay(date, me.timezone)}. Records appear here once the day's roster is created for the site.`}
          action={
            <Button asChild variant="outline">
              <Link href="/attendance">Check another date</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const untriaged = hazards.items.filter((h) => h.severity === null);
  const hoursBooked = attendance.records.reduce((sum, r) => sum + r.hours, 0);
  const awaitingReply = attendance.counts.noReply;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Today · ${me.siteName}`}
        description={
          isToday
            ? `Shift ends ${me.shiftEnd}. Site time is ${me.timezone}.`
            : `Showing the most recent shift with records: ${formatDay(date, me.timezone)}.`
        }
        actions={
          <Button asChild variant="outline">
            <Link href={`/attendance?date=${date}`}>
              Full attendance
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        }
      />

      {attendance.locked ? (
        <div className="flex items-center gap-2 rounded-card border border-border bg-surface px-4 py-3 text-sm text-ink-muted">
          <LockIcon className="size-4 shrink-0" />
          This day is locked. Figures are final; a later correction is recorded as
          an amendment.
        </div>
      ) : null}

      {/* The three numbers that decide whether the day is done. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Workers rostered"
          value={attendance.counts.total}
          hint={`${hoursBooked} hours booked`}
        />
        <StatCard
          label="Waiting on a reply"
          value={awaitingReply}
          tone={awaitingReply > 0 ? "warning" : "positive"}
          hint={attendance.counts.confirmed + " confirmed so far"}
        />
        <StatCard
          label="Open disputes"
          value={disputes.length}
          tone={disputes.length > 0 ? "critical" : "positive"}
          hint="Need a decision"
        />
        <StatCard
          label="Untried hazards"
          value={untriaged.length}
          tone={untriaged.length > 0 ? "critical" : "positive"}
          hint={`${hazards.items.length} reported in total`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Worker confirmation</CardTitle>
          <CardDescription>
            Each worker confirms their own record, so an unpaid dispute is rare
            and a wrong record is caught before payroll.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RateBar confirmed={attendance.counts.confirmed} total={attendance.counts.total} />
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* Disputes first: they are the only item that blocks payroll. */}
        <Card>
          <CardHeader>
            <CardTitle>Disputes waiting on you</CardTitle>
            <CardDescription>Workers who said the record is wrong.</CardDescription>
          </CardHeader>
          <CardContent>
            {disputes.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Nothing disputed. Every worker who replied agreed with the record.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {disputes.slice(0, 4).map((dispute) => (
                  <li key={dispute.id} className="flex flex-col gap-1">
                    <Link
                      href={`/disputes/${dispute.id}`}
                      className="-mx-1 flex min-h-11 w-fit items-center rounded-control px-1 font-medium text-primary underline underline-offset-4"
                    >
                      {dispute.workerName}
                    </Link>
                    <p className="text-sm text-ink-muted">
                      {dispute.reasonText ?? 'No reason given.'}
                    </p>
                    <p className="text-sm text-ink-muted">
                      Record says {dispute.record.status.replace('_', ' ')},{' '}
                      {dispute.record.hours}h
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
          <div className="border-t bg-bg px-4 py-3">
            <Button asChild variant="link">
              <Link href="/disputes">
                All disputes
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hazards awaiting triage</CardTitle>
            <CardDescription>Nobody has judged the severity yet.</CardDescription>
          </CardHeader>
          <CardContent>
            {hazards.items.length === 0 ? (
              <p className="text-sm text-ink-muted">No open hazards reported.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {hazards.items.slice(0, 4).map((hazard) => (
                  <li key={hazard.id} className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/hazards/${hazard.id}`}
                        className="-mx-1 flex min-h-11 w-fit items-center rounded-control px-1 font-medium text-primary underline underline-offset-4"
                      >
                        {hazard.code}
                      </Link>
                      <SeverityBadge severity={hazard.severity} />
                      <HazardStatusBadge status={hazard.status} />
                    </div>
                    <p className="text-sm text-ink-muted">{hazard.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
          <div className="border-t bg-bg px-4 py-3">
            <Button asChild variant="link">
              <Link href="/hazards">
                All hazards
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </Card>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Who still owes a reply</CardTitle>
            <CardDescription>
              These workers have not confirmed the record Buildora sent them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {awaitingReply === 0 ? (
              <p className="text-sm text-ink-muted">
                Every worker on shift has replied.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {attendance.records
                  .filter((record) => record.workerState === "no_reply")
                  .slice(0, 6)
                  .map((record) => (
                    <li
                      key={record.id}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="font-medium text-ink">{record.workerName}</span>
                      <span className="flex items-center gap-2">
                        {record.teamName ? (
                          <Badge variant="outline">{record.teamName}</Badge>
                        ) : null}
                        <WorkerStateBadge state={record.workerState} />
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tasks for the day</CardTitle>
            <CardDescription>Each task has one named owner.</CardDescription>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-sm text-ink-muted">
                No tasks published for this day yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {tasks.slice(0, 6).map((task) => (
                  <li key={task.id} className="flex flex-col">
                    <span className="font-medium text-ink">{task.title}</span>
                    <span className="text-sm text-ink-muted">
                      {task.ownerName}
                      {task.location ? ` · ${task.location}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
          <div className="border-t bg-bg px-4 py-3">
            <Button asChild variant="link">
              <Link href="/tasks">
                Manage tasks
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

/** Renders a site-local date the way it is written on site, not in UTC. */
function formatDay(date: string, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T00:00:00Z`));
}
