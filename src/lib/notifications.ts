/**
 * Notifications — `09 §9`, `07 E5`, `07 G1`, `10 §10`, `21 §2–§5`.
 *
 * The tables have existed since migration `0000` and nothing has ever written
 * either. This module is the writer and the reader.
 *
 * **Two tiers, and they do different jobs `[07 E5]`.** Act-now is something
 * waiting on you and interrupts; digest is one daily summary of what went stale
 * and does not. Without the split, reps mute everything and miss what mattered.
 *
 * **Act-now is persistent and resolution is by condition, not by click**
 * `[07 G1]`, `[10 §10]`. A notification clears when the thing it points at is
 * done. `markRead` sets `read_at` and never `resolved_at` — reading is not
 * doing.
 *
 * **Persistence belongs only to a type whose condition can clear** `[21 §4]`.
 * `record.handed_over` is act-now and NOT persistent: it has no anchor and no
 * completion condition, so persistence would make it permanent. A badge the rep
 * can never clear is what makes the whole tier get ignored — the opposite of
 * what `07 G1` wanted from persistence. Every persistent type states its rule
 * for every anchor it can carry `[21 §3]`, and
 * `scripts/verify-phase10a.ts` §11 fails if one is missing.
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
 * **The sweep is idempotent, runs under the system actor, and runs on read** —
 * the one function a scheduled job will call when Phase 12 adds one, with no
 * second code path. It took that shape from the quotation expiry sweep, which
 * `S67` deleted along with the state it wrote.
 *
 * **`S92`'s two added items — `S128` and `S129` — use only what `S91` keeps.**
 * `S91` deletes the tiers, the persistence flags, the per-anchor resolution
 * conditions and the daily digest (`SPEC §15`); what survives is the delivery
 * core — this module's `raise` inside the caller's transaction,
 * `listNotifications`, `unresolvedCount` and `markRead`. Neither new type has a
 * `RESOLUTION_RULES` row, a sweep branch, a digest date or an anchor, so
 * nothing they stand on is on that list, and the waiting-list slice cannot take
 * them with it (`WORKFLOW §5`). The two seeded rows do carry `tier` and
 * `is_persistent` — but that is seed DATA, and when those columns go the rows
 * stay and the news still reads.
 */

import { and, count, desc, eq, isNull, or, sql } from "drizzle-orm";

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
import { withAudit, type AuditActor, type AuditEntry } from "@/lib/audit";
import {
  canOpenRecord,
  scopeForUser,
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
import { followUpsForRecipient, type FollowUpRow } from "@/lib/follow-ups";
import { today } from "@/lib/reports";
import { shiftDays } from "@/lib/working-days";

/** `16 §3` — the sweep acts; whoever opened the screen did not. */
const SYSTEM_ACTOR: AuditActor = { actorUserId: null, actingAsUserId: null };

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
  tier: "act_now" | "digest";
  isPersistent: boolean;
  /**
   * Is this still waiting on the reader? The one definition of the badge
   * `[21 §4]`.
   *
   * `07 G1` makes an act-now entry persistent and undismissable, and `21 §4`
   * states the exception in its own words: where no resolution condition can
   * become true, *"`is_persistent` is false and **it can be dismissed**."* That
   * sentence had no implementation — the badge counted every unresolved act-now
   * row, `markRead` deliberately never touches `resolved_at`, and no sweep
   * resolves a non-persistent type. So `record.handed_over` incremented the
   * bell forever, and `mention.received` — the highest-volume type in FACET
   * once it replaces WhatsApp — would have buried the tier within weeks.
   *
   * So: a persistent entry waits until its condition clears, and a
   * non-persistent one waits until it is read. Reading is not doing, for a type
   * whose condition can be done. For news there is nothing to do but read it.
   */
  waiting: boolean;
  anchorType: NotificationAnchorType | null;
  anchorId: string | null;
  /** Only set when the viewer may still open it `[20 §8.2]`. */
  anchorViewable: boolean;
  anchorLabel: string | null;
  payload: HandoverPayload | MentionPayload | DecisionPayload | CreditPayload | null;
  digestDate: string | null;
  /** How many follow-ups the digest covered, by kind. */
  digestCounts: Record<string, number> | null;
  readAt: Date | null;
  resolvedAt: Date | null;
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
  digestDate?: string;
};

