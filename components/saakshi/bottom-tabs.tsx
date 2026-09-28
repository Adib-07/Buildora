import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/ui/utils";

export type BottomTabItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
};

/**
 * 64px tall, per the shape spec. Pure and prop-driven: the caller passes
 * `activeHref` (typically `usePathname()`), so this component never reaches
 * into routing itself.
 */
export function BottomTabs({ items, activeHref, className }: { items: BottomTabItem[]; activeHref: string; className?: string }) {
  return (
    <nav aria-label="Primary" className={cn("flex h-16 border-t border-border bg-surface", className)}>
      {items.map(({ key, label, icon: Icon, href }) => {
        const active = activeHref === href;
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-sm",
              // Weight changes along with colour, so active never reads by
              // colour alone (screen readers also get aria-current).
              active ? "font-semibold text-primary" : "font-medium text-ink-muted"
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
