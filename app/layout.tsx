import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Telugu } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

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

export const metadata: Metadata = {
  title: { default: "Saakshi", template: "%s · Saakshi" },
  description: "Daily attendance, tasks and hazard reports that site workers co-sign by SMS.",
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
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
