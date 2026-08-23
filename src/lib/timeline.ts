/**
 * The customer timeline `[20 §6]` — one chronological view per company and per
 * project, merging what a rep wrote with what FACET already recorded.
 *
 * **This is the rep's payoff for logging and had to be built, not deferred**
 * `[20 §6]`. A rep who types into a form that gives nothing back stops typing.
 *
 * **The system half is derived on read.** Nothing is written, `activities`
 * stays permanently empty `[20 §6]` the way `product_colours` does `[17 §2]`,
 * and every company and quotation already in the database therefore has a full
 * history immediately with no backfill.
 *
 * ## Attribution — whoever performed it `[20 §8]`
 *
 * Every event carries the person who **performed** it, never who was credited
 * and never who benefits. Two of the columns are not the obvious ones, and both
 * are deliberate:
 *
 *  - **"Quotation raised" reads `quotation_versions.created_by` on version 1**,
 *    not `quotation_threads.raised_by_user_id`. `19 §1` rewrites the raiser on
 *    handover, so attributing to it would move a past act onto somebody who did
 *    not perform it. Version authorship is what `19 §1` promises never to
 *    rewrite.
 *  - **"Dispatched" reads `recorded_by_user_id`**, not `user_id`. The latter is
 *    the credited rep `[18 §1]`; the coordinator is the one who acted. The same
 *    dispatch still credits the rep's square metres in `/targets`, and the two
 *    views disagree on purpose.
 *
 * Where an act was performed under impersonation, the identity used is the
 * **effective** one — `coalesce(acting_as_user_id, actor_user_id)` — because
 * that is what every other source column holds: `session.user.id` is the
 * impersonated user while impersonating `[07 A6]`.
 *
 * ## `audit_log` is never read directly for a user-facing view `[20 §8.2]`
 *
 * "Quotation issued" has no actor column and no timestamp of its own —
 * `quotation_versions` carries only `status` and the SMAC reference — so it is
 * read from the audit log, which the data layer already writes on every act
 * `[07 E1]`.
 *
 * **That table holds every action in the system and carries no visibility
 * filter of its own.** Every audit-sourced event must join to the record it
 * describes and apply THAT record's existing filter: below, the join to
 * `quotation_versions` and `quotation_threads` plus
 * `visibleQuotationThreadsFilter` is what gates it — not the audit row. An
 * audit row is not access-controlled and must never be the only thing standing
 * between a viewer and an event. The next feature wanting an event with no
 * dedicated column will reach for this table; the join is the easy thing to
 * drop.
 *
 * ## Shape
 *
 * Six small queries merged and sorted in TypeScript, rather than one SQL
 * `union all`. Each source composes its **own existing** filter — the whole
 * reason no new predicate was written for this phase — and a union would force
 * them into one WHERE where a single misplaced `or` silently widens all six.
 * The cost is that an anchor's whole history is read before it is paged;
 * a company's history is bounded by its own life, and stating the trade is
 * better than a clever query nobody can audit.
 */

import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  lte,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  auditLog,
  commentMentions,
  comments,
  companies,
  dispatches,
  quotationThreads,
  quotationVersions,
  repReports,
  users,
} from "@/db/schema";
import {
  visibleCommentsFilter,
  visibleCompaniesFilter,
  visibleDispatchesFilter,
  visibleQuotationThreadsFilter,
  visibleRepReportsFilter,
  type AuthSession,
} from "@/lib/authz";
import type { CommentRecordType } from "@/lib/enums";

/**
 * The five system events `20 §6` and `20 §8` name, the rep's own, and the
 * conversation `[25 §9]`.
 *
 * `25 §9` is explicit that a comment is not a seventh kind of report but does
 * belong here: *"Both land on the same timeline. One thread per record carrying
 * reports, system events and conversation."* What keeps `25 §14` true — counted,
 * never summed — is that `daily-activity.ts` tallies this kind in its own
 * column and excludes it from every other, not that it is kept off the thread.
 */
export type TimelineEventKind =
  | "report"
  | "company_added"
  | "quotation_raised"
  | "quotation_issued"
  | "payment_confirmed"
  | "dispatched"
  | "comment";

export type TimelineLink =
  | { type: "report"; id: string }
  | { type: "company"; id: string }
  | { type: "contact"; id: string }
  | { type: "quotation"; id: string }
  | { type: "dispatch"; id: string }
  | { type: "comment"; id: string };

