/**
 * Projects — the data layer `09 §3.4`, and the project–company links `09 §3.5`.
 *
 * A project is first-class, not a child of a company `[04 Q2]`. It is created
 * by a rep and belongs to him `[07 A8]`, and it requires at least one linked
 * company `[07 A9]` — an application-layer rule, because SQL cannot express
 * "at least one row in another table".
 *
 * Visibility is owner or explicit share, never company membership: a shared
 * company does not expose its projects `[04 Q7]`. That rule lives in
 * `visibleProjectsFilter` and every read here composes it.
 *
 * Achieved SQM is never stored — it is derived from dispatches `[04 C1]`.
 * `sqm_expected` is the human forecast, and the only number a rep types.
 *
 * **Who bought is derived the same way** `S26`. There is no buyer flag;
 * `dispatchedSqmByCompany` below is the one place that knows how a dispatch
 * reaches a project, and since `S74` that is `dispatches.project_id`.
 *
 * **`ensureProjectParticipant` is the only writer of a participant row.** Both
 * ways in use it: a rep adding one by hand, and `S74`'s write-back when a
 * project-less quotation is dispatched. One path, so `S27`'s rules — soft
 * removal, re-linkable, the partial unique index — cannot hold for one caller
 * and not the other.
 *
 * **Won is derived and never stored** `S31`, from the same approved-dispatch
 * predicate that credits a target `S72`. `projectIsWon` is the one definition
 * and `projectState` the one precedence; between them no screen decides what a
 * project's state is.
 */

import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  sql,
  sum,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";

import {
  cities,
  companies,
  dispatchLines,
  dispatches,
  lossReasons,
  projectCompanies,
  projects,
  quotationThreads,
  quotationVersions,
  users,
} from "@/db/schema";
import { withAudit, type AuditEntry } from "@/lib/audit";
/**
 * `S72`'s one predicate `[dispatches.ts]`. **This import closes a cycle** —
 * `dispatches.ts` imports `ensureProjectParticipant` from here — and it is safe
 * because neither side is used at module-evaluation time: both are function
 * references resolved when a query runs. The alternative was a seventh
 * hand-written `status = 'approved'`, which is the copy that gets missed.
 */
import { approvedDispatches } from "@/lib/dispatches";
import {
  canViewRecord,
  visibleCompaniesFilter,
  visibleProjectsFilter,
  type AuthSession,
} from "@/lib/authz";
import { CHAIN_COLUMNS, chainState, type ChainColumn } from "@/lib/chain";
import {
  OTHER_LOSS_REASON_CODE,
  PROJECT_END_STATES,
  REGIONS,
  type ProjectEndState,
  type Region,
  type SameValues,
} from "@/lib/enums";
import { lossReasonCode, regionForCity } from "@/lib/lookups";
import { normalizeName } from "@/lib/normalize";
import {
  getPositiveIntSetting,
  PROJECT_STAGE_UNCHANGED_DEFAULT,
  PROJECT_STAGE_UNCHANGED_KEY,
} from "@/lib/settings";
import { calendarDaysBetween, riyadhDayOf } from "@/lib/working-days";
import { RuleError } from "@/lib/validation";

export type Project = typeof projects.$inferSelect;

/** The caller's transaction and pen, for the one exported writer below. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Log = (entry: AuditEntry) => void;

/** Compile-time proof that `enums.ts` still matches the database. */
export type EndStateMatchesSchema = SameValues<
  ProjectEndState,
  NonNullable<Project["endState"]>
>;

export { PROJECT_END_STATES, REGIONS };
export type { ProjectEndState };

export type ProjectInput = {
  name: string;
  sqmExpected: string | null;
  /** Optional, and deliberately not conditioned on anything: a project has no
   *  country, so `S15`'s "mandatory when Saudi" has nothing to hang on here.
   *  Whether it should be required at all is one of the three shapes open in
   *  `WORKFLOW §5`. What is settled is that this is the ONLY place a region can
   *  come from — there is no `region` field beside it, because `regionForCity`
   *  has no fallback and a caller supplying one would be supplying something
   *  the writer discards. */
  cityId: string | null;
  endState: ProjectEndState | null;
  /** Which of the nine `[25 §5]`; required when `endState` is `lost`. */
  lostReasonId: string | null;
  /** The `other` intake, and forbidden for every other code `[25 §5]`. */
  lossReason: string | null;
  /**
   * `[25 §4]` — a plain label the rep sets, deliberately unverified and
   * never to be derived from or checked against the production module:
   * production sometimes changes and stock sometimes covers an order.
   */
  inProduction: boolean;
  /**
   * `S29`'s fifth item — the customer has agreed, ahead of any dispatch
   * `S31`. The rep's own judgement, and they clear it the same way.
   *
   * **Not an end state**, so not in `endState`: a committed project is still
   * moving. And never won — that is derived from an approved dispatch, and
   * `projectState` ranks it above this.
   */
  committed: boolean;
};

/**
 * One row of the project–company join: a participant `S25`, and nothing else.
 *
 * It carries a single field because a participant *is* a single field since
 * `S25` dropped the role and `S26` dropped the buyer flag. It stays a named
 * type rather than collapsing to a bare `string` so that `createProject` and
 * `addProjectCompany` still say what they take.
 */
export type ProjectCompanyLink = {
  companyId: string;
};

