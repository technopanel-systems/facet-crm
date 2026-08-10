/**
 * Coverage `[20 §7]` — which companies have gone quiet.
 *
 * **Compliance is coverage, not submission.** There is no daily report to hand
 * in and therefore none to miss: this screen answers *"which of this rep's
 * companies have gone quiet"*, never *"who submitted yesterday"*. That
 * **supersedes `07 D6`'s submission model and its two-day grace**, both of
 * which presuppose a thing to hand in.
 *
 * **Consequence worth stating, because it removes work:** nothing is
 * submitted, so nothing is late, and **no working-day arithmetic exists
 * anywhere in this phase.** `01 §11` predicted report timeliness would need it.
 * Timeliness is gone. Friday and Saturday remain off for everyone `[07 D6]`,
 * which no longer changes any calculation here.
 *
 * **Scoped, never gated.** A rep sees coverage for their own companies;
 * `sees_all_reps` sees everyone's. The founder's reasoning, adopted as the
 * rule: the rep is the person who can act on a quiet company, and showing them
 * the same screen the manager sees is the clearest answer to what they get back
 * for logging. A diagnostic only the supervisor can see is a scoreboard; one
 * both can see is a work queue. The predicate is `visibleCompaniesFilter`,
 * already in `authz` — this module writes none of its own. The by-rep filter
 * below only ever NARROWS that scope; it cannot widen it.
 *
 * **Qualification is derived from a real quotation thread** `[10 §1]`, never
 * from an outcome `[20 §3]`. That is what picks the threshold.
 *
 * **The thresholds are `settings` rows** `[20 §11]`, `[07 D5]`, read at query
 * time so a manager can change them without a deploy.
 *
 * Diagnostic only. Nothing is written and nothing is penalised `[07 D6]`.
 */

import { and, asc, count, eq, exists, ilike, inArray, isNull, sql } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  companies,
  companyReps,
  quotationThreads,
  repReports,
  users,
} from "@/db/schema";
import { visibleCompaniesFilter, type AuthSession } from "@/lib/authz";
import { onHoldByCompany, today } from "@/lib/reports";
import { getQuietThresholds } from "@/lib/settings";

const PAGE_SIZE = 25;

/** Dialect-less builder for correlated subqueries, as in `authz.ts`. */
const subquery = new QueryBuilder();

export type CoverageRow = {
  companyId: string;
  companyNameEn: string;
  companyNameAr: string | null;
  /** Every live rep on the company, so a manager can see whose it is. */
  repNames: string[];
  /** Null = never logged against. */
  lastInteractionOn: string | null;
  /** Null when there has never been an interaction. "Never" and "today" must
   *  not read the same, so this is never coerced to zero. */
  daysSince: number | null;
  /** Derived from a real quotation thread `[10 §1]`. */
  isQualified: boolean;
  /** The threshold that applies to this company, in days. */
  thresholdDays: number;
  /** `20 §5` — suppressed until this date, and not chased meanwhile. */
  onHoldUntil: string | null;
  isQuiet: boolean;
};

export type CoverageOptions = {
  q?: string;
  userId?: string;
  quietOnly?: boolean;
  page?: number;
};

export type CoverageResult = {
  rows: CoverageRow[];
  total: number;
  page: number;
  thresholds: { qualified: number; unqualified: number };
};

function searchFilter(query: string | undefined) {
  const trimmed = query?.trim();
  if (!trimmed) return undefined;
  return ilike(companies.nameEn, `%${trimmed}%`);
}

/**
 * Companies this rep is a live member of.
 *
 * A NARROWING term, not a visibility one: it is `and`-ed after
 * `visibleCompaniesFilter`, so it can only remove rows the caller could already
 * see. That is why it lives here and not in `authz`.
 */
function repFilter(userId: string | undefined) {
  if (!userId) return undefined;
  return exists(
    subquery
      .select({ one: sql`1` })
      .from(companyReps)
      .where(
        and(
          eq(companyReps.companyId, companies.id),
          eq(companyReps.userId, userId),
          isNull(companyReps.removedAt),
        ),
      ),
  );
}