type TimelineEventBase = {
  /** Stable across renders: the kind plus the source row's id. */
  key: string;
  /** The calendar day in Riyadh, `YYYY-MM-DD`. Never an instant. */
  day: string;
  /** Orders entries within a day. */
  at: Date;
  /** Whoever PERFORMED it `[20 §8]`. Null only where the column is. */
  actorUserId: string | null;
  actorName: string | null;
  companyId: string | null;
  projectId: string | null;
  /** A short value the screen renders beside the kind: a reference, m². */
  detail: string | null;
  link: TimelineLink | null;
};

/**
 * A comment's own words, which are the event rather than a detail of it.
 *
 * `detail` is *"a short value the screen renders beside the kind"* and a body
 * is neither short nor beside anything, so this is its own field — and it is
 * discriminated on `kind` so the six derived sources cannot accidentally be
 * read for one.
 *
 * `canEdit` is `author === viewer` `[25 §12]`, decided here because the session
 * is here. It is an identity question, not a visibility one — the distinction
 * `reports.ts` draws for the same rule.
 */
export type TimelineComment = {
  id: string;
  body: string;
  editedAt: Date | null;
  canEdit: boolean;
  mentions: { userId: string; name: string }[];
};

export type TimelineEvent = TimelineEventBase &
  (
    | { kind: Exclude<TimelineEventKind, "comment">; comment?: never }
    | { kind: "comment"; comment: TimelineComment }
  );

/**
 * Which timeline is being asked for.
 *
 * A report naming a project appears on both its company's and its project's.
 * `record` is the third form, for the records that have a thread but no derived
 * events of their own — a contact, a quotation thread, a dispatch `[25 §9]`.
 * **No key at all** means "everything in the range", which is what the daily
 * view asks for.
 *
 * A company scope and a project scope are also record anchors; `commentAnchor`
 * derives that rather than making a caller pass the same id twice.
 */
export type TimelineScope = {
  companyId?: string;
  projectId?: string;
  record?: { type: CommentRecordType; id: string };
};

/** The record whose comments this scope is asking for, if any. */
function commentAnchor(
  scope: TimelineScope,
): { type: CommentRecordType; id: string } | null {
  if (scope.record) return scope.record;
  if (scope.companyId) return { type: "company", id: scope.companyId };
  if (scope.projectId) return { type: "project", id: scope.projectId };
  return null;
}

/** `(x at time zone 'Asia/Riyadh')::date` — the app's timezone is fixed, and a
 *  timeline entry is a day there rather than a UTC instant. */
function riyadhDay(column: unknown) {
  return sql<string>`(${column} at time zone 'Asia/Riyadh')::date`;
}

/* ------------------------------------------------------------------ *
 * The six sources. Each composes its own filter and nothing else.
 * ------------------------------------------------------------------ */

async function reportEvents(
  session: AuthSession,
  scope: TimelineScope,
  range?: DateRange,
): Promise<TimelineEvent[]> {
  const rows = await db
    .select({
      id: repReports.id,
      day: repReports.reportDate,
      at: repReports.createdAt,
      actorUserId: repReports.userId,
      actorName: users.name,
      companyId: repReports.companyId,
      projectId: repReports.projectId,
      outcome: repReports.outcome,
      category: repReports.category,
    })
    .from(repReports)
    .innerJoin(users, eq(users.id, repReports.userId))
    .where(
      and(
        visibleRepReportsFilter(session),
        scope.companyId
          ? eq(repReports.companyId, scope.companyId)
          : scope.projectId
            ? eq(repReports.projectId, scope.projectId)
            : undefined,
        range ? gte(repReports.reportDate, range.from) : undefined,
        range ? lte(repReports.reportDate, range.to) : undefined,
      ),
    );

  return rows.map((row) => ({
    key: `report:${row.id}`,
    kind: "report" as const,
    day: row.day,
    at: row.at,
    actorUserId: row.actorUserId,
    actorName: row.actorName,
    companyId: row.companyId,
    projectId: row.projectId,
    // The outcome for an interaction, the category for a field note — one of
    // the two is always set `[rep_reports_shape]`.
    detail: row.outcome ?? row.category,
    link: { type: "report" as const, id: row.id },
  }));
}

