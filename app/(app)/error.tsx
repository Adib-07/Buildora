"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/feedback";

/**
 * Route-level error boundary.
 *
 * Only the digest is logged, never the message or the stack: those can quote
 * table names, column names or a URL with a token in it. The digest correlates
 * with the server log, so the two can be joined without shipping either to the
 * browser.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (error.digest) {
      console.error("Buildora page error", { digest: error.digest });
    }
  }, [error]);

  return (
    <ErrorState
      title="This screen could not be loaded"
      description="Buildora hit an unexpected problem. Nothing was changed. Trying again usually works."
      onRetry={reset}
    />
  );
}