/**
 * **Is this project won?** `S31` — a project is won when a dispatch against it
 * is approved.
 *
 * The one definition. Two readers today, `listProjects` and `getProject`, and
 * both select it rather than asking a second way; `projectState` below is what
 * turns it into something a screen prints.
 *
 * **Derived, never stored, and that is what makes cancellation free.** `S31`
 * pairs un-winning a project with taking back its credit, and credit is
 * already derived through `approvedDispatches()` — so when `S73`'s second half
 * builds cancellation, a dispatch leaving `approved` un-wins the project and
 * removes the square metres as one act. Nothing here is amended, and nothing
 * can drift: a stored flag would need a second writer and could disagree with
 * the dispatches it claims to summarise.
 *
 * **A submitted request wins nothing** `S72`, and neither does a refused one —
 * `approvedDispatches()` is the whole predicate, which is why this reuses it
 * rather than writing `status = 'approved'` an eighth time.
 *
 * A dispatch reaches a project by its own `project_id` `S74`, as
 * `dispatchedSqmByCompany` does. A free entry naming no project wins none
 * `S75`.
 *
 * **Drizzle's `exists()` rather than a `sql` template**, which is the shape
 * `visibleDispatchesFilter` already uses `[authz.ts]`. A Drizzle column
 * interpolated into a `sql` template loses its table qualifier when the outer
 * query joins nothing, and `projects.id` rendering bare inside this subquery
 * would resolve to `dispatches.id` — `where project_id = id`, never true,
 * zero rows, no error. The builder writes both qualifiers itself, so the trap
 * cannot reach this. `verify:schema25` holds it to raw SQL over every row
 * anyway, because that trap has shipped wrong numbers before.
 *
 * No visibility term: the caller has already proved the project visible and a
 * project's figures follow it — `dispatchedSqmByCompany`'s argument, and
 * `dispatchesInPeriod`'s.
 */
export function projectIsWon(): SQL<boolean> {
  return exists(
    db
      .select({ one: sql`1` })
      .from(dispatches)
      .where(and(eq(dispatches.projectId, projects.id), approvedDispatches())),
  ) as SQL<boolean>;
}

/**
 * **`S132`'s fifth position: a dispatch against the project is `submitted`** —
 * the coordinator is checking it `S72`, and `S88` says a dispatch request waits
 * on her rather than on a rep.
 *
 * **A `draft` does not qualify**, which `S132` states rather than leaves to be
 * inferred: a draft is still the rep's own to edit `S125` and can sit
 * indefinitely, so it is not a place the deal has reached. Neither does a
 * refused or cancelled one — this is a status test, not a history one.
 *
 * The twin of `projectIsWon` above in every other respect, and deliberately
 * written the same way: `exists()` from the builder rather than a `sql`
 * template, so both table qualifiers are emitted and `CLAUDE.md`'s correlated
 * subquery trap cannot reach it. A free entry naming no project reaches no
 * position `S75`.
 */
export function projectHasSubmittedDispatch(): SQL<boolean> {
  return exists(
    db
      .select({ one: sql`1` })
      .from(dispatches)
      .where(
        and(
          eq(dispatches.projectId, projects.id),
          eq(dispatches.status, "submitted"),
        ),
      ),
  ) as SQL<boolean>;
}

/**
 * What a project's state is, in one word, for the one place a screen prints it.
 *
 * `S28` — a project's state is derived from real events, and `S29` lists what
 * the rep sets on top of that. This is the whole precedence, and it is here so
 * that the list, the detail screen and the company page cannot each invent a
 * different one.
 *
 * **Won outranks lost.** Won is a real event that cannot be manufactured
 * `S31`; lost is the rep's judgement `S29`. Where a project carries both, the
 * dispatch is the harder fact, so no writer has to refuse the combination and
 * no CHECK has to forbid it.
 *
 * **Committed ranks below both, and is never won** `S31`. It is the customer's
 * agreement ahead of any dispatch, so a project that has since dispatched
 * reads as won and a closed one reads as lost — committed is behind it either
 * way. Nothing clears the column; this ordering is what makes clearing it
 * unnecessary.
 *
 * `open` is the fifth answer and the commonest: nothing has happened yet.
 */
export const PROJECT_STATES = ["won", "lost", "committed", "open"] as const;
export type ProjectState = (typeof PROJECT_STATES)[number];

export function projectState(row: {
  won: boolean;
  endState: ProjectEndState | null;
  committed: boolean;
}): ProjectState {
  if (row.won) return "won";
  if (row.endState) return row.endState;
  if (row.committed) return "committed";
  return "open";
}

/**
 * **When a project last moved** — the one derivation, and the key `D25` orders
 * this list by.
 *
 * `10 §1`: the funnel is *"computed from what has actually happened"* and
 * nobody ticks a box, so **there is no stage column and there is not going to
 * be one**. Moving means a stage-advancing event: a quotation raised on the
 * project, or an **approved** dispatch against it `S72` — a request sitting
 * with the coordinator is the project waiting, not the project moving. Falling
 * back to the project's own creation, which is the case a threshold exists to
 * catch.
 *
 * **A confirmed payment was the third event until `S133`**, which took the
 * column with the mechanism behind it. `S70` records payment on the dispatch
 * now, and the dispatch is already counted here, so nothing a rule still names
 * is lost. What DID move is the ordering: a project whose payment stamp was
 * later than its raise ages by that gap, which shifts `/projects` `D25` and
 * `S89`'s stage-unchanged clock together. `WORKFLOW §5` carries that, so a
 * reader who notices the shift has the answer rather than rediscovering it.
 *
 * **This was `follow-ups.ts`'s private copy until this slice**, where it fed
 * `S89`'s stage-unchanged condition. `/projects` needs the same answer to order
 * by `D25`, and `companyQuiet` is the live example in `WORKFLOW §5` of what two
 * copies of one derivation do — they had already drifted, 100 companies marked
 * quiet against 36, while both carried the same sentence in prose. So it is one
 * function, here, and `projectStageUnchanged` composes it.
 *
 * **A dispatch reaches a project by its own `project_id`** `S74`, as
 * `dispatchedSqmByCompany` does — not through `quotation_threads`, which is the
 * route the follow-ups copy still took. The two agree on every row today
 * (`S75`'s free-entry route writes the column null, and `S74`'s write-back puts
 * the project on the thread at approval), and this is the one the rules name.
 * `verify:followups` is the gate that proves nothing moved.
 *
 * Two grouped subqueries **joined on**, never correlated subqueries in a `sql`
 * template — the shape `coverage.ts` records this codebase getting wrong once
 * already. Each exposes its date under a name unique across the whole
 * statement, because Drizzle drops the table qualifier in a `sql` template's
 * SELECT list and two subqueries both exposing `at` would render as an
 * ambiguous bare `"at"`. The fallback **names its table outright** for the same
 * reason (`CLAUDE.md`): `created_at` alone is ambiguous the moment this query
 * joins `users`.
 *
 * `greatest()` ignores nulls, so a project with threads but no dispatch takes
 * the thread date, and one with neither takes its own creation.
 */
