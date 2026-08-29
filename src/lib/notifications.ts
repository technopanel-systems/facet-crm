/**
 * Notifications — `09 §9`, `07 E5`, `07 G1`, `10 §10`, `21 §2–§5`.
 *
 * The tables have existed since migration `0000` and nothing has ever written
 * either. This module is the writer and the reader.
 *
 * **This is a bell, and a bell carries news only, never work** `S92`. Six
 * types, every one of them something that has already happened to the reader:
 * a record assigned, a handover, a share granted, a mention, a decision that
 * ended their work `S128`, a share of credit `S129`. Nothing here is waiting on
 * anybody — what waits is on `S87`'s list, and the list is the notification.
 *
 * **What `S91` deleted, and what it leaves.** Gone: the two tiers, the
 * `is_persistent` flag, the per-anchor resolution conditions, the sweep that
 * re-derived them, and the one daily `followup.digest` — which was the only
 * type that ever carried work, and carried it as `S87`'s list said twice and a
 * day late. What survives is the delivery core: `raise` inside the caller's
 * transaction, `listNotifications`, `unreadCount` and `markRead`.
 *
 * **The badge counts UNREAD, and that is a consequence of the deletion rather
 * than a preference.** It counted unresolved act-now rows, and nothing writes
 * `resolved_at` once the sweep is gone — the column and the query would have
 * been a badge that could never reach zero. Reading is now the only disposal
 * there is, which is what `21 §4` already said for a type with no condition to
 * clear; every type is now that type.
 *
 * **The recipient filter is in this file, in every query's own `WHERE`.**
 * `00 §1.13` records v1's bug exactly: neither notifications page filtered by
 * `recipient_id`; both selected `*` and relied on RLS. FACET has no RLS `[03]`,
 * so a missing filter is not a weakened defence — it is none. There is
 * deliberately no `visibleNotificationsFilter` in `authz`: a notification is
 * addressed to one person, which is an equality, not a visibility question.
 *
 * **A notification row is not access-controlled proof of anything.** The anchor
 * is rendered as a link only when `canOpenRecord` still passes — `20 §8.2`'s
 * rule about the audit log, which holds for the same reason wherever a row
 * names a record it does not gate.
 *
 * **There is no sweep.** One ran on every read of `/notifications` — FACET has
 * no scheduler and that was the commonest read — resolving conditions and
 * writing the day's digest. It was written to be the one function a Phase 12
 * job would call, and it took that shape from the quotation expiry sweep, which
 * `S67` had already deleted along with the state it wrote. `S91` finished the
 * pattern: **nothing in FACET writes because somebody looked at a screen.**
 *
 * **`S92`'s two added items survived the deletion, which was the risk.**
 * `decision.ended_work` `S128` and `credit.granted` `S129` were added in the
 * slices before this one, and `WORKFLOW §5` recorded the danger outright — the
 * deletion must not take them with it. Neither ever had a `RESOLUTION_RULES`
 * row, a sweep branch, a digest date or an anchor, so neither stood on anything
 * `S91` names. Their two seeded rows carried `tier` and `is_persistent` as DATA
 * and nothing else; `0033` dropped the columns and the rows stayed.
 */

import { and, count, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  comments,
  companies,
  notificationTypes,
  notifications,
  projects,
  quotationThreads,
  users,
} from "@/db/schema";
import { withAudit, type AuditEntry } from "@/lib/audit";
import {
  canOpenRecord,
  visibleCommentsFilter,
  type AuthSession,
  type ViewableRecordType,
} from "@/lib/authz";
import {
  COMMENT_RECORD_TYPES,
  NOTIFICATION_TYPES,
  notificationTypeName,
  type CommentRecordType,
  type NotificationTypeKey,
  type NotificationTypeName,
} from "@/lib/enums";

const PAGE_SIZE = 25;

