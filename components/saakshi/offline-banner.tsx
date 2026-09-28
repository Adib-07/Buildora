"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

import { cn } from "@/lib/ui/utils";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const getSnapshot = () => !navigator.onLine;
// Network status is unknowable on the server; assume online until the
// client's first paint corrects it.
const getServerSnapshot = () => false;

/**
 * Self-contained: reads `navigator.onLine` via useSyncExternalStore, no
 * props required. `forceOffline` exists only for /dev/ui and tests, to show
 * the banner without actually cutting the network.
 */
export function OfflineBanner({ forceOffline = false, className }: { forceOffline?: boolean; className?: string }) {
  const offline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!offline && !forceOffline) return null;

  return (
    <div
      role="status"
      className={cn(
        "flex min-h-10 items-center justify-center gap-2 bg-state-noreply-bg px-4 py-2 text-sm font-medium text-state-noreply",
        className
      )}
    >
      <WifiOff className="size-4 shrink-0" aria-hidden="true" />
      You&apos;re offline — changes will not be saved.
    </div>
  );
}
