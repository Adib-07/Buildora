import Link from "next/link";

import { BrandLockup } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback";

/**
 * 404.
 *
 * Deliberately says nothing about whether the requested record exists. Another
 * site's hazard and a hazard that was never created must produce this identical
 * page, otherwise the 404 becomes an oracle for probing ids.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto w-full max-w-4xl px-4 py-3">
          <BrandLockup />
        </div>
      </header>
      <main id="main-content" className="mx-auto flex w-full max-w-4xl flex-1 items-center px-4 py-12">
        <EmptyState
          className="w-full"
          title="That page is not here"
          description="The link may be out of date, or the record it pointed at has been removed."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/dashboard">Go to Today</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/">Home</Link>
              </Button>
            </div>
          }
        />
      </main>
    </div>
  );
}
