/**
 * The demo seed's clock — **build through the real writers, then move time.**
 *
 * Every row in `seed-demo.ts` is created by the same function a screen calls,
 * so no state is reached that an action could not reach. What a writer will
 * not do is claim a record was created four months ago: `created_at` defaults
 * to `now()` and the audit row beside it takes the same instant.
 *
 * That matters because three of the six `FOLLOW_UP_KINDS` are derived from
 * exactly those columns and can fire no other way —
 * `quotation_no_response` and `quotation_returned` read
 * `audit_log.created_at` (`follow-ups.ts:245`, `:380`),
 * and `project_stage_unchanged` falls back to `projects.created_at`
 * (`follow-ups.ts:556`). A dataset with every clock at today has an empty
 * Slipping section and every day count reading zero.
 *
 * **Moving a timestamp backwards creates no unreachable state.** The same
 * sequence of acts run 120 days ago would have produced these rows with these
 * timestamps. That is the whole of the licence this file takes, and the two
 * lists below are what keeps it auditable: `SHIFTED` names every column that
 * moves, and `NOT_SHIFTED` names every column that deliberately does not, so
 * the next person can tell an intentional omission from a missed one.
 *
 * Both lists are checked against `information_schema` before anything runs
 * (`assertColumnsExist`), so a renamed column is a loud failure rather than a
 * silent no-op.
 */

import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * Every column the shift moves. One row per `table.column`.
 *
 * These are all `timestamp with time zone` written by the database or by a
 * writer at the moment of the act — never a business date somebody typed.
 */
export const SHIFTED: readonly (readonly [table: string, column: string])[] = [
  ["companies", "created_at"],
  ["company_reps", "created_at"],
  ["contacts", "created_at"],
  ["projects", "created_at"],
  ["projects", "lost_at"],
  ["project_companies", "created_at"],
  ["record_shares", "created_at"],
  ["quotation_threads", "created_at"],
  ["quotation_versions", "created_at"],
  ["quotation_lines", "created_at"],
  ["quotation_service_lines", "created_at"],
  ["dispatches", "created_at"],
  ["dispatches", "submitted_at"],
  ["dispatches", "approved_at"],
  ["dispatch_lines", "created_at"],
  ["rep_reports", "created_at"],
  ["comments", "created_at"],
  ["comment_mentions", "created_at"],
  ["notifications", "created_at"],
  ["targets", "created_at"],
  ["targets", "effective_from"],
  ["audit_log", "created_at"],
] as const;

/**
 * Every column that stays where the writer put it, and why.
 *
 * A column absent from BOTH lists is an oversight; a column here is a
 * decision. That is the only reason this list exists — nothing reads it but
 * `assertColumnsExist` and a person.
 */
export const NOT_SHIFTED: readonly (readonly [
  table: string,
  column: string,
  why: string,
])[] = [
  ["rep_reports", "report_date", "caller-supplied — the day the visit happened"],
  ["rep_reports", "on_hold_until", "caller-supplied — a future park date `S37`"],
  ["dispatches", "dispatch_date", "caller-supplied `S72`"],
  ["targets", "period", "a month, not an instant `S83`"],
  ["companies", "archived_at", "nothing here archives `S107`"],
  ["companies", "next_follow_up_at", "moved by id only — see `shiftFollowUpDate`"],
  ["projects", "next_follow_up_at", "moved by id only — see `shiftFollowUpDate`"],
  [
    "quotation_threads",
    "next_follow_up_at",
    "moved by id only — see `shiftFollowUpDate`",
  ],
  ["quotation_threads", "closed_at", "no writer — `S47` is `[BUILD]`"],
  ["company_reps", "removed_at", "nothing here hands a company over `S103`"],
  ["project_companies", "removed_at", "nothing here unlinks a participant `S27`"],
  ["record_shares", "revoked_at", "nothing here revokes a share `S100`"],
  ["comments", "edited_at", "nothing here edits a comment `[25 §12]`"],
  ["notifications", "read_at", "nobody has read them"],
  ["notifications", "resolved_at", "nothing resolves — `S91` deletes the machinery"],
  ["notifications", "digest_date", "a day, not an instant"],
] as const;

/** Refuse to run against a schema either list has drifted from. */
export async function assertColumnsExist(): Promise<void> {
  const wanted = [
    ...SHIFTED.map(([t, c]) => `${t}.${c}`),
    ...NOT_SHIFTED.map(([t, c]) => `${t}.${c}`),
  ];
  const rows = queryRows<{ table_name: string; column_name: string }>(
    await db.execute(
      sql`select table_name, column_name from information_schema.columns
          where table_schema = 'public'`,
    ),
  );
  const have = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
  const missing = wanted.filter((name) => !have.has(name));
  if (missing.length > 0) {
    throw new Error(
      `seed:demo's clock names ${missing.length} column(s) the schema does ` +
        `not have: ${missing.join(", ")}.\n` +
        `  Correct SHIFTED / NOT_SHIFTED in scripts/seed/demo/clock.ts.`,
    );
  }
}

/**
 * Rows out of `db.execute`, whichever shape the driver hands back.
 *
 * `postgres-js` returns a `RowList` — an array with extra properties — and
 * other drivers return `{ rows }`. Reading `.rows` off the first shape gives
 * `undefined` and the caller then iterates nothing, silently, which is the
 * class of failure this file exists to avoid.
 */
export function queryRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown }).rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

/**
 * A moment to measure "written since" from — **Postgres's clock, not Node's**,
 * and as text, so nothing depends on how the driver decodes a timestamp.
 */
export async function mark(): Promise<string> {
  const rows = queryRows<{ at: string }>(
    await db.execute(sql`select clock_timestamp()::text as at`),
  );
  if (!rows[0]?.at) throw new Error("Could not read the database clock");
  return rows[0].at;
}

/**
 * Move everything written since `since` back by `days`.
 *
 * Earlier batches have already been moved into the past, so `>= since` cannot
 * reach them: each batch is shifted exactly once. `days` of 0 is a no-op and
 * is skipped rather than run as twenty-one pointless updates.
 */
export async function shiftSince(since: string, days: number): Promise<void> {
  if (days <= 0) return;
  for (const [table, column] of SHIFTED) {
    await db.execute(
      sql`update ${sql.identifier(table)}
          set ${sql.identifier(column)} =
              ${sql.identifier(column)} - ${`${days} days`}::interval
          where ${sql.identifier(column)} >= ${since}::timestamptz`,
    );
  }
}

/**
 * Move ONE record's `next_follow_up_at` back by `days`.
 *
 * `setNextFollowUp` refuses a past date (`follow-ups.ts:1296`) — correctly: a
 * date already gone is a mistake, not a plan. So the date is set through the
 * writer at today or later and moved here, which is the state the application
 * reaches by itself the moment the day passes. By id, never by a mark: this is
 * a `date` column carrying a value the writer chose rather than a stamp of
 * when the writing happened, so `>= since` would not find it.
 */
export async function shiftFollowUpDate(
  table: "companies" | "projects" | "quotation_threads",
  id: string,
  days: number,
): Promise<void> {
  if (days <= 0) return;
  await db.execute(
    sql`update ${sql.identifier(table)}
        set next_follow_up_at = next_follow_up_at - ${`${days} days`}::interval
        where id = ${id}::uuid and next_follow_up_at is not null`,
  );
}
