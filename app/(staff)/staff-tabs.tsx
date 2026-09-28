"use client";

import { usePathname } from "next/navigation";
import { CalendarCheck, IdCard, ListChecks, ShieldAlert, Users } from "lucide-react";

import { BottomTabs, type BottomTabItem } from "@/components/saakshi/bottom-tabs";

const ITEMS: BottomTabItem[] = [
  { key: "today", label: "Today", icon: CalendarCheck, href: "/s/today" },
  { key: "rollcall", label: "Roll-call", icon: Users, href: "/s/rollcall" },
  { key: "tasks", label: "Tasks", icon: ListChecks, href: "/s/tasks" },
  { key: "hazards", label: "Hazards", icon: ShieldAlert, href: "/s/hazards" },
  { key: "workers", label: "Workers", icon: IdCard, href: "/s/workers" },
];

/**
 * The only client-side piece of the shell: BottomTabs itself stays a pure,
 * prop-driven component, so it's this leaf that reads the current route.
 */
export function StaffTabs() {
  const pathname = usePathname();
  return <BottomTabs items={ITEMS} activeHref={pathname} className="sticky bottom-0" />;
}
