/**
 * Offboarding and handover `[04 Q8.1]`, `[07 B7]`, `[19]` — moving a departed
 * person's work to a colleague.
 *
 * **The boundary with `authz.ts`.** That module decides *who may act*; this one
 * moves work between people and asks it for permission, exactly as
 * `targets.ts` and `credit-splits.ts` do. Nothing here defines a flag, reads or
 * writes `sessions`, or builds a visibility predicate.
 *
 * **The reads compose no visibility filter, deliberately.** "Whose book is
 * this" is the screen's subject, not an authorization question — the
 * authorization question is the single `can_manage_users` check, and the whole
 * point of the screen is that a manager sees records they do not own. Adding
 * `visibleProjectsFilter` here would look like a correction and would silently
 * empty the screen. (All three seeded holders of the flag also carry
 * `sees_all_reps`, so it grants them nothing they lack today.)
 *
 * **Three buckets, and what is deliberately not one:**
 *
 *  - `company_reps` membership · `projects.owner_user_id` ·
 *    `quotation_threads.raised_by_user_id`.
 *  - **A fourth bucket, open `tasks`, existed here until feature slice 6.**
 *    `25 §20` ("manual tasks are built, small") was withdrawn — "not needed
 *    for now" — and `tasks` was dropped with it `[26 §6]`. `19 §7` still
 *    names it as one of four; that is superseded, not wrong at the time it
 *    was written, and this document is not edited to match.
 *  - **Contacts are not a bucket**, though `04 Q8.1` names them: a contact has
 *    no owner of its own and follows its company `[14 §1]`, so handing over the
 *    membership hands over the contacts `[19 §7]`.
 *  - **Dispatches, targets and credit splits are not buckets.** Credit is fixed
 *    to `dispatches.user_id` at the moment of the event `[18 §1]`, targets are
 *    dated rows `[07 D1]` and splits are dated generations `[07 D3]`. Moving
 *    any of them would rewrite a past month. This is the central negative claim
 *    of the phase, and `verify:phase11` asserts it.
 *  - **`record_shares` held by the departing user** are neither listed nor
 *    revoked — `19 §8` leaves that open, login is already blocked, and `12 §7`
 *    forbids deleting them.
 *
 * **Nothing moves automatically** `[07 B7]`. Deactivation writes nothing here;
 * every row moves because somebody ticked it. Deleting is not offered at all:
 * `12 §7` supersedes `04 Q8.1`'s "or delete them" `[19 §7]`.
 */

import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  companies,
  companyReps,
  projects,
  quotationThreads,
  users,
} from "@/db/schema";
import { withAudit } from "@/lib/audit";
import { can, type AuthSession } from "@/lib/authz";
import { NOTIFICATION_TYPES } from "@/lib/enums";
import { raise } from "@/lib/notifications";
import { RuleError } from "@/lib/validation";

export type HandoverCompany = {
  /** `company_reps.id` — the membership row that actually moves. */
  membershipId: string;
  companyId: string;
  nameEn: string;
  nameAr: string | null;
  isPrimary: boolean;
};

export type HandoverProject = {
  id: string;
  nameEn: string;
  nameAr: string | null;
};

export type HandoverThread = {
  id: string;
  projectNameEn: string;
  projectNameAr: string | null;
  companyNameEn: string;
  companyNameAr: string | null;
  createdAt: Date;
};

export type HandoverBook = {
  user: { id: string; name: string; email: string };
  companies: HandoverCompany[];
  projects: HandoverProject[];
  quotationThreads: HandoverThread[];
  isEmpty: boolean;
};

export type HandoverSelection = {
  membershipIds: string[];
  projectIds: string[];
  threadIds: string[];
};

export type HandoverOutcome = {
  companiesMoved: number;
  /** The recipient was ALREADY a rep: the old membership went, none was added. */
  companiesAlreadyMember: number;
  projectsMoved: number;
  threadsMoved: number;
};

function requireManageUsers(session: AuthSession): void {
  if (!can(session, "canManageUsers")) {
    throw new RuleError("team.errors.manageUsersOnly");
  }
}

/**
 * Everything still held by a departed person.
 *
 * Returns `null` when there is no such user **or the account is still active**
 * `[19 §3]` — handover opens only after deactivation, and a 404 is how the
 * screen expresses it. The gate lives here so the UI is never the gate.
 */
