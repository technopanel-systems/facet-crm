/**
 * The `settings` table `[09 §10.2]` — configuration a manager is meant to
 * change without a deploy.
 *
 * Reference data, so **no visibility filter**: these rows describe how the
 * system behaves, not anybody's customers. Same reasoning as `lookups.ts`.
 *
 * `07 D5` names five follow-up thresholds and says they are settings rather
 * than code. `20 §11` seeded the two that Phase 9's coverage screen reads and
 * deliberately not the other three; `21 §2` adds those three, because
 * `src/lib/follow-ups.ts` now reads them. All five are here and all five have a
 * reader — which is the test `20 §11` set and the reason it held three back.
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

/**
 * `07 D5` — an issued quotation with no response. **Working days** `[21 §8]`:
 * Friday and Saturday are skipped, for everyone, with no holiday calendar.
 */
export const QUOTATION_NO_RESPONSE_KEY =
  "followup.quotation_no_response.working_days";
export const QUOTATION_NO_RESPONSE_DEFAULT = 5;

/** `07 D5` — a catalogue sent with no response. Working days, as above. */
export const CATALOGUE_NO_RESPONSE_KEY =
  "followup.catalogue_no_response.working_days";
export const CATALOGUE_NO_RESPONSE_DEFAULT = 10;

/**
 * `07 D5` — a project whose stage has not moved. **Calendar** days, as `07 D5`
 * writes it. Stage is derived from events `[10 §1]`; there is no stage column,
 * so "unchanged" means no stage-advancing event `[21 §10]`.
 */
export const PROJECT_STAGE_UNCHANGED_KEY =
  "followup.project_stage_unchanged.days";
export const PROJECT_STAGE_UNCHANGED_DEFAULT = 21;

export type QuietThresholds = {
  qualified: number;
  unqualified: number;
};

/** All five of `07 D5`'s thresholds. */
export type FollowUpThresholds = QuietThresholds & {
  quotationNoResponse: number;
  catalogueNoResponse: number;
  projectStageUnchanged: number;
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

/** All five of `07 D5`'s thresholds, for `src/lib/follow-ups.ts` `[21 §2]`. */
export async function getFollowUpThresholds(): Promise<FollowUpThresholds> {
  const [
    qualified,
    unqualified,
    quotationNoResponse,
    catalogueNoResponse,
    projectStageUnchanged,
  ] = await Promise.all([
    getPositiveIntSetting(QUIET_DAYS_QUALIFIED_KEY, QUIET_DAYS_QUALIFIED_DEFAULT),
    getPositiveIntSetting(
      QUIET_DAYS_UNQUALIFIED_KEY,
      QUIET_DAYS_UNQUALIFIED_DEFAULT,
    ),
    getPositiveIntSetting(
      QUOTATION_NO_RESPONSE_KEY,
      QUOTATION_NO_RESPONSE_DEFAULT,
    ),
    getPositiveIntSetting(
      CATALOGUE_NO_RESPONSE_KEY,
      CATALOGUE_NO_RESPONSE_DEFAULT,
    ),
    getPositiveIntSetting(
      PROJECT_STAGE_UNCHANGED_KEY,
      PROJECT_STAGE_UNCHANGED_DEFAULT,
    ),
  ]);
  return {
    qualified,
    unqualified,
    quotationNoResponse,
    catalogueNoResponse,
    projectStageUnchanged,
  };
}
