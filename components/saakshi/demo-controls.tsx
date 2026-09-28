"use client";

import { FastForward, LoaderCircle, Lock, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type DemoAction = "jump" | "lock" | "reset";

export function DemoControls({
  onJumpToShiftEnd,
  onLockDay,
  onReset,
  busy = null,
  className,
}: {
  onJumpToShiftEnd: () => void;
  onLockDay: () => void;
  onReset: () => void;
  busy?: DemoAction | null;
  className?: string;
}) {
  const disabled = busy !== null;
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Demo controls</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onJumpToShiftEnd} disabled={disabled}>
          {busy === "jump" ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <FastForward data-icon="inline-start" />}
          Jump to shift end
        </Button>
        <Button variant="outline" onClick={onLockDay} disabled={disabled}>
          {busy === "lock" ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Lock data-icon="inline-start" />}
          Lock day
        </Button>
        <Button variant="outline" onClick={onReset} disabled={disabled}>
          {busy === "reset" ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <RotateCcw data-icon="inline-start" />}
          Reset demo
        </Button>
      </CardContent>
    </Card>
  );
}
