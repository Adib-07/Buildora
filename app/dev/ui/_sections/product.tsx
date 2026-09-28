"use client";

import { useState } from "react";
import { ClipboardList, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AttendanceSheet } from "@/components/saakshi/attendance-sheet";
import { BottomTabs, type BottomTabItem } from "@/components/saakshi/bottom-tabs";
import { ConfirmationBar } from "@/components/saakshi/confirmation-bar";
import { CounterTile } from "@/components/saakshi/counter-tile";
import { CutoffCountdown } from "@/components/saakshi/cutoff-countdown";
import { DemoControls, type DemoAction } from "@/components/saakshi/demo-controls";
import { DisputeCard } from "@/components/saakshi/dispute-card";
import { EmptyState } from "@/components/saakshi/empty-state";
import { ErrorState } from "@/components/saakshi/error-state";
import { HazardCard } from "@/components/saakshi/hazard-card";
import { HazardStatusStepper } from "@/components/saakshi/hazard-status-stepper";
import { MicButton, type MicButtonState } from "@/components/saakshi/mic-button";
import { OfflineBanner } from "@/components/saakshi/offline-banner";
import { OwnerPicker, type OwnerCandidate } from "@/components/saakshi/owner-picker";
import { PageHeader } from "@/components/saakshi/page-header";
import { PhoneSimulator } from "@/components/saakshi/phone-simulator";
import { PhotoCapture, type PhotoCaptureState } from "@/components/saakshi/photo-capture";
import { ResolveDisputeForm } from "@/components/saakshi/resolve-dispute-form";
import { SeverityBadge } from "@/components/saakshi/severity-badge";
import { SkeletonRow } from "@/components/saakshi/skeleton-row";
import { StateBadge } from "@/components/saakshi/state-badge";
import { SummaryHeadline } from "@/components/saakshi/summary-headline";
import { TaskDraftCard } from "@/components/saakshi/task-draft-card";
import { WorkerRow } from "@/components/saakshi/worker-row";
import type { AttStatus, HazardStatus, SimMessage, WorkerState } from "@/contracts";

import { Section, Subsection } from "../_components/section";

const WORKER_STATES: WorkerState[] = ["confirmed", "disputed", "no_reply"];
const HAZARD_STATUSES: HazardStatus[] = ["reported", "assigned", "fixed_awaiting_reporter", "closed", "closed_unverified", "reopened"];

const ROSTER: OwnerCandidate[] = [
  { workerId: "w-ramesh", name: "Ramesh" },
  { workerId: "w-lakshmi", name: "Lakshmi" },
  { workerId: "w-venkat", name: "Venkat" },
  { workerId: "w-suresh", name: "Suresh" },
  { workerId: "w-kiran", name: "Kiran" },
];
const CANDIDATES = ROSTER.filter((w) => w.workerId === "w-suresh" || w.workerId === "w-kiran");

