/**
 * Follow-ups — `07 D5`, `21 §1`.
 *
 * **A follow-up is a condition, not a record.** Nothing here writes anything.
 * Every kind below is a query over real events and a `settings` threshold,
 * computed on read — the pattern the codebase has already chosen three times:
 * the quotation expiry sweep `[16 §3]`, Phase 9's coverage, and `on hold`
 * `[20 §5]`. `20 §9` states it outright: *"Follow-up timers are computed on
 * read, never fired and stored."*
 *
 * **It is therefore not a task.** `10 §9` designed a system task that closes
 * itself when its trigger clears, and `21 §1` overrules it: a task row is a
 * second copy of a derived fact, it needs a backfill the derived form does not,
 * and a row written the instant a condition becomes true is exactly the
 * correction failure `20 §9`'s end-of-day rule exists to prevent. `tasks` stays
 * empty and `tasks.system_trigger` stays unused.
 *
 * **The only thing a follow-up ever writes is one digest notification per
 * recipient per day** — `src/lib/notifications.ts`, `07 E5`.
 *
 * **No predicate is written here.** Each source composes an existing filter
 * from `authz` — `visibleCompaniesFilter`, `visibleProjectsFilter`,
 * `visibleQuotationThreadsFilter` — and nothing else.
 *
 * **Three suppressions apply to every kind**, so a customer who has asked to be
 * left alone is never chased:
 *
 *  1. `on hold until` still in the future `[20 §5]`, derived from the reports.
 *  2. The company is archived — out of scope by its own lifecycle `[07 E6]` —
 *     or is a merge tombstone `[07 B5]`.
 *  3. A `reincluded` dormancy review inside one threshold period `[21 §7]`.
 *     Without this, route 1 of `07 E6` does nothing and the company is back in
 *     tomorrow's digest, which teaches a rep to ignore the list.
 *
 * The four sources are merged and sorted in TypeScript rather than unioned in
 * SQL — the shape `timeline.ts` already uses for six sources, and for the same
 * reason: each source composes its own visibility filter, which a union would
 * have to flatten. Each source applies its threshold in SQL, so only overdue
 * rows come back; a work queue is small by construction.
 */

import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNull,
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
  dispatches,
  projectCompanies,
  projects,
  quotationThreads,
  quotationVersions,
  repReports,
  users,
} from "@/db/schema";
import {
  visibleCompaniesFilter,
  visibleProjectsFilter,
  visibleQuotationThreadsFilter,
  type AuthSession,
} from "@/lib/authz";
import { FOLLOW_UP_KINDS, type FollowUpKind } from "@/lib/enums";
import { onHoldByCompany, today } from "@/lib/reports";
import { getFollowUpThresholds, type FollowUpThresholds } from "@/lib/settings";
import {
  calendarDaysBetween,
  riyadhDayOf,
  shiftDays,
  shiftWorkingDays,
  workingDaysBetween,
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
  anchorNameEn: string;
  anchorNameAr: string | null;
  /** Null only for a project with no live company link left `[14 §4]`. */
  companyId: string | null;
  companyNameEn: string | null;
  companyNameAr: string | null;
  /** Every live rep who could act on it. A company can have several `[04 Q3]`. */
  ownerNames: string[];
  /** The calendar day the clock started. */
  since: string;
  /** Working days for the two thresholds `07 D5` states that way, else calendar. */
  ageDays: number;
  /** True when `ageDays` counts working days rather than calendar days. */
  inWorkingDays: boolean;
  thresholdDays: number;
};

