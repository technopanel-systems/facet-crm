/**
 * Comments — `25 §9`–`§15`.
 *
 * **What a comment is, and what it is not.** A *report* is what happened with
 * the customer — visit, call, outcome, signals — and it feeds metrics. A
 * *comment* is what colleagues say to each other about a record `[25 §9]`. It
 * never feeds a metric, never counts as activity toward anything, and never
 * appears where a report belongs: not in `/reports`, not in `reportsInRange`,
 * and never inside a coverage threshold. `25 §14` puts the
 * two counts side by side on `/activity` precisely so they cannot be added —
 * merging them would let a rep raise his activity number by talking to
 * colleagues.
 *
 * What it replaces is WhatsApp `[25 §9]`. And it does not try to become the
 * conversation `[25 §15]`: it is where a decision gets written down, not where
 * it has to be made. That is the whole reason the composer is a plain box with
 * no typing indicator, no read receipt and no reply threading.
 *
 * **No flag gate.** All roles comment `[25 §9]`, the way all roles log
 * `[20 §13]`. If you are about to add a permission flag here, the answer is
 * that the question needs no flag — visibility is the whole rule.
 *
 * **Visibility follows the record** `[25 §10]`: manager, coordinator, the
 * owning rep and any shared rep — the same rule reports follow `[20 §10]`. It
 * is stated once, in `visibleCommentsFilter` in `authz.ts`, as the five
 * existing filters composed. Nothing here builds a predicate.
 *
 * **Every read carries the filter**, anchored or not. An anchored read pins the
 * record type by equality, so four of the filter's five branches are
 * contradicted and never execute — the cost is one `exists` over one row, and
 * the benefit is that "visibility follows the record" is a property of these
 * functions rather than of their callers. The first draft relied on the
 * callers; `scripts/verify-comments.ts` §2 disproved it in one line.
 *
 * **Editable by the author, never deleted** `[25 §12]`. There is no delete
 * path here and there must not be one: `12 §7` is intact and the schema has no
 * `deleted_at`. An edit stamps `edited_at` and the audit log holds the before
 * and the after.
 *
 * **A note on the import graph.** This module imports `raise` from
 * `notifications.ts`, and `quotations.ts` imports `insertComment` from here
 * `[25 §13]`. **It is no longer a cycle.** The third edge was
 * `notifications.ts` importing `expireOverdueThreads` from `quotations.ts`,
 * and `S67` deleted that function with the sweep it ran.
 *
 * The discipline that made the cycle safe is worth keeping anyway, because the
 * chain is still there: every edge is a function called at runtime, and no
 * module here reads another's binding while its body is still evaluating. A
 * `const` initialised from an import across it would be a temporal-dead-zone
 * crash at load, not a type error.
 */

import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  commentMentions,
  comments,
  companies,
  contacts,
  dispatches,
  projects,
  quotationThreads,
  users,
} from "@/db/schema";
import { withAudit, type AuditEntry } from "@/lib/audit";
import {
  canViewRecord,
  visibleCommentsFilter,
  type AuthSession,
} from "@/lib/authz";
import { NOTIFICATION_TYPES, type CommentRecordType } from "@/lib/enums";
import { raise } from "@/lib/notifications";
import { RuleError } from "@/lib/validation";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Who was tagged. The name is resolved on read `[19 §6]`, never stored. */
export type CommentMention = {
  userId: string;
  name: string;
};

export type Comment = {
  id: string;
  recordType: CommentRecordType;
  recordId: string;
  authorUserId: string;
  authorName: string;
  body: string;
  /** Null until the author edits it `[25 §12]`. */
  editedAt: Date | null;
  createdAt: Date;
  mentions: CommentMention[];
};

export type CommentInput = {
  recordType: CommentRecordType;
  recordId: string;
  body: string;
  /** User ids, as the chip picker submits them `[25 §11]`. */
  mentions: string[];
};

/* ------------------------------------------------------------------ *
 * Reading
 * ------------------------------------------------------------------ */

