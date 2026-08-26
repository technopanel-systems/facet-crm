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

import { and, asc, count, eq, exists, gte, ilike, inArray, isNull, sql } from "drizzle-orm";
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
import { ON_HOLD_OUTCOME } from "@/lib/enums";
import { today } from "@/lib/reports";
import { getQuietThresholds, type QuietThresholds } from "@/lib/settings";

const PAGE_SIZE = 25;

/** Dialect-less builder for correlated subqueries, as in `authz.ts`. */
const subquery = new QueryBuilder();

/* ------------------------------------------------------------------ *
 * The silence derivation — one definition, joined on `D25` `D26`
 * ------------------------------------------------------------------ */

/**
 * **How long a company has been silent, as one joinable subquery.**
 *
 * This exists because the derivation was written twice and the two copies had
 * already drifted. `coverage()` read *never logged* as **quiet immediately**;
 * `companyQuiet()` in `follow-ups.ts` reads it as **quiet once the threshold has
 * passed since registration** — while both carried the same sentence in prose:
 * *"a company never logged against ... is exactly the one that needs the
 * conversation."* A company a rep registered this morning therefore wore a red
 * *Quiet* badge on `/performance` and was absent from that same rep's waiting
 * list, on the same afternoon.
 *
 * **`follow-ups.ts`'s reading is the one adopted**, so the clock runs from
 * registration for a company nobody has logged against. It is the defensible
 * half — a company registered today is not neglected — and it is the half that
 * already feeds the digest, so adopting the other would have changed what
 * lands in every rep's notifications.
 *
 * **`companyQuiet()` still holds a third copy** and is not touched here: it
 * feeds the waiting list and the daily digest, where a silent mistake reaches
 * every rep, so it converges in its own slice behind `verify:followups`
 * (`WORKFLOW §5`).
 *
 * ## Why a joined subquery, and what the rendered SQL actually does
 *
 * `quietSince` needs `companies.created_at`, which `cities` and
 * `company_categories` also have — so a caller joining a lookup is exactly
 * where a dropped table qualifier would bite (`CLAUDE.md`). **The rendered SQL
 * was read rather than assumed**, and two things hold:
 *
 *  - Built from `db` (which carries the dialect) rather than the dialect-less
 *    `QueryBuilder` the correlated helpers use, `${companies.createdAt}` renders
 *    **qualified** — `"companies"."created_at"`. The trap `follow-ups.ts`
 *    documents is narrower than "any `sql` template".
 *  - Every **subquery** column renders **bare** in the outer statement:
 *    `"silence_days"`, not `"silence"."silence_days"`.
 *
 * The second is why every alias here is prefixed `silence_`: bare is safe only
 * while it is unique across the whole statement, and unique is something this
 * function can guarantee where its callers cannot. Resolving the derivation
 * inside a subquery is then what lets a caller **order by attention before
 * paginating**, which is what `D25` needs and `CLAUDE.md` requires.
 */
