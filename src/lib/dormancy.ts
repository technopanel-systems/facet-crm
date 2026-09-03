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
 *  3. **Archived as out of scope.** Requires `can_approve_delete` `S107`
 *     (`can_assign` until session 54). Taking a company out of the working
 *     set is not a rep's call — but since session 54 a rep can ASK: the
 *     second way in `S105` `S106`, `requestRemoval` below.
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

import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  companies,
  companyDormancyReviews,
  companyRemovalRequests,
  companyReps,
  users,
} from "@/db/schema";
import { withAudit } from "@/lib/audit";
import {
  can,
  canViewRecord,
  isCompanyBookHolder,
  visibleCompaniesFilter,
  type AuthSession,
} from "@/lib/authz";
import { NOTIFICATION_TYPES, type DormancyOutcome } from "@/lib/enums";
import { raise } from "@/lib/notifications";
import { today } from "@/lib/reports";
import { RuleError } from "@/lib/validation";

/** The two halves of `withAudit`'s callback, for the helpers that run inside it. */
type TxArgs = Parameters<Parameters<typeof withAudit>[1]>;

/* ------------------------------------------------------------------ *
 * The second way in — `S105`, `S106`
 * ------------------------------------------------------------------ */

export type RemovalRequest = {
  id: string;
  companyId: string;
  requestedByUserId: string;
  requestedByName: string;
  reason: string;
  createdAt: Date;
  /** The review that answered it, or null while it is with the manager. */
  reviewId: string | null;
};

const REASON_MAX = 500;

/** The open request on one company, or null. No visibility filter of its
 *  own, for `dormancyReviews`'s reason: every caller has already come
 *  through `getCompany`. */