export async function getHandoverBook(
  session: AuthSession,
  userId: string,
): Promise<HandoverBook | null> {
  requireManageUsers(session);

  const [subject] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!subject || subject.isActive) return null;

  const [companyRows, projectRows, threadRows] = await Promise.all([
    db
      .select({
        membershipId: companyReps.id,
        companyId: companies.id,
        nameEn: companies.nameEn,
        nameAr: companies.nameAr,
        isPrimary: companyReps.isPrimary,
      })
      .from(companyReps)
      .innerJoin(companies, eq(companyReps.companyId, companies.id))
      .where(
        and(eq(companyReps.userId, userId), isNull(companyReps.removedAt)),
      )
      .orderBy(asc(companies.nameEn)),

    db
      .select({
        id: projects.id,
        nameEn: projects.nameEn,
        nameAr: projects.nameAr,
      })
      .from(projects)
      .where(eq(projects.ownerUserId, userId))
      .orderBy(asc(projects.nameEn)),

    db
      .select({
        id: quotationThreads.id,
        projectNameEn: projects.nameEn,
        projectNameAr: projects.nameAr,
        companyNameEn: companies.nameEn,
        companyNameAr: companies.nameAr,
        createdAt: quotationThreads.createdAt,
      })
      .from(quotationThreads)
      .innerJoin(projects, eq(quotationThreads.projectId, projects.id))
      .innerJoin(companies, eq(quotationThreads.companyId, companies.id))
      .where(eq(quotationThreads.raisedByUserId, userId))
      .orderBy(asc(projects.nameEn)),
  ]);

  return {
    user: { id: subject.id, name: subject.name, email: subject.email },
    companies: companyRows,
    projects: projectRows,
    quotationThreads: threadRows,
    isEmpty:
      companyRows.length === 0 &&
      projectRows.length === 0 &&
      threadRows.length === 0,
  };
}

/**
 * Hand selected work from one person to another, in one transaction.
 *
 * **Bulk and one-at-a-time are the same call** — one item is a selection of
 * size one, which is what `07 B7` asks for without two code paths to drift.
 *
 * Every statement is scoped to the *source* holder as well as the id
 * (`AND owner_user_id = :from`, `AND removed_at IS NULL`, `AND status =
 * 'open'`), and the affected row count is compared against the requested count.
 * A mismatch means somebody else moved the row first, and it throws — rolling
 * the whole handover back rather than half-applying it.
 */