export function projectMovement() {
  const threadEvents = db
    .select({
      projectId: quotationThreads.projectId,
      at: sql<string | null>`max(
        (${quotationThreads.createdAt} at time zone 'Asia/Riyadh')::date
      )`.as("thread_event_at"),
    })
    .from(quotationThreads)
    .groupBy(quotationThreads.projectId)
    .as("thread_events");

  const dispatchEvents = db
    .select({
      projectId: dispatches.projectId,
      at: sql<string | null>`max(${dispatches.dispatchDate})`.as(
        "dispatch_event_at",
      ),
    })
    .from(dispatches)
    .where(approvedDispatches())
    .groupBy(dispatches.projectId)
    .as("dispatch_events");

  const at = sql<string>`coalesce(
    greatest(${threadEvents.at}, ${dispatchEvents.at}),
    ("projects"."created_at" at time zone 'Asia/Riyadh')::date
  )`;

  return { threadEvents, dispatchEvents, at };
}

/**
 * The first participant of each project, by name — one query for a whole page
 * rather than one per row.
 *
 * A project keeps at least one participant `S27`, and a row or a board card has
 * space for one name; the rest are on the project itself. Ordered by name so
 * the choice is stable between requests rather than following insertion order.
 *
 * **Removed links are hidden** `S27` — kept in the table, absent from every
 * screen. Moved here from `follow-ups.ts` in the board slice, alongside
 * `projectMovement` above: both are facts about a project, and the waiting list
 * is one reader of them rather than their owner.
 *
 * No visibility term: the caller has already proved the project visible, and a
 * project's participants follow it `[20 §13]` — `listProjectCompanies` is what
 * decides which of them the reader may *open*.
 */
export async function firstCompanyByName(
  projectIds: string[],
): Promise<Map<string, { id: string; name: string }>> {
  if (projectIds.length === 0) return new Map();

  const rows = await db
    .select({
      projectId: projectCompanies.projectId,
      id: companies.id,
      name: companies.name,
    })
    .from(projectCompanies)
    .innerJoin(companies, eq(companies.id, projectCompanies.companyId))
    .where(
      and(
        inArray(projectCompanies.projectId, projectIds),
        isNull(projectCompanies.removedAt),
      ),
    )
    .orderBy(asc(companies.name));

  const byProject = new Map<string, { id: string; name: string }>();
  for (const row of rows) {
    if (byProject.has(row.projectId)) continue;
    byProject.set(row.projectId, { id: row.id, name: row.name });
  }
  return byProject;
}

/**
 * **Where one project sits on the quotation chain** `D29` — the board's column,
 * and the table's whose-move cell.
 *
 * `chainState()` is the one ladder `[chain.ts]` and it takes **one thread**;
 * `D29` asks the same question of a **project**, which may have several. This
 * is the only place that gap is closed, and it closes it two ways the founder
 * settled with the board:
 *
 * **Furthest along wins** `S132`, which is the rule `chainReached` already
 * applies one level down. A project with one thread won and one still quoted
 * reads as won, and `liveThreads` is what stops the second one being lost
 * behind the first.
 *
 * **`new` at project level means no LIVE thread**, where `chain.ts`'s means no
 * thread at all. A project whose every thread was rejected or cancelled is not
 * lost — nobody has given up on it, and `chainOwner("new")` already says whose
 * move it is: the rep's, to quote again. `D29` carries both definitions in its
 * own text, because one that shifts by level and is not written down is how the
 * silence derivation drifted.
 *
 * **The last two rungs come from the project, not the thread.** `chainState`
 * stops at `withCustomer` for a caller that has not loaded dispatches, and both
 * remaining positions are facts about a dispatch against the project:
 * `projectHasSubmittedDispatch` is `S132`'s *ready to ship* `S72` `S88`, and
 * `projectIsWon` is `S31`'s one predicate, which is exactly what *won* means.
 * So the answer is the furthest of the live threads' positions and whichever of
 * those two holds — which is also what stops a won project whose only thread
 * was later cancelled reading as `new`.
 *
 * **No thread visibility filter**, deliberately. A project's figures follow the
 * project — `dispatchedSqmByCompany`'s argument — and filtering the threads by
 * the reader would put one project in two columns for two people.
 */
export type ProjectChain = {
  position: ChainColumn;
  /** Threads not yet closed. More than one is `25 §22`'s case. */
  liveThreads: number;
};

/**
 * A chain position with the movement figure the table's cell shows beside it.
 *
 * **`stale` is decided here and never in a screen.** `S89`'s threshold lives in
 * `settings`, so a screen comparing a day count against a number of its own
 * would be inventing one — which is what the `facet-ui` pre-flight forbids and
 * what put two different quiet counts on two screens. `/follow-ups` applies the
 * same threshold to put the project on a queue; this only colours a figure
 * `D6`, and both read it from the same row.
 */
export type ProjectAttention = ProjectChain & {
  /** Calendar days since the project last moved. */
  ageDays: number;
  /** `S89`'s stage-unchanged threshold, as configured. */
  thresholdDays: number;
  stale: boolean;
};

function furthest(a: ChainColumn, b: ChainColumn): ChainColumn {
  return CHAIN_COLUMNS.indexOf(b) > CHAIN_COLUMNS.indexOf(a) ? b : a;
}

/**
 * **The two positions a thread cannot answer, seeded from the project itself.**
 *
 * `S132`'s last two rungs are facts about a DISPATCH against the project, not
 * about a quotation — *ready to ship* is one at `submitted` and *won* is one
 * approved — so `chainState()` cannot reach either from a thread row and the
 * caller supplies them. Both come from the same query as the cards, resolved in
 * SQL before anything is folded (`CLAUDE.md`), and `won` outranks `ready`
 * because furthest along wins.
 */
