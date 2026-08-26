/**
 * The dormancy lifecycle — `07 E6`, `21 §6`, `21 §7`.
 *
 * A company past its quiet threshold is notified — by the daily digest
 * `[07 E5]` — and then takes one of three routes:
 *
 *  1. **Re-included with the same rep, with a warning.** The **owning rep** may
 *     do this, needing no flag beyond being able to see the company `[21 §6]`.
 *     `20 §7`'s rule is that the rep is the person who can act on a quiet
 *     company; making them ask a manager to keep working their own customer is
 *     the surveillance reading that document rejects.
 *  2. **Reassigned to another rep.** Requires `can_assign` — handing a record
 *     over is an assignment, exactly as `13 §3` settled for the desk rep, and
 *     `07 B1` keeps that manager-initiated.
 *  3. **Archived as out of scope.** Requires `can_assign`. Taking a company out
 *     of the working set is not a rep's call.
 *
 * **Every route writes a dated row** `[21 §7]`, never a mutable field: the same
 * shape targets `[07 D1]` and credit splits `[18 §4]` use, because changing one
 * must not rewrite history. `07 E6`'s "with a warning" **is** the record — a
 * company re-included three times running is visible as such to a manager, and
 * a `suppressed_until` column would have lost that.
 *
 * **Nothing is deleted** `[12 §7]`. Archiving sets `companies.archived_at`,
 * which has existed since migration `0000`, is read in three places and has
 * never been written by anything; this module is its first writer. Route 3's
 * "possible deletion" in `07 E6` is not built — `12 §7` supersedes it.
 *
 * **Reassignment reuses `team.ts`'s shape and invents no second one:**
 * soft-remove the departing membership, then insert one with `origin
 * 'assigned'`, in that order, because `company_reps_active_key` is unique on
 * (company, user) WHERE `removed_at IS NULL`. A recipient who already holds the
 * company ends with exactly one live row — the partial-unique trap
 * `verify:phase11` §12 already pins.
 */

import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { companies, companyDormancyReviews, companyReps, users } from "@/db/schema";
import { withAudit } from "@/lib/audit";
import {
  can,
  canViewRecord,
  isCompanyBookHolder,
  type AuthSession,
} from "@/lib/authz";
import { NOTIFICATION_TYPES, type DormancyOutcome } from "@/lib/enums";
import { raise } from "@/lib/notifications";
import { today } from "@/lib/reports";
import { RuleError } from "@/lib/validation";

export type DormancyReview = {
  id: string;
  companyId: string;
  outcome: DormancyOutcome;
  decidedByUserId: string;
  decidedByName: string;
  toUserId: string | null;
  toName: string | null;
  note: string | null;
  decidedAt: string;
};

/**
 * The review history of one company, newest first.
 *
 * No visibility filter of its own: the caller has already established that it
 * may show this company, and a review is a fact about the company rather than
 * about a rep. Every screen reaching this has come through
 * `getCompany(session, id)`, which returns null for a company the viewer may
 * not see.
 */
export async function dormancyReviews(
  companyId: string,
): Promise<DormancyReview[]> {
  const decidedBy = users;
  const rows = await db
    .select({
      id: companyDormancyReviews.id,
      companyId: companyDormancyReviews.companyId,
      outcome: companyDormancyReviews.outcome,
      decidedByUserId: companyDormancyReviews.decidedByUserId,
      decidedByName: decidedBy.name,
      toUserId: companyDormancyReviews.toUserId,
      note: companyDormancyReviews.note,
      decidedAt: companyDormancyReviews.decidedAt,
    })
    .from(companyDormancyReviews)
    .innerJoin(decidedBy, eq(decidedBy.id, companyDormancyReviews.decidedByUserId))
    .where(eq(companyDormancyReviews.companyId, companyId))
    .orderBy(desc(companyDormancyReviews.decidedAt), desc(companyDormancyReviews.createdAt));

  const recipientIds = [
    ...new Set(rows.map((row) => row.toUserId).filter((id): id is string => !!id)),
  ];
  const names =
    recipientIds.length > 0
      ? new Map(
          (
            await db
              .select({ id: users.id, name: users.name })
              .from(users)
              .where(inArray(users.id, recipientIds))
          ).map((row) => [row.id, row.name]),
        )
      : new Map<string, string>();

  return rows.map((row) => ({
    ...row,
    toName: row.toUserId ? (names.get(row.toUserId) ?? null) : null,
  }));
}