export async function pendingRemovalRequest(
  companyId: string,
): Promise<RemovalRequest | null> {
  const [row] = await db
    .select({
      id: companyRemovalRequests.id,
      companyId: companyRemovalRequests.companyId,
      requestedByUserId: companyRemovalRequests.requestedByUserId,
      requestedByName: users.name,
      reason: companyRemovalRequests.reason,
      createdAt: companyRemovalRequests.createdAt,
      reviewId: companyRemovalRequests.reviewId,
    })
    .from(companyRemovalRequests)
    .innerJoin(users, eq(users.id, companyRemovalRequests.requestedByUserId))
    .where(
      and(
        eq(companyRemovalRequests.companyId, companyId),
        isNull(companyRemovalRequests.reviewId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Every request ever made on one company, newest first — the history
 *  beside the decisions `S107`. */
export async function removalRequests(
  companyId: string,
): Promise<RemovalRequest[]> {
  return db
    .select({
      id: companyRemovalRequests.id,
      companyId: companyRemovalRequests.companyId,
      requestedByUserId: companyRemovalRequests.requestedByUserId,
      requestedByName: users.name,
      reason: companyRemovalRequests.reason,
      createdAt: companyRemovalRequests.createdAt,
      reviewId: companyRemovalRequests.reviewId,
    })
    .from(companyRemovalRequests)
    .innerJoin(users, eq(users.id, companyRemovalRequests.requestedByUserId))
    .where(eq(companyRemovalRequests.companyId, companyId))
    .orderBy(desc(companyRemovalRequests.createdAt));
}

/**
 * The queue — every open request this identity may decide, **oldest first**
 * `S87`. `D41`'s *Needs a decision*, the archive half.
 *
 * The flag is `can_approve_delete` `S8` — the manager, the executive and the
 * super admin — and the company filter is composed as well, for
 * `revokeShare`'s reason: the three holders all see every rep today, and a
 * role with the flag and without `sees_all_reps` is one form submission
 * away. Empty, not refused, for anyone else: the block is absent `D53`.
 */
export async function listPendingRemovalRequests(
  session: AuthSession,
): Promise<{ rows: (RemovalRequest & { companyName: string })[]; total: number }> {
  if (!can(session, "canApproveDelete")) return { rows: [], total: 0 };
  const rows = await db
    .select({
      id: companyRemovalRequests.id,
      companyId: companyRemovalRequests.companyId,
      companyName: companies.name,
      requestedByUserId: companyRemovalRequests.requestedByUserId,
      requestedByName: users.name,
      reason: companyRemovalRequests.reason,
      createdAt: companyRemovalRequests.createdAt,
      reviewId: companyRemovalRequests.reviewId,
    })
    .from(companyRemovalRequests)
    .innerJoin(companies, eq(companies.id, companyRemovalRequests.companyId))
    .innerJoin(users, eq(users.id, companyRemovalRequests.requestedByUserId))
    .where(
      and(
        isNull(companyRemovalRequests.reviewId),
        visibleCompaniesFilter(session),
      ),
    )
    .orderBy(asc(companyRemovalRequests.createdAt));
  return { rows, total: rows.length };
}

/**
 * `S105` — the rep's press. **A request, never an action**: the row is the
 * whole effect, and nothing about the company changes until a review row
 * answers it.
 *
 * Who may press: somebody **holding** the company — a live `company_reps`
 * row — because *nothing leaves HIS list* is the rule's own subject. Seeing
 * the company through a share is not holding it, and an overseer who reads
 * everything has the three decisions instead. The reason is required and
 * refused as a message, the way `archiveCompany`'s note is.
 */
export async function requestRemoval(
  session: AuthSession,
  companyId: string,
  reason: string,
): Promise<void> {
  const company = await loadVisibleCompany(session, companyId);
  if (!company) throw new RuleError("dormancy.errors.companyNotVisible");
  if (company.archivedAt) {
    throw new RuleError("dormancy.errors.alreadyArchived");
  }
  const [membership] = await db
    .select({ id: companyReps.id })
    .from(companyReps)
    .where(
      and(
        eq(companyReps.companyId, companyId),
        eq(companyReps.userId, session.user.id),
        isNull(companyReps.removedAt),
      ),
    )
    .limit(1);
  if (!membership) throw new RuleError("dormancy.errors.notYourCompany");

  const cleanReason = reason.trim();
  if (!cleanReason) {
    throw new RuleError("dormancy.errors.reasonRequired", "reason");
  }
  if (cleanReason.length > REASON_MAX) {
    throw new RuleError("dormancy.errors.noteTooLong", "reason");
  }
  if (await pendingRemovalRequest(companyId)) {
    throw new RuleError("dormancy.errors.requestPending");
  }

  await withAudit(session.actor, async (tx, log) => {
    const [row] = await tx
      .insert(companyRemovalRequests)
      .values({
        companyId,
        requestedByUserId: session.user.id,
        reason: cleanReason,
      })
      .returning();
    log({
      action: "company.removal_requested",
      entityType: "company_removal_request",
      entityId: row.id,
      after: { companyId, reason: row.reason },
    });
  });
}

/**
 * `S106` — the next decision answers the open request, whichever of the
 * three it is. Inside the deciding transaction, so a request is never
 * answered by a review that rolled back.
 */
async function answerRequest(
  tx: TxArgs[0],
  log: TxArgs[1],
  companyId: string,
  reviewId: string,
): Promise<{ requestedByUserId: string } | null> {
  const [answered] = await tx
    .update(companyRemovalRequests)
    .set({ reviewId })
    .where(
      and(
        eq(companyRemovalRequests.companyId, companyId),
        isNull(companyRemovalRequests.reviewId),
      ),
    )
    .returning();
  if (!answered) return null;
  log({
    action: "company.removal_request.decided",
    entityType: "company_removal_request",
    entityId: answered.id,
    before: { reviewId: null },
    after: { reviewId },
  });
  return { requestedByUserId: answered.requestedByUserId };
}

/**
 * `S128`, session 55 — **the decision reaches the rep.** One
 * `decision.ended_work` row per person told, on the bell `S92`, never to the
 * actor about their own act. `raise` itself drops an inactive recipient.
 *
 * Who is told is the caller's to say: an archive or a reassignment ends the
 * work of every live holder `S107` `S100`; a keep ends nobody's and answers
 * the rep who asked `S105`. The reason is the manager's note where one was
 * written and empty otherwise — the screen prints no reason line for an
 * empty one.
 */
async function tellDecision(
  tx: TxArgs[0],
  log: TxArgs[1],
  session: AuthSession,
  companyId: string,
  decision: "company_archived" | "company_kept" | "company_reassigned",
  reason: string | null,
  recipients: Iterable<string>,
): Promise<void> {
  const told = new Set<string>();
  for (const userId of recipients) {
    if (userId === session.user.id || told.has(userId)) continue;
    told.add(userId);
    await raise(tx, log, {
      typeKey: NOTIFICATION_TYPES.decisionEndedWork,
      recipientUserId: userId,
      payload: {
        decision,
        reason: reason ?? "",
        recordType: "company",
        recordId: companyId,
        decidedByUserId: session.user.id,
      },
    });
  }
}

/** Every live holder of the company — `company_reps` with no `removed_at`. */
async function liveHolderIds(
  tx: TxArgs[0],
  companyId: string,
): Promise<string[]> {
  const rows = await tx
    .select({ userId: companyReps.userId })
    .from(companyReps)
    .where(
      and(eq(companyReps.companyId, companyId), isNull(companyReps.removedAt)),
    );
  return rows.map((row) => row.userId);
}

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
  // `S105` — while a request is with the manager, *keep* is the manager's
  // answer, not the rep's withdrawal: the press was a request and the ruling
  // is somebody else's. The holder of `can_approve_delete` keeps it here and
  // that closes the request `S106`.
  if (
    (await pendingRemovalRequest(companyId)) &&
    !can(session, "canApproveDelete")
  ) {
    throw new RuleError("dormancy.errors.requestPending");
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

    // `S128` — a keep answers the rep who asked; an unrequested keep on a
    // quiet company ends nobody's work and tells nobody.
    const answered = await answerRequest(tx, log, companyId, row.id);
    if (answered) {
      await tellDecision(tx, log, session, companyId, "company_kept", cleanNote, [
        answered.requestedByUserId,
      ]);
    }
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

    const answered = await answerRequest(tx, log, companyId, review.id);

    // `S128` — the departing holders' work on this company ended here. The
    // requester was a holder `S105`, so the list already carries them unless
    // they are the recipient, in which case nothing of theirs ended.
    await tellDecision(
      tx,
      log,
      session,
      companyId,
      "company_reassigned",
      null,
      [
        ...departing.map((row) => row.userId),
        ...(answered && answered.requestedByUserId !== toUserId
          ? [answered.requestedByUserId]
          : []),
      ],
    );

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
 *
 * **Gated by `can_approve_delete` since session 54** — `S107`'s sentence,
 * built: *archiving is gated by the delete-approval flag (S8)*. This is that
 * flag's first reader. It was `can_assign` until then, which is the
 * assignment flag `S100` and still gates route 2; the founder's ruling is
 * that the manager decides — *book management, not data leaving the system*
 * — and `S8` gives the flag to the Sales Manager, the Executive and the
 * Super Admin. The Executive can archive and cannot reassign, and the panel
 * renders each control on its own flag.
 */
export async function archiveCompany(
  session: AuthSession,
  companyId: string,
  note: string,
): Promise<void> {
  if (!can(session, "canApproveDelete")) {
    throw new RuleError("dormancy.errors.cannotArchive");
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

    // `S128` — an archive ends every holder's work on the company, asked for
    // or not; the rep who asked is told whether or not he still holds it.
    const holders = await liveHolderIds(tx, companyId);
    const answered = await answerRequest(tx, log, companyId, review.id);
    await tellDecision(tx, log, session, companyId, "company_archived", cleanNote, [
      ...holders,
      ...(answered ? [answered.requestedByUserId] : []),
    ]);
  });
}