/**
 * Raise one notification, or do nothing if the same live one already exists.
 *
 * Takes the caller's `tx` so the notification and the act that caused it commit
 * together — a rep must never be told about an assignment that rolled back.
 *
 * The idempotence is the database's, not a read-then-write: `notifications_live_key`
 * for a persistent anchor and `notifications_digest_key` for a digest day, both
 * partial unique indexes, both resolved by `on conflict do nothing`. A sweep
 * that runs twice in the same second writes one row.
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
      digestDate: input.digestDate,
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
 * The sweep `[16 §3]`
 * ------------------------------------------------------------------ */

export type SweepResult = { resolved: number; digests: number };

/**
 * Bring the notification table in step with the world, idempotently.
 *
 * Two steps, in order:
 *
 *  1. **Resolve**, by condition and nothing else `[07 G1]`, `[10 §10]`: every
 *     live `record.assigned` or `share.granted` whose recipient has since
 *     logged an interaction against the anchor's company `[21 §3]`, and every
 *     live notification whose share has been revoked.
 *  2. **Digest** — one `followup.digest` per recipient for the most recent
 *     COMPLETED day.
 *
 * **The sweep raises nothing, so `SweepResult` no longer counts it.** There was
 * a third step and a `quotation.expired` type until `S67`: one notification per
 * thread carrying `end_state = 'expired'`, resolved when the thread stopped
 * carrying it. Both halves stood on a state that no longer exists — validity is
 * a note, so nothing expires, and a bell that rings because a date passed is
 * exactly the gate `S67` denies. Assignment, sharing and mentions still raise;
 * they do it from their own call sites and never from here.
 *
 * **Resolution is re-derived here rather than written at the completing call
 * site**, which is what "by condition, not by click" actually asks for: the
 * sweep asks whether the condition holds now. It also keeps `reports.ts`
 * unaware of notifications — a report is a record of what happened, not a
 * notification mechanism, and the import would have been a cycle.
 *
 * **Why the digest is generated for yesterday and never today** `[20 §9]`:
 * *"Anything firing outward reads the day's settled state at end of day, not
 * the moment of entry, so a correction made minutes later cannot produce a
 * notification that should not have been sent."* A report corrected during a
 * day changes what that day's digest says, because the digest for that day is
 * not written until the day is over.
 */
export async function sweepNotifications(): Promise<SweepResult> {
  return withAudit(SYSTEM_ACTOR, async (tx, log) => {
    const resolved =
      (await resolveOnInteraction(tx, log)) +
      (await resolveRevokedShares(tx, log));
    const digests = await generateDigests(tx, log);
    return { resolved, digests };
  });
}

/**
 * `21 §3` — the recipient has since logged an interaction against the anchor's
 * company, which is what "worked it" means for an assignment or a share.
 *
 * One statement covering all three anchors a share can carry, in the same order
 * `RESOLUTION_RULES` lists them. A **first view is deliberately not** a
 * resolution: opening a record is a click by another name, and `07 G1` refuses
 * the click because *"a notification that can be swiped away is a notification
 * that gets swiped away."*
 *
 * `contact`, `quotation_version` and `dispatch` are absent because no
 * notification is ever raised for them — `visibleContactsFilter`,
 * `visibleDispatchesFilter` and `visibleRepReportsFilter` carry no share term,
 * so a share on one grants nothing and announcing it would be a permanent badge
 * over nothing `[21 §3]`.
 */
async function resolveOnInteraction(
  tx: Tx,
  log: (entry: AuditEntry) => void,
): Promise<number> {
  const cleared = await tx
    .update(notifications)
    .set({ resolvedAt: new Date() })
    .where(
      and(
        isNull(notifications.resolvedAt),
        sql`${notifications.recordId} is not null`,
        sql`${notifications.notificationTypeId} in (
          select nt.id from notification_types nt
           where nt.key in (${NOTIFICATION_TYPES.recordAssigned},
                            ${NOTIFICATION_TYPES.shareGranted})
        )`,
        sql`exists (
          select 1 from rep_reports r
           where r.user_id = ${notifications.recipientUserId}
             and r.entry_type = 'interaction'
             and r.created_at > ${notifications.createdAt}
             and (
               (${notifications.recordType} = 'company'
                  and r.company_id = ${notifications.recordId})
               or (${notifications.recordType} = 'quotation_thread'
                  and r.company_id = (select qt.company_id from quotation_threads qt
                                       where qt.id = ${notifications.recordId}))
               or (${notifications.recordType} = 'project'
                  and exists (select 1 from project_companies pc
                               where pc.project_id = ${notifications.recordId}
                                 and pc.removed_at is null
                                 and pc.company_id = r.company_id))
             )
        )`,
      ),
    )
    .returning({ id: notifications.id });

  for (const row of cleared) {
    log({
      action: "notification.resolved",
      entityType: "notification",
      entityId: row.id,
      after: { reason: "interaction_against_company" },
    });
  }
  return cleared.length;
}