/**
 * The anchors a notification may carry.
 *
 * **The array is the source of truth and the type derives from it**, not the
 * other way round. It used to be `ViewableRecordType`, which was safe only
 * while the two lists happened to match: feature slice 2 added `dispatch` to
 * `ViewableRecordType` `[25 §9]`, and a hand-written array typed
 * `NotificationAnchorType[]` would have gone on compiling while
 * `asAnchorType("dispatch")` returned null and a dispatch-anchored notification
 * rendered with no link and no error anywhere.
 *
 * `satisfies` still proves every member is a record `canOpenRecord` can answer
 * for, which is what `decorate` needs.
 */
const ANCHOR_TYPES = [
  "company",
  "contact",
  "project",
  "quotation_thread",
] as const satisfies readonly ViewableRecordType[];

export type NotificationAnchorType = (typeof ANCHOR_TYPES)[number];

export type HandoverCounts = {
  companies: number;
  projects: number;
  quotationThreads: number;
};

/**
 * What `notifications.payload` holds, per type `[21 §5]`.
 *
 * The id is what is stored; the name is resolved on read. Storing the name
 * would be a second copy of a column that `19 §6` makes editable, and a
 * handover summary naming somebody's old spelling forever is exactly the drift
 * `04 C1` warns about.
 */
export type HandoverPayload = {
  kind: "handover";
  fromUserId: string;
  fromUserName: string | null;
  counts: HandoverCounts;
};

/**
 * `25 §11` — what a `mention.received` row carries instead of an anchor.
 *
 * **It has no anchor on purpose.** `notifications_live_key` is a partial unique
 * index over every unresolved row with a `record_id`, and nothing ever resolves
 * a type that is not persistent — so an anchored mention would deliver the
 * first tag of a person on a record and silently drop every later one, for
 * good. The record travels here, the way `record.handed_over`'s counts do.
 *
 * Ids are stored; names, the body and the link are resolved on read, for the
 * reason above `HandoverPayload`. `recordViewable` is re-derived with
 * `canOpenRecord` every time: a notification row is not access-controlled proof
 * of anything, and a share can be revoked between the tag and the reading of
 * it.
 */
export type MentionPayload = {
  kind: "mention";
  commentId: string;
  recordType: CommentRecordType;
  recordId: string;
  authorUserId: string;
  authorName: string | null;
  /** Withheld — with `body` and `href` — when the record is no longer visible. */
  recordViewable: boolean;
  body: string | null;
  href: string | null;
};

/**
 * `S128` — **the record kinds a decision can end work on.** Two, because the
 * rule names four acts across two records: a refused or cancelled dispatch
 * `S124` `S73`, and a rejected or cancelled quotation `S62`.
 *
 * `satisfies` proves both are kinds `canOpenRecord` can answer for, which is
 * what `decisionPayload` needs to decide whether to draw a link. Deliberately
 * NOT `NotificationAnchorType`: these never become an anchor — see below.
 */
const DECISION_RECORD_TYPES = [
  "dispatch",
  "quotation_thread",
] as const satisfies readonly ViewableRecordType[];

export type DecisionRecordType = (typeof DECISION_RECORD_TYPES)[number];

/** `S128`'s four acts, as one closed vocabulary. */
export const DECISION_KINDS = [
  "dispatch_refused",
  "dispatch_cancelled",
  "quotation_rejected",
  "quotation_cancelled",
] as const;

export type DecisionKind = (typeof DECISION_KINDS)[number];