async function chainByProject(
  projectIds: string[],
  won: Map<string, boolean>,
  readyToShip: Map<string, boolean>,
): Promise<Map<string, ProjectChain>> {
  const answer = new Map<string, ProjectChain>();
  for (const id of projectIds) {
    answer.set(id, {
      position: won.get(id)
        ? "won"
        : readyToShip.get(id)
          ? "readyToShip"
          : "new",
      liveThreads: 0,
    });
  }
  if (projectIds.length === 0) return answer;

  const rows = await db
    .select({
      projectId: quotationThreads.projectId,
      endState: quotationThreads.endState,
      versionStatus: quotationVersions.status,
    })
    .from(quotationThreads)
    // The live version is the one that is not superseded — the same predicate
    // `listQuotationThreads` applies, and the same invariant behind it.
    .innerJoin(
      quotationVersions,
      and(
        eq(quotationVersions.threadId, quotationThreads.id),
        ne(quotationVersions.status, "superseded"),
      ),
    )
    .where(inArray(quotationThreads.projectId, projectIds));

  for (const row of rows) {
    const entry = answer.get(row.projectId);
    if (!entry) continue;

    // No dispatch flags: the project already carries both, seeded above, and
    // passing them per thread would answer a project-level question one thread
    // at a time.
    const { position } = chainState({
      versionStatus: row.versionStatus,
      endState: row.endState,
    });
    // A closed thread is not on the board and does not count as live `S86`.
    if (position === "closed") continue;

    entry.liveThreads += 1;
    entry.position = furthest(entry.position, position);
  }

  return answer;
}

export type ProjectListRow = {
  id: string;
  name: string;
  ownerName: string;
  /** Who owns it, as an **id**, so a screen can ask *is this mine?* without
   *  comparing display names — `QuotationThreadListRow.raisedByUserId`'s twin,
   *  and free: it is already the join key `ownerName` comes through. */
  ownerUserId: string;
  sqmExpected: string | null;
  endState: ProjectEndState | null;
  /** Derived, never stored `S31` — see `projectIsWon`. */
  won: boolean;
  /** `S29`'s fifth item, the rep's own judgement `S31`. */
  committed: boolean;
  region: Region | null;

  cityNameEn: string | null;
  cityNameAr: string | null;
  createdAt: Date;
  /** `YYYY-MM-DD` in Riyadh — `projectMovement`, and what `D25` orders by. */
  lastMovedOn: string;
  /** Null unless the caller asked for it — see `withChain`. */
  chain: ProjectAttention | null;
};

const PAGE_SIZE = 25;

function searchFilter(query: string | undefined): SQL | undefined {
  const trimmed = query?.trim();
  if (!trimmed) return undefined;
  return ilike(
    projects.nameNormalized,
    `%${normalizeName(trimmed)}%`,
  );
}

/**
 * Projects this identity may see.
 *
 * `companyId` narrows to the projects linked to one company — used by the
 * company detail page. It narrows the visible set and never widens it: a rep
 * holding a company through a share sees the company and an empty projects
 * list, because `visibleProjectsFilter` is still the outer condition
 * `[04 Q7]`.
 *
 * **Ordered by when the project last moved, oldest first** `D25` — a list is
 * ordered by attention, and creation date is not attention. `projectMovement`
 * is the key and it is resolved in SQL, before the LIMIT.
 *
 * **`foreignOwnerCount` is how the OWNER column earns its place.** It is the
 * distinct owners **other than the reader**, across the whole visible scope and
 * not this page, so the column cannot appear on page 2 and vanish on page 3.
 * `D2` — a column repeating the reader's own name on every row says nothing.
 *
 * **The reader is excluded rather than counted, and that is a correction.** It
 * was `ownerCount > 1`, every distinct owner — which fires on a scope that is
 * almost entirely the reader's own book, because one project reaching them
 * through a share is a second owner. `listQuotationThreads` carries the
 * measurement that found it. The column is no narrower for a manager or the
 * coordinator, who own none of what they read; what changes is the rep, whose
 * own rows now render **blank**, and blank means *mine*.
 *
 * **`withChain` costs one extra query and is opt-in**, because only `/projects`
 * renders the position. It decorates a page already fetched rather than
 * filtering it, which is the distinction `CLAUDE.md` draws: nothing here
 * narrows the result set or reorders it.
 */