/**
 * Every comment on one record this identity may read, oldest first — a
 * conversation reads forwards.
 *
 * **Scoped, not merely anchored.** It would be tempting to leave the visibility
 * term off on the grounds that a caller reaching here has already loaded the
 * record: true of every caller today, and not a property of this function.
 * `scripts/verify-comments.ts` §2 caught the same shortcut in `commentEvents`
 * by handing it an outsider's session. The rule is `25 §10`'s, stated once in
 * `visibleCommentsFilter`, and applied wherever comments are read.
 */
export async function listComments(
  session: AuthSession,
  recordType: CommentRecordType,
  recordId: string,
): Promise<Comment[]> {
  const rows = await db
    .select({
      id: comments.id,
      recordType: comments.recordType,
      recordId: comments.recordId,
      authorUserId: comments.authorUserId,
      authorName: users.name,
      body: comments.body,
      editedAt: comments.editedAt,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorUserId))
    .where(
      and(
        visibleCommentsFilter(session),
        eq(comments.recordType, recordType),
        eq(comments.recordId, recordId),
      ),
    )
    .orderBy(asc(comments.createdAt));

  return withMentions(rows);
}

/** One comment, for the edit screen. Null when it is not this viewer's to see. */
export async function getComment(
  session: AuthSession,
  id: string,
): Promise<Comment | null> {
  const [row] = await db
    .select({
      id: comments.id,
      recordType: comments.recordType,
      recordId: comments.recordId,
      authorUserId: comments.authorUserId,
      authorName: users.name,
      body: comments.body,
      editedAt: comments.editedAt,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorUserId))
    .where(eq(comments.id, id))
    .limit(1);
  if (!row) return null;

  const recordType = row.recordType as CommentRecordType;
  if (!(await canViewRecord(session, recordType, row.recordId))) return null;

  const [decorated] = await withMentions([row]);
  return decorated ?? null;
}

type RawComment = {
  id: string;
  recordType: string;
  recordId: string;
  authorUserId: string;
  authorName: string;
  body: string;
  editedAt: Date | null;
  createdAt: Date;
};

