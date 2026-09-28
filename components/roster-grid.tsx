import Link from "next/link";

import { AttendanceStatusBadge } from "@/components/status";
import {
  DataGrid,
  GridCell,
  GridHead,
  GridHeadCell,
  GridRow,
  Metric,
  StatusPill,
} from "@/components/status-pill";

import type { DayAttendance } from "@/contracts";
import type { WorkerState } from "@/contracts";

/**
 * Shift settlement roster.
 *
 * Built to be read down a column rather than across a row, because that is how a
 * supervisor settles a shift: find the rows that are not green, deal with those,
 * then look at the total. So worker state is the first column after identity
 * rather than the last, and every number is tabular so the column edges align.
 *
 * Every figure here is a count or a sum over the records the caller was just
 * shown. There is no wage-rate column in the schema, so there is deliberately no
 * money total on this screen: a currency figure with no source behind it is the
 * one thing a payroll screen must never invent.
 */

/** `confirmed` is the only state that needs no attention from a supervisor. */
const STATE_COPY: Record<
  WorkerState,
  { label: string; tone: 'confirmed' | 'disputed' | 'pending' }
> = {
  confirmed: { label: 'Confirmed', tone: 'confirmed' },
  disputed: { label: 'Disputed', tone: 'disputed' },
  no_reply: { label: 'No reply', tone: 'pending' },
};

export function RosterGrid({
  day,
  shiftEnd,
  demo,
}: {
  day: DayAttendance;
  /** The site's shift end, shown as the closing time on every row. */
  shiftEnd: string;
  /** Opens the dispute queue from a disputed row. */
  demo?: boolean;
}) {
  const { counts, records } = day;

  const hoursBooked = records.reduce((sum, record) => sum + record.hours, 0);
  const confirmedRate = counts.total === 0 ? 0 : Math.round((counts.confirmed / counts.total) * 100);
  const settled = counts.total - counts.disputed - counts.noReply;

  return (
    <>
      {/* KPI bar. Derived from `counts`, which is itself derived from the rows
          below in the same request, so a card can never contradict the table. */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="On shift" value={counts.total} hint={`${hoursBooked.toFixed(1)} hours booked`} />
        <Metric
          label="Verified attendance"
          value={`${confirmedRate}%`}
          tone={confirmedRate >= 80 ? "confirmed" : "pending"}
          hint={`${counts.confirmed} confirmed by the worker`}
        />
        <Metric
          label="Open disputes"
          value={counts.disputed}
          tone={counts.disputed > 0 ? "disputed" : "confirmed"}
          hint={counts.disputed > 0 ? "Blocked from payroll" : "Nothing blocked"}
        />
        <Metric
          label="Awaiting reply"
          value={counts.noReply}
          tone={counts.noReply > 0 ? "pending" : "confirmed"}
          hint={`${settled} of ${counts.total} settled`}
        />
      </div>

      <DataGrid label={`Shift roster for ${day.date}`}>
        <GridHead>
          <GridHeadCell>Worker</GridHeadCell>
          <GridHeadCell>Team</GridHeadCell>
          <GridHeadCell>Worker state</GridHeadCell>
          <GridHeadCell>Supervisor record</GridHeadCell>
          <GridHeadCell numeric>
            Hours
          </GridHeadCell>
          <GridHeadCell numeric>Version</GridHeadCell>
        </GridHead>
        <tbody>
          {records.map((record) => {
            const state = STATE_COPY[record.workerState];
            return (
              <GridRow key={record.id}>
                <GridCell>
                  <span className="flex flex-col">
                    <span className="font-medium text-ink">{record.workerName}</span>
                    {record.late ? (
                      <span className="text-sm text-state-noreply">Late arrival</span>
                    ) : null}
                  </span>
                </GridCell>
                <GridCell className="text-ink-muted">
                  {record.teamName ?? <span className="text-ink-muted/60">—</span>}
                </GridCell>
                <GridCell>
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusPill
                      tone={state.tone}
                      // Only an outstanding state pulses. A settled row is
                      // static, so motion means "this needs you".
                      live={record.workerState === 'no_reply'}
                    >
                      {state.label}
                    </StatusPill>
                    {record.workerState === "disputed" ? (
                      <Link
                        href="/disputes"
                        className="-mx-1 inline-flex min-h-9 items-center rounded-control px-1 text-sm font-medium text-primary underline underline-offset-4"
                      >
                        Resolve
                      </Link>
                    ) : null}
                  </span>
                </GridCell>
                <GridCell>
                  <span className="flex items-center gap-2">
                    <AttendanceStatusBadge status={record.status} />
                    <span className="font-mono text-sm text-ink-muted">
                      {record.hours.toFixed(1)}h
                    </span>
                  </span>
                </GridCell>
                <GridCell numeric>{record.hours.toFixed(1)}</GridCell>
                <GridCell numeric className="text-ink-muted">
                  v{record.version}
                </GridCell>
              </GridRow>
            );
          })}
        </tbody>
      </DataGrid>

      <p className="text-sm text-ink-muted">
        Shift ends {shiftEnd}. {day.locked
          ? 'This day is locked and these figures are final.'
          : 'Figures are provisional until the day is locked.'}
        {demo ? ' AttendanceEditor actions remain available below each figure.' : null}
      </p>
    </>
  );
}
