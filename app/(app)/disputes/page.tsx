import Link from "next/link";
import { CheckCircle2Icon, MessageSquareWarningIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/feedback";
import { StatCard, WorkerStateBadge } from "@/components/status";

import { requireSession } from "@/lib/auth/dal";
import { listDisputes } from "@/lib/domain/disputes";

/**
 * The dispute queue.
 *
 * One list, newest first, because a dispute is a person waiting to be told
 * whether they were right. A worker who disputes twice is one open item, not
 * two, so a duplicate never makes the queue look busier than it is.
 */
export default async function DisputesPage(props: PageProps<"/disputes">) {
  const { db } = await requireSession("/disputes");
  const params = await props.searchParams;
  const filter = params.status === "all" ? "all" : "open";

  const disputes = await listDisputes(db, { status: filter });
  const open = disputes.filter((d) => d.status === "open").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Disputes"
        description="Workers who said the record was wrong. Each one needs a decision before payroll."
        actions={
          <div className="flex gap-2">
            <Badge variant={filter === "open" ? "default" : "outline"}>
              <Link href="/disputes" className="px-1">
                Open
              </Link>
            </Badge>
            <Badge variant={filter === "all" ? "default" : "outline"}>
              <Link href="/disputes?status=all" className="px-1">
                All
              </Link>
            </Badge>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Showing" value={disputes.length} />
        <StatCard
          label="Still open"
          value={open}
          tone={open > 0 ? "critical" : "positive"}
        />
      </div>

      {disputes.length === 0 ? (
        <EmptyState
          icon={CheckCircle2Icon}
          title={filter === "open" ? "No open disputes" : "No disputes recorded"}
          description={
            filter === "open"
              ? "Every worker who replied agreed with the record they were sent."
              : "No worker has disputed a record yet."
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {disputes.map((dispute) => (
            <li key={dispute.id}>
              <Card>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <MessageSquareWarningIcon
                        className={`size-4 shrink-0 ${
                          dispute.status === "open" ? "text-state-disputed" : "text-ink-muted"
                        }`}
                      />
                      <Link
                        href={`/disputes/${dispute.id}`}
                        className="text-base font-semibold text-primary underline underline-offset-4"
                      >
                        {dispute.workerName}
                      </Link>
                      <Badge variant={dispute.status === "open" ? "destructive" : "outline"}>
                        {dispute.status === "open" ? "Needs a decision" : dispute.status}
                      </Badge>
                      <WorkerStateBadge state={dispute.status === "open" ? "disputed" : "confirmed"} />
                    </div>

                    <p className="text-ink-muted">
                      {dispute.reasonText ?? "No reason was given with this dispute."}
                    </p>

                    <p className="text-sm text-ink-muted">
                      Record under dispute: {dispute.record.status.replace("_", " ")},{' '}
                      {dispute.record.hours}h{dispute.record.late ? ", marked late" : ""}
                      {dispute.resolutionNote ? ` · Note: ${dispute.resolutionNote}` : ""}
                    </p>
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
