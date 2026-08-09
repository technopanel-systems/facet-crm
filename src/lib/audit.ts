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
