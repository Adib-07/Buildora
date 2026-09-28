import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Telugu } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AppErrorBoundary } from "@/components/error-boundary";
import { siteUrl } from "@/lib/config/env";

import "./globals.css";

const notoSans = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-noto-sans",
});

// Telugu glyphs download only when Telugu text is on screen (unicode-range),
// so this font is not preloaded on every visit.
const notoSansTelugu = Noto_Sans_Telugu({
  subsets: ["telugu"],
  variable: "--font-noto-sans-telugu",
  preload: false,
});

const PRODUCT = "Buildora";
const DESCRIPTION =
  "Construction site operations in one place. Workers confirm their shift by SMS or voice in their own language, so attendance, tasks and hazard reports are settled the same day.";

export const metadata: Metadata = {
  // `siteUrl()` never throws: a malformed NEXT_PUBLIC_SITE_URL previously threw
  // from this module while the root layout was loading, which fails the build
  // locally and 500s every request in production.
  metadataBase: siteUrl(),
  title: {
    default: `${PRODUCT} — site attendance, tasks and safety`,
    template: `%s · ${PRODUCT}`,
  },
  description: DESCRIPTION,
  applicationName: PRODUCT,
  keywords: [
    "construction site management",
    "labour attendance",
    "site safety",
    "hazard reporting",
    "worker SMS",
  ],
  authors: [{ name: PRODUCT }],
  openGraph: {
    type: "website",
    siteName: PRODUCT,
    title: `${PRODUCT} — site attendance, tasks and safety`,
    description: DESCRIPTION,
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: `${PRODUCT} — site attendance, tasks and safety`,
    description: DESCRIPTION,
  },
  robots: {
    // The application itself is behind a session; only the marketing page and
    // the sign-in page should ever be indexed.
    index: true,
    follow: true,
  },
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f8fafc",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${notoSans.variable} ${notoSansTelugu.variable}`}>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-3 focus:font-semibold focus:text-primary focus:shadow-sm"
        >
          Skip to main content
        </a>
        <AppErrorBoundary name="root">
          <TooltipProvider>{children}</TooltipProvider>
        </AppErrorBoundary>
        <Toaster />
      </body>
    </html>
  );
}