/** One extra query for the whole page of comments, never one per row. */
async function withMentions(rows: RawComment[]): Promise<Comment[]> {
  if (rows.length === 0) return [];

  const tagged = await db
    .select({
      commentId: commentMentions.commentId,
      userId: commentMentions.mentionedUserId,
      name: users.name,
    })
    .from(commentMentions)
    .innerJoin(users, eq(users.id, commentMentions.mentionedUserId))
    .where(
      inArray(
        commentMentions.commentId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(users.name));

  const byComment = new Map<string, CommentMention[]>();
  for (const row of tagged) {
    const list = byComment.get(row.commentId) ?? [];
    list.push({ userId: row.userId, name: row.name });
    byComment.set(row.commentId, list);
  }

  return rows.map((row) => ({
    ...row,
    recordType: row.recordType as CommentRecordType,
    mentions: byComment.get(row.id) ?? [],
  }));
}

/* ------------------------------------------------------------------ *
 * Writing
 * ------------------------------------------------------------------ */

/**
 * Write one comment, its mentions and their notifications, inside the caller's
 * transaction.
 *
 * Tx-taking, like `raise` `[21 §10]`, so the comment and the act that occasioned
 * it commit together — `25 §13`'s return-for-edit is one act, and a reason that
 * survived a rolled-back return would be worse than no reason.
 *
 * **It answers no visibility question.** Every caller must have done that
 * already: `addComment` calls `canViewRecord`, and `returnForEdit` has passed
 * `assertCoordinator`. If you add a third caller, that is the thing to get
 * right.
 */
export async function insertComment(
  tx: Tx,
  log: (entry: AuditEntry) => void,
  session: AuthSession,
  input: CommentInput,
): Promise<string> {
  const body = input.body.trim();
  if (!body) throw new RuleError("comments.errors.bodyRequired", "body");

  const [created] = await tx
    .insert(comments)
    .values({
      recordType: input.recordType,
      recordId: input.recordId,
      authorUserId: session.user.id,
      body,
    })
    .returning();

  const mentioned = await addMentions(tx, log, session, created.id, input, [
    ...new Set(input.mentions),
  ]);

  log({
    action: "comment.created",
    entityType: "comment",
    entityId: created.id,
    after: {
      recordType: created.recordType,
      recordId: created.recordId,
      body: created.body,
      mentions: mentioned,
    },
  });

  return created.id;
}

/**
 * Insert the mention rows this comment does not already carry, and raise one
 * `mention.received` for each `[25 §11]`.
 *
 * **A tag on somebody who cannot see the record still notifies them.** `25 §11`
 * attaches no condition to it — *"Tagging a person raises a notification"* — and
 * a gate here would be business logic no document states. Nothing leaks: a
 * notification has no body column, and `mentionPayload` withholds the body, the
 * name and the link unless `canViewRecord` passes at the moment it is read.
 *
 * The notification is raised **anchorless**, which is not cosmetic — see the
 * seed row. Tagging yourself raises nothing: you know.
 */
async function addMentions(
  tx: Tx,
  log: (entry: AuditEntry) => void,
  session: AuthSession,
  commentId: string,
  record: { recordType: CommentRecordType; recordId: string },
  userIds: string[],
): Promise<string[]> {
  const wanted = userIds.filter((id) => id !== session.user.id);
  if (wanted.length === 0) return [];

  // A tag naming somebody who is not a user at all is dropped rather than
  // failing the comment: the words are what the author came to write.
  const real = await tx
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, wanted));
  const ids = real.map((row) => row.id);
  if (ids.length === 0) return [];

  await tx
    .insert(commentMentions)
    .values(ids.map((userId) => ({ commentId, mentionedUserId: userId })))
    .onConflictDoNothing();

  for (const userId of ids) {
    await raise(tx, log, {
      typeKey: NOTIFICATION_TYPES.mentionReceived,
      recipientUserId: userId,
      payload: {
        commentId,
        recordType: record.recordType,
        recordId: record.recordId,
        authorUserId: session.user.id,
      },
    });
  }

  return ids;
}

/**
 * Post a comment on a record.
 *
 * The record has to be one this identity may see — `25 §10` makes a comment
 * follow its record, so writing one where you cannot read is not a thing that
 * can happen. `canViewRecord` is the write-path form of the same rule the
 * filters state for lists, which is exactly what it exists for.
 */
export async function addComment(
  session: AuthSession,
  input: CommentInput,
): Promise<Comment> {
  if (!(await canViewRecord(session, input.recordType, input.recordId))) {
    throw new RuleError("comments.errors.recordNotFound");
  }

  const id = await withAudit(session.actor, (tx, log) =>
    insertComment(tx, log, session, input),
  );

  const [created] = await listOne(id);
  return created;
}

/**
 * Correct a comment. **One row, always** `[25 §12]` — an UPDATE, never a second
 * row, and never a delete.
 *
 * **Author only, forever, with no time window**, the rule `20 §9` set for a
 * report and `reports.ts` states in full: a manager reads a comment but never
 * rewrites someone else's words. That is an identity question rather than a
 * visibility one, which is why it is checked here and not in `authz`.
 *
 * The mention set is **replaced**, not appended to — the schema settled that
 * beside the table: *"re-editing a comment rewrites the set, the way `20 §9`
 * rewrites a report's signals."* Only a person newly added is notified;
 * removing a tag does not un-send a notification already delivered, because it
 * was true when it was sent.
 *
 * A no-op save writes no audit row, the way `updateReport` and `updateUser`
 * behave — `withAudit` inserts nothing when `log` is never called.
 */