export type FollowUpOptions = {
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
  return [row.anchorNameEn, row.anchorNameAr, row.companyNameEn, row.companyNameAr]
    .some((value) => value?.toLowerCase().includes(trimmed));
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
 * than left in the query: the thread has not ended, payment has not been
 * confirmed, the version is still the live `issued` one — a revision would have
 * superseded it `[10 §4]` — and nobody has logged an interaction against the
 * company since it went out.
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
      companyNameEn: companies.nameEn,
      companyNameAr: companies.nameAr,
      projectNameEn: projects.nameEn,
      projectNameAr: projects.nameAr,
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
    .innerJoin(projects, eq(projects.id, quotationThreads.projectId))
    .where(
      and(
        visibleQuotationThreadsFilter(session),
        eq(auditLog.action, "quotation_version.issued"),
        isNull(quotationThreads.endState),
        isNull(quotationThreads.paymentConfirmedAt),
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
      anchorNameEn: row.smacReference ?? row.projectNameEn,
      anchorNameAr: row.smacReference ? null : row.projectNameAr,
      companyId: row.companyId,
      companyNameEn: row.companyNameEn,
      companyNameAr: row.companyNameAr,
      ownerNames: [],
      since,
      ageDays: workingDaysBetween(since, now),
      inWorkingDays: true,
      thresholdDays: thresholds.quotationNoResponse,
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
      companyNameEn: companies.nameEn,
      companyNameAr: companies.nameAr,
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
    anchorNameEn: row.companyNameEn,
    anchorNameAr: row.companyNameAr,
    companyId: row.companyId,
    companyNameEn: row.companyNameEn,
    companyNameAr: row.companyNameAr,
    ownerNames: [],
    since: row.sentOn,
    ageDays: workingDaysBetween(row.sentOn, now),
    inWorkingDays: true,
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

  // The latest advancing event per project, as two grouped subqueries joined on
  // — not correlated subqueries in a `sql` template, which is the shape
  // `coverage.ts` records this codebase getting wrong once already. A subquery
  // column renders qualified in both the SELECT list and the WHERE.
  // Every column a `sql` template interpolates needs a name unique across the
  // whole statement: Drizzle drops the table qualifier there, so two subqueries
  // both exposing `at` render as an ambiguous bare `"at"`.
  const threadEvents = db
    .select({
      projectId: quotationThreads.projectId,
      at: sql<string | null>`greatest(
        max((${quotationThreads.createdAt} at time zone 'Asia/Riyadh')::date),
        max((${quotationThreads.paymentConfirmedAt} at time zone 'Asia/Riyadh')::date)
      )`.as("thread_event_at"),
    })
    .from(quotationThreads)
    .groupBy(quotationThreads.projectId)
    .as("thread_events");

  const dispatchEvents = db
    .select({
      projectId: quotationThreads.projectId,
      at: sql<string | null>`max(${dispatches.dispatchDate})`.as(
        "dispatch_event_at",
      ),
    })
    .from(dispatches)
    .innerJoin(
      quotationThreads,
      eq(quotationThreads.id, dispatches.quotationThreadId),
    )
    .groupBy(quotationThreads.projectId)
    .as("dispatch_events");

  const rows = await db
    .select({
      projectId: projects.id,
      projectNameEn: projects.nameEn,
      projectNameAr: projects.nameAr,
      createdAt: projects.createdAt,
      threadAt: threadEvents.at,
      dispatchAt: dispatchEvents.at,
    })
    .from(projects)
    .leftJoin(threadEvents, eq(threadEvents.projectId, projects.id))
    .leftJoin(dispatchEvents, eq(dispatchEvents.projectId, projects.id))
    .where(
      and(
        visibleProjectsFilter(session),
        isNull(projects.endState),
        sql`coalesce(
          greatest(${threadEvents.at}, ${dispatchEvents.at}),
          ${riyadhDay(projects.createdAt)}
        ) <= ${cutoff}`,
      ),
    );

  if (rows.length === 0) return [];

  const now = today();
  const companiesByProject = await buyerOrFirstCompany(
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
      anchorNameEn: row.projectNameEn,
      anchorNameAr: row.projectNameAr,
      companyId: company?.id ?? null,
      companyNameEn: company?.nameEn ?? null,
      companyNameAr: company?.nameAr ?? null,
      ownerNames: [],
      since,
      ageDays: calendarDaysBetween(since, now),
      inWorkingDays: false,
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
      companyNameEn: companies.nameEn,
      companyNameAr: companies.nameAr,
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
      anchorNameEn: row.companyNameEn,
      anchorNameAr: row.companyNameAr,
      companyId: row.companyId,
      companyNameEn: row.companyNameEn,
      companyNameAr: row.companyNameAr,
      ownerNames: [],
      since,
      ageDays: calendarDaysBetween(since, now),
      inWorkingDays: false,
      thresholdDays: row.qualifiedId
        ? thresholds.qualified
        : thresholds.unqualified,
    };
  });
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

/** The buyer if one is flagged `[12 §6]`, else the first live link by name. */
async function buyerOrFirstCompany(
  projectIds: string[],
): Promise<Map<string, { id: string; nameEn: string; nameAr: string | null }>> {
  if (projectIds.length === 0) return new Map();

  const rows = await db
    .select({
      projectId: projectCompanies.projectId,
      isBuyer: projectCompanies.isBuyer,
      id: companies.id,
      nameEn: companies.nameEn,
      nameAr: companies.nameAr,
    })
    .from(projectCompanies)
    .innerJoin(companies, eq(companies.id, projectCompanies.companyId))
    .where(
      and(
        inArray(projectCompanies.projectId, projectIds),
        isNull(projectCompanies.removedAt),
      ),
    )
    .orderBy(asc(companies.nameEn));

  const byProject = new Map<
    string,
    { id: string; nameEn: string; nameAr: string | null }
  >();
  for (const row of rows) {
    const existing = byProject.get(row.projectId);
    if (!existing || row.isBuyer) {
      byProject.set(row.projectId, {
        id: row.id,
        nameEn: row.nameEn,
        nameAr: row.nameAr,
      });
    }
  }
  return byProject;
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
    catalogueNoResponse(session, thresholds),
    projectStageUnchanged(session, thresholds),
    companyQuiet(session, thresholds),
  ]);

  const all = parts.flat();
  const companyIds = [
    ...new Set(all.map((row) => row.companyId).filter((id): id is string => !!id)),
  ];

  const [suppressed, repNames] = await Promise.all([
    suppressedCompanies(companyIds, thresholds),
    repNamesByCompany(companyIds),
  ]);

  return all
    .filter((row) => !(row.companyId && suppressed.has(row.companyId)))
    .map((row) => ({
      ...row,
      ownerNames: row.companyId ? (repNames.get(row.companyId) ?? []) : [],
    }))
    // Oldest first: a work queue is ordered by what has waited longest.
    .sort(
      (a, b) => a.since.localeCompare(b.since) || a.kind.localeCompare(b.kind),
    );
}

const EMPTY_COUNTS = (): Record<FollowUpKind, number> =>
  Object.fromEntries(FOLLOW_UP_KINDS.map((kind) => [kind, 0])) as Record<
    FollowUpKind,
    number
  >;

/**
 * Every open follow-up the caller may see, oldest first.
 *
 * `counts` is over the whole scope, not the page, so the kind filter can show
 * what it would reveal before it is applied.
 */
export async function followUps(
  session: AuthSession,
  options: FollowUpOptions = {},
): Promise<FollowUpResult> {
  const thresholds = await getFollowUpThresholds();
  const all = await gather(session, thresholds);

  const counts = EMPTY_COUNTS();
  for (const row of all) counts[row.kind] += 1;

  const filtered = all
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
