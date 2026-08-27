/**
 * Follow-ups — `07 D5`, `21 §1`, `22 §6.11`, `25 §18`.
 *
 * **A follow-up is a condition, not a record.** Every kind below is a query
 * over real events and a `settings` threshold, computed on read — the pattern
 * the codebase has chosen everywhere: Phase 9's coverage and `on hold`
 * `[20 §5]`. Quotation expiry was the counter-example — it wrote a state — until
 * `S67`, which made it a derivation and then removed it outright. `20 §9` states it
 * outright: *"Follow-up timers are computed on read, never fired and stored."*
 *
 * **The one thing written here is the rep's own date** — `setNextFollowUp`,
 * `25 §18`. That is an **input to** the derivation and not a timer: no
 * follow-up, no due date and no age is stored, and clearing the date restores
 * `07 D5`'s thresholds with nothing to unwind. Read it as evidence that
 * follow-ups are stored and the next change will store one.
 *
 * **It is therefore not a task.** `10 §9` designed a system task that closes
 * itself when its trigger clears, and `21 §1` overrules it: a task row is a
 * second copy of a derived fact, it needs a backfill the derived form does not,
 * and a row written the instant a condition becomes true is exactly the
 * correction failure `20 §9`'s end-of-day rule exists to prevent. `tasks` stays
 * empty and `tasks.system_trigger` stays unused.
 *
 * **The only thing a follow-up ever raises is one digest notification per
 * recipient per day** — `src/lib/notifications.ts`, `07 E5`. Six kinds, still
 * one delivery: `21 §2`'s "five types and no sixth" is about deliveries.
 *
 * **No predicate is written here.** Each source composes an existing filter
 * from `authz` — `visibleCompaniesFilter`, `ownProjectsFilter`,
 * `visibleQuotationThreadsFilter` — and nothing else. `setNextFollowUp` gates
 * on `canViewRecord`, which `authz.ts` documents as the write-path check.
 *
 * **The project sources take `ownProjectsFilter`, not `visibleProjectsFilter`**
 * `S76`. A queue answers *whose desk is this on*, and since `S76` that is not
 * the same question as *who may read it* — the coordinator reads every project
 * and holds none. The panel reads at the bottom of this file are the other
 * question and keep the read filter.
 *
 * **Every join onto `projects` from a thread is a LEFT join** `S50`. A
 * quotation may have no project, and an inner join would drop it from the
 * waiting list without an error — the one failure mode a work queue cannot
 * survive, because nobody notices work that is not shown. Its label then falls
 * back to the company, which `S51` guarantees is there.
 *
 * ## Two suppressions, with deliberately different reach
 *
 * `gather` drops rows twice, and the two do not cover the same ground. A
 * reader who notices that and takes one for a bug will "fix" it, so the reason
 * is here rather than left to be inferred:
 *
 * **On hold is about the CUSTOMER.** They asked to be left alone, so
 * everything about them goes quiet — every kind on that company, including
 * rows anchored to its projects and threads. That is `suppressedCompanies`,
 * and it covers three company-level facts: `on hold until` still in the future
 * `[20 §5]`; the company archived `[07 E6]` or a merge tombstone `[07 B5]`;
 * and a `reincluded` dormancy review inside one threshold period `[21 §7]`,
 * without which route 1 of `07 E6` does nothing and the company is back in
 * tomorrow's digest.
 *
 * **A follow-up date is about the RECORD** — *"I will get to this one then"*.
 * So it drops only rows whose own anchor carries the date. Suppressing a
 * quotation because somebody set a date on its company would hide real work on
 * a different piece of business.
 *
 * The sources are merged and sorted in TypeScript rather than unioned in SQL —
 * the shape `timeline.ts` already uses for six sources, and for the same
 * reason: each source composes its own visibility filter, which a union would
 * have to flatten. Each source applies its threshold in SQL, so only overdue
 * rows come back; a work queue is small by construction.
 */

import {
  and,
  desc,
  eq,
  asc,
  gt,
  inArray,
  isNull,
  isNotNull,
  lte,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  auditLog,
  companies,
  companyDormancyReviews,
  companyReps,
  projects,
  quotationThreads,
  quotationVersions,
  repReports,
  users,
} from "@/db/schema";
import { withAudit } from "@/lib/audit";
/** `S72`'s one predicate `[dispatches.ts]` — a project moves on an approval. */
import {
  canViewRecord,
  ownProjectsFilter,
  visibleCompaniesFilter,
  visibleProjectsFilter,
  visibleQuotationThreadsFilter,
  type AuthSession,
} from "@/lib/authz";
import {
  FOLLOW_UP_GROUPS,
  FOLLOW_UP_KINDS,
  type FollowUpGroup,
  type FollowUpKind,
} from "@/lib/enums";
/**
 * The two project facts this file used to keep private copies of `D25`.
 * `projects.ts` owns them now: `/projects` orders by the same movement
 * derivation, and a second copy of one derivation is the trap `companyQuiet`
 * below is still an open example of.
 */
import { firstCompanyByName, projectMovement } from "@/lib/projects";
import { onHoldByCompany, today } from "@/lib/reports";
import { getFollowUpThresholds, type FollowUpThresholds } from "@/lib/settings";
import { RuleError } from "@/lib/validation";
import {
  calendarDaysBetween,
  riyadhDayOf,
  shiftDays,
  shiftWorkingDays,
} from "@/lib/working-days";

export const FOLLOW_UP_PAGE_SIZE = 25;

/** Dialect-less builder for correlated subqueries, as in `authz.ts`. */
const subquery = new QueryBuilder();

/**
 * `(x at time zone 'Asia/Riyadh')::date` — a calendar day, not a UTC instant.
 *
 * **WHERE clauses only.** Drizzle renders a column interpolated into a `sql`
 * template in the **SELECT list** without its table qualifier — `"created_at"`
 * rather than `"companies"."created_at"` — which is ambiguous the moment the
 * query has a join, and is the same family as the bug `verify:phase9` caught in
 * `coverage.ts`. Every query below therefore selects the plain timestamp column
 * and converts it with `riyadhDayOf` in TypeScript, and uses this only where
 * the qualifier is rendered correctly.
 */
function riyadhDay(column: unknown) {
  return sql<string>`(${column} at time zone 'Asia/Riyadh')::date`;
}

export type FollowUpAnchorType = "company" | "project" | "quotation_thread";

