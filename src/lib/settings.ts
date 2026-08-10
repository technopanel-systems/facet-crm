/**
 * The `settings` table `[09 §10.2]` — configuration a manager is meant to
 * change without a deploy.
 *
 * Reference data, so **no visibility filter**: these rows describe how the
 * system behaves, not anybody's customers. Same reasoning as `lookups.ts`.
 *
 * `07 D5` names five follow-up thresholds and says they are settings rather
 * than code. `20 §11` seeds the two that Phase 9's coverage screen reads and
 * deliberately not the other three, which chase quotations and catalogues —
 * Phase 10's work. Three rows nothing reads is the shape of v1's dead approval
 * gate.
 *
 * **A missing row is not an error.** Every reader takes a fallback, because a
 * database seeded before this phase is a normal state and a coverage screen
 * that throws is worse than one using `07 D5`'s published default.
 */

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { settings } from "@/db/schema";

/**
 * `07 D5` — a qualified company is quiet after this many days without an
 * interaction. Qualification is derived from a real quotation thread `[10 §1]`,
 * never from an outcome `[20 §3]`.
 */
export const QUIET_DAYS_QUALIFIED_KEY = "followup.quiet_days.qualified";
export const QUIET_DAYS_QUALIFIED_DEFAULT = 30;

/** `07 D5` — the same question for a company that has never asked for a price. */
export const QUIET_DAYS_UNQUALIFIED_KEY = "followup.quiet_days.unqualified";
export const QUIET_DAYS_UNQUALIFIED_DEFAULT = 60;

export type QuietThresholds = {
  qualified: number;
  unqualified: number;
};

export async function getSetting(key: string): Promise<unknown> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  return row?.value;
}

/**
 * A whole positive number, or the fallback. A row holding anything else —
 * hand-edited JSON, a string, a negative — is treated as absent rather than
 * trusted: a threshold of `-1` would mark every company quiet on the day it was
 * created.
 */
export async function getPositiveIntSetting(
  key: string,
  fallback: number,
): Promise<number> {
  const value = await getSetting(key);
  if (typeof value !== "number") return fallback;
  if (!Number.isInteger(value) || value <= 0) return fallback;
  return value;
}

/** Both of `20 §11`'s thresholds in one round trip's worth of calls. */
export async function getQuietThresholds(): Promise<QuietThresholds> {
  const [qualified, unqualified] = await Promise.all([
    getPositiveIntSetting(QUIET_DAYS_QUALIFIED_KEY, QUIET_DAYS_QUALIFIED_DEFAULT),
    getPositiveIntSetting(
      QUIET_DAYS_UNQUALIFIED_KEY,
      QUIET_DAYS_UNQUALIFIED_DEFAULT,
    ),
  ]);
  return { qualified, unqualified };
}