/**
 * `S128` — what a `decision.ended_work` row carries. **The reason is stored
 * here, and that is the rule rather than an optimisation.**
 *
 * *Where the person told cannot see the record — a co-credited rep has no sight
 * of the dispatch itself — the message carries the reason and stands alone. It
 * is not a link into something they cannot open.* `S128` names itself a
 * deliberate exception to `S112`, which is otherwise unchanged: an audit row is
 * never shown without joining back to the record and applying its visibility.
 * Here the rep's own credit was taken, so the reason reaches them even where
 * the record does not.
 *
 * So `reason` is rendered whichever way `recordViewable` comes out. That is the
 * one place this type differs from `MentionPayload`, which withholds its body
 * exactly when the record is closed — a comment is the record's content; a
 * reason for ending somebody's work is theirs.
 *
 * **It is also the only copy that survives.** `dispatches.refusal_reason` is
 * CLEARED on revival `S122`, and a rejected quotation has no reason column at
 * all — `S62` makes the comment on the thread its home, and a second column
 * would be a second home for one sentence. Reading the reason back through the
 * record at render time would therefore find nothing on the first and apply the
 * record's visibility on both.
 *
 * **No anchor, for `MentionPayload`'s reason.** `notifications_live_key` is a
 * partial unique index over every unresolved row carrying a `record_id`, and
 * nothing resolves a non-persistent type — so an anchored decision would
 * deliver the first one against a record and silently drop every later one.
 * `dispatch` is not in `ANCHOR_TYPES` for that reason and not for want of
 * `canOpenRecord` support.
 *
 * Ids are stored; names, viewability and the link are resolved on read, above
 * `HandoverPayload`'s reason. `recordViewable` is re-derived every time: a
 * dispatch can be handed on and a share revoked between the decision and the
 * reading of it.
 */
export type DecisionPayload = {
  kind: "decision";
  decision: DecisionKind;
  /** Shown whether or not the record is `recordViewable` `[S128]`. */
  reason: string;
  recordType: DecisionRecordType;
  recordId: string;
  decidedByUserId: string;
  decidedByName: string | null;
  recordViewable: boolean;
  /** Only set when the reader may still open it `[20 §8.2]`. */
  href: string | null;
};

/**
 * `S129` — what a `credit.granted` row carries.
 *
 * *A rep is told when they are given a share of someone else's credit* — the
 * split case, never `S78`'s ordinary 100%, which needs no telling.
 *
 * **The ordinary `S112` rule applies here, not `S128`'s exception.** That
 * exception is written for credit *taken back*: the rep's own square metres
 * left their month, so the reason reaches them even where the record does not.
 * A share *given* takes nothing, and a rep given one need not hold the project
 * `S30` — so the project's name and the link follow `MentionPayload`, present
 * only while `canOpenRecord` passes. The percentage and the date are the rep's
 * own credit rather than the project's data, and are shown either way.
 *
 * Both names are carried rather than one: a project still has a name pair, and
 * `lookupName` is the screen's to call with its locale.
 */
export type CreditPayload = {
  kind: "credit";
  projectId: string;
  effectiveFrom: string;
  /** As stored on the generation's row — two decimals `[18 §5]`. */
  percentage: string;
  setByUserId: string;
  setByName: string | null;
  recordViewable: boolean;
  projectName: string | null;
  href: string | null;
};

