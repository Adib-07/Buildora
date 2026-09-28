import type { Team } from "@/contracts";

import { fixtureId } from "./ids";

export const TEAM_IDS = {
  masonry: fixtureId("team-masonry"),
  shuttering: fixtureId("team-shuttering"),
  steel: fixtureId("team-steel"),
  helpers: fixtureId("team-helpers"),
} as const;

export const TEAMS: Team[] = [
  { id: TEAM_IDS.masonry, name: "Masonry" },
  { id: TEAM_IDS.shuttering, name: "Shuttering" },
  { id: TEAM_IDS.steel, name: "Steel" },
  { id: TEAM_IDS.helpers, name: "Helpers" },
];