export type FollowUpRow = {
  kind: FollowUpKind;
  anchorType: FollowUpAnchorType;
  anchorId: string;
  /** One name, whatever its anchor is: every one of the three carries a
   *  single name field `S12` `S19` `S26`. */
  anchorName: string;
  /** Null only for a project with no live company link left `[14 §4]`. */
  companyId: string | null;
  companyName: string | null;
  /** Every live rep who could act on it. A company can have several `[04 Q3]`. */
  ownerNames: string[];
  /** The calendar day the clock started. */
  since: string;
  /**
   * How long it has waited, in **calendar days, for every kind** `D34`.
   *
   * It used to be working days for the three thresholds `07 D5` states that
   * way and calendar days for the rest, which put `78 working days` and
   * `117 days` on adjacent rows of one list. `D34` works the list down **by
   * ranking**, and two units cannot be ranked against each other by eye.
   *
   * **The thresholds are untouched.** Each source still applies its own in
   * SQL, in whatever unit `07 D5` states it in — this is the elapsed figure a
   * person reads, not the test that put the row here.
   */
  ageDays: number;
  thresholdDays: number;
};

/**
 * What names a quotation on the list: its SMAC reference, else its project,
 * else its company `S51`.
 *
 * The third term is `S50`'s: a quotation raised before its project exists has
 * neither of the first two while it is still `requested`, and a row with no
 * name is a row nobody can act on. The company is the fact that is always
 * there, and it is already on every one of these queries.
 */
type ThreadLabelParts = {
  smacReference: string | null;
  projectName: string | null;
  companyName: string;
};

function threadLabel(parts: ThreadLabelParts): string {
  return parts.smacReference ?? parts.projectName ?? parts.companyName;
}

export type FollowUpOptions = {
  /**
   * One of `D33`'s four tiles. Two of them cover two kinds each, so this is
   * **not** a second spelling of `kind` — it is the only way to ask for the
   * pair, and the counts strip links with it.
   */
  group?: FollowUpGroup;
  kind?: FollowUpKind;
  q?: string;
  page?: number;
};

export type FollowUpResult = {
  rows: FollowUpRow[];
  total: number;
  page: number;
  counts: Record<FollowUpKind, number>;
  thresholds: FollowUpThresholds;
};

function matchesSearch(row: FollowUpRow, query: string | undefined): boolean {
  const trimmed = query?.trim().toLowerCase();
  if (!trimmed) return true;
  return [row.anchorName, row.companyName].some((value) =>
    value?.toLowerCase().includes(trimmed),
  );
}

/* ------------------------------------------------------------------ *
 * The four sources. Each composes its own filter and nothing else.
 * ------------------------------------------------------------------ */

/**
 * `07 D5` — a quotation with no response after 5 **working** days.
 *
 * **When the clock starts, and why it is read from the audit log.**
 * `quotation_versions` carries a `status` and a SMAC reference and no
 * `issued_at` — `20 §8.1` records that gap and answers it the same way, from
 * the audit entry the data layer writes on every act `[07 E1]`. Using the
 * version's own `created_at` would be wrong in a way that shows: a version
 * raised on the 1st and issued on the 10th would be five working days overdue
 * the moment the coordinator issued it.
 *
 * **`20 §8.2` is honoured.** The audit row supplies the moment and nothing
 * else; access is gated by the join to `quotation_versions` and
 * `quotation_threads` plus `visibleQuotationThreadsFilter`.
 *
 * **What counts as a response** is a reading of `07 D5`, stated here rather
 * than left in the query: the thread has not ended, the version is still the
 * live `issued` one — a revision would have superseded it `[10 §4]` — and
 * nobody has logged an interaction against the company since it went out.
 *
 * **There was a fourth term until `S133`**: `payment_confirmed_at is null`,
 * which stopped the chase once the customer had paid. It went with the column,
 * and **nothing replaced it**, deliberately. Measured before the deletion, it
 * removed **0** rows — every paid thread also carried `end_state = 'accepted'`,
 * and the `end_state is null` term above already drops those — so taking it out
 * changed no behaviour, which is what made the deletion clean. Whether a
 * SUBMITTED dispatch should stop a chase is a different and real question,
 * worth 3 of the 15 threads in this pool, and it is a new rule rather than a
 * replacement: `WORKFLOW §5` carries it with the measurement.
 */
async function quotationNoResponse(
  session: AuthSession,
  thresholds: FollowUpThresholds,
): Promise<FollowUpRow[]> {
  const cutoff = shiftWorkingDays(today(), thresholds.quotationNoResponse);
  const issuedOn = riyadhDay(auditLog.createdAt);
  const laterIssue = alias(auditLog, "later_issue");

  const rows = await db
    .select({
      threadId: quotationThreads.id,
      companyId: quotationThreads.companyId,
      companyName: companies.name,
      projectName: projects.name,
      smacReference: quotationVersions.smacReference,
      // The plain timestamp, converted below — see `riyadhDay`'s note.
      issuedAt: auditLog.createdAt,
    })
    .from(quotationThreads)
    .innerJoin(
      quotationVersions,
      and(
        eq(quotationVersions.threadId, quotationThreads.id),
        eq(quotationVersions.status, "issued"),
      ),
    )
    .innerJoin(auditLog, eq(auditLog.entityId, quotationVersions.id))
    .innerJoin(companies, eq(companies.id, quotationThreads.companyId))
    .leftJoin(projects, eq(projects.id, quotationThreads.projectId))
    .where(
      and(
        visibleQuotationThreadsFilter(session),
        eq(auditLog.action, "quotation_version.issued"),
        isNull(quotationThreads.endState),
        isNull(companies.archivedAt),
        isNull(companies.mergedIntoId),
        lte(issuedOn, cutoff),
        // The latest issue, if a version were ever issued twice.
        notExists(
          subquery
            .select({ one: sql`1` })
            .from(laterIssue)
            .where(
              and(
                eq(laterIssue.entityId, quotationVersions.id),
                eq(laterIssue.action, "quotation_version.issued"),
                gt(laterIssue.createdAt, auditLog.createdAt),
              ),
            ),
        ),
        notExists(
          subquery
            .select({ one: sql`1` })
            .from(repReports)
            .where(
              and(
                eq(repReports.companyId, quotationThreads.companyId),
                eq(repReports.entryType, "interaction"),
                gt(repReports.reportDate, issuedOn),
              ),
            ),
        ),
      ),
    );

  const now = today();
  return rows.map((row) => {
    const since = riyadhDayOf(row.issuedAt);
    return {
      kind: "quotation_no_response" as const,
      anchorType: "quotation_thread" as const,
      anchorId: row.threadId,
      anchorName: threadLabel(row),
      companyId: row.companyId,
      companyName: row.companyName,
      ownerNames: [],
      since,
      ageDays: calendarDaysBetween(since, now),
      thresholdDays: thresholds.quotationNoResponse,
    };
  });
}