export type NotificationRow = {
  id: string;
  typeKey: string;
  /** Null when a row points at a type this build does not know — never thrown
   *  away, because `10 §10` lets a type be added as data. */
  typeName: NotificationTypeName | null;
  anchorType: NotificationAnchorType | null;
  anchorId: string | null;
  /** Only set when the viewer may still open it `[20 §8.2]`. */
  anchorViewable: boolean;
  anchorLabel: string | null;
  payload: HandoverPayload | MentionPayload | DecisionPayload | CreditPayload | null;
  readAt: Date | null;
  createdAt: Date;
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/* ------------------------------------------------------------------ *
 * Raising — always inside the caller's transaction
 * ------------------------------------------------------------------ */

export type RaiseInput = {
  typeKey: NotificationTypeKey;
  recipientUserId: string;
  anchorType?: NotificationAnchorType;
  anchorId?: string;
  payload?: unknown;
};

/**
 * Raise one notification, or do nothing if the same live one already exists.
 *
 * Takes the caller's `tx` so the notification and the act that caused it commit
 * together — a rep must never be told about an assignment that rolled back.
 *
 * **The `on conflict do nothing` has no index left to fire on, and stays.**
 * `notifications_live_key` and `notifications_digest_key` were the two partial
 * unique indexes behind it and both went with `S91`. Every raise now inserts,
 * which is right for news — a second refusal is a second thing that happened.
 * The clause is kept because the insert's uniqueness is the database's business
 * and a future index must not need this call site rewritten.
 *
 * **A recipient who is inactive gets nothing.** Deactivation revokes access
 * immediately `[07 B7]`, and a notification is new work.
 */
export async function raise(
  tx: Tx,
  log: (entry: AuditEntry) => void,
  input: RaiseInput,
): Promise<string | null> {
  // The id and nothing else. `default_channel` was read here until `0027`,
  // and only to stamp `notifications.channel`, which nothing read back — a
  // reader that existed to feed a dead column. Both are gone.
  const [type] = await tx
    .select({ id: notificationTypes.id })
    .from(notificationTypes)
    .where(eq(notificationTypes.key, input.typeKey))
    .limit(1);

  // A type nothing seeded cannot be raised. Silently skipping is right: the
  // caller's act is not invalidated by a missing lookup row, and `db:seed` is
  // the fix. `verify-phase10a.ts` §1 is what stops it going unnoticed.
  if (!type) return null;

  const [recipient] = await tx
    .select({ isActive: users.isActive })
    .from(users)
    .where(eq(users.id, input.recipientUserId))
    .limit(1);
  if (!recipient?.isActive) return null;

  const [row] = await tx
    .insert(notifications)
    .values({
      recipientUserId: input.recipientUserId,
      notificationTypeId: type.id,
      recordType: input.anchorType,
      recordId: input.anchorId,
      payload: input.payload ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: notifications.id });

  if (!row) return null;

  log({
    action: "notification.raised",
    entityType: "notification",
    entityId: row.id,
    after: {
      type: input.typeKey,
      recipientUserId: input.recipientUserId,
      recordType: input.anchorType ?? null,
      recordId: input.anchorId ?? null,
    },
  });
  return row.id;
}

/* ------------------------------------------------------------------ *
 * Reading — recipient-filtered, every time `[00 §1.13]`
 * ------------------------------------------------------------------ */

/**
 * Unread news for this person, for the bell badge.
 *
 * **Two terms, and no join.** It was four terms over a join on
 * `notification_types` — act-now tier, unresolved, and persistent-or-unread —
 * and `S91` deleted three of the columns those terms read. What is left is the
 * only disposal a bell has: `21 §4` already gave reading to a type whose
 * condition cannot clear, and since `S92` every type is news, so every type is
 * that type.
 *
 * **Keeping `resolved_at` in this query would have been the worse half of the
 * deletion.** Nothing writes it once the sweep is gone, so `resolved_at is
 * null` is true of every row for ever and the badge could never reach zero —
 * the undismissable badge `07 G1` was warned about, arrived at by removing the
 * machinery that was supposed to cause it. The column goes in the same slice.
 */
export async function unreadCount(session: AuthSession): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientUserId, session.user.id),
        isNull(notifications.readAt),
      ),
    );
  return row?.total ?? 0;
}

export type NotificationList = {
  rows: NotificationRow[];
  total: number;
  page: number;
};

/**
 * This person's news, newest first.
 *
 * **One list, in one order.** It used to sort unresolved rows above resolved
 * ones before the date, so an act-now entry outranked a digest from the same
 * hour `[07 E5]`. Both halves of that comparison are gone: there is no digest
 * and nothing resolves. News is chronological, which is the only ranking a
 * record of what happened can honestly have.
 *
 * The recipient term is written here rather than composed from `authz` on
 * purpose: it is an equality on one column, not a visibility question, and a
 * builder that could return `undefined` for a privileged role is precisely the
 * wrong shape — no role reads somebody else's notifications.
 */
