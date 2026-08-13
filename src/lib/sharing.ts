/**
 * Sharing — `07 B1`, `07 B2`, `14 §2`, `25 §30`.
 *
 * **The writer `record_shares` never had.** The table has existed since
 * migration `0000` and the filters in `authz.ts` read it; nothing has ever
 * written a row, `can_share` was seeded and read by nothing, and every share in
 * a dev database was inserted by a verify script by hand. `25 §30` names that
 * as the gap: *"The per-record visibility model — the most-designed thing in
 * FACET — has never been usable by a human."* This module is the hand.
 *
 * **The manager initiates; the rep phones** `[07 B1]`. There is deliberately no
 * request path here and there must not be one without a new user-truth
 * document. `07 B4` settles the identical question for the assignment call —
 * *"FACET records the outcome, not the conversation"* — and `25 §15` says the
 * same of the system generally. A request would also need a type to tell the
 * manager one had arrived, and `21 §2` seeds a type only when a document names
 * it and something produces it.
 *
 * **Per record, never everything** `[07 B2]`, and only the three kinds a share
 * actually grants something on — `SHARED_RECORD_TYPES`, whose own comment
 * carries the evidence. A row on `contact`, `quotation_version` or `dispatch`
 * is refused rather than written and ignored: no filter reads one, so it would
 * grant nothing while looking on screen exactly like a grant that worked.
 *
 * **A share grants EDIT, not view** `[14 §2]`. Nothing in this module
 * implements that — visibility *is* edit in FACET, stated once in `authz.ts`
 * and true of every screen — but the panel says so out loud, because the
 * manager should know what he is handing over.
 *
 * **Dated rows, never a mutable field.** A revoke stamps `revoked_at` and
 * `revoked_by_user_id`; nothing is deleted `[12 §7]`. Re-granting after a
 * revoke is a NEW row rather than an un-revoke, which falls out of the
 * duplicate check looking only at live rows — so the history of who held what,
 * when, and who ended it stays readable.
 *
 * **What this module deliberately does NOT refuse, stated so the next reader
 * knows it was decided rather than missed:** a grant to somebody who already
 * holds the record another way — its owning rep, a company member, the thread's
 * raiser. `shareableUsers` does not exclude them and `grantShare` does not
 * refuse them, so a manager can share a company with the rep whose company it
 * is. The consequence is real and small: a `record_shares` row that grants
 * nothing new, and a persistent `share.granted` notification about access the
 * rep already had. No document asks for the refusal, "already holds it" is a
 * different question for each of the three record types, and inventing the rule
 * here is what `13 §1` and CLAUDE.md forbid. The duplicate check that IS made
 * is narrower and structural: two live rows for one (record, person) would make
 * the revoke control ambiguous about which row it ends.
 */

import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { recordShares, users } from "@/db/schema";
import { withAudit } from "@/lib/audit";
import {
  can,
  canViewRecord,
  listActiveUsers,
  type AuthSession,
  type SharedRecordType,
} from "@/lib/authz";
import { NOTIFICATION_TYPES, SHARED_RECORD_TYPES } from "@/lib/enums";
import { raise } from "@/lib/notifications";
import { RuleError } from "@/lib/validation";

/** One live share, as the panel renders it. */
export type Share = {
  id: string;
  recordType: SharedRecordType;
  recordId: string;
  sharedWithUserId: string;
  sharedWithName: string;
  sharedByUserId: string;
  /** Resolved on read `[19 §6]`, never stored — an account is editable. */
  sharedByName: string | null;
  createdAt: Date;
};

/** Narrow a stored `record_type` to the three a share may carry. */
export function asSharedRecordType(value: string): SharedRecordType | null {
  return SHARED_RECORD_TYPES.find((type) => type === value) ?? null;
}

/* ------------------------------------------------------------------ *
 * Reading
 * ------------------------------------------------------------------ */

/**
 * The live shares on one record, newest first.
 *
 * **Live only.** A revoked row is history and belongs to the audit log, not to
 * a panel headed "who holds this" — the same choice `listCompanyReps` makes
 * about removed memberships.
 *
 * No visibility filter of its own: every caller has already loaded the record
 * through that record's own filter, and who else is working a record is a fact
 * about the record rather than about a rep. That is why the panel shows to
 * anyone who can open it and not only to `can_share` — the owning rep is the
 * person who phoned to ask for the share `[07 B1]`.
 *
 * Two queries rather than a self-join on `users`, which is `dormancyReviews`'s
 * shape: one alias per role would buy nothing over one small `inArray` across
 * the handful of people who have ever granted anything.
 */
