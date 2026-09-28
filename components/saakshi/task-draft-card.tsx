"use client";

import { CircleAlert, MapPin, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/ui/utils";

import { OwnerPicker, type OwnerCandidate } from "./owner-picker";

// "CircleAlert" here, never TriangleAlert: that icon means Disputed worker
// state exclusively, everywhere in the app.
function candidateSentence(names: string[]): string {
  if (names.length === 0) return "One owner needed — search the roster below.";
  if (names.length === 1) return `One owner needed — pick ${names[0]}.`;
  if (names.length === 2) return `One owner needed — pick ${names[0]} or ${names[1]}.`;
  return `One owner needed — pick ${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}.`;
}

export function TaskDraftCard({
  title,
  location,
  ownerWorkerId,
  candidates,
  roster,
  onOwnerChange,
  onRemove,
  className,
}: {
  title: string;
  location: string | null;
  ownerWorkerId: string | null;
  candidates: OwnerCandidate[];
  roster: OwnerCandidate[];
  onOwnerChange: (workerId: string) => void;
  onRemove: () => void;
  className?: string;
}) {
  const needsOwner = ownerWorkerId === null;

  return (
    <Card className={cn("relative", className)}>
      <CardHeader className="pr-14">
        <CardTitle>{title}</CardTitle>
        <Button variant="ghost" size="icon" aria-label="Remove task" onClick={onRemove} className="absolute top-3 right-3">
          <X />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="flex items-center gap-1.5 text-sm text-ink-muted">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          {location ?? "No location given"}
        </p>

        {needsOwner && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-state-noreply">
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            {candidateSentence(candidates.map((c) => c.name))}
          </p>
        )}

        <OwnerPicker roster={roster} candidates={candidates} value={ownerWorkerId} onChange={onOwnerChange} />
      </CardContent>
    </Card>
  );
}
