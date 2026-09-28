import Link from "next/link";
import { ShieldCheckIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/feedback";
import { HazardStatusBadge, SeverityBadge, StatCard } from "@/components/status";

import { requireSession } from "@/lib/auth/dal";
import { listHazards } from "@/lib/domain/hazards";
import { HazardCategorySchema, HazardStatusSchema, type HazardCategory, type HazardStatus } from "@/contracts";

const CATEGORIES: { value: HazardCategory; label: string }[] = [
  { value: "fall_edge", label: "Fall or open edge" },
  { value: "electrical", label: "Electrical" },
  { value: "excavation", label: "Excavation" },
  { value: "scaffold", label: "Scaffold" },
  { value: "machinery", label: "Machinery" },
  { value: "fire", label: "Fire" },
  { value: "housekeeping", label: "Housekeeping" },
  { value: "other", label: "Other" },
];

const STATUSES: { value: HazardStatus; label: string }[] = [
  { value: "reported", label: "Reported" },
  { value: "assigned", label: "Assigned" },
  { value: "fixed_awaiting_reporter", label: "Awaiting worker" },
  { value: "reopened", label: "Reopened" },
  { value: "closed", label: "Closed" },
];

/**
 * Safety hazards, newest first.
 *
 * The default view is everything still open, because a closed hazard is not
 * work. Severity is null until a supervisor judges it, and the untriaged count
 * is the number that matters: an unjudged hazard is a hazard nobody is dealing
 * with.
 */
export default async function HazardsPage(props: PageProps<"/hazards">) {
  const { db } = await requireSession("/hazards");
  const params = await props.searchParams;

  // Filters come from the query string and are validated against the contract's
  // enums. An unrecognised value falls back to "no filter" rather than erroring,
  // so a stale bookmark still shows the list.
  const statusFilter = parseEnum(params.status, HazardStatusSchema);
  const categoryFilter = parseEnum(params.category, HazardCategorySchema);

  const { items, nextCursor } = await listHazards(db, {
    status: statusFilter,
    category: categoryFilter,
  });

  const untriaged = items.filter((hazard) => hazard.severity === null).length;
  const critical = items.filter((hazard) => hazard.severity === 3).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Safety"
        description="Hazards reported from the site. Every one needs a severity and an owner."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Matching" value={items.length} />
        <StatCard
          label="Not yet triaged"
          value={untriaged}
          tone={untriaged > 0 ? "warning" : "positive"}
        />
        <StatCard
          label="High severity"
          value={critical}
          tone={critical > 0 ? "critical" : "positive"}
        />
      </div>

      {/* Filter controls are links, so a filtered view is shareable and the back
          button works. No client state, nothing to hydrate. */}
      <nav className="flex flex-wrap items-center gap-2" aria-label="Filter hazards">
        <FilterLink param="status" value={statusFilter} base="/hazards" allLabel="Any status">
          {STATUSES.map((s) => (
            <FilterChip key={s.value} param="status" value={s.value} current={statusFilter}>
              {s.label}
            </FilterChip>
          ))}
        </FilterLink>
        <span className="text-ink-muted" aria-hidden="true">
          ·
        </span>
        <FilterLink param="category" value={categoryFilter} base="/hazards" allLabel="Any type">
          {CATEGORIES.map((c) => (
            <FilterChip key={c.value} param="category" value={c.value} current={categoryFilter}>
              {c.label}
            </FilterChip>
          ))}
        </FilterLink>
      </nav>

      {items.length === 0 ? (
        <EmptyState
          icon={ShieldCheckIcon}
          title="No hazards match"
          description="Nothing has been reported for this filter. That is either good news or a filter that is too narrow."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((hazard) => (
            <li key={hazard.id}>
              <Card>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/hazards/${hazard.id}`}
                        className="text-base font-semibold text-primary underline underline-offset-4"
                      >
                        {hazard.code}
                      </Link>
                      <SeverityBadge severity={hazard.severity} />
                      <HazardStatusBadge status={hazard.status} />
                      {hazard.reporterCount > 1 ? (
                        <Badge variant="outline">{hazard.reporterCount} reports</Badge>
                      ) : null}
                    </div>

                    <p className="text-ink-muted">{hazard.summary}</p>

                    <p className="text-sm text-ink-muted">
                      {categoryLabel(hazard.category)}
                      {hazard.locationText ? ` · ${hazard.locationText}` : ""}
                      {hazard.owner ? ` · Owner: ${hazard.owner.name}` : " · No owner yet"}
                    </p>

                    {hazard.possibleDuplicate ? (
                      <p className="text-sm text-state-noreply">
                        May be the same as {hazard.possibleDuplicate.code}.
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {nextCursor ? (
        <p className="text-sm text-ink-muted">
          More hazards exist. Narrow the filter to see them.
        </p>
      ) : null}
    </div>
  );
}

function parseEnum<T extends string>(
  value: string | string[] | undefined,
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
): T | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

function categoryLabel(category: HazardCategory) {
  return CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

/** Keeps the other filter when one chip is clicked, so refining never resets. */
function buildHref(param: string, value: string | undefined, current: Record<string, string>) {
  const next = new URLSearchParams();
  for (const [key, existing] of Object.entries(current)) {
    if (key !== param && existing) next.set(key, existing);
  }
  if (value) next.set(param, value);
  const query = next.toString();
  return query ? `?${query}` : "";
}

function FilterLink({
  param,
  value,
  base,
  allLabel,
  children,
}: {
  param: string;
  value: string | undefined;
  base: string;
  allLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={value ? "outline" : "default"}>
        <Link href={`${base}${buildHref(param, undefined, { [param]: value ?? "" })}`}>
          {allLabel}
        </Link>
      </Badge>
      {children}
    </div>
  );
}

function FilterChip({
  param,
  value,
  current,
  children,
}: {
  param: string;
  value: string;
  current: string | undefined;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <Badge variant={active ? "default" : "outline"}>
      <Link href={`/hazards${buildHref(param, active ? undefined : value, { [param]: current ?? "" })}`}>
        {children}
      </Link>
    </Badge>
  );
}