/** Only a company has this event; a project timeline simply has no row here. */
async function companyAddedEvents(
  session: AuthSession,
  scope: TimelineScope,
  range?: DateRange,
): Promise<TimelineEvent[]> {
  if (!scope.companyId && !range) return [];

  const day = riyadhDay(companies.createdAt);
  const rows = await db
    .select({
      id: companies.id,
      day,
      at: companies.createdAt,
      actorUserId: companies.createdBy,
      actorName: users.name,
      // The company's own name is deliberately not selected: the mapped event
      // links to the record rather than naming it.
    })
    .from(companies)
    .leftJoin(users, eq(users.id, companies.createdBy))
    .where(
      and(
        visibleCompaniesFilter(session),
        scope.companyId ? eq(companies.id, scope.companyId) : undefined,
        // A project timeline never shows this event; the range form is the
        // daily view, which is not scoped to one anchor.
        scope.projectId ? sql`false` : undefined,
        range ? gte(day, range.from) : undefined,
        range ? lte(day, range.to) : undefined,
      ),
    );

  return rows.map((row) => ({
    key: `company_added:${row.id}`,
    kind: "company_added" as const,
    day: row.day,
    at: row.at,
    actorUserId: row.actorUserId,
    actorName: row.actorName,
    companyId: row.id,
    projectId: null,
    detail: null,
    link: { type: "company" as const, id: row.id },
  }));
}

async function quotationRaisedEvents(
  session: AuthSession,
  scope: TimelineScope,
  range?: DateRange,
): Promise<TimelineEvent[]> {
  const day = riyadhDay(quotationVersions.createdAt);
  const rows = await db
    .select({
      id: quotationVersions.id,
      threadId: quotationVersions.threadId,
      day,
      at: quotationVersions.createdAt,
      // `20 §8` — NOT `quotationThreads.raisedByUserId`, which handover
      // rewrites `[19 §1]`.
      actorUserId: quotationVersions.createdBy,
      actorName: users.name,
      companyId: quotationThreads.companyId,
      projectId: quotationThreads.projectId,
      smacReference: quotationVersions.smacReference,
    })
    .from(quotationVersions)
    .innerJoin(
      quotationThreads,
      eq(quotationThreads.id, quotationVersions.threadId),
    )
    .leftJoin(users, eq(users.id, quotationVersions.createdBy))
    .where(
      and(
        visibleQuotationThreadsFilter(session),
        eq(quotationVersions.versionNumber, 1),
        anchorFilter(scope),
        range ? gte(day, range.from) : undefined,
        range ? lte(day, range.to) : undefined,
      ),
    );

  return rows.map((row) => ({
    key: `quotation_raised:${row.id}`,
    kind: "quotation_raised" as const,
    day: row.day,
    at: row.at,
    actorUserId: row.actorUserId,
    actorName: row.actorName,
    companyId: row.companyId,
    projectId: row.projectId,
    detail: row.smacReference,
    link: { type: "quotation" as const, id: row.threadId },
  }));
}

/**
 * The one audit-sourced event `[20 §8.2]`.
 *
 * Note what gates it: the join to `quotation_versions` and `quotation_threads`
 * and `visibleQuotationThreadsFilter`. The `audit_log` row contributes the
 * actor and the moment and **nothing to the access question**.
 */
async function quotationIssuedEvents(
  session: AuthSession,
  scope: TimelineScope,
  range?: DateRange,
): Promise<TimelineEvent[]> {
  const day = riyadhDay(auditLog.createdAt);
  // While impersonating, every other source holds the impersonated user
  // (`session.user.id`), so the audit source must agree `[07 A6]`.
  const effectiveActor = sql<
    string | null
  >`coalesce(${auditLog.actingAsUserId}, ${auditLog.actorUserId})`;

  const rows = await db
    .select({
      id: auditLog.id,
      threadId: quotationVersions.threadId,
      day,
      at: auditLog.createdAt,
      actorUserId: effectiveActor,
      actorName: users.name,
      companyId: quotationThreads.companyId,
      projectId: quotationThreads.projectId,
      smacReference: quotationVersions.smacReference,
    })
    .from(auditLog)
    .innerJoin(quotationVersions, eq(quotationVersions.id, auditLog.entityId))
    .innerJoin(
      quotationThreads,
      eq(quotationThreads.id, quotationVersions.threadId),
    )
    .leftJoin(users, eq(users.id, effectiveActor))
    .where(
      and(
        eq(auditLog.action, "quotation_version.issued"),
        visibleQuotationThreadsFilter(session),
        anchorFilter(scope),
        range ? gte(day, range.from) : undefined,
        range ? lte(day, range.to) : undefined,
      ),
    );

  return rows.map((row) => ({
    key: `quotation_issued:${row.id}`,
    kind: "quotation_issued" as const,
    day: row.day,
    at: row.at,
    actorUserId: row.actorUserId,
    actorName: row.actorName,
    companyId: row.companyId,
    projectId: row.projectId,
    detail: row.smacReference,
    link: { type: "quotation" as const, id: row.threadId },
  }));
}

