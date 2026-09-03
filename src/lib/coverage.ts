/**
 * **Silence — how long since anyone talked to a customer.** One derivation, and
 * the turn on one company built from it.
 *
 * **There is no coverage screen any more, and that is `S88`**: *there is no
 * separate coverage screen and no separate activity screen.* `SPEC §12` says
 * the waiting list *replaces coverage, the follow-up queue, the notification
 * bell and the dashboard*, and `D49` puts Coverage with Reports and Follow-ups
 * as the waiting list, filtered. Session `28b` deleted `/performance`, which
 * had been its last host, along with `coverage()`, `coverageRepOptions()` and
 * `CoverageTable`. **The capability did not go with them**: `/companies` lists
 * every company with its meter, grouped quiet-first `D25`, and carries the Log
 * action per row; `/follow-ups` lists the overdue half with the reps on each.
 * The file keeps its name because `companySilence` is what every one of them
 * joins.
 *
 * **Compliance is coverage, not submission.** There is no daily report to hand
 * in and therefore none to miss: the question is *"which of this rep's
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
 * **Scoped, never gated.** A rep sees their own companies; `sees_all_reps` sees
 * everyone's. The founder's reasoning, adopted as the rule: the rep is the
 * person who can act on a quiet company, and showing them the same screen the
 * manager sees is the clearest answer to what they get back for logging. A
 * diagnostic only the supervisor can see is a scoreboard; one both can see is a
 * work queue. The predicate is `visibleCompaniesFilter`, already in `authz` —
 * this module writes none of its own.
 *
 * **Qualification is derived from a real quotation thread** `[10 §1]`, never
 * from an outcome `[20 §3]`. That is what picks the threshold.
 *
 * **The thresholds are `settings` rows** `[20 §11]`, `[07 D5]`, read at query
 * time so a manager can change them without a deploy.
 *
 * Diagnostic only. Nothing is written and nothing is penalised `[07 D6]`.
 */
