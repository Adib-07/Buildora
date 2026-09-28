"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Mic } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CounterTile, type CounterTone } from "@/components/saakshi/counter-tile";
import { CutoffCountdown } from "@/components/saakshi/cutoff-countdown";
import { DisputeCard } from "@/components/saakshi/dispute-card";
import { EmptyState } from "@/components/saakshi/empty-state";
import { StateBadge } from "@/components/saakshi/state-badge";
import { WorkerRow } from "@/components/saakshi/worker-row";
import type { WorkerState } from "@/contracts";
import { ATTENDANCE, ATTENDANCE_COUNTS, DISPUTES, SITE, TODAY } from "@/mocks/fixtures";

const TILES: { tone: CounterTone; state: WorkerState; label: string }[] = [
  { tone: "confirmed", state: "confirmed", label: "Confirmed" },
  { tone: "disputed", state: "disputed", label: "Disputed" },
  { tone: "no_reply", state: "no_reply", label: "No reply" },
];

const CUTOFF_TARGET = `${TODAY}T${SITE.summaryCutoff}:00+05:30`;

export default function TodayPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<WorkerState | null>(null);

  const openDisputes = DISPUTES.filter((d) => d.status === "open");
  const rows = useMemo(() => ATTENDANCE.filter((r) => (filter ? r.workerState === filter : true)), [filter]);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-5">
      <CutoffCountdown target={CUTOFF_TARGET} serverNow={new Date().toISOString()} />

      <div className="flex gap-2">
        {TILES.map(({ tone, state, label }) => (
          <CounterTile
            key={state}
            label={label}
            count={ATTENDANCE_COUNTS[state === "no_reply" ? "noReply" : state]}
            tone={tone}
            pressed={filter === state}
            onClick={() => setFilter(filter === state ? null : state)}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <Button asChild className="flex-1">
          <Link href="/s/rollcall">Roll-call</Link>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link href="/s/tasks">
            <Mic data-icon="inline-start" />
            Plan tasks
          </Link>
        </Button>
      </div>

      {openDisputes.length > 0 && (
        <section aria-label="Open disputes" className="flex flex-col gap-3">
          {openDisputes.map((dispute) => (
            <DisputeCard
              key={dispute.id}
              workerName={dispute.workerName}
              reasonText={dispute.reasonText}
              record={dispute.record}
              status={dispute.status}
              createdAt={dispute.createdAt}
              onPress={() => router.push(`/s/disputes/${dispute.id}`)}
            />
          ))}
        </section>
      )}

      <div className="flex flex-col gap-2">
        {rows.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No one matches this filter" description="Tap the tile again to clear it." />
        ) : (
          rows.map((record) => (
            <WorkerRow
              key={record.id}
              name={record.workerName}
              teamName={record.teamName}
              trailing={<StateBadge state={record.workerState} size="sm" />}
            />
          ))
        )}
      </div>
    </div>
  );
}