async function paymentConfirmedEvents(
  session: AuthSession,
  scope: TimelineScope,
  range?: DateRange,
): Promise<TimelineEvent[]> {
  const day = riyadhDay(quotationThreads.paymentConfirmedAt);
  const rows = await db
    .select({
      id: quotationThreads.id,
      day,
      at: quotationThreads.paymentConfirmedAt,
      // The rep receives the payment and ticks it `[07 C3]`.
      actorUserId: quotationThreads.paymentConfirmedByUserId,
      actorName: users.name,
      companyId: quotationThreads.companyId,
      projectId: quotationThreads.projectId,
    })
    .from(quotationThreads)
    .leftJoin(users, eq(users.id, quotationThreads.paymentConfirmedByUserId))
    .where(
      and(
        visibleQuotationThreadsFilter(session),
        isNotNull(quotationThreads.paymentConfirmedAt),
        anchorFilter(scope),
        range ? gte(day, range.from) : undefined,
        range ? lte(day, range.to) : undefined,
      ),
    );

  return rows.map((row) => ({
    key: `payment_confirmed:${row.id}`,
    kind: "payment_confirmed" as const,
    day: row.day,
    // `isNotNull` above guarantees this; the type does not know it.
    at: row.at ?? new Date(`${row.day}T00:00:00Z`),
    actorUserId: row.actorUserId,
    actorName: row.actorName,
    companyId: row.companyId,
    projectId: row.projectId,
    detail: null,
    link: { type: "quotation" as const, id: row.id },
  }));
}

async function dispatchedEvents(
  session: AuthSession,
  scope: TimelineScope,
  range?: DateRange,
): Promise<TimelineEvent[]> {
  const recorder = alias(users, "timeline_recorder");
  const rows = await db
    .select({
      id: dispatches.id,
      day: dispatches.dispatchDate,
      at: dispatches.createdAt,
      // `20 §8` — the coordinator who recorded it, NOT the credited rep.
      actorUserId: dispatches.recordedByUserId,
      actorName: recorder.name,
      companyId: dispatches.companyId,
      // `S74` — the dispatch's own project. The join through the thread that
      // used to reach it is gone: it was this query's only use for it.
      projectId: dispatches.projectId,
      // `S116` — the sum of the dispatch's lines, since `dispatches.sqm` is
      // gone. Correlated rather than joined so the row shape is unchanged and
      // no `group by` has to name every column this select already carries.
      // Both tables named outright: see the note on `dispatchSqm` in
      // `dispatches.ts` — an interpolated column loses its qualifier here and
      // the subquery then silently answers zero.
      sqm: sql<string>`(
        select coalesce(sum(dl.sqm), 0)::numeric(14, 4)
        from dispatch_lines dl
        where dl.dispatch_id = dispatches.id
      )`,
    })
    .from(dispatches)
    .innerJoin(recorder, eq(recorder.id, dispatches.recordedByUserId))
    .where(
      and(
        visibleDispatchesFilter(session),
        scope.companyId ? eq(dispatches.companyId, scope.companyId) : undefined,
        // A direct dispatch names no project today, so it belongs to the
        // company's timeline and to no project's `[07 C6]`, `S75`.
        scope.projectId
          ? eq(dispatches.projectId, scope.projectId)
          : undefined,
        range ? gte(dispatches.dispatchDate, range.from) : undefined,
        range ? lte(dispatches.dispatchDate, range.to) : undefined,
      ),
    );

  return rows.map((row) => ({
    key: `dispatched:${row.id}`,
    kind: "dispatched" as const,
    day: row.day,
    at: row.at,
    actorUserId: row.actorUserId,
    actorName: row.actorName,
    companyId: row.companyId,
    projectId: row.projectId,
    detail: row.sqm,
    link: { type: "dispatch" as const, id: row.id },
  }));
}

