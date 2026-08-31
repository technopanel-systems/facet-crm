/**
 * The audit mechanism. The audit log is written by the data layer, not by
 * each feature `[07 E1]`, and this is the data layer's pen: every mutation
 * runs inside `withAudit`, and its audit rows commit in the same transaction
 * as the change itself — or roll back with it. A caller cannot forget to
 * audit, and an audit entry cannot describe a change that didn't happen.
 *
 * Impersonation is first-class `[07 A6]`: every entry carries the real actor
 * and, when impersonating, the acted-as identity.
 */

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { auditLog } from "@/db/schema";

export type AuditActor = {
  /** The person actually at the keyboard. Null = system (bootstrap, jobs). */
  actorUserId: string | null;
  /** Non-null only while impersonating `[07 A6]`. */
  actingAsUserId: string | null;
};

export type AuditEntry = {
  /** Dotted verb, e.g. "user.created", "impersonation.started". */
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Runs `fn` in one transaction. Every entry passed to `log` is written to
 * `audit_log` in that same transaction, stamped with both identities.
 */
export async function withAudit<T>(
  actor: AuditActor,
  fn: (tx: Tx, log: (entry: AuditEntry) => void) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const entries: AuditEntry[] = [];
    const result = await fn(tx, (entry) => {
      entries.push(entry);
    });
    if (entries.length > 0) {
      await tx.insert(auditLog).values(
        entries.map((e) => ({
          actorUserId: actor.actorUserId,
          actingAsUserId: actor.actingAsUserId,
          action: e.action,
          entityType: e.entityType,
          entityId: e.entityId,
          before: e.before ?? null,
          after: e.after ?? null,
        })),
      );
    }
    return result;
  });
}

/* ── Reading it ──────────────────────────────────────────────────────────── */

/**
 * `D65`'s day count — **the three acts that clear the coordinator's queue**,
 * named here rather than in the caller so the screen and the query cannot hold
 * two lists.
 *
 * **Two of the three exist nowhere else.** A dispatch approval has
 * `approved_at` and `approved_by_user_id`, but a **refusal** and a **quotation
 * issue** have no columns at all: `schema.ts` says so at `refusal_reason`
 * (*"the audit row that recorded the refusal keeps it"*) and
 * `quotations.ts:403` says it again for `issued_at`. `TimelineEventKind` has no
 * refusal kind either, so `tallyDays` and `dailyActivity` cannot see one.
 *
 * So all three come from **one source**. Reading `approved` off its column and
 * the other two off the log would be two definitions of one figure, and the
 * column is the wrong subject anyway — the `dispatched` stream event keys on
 * `dispatch_date`, a freely-backdated typed day, and credits
 * `recorded_by_user_id` rather than whoever approved it `projects.ts:336-347`.
 */
export const DECISION_ACTIONS = [
  "dispatch.approved",
  "quotation_version.issued",
  "dispatch.refused",
] as const;

/** What `D65`'s day count reads. Zero is a measured answer, never absence. */
export type DecisionsOnDay = {
  approved: number;
  issued: number;
  refused: number;
};

/**
 * What one person decided on one **Riyadh calendar day** `D65`.
 *
 * **The day, and not "since she last cleared the queue".** `WORKFLOW §5`
 * offered both; the second needs a cleared-state, which is the persistence
 * machinery `S91` deleted. `S93`'s weekend does not enter — a day is a day, and
 * on a Friday this reads zero honestly.
 *
 * **The subject is the person, not the company.** `D65`'s heading is *Requests
 * waiting on you* and this is what that person cleared beneath it. Impersonation
 * lands on the impersonated identity — `coalesce(acting_as_user_id,
 * actor_user_id)`, `[07 A6]`'s convention, which is what `session.user.id` was
 * at the time; the raw actor column compares the wrong side.
 *
 * **One statement, three `count(*) filter (…)`** — `requestOriginForPeriod`'s
 * shape, and no per-row query anywhere.
 *
 * **The window is half-open timestamps, not `(created_at at time zone …)::date`**
 * — that expression is `STABLE`, so it can never use an index, and `timeline.ts`
 * writes its ranges this way for the same reason. Every interpolated value is
 * cast: an untyped `sql` parameter arrives as `text` and dies with `42883`
 * (`CLAUDE.md`).
 *
 * **Column names are written out.** There is no join here, so a Drizzle column
 * in the template would render bare — harmless over one table, and named anyway
 * so nobody copies the loose form into a correlated subquery, where it is the
 * silent-zero trap `CLAUDE.md` records three sightings of.
 */
export async function decisionsOnDay(
  userId: string,
  day: string,
): Promise<DecisionsOnDay> {
  const rows = (await db.execute(sql`
    select
      count(*) filter (where audit_log.action = 'dispatch.approved')::int
        as approved,
      count(*) filter (where audit_log.action = 'quotation_version.issued')::int
        as issued,
      count(*) filter (where audit_log.action = 'dispatch.refused')::int
        as refused
    from audit_log
    where audit_log.action in ${sql.raw(
      `(${DECISION_ACTIONS.map((action) => `'${action}'`).join(", ")})`,
    )}
      and coalesce(audit_log.acting_as_user_id, audit_log.actor_user_id)
            = ${userId}::uuid
      and audit_log.created_at
            >= ${day}::date::timestamp at time zone 'Asia/Riyadh'
      and audit_log.created_at
            < (${day}::date + 1)::timestamp at time zone 'Asia/Riyadh'
  `)) as unknown as DecisionsOnDay[];

  const found = rows[0];
  return {
    approved: Number(found?.approved ?? 0),
    issued: Number(found?.issued ?? 0),
    refused: Number(found?.refused ?? 0),
  };
}