/**
 * The six audit actions that are the rep fixing what was sent back.
 *
 * They carry the LINE's id in `entity_id`, not the version's, and a removal
 * deletes the line — so neither `entity_id` nor a join to `quotation_lines`
 * can find them. The version is read out of the payload instead: `after` for
 * an add or an edit, `before` for a removal, both of which are the whole row
 * `[07 E1]`.
 */
const REP_EDIT_ACTIONS = [
  "quotation_line.added",
  "quotation_line.updated",
  "quotation_line.removed",
  "quotation_service_line.added",
  "quotation_service_line.updated",
  "quotation_service_line.removed",
];

/**
 * `22 §6.11` — returned for edits and not yet resubmitted.
 *
 * The gap that item recorded: `returnForEdit` leaves the version `requested`
 * and only increments a counter, so `quotationNoResponse` — which wants
 * `issued` — never sees it, and a returned quotation reached the rep's Today
 * screen through **nothing**. The slice-2 tag `[22 §6.10]` was a patch over
 * this: a notification is read once and gone, where a follow-up persists until
 * its condition clears `[21 §1]`.
 *
 * **The clock starts at the return**, read from the audit log for the reason
 * `quotationNoResponse` records above and `20 §8.1` licenses — there is no
 * `returned_at` column and adding one would be null for every return already
 * made. `20 §8.2` is honoured the same way: the joins to `quotation_versions`
 * and `quotation_threads` plus `visibleQuotationThreadsFilter` are what gate
 * it, never the audit row.
 *
 * **What counts as resubmitted, stated here rather than left in the query.**
 * There is no resubmit act in FACET — the version stays `requested` and stays
 * editable, and only the coordinator issuing it or a revision superseding it
 * moves its status. So the condition clears on **the rep touching the lines**:
 * that is what `22 §4` means by whose move it is, and once they have acted the
 * ball is with the coordinator. Leaving the status as the only clearing
 * condition would keep chasing the rep for work already done.
 *
 * **A rep who changes nothing is not stuck**, and the escape hatch is the
 * other half of this slice: they set a `next_follow_up_at` on the thread and
 * the chase stops until that date `[25 §18]`. That is not a substitute for a
 * resubmit act — the gap stays real — but it is not a dead end.
 */
async function quotationReturned(
  session: AuthSession,
  thresholds: FollowUpThresholds,
): Promise<FollowUpRow[]> {
  const cutoff = shiftWorkingDays(today(), thresholds.quotationReturned);
  const returnedOn = riyadhDay(auditLog.createdAt);
  const laterReturn = alias(auditLog, "later_return");
  const repEdit = alias(auditLog, "rep_edit");

  const rows = await db
    .select({
      threadId: quotationThreads.id,
      companyId: quotationThreads.companyId,
      companyName: companies.name,
      projectName: projects.name,
      smacReference: quotationVersions.smacReference,
      // The plain timestamp, converted below — see `riyadhDay`'s note.
      returnedAt: auditLog.createdAt,
    })
    .from(quotationThreads)
    .innerJoin(
      quotationVersions,
      and(
        eq(quotationVersions.threadId, quotationThreads.id),
        // Still the live, editable version: an issued or superseded one has
        // moved on, whatever its counter says.
        eq(quotationVersions.status, "requested"),
        gt(quotationVersions.returnForEditRound, 0),
      ),
    )
    .innerJoin(auditLog, eq(auditLog.entityId, quotationVersions.id))
    .innerJoin(companies, eq(companies.id, quotationThreads.companyId))
    .leftJoin(projects, eq(projects.id, quotationThreads.projectId))
    .where(
      and(
        visibleQuotationThreadsFilter(session),
        eq(auditLog.action, "quotation_version.returned_for_edit"),
        isNull(quotationThreads.endState),
        isNull(companies.archivedAt),
        isNull(companies.mergedIntoId),
        lte(returnedOn, cutoff),
        // The latest return. The round is a counter, so one version can carry
        // several, and the clock runs from the most recent.
        notExists(
          subquery
            .select({ one: sql`1` })
            .from(laterReturn)
            .where(
              and(
                eq(laterReturn.entityId, quotationVersions.id),
                eq(laterReturn.action, "quotation_version.returned_for_edit"),
                gt(laterReturn.createdAt, auditLog.createdAt),
              ),
            ),
        ),
        // The rep has not touched the lines since it came back.
        notExists(
          subquery
            .select({ one: sql`1` })
            .from(repEdit)
            .where(
              and(
                inArray(repEdit.action, REP_EDIT_ACTIONS),
                sql`coalesce(
                  ${repEdit.after} ->> 'versionId',
                  ${repEdit.before} ->> 'versionId'
                ) = ${quotationVersions.id}::text`,
                gt(repEdit.createdAt, auditLog.createdAt),
              ),
            ),
        ),
      ),
    );

  const now = today();
  return rows.map((row) => {
    const since = riyadhDayOf(row.returnedAt);
    return {
      kind: "quotation_returned" as const,
      anchorType: "quotation_thread" as const,
      anchorId: row.threadId,
      anchorName: threadLabel(row),
      companyId: row.companyId,
      companyName: row.companyName,
      ownerNames: [],
      since,
      ageDays: calendarDaysBetween(since, now),
      thresholdDays: thresholds.quotationReturned,
    };
  });
}

/**
 * `07 D5` — a catalogue sent with no response after 10 **working** days.
 *
 * The reading: the company's **most recent** interaction says `catalogue_sent`.
 * A later interaction of any kind is the response, whatever it said, so "most
 * recent" is the whole condition and nothing has to interpret what came after.
 */
async function catalogueNoResponse(
  session: AuthSession,
  thresholds: FollowUpThresholds,
): Promise<FollowUpRow[]> {
  const cutoff = shiftWorkingDays(today(), thresholds.catalogueNoResponse);
  const later = alias(repReports, "later_report");

  const rows = await db
    .select({
      companyId: companies.id,
      companyName: companies.name,
      sentOn: repReports.reportDate,
    })
    .from(companies)
    .innerJoin(
      repReports,
      and(
        eq(repReports.companyId, companies.id),
        eq(repReports.entryType, "interaction"),
        eq(repReports.outcome, "catalogue_sent"),
      ),
    )
    .where(
      and(
        visibleCompaniesFilter(session),
        isNull(companies.archivedAt),
        isNull(companies.mergedIntoId),
        lte(repReports.reportDate, cutoff),
        notExists(
          subquery
            .select({ one: sql`1` })
            .from(later)
            .where(
              and(
                eq(later.companyId, companies.id),
                eq(later.entryType, "interaction"),
                gt(later.reportDate, repReports.reportDate),
              ),
            ),
        ),
      ),
    );

  const now = today();
  return rows.map((row) => ({
    kind: "catalogue_no_response" as const,
    anchorType: "company" as const,
    anchorId: row.companyId,
    anchorName: row.companyName,
    companyId: row.companyId,
    companyName: row.companyName,
    ownerNames: [],
    since: row.sentOn,
    ageDays: calendarDaysBetween(row.sentOn, now),
    thresholdDays: thresholds.catalogueNoResponse,
  }));
}

