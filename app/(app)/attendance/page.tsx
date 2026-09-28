import Link from "next/link";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, LockIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/feedback";
import { RosterGrid } from "@/components/roster-grid";
import { WorkerPhoneSimulator } from "@/components/worker-phone-simulator";

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

  // One real worker for the phone simulator. Chosen from this site's roster --
  // never invented -- so the phone shows a number that exists in the database
  // and the reply lands in a queue that can be inspected.
  let demoWorker: { workerId: string; workerName: string; phone: string } | null = null;
  if (me.demoMode) {
    const { data } = await db
      .from('workers')
      .select('id, full_name, phone_e164')
      .eq('site_id', user.siteId)
      .eq('active', true)
      .order('full_name')
      .limit(1);
    const row = data?.[0];
    if (row) {
      demoWorker = {
        workerId: row.id,
        workerName: row.full_name,
        phone: row.phone_e164,
      };
    }
  }

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

      <RosterGrid day={day} shiftEnd={me.shiftEnd} />

      {/* Only on a demo deployment, and only once a roster exists to read. */}
      {me.demoMode && demoWorker ? (
        <WorkerPhoneSimulator
          workerName={demoWorker.workerName}
          phone={demoWorker.phone}
          shiftWindow={`08:00 – ${me.shiftEnd}`}
          hours={day.records.find((r) => r.workerId === demoWorker.workerId)?.hours ?? 8}
        />
      ) : null}

      {/* Identity, state, hours and version are all in the grid above, so this
          block is only the editing surface. It renders for a supervisor on an
          unlocked day and nowhere else -- for a reader it would be the same rows
          twice with less information. */}
      {canEdit ? (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-ink">Adjust records</p>
              <p className="text-sm text-ink-muted">
                Every change is versioned, and a worker who already replied is
                asked again rather than being overwritten.
              </p>
            </div>
            <ul className="flex flex-col gap-3">
              {day.records.map((record) => (
                <li
                  key={record.id}
                  className="flex flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0"
                >
                  <p className="font-medium text-ink">
                    {record.workerName}
                    {record.teamName ? (
                      <span className="ml-2 text-sm text-ink-muted">
                        {record.teamName}
                      </span>
                    ) : null}
                  </p>
                  <AttendanceEditor
                    record={record}
                    disabled={!canEdit}
                    disabledReason={editReason}
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
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
