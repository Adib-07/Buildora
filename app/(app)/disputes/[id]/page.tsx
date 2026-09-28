import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ForbiddenState, PageHeader } from "@/components/feedback";
import { AttendanceStatusBadge, WorkerStateBadge } from "@/components/status";
import { Button } from "@/components/ui/button";

import { requireSession } from "@/lib/auth/dal";
import { getDispute } from "@/lib/domain/disputes";
import { isNotFound } from "@/lib/domain/errors";

import { DisputeResolver } from "./dispute-resolver";

/**
 * One dispute, with the record's full history beside it.
 *
 * The history is the point: a supervisor deciding whether a worker is right is
 * deciding against a sequence of what the worker was told. Showing only the
 * current numbers would make the decision guesswork.
 */
export default async function DisputeDetailPage(props: PageProps<"/disputes/[id]">) {
  const { db, user } = await requireSession("/disputes");
  const { id } = await props.params;

  let dispute;
  try {
    dispute = await getDispute(db, id);
  } catch (error) {
    // RLS makes another site's dispute invisible, so "not found" and "not yours"
    // are the same page -- which is also what stops ids being probed.
    if (isNotFound(error)) notFound();
    throw error;
  }

  if (user.role !== "supervisor") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={dispute.workerName} description="Disputed attendance record" />
        <ForbiddenState message="Only a site supervisor can decide a dispute. You can read the full detail below." />
        <RecordView dispute={dispute} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" className="-ml-3 self-start">
        <Link href="/disputes">
          <ArrowLeftIcon data-icon="inline-start" />
          All disputes
        </Link>
      </Button>

      <PageHeader
        title={dispute.workerName}
        description={`Disputed the record showing ${dispute.record.status.replace("_", " ")}, ${dispute.record.hours}h.`}
        actions={
          <Badge variant={dispute.status === "open" ? "destructive" : "outline"}>
            {dispute.status === "open" ? "Needs a decision" : dispute.status}
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>What the worker said</CardTitle>
            <CardDescription>
              The reason given with the dispute.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <blockquote className="rounded-control border-l-4 border-primary bg-primary-soft px-4 py-3 text-ink">
              {dispute.reasonText ?? "No reason was recorded with this dispute."}
            </blockquote>
            {dispute.reasonAudioUrl ? (
              <audio controls src={dispute.reasonAudioUrl} className="mt-3 w-full">
                <track kind="captions" />
              </audio>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Record history</CardTitle>
            <CardDescription>
              Every version this record has been at, oldest first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-3">
              {dispute.history.map((entry) => (
                <li key={entry.version} className="flex flex-col gap-1 border-l-2 border-border pl-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">Version {entry.version}</span>
                    <AttendanceStatusBadge status={entry.status} />
                    <span className="text-sm text-ink-muted">{entry.hours}h</span>
                  </div>
                  <p className="text-sm text-ink-muted">
                    {entry.reason ?? "No reason recorded."}
                  </p>
                </li>
              ))}
              {dispute.history.length === 0 ? (
                <li className="text-sm text-ink-muted">
                  This record has not been edited since it was created.
                </li>
              ) : null}
            </ol>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your decision</CardTitle>
          <CardDescription>
            Either change the record to match what the worker said, or keep it and
            record why. The decision is written to the audit trail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DisputeResolver dispute={dispute} />
        </CardContent>
      </Card>
    </div>
  );
}

function RecordView({ dispute }: { dispute: Awaited<ReturnType<typeof getDispute>> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Record under dispute</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
          <AttendanceStatusBadge status={dispute.record.status} />
          <WorkerStateBadge state="disputed" />
          <span className="text-ink-muted">
            {dispute.record.hours}h{dispute.record.late ? ", marked late" : ""}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