export function Product() {
  // Date.now() is impure, so every fixed sample timestamp below reads from
  // one value computed once at mount, in the useState initializer form the
  // React Compiler's purity rule recognises as safe.
  const [now] = useState(() => Date.now());

  return (
    <>
      <Section
        id="p-status"
        title="Status, counts and stepper"
        description="Worker state is always icon + word + colour, never colour alone."
      >
        <Subsection title="StateBadge">
          <div className="flex flex-wrap gap-3">
            {WORKER_STATES.map((state) => (
              <StateBadge key={state} state={state} />
            ))}
            {WORKER_STATES.map((state) => (
              <StateBadge key={state} state={state} size="sm" />
            ))}
          </div>
        </Subsection>

        <Subsection title="SeverityBadge">
          <div className="flex flex-wrap gap-3">
            <SeverityBadge severity={3} />
            <SeverityBadge severity={2} />
            <SeverityBadge severity={1} />
            <SeverityBadge severity={null} />
          </div>
        </Subsection>

        <CounterTileDemo />

        <Subsection title="ConfirmationBar">
          <ConfirmationBar confirmed={20} disputed={1} noReply={15} />
        </Subsection>

        <Subsection title="SummaryHeadline">
          <div className="flex flex-col gap-3">
            <SummaryHeadline confirmed={33} total={36} locked={false} amended={false} />
            <SummaryHeadline confirmed={36} total={36} locked amended />
          </div>
        </Subsection>

        <Subsection title="HazardStatusStepper">
          <div className="flex flex-col gap-6">
            {HAZARD_STATUSES.map((status) => (
              <HazardStatusStepper key={status} status={status} />
            ))}
          </div>
        </Subsection>
      </Section>

      <Section id="p-lists" title="Lists, page chrome and connectivity">
        <Subsection title="CutoffCountdown">
          <div className="flex flex-col gap-2">
            <CutoffCountdown target={new Date(now + 45 * 60_000).toISOString()} serverNow={new Date(now).toISOString()} />
            <CutoffCountdown target={new Date(now + 10 * 60_000).toISOString()} serverNow={new Date(now).toISOString()} />
            <CutoffCountdown target={new Date(now - 60_000).toISOString()} serverNow={new Date(now).toISOString()} />
          </div>
        </Subsection>

        <Subsection title="WorkerRow">
          <div className="flex flex-col gap-2">
            <WorkerRowDemo />
          </div>
        </Subsection>

        <Subsection title="SkeletonRow, EmptyState, ErrorState">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="flex flex-col gap-2">
              <SkeletonRow />
              <SkeletonRow />
            </div>
            <EmptyState icon={Search} title="No workers found" description="Try a different search." />
            <ErrorState requestId="req_7f3a2c" onRetry={() => {}} />
          </div>
        </Subsection>

        <Subsection title="PageHeader and BottomTabs">
          <div className="overflow-hidden rounded-card border border-border">
            <PageHeader siteName="Green Park Towers (demo)" date="Monday, 28 September" />
            <BottomTabsDemo />
          </div>
        </Subsection>

        <Subsection title="OfflineBanner">
          <OfflineBanner forceOffline className="rounded-card" />
        </Subsection>
      </Section>

      <Section id="p-rollcall" title="Roll-call and disputes">
        <Subsection title="AttendanceSheet">
          <AttendanceSheetDemo />
        </Subsection>

        <Subsection title="DisputeCard">
          <div className="flex flex-col gap-3">
            <DisputeCard
              workerName="Lakshmi"
              reasonText="I was here by 8, just late to reply."
              record={{ status: "present", hours: 8, late: false }}
              status="open"
              createdAt={new Date(now - 20 * 60_000).toISOString()}
              onPress={() => {}}
            />
            <DisputeCard
              workerName="Ramesh"
              reasonText={null}
              record={{ status: "half_day", hours: 4, late: true }}
              status="corrected"
              resolutionNote="Confirmed with site engineer."
              createdAt={new Date(now - 26 * 3_600_000).toISOString()}
            />
            <DisputeCard
              workerName="Suresh"
              reasonText="I texted 1 this morning."
              record={{ status: "present", hours: 8, late: false }}
              status="upheld"
              resolutionNote="Original record confirmed by supervisor on site."
              createdAt={new Date(now - 2 * 24 * 3_600_000).toISOString()}
            />
          </div>
        </Subsection>

        <Subsection title="ResolveDisputeForm">
          <ResolveDisputeForm
            initialRecord={{ status: "present", hours: 8, late: false }}
            onSubmit={() => {}}
            className="max-w-md"
          />
        </Subsection>
      </Section>

      <Section id="p-tasks" title="Tasks">
        <Subsection title="MicButton">
          <MicButtonDemo />
        </Subsection>

        <Subsection title="OwnerPicker">
          <div className="flex flex-col gap-4 sm:flex-row">
            <OwnerPickerDemo candidates={CANDIDATES} label="With ambiguous candidates" />
            <OwnerPickerDemo candidates={[]} label="Search only" />
          </div>
        </Subsection>

        <Subsection title="TaskDraftCard">
          <div className="grid gap-4 sm:grid-cols-2">
            <TaskDraftCardDemo initialOwner="w-ramesh" />
            <TaskDraftCardDemo initialOwner={null} />
          </div>
        </Subsection>
      </Section>

      <Section id="p-hazards" title="Hazards">
        <Subsection title="HazardCard">
          <div className="grid gap-4 sm:grid-cols-2">
            <HazardCard
              onPress={() => {}}
              hazard={{
                code: "HZ-014",
                category: "electrical",
                locationText: "Block C, 3rd floor",
                severity: 3,
                summary: "Exposed wiring near the site office entrance, close to the water point.",
                status: "assigned",
                owner: { type: "staff", id: "s-1", name: "Kiran" },
                reporterCount: 2,
                createdAt: new Date(now - 2 * 3_600_000).toISOString(),
                aiStatus: "ok",
              }}
            />
            <HazardCard
              hazard={{
                code: "HZ-015",
                category: "fall_edge",
                locationText: null,
                severity: null,
                summary: "H open edge near scaffold, no guardrail, second floor east side.",
                status: "reported",
                owner: null,
                reporterCount: 1,
                createdAt: new Date(now - 8 * 60_000).toISOString(),
                aiStatus: "fallback",
              }}
            />
          </div>
        </Subsection>

        <Subsection title="PhotoCapture">
          <div className="grid gap-4 sm:grid-cols-2">
            <PhotoCaptureDemo />
          </div>
        </Subsection>
      </Section>

      <Section id="p-demo" title="Demo mode">
        <Subsection title="PhoneSimulator">
          <PhoneSimulatorDemo />
        </Subsection>
        <Subsection title="DemoControls">
          <DemoControlsDemo />
        </Subsection>
      </Section>
    </>
  );
}

