import Link from "next/link";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, LockIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/feedback";
import { AttendanceStatusBadge, RateBar, StatCard, WorkerStateBadge } from "@/components/status";

import { requireSession } from "@/lib/auth/dal";
import { getDayAttendance } from "@/lib/domain/attendance";
import { shiftDate } from "@/lib/domain/summary";
import { DateOnlySchema, type DateOnly } from "@/contracts";

import { AttendanceEditor } from "./attendance-editor";

/**
 * The day's attendance, and the one screen a supervisor edits.
 *
 * A record shows what the worker was told and how they replied, side by side, so
 * a correction is a decision rather than a guess. Editing is supervisor-only and
 * unavailable on a locked day, both decided from the session -- and re-checked by
 * the action.
 */
export default async function AttendancePage(props: PageProps<"/attendance">) {
  const { db, user, me } = await requireSession("/attendance");
  const params = await props.searchParams;

  // A date in the query string is a navigation aid, not authority: it selects
  // which of *this site's* days to show and is validated before use.
  const requested = typeof params.date === "string" ? params.date : null;
  const parsed = requested ? DateOnlySchema.safeParse(requested) : null;
  const date: DateOnly = parsed?.success ? parsed.data : localToday(me.timezone);

  let day;
  try {
    day = await getDayAttendance(db, user.siteId, date);
  } catch {
    day = null;
  }

  if (!day) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Attendance" description={formatDay(date, me.timezone)} />
        <EmptyState
          icon={CalendarDaysIcon}
          title="No records for this date"
          description={`There is no rolled-over shift for ${formatDay(date, me.timezone)}. Pick another date.`}
          action={<DayNav current={date} />}
        />
      </div>
    );
  }

  const canEdit = user.role === 'supervisor' && !day.locked;
  // Only sent to the client when it applies, so the read-only explanation does
  // not ride along in the payload for every editable row.
  const editReason = canEdit
    ? undefined
    : day.locked
      ? 'This day is locked. Corrections are recorded as amendments.'
      : 'Only a site supervisor can change a record.';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Attendance"
        description={`${formatDay(date, me.timezone)} · ${day.records.length} on shift`}
        actions={<DayNav current={date} />}
      />

      {day.locked ? (
        <div className="flex items-center gap-2 rounded-card border border-border bg-surface px-4 py-3 text-sm text-ink-muted">
          <LockIcon className="size-4 shrink-0" />
          Locked. These figures are final and have been published.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="On shift" value={day.counts.total} />
        <StatCard label="Confirmed" value={day.counts.confirmed} tone="positive" />
        <StatCard
          label="Awaiting reply"
          value={day.counts.noReply}
          tone={day.counts.noReply > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Disputed"
          value={day.counts.disputed}
          tone={day.counts.disputed > 0 ? "critical" : "default"}
        />
      </div>

      <Card>
        <CardContent>
          <RateBar confirmed={day.counts.confirmed} total={day.counts.total} />
        </CardContent>
      </Card>

      {day.records.length === 0 ? (
        <EmptyState
          icon={CalendarDaysIcon}
          title="Nobody is rostered for this day"
          description="Once the shift is rolled over, each worker appears here with their record."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {day.records.map((record) => (
            <li key={record.id}>
              <Card>
                <CardContent>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-ink">
                        {record.workerName}
                      </p>
                      {record.teamName ? (
                        <Badge variant="outline">{record.teamName}</Badge>
                      ) : null}
                      <AttendanceStatusBadge status={record.status} />
                      <WorkerStateBadge state={record.workerState} />
                      {record.late ? <Badge variant="outline">Late</Badge> : null}
                      <span className="ml-auto text-sm text-ink-muted">
                        {record.hours}h · v{record.version}
                      </span>
                    </div>

                    <AttendanceEditor
                      record={record}
                      disabled={!canEdit}
                      disabledReason={editReason}
                    />

                    {record.workerState === "disputed" ? (
                      <p className="text-sm text-state-disputed">
                        This worker disputed the record. Resolve it from the Disputes
                        queue so the reason is kept with the decision.
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DayNav({ current }: { current: DateOnly }) {
  const previous = shiftDate(current, -1);
  const next = shiftDate(current, 1);
  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="outline" size="icon">
        <Link href={`/attendance?date=${previous}`} title="Previous day">
          <ChevronLeftIcon />
          <span className="sr-only">Previous day</span>
        </Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/attendance">Today</Link>
      </Button>
      <Button asChild variant="outline" size="icon">
        <Link href={`/attendance?date=${next}`} title="Next day">
          <ChevronRightIcon />
          <span className="sr-only">Next day</span>
        </Link>
      </Button>
    </div>
  );
}

function localToday(timezone: string): DateOnly {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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
