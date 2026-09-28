import type { Metadata } from "next";

import { OfflineBanner } from "@/components/saakshi/offline-banner";
import { PageHeader } from "@/components/saakshi/page-header";
import { SITE, TODAY } from "@/mocks/fixtures/site";

import { StaffTabs } from "./staff-tabs";

export const metadata: Metadata = {
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
};

function formatDemoDate(dateOnly: string): string {
  return new Date(`${dateOnly}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// Shared by every /s/* screen: header (site + date), an OfflineBanner slot,
// and the bottom tabs. Fixed to a 64px BottomTabs and a header that never
// scrolls off, so a supervisor never loses the site/date context or the way
// back to another screen.
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PageHeader siteName={SITE.name} date={formatDemoDate(TODAY)} className="sticky top-0 z-10" />
      <OfflineBanner />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <StaffTabs />
    </div>
  );
}