export async function listProjects(
  session: AuthSession,
  options: {
    companyId?: string;
    q?: string;
    page?: number;
    withChain?: boolean;
  } = {},
): Promise<{
  rows: ProjectListRow[];
  total: number;
  page: number;
  foreignOwnerCount: number;
}> {
  const page = Math.max(1, options.page ?? 1);

  const linkedToCompany = options.companyId
    ? inArray(
        projects.id,
        db
          .select({ id: projectCompanies.projectId })
          .from(projectCompanies)
          .where(
            and(
              eq(projectCompanies.companyId, options.companyId),
              isNull(projectCompanies.removedAt),
            ),
          ),
      )
    : undefined;

  const where = and(
    visibleProjectsFilter(session),
    searchFilter(options.q),
    linkedToCompany,
  );

  const moved = projectMovement();

  const found = await db
    .select({
      id: projects.id,
      name: projects.name,
      ownerName: users.name,
      ownerUserId: projects.ownerUserId,
      sqmExpected: projects.sqmExpected,
      endState: projects.endState,
      // Resolved in SQL, before the LIMIT — a derived condition filtered or
      // computed after the page is fetched returns silently wrong screens
      // (`CLAUDE.md`).
      won: projectIsWon(),
      // `S132`'s fifth rung, resolved in the same statement and for the same
      // reason as `won` above.
      readyToShip: projectHasSubmittedDispatch(),
      committed: projects.committed,
      region: projects.region,

      cityNameEn: cities.nameEn,
      cityNameAr: cities.nameAr,
      createdAt: projects.createdAt,
      lastMovedOn: moved.at,
    })
    .from(projects)
    .innerJoin(users, eq(projects.ownerUserId, users.id))
    .leftJoin(cities, eq(projects.cityId, cities.id))
    .leftJoin(moved.threadEvents, eq(moved.threadEvents.projectId, projects.id))
    .leftJoin(
      moved.dispatchEvents,
      eq(moved.dispatchEvents.projectId, projects.id),
    )
    .where(where)
    .orderBy(asc(moved.at), desc(projects.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  // **Both tables named outright** `CLAUDE.md`, and `mapWith(Number)` because
  // `count()` over a bigint comes back as a string otherwise — a `> 0` test
  // would still pass by coercion, which is exactly how a typed lie survives.
  const [totals] = await db
    .select({
      total: count(),
      foreignOwners: sql<number>`count(distinct "projects"."owner_user_id")
        filter (where "projects"."owner_user_id" <> ${session.user.id})`.mapWith(
        Number,
      ),
    })
    .from(projects)
    .where(where);

  const [chain, thresholdDays] = options.withChain
    ? await Promise.all([
        chainByProject(
          found.map((row) => row.id),
          new Map(found.map((row) => [row.id, row.won])),
          new Map(found.map((row) => [row.id, row.readyToShip])),
        ),
        getPositiveIntSetting(
          PROJECT_STAGE_UNCHANGED_KEY,
          PROJECT_STAGE_UNCHANGED_DEFAULT,
        ),
      ])
    : [null, 0];

  const now = riyadhDayOf(new Date());

  return {
    rows: found.map((row) => {
      const position = chain?.get(row.id);
      if (!position) return { ...row, chain: null };
      const ageDays = calendarDaysBetween(row.lastMovedOn, now);
      return {
        ...row,
        chain: {
          ...position,
          ageDays,
          thresholdDays,
          stale: ageDays >= thresholdDays,
        },
      };
    }),
    total: totals?.total ?? 0,
    page,
    foreignOwnerCount: totals?.foreignOwners ?? 0,
  };
}

/** One card on the board `D29`. */
export type ProjectBoardCard = {
  id: string;
  name: string;
  ownerName: string;
  /** As `ProjectListRow` — the id, so a card can ask *is this mine?* */
  ownerUserId: string;
  sqmExpected: string | null;
  won: boolean;
  committed: boolean;
  /** The first participant by name `S27`; null only if every link is removed. */
  companyName: string | null;
  liveThreads: number;
};

export type ProjectBoard = {
  /** All six of `CHAIN_COLUMNS`, in order, empty ones included. */
  columns: { column: ChainColumn; cards: ProjectBoardCard[] }[];
  /** Cards on the board — lost projects are not among them. */
  total: number;
  /** Lost, and therefore off the board `D29`. Stated, never silently dropped. */
  lost: number;
  /** As `listProjects` — what decides whether a card names its owner, and
   *  counted the same way: owners **other than the reader**. */
  foreignOwnerCount: number;
};

/**
 * `D29`'s board: every visible project, in one of the six chain positions.
 *
 * **Unpaginated, and that is the cost of one definition** — the argument
 * `awaitingSignatureCount` already makes `[quotations.ts]`. `CLAUDE.md` forbids
 * filtering *a page* after fetching it, because the rows that fall out are
 * silently gone; this fetches no page, so every column's count is the true one
 * and `chain.ts` stays the only ladder. It grows with the reader's book: 49
 * projects today, and a `sees_all_reps` or `can_dispatch` identity reads them
 * all `S76`.
 *
 * **Lost projects leave the board and are counted** `D29` — *"or the board
 * becomes a graveyard nobody clears"*. `lost` is what the screen states and
 * links to the table with; it is never a silent subtraction.
 *
 * **A won project stays on the board**, in `dispatched` or further. Winning is
 * an approved dispatch `S31`, not an exit: `S77` has one quotation producing
 * any number of dispatches, and `follow-ups.ts` makes the same call about the
 * same fact — a project that has shipped part of what it quoted is still
 * moving.
 *
 * Cards are ordered within a column by `projectMovement`, oldest first — the
 * same key the table is ordered by `D25`, so the two views of one query agree
 * about what wants attention `D28`.
 */
export async function listProjectBoard(
  session: AuthSession,
  options: { q?: string } = {},
): Promise<ProjectBoard> {
  const visible = and(visibleProjectsFilter(session), searchFilter(options.q));
  // `end_state` carries only `lost` since `S31`, so this reads "not lost".
  const onBoard = and(visible, isNull(projects.endState));

  const moved = projectMovement();

  const found = await db
    .select({
      id: projects.id,
      name: projects.name,
      ownerName: users.name,
      ownerUserId: projects.ownerUserId,
      sqmExpected: projects.sqmExpected,
      won: projectIsWon(),
      readyToShip: projectHasSubmittedDispatch(),
      committed: projects.committed,
    })
    .from(projects)
    .innerJoin(users, eq(projects.ownerUserId, users.id))
    .leftJoin(moved.threadEvents, eq(moved.threadEvents.projectId, projects.id))
    .leftJoin(
      moved.dispatchEvents,
      eq(moved.dispatchEvents.projectId, projects.id),
    )
    .where(onBoard)
    .orderBy(asc(moved.at), desc(projects.createdAt));

  const ids = found.map((row) => row.id);

  const [chain, participants, [lostTotal], [owners]] = await Promise.all([
    chainByProject(
      ids,
      new Map(found.map((row) => [row.id, row.won])),
      new Map(found.map((row) => [row.id, row.readyToShip])),
    ),
    firstCompanyByName(ids),
    db
      .select({ total: count() })
      .from(projects)
      .where(and(visible, isNotNull(projects.endState))),
    // Both tables named outright `CLAUDE.md`; `mapWith(Number)` because a
    // bigint count returns a string otherwise.
    db
      .select({
        foreignOwners: sql<number>`count(distinct "projects"."owner_user_id")
          filter (where "projects"."owner_user_id" <> ${session.user.id})`.mapWith(
          Number,
        ),
      })
      .from(projects)
      .where(onBoard),
  ]);

  const columns = CHAIN_COLUMNS.map((column) => ({
    column,
    cards: [] as ProjectBoardCard[],
  }));

  for (const row of found) {
    const position = chain.get(row.id);
    const slot = columns.find((entry) => entry.column === position?.position);
    // Unreachable: `chainByProject` seeds every id it is given. Skipped rather
    // than defaulted, so a card can never land in the wrong column.
    if (!slot) continue;
    slot.cards.push({
      id: row.id,
      name: row.name,
      ownerName: row.ownerName,
      ownerUserId: row.ownerUserId,
      sqmExpected: row.sqmExpected,
      won: row.won,
      committed: row.committed,
      companyName: participants.get(row.id)?.name ?? null,
      liveThreads: position?.liveThreads ?? 0,
    });
  }

  return {
    columns,
    total: found.length,
    lost: lostTotal?.total ?? 0,
    foreignOwnerCount: owners?.foreignOwners ?? 0,
  };
}

export type ProjectCompanyRow = {
  id: string;
  companyId: string;
  companyName: string;
  /**
   * What this participant has dispatched against this project `S26`, summed —
   * a `numeric(14,4)` string, never a number.
   *
   * **`null` means no dispatch, and is not the same as `"0.0000"`.** A
   * participant with nothing dispatched shows nothing on the screen rather
   * than a zero, so the two must stay distinguishable all the way out.
   */
  dispatchedSqm: string | null;
  /**
   * Whether the viewer may open this company's own record.
   *
   * Seeing a project shows you which companies are on it — a project without
   * them is meaningless `[07 A9]` — but it does not grant access to those
   * company records `[14 §4 planning]`. False renders the name as plain text
   * rather than a link.
   */
  viewable: boolean;
};

export type ProjectDetail = Project & {
  /** Derived, never stored `S31` — see `projectIsWon`. `committed` arrives
   *  with the row, because that one IS a column. */
  won: boolean;
  ownerName: string;

  cityNameEn: string | null;
  cityNameAr: string | null;
  /** The picked reason's own name `[25 §5]` — null unless the project is lost. */
  lostReasonNameEn: string | null;
  lostReasonNameAr: string | null;
  createdByName: string | null;
  links: ProjectCompanyRow[];
};

export async function getProject(
  session: AuthSession,
  id: string,
): Promise<ProjectDetail | null> {
  const [row] = await db
    .select({
      project: projects,
      won: projectIsWon(),
      ownerName: users.name,
      cityNameEn: cities.nameEn,
      cityNameAr: cities.nameAr,
      lostReasonNameEn: lossReasons.nameEn,
      lostReasonNameAr: lossReasons.nameAr,
    })

    .from(projects)
    .innerJoin(users, eq(projects.ownerUserId, users.id))
    .leftJoin(cities, eq(projects.cityId, cities.id))
    .leftJoin(lossReasons, eq(projects.lostReasonId, lossReasons.id))
    .where(and(eq(projects.id, id), visibleProjectsFilter(session)))
    .limit(1);

  if (!row) return null;

  const [creator] = row.project.createdBy
    ? await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, row.project.createdBy))
        .limit(1)
    : [];

  const links = await listProjectCompanies(session, id);

  return {
    ...row.project,
    won: row.won,
    ownerName: row.ownerName,

    cityNameEn: row.cityNameEn,
    cityNameAr: row.cityNameAr,
    lostReasonNameEn: row.lostReasonNameEn,
    lostReasonNameAr: row.lostReasonNameAr,
    createdByName: creator?.name ?? null,
    links,
  };
}