/**
 * `07 D5` — a project whose stage has not moved for 21 **calendar** days.
 *
 * **There is no stage column, and there is not going to be one.** `09 §15.11`
 * flagged that no document defines one, and `10 §1` settles why: the funnel is
 * *"computed from what has actually happened"* and nobody ticks a box. So
 * "stage unchanged" reads as **no stage-advancing event** — a quotation raised
 * on the project, a payment confirmed on one of its threads, or a dispatch
 * against one — falling back to the project's own creation when there is none,
 * which is the case the threshold exists to catch.
 *
 * A project with an end state is finished `[07 C5]` and is never chased.
 */
async function projectStageUnchanged(
  session: AuthSession,
  thresholds: FollowUpThresholds,
): Promise<FollowUpRow[]> {
  const cutoff = shiftDays(today(), -thresholds.projectStageUnchanged);

  // **The latest advancing event per project comes from `projectMovement`**
  // `[projects.ts]`, which is where this query's own two subqueries moved in
  // the board slice. `/projects` orders by the same answer `D25`, and two
  // copies of one derivation is what `companyQuiet` is still a live example of
  // — they had already drifted before anyone compared them. The shape is
  // unchanged: grouped subqueries joined on, never correlated subqueries in a
  // `sql` template, each exposing its date under a name unique across the whole
  // statement.
  const moved = projectMovement();

  const rows = await db
    .select({
      projectId: projects.id,
      projectName: projects.name,
      createdAt: projects.createdAt,
      threadAt: moved.threadEvents.at,
      dispatchAt: moved.dispatchEvents.at,
    })
    .from(projects)
    .leftJoin(moved.threadEvents, eq(moved.threadEvents.projectId, projects.id))
    .leftJoin(
      moved.dispatchEvents,
      eq(moved.dispatchEvents.projectId, projects.id),
    )
    .where(
      and(
        // **`ownProjectsFilter`, never `visibleProjectsFilter`** `S76`. A queue
        // asks whose desk a record sits on, which since `S76` is a different
        // question from who may read it: the coordinator reads every project
        // and owns none, and the read filter here would put every rep's stale
        // project on their waiting list and in their digest. No rule asks for
        // that. The two are asserted as a pair in `verify:slice3` §16.
        ownProjectsFilter(session),
        // **`end_state` carries only `'lost'` since `S31`**, so this reads
        // "not lost" where it used to read "not closed". The predicate is
        // unchanged and still right; what changed is underneath it.
        //
        // **A won project is deliberately still chased.** Winning is an
        // approved dispatch `S31`, not an exit: `S90`'s three ways off the
        // list are moved, parked and closed with a reason, and `S77` has one
        // quotation producing any number of dispatches — so a project that
        // has shipped part of what it quoted is still moving. The approved
        // dispatch resets the clock below as the event it is, and nothing
        // more.
        isNull(projects.endState),
        sql`${moved.at} <= ${cutoff}`,
      ),
    );

  if (rows.length === 0) return [];

  const now = today();
  const companiesByProject = await firstCompanyByName(
    rows.map((row) => row.projectId),
  );

  return rows.map((row) => {
    const events = [row.threadAt, row.dispatchAt].filter(
      (value): value is string => Boolean(value),
    );
    const since =
      events.length > 0
        ? events.reduce((a, b) => (a > b ? a : b))
        : riyadhDayOf(row.createdAt);
    const company = companiesByProject.get(row.projectId) ?? null;
    return {
      kind: "project_stage_unchanged" as const,
      anchorType: "project" as const,
      anchorId: row.projectId,
      anchorName: row.projectName,
      companyId: company?.id ?? null,
      companyName: company?.name ?? null,
      ownerNames: [],
      since,
      ageDays: calendarDaysBetween(since, now),
      thresholdDays: thresholds.projectStageUnchanged,
    };
  });
}

/**
 * `07 D5` — a qualified company quiet for 30 days, an unqualified one for 60.
 *
 * The same condition `coverage()` shows `[20 §7]`, read here as a queue rather
 * than a diagnostic: qualification is derived from a real quotation thread
 * `[10 §1]`, never from an outcome `[20 §3]`, and a company never logged
 * against counts from the day it was created — it is exactly the one that needs
 * the conversation.
 *
 * The threshold is applied in SQL rather than after decoration, because this is
 * a work queue and only the overdue rows are wanted. `coverage()` keeps its own
 * shape: it lists every company with its age, which is a different question.
 */
async function companyQuiet(
  session: AuthSession,
  thresholds: FollowUpThresholds,
): Promise<FollowUpRow[]> {
  const now = today();
  const qualifiedCutoff = shiftDays(now, -thresholds.qualified);
  const unqualifiedCutoff = shiftDays(now, -thresholds.unqualified);

  // Grouped subqueries joined on, for the reason `riyadhDay` records.
  const lastInteraction = db
    .select({
      companyId: repReports.companyId,
      at: sql<string | null>`max(${repReports.reportDate})`.as(
        "last_interaction_at",
      ),
    })
    .from(repReports)
    .where(eq(repReports.entryType, "interaction"))
    .groupBy(repReports.companyId)
    .as("last_interaction");

  // Qualification is derived from a real quotation thread `[10 §1]`, never from
  // an outcome `[20 §3]` — and never reads `end_state`, because an accepted
  // thread is internal approval, not a won deal `[16 §5]`.
  //
  // The id is re-aliased because it is interpolated into a `sql` template
  // below, where a bare `"company_id"` would collide with the other subquery's.
  const qualified = db
    .selectDistinct({
      companyId: sql<string>`${quotationThreads.companyId}`.as(
        "qualified_company_id",
      ),
    })
    .from(quotationThreads)
    .as("qualified");

  const quietSince = sql<string>`coalesce(
    ${lastInteraction.at}, (${companies.createdAt} at time zone 'Asia/Riyadh')::date
  )`;
  const isQualified = sql<boolean>`${qualified.companyId} is not null`;

  const rows = await db
    .select({
      companyId: companies.id,
      companyName: companies.name,
      createdAt: companies.createdAt,
      lastInteractionAt: lastInteraction.at,
      qualifiedId: qualified.companyId,
    })
    .from(companies)
    .leftJoin(lastInteraction, eq(lastInteraction.companyId, companies.id))
    .leftJoin(qualified, eq(qualified.companyId, companies.id))
    .where(
      and(
        visibleCompaniesFilter(session),
        isNull(companies.archivedAt),
        isNull(companies.mergedIntoId),
        or(
          and(isQualified, sql`${quietSince} < ${qualifiedCutoff}`),
          and(
            sql`${qualified.companyId} is null`,
            sql`${quietSince} < ${unqualifiedCutoff}`,
          ),
        ),
      ),
    );

  return rows.map((row) => {
    const since = row.lastInteractionAt ?? riyadhDayOf(row.createdAt);
    return {
      kind: "company_quiet" as const,
      anchorType: "company" as const,
      anchorId: row.companyId,
      anchorName: row.companyName,
      companyId: row.companyId,
      companyName: row.companyName,
      ownerNames: [],
      since,
      ageDays: calendarDaysBetween(since, now),
      thresholdDays: row.qualifiedId
        ? thresholds.qualified
        : thresholds.unqualified,
    };
  });
}

