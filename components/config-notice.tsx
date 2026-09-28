import { AlertTriangleIcon } from "lucide-react";

/**
 * Fallback shown on public pages when the deployment has no working Supabase
 * configuration.
 *
 * A server component with no client dependencies, so it renders even when the
 * database client that would normally serve the page cannot be built at all.
 *
 * Deliberately says *that* sign-in is unavailable and nothing more: naming the
 * missing variable, the project id or the region in a public response turns an
 * infrastructure gap into reconnaissance. The operator signal belongs in the
 * server log, where `lib/auth/dal.ts` writes it, not in the HTML.
 */
export function ConfigNotice({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={
        className ??
        "rounded-card border border-state-disputed/30 bg-state-disputed-bg px-4 py-3"
      }
    >
      <p className="flex items-start gap-2 text-sm font-semibold text-ink">
        <AlertTriangleIcon
          className="mt-0.5 size-4 shrink-0 text-state-disputed"
          aria-hidden="true"
        />
        Sign-in is temporarily unavailable
      </p>
      <p className="mt-1 pl-6 text-sm text-ink-muted">
        This deployment is not connected to its database yet, so accounts cannot
        be checked right now. Nothing has been changed and no data is at risk.
        Please try again shortly.
      </p>
    </div>
  );
}