/**
 * The conversation `[25 §9]` — one thread per record, so a comment appears on
 * the timeline of the record it was written on and nowhere else.
 *
 * **`visibleCommentsFilter` is applied either way, anchored or not.**
 *
 * The first draft skipped it when anchored, on the reasoning that a detail
 * screen has already proved visibility by loading the record through that
 * record's own filter — true of every screen, and the sort of thing that stays
 * true right up until it doesn't. `scripts/verify-comments.ts` §2 called this
 * with an outsider's session and got somebody else's conversation back. In
 * production nothing reached it, because the pages 404 first; as a property of
 * the function it was simply false.
 *
 * The cost is one correlated `exists` over a single anchor row: the record type
 * is pinned by equality, so four of the filter's five branches are contradicted
 * and dropped before execution. That is not a price worth trading a leak for,
 * in the one module where a leak is silent `[03]` — FACET has no RLS, so a
 * missing filter is not a weakened defence, it is none `[00 §1.13]`.
 *
 * The range is a half-open window on the raw timestamp rather than
 * `riyadhDay(...) between ...` like its neighbours. That expression is STABLE,
 * not IMMUTABLE — the schema says so where it explains `digest_date` — so
 * Postgres cannot index it, and `comments` is the one table on this timeline
 * that grows every time anybody says anything. `lt` on the exclusive end, not
 * `lte`: half-open is the only form that neither drops nor duplicates the last
 * hour of the day.
 */
async function commentEvents(
  session: AuthSession,
  scope: TimelineScope,
  range?: DateRange,
): Promise<TimelineEvent[]> {
  const anchor = commentAnchor(scope);

  const rows = await db
    .select({
      id: comments.id,
      recordType: comments.recordType,
      recordId: comments.recordId,
      at: comments.createdAt,
      day: riyadhDay(comments.createdAt),
      actorUserId: comments.authorUserId,
      actorName: users.name,
      body: comments.body,
      editedAt: comments.editedAt,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorUserId))
    .where(
      and(
        visibleCommentsFilter(session),
        anchor
          ? and(
              eq(comments.recordType, anchor.type),
              eq(comments.recordId, anchor.id),
            )
          : undefined,
        range
          ? gte(
              comments.createdAt,
              sql`${range.from}::date::timestamp at time zone 'Asia/Riyadh'`,
            )
          : undefined,
        range
          ? lt(
              comments.createdAt,
              sql`(${range.to}::date + 1)::timestamp at time zone 'Asia/Riyadh'`,
            )
          : undefined,
      ),
    );

  const mentions = await mentionsFor(rows.map((row) => row.id));

  return rows.map((row) => ({
    key: `comment:${row.id}`,
    kind: "comment" as const,
    day: row.day,
    at: row.at,
    actorUserId: row.actorUserId,
    actorName: row.actorName,
    // Only where the anchor IS the company or the project. A comment on a
    // contact is not a company event, and inventing one here would put it on a
    // timeline `25 §9` does not put it on.
    companyId: row.recordType === "company" ? row.recordId : null,
    projectId: row.recordType === "project" ? row.recordId : null,
    detail: null,
    // The comment's own edit route, rendered only when `canEdit` `[25 §12]`.
    link: { type: "comment" as const, id: row.id },
    comment: {
      id: row.id,
      body: row.body,
      editedAt: row.editedAt,
      canEdit: row.actorUserId === session.user.id,
      mentions: mentions.get(row.id) ?? [],
    },
  }));
}

/** Who was tagged, for a page of comments, in one query rather than per row. */
async function mentionsFor(
  commentIds: string[],
): Promise<Map<string, { userId: string; name: string }[]>> {
  const byComment = new Map<string, { userId: string; name: string }[]>();
  if (commentIds.length === 0) return byComment;

  const tagged = await db
    .select({
      commentId: commentMentions.commentId,
      userId: commentMentions.mentionedUserId,
      name: users.name,
    })
    .from(commentMentions)
    .innerJoin(users, eq(users.id, commentMentions.mentionedUserId))
    .where(inArray(commentMentions.commentId, commentIds))
    .orderBy(asc(users.name));

  for (const row of tagged) {
    const list = byComment.get(row.commentId) ?? [];
    list.push({ userId: row.userId, name: row.name });
    byComment.set(row.commentId, list);
  }
  return byComment;
}

/** The company or project term, for the three sources that reach it through a
 *  quotation thread. */
function anchorFilter(scope: TimelineScope) {
  if (scope.companyId) return eq(quotationThreads.companyId, scope.companyId);
  if (scope.projectId) return eq(quotationThreads.projectId, scope.projectId);
  return undefined;
}

export type DateRange = { from: string; to: string };