export async function reassignHandover(
  session: AuthSession,
  fromUserId: string,
  toUserId: string,
  selection: HandoverSelection,
): Promise<HandoverOutcome> {
  requireManageUsers(session);

  const membershipIds = unique(selection.membershipIds);
  const projectIds = unique(selection.projectIds);
  const threadIds = unique(selection.threadIds);

  const requested = membershipIds.length + projectIds.length + threadIds.length;
  if (requested === 0) throw new RuleError("team.errors.nothingSelected");

  if (fromUserId === toUserId) {
    throw new RuleError("team.errors.recipientIsSource", "toUserId");
  }

  const [source] = await db
    .select({ id: users.id, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, fromUserId))
    .limit(1);
  if (!source) throw new RuleError("team.errors.userNotFound");
  // `19 §3` — the review begins after access is revoked.
  if (source.isActive) throw new RuleError("team.errors.userStillActive");

  const [recipient] = await db
    .select({ id: users.id, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, toUserId))
    .limit(1);
  // Work may only be handed to someone who can act on it `[04 C2]`.
  if (!recipient || !recipient.isActive) {
    throw new RuleError("team.errors.recipientInactive", "toUserId");
  }

  return withAudit(session.actor, async (tx, log) => {
    const outcome: HandoverOutcome = {
      companiesMoved: 0,
      companiesAlreadyMember: 0,
      projectsMoved: 0,
      threadsMoved: 0,
    };

    /* --- Company membership -------------------------------------- *
     * `company_reps_active_key` is unique on (company_id, user_id) WHERE
     * removed_at IS NULL, so `UPDATE ... SET user_id` is wrong twice over: it
     * violates the index whenever the recipient already holds the company, and
     * it would erase the fact that the departing rep ever did, which `12 §7`
     * forbids. Soft-remove then insert, in that order — the removal has to be
     * visible to the index before the insert lands.                          */
    for (const membershipId of membershipIds) {
      const [removed] = await tx
        .update(companyReps)
        .set({ removedAt: new Date() })
        .where(
          and(
            eq(companyReps.id, membershipId),
            eq(companyReps.userId, fromUserId),
            isNull(companyReps.removedAt),
          ),
        )
        .returning();
      if (!removed) throw new RuleError("team.errors.itemNotHeld");

      log({
        action: "company_rep.removed",
        entityType: "company_rep",
        entityId: removed.id,
        before: { userId: fromUserId, removedAt: null },
        after: { userId: fromUserId, removedAt: removed.removedAt },
      });

      const [existing] = await tx
        .select({ id: companyReps.id })
        .from(companyReps)
        .where(
          and(
            eq(companyReps.companyId, removed.companyId),
            eq(companyReps.userId, toUserId),
            isNull(companyReps.removedAt),
          ),
        )
        .limit(1);

      if (existing) {
        // Already a rep on this company — nothing to add. Whether their row is
        // promoted to primary when the departing one was is OPEN `[19 §8]`.
        outcome.companiesAlreadyMember += 1;
        continue;
      }

      const [added] = await tx
        .insert(companyReps)
        .values({
          companyId: removed.companyId,
          userId: toUserId,
          // The same holding moving to a new person keeps its primacy;
          // dropping it would leave the company with no primary rep `[04 Q11]`.
          isPrimary: removed.isPrimary,
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
          companyId: added.companyId,
          userId: toUserId,
          isPrimary: added.isPrimary,
          origin: added.origin,
        },
      });
      outcome.companiesMoved += 1;
    }

    /* --- Projects ------------------------------------------------ *
     * `owner_user_id` is deliberately absent from `projects.ts`'s editable
     * list: handover is the only path that changes an owner, which is exactly
     * `07 A8`. Visibility moves with it — `visibleProjectsFilter` keys on this
     * column, and `11 §2` carries the threads raised on the project with it.
     * No share row is written and none should be.                            */
    if (projectIds.length > 0) {
      const moved = await tx
        .update(projects)
        .set({ ownerUserId: toUserId })
        .where(
          and(
            inArray(projects.id, projectIds),
            eq(projects.ownerUserId, fromUserId),
          ),
        )
        .returning({ id: projects.id });
      if (moved.length !== projectIds.length) {
        throw new RuleError("team.errors.itemNotHeld");
      }
      for (const row of moved) {
        log({
          action: "project.reassigned",
          entityType: "project",
          entityId: row.id,
          before: { ownerUserId: fromUserId },
          after: { ownerUserId: toUserId },
        });
      }
      outcome.projectsMoved = moved.length;
    }

    /* --- Quotation threads --------------------------------------- *
     * `19 §1`. Ownership moves; authorship does not — the payment confirmer,
     * the canceller, every version's author and every dispatch are records of
     * who performed an act, and rewriting one would rewrite the act.          */
    if (threadIds.length > 0) {
      const moved = await tx
        .update(quotationThreads)
        .set({ raisedByUserId: toUserId })
        .where(
          and(
            inArray(quotationThreads.id, threadIds),
            eq(quotationThreads.raisedByUserId, fromUserId),
          ),
        )
        .returning({ id: quotationThreads.id });
      if (moved.length !== threadIds.length) {
        throw new RuleError("team.errors.itemNotHeld");
      }
      for (const row of moved) {
        log({
          action: "quotation_thread.reassigned",
          entityType: "quotation_thread",
          entityId: row.id,
          before: { raisedByUserId: fromUserId },
          after: { raisedByUserId: toUserId },
        });
      }
      outcome.threadsMoved = moved.length;
    }

    // One summary row, so the log answers "who ran this handover, and how big
    // was it" without reassembling the per-row entries.
    log({
      action: "user.handover",
      entityType: "user",
      entityId: fromUserId,
      after: { toUserId, ...outcome },
    });

    /* --- One notification, not one per record `[21 §5]` ------------- *
     * A handover routinely moves dozens of records. Raising a persistent
     * act-now notification for each would hand the recipient fifty
     * undismissable badges, which is what makes a tier get ignored — the
     * opposite of what `07 G1` wanted from persistence.
     *
     * `record.handed_over` is therefore act-now and NOT persistent: it has no
     * anchor and no completion condition. It is news. The work items are the
     * individual records, and they already reach the recipient through their
     * own lists, timelines and follow-ups.                                     */
    const moved =
      outcome.companiesMoved + outcome.projectsMoved + outcome.threadsMoved;
    if (moved > 0) {
      await raise(tx, log, {
        typeKey: NOTIFICATION_TYPES.recordHandedOver,
        recipientUserId: toUserId,
        // No anchor: the payload names the departing rep, because
        // `notifications` has no title or body column by design `[21 §10]`.
        payload: {
          fromUserId,
          counts: {
            companies: outcome.companiesMoved,
            projects: outcome.projectsMoved,
            quotationThreads: outcome.threadsMoved,
          },
        },
      });
    }

    return outcome;
  });
}

function unique(ids: string[] | undefined): string[] {
  return [...new Set((ids ?? []).filter((id) => id.length > 0))];
}