/**
 * A `share.granted` whose share has been revoked is withdrawn `[21 §4]`.
 *
 * **This is not a second way for the grantee to clear it, and that is why it is
 * not in `RESOLUTION_RULES`.** That table is what the *recipient* can do, and
 * the notifications screen renders it to them as advice; "clears when somebody
 * revokes it" is not advice anyone can act on. §3's rule for all three anchors
 * is unchanged and untouched.
 *
 * What this fixes is a badge with no way out. `21 §3` gives `share.granted` one
 * condition — the grantee logs an interaction against the anchor's company —
 * and `createReport` requires `canViewRecord` on that company. Revoke the share
 * and the grantee, holding the record no other way, can no longer log it: the
 * persistent entry then sits in the tier forever. `21 §4` is explicit that a
 * type is persistent only where its condition *"can actually become true"*, and
 * that a badge the rep can never clear is what makes the whole tier get
 * ignored. So the sweep withdraws the announcement when the thing announced has
 * gone.
 *
 * **The condition is "granted and then revoked", not "holds no live share".**
 * The looser reading is the one to reach for and it is wrong twice over. It
 * would resolve any `share.granted` row with no `record_shares` row behind it
 * at all — which is exactly what `verify-phase10a.ts` §11 plants, deliberately,
 * to test `21 §3`'s rule without a producer. Those rows would then clear on the
 * first sweep and that script's *"an interaction resolves the project anchor"*
 * would go green whether or not `resolveOnInteraction` still worked. An
 * assertion that passes for the wrong reason is worse than one that fails.
 *
 * By condition, like its two neighbours: it asks what is true now, not what
 * happened. A share revoked and granted again before the sweep runs keeps its
 * entry, and so does a grantee holding the record through a second live share.
 */
async function resolveRevokedShares(
  tx: Tx,
  log: (entry: AuditEntry) => void,
): Promise<number> {
  const cleared = await tx
    .update(notifications)
    .set({ resolvedAt: new Date() })
    .where(
      and(
        isNull(notifications.resolvedAt),
        sql`${notifications.recordId} is not null`,
        sql`${notifications.notificationTypeId} = (
          select nt.id from notification_types nt
           where nt.key = ${NOTIFICATION_TYPES.shareGranted}
        )`,
        sql`exists (
          select 1 from record_shares rs
           where rs.record_type = ${notifications.recordType}
             and rs.record_id = ${notifications.recordId}
             and rs.shared_with_user_id = ${notifications.recipientUserId}
             and rs.revoked_at is not null
        )`,
        sql`not exists (
          select 1 from record_shares rs
           where rs.record_type = ${notifications.recordType}
             and rs.record_id = ${notifications.recordId}
             and rs.shared_with_user_id = ${notifications.recipientUserId}
             and rs.revoked_at is null
        )`,
      ),
    )
    .returning({ id: notifications.id });

  for (const row of cleared) {
    log({
      action: "notification.resolved",
      entityType: "notification",
      entityId: row.id,
      after: { reason: "share_revoked" },
    });
  }
  return cleared.length;
}

/**
 * One digest per recipient for the most recent completed day.
 *
 * Every active user is asked, and each one's follow-ups are computed **in that
 * user's own scope** — `scopeForUser` — never the caller's. A user with nothing
 * open gets no row: a daily notification saying "nothing" is noise, and
 * `07 D6`'s rule against writing to satisfy a process applies to the system
 * too.
 */
async function generateDigests(
  tx: Tx,
  log: (entry: AuditEntry) => void,
): Promise<number> {
  const digestDate = shiftDays(today(), -1);

  const active = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.isActive, true));

  let written = 0;
  for (const user of active) {
    const scope = await scopeForUser(user.id);
    if (!scope) continue;

    const rows = await followUpsForRecipient(scope);
    if (rows.length === 0) continue;

    const id = await raise(tx, log, {
      typeKey: NOTIFICATION_TYPES.followUpDigest,
      recipientUserId: user.id,
      payload: { counts: countByKind(rows), total: rows.length },
      digestDate,
    });
    if (id) written += 1;
  }
  return written;
}

function countByKind(rows: FollowUpRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.kind] = (counts[row.kind] ?? 0) + 1;
  return counts;
}

/* ------------------------------------------------------------------ *
 * Reading — recipient-filtered, every time `[00 §1.13]`
 * ------------------------------------------------------------------ */

