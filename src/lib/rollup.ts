/**
 * The Reports tab — `D42`'s monthly rollup, read over a period.
 *
 * **Eight readings under three questions**, the grouping the founder accepted
 * on the Overseer Surface drawings (`docs/archive/30-overseer-answers.md`):
 * the month (`D42`'s columns, `D44`'s losses), the pipeline (quoted and
 * silent, the coordinator's pile, `D43`'s per-rep conversion with `S142`'s
 * sitting time beside it), the customers (`S17`'s not-recorded bar, `S139`'s
 * coming back, `S140`'s real customers).
 *
 * **A block over EVENTS takes the period; a block that is a SNAPSHOT says
 * so.** Dispatched metres, losses, quotations raised, companies added and
 * buyers are events inside a window. *Quoted and nothing came back*, *with
 * the coordinator* and *how many real customers* are the state of things
 * right now or ever, and the screen prints that beside them rather than
 * letting a period chip imply a window that does not apply.
 *
 * **Every figure is a count or a sum of dispatches.** `S68` forbids summing
 * quotations — a deal quoted three times counts three times — so nothing here
 * adds a quotation's metres: silent quotations are counted, conversion is
 * counted in deals, and the metres beside a loss reason are the lost
 * projects' expected size `S29`, one per project `S48`.
 *
 * **Gated on `sees_all_reps` and read company-wide**, exactly as
 * `companyAchievementForPeriod` is `D37` `D38`: null for anybody else, so the
 * caller renders nothing `D53`. The Drizzle-built readers still compose the
 * visible-* filters — free, and the same shape as every other module — and
 * the raw SQL readers rely on the gate, which this comment states rather
 * than hides.
 *
 * **Nothing here is stored** `S108`. An empty reading returns null and the
 * block is absent `D70`, never a frame around a zero.
 */

import { and, asc, count, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  companies,
  leadSources,
  lossReasons,
  projects,
  quotationThreads,
  quotationVersions,
  users,
} from "@/db/schema";
import {
  visibleCompaniesFilter,
  visibleProjectsFilter,
  visibleQuotationThreadsFilter,
  type AuthSession,
} from "@/lib/authz";
import { SQM_SCALE, ZERO, fromScaled, toScaled } from "@/lib/decimal";
import { dispatchesInPeriod, submittedRequestsNow } from "@/lib/dispatches";
import { noResponseCutoff, silentIssuedThreads } from "@/lib/follow-ups";
import {
  listQuotationThreads,
  threadHasApprovedDispatch,
} from "@/lib/quotations";
import { riyadhDay, today } from "@/lib/reports";
import { getFollowUpThresholds } from "@/lib/settings";
import {
  currentPeriod,
  nextPeriodStart,
  previousPeriodStart,
} from "@/lib/targets";
import { calendarDaysBetween, riyadhDayOf } from "@/lib/working-days";

/* ------------------------------------------------------------------ *
 * The period — URL state `D20`, four windows, months in Riyadh
 * ------------------------------------------------------------------ */

export const ROLLUP_PERIODS = ["month", "last", "3m", "12m"] as const;
export type RollupPeriodKey = (typeof ROLLUP_PERIODS)[number];

export function isRollupPeriod(value: string | undefined): value is RollupPeriodKey {
  return (ROLLUP_PERIODS as readonly string[]).includes(value ?? "");
}

export type RollupPeriod = {
  key: RollupPeriodKey;
  /** First day of the window, `YYYY-MM-01`. */
  from: string;
  /** The exclusive end — the first day after the window. */
  to: string;
  /** The months inside the window, ascending. */
  months: string[];
  /** The months the column chart draws — the window, plus context for a
   *  one-month window so *against last month* has something to stand beside. */
  columns: string[];
};

/** How many columns a one-month window draws: the month and the three before
 *  it, which is what the approved drawing showed. */
const CONTEXT_COLUMNS = 4;