import {
  and,
  asc,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import {
  companies,
  companyReps,
  quotationThreads,
  repReports,
  roles,
  users,
} from "@/db/schema";
import {
  companyBookHolderFilter,
  visibleCompaniesFilter,
  visibleMeasuredUsersFilter,
  type AuthSession,
} from "@/lib/authz";
import { ON_HOLD_OUTCOME } from "@/lib/enums";
import { today } from "@/lib/reports";
import { getQuietThresholds, type QuietThresholds } from "@/lib/settings";

/* ------------------------------------------------------------------ *
 * The silence derivation — one definition, joined on `D25` `D26`
 * ------------------------------------------------------------------ */

/**
 * **How long a company has been silent, as one joinable subquery.**
 *
 * This exists because the derivation was written twice and the two copies had
 * already drifted. The deleted `coverage()` read *never logged* as **quiet
 * immediately**; `companyQuiet()` in `follow-ups.ts` reads it as **quiet once
 * the threshold has passed since registration** — while both carried the same
 * sentence in prose: *"a company never logged against ... is exactly the one
 * that needs the conversation."* A company a rep registered this morning therefore wore a red
 * *Quiet* badge on the coverage table and was absent from that same rep's
 * waiting list, on the same afternoon.
 *
 * **`follow-ups.ts`'s reading is the one adopted**, so the clock runs from
 * registration for a company nobody has logged against. It is the defensible
 * half — a company registered today is not neglected — and it is the half that
 * already feeds the digest, so adopting the other would have changed what
 * lands in every rep's notifications.
 *
 * **`companyQuiet()` converged in session 48**: it joins this subquery and
 * filters on `isQuiet`, so the queue, the coverage figures and `/companies`
 * read ONE derivation — the third copy is gone, behind `verify:followups`.
 *
 * ## Why a joined subquery, and what the rendered SQL actually does
 *
 * `quietSince` needs `companies.created_at`, which `cities` and
 * `company_categories` also have — so a caller joining a lookup, which
 * `listCompanies` does, is exactly where a dropped table qualifier would bite (`CLAUDE.md`). **The rendered SQL
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
      /** Whole calendar days of silence — `D34`'s unit, done in Postgres so
       *  it can be ordered on. **This is the only implementation.** A
       *  `daysBetween` helper duplicated it in TypeScript until `28b`: it lost
       *  its last production caller with `coverage()` and stayed alive only
       *  because a verify assertion tested it, which is a function kept by its
       *  own test.
       *
       *  **Today is Riyadh's day, never `current_date`** — that reads the
       *  server's UTC day, one behind Riyadh between midnight and 03:00, so
       *  every silence figure read a day low for the first three hours of
       *  every day and a threshold crossing arrived three hours late. Both
       *  sides of the subtraction name the same calendar now. `S46-1`. */
      silentDays: sql<number>`(now() at time zone 'Asia/Riyadh')::date - coalesce(
        ${lastInteraction.at},
        (${companies.createdAt} at time zone 'Asia/Riyadh')::date
      )`.as("silence_days"),
      /** **On hold is never quiet** `[20 §5]` — the clock is deliberately
       *  suppressed, so the row is calm however long it has been.
       *
       *  **Neither is an archived company or a merge tombstone** — added
       *  session 53, closing `WORKFLOW §5`'s *archived companies stay inside
       *  the silence figures*. `archiveCompany` sets `archived_at` and leaves
       *  the `company_reps` rows live, so before this term `quietCountsByRep`
       *  would have counted a customer somebody archived as *quiet* from the
       *  day it crossed its threshold (latent — 0 archived in the seed, and
       *  the pilot's first archive would have made it real). The term lives
       *  HERE, in the one derivation, rather than at every reader: `companyTurn`
       *  already forced `isQuiet` false for these and `neverContactedByRep`
       *  already excluded them, so this is the subquery catching up with its
       *  own readers, and `/companies`' meter, its quiet-first order, the rep's
       *  queue and `D39`'s column now all say the same thing about an
       *  archived customer: nobody owes it a call. `silentDays` still runs,
       *  so the meter on an archived company's own page keeps its figure. */
      isQuiet: sql<boolean>`(
        ${onHold.until} is null
        and ${companies.archivedAt} is null
        and ${companies.mergedIntoId} is null
        and (now() at time zone 'Asia/Riyadh')::date - coalesce(
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

/* ------------------------------------------------------------------ *
 * Quiet, per rep — `D39`'s fifth column
 * ------------------------------------------------------------------ */

/**
 * How many of each rep's companies are quiet — **one grouped query, never one
 * per rep**.
 *
 * `D39`'s team table needs this figure for every row at once, and the honest
 * way to get it is to group the derivation that already exists rather than to
 * ask it N times. `companySilence` takes no session precisely so it can be
 * joined like this; `listCompanies` joins the same subquery for `/companies`'
 * own quiet count, so the two screens cannot disagree about what quiet means.
 *
 * **Its `where` is `listCompanies`' own terms minus the visibility filter**, so
 * a rep reading `/companies` and a manager reading that rep's row are counting
 * the same set. Nothing about archived or merged companies is added here for
 * the same reason: `listCompanies` does not exclude them, and a second opinion
 * about the scope is how two numbers describing one thing start to differ.
 * **Since session 53 an archived company is never `isQuiet`** — the term sits
 * inside `companySilence` itself, so this count, `/companies`' quiet group and
 * the company's own turn panel drop it together (`WORKFLOW §5`, closed).
 *
 * **`follow-ups.ts`'s `companyQuiet` is deliberately NOT the reader.** It is
 * the third copy of this derivation and `WORKFLOW §5` records that it has
 * already drifted from this one once — 100 companies against 36 on one rep. A
 * manager-facing figure does not come off the copy known to disagree.
 *
 * **No session, and the roster is the gate.** The same contract
 * `dispatchesInPeriod` documents: this function answers about whoever it is
 * asked about, and its one caller has already run `visibleMeasuredUsersFilter`
 * to decide who that may be. A visibility filter here would be a second answer
 * to a question `authz` has already answered.
 *
 * **Membership, not visibility** — live `company_reps` rows. That is
 * `FollowUpRow.owners`' own reading, *every live rep who could act on it*, so
 * a company shared TO somebody counts on its owner's row and not on the
 * recipient's, and a company with two reps counts on **both**. The columns of
 * `D39`'s table therefore do not sum to a company total, which is consistent
 * with that rule forbidding a total rather than a defect in this count.
 */
export async function quietCountsByRep(
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();

  const thresholds = await getQuietThresholds();
  const silence = companySilence(thresholds);

  const rows = await db
    .select({
      userId: companyReps.userId,
      // `${silence.isQuiet}` renders bare as `"silence_is_quiet"`, which is
      // safe because every alias in that subquery is prefixed — see the note
      // on `companySilence`. No cast: it is already boolean, not a bound
      // parameter.
      quiet: sql<number>`count(*) filter (where ${silence.isQuiet})`,
    })
    .from(companyReps)
    .innerJoin(companies, eq(companies.id, companyReps.companyId))
    .innerJoin(silence, eq(silence.companyId, companies.id))
    .where(
      and(
        isNull(companyReps.removedAt),
        inArray(companyReps.userId, userIds),
      ),
    )
    .groupBy(companyReps.userId);

  // `count()` comes back as a string from the driver, exactly as
  // `listCompanies` treats its own. A rep with no companies has no row at all,
  // so the caller reads a missing key as zero rather than this inventing one.
  return new Map(rows.map((row) => [row.userId, Number(row.quiet)]));
}

/**
 * `S138`'s manager count — how many of each person's held companies have
 * **never** been contacted at all.
 *
 * `quietCountsByRep`'s twin over the same `companySilence` subquery, with the
 * filter it already exposes: `lastInteractionAt` is `max(report_date)` over
 * interactions for the company, so null IS *nobody has ever talked to this
 * customer* — the anchor `S138` gives a company with no contact. **Archived
 * companies and merge tombstones are excluded HERE** — `companySilence` runs
 * over every company and does not exclude them itself (read, not assumed),
 * and a customer somebody archived is not one anybody is being asked to
 * contact. A missing key reads as zero, as above.
 */
export async function neverContactedByRep(
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();

  const thresholds = await getQuietThresholds();
  const silence = companySilence(thresholds);

  const rows = await db
    .select({
      userId: companyReps.userId,
      never: sql<number>`count(*) filter (where ${silence.lastInteractionAt} is null)`,
    })
    .from(companyReps)
    .innerJoin(companies, eq(companies.id, companyReps.companyId))
    .innerJoin(silence, eq(silence.companyId, companies.id))
    .where(
      and(
        isNull(companyReps.removedAt),
        isNull(companies.archivedAt),
        isNull(companies.mergedIntoId),
        inArray(companyReps.userId, userIds),
      ),
    )
    .groupBy(companyReps.userId);

  return new Map(rows.map((row) => [row.userId, Number(row.never)]));
}

/**
 * One person's companies, quietest first — the rep drill-in's *companies by
 * silence* (`D39`, session 53).
 *
 * **Membership, not visibility**, as `quietCountsByRep` above: live
 * `company_reps` rows, so the list is exactly the set that rep's quiet column
 * counted. Archived companies and merge tombstones are left out for
 * `neverContactedByRep`'s reason — a customer somebody archived is not one
 * anybody is being asked to contact — and the total says how many the list
 * is of `D70`. Ordered on `silentDays` **in SQL, before the cap**
 * (`CLAUDE.md`): the quietest must lead whatever the cap is.
 *
 * No session: the one caller has already run `visibleMeasuredUsersFilter`
 * over the person, and a second visibility answer here would be the
 * two-copies trap.
 */
export type HeldCompany = {
  id: string;
  name: string;
  /** Days the clock has run — since the last interaction, else registration. */
  silentDays: number;
  /** Null = never logged against, which must not read as 0. */
  lastInteractionAt: string | null;
  thresholdDays: number;
  isQuiet: boolean;
  onHoldUntil: string | null;
};

export async function companiesHeldBySilence(
  userId: string,
  limit: number,
): Promise<{ rows: HeldCompany[]; total: number }> {
  const thresholds = await getQuietThresholds();
  const silence = companySilence(thresholds);

  const scope = and(
    eq(companyReps.userId, userId),
    isNull(companyReps.removedAt),
    isNull(companies.archivedAt),
    isNull(companies.mergedIntoId),
  );

  const [rows, [count]] = await Promise.all([
    db
      .select({
        id: companies.id,
        name: companies.name,
        silentDays: silence.silentDays,
        lastInteractionAt: silence.lastInteractionAt,
        thresholdDays: silence.thresholdDays,
        isQuiet: silence.isQuiet,
        onHoldUntil: silence.onHoldUntil,
      })
      .from(companyReps)
      .innerJoin(companies, eq(companies.id, companyReps.companyId))
      .innerJoin(silence, eq(silence.companyId, companies.id))
      .where(scope)
      .orderBy(desc(silence.silentDays), asc(companies.name))
      .limit(limit),
    db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(companyReps)
      .innerJoin(companies, eq(companies.id, companyReps.companyId))
      .where(scope),
  ]);

  return {
    rows: rows.map((row) => ({
      ...row,
      silentDays: Number(row.silentDays),
      thresholdDays: Number(row.thresholdDays),
      isQuiet: Boolean(row.isQuiet),
    })),
    total: count?.total ?? 0,
  };
}

/**
 * One person of the team, or `null` when this identity may not read them —
 * the rep drill-in's subject (`D39`, session 53). The name and the role's
 * two names, which is what the header prints; `S7` keeps the role name in
 * `roles` and nowhere else.
 */
export async function teamPerson(
  session: AuthSession,
  userId: string,
): Promise<{
  id: string;
  name: string;
  role: { nameEn: string; nameAr: string | null };
  isBookHolder: boolean;
} | null> {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      nameEn: roles.nameEn,
      nameAr: roles.nameAr,
      seesAllReps: roles.seesAllReps,
    })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(
      and(
        eq(users.id, userId),
        eq(users.isActive, true),
        visibleMeasuredUsersFilter(session),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    role: { nameEn: row.nameEn, nameAr: row.nameAr },
    isBookHolder: !row.seesAllReps,
  };
}

/**
 * Every active book-holder this identity may read, book or no book — the
 * *someone not listed* control's options on the Team tab (`D39`, session 53).
 * A rep who has been given no company yet still needs a target, and `S83`
 * lets anyone active carry one; the control is where an overseer reaches
 * them, since `D39`'s row set needs a company or a target to show a row.
 * Not `attentionPeople` below: that one keeps out the empty book, which is
 * right for attention and wrong for setting a target.
 */
export async function bookHolders(
  session: AuthSession,
): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(
      and(
        eq(users.isActive, true),
        companyBookHolderFilter(),
        visibleMeasuredUsersFilter(session),
      ),
    )
    .orderBy(asc(users.name));
}

/**
 * The people *Who needs attention* reads — `D79`: the active book-holders
 * this identity may see who hold at least one live company. **`D39`'s team
 * table reads the same roster** (session 53): its rows are these people plus
 * anyone carrying a target row, so the two blocks cannot disagree about who
 * is on the team.
 *
 * `companyBookHolderFilter` is the partition (`S9`'s four holding roles, the
 * proxy `authz` documents), `visibleMeasuredUsersFilter` is whose numbers the
 * reader may read, and the `exists` keeps out a holder with an empty book —
 * a coordinator holding nothing cannot have neglected anything, so a silent
 * one is not a row. Ordered by name so ties inside one condition are stable.
 */
export async function attentionPeople(
  session: AuthSession,
): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(
      and(
        eq(users.isActive, true),
        companyBookHolderFilter(),
        visibleMeasuredUsersFilter(session),
        exists(
          db
            .select({ one: sql`1` })
            .from(companyReps)
            .where(
              and(
                eq(companyReps.userId, users.id),
                isNull(companyReps.removedAt),
              ),
            ),
        ),
      ),
    )
    .orderBy(asc(users.name));
}

/* ------------------------------------------------------------------ *
 * The turn on ONE company — `D2` `D24`
 * ------------------------------------------------------------------ */

/**
 * `D24`'s turn panel, for a company.
 *
 * **A company has no chain position.** `chain.ts` takes four quotation-thread
 * fields and `CHAIN_COLUMNS[0]` is `new`, which is *a project with no thread* —
 * there is nothing to hand `chainOwner`, so a company's turn is not computable
 * the way a quotation's is and none is invented here. What a company can answer
 * is how long since anyone talked to this customer, and what defers that.
 *
 * **The ladder is `follow-ups.ts::gather`'s, read rather than rewritten.** Step
 * 1 drops a row whose customer is out of scope — archived, a merge tombstone,
 * or on hold `[20 §5]`. Step 2 drops one whose record carries a future
 * `next_follow_up_at` `[25 §18]`. Step 3 lets an arrived date **supersede** the
 * automatic chase on its own anchor. That is `planned` before `quiet`, and
 * `due` before `quiet`, and it is why this function exists rather than the
 * screen ranking three booleans itself.
 *
 * **The elapsed figure comes from `companySilence` and nothing else.** The
 * panel used to read `timeline.events[0].day` — the newest of seven event
 * kinds, comments and dispatches included — while its own red band came from
 * the interaction clock. On this database that put "Nothing recorded for 0
 * days" beside a Gone quiet badge, and understated 20 of rep-a's 59 logged
 * companies by 36.5 days on average. `20 §2` is the reason the two differ: a
 * field note is anchored to nobody and cannot be evidence a customer was
 * contacted, and neither can a comment, a dispatch or a quotation.
 *
 * **This is `companySilence`'s third reader** — after `/companies`' meter and
 * `listCompanies`' order — and the point of the extraction. `coverage()` was a
 * fourth until `28b` deleted it `S88`.
 * `isCompanyQuiet` and `companyOnHoldUntil` came out in the same slice: the
 * first was a second answer to *is this quiet*, and the second was **viewer
 * scoped** where `companySilence` and `onHoldByCompany` deliberately are not,
 * so a hold set on a report the viewer could not read showed the panel red and
 * the list calm on one company.
 */
export type CompanyTurnState =
  | "archived"
  | "removalRequested"
  | "onHold"
  | "planned"
  | "due"
  | "quiet"
  | "calm"
  | "never";

export type CompanyTurn = {
  state: CompanyTurnState;
  /** Days since the last interaction. **Null = never logged against** — which
   *  must not read the same as `0`. */
  daysSince: number | null;
  /** Days the clock has actually run: since the last interaction, else since
   *  registration. What the meter's fill is built on. */
  silentDays: number;
  thresholdDays: number;
  /** `20 §5` — in force, and unfiltered by viewer. Null unless `state` is
   *  `onHold`. */
  onHoldUntil: string | null;
  /** `25 §18` — the rep's own date. Null unless `state` is `planned` or `due`. */
  plannedFor: string | null;
  /** The condition the dormancy block renders on `[07 E6]`, kept here so the
   *  screen asks once. Archived and on-hold companies are never quiet. */
  isQuiet: boolean;
  /** `S105` — a rep's request is with the manager. The company stays on
   *  every list meanwhile; only whose move it is changes `D2`. */
  removalPending: boolean;
};

/**
 * The turn on one company, or `null` when this identity may not see it.
 *
 * The visibility filter is composed into the WHERE rather than checked after,
 * the shape `getCompany` uses — a caller cannot forget it and still get a row.
 */
export async function companyTurn(
  session: AuthSession,
  companyId: string,
): Promise<CompanyTurn | null> {
  const thresholds = await getQuietThresholds();
  const silence = companySilence(thresholds);

  const [row] = await db
    .select({
      lastInteractionAt: silence.lastInteractionAt,
      silentDays: silence.silentDays,
      thresholdDays: silence.thresholdDays,
      isQuiet: silence.isQuiet,
      onHoldUntil: silence.onHoldUntil,
      // Named outright rather than left to a bare `sql` template: this query
      // joins, so an unqualified column would resolve inside the subquery
      // (`CLAUDE.md`).
      archivedAt: companies.archivedAt,
      mergedIntoId: companies.mergedIntoId,
      nextFollowUpAt: companies.nextFollowUpAt,
      // `S105` — both tables named outright: this query joins, and a bare
      // column in a correlated subquery resolves inside the wrong table
      // (`CLAUDE.md`).
      removalPending: sql<boolean>`exists (
        select 1 from company_removal_requests r
        where r.company_id = ${companies.id} and r.review_id is null
      )`,
    })
    .from(companies)
    .innerJoin(silence, eq(silence.companyId, companies.id))
    .where(and(eq(companies.id, companyId), visibleCompaniesFilter(session)))
    .limit(1);

  if (!row) return null;

  const silentDays = Number(row.silentDays);
  const base = {
    // Never logged is null, never zero — "Never" and "today" must not read the
    // same, and the panel has a line of its own for it.
    daysSince: row.lastInteractionAt ? silentDays : null,
    silentDays,
    thresholdDays: Number(row.thresholdDays),
    isQuiet: Boolean(row.isQuiet),
    removalPending: Boolean(row.removalPending),
  };

  // `gather` step 1 — the customer is out of scope. Archived and a merge
  // tombstone are the same answer to the screen: nobody owes anything.
  if (row.archivedAt || row.mergedIntoId) {
    return {
      ...base,
      state: "archived",
      onHoldUntil: null,
      plannedFor: null,
      isQuiet: false,
      removalPending: false,
    };
  }

  // `S105` — the move is the manager's while a request is open. Above on
  // hold and the rep's own date: those say what the REP owes, and the rep
  // owes nothing while somebody else is deciding whether the customer stays.
  // `isQuiet` is untouched — nothing leaves any list until the ruling.
  if (base.removalPending) {
    return {
      ...base,
      state: "removalRequested",
      onHoldUntil: null,
      plannedFor: null,
    };
  }

  // Still step 1. `companySilence` already resolved this in SQL and already
  // forced `isQuiet` false for it — on hold is never quiet `[20 §5]`.
  if (row.onHoldUntil) {
    return {
      ...base,
      state: "onHold",
      onHoldUntil: row.onHoldUntil,
      plannedFor: null,
    };
  }

  // Steps 2 and 3 — the rep's own date, before the automatic clock either way.
  // `>` and not `>=`, which is where this parts company with on hold: a
  // follow-up date stops deferring ON the day it arrives, because that is the
  // day it becomes the follow-up.
  if (row.nextFollowUpAt) {
    return {
      ...base,
      state: row.nextFollowUpAt > today() ? "planned" : "due",
      onHoldUntil: null,
      plannedFor: row.nextFollowUpAt,
    };
  }

  return {
    ...base,
    state: base.isQuiet
      ? "quiet"
      : base.daysSince === null
        ? "never"
        : "calm",
    onHoldUntil: null,
    plannedFor: null,
  };
}