export async function listNotifications(
  session: AuthSession,
  options: { page?: number } = {},
): Promise<NotificationList> {
  const page = Math.max(1, options.page ?? 1);
  const where = eq(notifications.recipientUserId, session.user.id);

  const rows = await db
    .select({
      id: notifications.id,
      typeKey: notificationTypes.key,
      recordType: notifications.recordType,
      recordId: notifications.recordId,
      payload: notifications.payload,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .innerJoin(
      notificationTypes,
      eq(notificationTypes.id, notifications.notificationTypeId),
    )
    .where(where)
    .orderBy(desc(notifications.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const [totals] = await db
    .select({ total: count() })
    .from(notifications)
    .where(where);

  const decorated = await Promise.all(
    rows.map(async (row) => decorate(session, row)),
  );

  return { rows: decorated, total: totals?.total ?? 0, page };
}

type RawNotification = {
  id: string;
  typeKey: string;
  recordType: string | null;
  recordId: string | null;
  payload: unknown;
  readAt: Date | null;
  createdAt: Date;
};

function asAnchorType(value: string | null): NotificationAnchorType | null {
  return ANCHOR_TYPES.find((type) => type === value) ?? null;
}

/**
 * Turn a stored row into something a screen can render.
 *
 * **The anchor is checked, not trusted** `[20 §8.2]`. A share can be revoked
 * and a company can be handed on; the notification row survives either, and
 * rendering its link would leak a name the viewer may no longer read. When the
 * check fails the entry still shows — what happened is not a secret from the
 * person it happened to — but it carries no link and no name.
 */
async function decorate(
  session: AuthSession,
  row: RawNotification,
): Promise<NotificationRow> {
  const anchorType = asAnchorType(row.recordType);
  // Whether to draw the link, so `canOpenRecord` `S76` — not whether the
  // reader may act on what is behind it.
  const anchorViewable =
    anchorType && row.recordId
      ? await canOpenRecord(session, anchorType, row.recordId)
      : false;

  return {
    id: row.id,
    typeKey: row.typeKey,
    typeName: notificationTypeName(row.typeKey) ?? null,
    anchorType,
    anchorId: row.recordId,
    anchorViewable,
    anchorLabel:
      anchorViewable && anchorType && row.recordId
        ? await anchorName(anchorType, row.recordId)
        : null,
    payload: await decodePayload(session, row),
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

/**
 * The payload, decoded **by type key** rather than by shape.
 *
 * Sniffing was safe while one type carried a payload; with two it is a latent
 * bug — a handover payload and a mention payload are both objects, and the
 * next type would decide which one it looked like by accident. The key is what
 * the row actually says it is.
 */
async function decodePayload(
  session: AuthSession,
  row: RawNotification,
): Promise<HandoverPayload | MentionPayload | DecisionPayload | CreditPayload | null> {
  if (row.typeKey === NOTIFICATION_TYPES.recordHandedOver) {
    return handoverPayload(row.payload);
  }
  if (row.typeKey === NOTIFICATION_TYPES.mentionReceived) {
    return mentionPayload(session, row.payload);
  }
  if (row.typeKey === NOTIFICATION_TYPES.decisionEndedWork) {
    return decisionPayload(session, row.payload);
  }
  if (row.typeKey === NOTIFICATION_TYPES.creditGranted) {
    return creditPayload(session, row.payload);
  }
  return null;
}

async function anchorName(
  anchorType: NotificationAnchorType,
  id: string,
): Promise<string | null> {
  if (anchorType === "company") {
    const [row] = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, id))
      .limit(1);
    return row?.name ?? null;
  }
  if (anchorType === "quotation_thread") {
    const [row] = await db
      .select({ name: companies.name })
      .from(quotationThreads)
      .innerJoin(companies, eq(companies.id, quotationThreads.companyId))
      .where(eq(quotationThreads.id, id))
      .limit(1);
    return row?.name ?? null;
  }
  return null;
}

async function handoverPayload(
  value: unknown,
): Promise<HandoverPayload | null> {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.fromUserId !== "string") return null;
  const counts = record.counts;
  if (!counts || typeof counts !== "object") return null;
  const c = counts as Record<string, unknown>;

  // A name, not an id — and read now rather than stored, because `19 §6` makes
  // the account editable. A departed rep's row is still here `[04 C2]`, so this
  // resolves for as long as the notification does.
  const [from] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, record.fromUserId))
    .limit(1);

  return {
    kind: "handover",
    fromUserId: record.fromUserId,
    fromUserName: from?.name ?? null,
    counts: {
      companies: Number(c.companies ?? 0),
      projects: Number(c.projects ?? 0),
      quotationThreads: Number(c.quotationThreads ?? 0),
    },
  };
}

/**
 * `25 §11` — the mention payload, with the record re-checked on every read.
 *
 * The visibility question is asked here and not at write time: the tag was
 * raised unconditionally, because `25 §11` attaches no condition to it and
 * inventing one would be inventing business logic. What is conditional is what
 * the reader is shown — the same rule the anchor path follows `[20 §8.2]`. The
 * entry still appears, because what happened is not a secret from the person it
 * happened to; it simply carries no body, no name and no link.
 *
 * **Two questions, two gates, and they parted at `S76`.** The LINK asks whether
 * the reader may open the record, which is `canOpenRecord`'s. The BODY asks
 * whether they may read the conversation, which is `S131`'s and belongs to
 * `visibleCommentsFilter` — so the body is read through the filter rather than
 * behind `viewable`. They give the same answer for everyone but the
 * coordinator on a project or a contact, and there she gets the link and not
 * the words: `S76` gave her the record, not what was said on it. Tagging her
 * does not hand over what the filter withholds, any more than tagging a rep who
 * cannot see the record does.
 */
async function mentionPayload(
  session: AuthSession,
  value: unknown,
): Promise<MentionPayload | null> {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const commentId = record.commentId;
  const recordId = record.recordId;
  const authorUserId = record.authorUserId;
  const recordType = COMMENT_RECORD_TYPES.find(
    (type) => type === record.recordType,
  );
  if (
    typeof commentId !== "string" ||
    typeof recordId !== "string" ||
    typeof authorUserId !== "string" ||
    !recordType
  ) {
    return null;
  }

  const viewable = await canOpenRecord(session, recordType, recordId);

  const [author] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, authorUserId))
    .limit(1);

  const [comment] = await db
    .select({ body: comments.body })
    .from(comments)
    .where(and(eq(comments.id, commentId), visibleCommentsFilter(session)))
    .limit(1);

  return {
    kind: "mention",
    commentId,
    recordType,
    recordId,
    authorUserId,
    authorName: author?.name ?? null,
    recordViewable: viewable,
    // Read now, not stored: `25 §12` makes a comment editable, and a
    // notification quoting the version before the correction would be worse
    // than one quoting nothing.
    body: comment?.body ?? null,
    // The thread lives on the record `[25 §9]`, so the link goes there and the
    // fragment finds the comment in it. There is no comment page.
    href: viewable ? `${recordHref(recordType, recordId)}#comment-${commentId}` : null,
  };
}