function monthsBack(period: string, count: number): string[] {
  const out = [period];
  let cursor = period;
  for (let step = 1; step < count; step += 1) {
    cursor = previousPeriodStart(cursor);
    out.unshift(cursor);
  }
  return out;
}

export function rollupPeriod(
  key: RollupPeriodKey,
  current: string = currentPeriod(),
): RollupPeriod {
  switch (key) {
    case "month":
      return {
        key,
        from: current,
        to: nextPeriodStart(current),
        months: [current],
        columns: monthsBack(current, CONTEXT_COLUMNS),
      };
    case "last": {
      const last = previousPeriodStart(current);
      return {
        key,
        from: last,
        to: current,
        months: [last],
        columns: monthsBack(last, CONTEXT_COLUMNS),
      };
    }
    case "3m": {
      const months = monthsBack(current, 3);
      return { key, from: months[0], to: nextPeriodStart(current), months, columns: months };
    }
    case "12m": {
      const months = monthsBack(current, 12);
      return { key, from: months[0], to: nextPeriodStart(current), months, columns: months };
    }
  }
}

/**
 * A timestamp inside the window, in Riyadh's clock. The two bound parameters
 * are cast outright — an untyped `sql` parameter arrives as `text` and dies
 * with `42883` — and the day is lifted to an instant in the sanctioned shape
 * (`CLAUDE.md`: `day::date::timestamp at time zone 'Asia/Riyadh'`).
 */
function withinWindow(column: AnyPgColumn, period: RollupPeriod): SQL {
  return sql`${column} >= ${period.from}::date::timestamp at time zone 'Asia/Riyadh'
    and ${column} < ${period.to}::date::timestamp at time zone 'Asia/Riyadh'`;
}

/* ------------------------------------------------------------------ *
 * The month
 * ------------------------------------------------------------------ */

export type MonthColumn = {
  /** `YYYY-MM-01`. */
  month: string;
  sqm: string;
  count: number;
  /** Inside the window, as opposed to context drawn beside it. */
  inPeriod: boolean;
};

/**
 * `D42` — approved-dispatch square metres by month, **the same derivation as
 * every target figure**: `dispatchesInPeriod` over the whole span, bucketed
 * by the dispatch date's month. Null when no column has a dispatch — a fresh
 * install draws nothing rather than a row of empty columns `D70`.
 */
async function monthColumns(period: RollupPeriod): Promise<MonthColumn[] | null> {
  const first = period.columns[0];
  const end = nextPeriodStart(period.columns[period.columns.length - 1]);
  const dispatched = await dispatchesInPeriod(first, end);

  const buckets = new Map(
    period.columns.map((month) => [month, { sqm: ZERO, count: 0 }]),
  );
  for (const dispatch of dispatched) {
    const bucket = buckets.get(`${dispatch.dispatchDate.slice(0, 7)}-01`);
    if (!bucket) continue;
    bucket.sqm += toScaled(dispatch.sqm, SQM_SCALE);
    bucket.count += 1;
  }

  const rows = period.columns.map((month) => {
    const bucket = buckets.get(month)!;
    return {
      month,
      sqm: fromScaled(bucket.sqm, SQM_SCALE),
      count: bucket.count,
      inPeriod: period.months.includes(month),
    };
  });
  return rows.some((row) => row.count > 0) ? rows : null;
}

export type LossRow = {
  reasonId: string;
  code: string;
  nameEn: string;
  nameAr: string;
  count: number;
  /** The lost projects' expected size `S29`, summed — never a quotation `S68`. */
  sqm: string;
};

export type Losses = {
  /** Ranked by count, then metres, then name `D44`. */
  rows: LossRow[];
  losses: number;
  /** Losses whose reason had already been logged as a signal `S44` `D44`. */
  withSignal: number;
  /** Mean days between the last such signal and the loss; null with none. */
  daysBefore: number | null;
};

