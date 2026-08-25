/**
 * The eight demo accounts — invented people, real roles `S7`.
 *
 * **Three emails are load-bearing and must not change.**
 * `scripts/verify-routes.ts:638` logs in as `rep-a@`, `manager@` and
 * `coordinator@example.test` by name; renaming one of them turns every
 * section of that walk red for a reason that has nothing to do with a screen.
 * `rep-b@` is `verify-slice2`'s unrelated-rep case for the same reason.
 *
 * `books` is how uneven the two ends are: `D34` says a big book cannot be
 * emptied — *"a rep with 200 companies cannot clear a 30-day quiet list"* —
 * and that is invisible on screen unless one rep holds four times what
 * another does. Faisal carries ~60 and Turki ~15, so the waiting list reads
 * differently for the two of them without either being a special case.
 *
 * The coordinator holds a small book of her own: `S127` lets her raise and
 * approve against her own company, and `S9` says she holds companies as a rep
 * does. `D65` then shows her `D64`'s target block like anybody else's.
 *
 * The executive and the super admin hold none. `S7` gives the executive no
 * operational entry at all, and `D68` gives them the team table and nothing
 * else — a book would be the wrong screen, not a missing one.
 */

import type { Region } from "@/lib/enums";

export type PersonKey =
  | "faisal"
  | "saad"
  | "majed"
  | "turki"
  | "nouf"
  | "abdulrahman"
  | "khalid"
  | "admin";

export type Person = {
  key: PersonKey;
  name: string;
  email: string;
  /** `roles.name_en` — the ONLY place a role name appears, as `S7` requires. */
  role: string;
  region: Region | null;
  /** How many companies this person is the primary rep of `S18`. */
  books: number;
};

export const PEOPLE: readonly Person[] = [
  {
    key: "faisal",
    name: "Faisal Al-Harbi",
    email: "rep-a@example.test",
    role: "Sales Rep",
    region: "center",
    books: 61,
  },
  {
    key: "saad",
    name: "Saad Al-Qahtani",
    email: "rep-b@example.test",
    role: "Sales Rep",
    region: "east",
    books: 27,
  },
  {
    key: "majed",
    name: "Majed Al-Dosari",
    email: "rep-c@example.test",
    role: "Sales Rep",
    region: "west",
    books: 14,
  },
  {
    key: "turki",
    name: "Turki Al-Shammari",
    email: "rep-d@example.test",
    role: "Sales Rep",
    region: "south",
    books: 15,
  },
  {
    key: "nouf",
    name: "Nouf Al-Mutairi",
    email: "coordinator@example.test",
    role: "Sales Coordinator",
    region: "center",
    books: 4,
  },
  {
    key: "abdulrahman",
    name: "Abdulrahman Al-Zahrani",
    email: "manager@example.test",
    role: "Sales Manager",
    region: "center",
    books: 0,
  },
  {
    key: "khalid",
    name: "Khalid Al-Subaie",
    email: "executive@example.test",
    role: "Executive",
    region: "center",
    books: 0,
  },
  {
    key: "admin",
    name: "Demo Super Admin",
    email: "admin@example.test",
    role: "Super Admin",
    region: "center",
    books: 0,
  },
] as const;

/** The four who carry a rep's book and a target, in book order. */
export const REPS = ["faisal", "saad", "majed", "turki"] as const;