/**
 * `25 §18` — the rep's own date has arrived.
 *
 * *"A rep may set next follow-up on a project, quotation or company. That date
 * suppresses the automatic chase until it arrives. When it arrives, it becomes
 * the follow-up."* This is the second half. The first is `gather`'s override
 * step, and the third — an arrived date **superseding** the automatic kinds on
 * the same anchor, so *"the follow-up"* is one row and not two — is there too.
 *
 * **It produces, rather than merely un-suppressing.** A record with a date and
 * no threshold met still raises a row: that is the difference between `25 §18`
 * and `20 §5`, whose past date suppresses nothing and produces nothing.
 *
 * **Nothing is stored but the date.** No due row, no age, no timer — `20 §9`
 * is intact and the date is an input, exactly as `schema.ts` says at the
 * column.
 *
 * Three queries rather than one union, each composing the filter its own table
 * already has, for the reason the module docblock gives.
 */
async function manualDateDue(session: AuthSession): Promise<FollowUpRow[]> {
  const now = today();

  const [companyRows, projectRows, threadRows] = await Promise.all([
    db
      .select({
        id: companies.id,
        name: companies.name,
        due: companies.nextFollowUpAt,
      })
      .from(companies)
      .where(
        and(
          visibleCompaniesFilter(session),
          isNull(companies.archivedAt),
          isNull(companies.mergedIntoId),
          isNotNull(companies.nextFollowUpAt),
          lte(companies.nextFollowUpAt, now),
        ),
      ),
    db
      .select({
        id: projects.id,
        name: projects.name,
        due: projects.nextFollowUpAt,
      })
      .from(projects)
      .where(
        and(
          // Whose desk, not who may read — `projectStageUnchanged`'s note
          // `S76`. And "not lost" rather than "not closed" since `S31`, with
          // a won project still chased for the same reason recorded there.
          ownProjectsFilter(session),
          isNull(projects.endState),

          isNotNull(projects.nextFollowUpAt),
          lte(projects.nextFollowUpAt, now),
        ),
      ),
    db
      .select({
        id: quotationThreads.id,
        companyId: quotationThreads.companyId,
        companyName: companies.name,
        projectName: projects.name,
        due: quotationThreads.nextFollowUpAt,
      })
      .from(quotationThreads)
      .innerJoin(companies, eq(companies.id, quotationThreads.companyId))
      .leftJoin(projects, eq(projects.id, quotationThreads.projectId))
      .where(
        and(
          visibleQuotationThreadsFilter(session),
          isNull(quotationThreads.endState),
          isNull(companies.archivedAt),
          isNull(companies.mergedIntoId),
          isNotNull(quotationThreads.nextFollowUpAt),
          lte(quotationThreads.nextFollowUpAt, now),
        ),
      ),
  ]);

  // A thread's own label is its SMAC reference where it has one, so a date_due
  // row names the thread the same way `quotationNoResponse` does. Decorated
  // afterwards, the shape `firstCompanyByName` already uses here.
  const [companiesByProject, referenceByThread] = await Promise.all([
    firstCompanyByName(projectRows.map((row) => row.id)),
    liveReferenceByThread(threadRows.map((row) => row.id)),
  ]);

  /** Every row is due by construction, so the age runs from the date itself. */
  const row = (
    partial: Omit<FollowUpRow, "kind" | "ownerNames" | "ageDays" | "thresholdDays">,
  ): FollowUpRow => ({
    ...partial,
    kind: "date_due",
    ownerNames: [],
    ageDays: calendarDaysBetween(partial.since, now),
    // There is no threshold: the rep's date IS the condition `[25 §18]`.
    thresholdDays: 0,
  });

  return [
    ...companyRows.map((company) =>
      row({
        anchorType: "company",
        anchorId: company.id,
        anchorName: company.name,
        companyId: company.id,
        companyName: company.name,
        since: company.due as string,
      }),
    ),
    ...projectRows.map((project) => {
      const company = companiesByProject.get(project.id) ?? null;
      return row({
        anchorType: "project",
        anchorId: project.id,
        anchorName: project.name,
        companyId: company?.id ?? null,
        companyName: company?.name ?? null,
        since: project.due as string,
      });
    }),
    ...threadRows.map((thread) => {
      const reference = referenceByThread.get(thread.id) ?? null;
      return row({
        anchorType: "quotation_thread",
        anchorId: thread.id,
        anchorName: threadLabel({ ...thread, smacReference: reference }),
        companyId: thread.companyId,
        companyName: thread.companyName,
        since: thread.due as string,
      });
    }),
  ];
}

/* ------------------------------------------------------------------ *
 * Suppression and decoration `[21 §1]`
 * ------------------------------------------------------------------ */

/**
 * Companies whose follow-ups are suppressed today. A suppressed company is
 * simply absent from the queue; the reason is not shown, because the queue's
 * job is to list what needs doing.
 *
 * `onHoldByCompany` is deliberately unfiltered by the viewer `[20 §5]` —
 * suppression is a property of the company, not of who is looking, and a
 * manager who cannot read some rep's report must still not chase a customer who
 * asked to be left alone.
 */
async function suppressedCompanies(
  companyIds: string[],
  thresholds: FollowUpThresholds,
): Promise<Set<string>> {
  if (companyIds.length === 0) return new Set();

  // The longest threshold a re-inclusion could be shielding against, so one
  // rule covers a company whose qualification changes in the meantime.
  const shieldFrom = shiftDays(
    today(),
    -Math.max(thresholds.qualified, thresholds.unqualified),
  );

  const [onHold, reincluded] = await Promise.all([
    onHoldByCompany(companyIds),
    db
      .selectDistinct({ companyId: companyDormancyReviews.companyId })
      .from(companyDormancyReviews)
      .where(
        and(
          inArray(companyDormancyReviews.companyId, companyIds),
          eq(companyDormancyReviews.outcome, "reincluded"),
          sql`${companyDormancyReviews.decidedAt} >= ${shieldFrom}`,
        ),
      ),
  ]);

  const held = new Set<string>(onHold.keys());
  for (const row of reincluded) held.add(row.companyId);
  return held;
}