/**
 * `S43` says signals and loss reasons are one vocabulary; the seeded codes
 * keep `25 §5`'s own wording, so the bridge from a loss reason to the signal
 * that would have warned of it is written once, here. Three reasons have no
 * signal at all — stock shortage and customer went quiet are not things a
 * customer says — and a loss under one of those can never count as warned.
 */
const SIGNAL_FOR_LOSS: Record<string, string> = {
  price_too_high: "price_too_high",
  lost_to_competitor: "competitor_cheaper",
  colour_or_product_unavailable: "colour_unavailable",
  delivery_time_too_long: "lead_time_too_long",
  specification_not_offered: "specification_unavailable",
  project_cancelled_or_postponed: "project_delayed",
  other: "other",
};

/**
 * `D44` — why we lose, ranked by **how often** a reason comes up, the square
 * metres lost to each printed beside it (the founder's answer 8: *one big
 * deal lost on price is bad luck; five lost on lead time is a problem*). A
 * lost project counts once `S48`, in the month it was marked lost.
 *
 * The second statement is the rule's last line: how many of those losses had
 * the same reason logged as a signal beforehand `S44`, and how long before.
 * A signal counts when it sits on a report against the project itself or
 * against one of its participating companies, dated before the loss day.
 * Written out in SQL with both tables named, the correlated shape
 * `CLAUDE.md` records three silent failures of.
 */
async function lossesByReason(
  session: AuthSession,
  period: RollupPeriod,
): Promise<Losses | null> {
  const sqmLost = sql<string>`coalesce(sum(${projects.sqmExpected}), 0)::numeric(14, 4)`;
  const rows = await db
    .select({
      reasonId: lossReasons.id,
      code: lossReasons.code,
      nameEn: lossReasons.nameEn,
      nameAr: lossReasons.nameAr,
      count: count(),
      sqm: sqmLost,
    })
    .from(projects)
    .innerJoin(lossReasons, eq(lossReasons.id, projects.lostReasonId))
    .where(
      and(
        visibleProjectsFilter(session),
        eq(projects.endState, "lost"),
        withinWindow(projects.lostAt, period),
      ),
    )
    .groupBy(lossReasons.id, lossReasons.code, lossReasons.nameEn, lossReasons.nameAr)
    .orderBy(desc(count()), desc(sqmLost), asc(lossReasons.nameEn));

  if (rows.length === 0) return null;

  const bridge = sql.raw(
    `case lr.code ${Object.entries(SIGNAL_FOR_LOSS)
      .map(([code, signal]) => `when '${code}' then '${signal}'`)
      .join(" ")} else null end`,
  );

  const [signals] = (await db.execute(sql`
    select
      count(*)::int as losses,
      count(*) filter (where s.signal_day is not null)::int as with_signal,
      round(avg(s.lost_day - s.signal_day) filter (where s.signal_day is not null))::int
        as days_before
    from (
      select
        p.id,
        (p.lost_at at time zone 'Asia/Riyadh')::date as lost_day,
        (
          select max(r.report_date)
          from rep_reports r
          join rep_report_signals sg on sg.report_id = r.id
          where sg.signal::text = ${bridge}
            and r.report_date < (p.lost_at at time zone 'Asia/Riyadh')::date
            and (
              r.project_id = p.id
              or r.company_id in (
                select pc.company_id from project_companies pc where pc.project_id = p.id
              )
            )
        ) as signal_day
      from projects p
      join loss_reasons lr on lr.id = p.lost_reason_id
      where p.end_state = 'lost'
        and p.lost_at >= ${period.from}::date::timestamp at time zone 'Asia/Riyadh'
        and p.lost_at < ${period.to}::date::timestamp at time zone 'Asia/Riyadh'
    ) s
  `)) as unknown as {
    losses: number;
    with_signal: number;
    days_before: number | null;
  }[];

  return {
    rows: rows.map((row) => ({ ...row, count: Number(row.count) })),
    losses: Number(signals?.losses ?? 0),
    withSignal: Number(signals?.with_signal ?? 0),
    daysBefore: signals?.days_before == null ? null : Number(signals.days_before),
  };
}

