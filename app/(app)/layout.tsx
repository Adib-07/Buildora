import type { Metadata } from "next";

import { AppNav } from "@/components/app-nav";
import { AuthedErrorBoundary } from "@/components/error-boundary";
import { signOut } from "@/app/actions";
import { requireSession } from "@/lib/auth/dal";

/**
 * Every page in this shell is behind a session and shows one site's private
 * operational data. None of it should ever reach a search index: a crawler that
 * somehow held a session would otherwise cache attendance and hazard records
 * site-wide. The public landing and sign-in pages, which are the only pages
 * meant to be found, keep the root layout's indexable metadata.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Authenticated shell.
 *
 * `requireSession()` runs before any child renders and redirects when there is
 * no valid session, so no page below this one can be reached unauthenticated --
 * each one inherits the guard rather than having to remember it. The proxy does
 * the same check optimistically at the edge; this is the authoritative one, and
 * the data layer repeats it per query.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { me } = await requireSession();

  return (
    <AuthedErrorBoundary>
      <AppNav me={me} signOut={signOut}>
        {children}
      </AppNav>
    </AuthedErrorBoundary>
  );
}