/**
 * Dispatched square metres per company on one project `S26`.
 *
 * **A dispatch reaches a project by its own `project_id`** `S74`, and by
 * nothing else since this slice — the join through `quotation_threads` is
 * gone, which is what `S74` moving the project onto the dispatch is FOR. A
 * dispatch with no project reaches none, which today is exactly the direct
 * route `S75`.
 *
 * Migration 0013 backfilled the column from each dispatch's thread, so the
 * figures this returns are unchanged for every row that existed before it.
 * `verify:schema25` §11 asserts the two agree for every dispatch ever written
 * — that is the invariant `recordDispatch` enforces, and the backfill landing
 * correctly is a consequence of it rather than a separate claim.
 *
 * Grouped by **the dispatch's own company**, not the thread's: `S26` says a
 * dispatch names its company, and the two can differ.
 *
 * A company with no dispatch is **absent from the map, never zero**. "Nothing
 * has gone out" and "0.0000 m² went out" are the same fact said two ways, and
 * only one of them is worth a number on a screen.
 *
 * `sum()` rather than a `sql` template: a Drizzle column interpolated into a
 * `sql` template in the SELECT list **loses its table qualifier**, and `S116`
 * has just made that load-bearing again — the sum is over `dispatch_lines`
 * while the grouping is over `dispatches`, so the join is back. It returns
 * `string | null`, so the decimal stays a string end to end `[22 §2]`.
 *
 * **Summed from the LINES since `S116`**, because `dispatches.sqm` is gone: a
 * dispatch's square metres are its lines' generated ones. An INNER join, so a
 * dispatch with no lines contributes nothing rather than a zero — there is no
 * such dispatch (`recordDispatch` refuses one, and `verify:schema25` §14 holds
 * every row to it), and a figure that quietly absorbed one would hide it.
 *
 * No visibility term of its own: the caller has already proved the project
 * visible, and a project's figures follow it `[20 §13]` — the same terms
 * `listDispatchableThreads` totals on.
 *
 * **Approved only** `S72`, through `dispatches.ts`'s one predicate rather than
 * a term written out here. That is the same argument this function's `sum()`
 * already makes about arithmetic: one definition, one place to change.
 */
async function dispatchedSqmByCompany(
  projectId: string,
): Promise<Map<string, string>> {
  const rows = await db
    .select({ companyId: dispatches.companyId, total: sum(dispatchLines.sqm) })
    .from(dispatches)
    .innerJoin(dispatchLines, eq(dispatchLines.dispatchId, dispatches.id))
    .where(
      and(
        // `S72` — *who bought* is derived from APPROVED dispatches. A request
        // sitting with the coordinator has not bought anything, and counting it
        // would put a participant's name against square metres that may yet be
        // refused.
        approvedDispatches(),
        eq(dispatches.projectId, projectId),
      ),
    )
    .groupBy(dispatches.companyId);

  return new Map(
    rows.flatMap((row) =>
      row.total === null ? [] : [[row.companyId, row.total] as const],
    ),
  );
}

/**
 * The live company links on a project: who is a participant `S25`, what each
 * has dispatched `S26`, and whether the viewer may open that company.
 *
 * Removed links are hidden `[14 §4]` — kept in the table, absent from the
 * screen. Ordered by name alone: there is no buyer to float to the top since
 * `S26`, and dispatched square metres are a fact about a participant rather
 * than a ranking of them.
 */