/* ------------------------------------------------------------------ *
 * The pipeline
 * ------------------------------------------------------------------ */

export type QuotedSilent = {
  /** Live issued quotations nobody has answered — the ladder's own
   *  predicate, with no threshold `07 D5`. */
  silent: number;
  /** Of those, the ones the waiting list is already chasing `S89`. */
  pastThreshold: number;
  /** Every live issued quotation, silent or not — the denominator. */
  live: number;
};

/**
 * **A count of deals, never metres** (the founder's answer 5, `S68`).
 * `silentIssuedThreads` is the follow-up ladder's own query, read once with
 * no cutoff; the threshold split is the same Riyadh-day comparison the rung
 * makes, applied to the rows it returned, so the two readings cannot drift.
 */
async function quotedSilent(session: AuthSession): Promise<QuotedSilent> {
  const [silent, thresholds, live] = await Promise.all([
    silentIssuedThreads(session, null),
    getFollowUpThresholds(),
    db
      .select({ total: count() })
      .from(quotationThreads)
      .innerJoin(
        quotationVersions,
        and(
          eq(quotationVersions.threadId, quotationThreads.id),
          eq(quotationVersions.status, "issued"),
        ),
      )
      .innerJoin(companies, eq(companies.id, quotationThreads.companyId))
      .where(
        and(
          visibleQuotationThreadsFilter(session),
          isNull(quotationThreads.endState),
          isNull(companies.archivedAt),
          isNull(companies.mergedIntoId),
        ),
      ),
  ]);

  const cutoff = noResponseCutoff(thresholds);
  return {
    silent: silent.length,
    pastThreshold: silent.filter((row) => riyadhDayOf(row.issuedAt) <= cutoff)
      .length,
    live: live[0]?.total ?? 0,
  };
}

export type CoordinatorNow = {
  toIssue: number;
  requests: number;
  /** Square metres on the submitted requests — a sum of requests `S116`. */
  sqm: string;
  /** The oldest submitted request's own age `S87`, the one true wait `D40`. */
  oldestDays: number | null;
};

/** `D40`'s two piles as Stuck reads them, plus the metres they carry. */
async function coordinatorNow(session: AuthSession): Promise<CoordinatorNow> {
  const [issue, pile] = await Promise.all([
    listQuotationThreads(session, { awaitingIssue: true }),
    submittedRequestsNow(session),
  ]);
  return {
    toIssue: issue.total,
    requests: pile.count,
    sqm: pile.sqm,
    oldestDays: pile.oldestSubmittedAt
      ? calendarDaysBetween(riyadhDay(pile.oldestSubmittedAt), today())
      : null,
  };
}

export type ConversionRow = {
  userId: string;
  userName: string;
  /** Quotations raised in the period that were ever issued — a price was
   *  produced `S63`. */
  quoted: number;
  /** Of those, the ones an approved dispatch followed `S31`. */
  delivered: number;
  /** Quoted, undelivered, not ended. */
  open: number;
  /**
   * `S142`'s sitting time: days since each open quotation last moved (its
   * latest version), and this is the LOWER MEDIAN — at least half the open
   * ones have sat this long or longer. Null when nothing is open.
   */
  sittingDays: number | null;
};

/**
 * `D43` `S142` — quoted versus delivered per rep, in deals, with how long the
 * open ones have been sitting beside it. **Never combined into a score**:
 * two figures per row, and nothing here weights one by the other.
 *
 * The window is the quotation's raise; delivered is `S31`'s one predicate
 * (`threadHasApprovedDispatch`). A thread delivered without an issued
 * version cannot exist `S126`, so delivered is a subset of quoted by
 * construction. Both correlated subqueries name their tables outright.
 */