function CounterTileDemo() {
  const [pressed, setPressed] = useState<WorkerState | null>(null);
  return (
    <Subsection title="CounterTile">
      <div className="flex max-w-md gap-2">
        <CounterTile
          label="Confirmed"
          count={20}
          tone="confirmed"
          pressed={pressed === "confirmed"}
          onClick={() => setPressed(pressed === "confirmed" ? null : "confirmed")}
        />
        <CounterTile
          label="Disputed"
          count={1}
          tone="disputed"
          pressed={pressed === "disputed"}
          onClick={() => setPressed(pressed === "disputed" ? null : "disputed")}
        />
        <CounterTile
          label="No reply"
          count={15}
          tone="no_reply"
          pressed={pressed === "no_reply"}
          onClick={() => setPressed(pressed === "no_reply" ? null : "no_reply")}
        />
      </div>
    </Subsection>
  );
}

function WorkerRowDemo() {
  return (
    <>
      <WorkerRow name="Ramesh" teamName="Masonry" trailing={<StateBadge state="confirmed" size="sm" />} onPress={() => {}} />
      <WorkerRow name="లక్ష్మి" lang="te" teamName="Shuttering" trailing={<StateBadge state="disputed" size="sm" />} onPress={() => {}} />
      <WorkerRow name="Venkat" teamName="Steel" trailing={<StateBadge state="no_reply" size="sm" />} onPress={() => {}} />
    </>
  );
}

function BottomTabsDemo() {
  const items: BottomTabItem[] = [
    { key: "today", label: "Today", icon: ClipboardList, href: "#today" },
    { key: "rollcall", label: "Roll-call", icon: ClipboardList, href: "#rollcall" },
    { key: "tasks", label: "Tasks", icon: ClipboardList, href: "#tasks" },
    { key: "hazards", label: "Hazards", icon: ClipboardList, href: "#hazards" },
    { key: "workers", label: "Workers", icon: ClipboardList, href: "#workers" },
  ];
  return <BottomTabs items={items} activeHref="#today" />;
}

