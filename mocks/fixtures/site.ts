import { fixtureId } from "./ids";

/**
 * The demo is anchored to a fixed date rather than the real device date, so
 * the fixture attendance/dispute/hazard data (all written relative to this
 * day) never drifts out of sync just because time passed since it was
 * written.
 */
export const TODAY = "2026-09-28";

export const SITE = {
  id: fixtureId("site-green-park-towers"),
  name: "Green Park Towers (demo)",
  timezone: "Asia/Kolkata",
  shiftEnd: "18:00",
  summaryCutoff: "19:00",
  demoMode: true,
} as const;