/* ------------------------------------------------------------------ *
 * Assembling
 * ------------------------------------------------------------------ */

async function gather(
  session: AuthSession,
  scope: TimelineScope,
  range?: DateRange,
): Promise<TimelineEvent[]> {
  /**
   * **The six derived sources are anchored to a company or a project, or to
   * nothing at all.** They express that themselves — `anchorFilter` for the
   * three that reach it through a thread, an inline ternary in `reportEvents`,
   * `companyAddedEvents` and `dispatchedEvents` — and every one of those terms
   * falls to `undefined` when neither key is set. That is correct for the daily
   * view, which asks for everything in a range.
   *
   * It is NOT correct for `25 §9`'s third scope. A contact, a quotation thread
   * and a dispatch have a thread of their own and no derived events, so running
   * the six for one of them would answer "every event this viewer can see"
   * instead of "this record's". Silently, and as over-disclosure rather than a
   * crash. So they are not run at all.
   */
  const derived = scope.record
    ? []
    : [
        reportEvents(session, scope, range),
        companyAddedEvents(session, scope, range),
        quotationRaisedEvents(session, scope, range),
        quotationIssuedEvents(session, scope, range),
        paymentConfirmedEvents(session, scope, range),
        dispatchedEvents(session, scope, range),
      ];

  const parts = await Promise.all([
    ...derived,
    commentEvents(session, scope, range),
  ]);

  return parts
    .flat()
    .sort(
      (a, b) => b.day.localeCompare(a.day) || b.at.getTime() - a.at.getTime(),
    );
}

export const TIMELINE_CARD_LIMIT = 20;
const TIMELINE_PAGE_SIZE = 25;

/**
 * A page of the timeline, newest first.
 *
 * `limit` is the detail card's cap `[20 §6]`; `total` is what the card reports
 * so the number it is not showing is stated rather than silently dropped, and
 * `/companies/[id]/timeline` pages through the rest. A cap with no route behind
 * it would break the one case this phase exists for — a rep inheriting a
 * company with years of history.
 */
export async function timelineFor(
  session: AuthSession,
  scope: TimelineScope,
  options: { limit?: number; page?: number } = {},
): Promise<{ events: TimelineEvent[]; total: number; page: number }> {
  const all = await gather(session, scope);
  const page = Math.max(1, options.page ?? 1);
  const size = options.limit ?? TIMELINE_PAGE_SIZE;
  const start = options.limit ? 0 : (page - 1) * size;
  return { events: all.slice(start, start + size), total: all.length, page };
}

export function companyTimeline(
  session: AuthSession,
  companyId: string,
  options: { limit?: number; page?: number } = {},
) {
  return timelineFor(session, { companyId }, options);
}

/**
 * The thread of a record that has no derived events of its own — a contact, a
 * quotation thread, a dispatch `[25 §9]`.
 *
 * Callers pass **no `limit`**, so it pages rather than capping: `<Timeline>`
 * only offers a "view all" link when it is given one, and these three records
 * have no full-history route. A cap with no route behind it is what
 * `timelineFor` above exists not to do.
 */
export function recordTimeline(
  session: AuthSession,
  type: CommentRecordType,
  id: string,
  options: { page?: number } = {},
) {
  return timelineFor(session, { record: { type, id } }, options);
}

export function projectTimeline(
  session: AuthSession,
  projectId: string,
  options: { limit?: number; page?: number } = {},
) {
  return timelineFor(session, { projectId }, options);
}

export { TIMELINE_PAGE_SIZE };

/**
 * Every event in a date range, whatever it is anchored to — the source the
 * daily activity view counts `[20 §8]`.
 *
 * The record filters still apply, exactly as on a timeline: a rep who cannot
 * see a thread gets none of its events here either, **even though the audit row
 * exists** `[20 §8.2]`. Scoping people is the caller's job.
 */
export async function eventsInRange(
  session: AuthSession,
  range: DateRange,
  actorUserIds?: string[],
): Promise<TimelineEvent[]> {
  const events = await gather(session, {}, range);
  if (!actorUserIds) return events;
  const wanted = new Set(actorUserIds);
  return events.filter(
    (event) => event.actorUserId !== null && wanted.has(event.actorUserId),
  );
}

/** Names for a set of actors, for a screen that groups by person. */
export async function actorNames(
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, userIds))
    .orderBy(asc(users.name));
  return new Map(rows.map((row) => [row.id, row.name]));
}