/** The SMAC reference of a thread's highest version, where it has one. */
async function liveReferenceByThread(
  threadIds: string[],
): Promise<Map<string, string>> {
  if (threadIds.length === 0) return new Map();

  const rows = await db
    .select({
      threadId: quotationVersions.threadId,
      reference: quotationVersions.smacReference,
    })
    .from(quotationVersions)
    .where(
      and(
        inArray(quotationVersions.threadId, threadIds),
        isNotNull(quotationVersions.smacReference),
      ),
    )
    .orderBy(asc(quotationVersions.versionNumber));

  // Ascending, overwriting: the highest version number wins.
  const byThread = new Map<string, string>();
  for (const row of rows) {
    if (row.reference) byThread.set(row.threadId, row.reference);
  }
  return byThread;
}

/** `${anchorType}:${anchorId}` — the key the two record-level steps share. */
function anchorKey(anchorType: FollowUpAnchorType, anchorId: string): string {
  return `${anchorType}:${anchorId}`;
}

/**
 * The rep's date per anchor, for the records already in hand `[25 §18]`.
 *
 * `onHoldByCompany`'s shape (`reports.ts`), and **deliberately unfiltered by
 * the viewer** for the same reason: the date is a property of the record, not
 * of who is looking, and the caller has already scoped which records it may
 * ask about. A manager who cannot read the rep's reports must still not chase
 * a record the rep has already scheduled.
 */
async function nextFollowUpByAnchor(
  anchors: { anchorType: FollowUpAnchorType; anchorId: string }[],
): Promise<Map<string, string>> {
  const idsOf = (type: FollowUpAnchorType) => [
    ...new Set(
      anchors.filter((a) => a.anchorType === type).map((a) => a.anchorId),
    ),
  ];

  const companyIds = idsOf("company");
  const projectIds = idsOf("project");
  const threadIds = idsOf("quotation_thread");

  const [companyRows, projectRows, threadRows] = await Promise.all([
    companyIds.length
      ? db
          .select({ id: companies.id, at: companies.nextFollowUpAt })
          .from(companies)
          .where(
            and(
              inArray(companies.id, companyIds),
              isNotNull(companies.nextFollowUpAt),
            ),
          )
      : Promise.resolve([]),
    projectIds.length
      ? db
          .select({ id: projects.id, at: projects.nextFollowUpAt })
          .from(projects)
          .where(
            and(
              inArray(projects.id, projectIds),
              isNotNull(projects.nextFollowUpAt),
            ),
          )
      : Promise.resolve([]),
    threadIds.length
      ? db
          .select({ id: quotationThreads.id, at: quotationThreads.nextFollowUpAt })
          .from(quotationThreads)
          .where(
            and(
              inArray(quotationThreads.id, threadIds),
              isNotNull(quotationThreads.nextFollowUpAt),
            ),
          )
      : Promise.resolve([]),
  ]);

  const byAnchor = new Map<string, string>();
  for (const row of companyRows) {
    if (row.at) byAnchor.set(anchorKey("company", row.id), row.at);
  }
  for (const row of projectRows) {
    if (row.at) byAnchor.set(anchorKey("project", row.id), row.at);
  }
  for (const row of threadRows) {
    if (row.at) byAnchor.set(anchorKey("quotation_thread", row.id), row.at);
  }
  return byAnchor;
}

/** Live company reps, so a row can say who could act on it. */
async function repNamesByCompany(
  companyIds: string[],
): Promise<Map<string, string[]>> {
  if (companyIds.length === 0) return new Map();

  const rows = await db
    .select({ companyId: companyReps.companyId, name: users.name })
    .from(companyReps)
    .innerJoin(users, eq(users.id, companyReps.userId))
    .where(
      and(
        inArray(companyReps.companyId, companyIds),
        isNull(companyReps.removedAt),
      ),
    )
    .orderBy(asc(users.name));

  const byCompany = new Map<string, string[]>();
  for (const row of rows) {
    const bucket = byCompany.get(row.companyId) ?? [];
    bucket.push(row.name);
    byCompany.set(row.companyId, bucket);
  }
  return byCompany;
}

/* ------------------------------------------------------------------ *
 * Assembling
 * ------------------------------------------------------------------ */

async function gather(
  session: AuthSession,
  thresholds: FollowUpThresholds,
): Promise<FollowUpRow[]> {
  const parts = await Promise.all([
    quotationNoResponse(session, thresholds),
    quotationReturned(session, thresholds),
    catalogueNoResponse(session, thresholds),
    projectStageUnchanged(session, thresholds),
    companyQuiet(session, thresholds),
    manualDateDue(session),
  ]);

  const all = parts.flat();
  const companyIds = [
    ...new Set(all.map((row) => row.companyId).filter((id): id is string => !!id)),
  ];

  const [suppressed, repNames, overrides] = await Promise.all([
    suppressedCompanies(companyIds, thresholds),
    repNamesByCompany(companyIds),
    nextFollowUpByAnchor(all),
  ]);

  const now = today();

  // Every anchor the rep's own date has already produced a row for. Used to
  // supersede, so `25 §18`'s "it becomes THE follow-up" is one row per record
  // rather than the rep's date beside the automatic chase it replaced.
  const dueAnchors = new Set(
    all
      .filter((row) => row.kind === "date_due")
      .map((row) => anchorKey(row.anchorType, row.anchorId)),
  );

  return (
    all
      // 1. The CUSTOMER is out of scope — on hold, archived, a tombstone, or
      //    recently re-included. Everything about them goes quiet, including
      //    rows anchored to their projects and threads. See the module note.
      .filter((row) => !(row.companyId && suppressed.has(row.companyId)))
      // 2. The RECORD is scheduled: the rep's own date has not arrived yet
      //    `[25 §18]`. Only this anchor, never the company's other work.
      //
      //    `>` and not `>=`, which is where this parts company with `on hold`:
      //    `on_hold_until` is an inclusive until-date and suppresses through
      //    it, while `next_follow_up_at` is a due-on date and stops
      //    suppressing ON the day it arrives — because that is the day it
      //    becomes the follow-up. A `date_due` row can never be dropped here:
      //    its own date is by construction not in the future.
      .filter((row) => {
        const due = overrides.get(anchorKey(row.anchorType, row.anchorId));
        return !(due && due > now);
      })
      // 3. An arrived date supersedes the automatic kinds on its own anchor.
      .filter(
        (row) =>
          row.kind === "date_due" ||
          !dueAnchors.has(anchorKey(row.anchorType, row.anchorId)),
      )
      .map((row) => ({
        ...row,
        ownerNames: row.companyId ? (repNames.get(row.companyId) ?? []) : [],
      }))
      // Oldest first: a work queue is ordered by what has waited longest.
      .sort(
        (a, b) => a.since.localeCompare(b.since) || a.kind.localeCompare(b.kind),
      )
  );
}