export async function listProjectCompanies(
  session: AuthSession,
  projectId: string,
): Promise<ProjectCompanyRow[]> {
  const rows = await db
    .select({
      id: projectCompanies.id,
      companyId: projectCompanies.companyId,
      companyName: companies.name,
    })
    .from(projectCompanies)
    .innerJoin(companies, eq(projectCompanies.companyId, companies.id))
    .where(
      and(
        eq(projectCompanies.projectId, projectId),
        isNull(projectCompanies.removedAt),
      ),
    )
    .orderBy(companies.name);

  if (rows.length === 0) return [];

  // One extra query rather than one per row: which of these companies is this
  // identity allowed to open on its own?
  const [viewableIds, dispatched] = await Promise.all([
    db
      .select({ id: companies.id })
      .from(companies)
      .where(
        and(
          inArray(
            companies.id,
            rows.map((row) => row.companyId),
          ),
          visibleCompaniesFilter(session),
        ),
      )
      .then((found) => new Set(found.map((row) => row.id))),
    dispatchedSqmByCompany(projectId),
  ]);

  return rows.map((row) => ({
    ...row,
    dispatchedSqm: dispatched.get(row.companyId) ?? null,
    viewable: viewableIds.has(row.companyId),
  }));
}

/* ------------------------------------------------------------------ *
 * Business rules, checked in the application layer
 * ------------------------------------------------------------------ */

/** `07 C5`, `04 Q18`, `25 §5` — a lost project has to say which of the nine. */
function assertLossReason(input: ProjectInput): void {
  if (input.endState === "lost" && !input.lostReasonId) {
    throw new RuleError("projects.errors.lossReasonRequired", "lostReasonId");
  }
}

/**
 * `25 §5`'s remaining half, owed since migration 0007 `[23]`: **`other`
 * requires the free-text detail; every other code forbids it.** A CHECK
 * cannot subquery `loss_reasons` to read the code behind a uuid, so it lives
 * here — `verify:schema25` §10 proves the writer and this rule agree.
 *
 * Gated on `endState === "lost"` first, same as `assertLossReason`: a stale
 * `lostReasonId` left in a hidden field by a rep who changed his mind about
 * being lost at all must be discarded, not validated, or the outer toggle on
 * the form would produce an error on a field the rep can no longer see.
 */
async function assertLossReasonDetail(input: ProjectInput): Promise<void> {
  if (input.endState !== "lost" || !input.lostReasonId) return;

  const code = await lossReasonCode(input.lostReasonId);
  if (!code) throw new RuleError("validation.invalid", "lostReasonId");

  const isOther = code === OTHER_LOSS_REASON_CODE;
  if (isOther && !input.lossReason) {
    throw new RuleError(
      "projects.errors.lossReasonDetailRequired",
      "lossReason",
    );
  }
  if (!isOther && input.lossReason) {
    throw new RuleError(
      "projects.errors.lossReasonDetailForbidden",
      "lossReason",
    );
  }
}

/** The three columns a loss writes, which move together `[25 §5]`. */
type ProjectLossFields = {
  lostReasonId: string | null;
  lostAt: Date | null;
  lossReason: string | null;
};

/**
 * What the loss columns become, given the form and the row as it stands.
 *
 * `25 §5` turns the loss reason from free text into **a reason plus its
 * detail**, and three database CHECKs hold the shape: the id and the date move
 * together, detail never appears without a reason, and a project that is not
 * lost carries none of them. So the three are decided in one place rather than
 * three, and both writers call it.
 *
 * **The reason is the rep's pick.** `lostReasonId` comes straight from the
 * form — `assertLossReason` already refused a loss with none, and
 * `assertLossReasonDetail` already refused a mismatched detail, so by the
 * time this runs the pair is known good.
 *
 * **Only becoming lost stamps the date.** Re-saving a project that is already
 * lost keeps the date it already had, so an unrelated edit — including
 * correcting the reason itself — does not rewrite when the loss happened.
 * Moving off `lost` clears all three, or `projects_loss_state` refuses the
 * row.
 */
async function lossFieldsFor(
  input: ProjectInput,
  before?: Pick<Project, "lostAt">,
): Promise<ProjectLossFields> {
  if (input.endState !== "lost") {
    return { lostReasonId: null, lostAt: null, lossReason: null };
  }
  return {
    lostReasonId: input.lostReasonId,
    lostAt: before?.lostAt ?? new Date(),
    lossReason: input.lossReason,
  };
}

/**
 * Every company id on the form must be one this identity may actually use.
 *
 * Checked in a single query rather than a loop, and composed with
 * `visibleCompaniesFilter` so it is the same rule the company list applies.
 * This is the guard that stops a tampered `<select>` from linking a project
 * to somebody else's company.
 */
async function assertCompaniesUsable(
  session: AuthSession,
  companyIds: string[],
): Promise<void> {
  if (companyIds.length === 0) return;
  const visible = await db
    .select({ id: companies.id })
    .from(companies)
    .where(
      and(inArray(companies.id, companyIds), visibleCompaniesFilter(session)),
    );
  if (visible.length !== new Set(companyIds).size) {
    throw new RuleError("projects.errors.companyNotVisible");
  }
}

/** `07 A9`, `12 §6`, and the unique index on (project, company). */
function assertLinksValid(links: ProjectCompanyLink[]): void {
  if (links.length === 0) {
    throw new RuleError("projects.errors.atLeastOneCompany");
  }
  const ids = links.map((link) => link.companyId);
  if (new Set(ids).size !== ids.length) {
    throw new RuleError("projects.errors.duplicateCompany");
  }
}

/* ------------------------------------------------------------------ *
 * Mutations
 * ------------------------------------------------------------------ */

export async function createProject(
  session: AuthSession,
  input: ProjectInput,
  links: ProjectCompanyLink[],
): Promise<Project> {
  assertLossReason(input);
  await assertLossReasonDetail(input);
  assertLinksValid(links);
  await assertCompaniesUsable(
    session,
    links.map((link) => link.companyId),
  );

  // The city decides the region, and with no city there is none `S15`. Read
  // before the transaction opens — it only reads, and a bad city id should not
  // have started one. The loss reason is the same: a lookup read, not a write.
  //
  // `regionForCity` no longer takes a fallback `[AUDIT 1 F3]`, so a posted
  // `input.region` is discarded here as it already was whenever a city was
  // chosen. Nothing has ever written one — 0 of 414 projects carry a region —
  // and the field's removal waits on the shape decision recorded in
  // `WORKFLOW §5`, because a project has no country to require a city against.
  const region = await regionForCity(input.cityId);
  const loss = await lossFieldsFor(input);

  return withAudit(session.actor, async (tx, log) => {
    const [project] = await tx
      .insert(projects)
      .values({
        ...input,
        ...loss,
        region,
        nameNormalized: normalizeName(input.name),
        // Created by a rep and belongs to him `[07 A8]`.
        ownerUserId: session.user.id,
        createdBy: session.user.id,
      })
      .returning();

    log({
      action: "project.created",
      entityType: "project",
      entityId: project.id,
      after: project,
    });

    // Through the one writer, like every other participant row `S27`.
    // `assertLinksValid` already refused a duplicate, so each of these
    // inserts.
    for (const link of links) {
      await ensureProjectParticipant(tx, log, project.id, link.companyId);
    }

    return project;
  });
}