/**
 * `S128` — the decision payload, with the record re-checked on every read and
 * **the reason shown either way**.
 *
 * The visibility question decides the LINK and nothing else. `S128` is explicit
 * that where the person told cannot see the record the message carries the
 * reason and stands alone, so a closed record costs the href and leaves the
 * sentence intact. `mentionPayload` withholds its body in the same position and
 * for the opposite reason — see the note above `DecisionPayload`.
 *
 * The name of whoever decided is read now rather than stored, above
 * `HandoverPayload`'s reason: `19 §6` makes the account editable, and a
 * notification naming somebody's old spelling forever is the drift `04 C1`
 * warns about.
 */
async function decisionPayload(
  session: AuthSession,
  value: unknown,
): Promise<DecisionPayload | null> {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const recordId = record.recordId;
  const decidedByUserId = record.decidedByUserId;
  const reason = record.reason;
  const recordType = DECISION_RECORD_TYPES.find(
    (type) => type === record.recordType,
  );
  const decision = DECISION_KINDS.find((kind) => kind === record.decision);
  if (
    typeof recordId !== "string" ||
    typeof decidedByUserId !== "string" ||
    typeof reason !== "string" ||
    !recordType ||
    !decision
  ) {
    return null;
  }

  const viewable = await canOpenRecord(session, recordType, recordId);

  const [decidedBy] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, decidedByUserId))
    .limit(1);

  return {
    kind: "decision",
    decision,
    reason,
    recordType,
    recordId,
    decidedByUserId,
    decidedByName: decidedBy?.name ?? null,
    recordViewable: viewable,
    href: viewable ? recordHref(recordType, recordId) : null,
  };
}

