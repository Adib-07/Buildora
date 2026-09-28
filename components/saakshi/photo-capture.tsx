"use client";

import { useRef } from "react";
import { Camera, CircleCheck, LoaderCircle, OctagonAlert, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui/utils";

export type PhotoCaptureState = "idle" | "preview" | "uploading" | "rejected" | "accepted";

export function PhotoCapture({
  state,
  previewUrl,
  rejectionReason,
  onCapture,
  onRetake,
  onUse,
  disabled = false,
  className,
}: {
  state: PhotoCaptureState;
  /** Local object URL for the captured file; only used in preview/uploading/rejected/accepted. */
  previewUrl?: string;
  rejectionReason?: string;
  onCapture: (file: File) => void;
  onRetake?: () => void;
  /** Fires once the supervisor confirms the preview; the caller starts the real upload. */
  onUse?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onCapture(file);
    e.target.value = ""; // allow re-selecting the same file after a retake
  }

  if (state === "idle") {
    return (
      <div className={className}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-border bg-bg text-ink-muted disabled:pointer-events-none disabled:opacity-50"
        >
          <Camera className="size-8" aria-hidden="true" />
          <span className="font-medium">Take photo</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleChange}
          disabled={disabled}
          className="sr-only"
          aria-label="Take a photo of the fixed hazard"
        />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative overflow-hidden rounded-card border border-border">
        {previewUrl ? (
          // Local blob/object URL, not a remote asset next/image can optimise.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Captured hazard fix" className="aspect-video w-full object-cover" />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-bg text-ink-muted">No preview</div>
        )}
        {state === "uploading" && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-ink/50 font-medium text-white">
            <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
            Uploading…
          </div>
        )}
      </div>

      {state === "rejected" && (
        <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-state-disputed">
          <OctagonAlert className="size-4 shrink-0" aria-hidden="true" />
          {rejectionReason ?? "This photo could not be used."}
        </p>
      )}

      {state === "accepted" && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-state-confirmed">
          <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
          Photo added
        </p>
      )}

      <div className="flex gap-2">
        {(state === "preview" || state === "rejected" || state === "accepted") && onRetake && (
          <Button variant="outline" onClick={onRetake} disabled={disabled}>
            <RotateCcw data-icon="inline-start" />
            Retake
          </Button>
        )}
        {state === "preview" && onUse && (
          <Button onClick={onUse} disabled={disabled}>
            Use this photo
          </Button>
        )}
      </div>
    </div>
  );
}
