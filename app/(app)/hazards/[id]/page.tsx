import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, MessageSquareIcon, UserIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ForbiddenState, PageHeader } from "@/components/feedback";
import { HazardStatusBadge, SeverityBadge } from "@/components/status";

import { requireSession } from "@/lib/auth/dal";
import { getHazard } from "@/lib/domain/hazards";
import { listWorkers } from "@/lib/domain/workers";
import { isNotFound } from "@/lib/domain/errors";

import { HazardTriage } from "./hazard-triage";

/**
 * One hazard: what was reported, who reported it, and what has been done.
 *
 * The reports are shown verbatim, including the ones from reporters Buildora
 * could not match to the roster. A hazard reported by an unknown number is
 * exactly the kind that is easy to dismiss and should not be.
 */
export default async function HazardDetailPage(props: PageProps<"/hazards/[id]">) {
  const { db, user } = await requireSession("/hazards");
  const { id } = await props.params;

  let hazard;
  try {
    hazard = await getHazard(db, id);
  } catch (error) {
    if (isNotFound(error)) notFound();
    throw error;
  }

  const workers =
    user.role === "supervisor"
      ? await collectWorkers(db, user.role)
      : [];

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" className="-ml-3 self-start">
        <Link href="/hazards">
          <ArrowLeftIcon data-icon="inline-start" />
          All hazards
        </Link>
      </Button>

      <PageHeader
        title={`${hazard.code} · ${hazard.summary}`}
        description={`Reported ${formatWhen(hazard.createdAt)}${
          hazard.reporterCount > 1 ? ` by ${hazard.reporterCount} people` : ""
        }.`}
        actions={
          <div className="flex gap-2">
            <SeverityBadge severity={hazard.severity} />
            <HazardStatusBadge status={hazard.status} />
          </div>
        }
      />

      {user.role !== "supervisor" ? (
        <ForbiddenState message="Only a site supervisor can triage a hazard. The report is below." />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>What was reported</CardTitle>
              <CardDescription>
                In the reporter&apos;s own words, kept exactly as it came in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hazard.reports.length === 0 ? (
                <p className="text-sm text-ink-muted">No report text was captured.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {hazard.reports.map((report) => (
                    <li key={report.id} className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <MessageSquareIcon className="size-4 shrink-0 text-ink-muted" />
                        <span className="text-sm font-medium text-ink">
                          {report.reporterName ?? 'Unverified reporter'}
                        </span>
                        {report.unverifiedReporter ? (
                          <Badge variant="outline">Not on the roster</Badge>
                        ) : null}
                        <span className="text-sm text-ink-muted">
                          {formatWhen(report.receivedAt)}
                        </span>
                      </div>
                      {report.transcript ? (
                        <blockquote className="rounded-control border-l-4 border-border bg-bg px-3 py-2 text-sm text-ink">
                          {report.transcript}
                        </blockquote>
                      ) : (
                        <p className="text-sm text-ink-muted">No text was captured.</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
              <CardDescription>Every recorded action on this hazard.</CardDescription>
            </CardHeader>
            <CardContent>
              {hazard.history.length === 0 ? (
                <p className="text-sm text-ink-muted">Nothing has been recorded yet.</p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {hazard.history.map((entry, index) => (
                    <li key={index} className="flex flex-col gap-1 border-l-2 border-border pl-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ink">{entry.action}</span>
                        <span className="text-sm text-ink-muted">
                          {entry.actorName} · {formatWhen(entry.at)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        {user.role === "supervisor" ? (
          <Card>
            <CardHeader>
              <CardTitle>Triage</CardTitle>
              <CardDescription>
                Judge the severity and give it an owner. Assigning an owner moves
                a reported hazard to assigned.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HazardTriage hazard={hazard} workers={workers} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Ownership</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="flex items-center gap-2 text-ink-muted">
                <UserIcon className="size-4 shrink-0" />
                {hazard.owner ? `${hazard.owner.name} (${hazard.owner.type})` : "No owner assigned yet."}
              </p>
              {hazard.dueAt ? (
                <p className="mt-2 text-sm text-ink-muted">Due {formatWhen(hazard.dueAt)}</p>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

async function collectWorkers(
  db: Parameters<typeof listWorkers>[0],
  role: "supervisor" | "engineer" | "owner",
) {
  const items = [];
  let cursor: string | null = null;
  do {
    const page = await listWorkers(db, role, { active: true, cursor });
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor && items.length < 500);
  return items;
}

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(iso));
}