/**
 * `S129` — the credit payload, following `mentionPayload` exactly.
 *
 * The project's name and the link are present only while `canOpenRecord`
 * passes: `S30` keeps a project to its owner and whoever is shared on it, and a
 * rep given a share of credit need not be either. `S128`'s stand-alone
 * exception does not reach here — it is written for credit taken back, and this
 * is credit given.
 *
 * The percentage and the effective date come out of the payload rather than
 * being re-read: `S110` makes a split a dated row and a later generation
 * supersedes this one, so re-reading would tell the rep about a share they no
 * longer hold instead of the one they were given.
 */
async function creditPayload(
  session: AuthSession,
  value: unknown,
): Promise<CreditPayload | null> {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const projectId = record.projectId;
  const setByUserId = record.setByUserId;
  const effectiveFrom = record.effectiveFrom;
  const percentage = record.percentage;
  if (
    typeof projectId !== "string" ||
    typeof setByUserId !== "string" ||
    typeof effectiveFrom !== "string" ||
    typeof percentage !== "string"
  ) {
    return null;
  }

  const viewable = await canOpenRecord(session, "project", projectId);

  const [setBy] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, setByUserId))
    .limit(1);

  const [project] = viewable
    ? await db
        .select({ name: projects.name })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1)
    : [];

  return {
    kind: "credit",
    projectId,
    effectiveFrom,
    percentage,
    setByUserId,
    setByName: setBy?.name ?? null,
    recordViewable: viewable,
    projectName: project?.name ?? null,
    href: viewable ? recordHref("project", projectId) : null,
  };
}

/**
 * Where a record lives. The twin of `_components/anchors.ts`, which cannot be
 * imported here — it is a screen module, and this one is data-layer.
 */
function recordHref(recordType: ViewableRecordType, id: string): string {
  if (recordType === "quotation_thread") return `/quotations/${id}`;
  if (recordType === "project") return `/projects/${id}`;
  if (recordType === "contact") return `/contacts/${id}`;
  if (recordType === "dispatch") return `/dispatches/${id}`;
  return `/companies/${id}`;
}

/**
 * Mark one notification read.
 *
 * **Reading is the whole disposal now** `S91`. `07 G1` kept `resolved_at`
 * untouched here so a persistent entry stayed in the badge until its condition
 * cleared; there are no persistent entries and no conditions, so this is what
 * takes a row out of `unreadCount`. The recipient term is in the `WHERE`, not
 * checked beforehand — a mismatched id updates zero rows rather than somebody
 * else's `[00 §1.13]`.
 */
export async function markRead(
  session: AuthSession,
  notificationId: string,
): Promise<boolean> {
  return withAudit(session.actor, async (tx, log) => {
    const [row] = await tx
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.recipientUserId, session.user.id),
          isNull(notifications.readAt),
        ),
      )
      .returning({ id: notifications.id });

    if (!row) return false;
    log({
      action: "notification.read",
      entityType: "notification",
      entityId: row.id,
    });
    return true;
  });
}

/**
 * Mark every unread notification read.
 *
 * The recipient term is the first thing in the `WHERE`. This is the exact
 * statement v1 got wrong `[00 §1.13]` — a bulk update over the whole table —
 * and it is the reason this module has no generic update helper.
 */
export async function markAllRead(session: AuthSession): Promise<number> {
  return withAudit(session.actor, async (tx, log) => {
    const rows = await tx
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.recipientUserId, session.user.id),
          isNull(notifications.readAt),
        ),
      )
      .returning({ id: notifications.id });

    if (rows.length > 0) {
      log({
        action: "notification.read_all",
        entityType: "notification",
        after: { count: rows.length },
      });
    }
    return rows.length;
  });
}

export type { NotificationTypeKey };
