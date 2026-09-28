"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FlaskConicalIcon, LogOutIcon, MenuIcon } from "lucide-react";

import { BrandLockup } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/ui/utils";

import type { Me } from "@/contracts";

/**
 * Application chrome: brand, navigation, identity and sign-out.
 *
 * The supervisor's working set and the engineer's differ, so the list is derived
 * from the role rather than showing links that always 403. Hiding a section is
 * the honest choice -- and the API enforces the same rule regardless of what the
 * navigation shows, so this is convenience, not security.
 */
const NAV: { href: string; label: string; roles: Me["role"][] }[] = [
  { href: "/dashboard", label: "Today", roles: ["supervisor", "engineer", "owner"] },
  { href: "/attendance", label: "Attendance", roles: ["supervisor", "engineer", "owner"] },
  { href: "/tasks", label: "Tasks", roles: ["supervisor", "engineer", "owner"] },
  { href: "/disputes", label: "Disputes", roles: ["supervisor", "engineer", "owner"] },
  { href: "/hazards", label: "Safety", roles: ["supervisor", "engineer", "owner"] },
  { href: "/workers", label: "Crew", roles: ["supervisor", "engineer", "owner"] },
  { href: "/summary", label: "Summary", roles: ["engineer", "owner"] },
];

function itemsFor(role: Me["role"]) {
  return NAV.filter((item) => item.roles.includes(role));
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const ROLE_LABEL: Record<Me["role"], string> = {
  supervisor: "Site supervisor",
  engineer: "Engineer",
  owner: "Owner",
};

function linkClass(active: boolean) {
  return cn(
    "flex min-h-12 items-center rounded-control px-3 text-base font-medium transition-colors",
    active ? "bg-primary-soft text-primary" : "text-ink hover:bg-primary-soft hover:text-primary",
  );
}

export function AppNav({
  me,
  signOut,
  children,
}: {
  me: Me;
  signOut: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // `refresh()` after the action: the server has just cleared the session
  // cookie, so the router's cached tree still thinks the user is signed in.
  // Without it the /login page would render once as an authenticated user and
  // bounce straight back here.
  const signOutAndLeave = () => {
    startTransition(async () => {
      await signOut();
      router.replace("/login");
      router.refresh();
    });
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
          <Link
            href="/dashboard"
            // 44px minimum so the brand is a real tap target on a phone, not
            // just a 32px logo.
            className="-ml-1 flex min-h-11 items-center rounded-control px-1"
            aria-label="Buildora, go to Today"
          >
            <BrandLockup />
          </Link>

          <div className="ml-auto flex items-center gap-2">
            {/* Persistent, unmissable, and not dismissible. On a demo build every
                figure on every screen is seeded or simulated, and a judge must
                be able to tell that without being told. Removing this badge
                would be the difference between a demo and a misrepresentation. */}
            {me.demoMode ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-state-noreply/30 bg-state-noreply-bg px-2.5 py-1 text-xs font-semibold text-state-noreply">
                <FlaskConicalIcon className="size-3.5" aria-hidden="true" />
                Demo data
              </span>
            ) : null}
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-ink">{me.name}</p>
              <p className="text-sm text-ink-muted">
                {ROLE_LABEL[me.role]} · {me.siteName}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOutAndLeave}
              disabled={pending}
              title="Sign out"
            >
              <LogOutIcon />
              <span className="sr-only">Sign out</span>
            </Button>

            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden">
                  <MenuIcon />
                  <span className="sr-only">Open navigation</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader>
                  <SheetTitle>Navigate</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 px-2 pb-4" aria-label="Main">
                  {itemsFor(me.role).map((item) => (
                    <SheetClose asChild key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={isActive(pathname, item.href) ? "page" : undefined}
                        className={linkClass(isActive(pathname, item.href))}
                      >
                        {item.label}
                      </Link>
                    </SheetClose>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 px-4 py-6">
        <nav
          className="sticky top-20 hidden h-fit w-48 shrink-0 flex-col gap-1 md:flex"
          aria-label="Main"
        >
          {itemsFor(me.role).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={linkClass(isActive(pathname, item.href))}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main id="main-content" className="min-w-0 flex-1 pb-10">
          {children}
        </main>
      </div>
    </div>
  );
}