async function conversionByRep(
  session: AuthSession,
  period: RollupPeriod,
): Promise<ConversionRow[] | null> {
  const rows = await db
    .select({
      userId: users.id,
      userName: users.name,
      endState: quotationThreads.endState,
      quoted: sql<boolean>`exists (
        select 1 from quotation_versions v
        where v.thread_id = "quotation_threads"."id" and v.smac_reference is not null
      )`,
      delivered: threadHasApprovedDispatch(),
      movedAt: sql<Date>`(
        select max(v.created_at) from quotation_versions v
        where v.thread_id = "quotation_threads"."id"
      )`.mapWith(quotationThreads.createdAt),
    })
    .from(quotationThreads)
    .innerJoin(users, eq(users.id, quotationThreads.raisedByUserId))
    .where(
      and(
        visibleQuotationThreadsFilter(session),
        withinWindow(quotationThreads.createdAt, period),
      ),
    )
    .orderBy(asc(users.name), asc(quotationThreads.createdAt));

  const now = today();
  const byRep = new Map<
    string,
    { userName: string; quoted: number; delivered: number; sitting: number[] }
  >();
  for (const row of rows) {
    if (!row.quoted) continue;
    const bucket = byRep.get(row.userId) ?? {
      userName: row.userName,
      quoted: 0,
      delivered: 0,
      sitting: [],
    };
    bucket.quoted += 1;
    if (row.delivered) bucket.delivered += 1;
    else if (row.endState === null) {
      bucket.sitting.push(calendarDaysBetween(riyadhDay(row.movedAt), now));
    }
    byRep.set(row.userId, bucket);
  }
  if (byRep.size === 0) return null;

  return [...byRep.entries()].map(([userId, bucket]) => {
    const sitting = [...bucket.sitting].sort((a, b) => a - b);
    return {
      userId,
      userName: bucket.userName,
      quoted: bucket.quoted,
      delivered: bucket.delivered,
      open: sitting.length,
      sittingDays:
        sitting.length === 0 ? null : sitting[Math.floor((sitting.length - 1) / 2)],
    };
  });
}

/* ------------------------------------------------------------------ *
 * The customers
 * ------------------------------------------------------------------ */

export type SourceRow = {
  /** Null is `S17`'s *not recorded* — its own bar until the blanks age out. */
  id: string | null;
  nameEn: string | null;
  nameAr: string | null;
  count: number;
};

export type Sources = { rows: SourceRow[]; total: number };

/** `S17` — companies added in the window, by lead source, ranked by count.
 *  The blank is a row like any other, never hidden: it is the finding. */
async function companiesBySource(
  session: AuthSession,
  period: RollupPeriod,
): Promise<Sources | null> {
  const rows = await db
    .select({
      id: leadSources.id,
      nameEn: leadSources.nameEn,
      nameAr: leadSources.nameAr,
      count: count(),
    })
    .from(companies)
    .leftJoin(leadSources, eq(leadSources.id, companies.leadSourceId))
    .where(
      and(
        visibleCompaniesFilter(session),
        isNull(companies.mergedIntoId),
        withinWindow(companies.createdAt, period),
      ),
    )
    .groupBy(leadSources.id, leadSources.nameEn, leadSources.nameAr)
    .orderBy(desc(count()), asc(leadSources.nameEn));

  if (rows.length === 0) return null;
  const counted = rows.map((row) => ({ ...row, count: Number(row.count) }));
  return {
    rows: counted,
    total: counted.reduce((sum, row) => sum + row.count, 0),
  };
}

export type ReturningRow = {
  /** Null — the company has no live primary rep today. */
  userId: string | null;
  userName: string | null;
  /** Companies that took an approved dispatch in the window. */
  buyers: number;
  /** Of those, the ones whose approved dispatches span more than one project
   *  `S139` — bought again on NEW work, ever. */
  returned: number;
};

export type Returning = { rows: ReturningRow[]; buyers: number; returned: number };