/** The company as the dormancy panel needs it, or null if it is not visible. */
async function loadVisibleCompany(
  session: AuthSession,
  companyId: string,
): Promise<{ id: string; archivedAt: Date | null } | null> {
  if (!(await canViewRecord(session, "company", companyId))) return null;
  const [row] = await db
    .select({ id: companies.id, archivedAt: companies.archivedAt })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  return row ?? null;
}

const NOTE_MAX = 500;

function checkNote(note: string | undefined): string | null {
  const trimmed = note?.trim();
  if (!trimmed) return null;
  if (trimmed.length > NOTE_MAX) {
    throw new RuleError("dormancy.errors.noteTooLong", "note");
  }
  return trimmed;
}

/**
 * Route 1 — keep the company with the same rep, and record that somebody
 * decided to.
 *
 * The suppression that follows is read from this row by `follow-ups.ts`, for
 * one further threshold period. Without it, route 1 is a no-op and the company
 * is back in tomorrow's digest, which teaches a rep to ignore the list
 * `[21 §7]`.
 */
export async function reincludeCompany(
  session: AuthSession,
  companyId: string,
  note?: string,
): Promise<void> {
  const company = await loadVisibleCompany(session, companyId);
  if (!company) throw new RuleError("dormancy.errors.companyNotVisible");
  if (company.archivedAt) {
    throw new RuleError("dormancy.errors.alreadyArchived");
  }
  const cleanNote = checkNote(note);

  await withAudit(session.actor, async (tx, log) => {
    const [row] = await tx
      .insert(companyDormancyReviews)
      .values({
        companyId,
        outcome: "reincluded",
        decidedByUserId: session.user.id,
        note: cleanNote,
        decidedAt: today(),
      })
      .returning();

    log({
      action: "company.reincluded",
      entityType: "company_dormancy_review",
      entityId: row.id,
      after: { companyId, outcome: row.outcome, decidedAt: row.decidedAt },
    });
  });
}

/**
 * Route 2 — hand the company to another rep.
 *
 * The flag is checked **before** visibility, which is the order `18 §2` had to
 * be corrected into: `verify:slice3` found `setCreditSplit` asking visibility
 * first, which made a founder-granted flag dead for the one role that had it.
 */