const EDITABLE = [
  "name",
  "sqmExpected",
  "region",
  "cityId",
  "endState",
  // The three loss columns are diffed too `[25 §5]`, so the audit log carries
  // which reason was recorded and when — not only the text behind it.
  "lostReasonId",
  "lostAt",
  "lossReason",
  "inProduction",
  "committed",
] as const;

export async function updateProject(
  session: AuthSession,
  id: string,
  input: ProjectInput,
): Promise<Project> {
  if (!(await canViewRecord(session, "project", id))) {
    throw new RuleError("projects.errors.notFound");
  }
  assertLossReason(input);
  await assertLossReasonDetail(input);

  return withAudit(session.actor, async (tx, log) => {
    const [before] = await tx
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    if (!before) throw new RuleError("projects.errors.notFound");

    // What will actually be written: the region follows the city `[15 §4]`,
    // and the three loss columns follow the end state `[25 §5]`. The diff
    // compares against this rather than the form, so a region that changed
    // because the city changed — or a loss date stamped because the project
    // just became lost — is recorded as the change it is.
    const values = {
      ...input,
      ...(await lossFieldsFor(input, before)),
      region: await regionForCity(input.cityId),
    };

    const changed = EDITABLE.filter((key) => before[key] !== values[key]);
    if (changed.length === 0) return before;

    const [after] = await tx
      .update(projects)
      .set({ ...values, nameNormalized: normalizeName(values.name) })
      .where(eq(projects.id, id))
      .returning();

    log({
      action: "project.updated",
      entityType: "project",
      entityId: id,
      before: Object.fromEntries(changed.map((key) => [key, before[key]])),
      after: Object.fromEntries(changed.map((key) => [key, after[key]])),
    });
    return after;
  });
}

/** Shared gate for the two link operations: adding one and removing one. */
async function assertProjectEditable(
  session: AuthSession,
  projectId: string,
): Promise<void> {
  if (!(await canViewRecord(session, "project", projectId))) {
    throw new RuleError("projects.errors.notFound");
  }
}

/**
 * Link a company to a project unless it already is one `S27`, in the caller's
 * transaction. Returns false when a live link was already there.
 *
 * **This is the only place a participant row is written.** It was exported for
 * `S74`'s second way in — dispatching a project-less quotation added the
 * quotation's company to the project it gained — and that way in went with
 * `S50`'s null case, so the export went with it. Both callers are in this
 * file.
 *
 * "Already one" means a LIVE link. A removed link is re-linked with a new row
 * rather than resurrected, which is what `project_companies_key` — partial on
 * `removed_at is null` — exists to allow `[14 §4]`.
 *
 * No visibility check of its own: each caller has its own, and they differ.
 * A rep must be able to use the company `[12 §6]`; the coordinator dispatching
 * has `can_dispatch`'s reach and no company visibility at all `[18 §2]`.
 */
async function ensureProjectParticipant(
  tx: Tx,
  log: Log,
  projectId: string,
  companyId: string,
): Promise<boolean> {
  const [existing] = await tx
    .select({ id: projectCompanies.id })
    .from(projectCompanies)
    .where(
      and(
        eq(projectCompanies.projectId, projectId),
        eq(projectCompanies.companyId, companyId),
        isNull(projectCompanies.removedAt),
      ),
    )
    .limit(1);
  if (existing) return false;

  const [row] = await tx
    .insert(projectCompanies)
    .values({ projectId, companyId })
    .returning();
  log({
    action: "project_company.linked",
    entityType: "project_company",
    entityId: row.id,
    after: row,
  });
  return true;
}

export async function addProjectCompany(
  session: AuthSession,
  projectId: string,
  link: ProjectCompanyLink,
): Promise<void> {
  await assertProjectEditable(session, projectId);
  await assertCompaniesUsable(session, [link.companyId]);

  await withAudit(session.actor, async (tx, log) => {
    // A rep who picks a company that is already on the project is told so;
    // `S74`'s write-back, which cannot know either way, is not.
    const linked = await ensureProjectParticipant(
      tx,
      log,
      projectId,
      link.companyId,
    );
    if (!linked) throw new RuleError("projects.errors.duplicateCompany");
  });
}

/**
 * Take a company off a project `[14 §4]`.
 *
 * Soft: the row is kept and hidden, like every other state change in FACET
 * `[09 §1]`. The last live link cannot be removed — a project requires at
 * least one company `[07 A9]`, and that rule does not stop applying because
 * the removal is spelled differently.
 */
export async function removeProjectCompany(
  session: AuthSession,
  projectId: string,
  linkId: string,
): Promise<void> {
  await assertProjectEditable(session, projectId);

  await withAudit(session.actor, async (tx, log) => {
    const live = await tx
      .select()
      .from(projectCompanies)
      .where(
        and(
          eq(projectCompanies.projectId, projectId),
          isNull(projectCompanies.removedAt),
        ),
      );

    const target = live.find((row) => row.id === linkId);
    if (!target) throw new RuleError("projects.errors.notFound");
    if (live.length <= 1) throw new RuleError("projects.errors.lastCompany");

    const [after] = await tx
      .update(projectCompanies)
      .set({ removedAt: new Date() })
      .where(eq(projectCompanies.id, linkId))
      .returning();

    log({
      action: "project_company.removed",
      entityType: "project_company",
      entityId: linkId,
      before: target,
      after: { removedAt: after.removedAt },
    });
  });
}