export async function updateComment(
  session: AuthSession,
  id: string,
  input: { body: string; mentions: string[] },
): Promise<void> {
  const body = input.body.trim();
  if (!body) throw new RuleError("comments.errors.bodyRequired", "body");

  const [existing] = await db
    .select()
    .from(comments)
    .where(eq(comments.id, id))
    .limit(1);
  if (!existing) throw new RuleError("comments.errors.notFound");
  if (existing.authorUserId !== session.user.id) {
    throw new RuleError("comments.errors.authorOnly");
  }

  const held = await db
    .select({ userId: commentMentions.mentionedUserId })
    .from(commentMentions)
    .where(eq(commentMentions.commentId, id));
  const heldIds = new Set(held.map((row) => row.userId));

  const wanted = new Set(
    [...new Set(input.mentions)].filter(
      (userId) => userId !== session.user.id,
    ),
  );
  const added = [...wanted].filter((userId) => !heldIds.has(userId));
  const removed = [...heldIds].filter((userId) => !wanted.has(userId));
  const bodyChanged = existing.body !== body;

  if (!bodyChanged && added.length === 0 && removed.length === 0) return;

  await withAudit(session.actor, async (tx, log) => {
    if (bodyChanged) {
      await tx
        .update(comments)
        .set({ body, editedAt: new Date() })
        .where(eq(comments.id, id));
    }

    if (removed.length > 0) {
      await tx
        .delete(commentMentions)
        .where(
          and(
            eq(commentMentions.commentId, id),
            inArray(commentMentions.mentionedUserId, removed),
          ),
        );
    }

    const notified = await addMentions(
      tx,
      log,
      session,
      id,
      {
        recordType: existing.recordType as CommentRecordType,
        recordId: existing.recordId,
      },
      added,
    );

    // `25 §12` — the audit log holds the edit, which means both sides of it.
    log({
      action: "comment.updated",
      entityType: "comment",
      entityId: id,
      before: { body: existing.body, mentions: [...heldIds] },
      after: { body, mentions: [...wanted], notified },
    });
  });
}

/** The freshly written row, read back through the same shape the screens use. */
async function listOne(id: string): Promise<Comment[]> {
  const rows = await db
    .select({
      id: comments.id,
      recordType: comments.recordType,
      recordId: comments.recordId,
      authorUserId: comments.authorUserId,
      authorName: users.name,
      body: comments.body,
      editedAt: comments.editedAt,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorUserId))
    .where(eq(comments.id, id))
    .limit(1);
  return withMentions(rows);
}

/* ------------------------------------------------------------------ *
 * Where a comment hangs
 * ------------------------------------------------------------------ */

/**
 * The name of the record a comment is on, for a screen that has only the
 * reference — the notification list and the edit screen's back link.
 *
 * **This grants nothing.** Every caller has already passed `canViewRecord`;
 * this only turns an id into something readable.
 */
export async function commentRecordName(
  recordType: CommentRecordType,
  recordId: string,
): Promise<string | null> {
  if (recordType === "company") {
    const [row] = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, recordId))
      .limit(1);
    return row?.name ?? null;
  }
  if (recordType === "contact") {
    const [row] = await db
      .select({ name: contacts.name })
      .from(contacts)
      .where(eq(contacts.id, recordId))
      .limit(1);
    return row?.name ?? null;
  }
  if (recordType === "project") {
    const [row] = await db
      .select({ name: projects.nameEn })
      .from(projects)
      .where(eq(projects.id, recordId))
      .limit(1);
    return row?.name ?? null;
  }
  if (recordType === "quotation_thread") {
    const [row] = await db
      .select({ name: companies.name })
      .from(quotationThreads)
      .innerJoin(companies, eq(companies.id, quotationThreads.companyId))
      .where(eq(quotationThreads.id, recordId))
      .limit(1);
    return row?.name ?? null;
  }
  // A dispatch has no name of its own — it is an event, not a thing — so it
  // reads as the company it went to, which is how `anchorName` already names a
  // quotation thread.
  const [row] = await db
    .select({ name: companies.name })
    .from(dispatches)
    .innerJoin(companies, eq(companies.id, dispatches.companyId))
    .where(eq(dispatches.id, recordId))
    .limit(1);
  return row?.name ?? null;
}
