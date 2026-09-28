import type { Lang, Worker, WorkerConsent } from "@/contracts";

import { fixtureId } from "./ids";
import { TEAM_IDS } from "./teams";

type Spec = {
  slug: string;
  fullName: string;
  team: keyof typeof TEAM_IDS;
  lang: Lang;
  /** Only set for the shared-phone pair; everyone else gets a unique number. */
  sharesPhoneWith?: string;
  /** Only Venkat and Bhaskar need a fixed code (the brief names Venkat's);
   *  everyone else's is generated in order below. */
  code?: string;
  consent?: WorkerConsent;
};

// 36 workers: Masonry 12, Shuttering 10, Steel 8, Helpers 6. Ramesh, Lakshmi,
// Venkat, Suresh and Kiran are the individuals the brief names by name;
// Venkateswara Rao, Kanakamma and Varalakshmi are registered in Telugu
// script, matching how their names are actually written on site.
const SPECS: Spec[] = [
  // Masonry (12)
  { slug: "ramesh", fullName: "Ramesh", team: "masonry", lang: "te" },
  { slug: "srinivas", fullName: "Srinivas", team: "masonry", lang: "en" },
  { slug: "nagaraju", fullName: "Nagaraju", team: "masonry", lang: "te" },
  { slug: "prasad", fullName: "Prasad", team: "masonry", lang: "en" },
  { slug: "mallesh", fullName: "Mallesh", team: "masonry", lang: "te" },
  { slug: "chandra", fullName: "Chandra Sekhar", team: "masonry", lang: "en" },
  { slug: "venkateswara-rao", fullName: "వెంకటేశ్వరరావు", team: "masonry", lang: "te" },
  { slug: "ravindra", fullName: "Ravindra", team: "masonry", lang: "en" },
  { slug: "narsimha", fullName: "Narsimha", team: "masonry", lang: "te" },
  { slug: "satish", fullName: "Satish", team: "masonry", lang: "en" },
  { slug: "gopal", fullName: "Gopal", team: "masonry", lang: "hi" },
  { slug: "anjaiah", fullName: "Anjaiah", team: "masonry", lang: "te", consent: "pending" },

  // Shuttering (10)
  { slug: "lakshmi", fullName: "Lakshmi", team: "shuttering", lang: "te" },
  { slug: "padma", fullName: "Padma", team: "shuttering", lang: "te" },
  { slug: "anitha", fullName: "Anitha", team: "shuttering", lang: "en" },
  { slug: "sudhakar", fullName: "Sudhakar", team: "shuttering", lang: "en" },
  { slug: "kanakamma", fullName: "కనకమ్మ", team: "shuttering", lang: "te" },
  { slug: "bhavani", fullName: "Bhavani", team: "shuttering", lang: "te" },
  { slug: "rajesh", fullName: "Rajesh", team: "shuttering", lang: "en" },
  { slug: "sunitha", fullName: "Sunitha", team: "shuttering", lang: "en" },
  { slug: "mahesh", fullName: "Mahesh", team: "shuttering", lang: "hi" },
  { slug: "saroja", fullName: "Saroja", team: "shuttering", lang: "te", consent: "pending" },

  // Steel (8) — Venkat and Bhaskar share one phone, disambiguated by code.
  { slug: "venkat", fullName: "Venkat", team: "steel", lang: "te", code: "4821", sharesPhoneWith: "bhaskar" },
  { slug: "bhaskar", fullName: "Bhaskar", team: "steel", lang: "te", code: "4822", sharesPhoneWith: "venkat" },
  { slug: "krishna", fullName: "Krishna", team: "steel", lang: "en" },
  { slug: "narayana", fullName: "Narayana", team: "steel", lang: "te" },
  { slug: "yellaiah", fullName: "Yellaiah", team: "steel", lang: "te" },
  { slug: "ramulu", fullName: "Ramulu", team: "steel", lang: "en" },
  { slug: "varalakshmi", fullName: "వరలక్ష్మి", team: "steel", lang: "te" },
  { slug: "anand", fullName: "Anand", team: "steel", lang: "hi" },

  // Helpers (6)
  { slug: "suresh", fullName: "Suresh", team: "helpers", lang: "en" },
  { slug: "kiran", fullName: "Kiran", team: "helpers", lang: "en" },
  { slug: "vijaya", fullName: "Vijaya", team: "helpers", lang: "te" },
  { slug: "manjula", fullName: "Manjula", team: "helpers", lang: "en" },
  { slug: "radha", fullName: "Radha", team: "helpers", lang: "hi" },
  { slug: "veeraiah", fullName: "Veeraiah", team: "helpers", lang: "te" },
];

function phoneFor(index: number): string {
  return `+91900000${String(index + 1).padStart(4, "0")}`;
}

const TEAM_NAME: Record<keyof typeof TEAM_IDS, string> = {
  masonry: "Masonry",
  shuttering: "Shuttering",
  steel: "Steel",
  helpers: "Helpers",
};

let nextCode = 1001;
const phoneBySlug = new Map<string, string>();
SPECS.forEach((spec, i) => {
  if (spec.sharesPhoneWith && phoneBySlug.has(spec.sharesPhoneWith)) {
    phoneBySlug.set(spec.slug, phoneBySlug.get(spec.sharesPhoneWith)!);
  } else {
    phoneBySlug.set(spec.slug, phoneFor(i));
  }
});

export const WORKER_IDS: Record<string, string> = Object.fromEntries(
  SPECS.map((spec) => [spec.slug, fixtureId(`worker-${spec.slug}`)])
);

export const WORKERS: Worker[] = SPECS.map((spec) => ({
  id: WORKER_IDS[spec.slug],
  fullName: spec.fullName,
  phone: phoneBySlug.get(spec.slug)!,
  workerCode: spec.code ?? String(nextCode++),
  teamId: TEAM_IDS[spec.team],
  teamName: TEAM_NAME[spec.team],
  lang: spec.lang,
  consent: spec.consent ?? "given",
  active: true,
}));

/** Same slugs as SPECS, e.g. WORKERS_BY_SLUG.lakshmi — for fixtures that
 *  need to reference a specific named worker (attendance, disputes, hazards). */
export const WORKERS_BY_SLUG: Record<string, Worker> = Object.fromEntries(
  SPECS.map((spec, i) => [spec.slug, WORKERS[i]])
);