const EMPTY_COUNTS = (): Record<FollowUpKind, number> =>
  Object.fromEntries(FOLLOW_UP_KINDS.map((kind) => [kind, 0])) as Record<
    FollowUpKind,
    number
  >;

export type FollowUpScope = {
  /** **Every** open follow-up this identity may see, oldest first. */
  rows: FollowUpRow[];
  total: number;
  counts: Record<FollowUpKind, number>;
  thresholds: FollowUpThresholds;
};

/**
 * The whole derivation, unpaginated — one `gather` for every caller that needs
 * more than one slice of it.
 *
 * **`/` is why this is exported.** `D34` puts the rep's own dates in a section
 * of their own, and those rows sort **last**: a planned date is days old where
 * a quiet company is months old. Reading the dashboard's two sections off page
 * one would show a rep an empty planned section while four dates were due —
 * silently, which is the failure `CLAUDE.md` records for filtering after
 * pagination. Taking a second page instead would mean a second `gather`, on
 * the commonest read in the application.
 *
 * It costs nothing extra: `gather` already builds every row and `followUps`
 * already threw the surplus away.
 */
export async function followUpScope(
  session: AuthSession,
): Promise<FollowUpScope> {
  const thresholds = await getFollowUpThresholds();
  const rows = await gather(session, thresholds);

  const counts = EMPTY_COUNTS();
  for (const row of rows) counts[row.kind] += 1;

  return { rows, total: rows.length, counts, thresholds };
}

/**
 * Every open follow-up the caller may see, oldest first — filtered and paged.
 *
 * `counts` is over the whole scope, not the page, so the kind filter can show
 * what it would reveal before it is applied.
 */
export async function followUps(
  session: AuthSession,
  options: FollowUpOptions = {},
): Promise<FollowUpResult> {
  const { rows: all, counts, thresholds } = await followUpScope(session);

  // `D33`'s grouping is resolved against the kinds the group names, so a tile
  // showing 9 lands on a list of 9. `gather` has already produced every row —
  // this narrows before the page slice below, never after it.
  const inGroup = options.group
    ? new Set<FollowUpKind>(FOLLOW_UP_GROUPS[options.group])
    : null;

  const filtered = all
    .filter((row) => !inGroup || inGroup.has(row.kind))
    .filter((row) => !options.kind || row.kind === options.kind)
    .filter((row) => matchesSearch(row, options.q));

  const page = Math.max(1, options.page ?? 1);
  const start = (page - 1) * FOLLOW_UP_PAGE_SIZE;

  return {
    rows: filtered.slice(start, start + FOLLOW_UP_PAGE_SIZE),
    total: filtered.length,
    page,
    counts,
    thresholds,
  };
}

/**
 * The same question asked **as** somebody else — what this user's own scope
 * holds, not the caller's.
 *
 * This is the recipient filter the daily digest needs, in the application
 * layer. `00 §1.13` records v1 doing the opposite: both notification pages
 * selected every row and left the filtering to RLS, which FACET does not have
 * `[03]`. Here the scope is built from the recipient's identity before a single
 * row is read.
 */
export async function followUpsForRecipient(
  scope: AuthSession,
): Promise<FollowUpRow[]> {
  const thresholds = await getFollowUpThresholds();
  return gather(scope, thresholds);
}

/* ------------------------------------------------------------------ *
 * The rep's own date `[25 §18]` — the one write in this module
 * ------------------------------------------------------------------ */

/**
 * Set, move or clear `next_follow_up_at` on a company, project or thread.
 *
 * **No new predicate.** The gate is `canViewRecord`, which `authz.ts` names as
 * the write-path check, and it is the only authorization this act needs: the
 * date is the rep's note to themself about a record they already hold.
 *
 * **A consequence, recorded rather than patched:** `canViewRecord`'s
 * `quotation_thread` case admits `can_approve_quotation` `[16 §10]`, so a
 * coordinator can set a date on a thread a rep is working. That is one column
 * per record and the last writer wins, silently — which is why
 * `nextFollowUpContext` reads back who set it, and why the panel says so.
 * Neither of them is prevented from moving it; both of them may legitimately
 * need to.
 *
 * **A past date is refused.** It would be a follow-up due now, entered by
 * mistake, and `manualDateDue` would raise it on the next read with no way for
 * the rep to tell that from a date they meant.
 */
export async function setNextFollowUp(
  session: AuthSession,
  recordType: FollowUpAnchorType,
  recordId: string,
  date: string | null,
): Promise<void> {
  if (!(await canViewRecord(session, recordType, recordId))) {
    throw new RuleError("followUps.errors.notYours");
  }
  if (date && date < today()) {
    throw new RuleError("followUps.errors.pastDate", "nextFollowUpAt");
  }

  await withAudit(session.actor, async (tx, log) => {
    let before: string | null;

    // Three explicit branches rather than a table looked up by name: Drizzle's
    // update is generic over one table, and a union of three would type-check
    // by accident or not at all.
    switch (recordType) {
      case "company": {
        const [row] = await tx
          .select({ at: companies.nextFollowUpAt })
          .from(companies)
          .where(eq(companies.id, recordId))
          .limit(1);
        if (!row) throw new RuleError("followUps.errors.notYours");
        before = row.at;
        await tx
          .update(companies)
          .set({ nextFollowUpAt: date })
          .where(eq(companies.id, recordId));
        break;
      }
      case "project": {
        const [row] = await tx
          .select({ at: projects.nextFollowUpAt })
          .from(projects)
          .where(eq(projects.id, recordId))
          .limit(1);
        if (!row) throw new RuleError("followUps.errors.notYours");
        before = row.at;
        await tx
          .update(projects)
          .set({ nextFollowUpAt: date })
          .where(eq(projects.id, recordId));
        break;
      }
      case "quotation_thread": {
        const [row] = await tx
          .select({ at: quotationThreads.nextFollowUpAt })
          .from(quotationThreads)
          .where(eq(quotationThreads.id, recordId))
          .limit(1);
        if (!row) throw new RuleError("followUps.errors.notYours");
        before = row.at;
        await tx
          .update(quotationThreads)
          .set({ nextFollowUpAt: date })
          .where(eq(quotationThreads.id, recordId));
        break;
      }
    }

    // One action name for setting, moving and clearing: when the value is null
    // the panel shows no attribution at all, and when it is not null the
    // latest row for this record is by definition the one that set it.
    log({
      action: `${recordType}.next_follow_up_set`,
      entityType: recordType,
      entityId: recordId,
      before: { nextFollowUpAt: before },
      after: { nextFollowUpAt: date },
    });
  });
}