function AttendanceSheetDemo() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AttStatus>("present");
  const [late, setLate] = useState(false);
  const [hours, setHours] = useState(8);
  const [saving, setSaving] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open for Ramesh</Button>
      <AttendanceSheet
        open={open}
        onOpenChange={setOpen}
        workerName="Ramesh"
        teamName="Masonry"
        status={status}
        late={late}
        hours={hours}
        onStatusChange={setStatus}
        onLateChange={setLate}
        onHoursChange={setHours}
        saving={saving}
        onSave={() => {
          setSaving(true);
          setTimeout(() => {
            setSaving(false);
            setOpen(false);
          }, 600);
        }}
      />
    </>
  );
}

function MicButtonDemo() {
  const [state, setState] = useState<MicButtonState>("idle");
  return (
    <div className="flex flex-wrap gap-6">
      <MicButton state={state} onStart={() => setState("recording")} onStop={() => setState("processing")} />
      <MicButton state="processing" onStart={() => {}} onStop={() => {}} />
      <MicButton state="error" errorMessage="Microphone permission denied" onStart={() => setState("recording")} onStop={() => {}} />
    </div>
  );
}

function OwnerPickerDemo({ candidates, label }: { candidates: OwnerCandidate[]; label: string }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <div className="flex flex-1 flex-col gap-2">
      <p className="text-sm text-ink-muted">{label}</p>
      <OwnerPicker roster={ROSTER} candidates={candidates} value={value} onChange={setValue} />
    </div>
  );
}

function TaskDraftCardDemo({ initialOwner }: { initialOwner: string | null }) {
  const [owner, setOwner] = useState(initialOwner);
  return (
    <TaskDraftCard
      title="Fix scaffold guardrail"
      location="Block C, 2nd floor"
      ownerWorkerId={owner}
      candidates={CANDIDATES}
      roster={ROSTER}
      onOwnerChange={setOwner}
      onRemove={() => {}}
    />
  );
}

function PhotoCaptureDemo() {
  const [state, setState] = useState<PhotoCaptureState>("idle");
  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-ink-muted">Idle → preview (pick a file)</p>
        <PhotoCapture
          state={state}
          onCapture={() => setState("preview")}
          onRetake={() => setState("idle")}
          onUse={() => setState("accepted")}
        />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-ink-muted">Rejected</p>
        <PhotoCapture state="rejected" rejectionReason="This photo was already used for another hazard." onCapture={() => {}} onRetake={() => {}} />
      </div>
    </>
  );
}

function PhoneSimulatorDemo() {
  // Lazy initializer: the array literal only runs once, at mount, so
  // Date.now() inside it isn't called on every render.
  const [messages, setMessages] = useState<SimMessage[]>(() => [
    {
      id: "m1",
      direction: "in",
      body: "Ramesh, Masonry — Present, 8h, no late flag. Reply 1 to confirm, 2 to dispute.",
      templateKey: "confirm_prompt",
      createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    },
  ]);

  function append(body: string, templateKey: string | null = null) {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), direction: "out", body, templateKey, createdAt: new Date().toISOString() }]);
  }

  return (
    <PhoneSimulator
      label="Phone 1"
      phone="+919876543210"
      workerName="Ramesh"
      messages={messages}
      onSend={(text) => append(text)}
      onMissedCall={() => append("(missed call)")}
      onRecordVoice={() => append("(voice message)")}
    />
  );
}

function DemoControlsDemo() {
  const [busy, setBusy] = useState<DemoAction | null>(null);
  function run(action: DemoAction) {
    setBusy(action);
    setTimeout(() => setBusy(null), 600);
  }
  return (
    <DemoControls
      busy={busy}
      onJumpToShiftEnd={() => run("jump")}
      onLockDay={() => run("lock")}
      onReset={() => run("reset")}
    />
  );
}