export async function coverage(
  session: AuthSession,
  options: CoverageOptions = {},
): Promise<CoverageResult> {
  const page = Math.max(1, options.page ?? 1);
  const thresholds = await getQuietThresholds();

  // Scope, not gate `[20 §7]`. `and(undefined, x)` is `x`, so an identity that
  // sees every company degrades correctly to "every company".
  const where = and(
    visibleCompaniesFilter(session),
    searchFilter(options.q),
    repFilter(options.userId),
    // An archived company is out of scope by its own lifecycle `[07 E6]` and a
    // merged one is a tombstone `[07 B5]`; chasing either is not a diagnostic.
    isNull(companies.archivedAt),
    isNull(companies.mergedIntoId),
  );

  const rows = await db
    .select({
      companyId: companies.id,
      companyNameEn: companies.nameEn,
      companyNameAr: companies.nameAr,
    })
    .from(companies)
    .where(where)
    .orderBy(asc(companies.nameEn))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  // Same WHERE, so the count can never disagree with the page.
  const [totals] = await db
    .select({ total: count() })
    .from(companies)
    .where(where);

  const companyIds = rows.map((row) => row.companyId);
  const [onHold, reps, lastInteraction, qualified] = await Promise.all([
    onHoldByCompany(companyIds),
    repNamesByCompany(companyIds),
    lastInteractionByCompany(companyIds),
    qualifiedCompanies(companyIds),
  ]);

  const now = today();
  const decorated: CoverageRow[] = rows.map((row) => {
    const isQualified = qualified.has(row.companyId);
    const lastInteractionOn = lastInteraction.get(row.companyId) ?? null;
    const thresholdDays = isQualified
      ? thresholds.qualified
      : thresholds.unqualified;
    const daysSince = lastInteractionOn
      ? daysBetween(lastInteractionOn, now)
      : null;
    const held = onHold.get(row.companyId) ?? null;
    return {
      ...row,
      repNames: reps.get(row.companyId) ?? [],
      lastInteractionOn,
      isQualified,
      daysSince,
      thresholdDays,
      onHoldUntil: held,
      // A company never logged against counts as quiet: it is exactly the one
      // that needs the conversation. A company on hold never does `[20 §5]`.
      isQuiet:
        held === null && (daysSince === null || daysSince > thresholdDays),
    };
  });

  return {
    rows: options.quietOnly ? decorated.filter((row) => row.isQuiet) : decorated,
    total: totals?.total ?? 0,
    page,
    thresholds,
  };
}

/** Whole days between two `YYYY-MM-DD` calendar days. Both are Riyadh days, so
 *  no timezone enters: parse as UTC and subtract. */
export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

/**
 * The most recent interaction per company.
 *
 * **Interactions only:** a field note is anchored to nobody `[20 §2]` and
 * cannot be evidence that a customer was contacted.
 *
 * A grouped query over the page's ids rather than a correlated subquery in the
 * SELECT — the first attempt used one and it silently returned null for every
 * row, which `verify:phase9` caught by making a company that had been logged
 * against look quiet. Two plain queries that can be read are worth more than
 * one clever one that cannot.
 */
async function lastInteractionByCompany(
  companyIds: string[],
): Promise<Map<string, string>> {
  if (companyIds.length === 0) return new Map();

  const rows = await db
    .select({
      companyId: repReports.companyId,
      last: sql<string>`max(${repReports.reportDate})`,
    })
    .from(repReports)
    .where(
      and(
        inArray(repReports.companyId, companyIds),
        eq(repReports.entryType, "interaction"),
      ),
    )
    .groupBy(repReports.companyId);

  return new Map(
    rows
      .filter((row): row is { companyId: string; last: string } =>
        Boolean(row.companyId),
      )
      .map((row) => [row.companyId, row.last]),
  );
}

/**
 * Which of these companies are qualified — **derived from a real quotation
 * thread** `[10 §1]`, never from an outcome `[20 §3]`.
 *
 * Note what it does NOT read: `end_state`. An accepted thread is internal
 * approval, not a won deal `[16 §5]`, and qualification is about having asked
 * for a price at all.
 */
async function qualifiedCompanies(
  companyIds: string[],
): Promise<Set<string>> {
  if (companyIds.length === 0) return new Set();

  const rows = await db
    .selectDistinct({ companyId: quotationThreads.companyId })
    .from(quotationThreads)
    .where(inArray(quotationThreads.companyId, companyIds));

  return new Set(rows.map((row) => row.companyId));
}

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

/**
 * The reps a coverage screen may offer as a filter.
 *
 * `visibleMeasuredUsersFilter` would be the wrong predicate: that answers
 * "whose numbers may I read", and this is a narrowing convenience over
 * companies the caller can already see. A rep gets only their own name, which
 * makes the control pointless, so the screen renders it only when there is more
 * than one entry.
 */
export async function coverageRepOptions(
  session: AuthSession,
): Promise<{ id: string; name: string }[]> {
  if (!session.user.role.seesAllReps) {
    return [{ id: session.user.id, name: session.user.name }];
  }
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.isActive, true))
    .orderBy(asc(users.name));
}
