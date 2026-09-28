"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { ErrorState } from "@/components/feedback";

/**
 * Client-side error boundary for the page subtree.
 *
 * Next's App Router already provides per-segment `error.tsx` files and a
 * `global-error.tsx` for a failure in the root layout, but neither catches a
 * render or lifecycle throw from a *client* component below a server
 * component boundary that has no `error.tsx` of its own -- the public landing
 * page and the sign-in page are exactly that case. Without this, one bad
 * client component unmounts the whole tree.
 *
 * Diagnostics are gated on `process.env.NODE_ENV === "development"`. That value
 * is inlined at build time, so the `import.meta.env`-free check cannot be
 * spoofed from the browser and no message or stack reaches a production
 * response. In production the boundary renders the same friendly copy as
 * `app/(app)/error.tsx`, and reports to the console so the digest can be
 * correlated with the server log.
 */

type Props = {
  children: ReactNode;
  /** Human-readable name of the region, used in the development log only. */
  name?: string;
};

type State = {
  error: (Error & { digest?: string }) | null;
};

const IS_DEV = process.env.NODE_ENV === "development";

export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error & { digest?: string }): State {
    return { error };
  }

  override componentDidCatch(error: Error & { digest?: string }, info: ErrorInfo) {
    if (IS_DEV) {
      console.error(`[Buildora] ${this.props.name ?? "app"} crashed`, {
        error,
        componentStack: info.componentStack,
      });
    } else {
      // Digest only. The message can quote table names, column names or a URL
      // carrying a token; the digest joins to the server log without it.
      console.error(`[Buildora] ${this.props.name ?? "app"} crashed`, {
        digest: error.digest,
      });
    }
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-4 py-16">
        <ErrorState
          title="This screen could not be loaded"
          description="Buildora hit an unexpected problem. Nothing was changed. Trying again usually works."
          onRetry={() => this.setState({ error: null })}
        />
        {IS_DEV ? (
          <details className="mt-6 rounded-card border border-border bg-surface p-4 text-sm">
            <summary className="cursor-pointer font-semibold text-ink">
              Development diagnostics
            </summary>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-ink-muted">
              {error.message}
              {error.stack ? `\n\n${error.stack}` : ""}
            </pre>
          </details>
        ) : null}
      </div>
    );
  }
}

/**
 * Same boundary, for the signed-in shell. Named so the development log
 * identifies which half of the tree failed.
 */
export function AuthedErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <AppErrorBoundary name="authed-shell">{children}</AppErrorBoundary>
  );
}
