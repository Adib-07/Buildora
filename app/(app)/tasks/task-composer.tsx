"use client";

import { useActionState, useState } from "react";
import { Loader2Icon, SparklesIcon, WandSparklesIcon } from "lucide-react";
import { toast } from "sonner";

import { saveTasks } from "@/app/actions";
import { IDLE, messageFor, type ActionState } from "@/app/action-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/ui/utils";
import type { TaskDraft, Worker } from "@/contracts";

/**
 * Turn a shift note into tasks, then publish them.
 *
 * The draft step is a preview: Buildora proposes tasks and guesses owners from
 * the roster, and nothing reaches the database until the supervisor confirms
 * every owner. A task with no owner cannot be published at all -- the column is
 * NOT NULL -- so an unresolved name is a prompt to choose, not a silent default.
 */
export function TaskComposer({ workers, workDate }: { workers: Worker[]; workDate: string }) {
  const [note, setNote] = useState("");
  const [drafts, setDrafts] = useState<TaskDraft[] | null>(null);
  // The owner chosen for each draft. Held here rather than in the child so the
  // publish button can reflect completeness, which is read during render.
  const [owners, setOwners] = useState<string[]>([]);
  const [drafting, setDrafting] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveTasks, IDLE);

  const active = workers.filter((worker) => worker.active);
  // A task cannot be published without an owner -- the column is NOT NULL -- so
  // the button stays disabled until they are all chosen, and each unresolved row
  // says so next to it.
  const unresolved = (drafts ?? []).filter((_, i) => !owners[i]);
  const canPublish = drafts !== null && drafts.length > 0 && unresolved.length === 0;

  async function draft() {
    setDrafting(true);
    try {
      const response = await fetch("/api/v1/tasks/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: note }),
      });
      const body = await response.json();
      if (!response.ok) {
        toast.error(body?.error?.message ?? "Could not read that note.");
        return;
      }
      const drafted: TaskDraft[] = body.drafts ?? [];
      setDrafts(drafted);
      setOwners(drafted.map((draft) => draft.ownerWorkerId ?? ""));
      if (body.drafts?.length) {
        toast.success(`${body.drafts.length} task${body.drafts.length === 1 ? "" : "s"} drafted.`);
      } else {
        toast.error("Nothing in that note looked like a task.");
      }
    } catch {
      toast.error("Could not reach Buildora. Check your connection and try again.");
    } finally {
      setDrafting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="shift-note" className="text-sm font-medium text-ink">
          Write the shift down as you say it
        </label>
        <Textarea
          id="shift-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          placeholder="Ask Ramesh to plaster Block B second floor. Lakshmi Devi to fix the leaking pipe near Block A."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={draft} disabled={drafting || note.trim() === ""}>
            {drafting ? <Loader2Icon className="animate-spin" /> : <WandSparklesIcon />}
            Draft tasks
          </Button>
          <p className="text-sm text-ink-muted">
            One task per line, or separate them with a full stop.
          </p>
        </div>
      </div>

      {drafts && drafts.length > 0 && state?.status === 'ok' ? (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-state-confirmed/30 bg-state-confirmed-bg p-4">
          <p className="text-sm text-ink">{state.message}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDrafts(null);
              setOwners([]);
              setNote("");
            }}
          >
            Add more tasks
          </Button>
        </div>
      ) : drafts && drafts.length > 0 ? (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="workDate" value={workDate} />
          <input type="hidden" name="taskCount" value={drafts.length} />
          {drafts.map((draft, index) => (
            <DraftRow
              key={index}
              draft={draft}
              index={index}
              workers={active}
              onOwnerChange={(value) =>
                setOwners((current) =>
                  current.map((existing, i) => (i === index ? value : existing)),
                )
              }
              invalid={!owners[index]}
            />
          ))}

          <div aria-live="polite" aria-atomic="true">
            {state?.status === "error" ? (
              <p role="alert" className="text-sm text-state-disputed">
                {messageFor(state)}
              </p>
            ) : null}
            {state?.status === "ok" ? (
              <p className="text-sm text-state-confirmed">{state.message}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            {unresolved.length > 0 ? (
              <p className="text-sm text-state-noreply">
                {unresolved.length === 1
                  ? 'One task still needs an owner. Choose one to publish.'
                  : `${unresolved.length} tasks still need an owner. Choose one for each to publish.`}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending || !canPublish}>
              {pending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
              Publish {drafts.length} task{drafts.length === 1 ? "" : "s"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDrafts(null);
                setOwners([]);
              }}
            >
              Discard
            </Button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}

/**
 * One draft: the task text is fixed, the owner is the supervisor's to confirm.
 * An unresolved owner renders a "choose" prompt rather than defaulting to
 * somebody, because putting the wrong name on a task is worse than none.
 */
function DraftRow({
  draft,
  index,
  workers,
  onOwnerChange,
  invalid,
}: {
  draft: TaskDraft;
  index: number;
  workers: Worker[];
  onOwnerChange: (value: string) => void;
  invalid: boolean;
}) {
  const [title, setTitle] = useState(draft.title);
  const [owner, setOwner] = useState(draft.ownerWorkerId ?? "");

  const choose = (value: string) => {
    setOwner(value);
    onOwnerChange(value);
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-card border bg-surface p-3",
        invalid ? "border-state-noreply" : "border-border",
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          name={`title-${index}`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label={`Task ${index + 1} title`}
        />
        <Select value={owner} onValueChange={choose}>
          <SelectTrigger className="sm:w-64" aria-label={`Owner for task ${index + 1}`}>
            <SelectValue placeholder="Choose an owner" />
          </SelectTrigger>
          <SelectContent>
            {workers.map((worker) => (
              <SelectItem key={worker.id} value={worker.id}>
                {worker.fullName}
                {worker.teamName ? ` · ${worker.teamName}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {draft.ownerCandidates.length > 1 ? (
        <p className="text-sm text-state-noreply">
          More than one name matched this line ({draft.ownerCandidates.map((c) => c.name).join(", ")}).
          Choose who owns it.
        </p>
      ) : draft.ownerWorkerId === null ? (
        <p className="text-sm text-ink-muted">
          No owner was recognised here. Choose one before publishing.
        </p>
      ) : null}

      {/* Indexed fields rather than one packed value: a task title contains
          spaces, so any delimiter would have to be escaped and then unescaped.
          The Select is a controlled component with no form value of its own, so
          the chosen owner is mirrored into a hidden field. */}
      <input type="hidden" name={`ownerWorkerId-${index}`} value={owner} />
    </div>
  );
}