export async function reassignCompany(
  session: AuthSession,
  companyId: string,
  toUserId: string,
): Promise<void> {
  if (!can(session, "canAssign")) {
    throw new RuleError("dormancy.errors.cannotAssign");
  }
  const company = await loadVisibleCompany(session, companyId);
  if (!company) throw new RuleError("dormancy.errors.companyNotVisible");
  if (company.archivedAt) {
    throw new RuleError("dormancy.errors.alreadyArchived");
  }

  const [recipient] = await db
    .select({ id: users.id, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, toUserId))
    .limit(1);
  // Work may only be handed to someone who can act on it `[04 C2]`.
  if (!recipient || !recipient.isActive) {
    throw new RuleError("dormancy.errors.recipientInactive", "toUserId");
  }
  // …and only to one of `S9`'s four recipients. Active is not the whole of it:
  // a manager or an executive is above the book, not a place to put one.
  if (!(await isCompanyBookHolder(toUserId))) {
    throw new RuleError("dormancy.errors.recipientNotAHolder", "toUserId");
  }

  await withAudit(session.actor, async (tx, log) => {
    // Soft-remove every live membership, then add the recipient's — the order
    // `team.ts` uses, because the removal has to be visible to
    // `company_reps_active_key` before the insert lands.
    const removed = await tx
      .update(companyReps)
      .set({ removedAt: new Date() })
      .where(
        and(eq(companyReps.companyId, companyId), isNull(companyReps.removedAt)),
      )
      .returning();

    const departing = removed.filter((row) => row.userId !== toUserId);
    const recipientHeld = removed.find((row) => row.userId === toUserId);

    for (const row of departing) {
      log({
        action: "company_rep.removed",
        entityType: "company_rep",
        entityId: row.id,
        before: { userId: row.userId, removedAt: null },
        after: { userId: row.userId, removedAt: row.removedAt },
      });
    }

    const [added] = await tx
      .insert(companyReps)
      .values({
        companyId,
        userId: toUserId,
        // A company handed over keeps a primary rep; dropping it would leave
        // the company with none `S18`.
        isPrimary: true,
        // `07 B3` — a hand-over is an assignment. `self_registered` is a lie.
        origin: "assigned",
        createdBy: session.user.id,
      })
      .returning();

    log({
      action: "company_rep.added",
      entityType: "company_rep",
      entityId: added.id,
      after: {
        companyId,
        userId: toUserId,
        isPrimary: added.isPrimary,
        origin: added.origin,
        // Stated so the log reads correctly when the recipient already held it:
        // their old row was soft-removed and replaced, not duplicated.
        replacedOwnMembership: Boolean(recipientHeld),
      },
    });

    const [review] = await tx
      .insert(companyDormancyReviews)
      .values({
        companyId,
        outcome: "reassigned",
        decidedByUserId: session.user.id,
        toUserId,
        decidedAt: today(),
      })
      .returning();

    log({
      action: "company.reassigned",
      entityType: "company_dormancy_review",
      entityId: review.id,
      after: { companyId, toUserId, decidedAt: review.decidedAt },
    });

    // `07 E5` — "a lead assigned to you" is act-now, and this is one record, so
    // it is per-record. `21 §5`'s one-summary rule is about a bulk handover.
    await raise(tx, log, {
      typeKey: NOTIFICATION_TYPES.recordAssigned,
      recipientUserId: toUserId,
      anchorType: "company",
      anchorId: companyId,
    });
  });
}

/**
 * Route 3 — archive as out of scope.
 *
 * A written reason is required, for the same reason `10 §8` requires one on a
 * cancellation: it is cheap, and it is the one field that makes the audit entry
 * worth reading later.
 */
export async function archiveCompany(
  session: AuthSession,
  companyId: string,
  note: string,
): Promise<void> {
  if (!can(session, "canAssign")) {
    throw new RuleError("dormancy.errors.cannotAssign");
  }
  const company = await loadVisibleCompany(session, companyId);
  if (!company) throw new RuleError("dormancy.errors.companyNotVisible");
  if (company.archivedAt) {
    throw new RuleError("dormancy.errors.alreadyArchived");
  }
  const cleanNote = checkNote(note);
  if (!cleanNote) throw new RuleError("dormancy.errors.noteRequired", "note");

  await withAudit(session.actor, async (tx, log) => {
    const [updated] = await tx
      .update(companies)
      .set({ archivedAt: new Date() })
      .where(and(eq(companies.id, companyId), isNull(companies.archivedAt)))
      .returning({ id: companies.id, archivedAt: companies.archivedAt });
    if (!updated) throw new RuleError("dormancy.errors.alreadyArchived");

    log({
      action: "company.archived",
      entityType: "company",
      entityId: companyId,
      before: { archivedAt: null },
      after: { archivedAt: updated.archivedAt },
    });

    const [review] = await tx
      .insert(companyDormancyReviews)
      .values({
        companyId,
        outcome: "archived",
        decidedByUserId: session.user.id,
        note: cleanNote,
        decidedAt: today(),
      })
      .returning();

    log({
      action: "company.dormancy_reviewed",
      entityType: "company_dormancy_review",
      entityId: review.id,
      after: { companyId, outcome: review.outcome, decidedAt: review.decidedAt },
    });
  });
}
