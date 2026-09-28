"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" onClick={() => toast.success("Plan approved: 4 tasks, 4 owners")}>
        Success
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.error("Could not save attendance", { description: "Request ID req_7f3a2c. Try again." })
        }
      >
        Error
      </Button>
      <Button variant="outline" onClick={() => toast.info("Sample information message")}>
        Info
      </Button>
      <Button variant="outline" onClick={() => toast.warning("Sample warning message")}>
        Warning
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.promise(wait(1500), {
            loading: "Saving roll-call…",
            success: "Roll-call saved: 36 workers",
            error: "Could not save roll-call",
          })
        }
      >
        Loading, then success
      </Button>
      <Button
        variant="outline"
        onClick={() => toast("Sample message with an action", { action: { label: "Undo", onClick: () => {} } })}
      >
        With action
      </Button>
    </div>
  );
}