export async function listShares(
  recordType: SharedRecordType,
  recordId: string,
): Promise<Share[]> {
  const sharedWith = users;

  const rows = await db
    .select({
      id: recordShares.id,
      recordType: recordShares.recordType,
      recordId: recordShares.recordId,
      sharedWithUserId: recordShares.sharedWithUserId,
      sharedWithName: sharedWith.name,
      sharedByUserId: recordShares.sharedByUserId,
      createdAt: recordShares.createdAt,
    })
    .from(recordShares)
    .innerJoin(sharedWith, eq(sharedWith.id, recordShares.sharedWithUserId))
    .where(
      and(
        eq(recordShares.recordType, recordType),
        eq(recordShares.recordId, recordId),
        isNull(recordShares.revokedAt),
      ),
    )
    .orderBy(desc(recordShares.createdAt));

  if (rows.length === 0) return [];

  const granterIds = [...new Set(rows.map((row) => row.sharedByUserId))];
  const granters = new Map(
    (
      await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, granterIds))
    ).map((row) => [row.id, row.name]),
  );

  return rows.map((row) => ({
    ...row,
    recordType: row.recordType as SharedRecordType,
    sharedByName: granters.get(row.sharedByUserId) ?? null,
  }));
}

/**
 * Who this record may still be shared with.
 *
 * Every active colleague, minus whoever already holds a live share of it —
 * those people are listed directly above the picker, and offering the same
 * grant twice is the only thing this excludes. It does NOT exclude the record's
 * owner or members; see the module doc for why that non-rule is deliberate.
 *
 * `listActiveUsers` is the same directory the assignment, handover and mention
 * pickers use: a list of colleagues is not a record, so it carries no
 * visibility filter. Deactivated accounts are absent — work may only be handed
 * to somebody who can act on it `[04 C2]`.
 *
 * The grantor is dropped from their own picker. Sharing a record with yourself
 * grants nothing — every role that can share already sees everything it can
 * reach — and the same reasoning drops you from the mention picker `[25 §11]`.
 */
export async function shareableUsers(
  session: AuthSession,
  recordType: SharedRecordType,
  recordId: string,
): Promise<{ id: string; name: string }[]> {
  const [people, held] = await Promise.all([
    listActiveUsers(),
    db
      .select({ userId: recordShares.sharedWithUserId })
      .from(recordShares)
      .where(
        and(
          eq(recordShares.recordType, recordType),
          eq(recordShares.recordId, recordId),
          isNull(recordShares.revokedAt),
        ),
      ),
  ]);

  const taken = new Set(held.map((row) => row.userId));
  return people.filter(
    (person) => person.id !== session.user.id && !taken.has(person.id),
  );
}

/* ------------------------------------------------------------------ *
 * Writing
 * ------------------------------------------------------------------ */

/**
 * Grant a share `[07 B1]`.
 *
 * **The flag is checked BEFORE visibility**, and the order is not cosmetic:
 * `verify:slice3` found `setCreditSplit` asking visibility first, which made a
 * founder-granted flag dead for the only role that held it, and `18 §2` had to
 * be corrected into this order. `dormancy.ts` carries the same note.
 *
 * Then three more questions, each with its own key so a refusal says which one:
 * can the grantor see what they are handing over, is the recipient an account
 * that can act `[04 C2]`, and is there already a live row for this pair.
 *
 * The notification is raised **inside the same transaction as the row**
 * `[21 §10]`: a rep must never be told about a share that rolled back. This is
 * the producer `share.granted` was seeded complete for `[21 §11]` — the type,
 * its tier, its persistence and its resolution rule per anchor were all settled
 * in `21 §2`–`§4`, and none of them is redesigned here.
 */