/** What the panel says beside the date, beyond the date itself. */
export type NextFollowUpContext = {
  /** Who set the value in force, and when. Null if no audit row is found. */
  setByName: string | null;
  setOn: string | null;
  /**
   * The company's `on hold until`, when it falls **after** the date — so the
   * follow-up will not raise on the day it is set for. Null otherwise.
   */
  heldUntil: string | null;
  heldCompanyName: string | null;
};

const NO_CONTEXT: NextFollowUpContext = {
  setByName: null,
  setOn: null,
  heldUntil: null,
  heldCompanyName: null,
};

/**
 * Who set the date, read from the audit log.
 *
 * `20 §8.1`'s "quotation issued" case exactly: an act with no actor column of
 * its own, read from the entry `07 E1` already has the data layer write. No
 * column is added — one would be null for every date set before it landed,
 * which is the backfill objection `20 §8.1` itself makes.
 *
 * **`20 §8.2` is honoured**: the query joins to the record it describes and
 * applies that record's own existing filter, so an identity who cannot see the
 * record gets nothing back. The audit row supplies the actor and the moment
 * and contributes nothing to the access question.
 *
 * The actor is `coalesce(acting_as, actor)`, as `timeline.ts` reads it, so an
 * impersonated write attributes to whoever was acted as `[07 A6]`.
 */
async function nextFollowUpSetBy(
  session: AuthSession,
  recordType: FollowUpAnchorType,
  recordId: string,
): Promise<{ setByName: string | null; setOn: string | null }> {
  const effectiveActor = sql<
    string | null
  >`coalesce(${auditLog.actingAsUserId}, ${auditLog.actorUserId})`;

  const base = db
    .select({ name: users.name, at: auditLog.createdAt })
    .from(auditLog)
    .leftJoin(users, eq(users.id, effectiveActor));

  const scoped = and(
    eq(auditLog.action, `${recordType}.next_follow_up_set`),
    eq(auditLog.entityType, recordType),
    eq(auditLog.entityId, recordId),
  );

  const rows =
    recordType === "company"
      ? await base
          .innerJoin(companies, eq(companies.id, auditLog.entityId))
          .where(and(scoped, visibleCompaniesFilter(session)))
          .orderBy(desc(auditLog.createdAt))
          .limit(1)
      : recordType === "project"
        ? await base
            .innerJoin(projects, eq(projects.id, auditLog.entityId))
            .where(and(scoped, visibleProjectsFilter(session)))
            .orderBy(desc(auditLog.createdAt))
            .limit(1)
        : await base
            .innerJoin(
              quotationThreads,
              eq(quotationThreads.id, auditLog.entityId),
            )
            .where(and(scoped, visibleQuotationThreadsFilter(session)))
            .orderBy(desc(auditLog.createdAt))
            .limit(1);

  const row = rows[0];
  if (!row) return { setByName: null, setOn: null };
  return { setByName: row.name ?? null, setOn: riyadhDayOf(row.at) };
}

/**
 * The company whose on-hold state will decide whether this anchor's date can
 * raise anything — **resolved exactly as `gather` resolves it**.
 *
 * That "exactly" is the whole point. `gather` suppresses a project row on
 * `row.companyId`, which comes from `firstCompanyByName`; resolving the
 * company a second way here would let the panel name one company while a
 * different one did the suppressing, which is the second-derivation trap
 * `21 §7` names.
 *
 * The record's own filter is applied first, so this leaks nothing.
 */
async function anchorCompany(
  session: AuthSession,
  recordType: FollowUpAnchorType,
  recordId: string,
): Promise<{ id: string; name: string } | null> {
  switch (recordType) {
    case "company": {
      const [row] = await db
        .select({
          id: companies.id,
          name: companies.name,
        })
        .from(companies)
        .where(and(eq(companies.id, recordId), visibleCompaniesFilter(session)))
        .limit(1);
      return row ?? null;
    }
    case "project": {
      const [row] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, recordId), visibleProjectsFilter(session)))
        .limit(1);
      if (!row) return null;
      return (await firstCompanyByName([recordId])).get(recordId) ?? null;
    }
    case "quotation_thread": {
      const [row] = await db
        .select({
          id: companies.id,
          name: companies.name,
        })
        .from(quotationThreads)
        .innerJoin(companies, eq(companies.id, quotationThreads.companyId))
        .where(
          and(
            eq(quotationThreads.id, recordId),
            visibleQuotationThreadsFilter(session),
          ),
        )
        .limit(1);
      return row ?? null;
    }
  }
}

/**
 * Everything the panel says beside the date: who set it, and whether it can
 * actually fire.
 *
 * **The second half is the reason this exists.** `setNextFollowUp` refuses a
 * past date, so every accepted date is in the future — but `gather`'s step 1
 * means a date on a record whose company is on hold **past** that date raises
 * nothing when the day comes, and the person who set it watches the day pass
 * and hears nothing. The sharp case is two people: a coordinator sets a date
 * on a thread, a different rep has that company on hold until December, and
 * her reminder is silently deferred with neither of them able to see why.
 *
 * **It is not refused and the precedence does not change.** On hold is about
 * the customer and it is right that it wins; the founder should see that in
 * behaviour. It is only *said*. A control that accepts input which can never
 * produce an effect is worse than one that refuses it.
 *
 * A hold that lapses **before** the date defers nothing, so it is not
 * reported: the condition is `on_hold_until > next_follow_up_at`.
 */
export async function nextFollowUpContext(
  session: AuthSession,
  recordType: FollowUpAnchorType,
  recordId: string,
  value: string | null,
): Promise<NextFollowUpContext> {
  if (!value) return NO_CONTEXT;

  const [setBy, company] = await Promise.all([
    nextFollowUpSetBy(session, recordType, recordId),
    anchorCompany(session, recordType, recordId),
  ]);

  if (!company) return { ...NO_CONTEXT, ...setBy };

  const until = (await onHoldByCompany([company.id])).get(company.id) ?? null;
  const deferred = until !== null && until > value;

  return {
    ...setBy,
    heldUntil: deferred ? until : null,
    heldCompanyName: deferred ? company.name : null,
  };
}