export function companySilence(thresholds: QuietThresholds) {
  /** **Interactions only:** a field note is anchored to nobody `[20 §2]` and
   *  cannot be evidence that a customer was contacted. */
  const lastInteraction = db
    .select({
      companyId: repReports.companyId,
      at: sql<string | null>`max(${repReports.reportDate})`.as(
        "silence_last_interaction",
      ),
    })
    .from(repReports)
    .where(eq(repReports.entryType, "interaction"))
    .groupBy(repReports.companyId)
    .as("silence_last_interaction_by_company");

  /** Derived from a real quotation thread `[10 §1]`, never from an outcome
   *  `[20 §3]` — and never `end_state`, because an accepted thread is internal
   *  approval, not a won deal `[16 §5]`. */
  const qualified = db
    .selectDistinct({
      companyId: sql<string>`${quotationThreads.companyId}`.as(
        "silence_qualified_company",
      ),
    })
    .from(quotationThreads)
    .as("silence_qualified");

  /** `20 §5` — suppressed until this date, and not chased meanwhile. The same
   *  terms `onHoldByCompany` uses in `reports.ts`, in SQL so the ordering can
   *  see them: an on-hold company must not sort to the top of a list as though
   *  it were neglected. */
  const onHold = db
    .select({
      companyId: repReports.companyId,
      until: sql<string | null>`max(${repReports.onHoldUntil})`.as(
        "silence_on_hold",
      ),
    })
    .from(repReports)
    .where(
      and(
        eq(repReports.outcome, ON_HOLD_OUTCOME),
        gte(repReports.onHoldUntil, today()),
      ),
    )
    .groupBy(repReports.companyId)
    .as("silence_on_hold_by_company");

  return db
    .select({
      companyId: sql<string>`${companies.id}`.as("silence_company_id"),
      /** Null = never logged against. Kept **separate from `quietSince`**:
       *  "Never" and "today" must not read the same, so the figure a screen
       *  shows is never coerced to zero. */
      lastInteractionAt: sql<string | null>`${lastInteraction.at}`.as(
        "silence_last_interaction_at",
      ),
      onHoldUntil: sql<string | null>`${onHold.until}`.as(
        "silence_on_hold_until",
      ),
      isQualified: sql<boolean>`${qualified.companyId} is not null`.as(
        "silence_is_qualified",
      ),
      /** The day the clock started — the last interaction, else registration. */
      quietSince: sql<string>`coalesce(
        ${lastInteraction.at},
        (${companies.createdAt} at time zone 'Asia/Riyadh')::date
      )`.as("silence_quiet_since"),
      /** Qualification picks it `07 D5`, and it is read at query time so a
       *  manager can change it without a deploy `[20 §11]`. */
      /** **The casts are load-bearing.** A value interpolated into a `sql`
       *  template becomes a bound parameter, which Postgres types as `text`
       *  unless told otherwise — so the comparison below reads
       *  `integer > text` and the whole query fails with `42883`. This is the
       *  untyped-parameter half of the trap `CLAUDE.md` records beside the
       *  qualifier one. */
      thresholdDays: sql<number>`case
        when ${qualified.companyId} is not null then ${thresholds.qualified}::int
        else ${thresholds.unqualified}::int
      end`.as("silence_threshold_days"),
      /** Whole calendar days of silence — `D34`'s unit, and `daysBetween`'s
       *  arithmetic done in Postgres so it can be ordered on. */
      silentDays: sql<number>`current_date - coalesce(
        ${lastInteraction.at},
        (${companies.createdAt} at time zone 'Asia/Riyadh')::date
      )`.as("silence_days"),
      /** **On hold is never quiet** `[20 §5]` — the clock is deliberately
       *  suppressed, so the row is calm however long it has been. */
      isQuiet: sql<boolean>`(
        ${onHold.until} is null
        and current_date - coalesce(
          ${lastInteraction.at},
          (${companies.createdAt} at time zone 'Asia/Riyadh')::date
        ) > case
          when ${qualified.companyId} is not null then ${thresholds.qualified}::int
          else ${thresholds.unqualified}::int
        end
      )`.as("silence_is_quiet"),
    })
    .from(companies)
    .leftJoin(lastInteraction, eq(lastInteraction.companyId, companies.id))
    .leftJoin(qualified, eq(qualified.companyId, companies.id))
    .leftJoin(onHold, eq(onHold.companyId, companies.id))
    .as("silence");
}

export type CoverageRow = {
  companyId: string;
  companyName: string;
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
  return ilike(companies.name, `%${trimmed}%`);
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
  const silence = companySilence(thresholds);

  // Scope, not gate `[20 §7]`. `and(undefined, x)` is `x`, so an identity that
  // sees every company degrades correctly to "every company".
  //
  // **`quietOnly` is in here now**, which is the fix `22 §6.5` asked for and
  // `coverage-table.tsx` recorded: it used to filter the decorated rows *after*
  // `.limit()`, so a caller asking for quiet companies got the quiet ones among
  // the alphabetically first 25 rather than the first 25 quiet ones. A derived
  // condition is resolved in SQL before pagination (`CLAUDE.md`) — and `total`
  // below shares this WHERE, so the count agrees with the page for the first
  // time.
  const where = and(
    visibleCompaniesFilter(session),
    searchFilter(options.q),
    repFilter(options.userId),
    // An archived company is out of scope by its own lifecycle `[07 E6]` and a
    // merged one is a tombstone `[07 B5]`; chasing either is not a diagnostic.
    isNull(companies.archivedAt),
    isNull(companies.mergedIntoId),
    options.quietOnly ? eq(silence.isQuiet, true) : undefined,
  );

  const rows = await db
    .select({
      companyId: companies.id,
      companyName: companies.name,
      lastInteractionOn: silence.lastInteractionAt,
      onHoldUntil: silence.onHoldUntil,
      isQualified: silence.isQualified,
      thresholdDays: silence.thresholdDays,
      isQuiet: silence.isQuiet,
    })
    .from(companies)
    .innerJoin(silence, eq(silence.companyId, companies.id))
    .where(where)
    .orderBy(asc(companies.name))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  // Same WHERE and the same join, so the count can never disagree with the page.
  const [totals] = await db
    .select({ total: count() })
    .from(companies)
    .innerJoin(silence, eq(silence.companyId, companies.id))
    .where(where);

  const reps = await repNamesByCompany(rows.map((row) => row.companyId));

  const now = today();
  return {
    rows: rows.map((row) => ({
      ...row,
      repNames: reps.get(row.companyId) ?? [],
      // **Days since the last INTERACTION**, which is not the clock: `quietSince`
      // falls back to registration and this does not. Null when there has never
      // been one, because "Never" and "today" must not read the same.
      daysSince: row.lastInteractionOn
        ? daysBetween(row.lastInteractionOn, now)
        : null,
    })),
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