export async function grantShare(
  session: AuthSession,
  recordType: SharedRecordType,
  recordId: string,
  toUserId: string,
): Promise<void> {
  if (!can(session, "canShare")) {
    throw new RuleError("sharing.errors.cannotShare");
  }
  if (!(await canViewRecord(session, recordType, recordId))) {
    throw new RuleError("sharing.errors.recordNotVisible");
  }

  const [recipient] = await db
    .select({ id: users.id, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, toUserId))
    .limit(1);
  if (!recipient || !recipient.isActive) {
    throw new RuleError("sharing.errors.recipientInactive", "sharedWithUserId");
  }

  const [live] = await db
    .select({ id: recordShares.id })
    .from(recordShares)
    .where(
      and(
        eq(recordShares.recordType, recordType),
        eq(recordShares.recordId, recordId),
        eq(recordShares.sharedWithUserId, toUserId),
        isNull(recordShares.revokedAt),
      ),
    )
    .limit(1);
  if (live) {
    throw new RuleError("sharing.errors.alreadyShared", "sharedWithUserId");
  }

  await withAudit(session.actor, async (tx, log) => {
    const [created] = await tx
      .insert(recordShares)
      .values({
        recordType,
        recordId,
        sharedWithUserId: toUserId,
        sharedByUserId: session.user.id,
      })
      .returning();

    log({
      action: "share.granted",
      entityType: "record_share",
      entityId: created.id,
      after: {
        recordType: created.recordType,
        recordId: created.recordId,
        sharedWithUserId: created.sharedWithUserId,
        sharedByUserId: created.sharedByUserId,
      },
    });

    // `07 E5`'s "a share approved", on the three anchors `21 §3` states a
    // resolution rule for, and no others.
    await raise(tx, log, {
      typeKey: NOTIFICATION_TYPES.shareGranted,
      recipientUserId: toUserId,
      anchorType: recordType,
      anchorId: recordId,
    });
  });
}

/**
 * Revoke a share `[07 B1]`. **A dated row, never a delete** `[12 §7]`.
 *
 * **It checks visibility as well as the flag, and that is not redundant.**
 * Checking only `can_share` is safe today solely because both roles holding it
 * also hold `sees_all_reps` — which is safety by caller rather than by
 * function, the property `verify-comments` §2 disproved for `commentEvents` in
 * one line. Roles are permission flags in a table, so a role with `can_share`
 * and no `sees_all_reps` is one form submission away; without this check that
 * holder could end shares on records they cannot open.
 *
 * The live-row guard is in the UPDATE's own WHERE rather than a read
 * beforehand, so a double submit ends the row once and the second attempt is
 * refused rather than silently restamping a later date over the real one —
 * `archiveCompany`'s shape.
 *
 * **The notification it raised is not resolved here.** That is the sweep's job
 * and it is by condition, not by act — see `resolveRevokedShares` in
 * `notifications.ts`, and `10 §10` for why the distinction is load-bearing.
 */
export async function revokeShare(
  session: AuthSession,
  shareId: string,
): Promise<void> {
  if (!can(session, "canShare")) {
    throw new RuleError("sharing.errors.cannotShare");
  }

  const [share] = await db
    .select({
      id: recordShares.id,
      recordType: recordShares.recordType,
      recordId: recordShares.recordId,
    })
    .from(recordShares)
    .where(eq(recordShares.id, shareId))
    .limit(1);
  if (!share) throw new RuleError("sharing.errors.shareNotFound");

  // The ANCHOR's visibility, not the share row's — a share is only ever as
  // visible as the record it sits on. A stored value outside the three is
  // refused rather than cast: `grantShare` cannot write one, but a hand-written
  // row can exist, and every verify script until this slice wrote them.
  const recordType = asSharedRecordType(share.recordType);
  if (!recordType) throw new RuleError("sharing.errors.recordTypeNotShareable");
  if (!(await canViewRecord(session, recordType, share.recordId))) {
    throw new RuleError("sharing.errors.recordNotVisible");
  }

  await withAudit(session.actor, async (tx, log) => {
    const [revoked] = await tx
      .update(recordShares)
      .set({ revokedAt: new Date(), revokedByUserId: session.user.id })
      .where(and(eq(recordShares.id, shareId), isNull(recordShares.revokedAt)))
      .returning();
    if (!revoked) throw new RuleError("sharing.errors.alreadyRevoked");

    log({
      action: "share.revoked",
      entityType: "record_share",
      entityId: revoked.id,
      before: { revokedAt: null, revokedByUserId: null },
      after: {
        recordType: revoked.recordType,
        recordId: revoked.recordId,
        sharedWithUserId: revoked.sharedWithUserId,
        revokedAt: revoked.revokedAt,
        revokedByUserId: revoked.revokedByUserId,
      },
    });
  });
}