/**
 * `S139` — which customers come back. A buyer in the window whose approved
 * dispatches, over all time, span more than one project has bought again on
 * new work; a second delivery on the same job is one deal finishing. Grouped
 * by the company's primary rep today `S18` — the relationship's holder, not
 * the rep on the dispatch — and a company with no live holder is counted in
 * the totals under its own row. Raw SQL, every table named, gated above.
 */
async function comingBack(period: RollupPeriod): Promise<Returning | null> {
  const rows = (await db.execute(sql`
    with buyers as (
      select distinct d.company_id
      from dispatches d
      join companies c on c.id = d.company_id
      where d.status = 'approved'
        and d.dispatch_date >= ${period.from}::date
        and d.dispatch_date < ${period.to}::date
        and c.merged_into_id is null
    ),
    spans as (
      select d.company_id, count(distinct d.project_id)::int as projects
      from dispatches d
      where d.status = 'approved' and d.project_id is not null
      group by d.company_id
    )
    select
      u.id::text as user_id,
      u.name as user_name,
      count(*)::int as buyers,
      count(*) filter (where coalesce(s.projects, 0) > 1)::int as returned
    from buyers b
    left join spans s on s.company_id = b.company_id
    left join company_reps cr
      on cr.company_id = b.company_id and cr.is_primary and cr.removed_at is null
    left join users u on u.id = cr.user_id
    group by u.id, u.name
    order by u.name nulls last
  `)) as unknown as {
    user_id: string | null;
    user_name: string | null;
    buyers: number;
    returned: number;
  }[];

  if (rows.length === 0) return null;
  const mapped = rows.map((row) => ({
    userId: row.user_id,
    userName: row.user_name,
    buyers: Number(row.buyers),
    returned: Number(row.returned),
  }));
  return {
    rows: mapped,
    buyers: mapped.reduce((sum, row) => sum + row.buyers, 0),
    returned: mapped.reduce((sum, row) => sum + row.returned, 0),
  };
}

export type RealCustomers = { real: number; companies: number };

/** `S140` — bought at least once, ever, of every company that is not a merge
 *  tombstone. Not narrowed to a window without the founder re-deciding. */
async function realCustomers(): Promise<RealCustomers | null> {
  const [row] = (await db.execute(sql`
    select
      (
        select count(distinct d.company_id)
        from dispatches d
        join companies c on c.id = d.company_id
        where d.status = 'approved' and c.merged_into_id is null
      )::int as real,
      (select count(*) from companies c where c.merged_into_id is null)::int
        as companies
  `)) as unknown as { real: number; companies: number }[];

  const companiesHeld = Number(row?.companies ?? 0);
  if (companiesHeld === 0) return null;
  return { real: Number(row?.real ?? 0), companies: companiesHeld };
}

/* ------------------------------------------------------------------ *
 * The tab
 * ------------------------------------------------------------------ */

export type Rollup = {
  period: RollupPeriod;
  months: MonthColumn[] | null;
  losses: Losses | null;
  quoted: QuotedSilent;
  coordinator: CoordinatorNow;
  conversion: ConversionRow[] | null;
  sources: Sources | null;
  returning: Returning | null;
  real: RealCustomers | null;
};

/**
 * The whole tab in one call — eight readings, fetched together. Null for
 * anybody without `sees_all_reps`, so the caller renders nothing `D53`; a
 * null block inside is absent `D70`, and the two snapshot readings that are
 * never null (quoted, coordinator) print zero as a measured answer.
 */
export async function rollupFor(
  session: AuthSession,
  period: RollupPeriod,
): Promise<Rollup | null> {
  if (!session.user.role.seesAllReps) return null;

  const [months, losses, quoted, coordinator, conversion, sources, returning, real] =
    await Promise.all([
      monthColumns(period),
      lossesByReason(session, period),
      quotedSilent(session),
      coordinatorNow(session),
      conversionByRep(session, period),
      companiesBySource(session, period),
      comingBack(period),
      realCustomers(),
    ]);

  return { period, months, losses, quoted, coordinator, conversion, sources, returning, real };
}
