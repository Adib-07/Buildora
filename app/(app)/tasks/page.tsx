import Link from "next/link";
import { ClipboardListIcon, LockIcon, SparklesIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/feedback";

import { requireSession } from "@/lib/auth/dal";
import { listWorkers } from "@/lib/domain/workers";
import { listDayTasks } from "@/lib/domain/tasks";
import { getDayAttendance, latestDayWithRecords } from "@/lib/domain/attendance";
import { localDate, now } from "@/lib/domain/clock";
import { DateOnlySchema, type DateOnly } from "@/contracts";

import { TaskComposer } from "./task-composer";

/**
 * The day's work.
 *
 * Every published task has exactly one named owner, enforced by the database
 * rather than by the form. The composer is a review step, not an autofill: the
 * supervisor confirms the text and the owner before anything is written.
 */
export default async function TasksPage(props: PageProps<"/tasks">) {
  const { db, user, me } = await requireSession("/tasks");
  const params = await props.searchParams;

  const requested = typeof params.date === "string" ? params.date : null;
  const parsed = requested ? DateOnlySchema.safeParse(requested) : null;
  const today = localDate(await now(db, user.siteId), me.timezone);
  const date: DateOnly = parsed?.success ? parsed.data : (await latestDayWithRecords(db, user.siteId)) ?? today;

  const [tasks, roster, day] = await Promise.all([
    listDayTasks(db, user.siteId, date).catch(() => []),
    // Every page of the roster, because task creation needs the whole list to
    // pick an owner. A site roster is tens of people, not thousands.
    allWorkers(db, user.role),
    getDayAttendance(db, user.siteId, date).catch(() => null),
  ]);

  const locked = day?.locked ?? false;
  const canPublish = user.role === "supervisor" && !locked;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tasks"
        description={`${formatDay(date, me.timezone)} · ${tasks.length} published`}
      />

      {locked ? (
        <div className="flex items-center gap-2 rounded-card border border-border bg-surface px-4 py-3 text-sm text-ink-muted">
          <LockIcon className="size-4 shrink-0" />
          This day is locked, so no further tasks can be added to it.
        </div>
      ) : null}

      {canPublish ? (
        <Card>
          <CardHeader>
            <CardTitle>Add work for the day</CardTitle>
            <CardDescription>
              Write it as you would say it. Buildora splits it into tasks and
              suggests owners from your roster; you confirm before anything is
              published.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TaskComposer workers={roster} workDate={date} />
          </CardContent>
        </Card>
      ) : !locked ? (
        <Card>
          <CardContent>
            <p className="text-sm text-ink-muted">
              Only a site supervisor can publish tasks. You can see the day&apos;s
              work below.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Published for this day</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <EmptyState
              icon={ClipboardListIcon}
              title="No tasks for this day yet"
              description="Write the shift down above and publish it. Each task is assigned to one worker."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-wrap items-center gap-2 rounded-control border border-border p-3"
                >
                  <SparklesIcon className="size-4 shrink-0 text-ink-muted" />
                  <span className="font-medium text-ink">{task.title}</span>
                  {task.location ? (
                    <Badge variant="outline">{task.location}</Badge>
                  ) : null}
                  <span className="ml-auto text-sm text-ink-muted">{task.ownerName}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-ink-muted">
        Need the day as figures?{" "}
        {user.role === "supervisor" ? (
          <Link href="/attendance" className="text-primary underline underline-offset-4">
            Open attendance
          </Link>
        ) : (
          <Link href="/summary" className="text-primary underline underline-offset-4">
            Open the day summary
          </Link>
        )}
        .
      </p>
    </div>
  );
}

/** Walks the roster's pages so the composer can offer every active worker. */
async function allWorkers(db: Parameters<typeof listWorkers>[0], role: "supervisor" | "engineer" | "owner") {
  const items = [];
  let cursor: string | null = null;
  do {
    const page = await listWorkers(db, role, { active: true, cursor });
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor && items.length < 500);
  return items;
}

function formatDay(date: DateOnly, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T00:00:00Z`));
}
