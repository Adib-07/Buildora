import type { Readiness } from '@/lib/domain/readiness';

/**
 * Shift report as Markdown.
 *
 * "Share / Export" produces this and hands it to the browser as a `.md` file.
 * Markdown rather than a screenshot or a PDF because it is text the reader can
 * copy into a message, diff against yesterday's, and grep -- and because
 * rendering it needs no dependency and no network call, which matters when the
 * whole point is that it works when the app is under pressure.
 *
 * Pure and synchronous. No database, no clock: the caller passes everything in
 * already rendered from the caller's own rows, so this cannot leak another
 * site's data and cannot be tested only by running the app.
 */

export type ReportInput = {
  siteName: string;
  date: string;
  /** Rendered in the site's timezone by the caller. */
  readableDate: string;
  timezone: string;
  shiftEnd: string;
  locked: boolean;
  readiness: Readiness;
  workers: {
    total: number;
    confirmed: number;
    disputed: number;
    noReply: number;
    hoursBooked: number;
  };
  openDisputes: { workerName: string; reason: string; hours: number }[];
  hazards: {
    code: string;
    summary: string;
    /** Numeric severity from the contract; rendered as-is. */
    severity: number | string | null;
    status: string;
  }[];
  tasks: { title: string; owner: string; location?: string | null }[];
  awaitingReply: string[];
  generatedAt: string;
};

/** Escapes the pipe and newline characters that would break a Markdown table. */
function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function pct(part: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

export function buildShiftReport(input: ReportInput): string {
  const {
    siteName,
    readableDate,
    timezone,
    shiftEnd,
    locked,
    readiness,
    workers,
    openDisputes,
    hazards,
    tasks,
    awaitingReply,
    generatedAt,
  } = input;

  const lines: string[] = [];

  lines.push(`# Shift report — ${siteName}`);
  lines.push('');
  lines.push(`**${readableDate}** · ${timezone} · shift ends ${shiftEnd}`);
  lines.push('');

  lines.push('## Readiness');
  lines.push('');
  lines.push(
    `**${readiness.score}/100** (${readiness.band}) — ${readiness.headline}`,
  );
  lines.push('');
  lines.push('| Component | Score | Weight | Status | Detail |');
  lines.push('| --- | ---: | ---: | --- | --- |');
  for (const component of readiness.components) {
    lines.push(
      `| ${cell(component.label)} | ${component.score} | ${component.weight} | ${cell(
        component.status,
      )} | ${cell(component.detail)} |`,
    );
  }
  lines.push('');

  if (readiness.improvements.length > 0) {
    lines.push('### Next actions');
    lines.push('');
    for (const item of readiness.improvements) {
      lines.push(`1. **${item.action}** — ${item.because}`);
    }
    lines.push('');
  }

  lines.push('## Attendance');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('| --- | ---: |');
  lines.push(`| Workers rostered | ${workers.total} |`);
  lines.push(`| Confirmed | ${workers.confirmed} (${pct(workers.confirmed, workers.total)}) |`);
  lines.push(`| Disputed | ${workers.disputed} |`);
  lines.push(`| No reply | ${workers.noReply} |`);
  lines.push(`| Hours booked | ${workers.hoursBooked} |`);
  lines.push(`| Day status | ${locked ? 'Locked' : 'Open'} |`);
  lines.push('');

  lines.push('## Disputes');
  lines.push('');
  if (openDisputes.length === 0) {
    lines.push('None. Every worker who disagreed has had a decision.');
  } else {
    lines.push('| Worker | Reason | Hours disputed |');
    lines.push('| --- | --- | ---: |');
    for (const dispute of openDisputes) {
      lines.push(
        `| ${cell(dispute.workerName)} | ${cell(dispute.reason)} | ${cell(dispute.hours)} |`,
      );
    }
  }
  lines.push('');

  lines.push('## Safety');
  lines.push('');
  if (hazards.length === 0) {
    lines.push('No hazards reported.');
  } else {
    lines.push('| Ref | Summary | Severity | Status |');
    lines.push('| --- | --- | --- | --- |');
    for (const hazard of hazards) {
      lines.push(
        `| ${cell(hazard.code)} | ${cell(hazard.summary)} | ${cell(
          hazard.severity,
        )} | ${cell(hazard.status)} |`,
      );
    }
  }
  lines.push('');

  lines.push('## Tasks');
  lines.push('');
  if (tasks.length === 0) {
    lines.push('No tasks published for this day.');
  } else {
    lines.push('| Task | Owner | Location |');
    lines.push('| --- | --- | --- |');
    for (const task of tasks) {
      lines.push(
        `| ${cell(task.title)} | ${cell(task.owner)} | ${cell(task.location)} |`,
      );
    }
  }
  lines.push('');

  if (awaitingReply.length > 0) {
    lines.push('## Awaiting confirmation');
    lines.push('');
    for (const name of awaitingReply) lines.push(`- ${name}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(
    `Generated by Buildora at ${generatedAt}. Figures cover this site only.`,
  );
  lines.push('');

  return lines.join('\n');
}

/** Stable, filesystem-safe filename: `buildora-shift-report-2026-09-28.md`. */
export function reportFilename(siteName: string, date: string): string {
  const slug = siteName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `buildora-shift-report-${slug ? `${slug}-` : ''}${date}.md`;
}