/**
 * Act-now notifications still waiting on this person, for the nav badge.
 *
 * The SQL twin of `NotificationRow.waiting` — read its comment for why the
 * second term exists. The two are one rule: a change to either is a change to
 * both.
 */
export async function unresolvedCount(session: AuthSession): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(notifications)
    .innerJoin(
      notificationTypes,
      eq(notificationTypes.id, notifications.notificationTypeId),
    )
    .where(
      and(
        eq(notifications.recipientUserId, session.user.id),
        eq(notificationTypes.tier, "act_now"),
        isNull(notifications.resolvedAt),
        // `21 §4` — a type with no resolution condition "can be dismissed",
        // and reading it is the only dismissal there is.
        or(
          eq(notificationTypes.isPersistent, true),
          isNull(notifications.readAt),
        ),
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
 * This person's notifications, newest first, act-now above digest.
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
      tier: notificationTypes.tier,
      isPersistent: notificationTypes.isPersistent,
      recordType: notifications.recordType,
      recordId: notifications.recordId,
      payload: notifications.payload,
      digestDate: notifications.digestDate,
      readAt: notifications.readAt,
      resolvedAt: notifications.resolvedAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .innerJoin(
      notificationTypes,
      eq(notificationTypes.id, notifications.notificationTypeId),
    )
    .where(where)
    .orderBy(
      // Unresolved first, then newest. An act-now entry that is still waiting
      // sits above a digest from the same hour `[07 E5]`.
      sql`${notifications.resolvedAt} is not null`,
      desc(notifications.createdAt),
    )
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
  tier: "act_now" | "digest";
  isPersistent: boolean;
  recordType: string | null;
  recordId: string | null;
  payload: unknown;
  digestDate: string | null;
  readAt: Date | null;
  resolvedAt: Date | null;
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
    tier: row.tier,
    isPersistent: row.isPersistent,
    waiting:
      row.tier === "act_now" &&
      row.resolvedAt === null &&
      (row.isPersistent || row.readAt === null),
    anchorType,
    anchorId: row.recordId,
    anchorViewable,
    anchorLabel:
      anchorViewable && anchorType && row.recordId
        ? await anchorName(anchorType, row.recordId)
        : null,
    payload: await decodePayload(session, row),
    digestDate: row.digestDate,
    digestCounts: digestCounts(row.payload),
    readAt: row.readAt,
    resolvedAt: row.resolvedAt,
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
 * imported here — it is a screen module, and this one is read by the sweep.
 */
function recordHref(recordType: ViewableRecordType, id: string): string {
  if (recordType === "quotation_thread") return `/quotations/${id}`;
  if (recordType === "project") return `/projects/${id}`;
  if (recordType === "contact") return `/contacts/${id}`;
  if (recordType === "dispatch") return `/dispatches/${id}`;
  return `/companies/${id}`;
}

function digestCounts(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object") return null;
  const counts = (value as Record<string, unknown>).counts;
  if (!counts || typeof counts !== "object") return null;
  const entries = Object.entries(counts as Record<string, unknown>).filter(
    ([, n]) => typeof n === "number",
  ) as [string, number][];
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

/**
 * Mark one notification read.
 *
 * **Reading is not resolving** `[07 G1]`: `resolved_at` is untouched, so a
 * persistent entry stays in the badge until the condition clears. The recipient
 * term is in the `WHERE`, not checked beforehand — a mismatched id updates zero
 * rows rather than somebody else's `[00 §1.13]`.
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

/**
 * `21 §3` — the resolution rule for every persistent type and every anchor it
 * can carry, as data rather than prose.
 *
 * It exists so `verify-phase10a.ts` §11 can iterate it and fail when a
 * persistent type has an anchor with no rule: `21 §4` makes that a rule rather
 * than a hope, because an anchor with no reachable condition is a badge the rep
 * can never clear.
 */
export const RESOLUTION_RULES: {
  typeKey: NotificationTypeKey;
  anchorType: NotificationAnchorType;
  /** How the condition clears, as a translation key on the screen. */
  rule: "interaction_against_company";
}[] = [
  {
    typeKey: NOTIFICATION_TYPES.recordAssigned,
    anchorType: "company",
    rule: "interaction_against_company",
  },
  {
    typeKey: NOTIFICATION_TYPES.shareGranted,
    anchorType: "company",
    rule: "interaction_against_company",
  },
  {
    typeKey: NOTIFICATION_TYPES.shareGranted,
    anchorType: "project",
    rule: "interaction_against_company",
  },
  {
    typeKey: NOTIFICATION_TYPES.shareGranted,
    anchorType: "quotation_thread",
    rule: "interaction_against_company",
  },
];

export type { NotificationTypeKey };
