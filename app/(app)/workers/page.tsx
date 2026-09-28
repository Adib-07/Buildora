import { UsersIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/feedback";
import { AddWorkerButton, EditWorkerForm } from "./worker-forms";

import { requireSession } from "@/lib/auth/dal";
import { listTeams } from "@/lib/domain/teams";
import { listWorkers } from "@/lib/domain/workers";

/**
 * The crew.
 *
 * Phone numbers and worker codes are the two fields the contract restricts by
 * role, and that restriction is applied in the mapper from the *session* role --
 * an engineer sees `+91XXXXXX3210` and no code at all, and there is nothing in
 * the page that could change that.
 */
export default async function WorkersPage() {
  const { db, user } = await requireSession("/workers");

  const [teams, workers] = await Promise.all([listTeams(db), collectWorkers(db, user.role)]);
  const active = workers.filter((w) => w.active);
  const inactive = workers.filter((w) => !w.active);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Crew"
        description={`${active.length} on the roster${inactive.length ? `, ${inactive.length} inactive` : ""}.`}
        actions={user.role === "supervisor" ? <AddWorkerButton teams={teams} /> : undefined}
      />

      {user.role !== "supervisor" ? (
        <p className="text-sm text-ink-muted">
          Phone numbers are partly hidden and worker codes are hidden entirely for
          your role. A supervisor can see both.
        </p>
      ) : null}

      {active.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="Nobody on the roster yet"
          description="Add the workers on this site. Each one needs a phone number so Buildora can reach them."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {active.map((worker) => (
            <li key={worker.id}>
              <Card>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-ink">{worker.fullName}</p>
                      {worker.teamName ? (
                        <Badge variant="outline">{worker.teamName}</Badge>
                      ) : (
                        <Badge variant="outline">No team</Badge>
                      )}
                      <Badge variant="outline">{languageLabel(worker.lang)}</Badge>
                    </div>

                    <p className="text-sm text-ink-muted">
                      {worker.phone}
                      {worker.workerCode ? ` · code ${worker.workerCode}` : ""}
                    </p>

                    {worker.consent !== "given" ? (
                      <p className="text-sm text-state-noreply">
                        {worker.consent === "pending"
                          ? "Has not confirmed they are happy to be contacted yet."
                          : "Has withdrawn consent to being contacted."}
                      </p>
                    ) : null}

                    {user.role === "supervisor" ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-sm text-primary">
                          Change team or language
                        </summary>
                        <div className="mt-3">
                          <EditWorkerForm worker={worker} teams={teams} />
                        </div>
                      </details>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {inactive.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-ink">Not on the roster</h2>
          <ul className="flex flex-col gap-2">
            {inactive.map((worker) => (
              <li
                key={worker.id}
                className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface p-3"
              >
                <span className="font-medium text-ink-muted">{worker.fullName}</span>
                <span className="text-sm text-ink-muted">{worker.phone}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
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
    const page = await listWorkers(db, role, { cursor });
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor && items.length < 500);
  return items;
}

function languageLabel(lang: "en" | "te" | "hi") {
  return { en: "English", te: "తెలుగు", hi: "हिन्दी" }[lang];
}
