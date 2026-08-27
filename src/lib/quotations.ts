/**
 * Quotations — the data layer `09 §5`, and the chain `04 flow 6–13` describes.
 *
 * One **thread** per deal, with **versions** on it. The rep's request *is*
 * version 1: status `requested`, no SMAC reference `[10 §4]`, `[04 flow 6]`.
 * The coordinator creates the real document in SMAC and records its reference,
 * which makes that version `issued`. A revision is version 2 carrying the `RE`
 * number `[07 C2]`; earlier versions go `superseded` and are read-only, and
 * only the latest is live. Both routes produce a version — the rep asking for
 * a change, and the coordinator editing directly.
 *
 * Visibility is `visibleQuotationThreadsFilter` and nothing else: the raising
 * rep, an explicit thread share, or visibility of the parent project
 * `[11 §2]`. No query in this file writes its own predicate.
 *
 * **A thread always names a project** `S50`, since migration `0031` made
 * `project_id` NOT NULL. Every join onto `projects` here is therefore an INNER
 * join, and the LEFT joins this note used to require came out with the null
 * case: there is no project-less thread for one to rescue. A dispatch takes
 * that project rather than writing one back `S74`.
 *
 * Money is computed, never typed `[16 §1]`. SMAC still owns it: `08 D5`
 * governs disagreement, and computing the mirror removes the commonest way the
 * two diverge. Every figure stays a string end to end — a square-metre number
 * the business is measured on must not pass through a float.
 *
 * **`accepted` is internal approval, not a won deal** `S65`. It means the
 * coordinator has the signatures; the customer is then deciding, which `S132`
 * calls *with the customer* and names the longest wait in the business. Nothing
 * that counts, ranks or forecasts may read the end state as "bought" — winning
 * is an approved dispatch `S31` and nothing else.
 */

import {
  and,
  asc,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { QueryBuilder, type AnyPgColumn } from "drizzle-orm/pg-core";

import {
  CHAIN_GROUPS,
  chainGroup,
  chainState,
  type ChainGroup,
  type ChainPosition,
} from "@/lib/chain";
import { db } from "@/db";
import {
  companies,
  contacts,
  dispatches,
  productClasses,
  productFireRatings,
  productSuppliers,
  productThicknesses,
  projectCompanies,
  projects,
  quotationLines,
  quotationServiceLines,
  quotationThreads,
  quotationVersions,
  serviceTypes,
  users,
} from "@/db/schema";
import { withAudit, type AuditEntry } from "@/lib/audit";
/**
 * `S31`'s one won predicate, composed rather than hand-written a ninth time —
 * `dispatches.ts` records what eight copies of `status = 'approved'` cost.
 *
 * **This closes a two-module cycle** (`dispatches.ts` imports
 * `productLineMoney` and `quotationVersionLines` from here) and it is safe for
 * the reason that file's own import note already gives: no side of it is used
 * at module-evaluation time. `approvedDispatches()` is called inside a query
 * builder, and both of its imports from here are called at runtime.
 */
import { approvedDispatches } from "@/lib/dispatches";
import {
  MONEY_SCALE,
  SQM_SCALE,
  ZERO,
  divideRounded,
  fromScaled,
  pow10,
  toScaled,
} from "@/lib/decimal";
import {
  can,
  canOpenRecord,
  canViewRecord,
  ownProjectsFilter,
  visibleCompaniesFilter,
  visibleQuotationThreadsFilter,
  type AuthSession,
} from "@/lib/authz";
// `25 §13` — the return-for-edit reason is a comment. See the note in
// `comments.ts` about the import cycle this closes, and why it is safe.
import { insertComment } from "@/lib/comments";
import { normalizeName } from "@/lib/normalize";
import {
  NOTIFICATION_TYPES,
  QUOTATION_THREAD_END_STATES,
  QUOTATION_VERSION_ORIGINS,
  QUOTATION_VERSION_STATUSES,
  SMAC_VERIFICATIONS,
  STOCKS,
  VAT_RATE,
  type QuotationThreadEndState,
  type QuotationVersionOrigin,
  type QuotationVersionStatus,
  type SameValues,
  type SmacVerification,
  type Stock,
} from "@/lib/enums";
// `S128` — the telling. `comments.ts` already imports `raise`, so this module
// reached it indirectly through `insertComment`; naming it here is what lets a
// decision that writes no comment still tell somebody.
import { raise, type DecisionKind } from "@/lib/notifications";
import { RuleError } from "@/lib/validation";

export type QuotationThread = typeof quotationThreads.$inferSelect;
export type QuotationVersion = typeof quotationVersions.$inferSelect;

/** Compile-time proof that `enums.ts` still matches the database. */
export type ThreadEndStateMatchesSchema = SameValues<
  QuotationThreadEndState,
  NonNullable<QuotationThread["endState"]>
>;
export type VersionStatusMatchesSchema = SameValues<
  QuotationVersionStatus,
  QuotationVersion["status"]
>;
export type VersionOriginMatchesSchema = SameValues<
  QuotationVersionOrigin,
  QuotationVersion["origin"]
>;
export type SmacVerificationMatchesSchema = SameValues<
  SmacVerification,
  QuotationVersion["smacReferenceVerification"]
>;
/** `S118` — the four stocks. Not nullable, so no `NonNullable` here. */
export type StockMatchesSchema = SameValues<Stock, QuotationVersion["stock"]>;

export {
  QUOTATION_THREAD_END_STATES,
  QUOTATION_VERSION_ORIGINS,
  QUOTATION_VERSION_STATUSES,
  SMAC_VERIFICATIONS,
  STOCKS,
};
export type {
  QuotationThreadEndState,
  QuotationVersionOrigin,
  QuotationVersionStatus,
  SmacVerification,
  Stock,
};

const PAGE_SIZE = 25;

/* ------------------------------------------------------------------ *
 * Quotation arithmetic `[16 §1]`
 *
 * The engine itself lives in `@/lib/decimal` — scaled `bigint`, never a float,
 * one implementation for the three features that need it `[18 §5]`. What stays
 * here is the arithmetic that is specifically about a quotation line.
 * ------------------------------------------------------------------ */

/**
 * `unit_price × sqm`, rounded to money scale.
 *
 * The unit price is **per square metre** `[16 §1]`, not per sheet — the
 * founder's own statement of the rule. Verified against quotation 9592:
 * `12 × 1.24 × 5.8 = 86.3040` m² at 120.00 → `10,356.48`.
 */
function multiplyMoneyBySqm(moneyScaled: bigint, sqmScaled: bigint): bigint {
  return divideRounded(moneyScaled * sqmScaled, pow10(SQM_SCALE));
}

/** `amount × rate ÷ 100`, both at money scale, result at money scale. */
function applyPercent(amountScaled: bigint, rateScaled: bigint): bigint {
  return divideRounded(amountScaled * rateScaled, pow10(MONEY_SCALE + 2));
}

/* ------------------------------------------------------------------ *
 * Qualification — derived from the event, never a field `[10 §1]`, `[04]`
 * ------------------------------------------------------------------ */

const subquery = new QueryBuilder();

/**
 * `exists (select 1 from quotation_threads where company_id = <column>)`.
 *
 * A company becomes qualified when a quotation is requested against it
 * `[04 qualification]`, `[10 §1]`. The system knows this from the event and
 * nobody ticks a box — so this is a correlated predicate, not a column, and
 * there is nothing to keep in step.
 *
 * Exported for `companies.ts`. The dependency runs one way only: nothing here
 * imports the companies module.
 */
export function companyIsQualified(companyIdColumn: AnyPgColumn): SQL<boolean> {
  // Typed through `sql<boolean>` because `exists()` is `SQL<unknown>`, and
  // this is selected as a column rather than only used in a WHERE. The cast
  // is honest: `exists` really does evaluate to a boolean in Postgres.
  return sql<boolean>`${exists(
    subquery
      .select({ one: sql`1` })
      .from(quotationThreads)
      .where(eq(quotationThreads.companyId, companyIdColumn)),
  )}`;
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

export type QuotationThreadListRow = {
  id: string;
  /** Always set `S50` — raising names a project or creates one. */
  projectId: string;
  projectName: string;
  companyId: string;
  companyName: string;
  raisedByName: string;
  /**
   * Who raised it, as an **id** — so a screen can ask *is this mine?* rather
   * than comparing display names.
   *
   * The name alone was what made `chainTurnKey` name the rep in the third
   * person: two people called Mohammed would read each other's turn as their
   * own. This is the honest comparison, and it is free — `raisedByUserId` is
   * already the join key the row's name comes through.
   */
  raisedByUserId: string;
  endState: QuotationThreadEndState | null;
  smacReference: string | null;
  versionNumber: number;
  versionStatus: QuotationVersionStatus;
  /**
   * The live version's quoted square metres.
   *
   * Here for `25 §22`'s flag on a project with more than one open thread —
   * *"3 open quotations · 5,800 m² quoted against 2,000 expected"* — which is
   * the **one** place quotations are added up, and only to show that adding
   * them up is meaningless `[25 §21]`. A list row must never sum it across
   * rows for any other purpose.
   */
  totalSqm: string | null;
  createdAt: Date;
  /**
   * Where this thread sits `S132`, from `chainState()` and nothing else `D27`.
   *
   * **Carried rather than re-derived by each reader.** Three screens folded the
   * same two fields themselves before session 26, and two of them passed no
   * dispatch flag — so a shipped thread read *with the customer* on the list,
   * on the company page and on the project page, and *won* on its own. The
   * ladder is read once, here, where the flags are in scope.
   */
  position: ChainPosition;
  /** `D25`'s pile — a fold of `chainOwner`, never a second answer. */
  group: ChainGroup;
};

/**
 * The three group counts over the **whole visible scope**, never the page.
 *
 * A header counting only the rows that landed on this page would read
 * *Waiting on the coordinator · 25* on every page but the last — the reason
 * `listCompanies` takes its counts from the same pass as the total `D24`.
 */
export type QuotationGroupCounts = Record<ChainGroup, number>;

/** The live version of each thread: the one that is not superseded. */
function liveVersionFilter(): SQL {
  return ne(quotationVersions.status, "superseded");
}

/**
 * Free-text search over the reference, the project and the company.
 *
 * **The two names match `name_normalized`**, the shape `companies.ts` and
 * `projects.ts` have used since `0030`. This list compared the raw columns
 * until session 26, so one query string found a row on `/companies` and
 * `/projects` and missed it here: `Al Rajhi` missed `Al-Rajhi`, `Cafe` missed
 * `Café`, `احمد` missed `أحمد`, and `مشروع 24` missed `مشروع ٢٤`. Punctuation,
 * Latin accents, Arabic diacritics, alef and ya variants, tatweel and
 * Arabic-Indic digits are all folded on the stored side and were not on the
 * asked side, which is a miss that raises no error.
 *
 * **The reference stays raw**, deliberately — it is an identifier, not a name,
 * and `normalizeName` would fold `RE-9592` and `re9592` together. The same
 * reason `companies.ts` leaves `phone` out of the folded half.
 */
function searchFilter(query: string | undefined): SQL | undefined {
  const trimmed = query?.trim();
  if (!trimmed) return undefined;
  const folded = `%${normalizeName(trimmed)}%`;
  return or(
    sql`${quotationVersions.smacReference} ilike ${`%${trimmed}%`}`,
    sql`${projects.nameNormalized} ilike ${folded}`,
    sql`${companies.nameNormalized} ilike ${folded}`,
  );
}

/**
 * **`S132`'s last two rungs, asked of a thread** — the two flags `chainState`
 * cannot reach from a thread row, resolved in SQL so the fold below sees a
 * complete chain and no screen has to guess.
 *
 * `/quotations` passed neither until session 26, so the list could never render
 * `readyToShip` or `won`: a thread with an approved dispatch read *"waiting on
 * the rep — chase the customer"* on the list and *"nothing outstanding — won"*
 * on its own detail page, which loads both. One function, two screens, two
 * answers, and no error.
 *
 * **Both tables are named outright** in the correlated predicate, per
 * `CLAUDE.md` — the outer query does join, so the qualifiers would survive
 * anyway, but the rule is not conditional on remembering that.
 */
function threadHasApprovedDispatch(): SQL<boolean> {
  return sql<boolean>`${exists(
    subquery
      .select({ one: sql`1` })
      .from(dispatches)
      .where(
        and(
          eq(dispatches.quotationThreadId, quotationThreads.id),
          approvedDispatches(),
        ),
      ),
  )}`;
}

/**
 * `submitted`, and a `draft` deliberately does not qualify `S132` — a draft is
 * still the rep's own to edit `S125` and can sit indefinitely, so without that
 * narrowing a rep would advance his own chain by opening a form.
 */
function threadHasSubmittedDispatch(): SQL<boolean> {
  return sql<boolean>`${exists(
    subquery
      .select({ one: sql`1` })
      .from(dispatches)
      .where(
        and(
          eq(dispatches.quotationThreadId, quotationThreads.id),
          eq(dispatches.status, "submitted"),
        ),
      ),
  )}`;
}

export async function listQuotationThreads(
  session: AuthSession,
  options: {
    q?: string;
    projectId?: string;
    companyId?: string;
    /**
     * `D65`'s first column — the requests **needing issuing**, oldest first.
     *
     * **The predicate is `chain.ts`'s, not a second one.** A thread whose live
     * version is still `requested` sits at chain position `requested`, and
     * `chainOwner` says that position is owed by the **coordinator** `[07 C2]`
     * — she builds the real quotation in SMAC. `D27` makes that file the only
     * ladder, so this composes its answer in SQL rather than restating it.
     *
     * **A returned-for-edit version is deliberately still here.** `S72`'s
     * queue and `quotationReturned` in `follow-ups.ts` disagree about those:
     * the follow-up chases the rep until they touch the lines, while the chain
     * says a `requested` version is hers. Following the chain is the founder's
     * call for this slice — a second ladder in this module is exactly the trap
     * `chain.ts` exists to prevent — and the tension is a row in `WORKFLOW §5`.
     *
     * **A queue is oldest first** `S87`, so this orders ascending, the same
     * way `listDispatches` orders its submitted scope.
     */
    awaitingIssue?: boolean;
    page?: number;
  } = {},
): Promise<{
  rows: QuotationThreadListRow[];
  total: number;
  page: number;
  groupCounts: QuotationGroupCounts;
  foreignRaiserCount: number;
}> {
  const page = Math.max(1, options.page ?? 1);
  const where = and(
    visibleQuotationThreadsFilter(session),
    liveVersionFilter(),
    searchFilter(options.q),
    options.awaitingIssue
      ? and(
          eq(quotationVersions.status, "requested"),
          isNull(quotationThreads.endState),
        )
      : undefined,
    options.projectId
      ? eq(quotationThreads.projectId, options.projectId)
      : undefined,
    options.companyId
      ? eq(quotationThreads.companyId, options.companyId)
      : undefined,
  );

  const base = () =>
    db
      .select({
        id: quotationThreads.id,
        projectId: quotationThreads.projectId,
        projectName: projects.name,
        companyId: quotationThreads.companyId,
        companyName: companies.name,
        raisedByName: users.name,
        raisedByUserId: quotationThreads.raisedByUserId,
        endState: quotationThreads.endState,
        smacReference: quotationVersions.smacReference,
        versionNumber: quotationVersions.versionNumber,
        versionStatus: quotationVersions.status,
        totalSqm: quotationVersions.totalSqm,
        createdAt: quotationThreads.createdAt,
        // `S132`'s last two rungs, resolved in SQL so the fold below sees a
        // complete chain — see the two predicates above.
        hasDispatch: threadHasApprovedDispatch(),
        hasSubmittedDispatch: threadHasSubmittedDispatch(),
      })
      .from(quotationThreads)
      .innerJoin(
        quotationVersions,
        eq(quotationVersions.threadId, quotationThreads.id),
      )
      // INNER since `S50`. There is no second `count()` query to keep in step
      // any more — the total is the folded length, so the page and the count
      // cannot disagree about which rows exist.
      .innerJoin(projects, eq(quotationThreads.projectId, projects.id))
      .innerJoin(companies, eq(quotationThreads.companyId, companies.id))
      .innerJoin(users, eq(quotationThreads.raisedByUserId, users.id));

  // **Ordered oldest first in SQL, before anything is folded.** Within a group
  // the longest-waiting thread leads — `S87`'s shape, and the order
  // `awaitingIssue` already wanted. **What it measures is stated rather than
  // implied: how old the DEAL is, not how long this position has been owed.**
  // No `issued_at` or `accepted_at` exists, and the audit-log clock that would
  // answer properly is `follow-ups.ts`'s, covering one position of six — a
  // second ladder in the place `D27` pins to one file, which is a rule change
  // and not a slice decision.
  const found = await base().where(where).orderBy(asc(quotationThreads.createdAt));

  // **The whole visible scope is fetched, then folded, then cut.** This is the
  // cost of one definition, and it is the same bargain `awaitingSignatureCount`
  // below and `listProjectBoard` in `projects.ts` already strike: deriving
  // `D25`'s groups in SQL would restate the six-position ladder `D27` pins to
  // `chain.ts`, which is exactly the drift that module exists to prevent.
  //
  // `CLAUDE.md` forbids filtering or ordering **a page** after fetching it,
  // because the rows that fall out are silently gone. Nothing here is
  // paginated before the fold, so no row can fall out and every count is the
  // true one. **73 threads today**, against the 56 projects `listProjectBoard`
  // already fetches unpaginated for the same reason.
  const buckets = new Map<ChainGroup, QuotationThreadListRow[]>(
    CHAIN_GROUPS.map((group) => [group, []]),
  );
  // **Raisers who are not the reader**, by id. See the return below for why
  // the reader is excluded rather than counted.
  const foreignRaisers = new Set<string>();

  for (const row of found) {
    const { hasDispatch, hasSubmittedDispatch, ...rest } = row;
    // The one ladder, read once, with both flags in scope `S132` `D27`.
    const { position } = chainState({
      versionStatus: rest.versionStatus,
      endState: rest.endState,
      hasDispatch,
      hasSubmittedDispatch,
    });
    const group = chainGroup(position);
    buckets.get(group)!.push({ ...rest, position, group });
    if (rest.raisedByUserId !== session.user.id) {
      foreignRaisers.add(rest.raisedByUserId);
    }
  }

  // `CHAIN_GROUPS`' own order, so the piles read coordinator → customer →
  // nothing outstanding and a group is a contiguous run the screen can head
  // without re-sorting.
  const ordered = CHAIN_GROUPS.flatMap((group) => buckets.get(group)!);

  return {
    rows: ordered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total: ordered.length,
    page,
    groupCounts: {
      coordinator: buckets.get("coordinator")!.length,
      customer: buckets.get("customer")!.length,
      none: buckets.get("none")!.length,
    },
    // **What decides whether the row names its raiser at all** — counted over
    // the whole visible scope, never this page, so the column cannot appear on
    // page 1 and vanish on page 2.
    //
    // **The reader is not one of them, and that is the correction.** This was
    // `raiserCount`, every distinct raiser, and `> 1` was the test — the shape
    // `listProjects` still carried. It fires on a scope that is almost entirely
    // the reader's own work: rep-a sees **71 threads he raised and 1 reaching
    // him through a shared project**, which is two raisers, so the column
    // rendered and printed his own name 71 times. Counting only the others
    // answers `D2` directly — *the reader's own name on every row says nothing*
    // — and the two readings differ on exactly the case that matters.
    //
    // It is not a narrower column: a manager or the coordinator raised none of
    // what they read, so every row still names somebody. What changes is the
    // rep, for whom **the cell is blank where he raised it** and blank means
    // *mine*.
    foreignRaiserCount: foreignRaisers.size,
  };
}

/**
 * How many visible quotation threads are **waiting on a signature** — `D32`'s
 * first side figure.
 *
 * **A count, never a sum.** `S68`: quotations are never added up, because one
 * project quoted three times at 2,000 m² is the same 2,000 counted three times.
 * The square metres of these threads are deliberately not returned.
 *
 * The position comes from `chainState()` — the one definition `S132` — on the
 * same two fields `/quotations` reads for its own turn column, so the dashboard
 * cannot disagree with the list it links to. Restating the ladder in SQL would
 * be the second derivation that module exists to prevent.
 *
 * **`S132` renamed the position this counts** — `waitingSignature` is `quoted`,
 * and the figure is unchanged: the predicate was always *the live version is
 * issued and the thread is not accepted*, which is the price existing, never
 * somebody waiting to sign `S65`. `D32` keeps the side figure and follows the
 * name.
 *
 * **Unpaginated, and that is the cost of one definition.** It reads every
 * visible thread's live version — three small columns — and grows linearly
 * with the reader's book: fine at one rep's ~60 companies, and the same
 * ceiling `listQuotationFormOptions` and `listDispatchableThreads` carry
 * (`WORKFLOW §5`). A `sees_all_reps` identity reads the whole company.
 */
export async function quotedCount(
  session: AuthSession,
): Promise<number> {
  const rows = await db
    .select({
      versionStatus: quotationVersions.status,
      endState: quotationThreads.endState,
    })
    .from(quotationThreads)
    .innerJoin(
      quotationVersions,
      eq(quotationVersions.threadId, quotationThreads.id),
    )
    .where(and(visibleQuotationThreadsFilter(session), liveVersionFilter()));

  return rows.filter((row) => chainState(row).position === "quoted").length;
}

export type QuotationProjectOption = {
  id: string;
  name: string;
  companies: { id: string; name: string }[];
};

export type QuotationFormOptions = {
  projects: QuotationProjectOption[];
  /**
   * Every company this identity may name. **The form's first field** since
   * `S50`: the rep picks the company, and the projects above are then narrowed
   * to those it is linked to `[16 §6]`. It was the fallback half until the
   * form inverted — the list used when there was no project to narrow by.
   */
  companies: { id: string; name: string }[];
  /** Their contacts, flat. A contact belongs to a company, never to a
   *  project, so one list serves both halves of the form `[07 A2]`. */
  contacts: { id: string; companyId: string; name: string }[];
};

/**
 * What the new-quotation form may choose from: every visible company with its
 * contacts, and the projects this identity can see, each with its **live**
 * company links.
 *
 * **The same data, read the other way round since `S50`.** The company is
 * chosen first, and the projects offered are those whose links include it
 * `[16 §6]` — which the form filters from what is already here, so the
 * inversion added no query. It is still built from the rule the server then
 * enforces: a dropdown that offers what the action refuses is how a rule
 * becomes a bug report.
 *
 * **The projects are `ownProjectsFilter`, not `visibleProjectsFilter`** — the
 * same sentence, applied to `S76`. `createQuotationThread` gates the project on
 * `canViewRecord`, which `S76` deliberately leaves narrow, so the read filter
 * here would offer a coordinator every project in the company and have each one
 * refused on submit.
 *
 * Separate queries rather than one join, so a project with twenty contacts does
 * not arrive twenty times.
 */
export async function listQuotationFormOptions(
  session: AuthSession,
): Promise<QuotationFormOptions> {
  const [visibleProjects, visibleCompanies] = await Promise.all([
    db
      .select({
        id: projects.id,
        name: projects.name,
      })
      .from(projects)
      .where(ownProjectsFilter(session))
      .orderBy(asc(projects.name)),
    // The project-less half `S50`. Ordinary company visibility, the same rule
    // `listCompanyOptions` composes for the contact and project forms.
    db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(visibleCompaniesFilter(session))
      .orderBy(asc(companies.name)),
  ]);

  const projectIds = visibleProjects.map((row) => row.id);
  const links = projectIds.length
    ? await db
        .select({
          projectId: projectCompanies.projectId,
          companyId: companies.id,
          name: companies.name,
        })
        .from(projectCompanies)
        .innerJoin(companies, eq(projectCompanies.companyId, companies.id))
        .where(
          and(
            inArray(projectCompanies.projectId, projectIds),
            isNull(projectCompanies.removedAt),
          ),
        )
        .orderBy(asc(companies.name))
    : [];

  // Every company either half of the form can offer, so one contact list
  // serves both. A project's participant the viewer cannot otherwise see is
  // still on this list, exactly as `16 §6` already allowed.
  const companyIds = [
    ...new Set([
      ...links.map((row) => row.companyId),
      ...visibleCompanies.map((row) => row.id),
    ]),
  ];
  const contacts_ = companyIds.length
    ? await db
        .select({
          id: contacts.id,
          companyId: contacts.companyId,
          name: contacts.name,
        })
        .from(contacts)
        .where(inArray(contacts.companyId, companyIds))
        .orderBy(asc(contacts.name))
    : [];

  return {
    projects: visibleProjects.map((project) => ({
      ...project,
      companies: links
        .filter((link) => link.projectId === project.id)
        .map(({ companyId, name }) => ({ id: companyId, name })),
    })),
    companies: visibleCompanies,
    contacts: contacts_,
  };
}

/**
 * One product line, as **ordinary readable fields** `S53`.
 *
 * There was a `displayName` here until `S53`: `productDisplayName` reassembled
 * SMAC's own code — `N- CA FR 168`, space after the hyphen and all — and that
 * string was the line's headline on every screen. FACET does not reproduce
 * SMAC's code format, so the parts travel as parts and each screen writes them
 * the way a person reads them.
 *
 * The names come from joins `loadLines` already made for the code, so this
 * costs no extra query. They travel as `En`/`Ar` pairs and the screen resolves
 * them with `lookupName`, the way project names already do — a lookup added
 * next year cannot appear in `messages/*.json`.
 */
export type QuotationLineRow = {
  id: string;
  supplierId: string;
  supplierNameEn: string;
  supplierNameAr: string;
  classId: string;
  classNameEn: string;
  classNameAr: string;
  fireRatingId: string;
  fireRatingNameEn: string;
  fireRatingNameAr: string;
  customColour: string | null;
  thicknessId: string;
  /** Trailing zeros off a `numeric(5,2)`: `"4.00"` reads as `4`, not `4.00`. */
  thicknessMm: string;
  widthM: string;
  lengthM: string;
  quantityPcs: string;
  sqm: string | null;
  unitPrice: string | null;
  lineTotal: string | null;
  /** At `VAT_RATE`, always `S57`. The rate itself is stored nowhere. */
  vatAmount: string | null;
};

export type QuotationServiceLineRow = {
  id: string;
  serviceTypeId: string;
  serviceNameEn: string;
  serviceNameAr: string;
  quantity: string;
  unit: string;
  unitPrice: string | null;
  quotationLineId: string | null;
  /** Computed, like every other money figure `[16 §1]`. */
  lineTotal: string | null;
};

export type QuotationVersionDetail = QuotationVersion & {
  createdByName: string | null;
  lines: QuotationLineRow[];
  serviceLines: QuotationServiceLineRow[];
};

export type QuotationThreadDetail = QuotationThread & {
  /** Always set `S50`, and it may hold either script `D62`. */
  projectName: string;
  companyName: string;
  contactName: string | null;
  raisedByName: string;
  cancelledByName: string | null;
  versions: QuotationVersion[];
  live: QuotationVersionDetail;
  /**
   * Whether the viewer may open the project and company records themselves.
   *
   * Seeing a quotation shows you the project title, the company name and the
   * contact name — a quotation without them is unreadable — but it does not
   * grant access to those records `[16 §10]`. False renders the name as plain
   * text rather than a link, the same way `listProjectCompanies` already does.
   *
   * **`S76` moved the coordinator's half of that.** They still see none of the
   * company detail behind a quotation, so `companyViewable` is false for them
   * as before; the project is now theirs to open, because a dispatch carries
   * one `S74`. Reading it is all they gain — every write on that project is
   * still refused.
   */
  projectViewable: boolean;
  companyViewable: boolean;
};

async function loadLines(versionId: string): Promise<QuotationLineRow[]> {
  const rows = await db
    .select({
      line: quotationLines,
      supplierNameEn: productSuppliers.nameEn,
      supplierNameAr: productSuppliers.nameAr,
      classNameEn: productClasses.nameEn,
      classNameAr: productClasses.nameAr,
      fireRatingNameEn: productFireRatings.nameEn,
      fireRatingNameAr: productFireRatings.nameAr,
      thicknessMm: productThicknesses.thicknessMm,
    })
    .from(quotationLines)
    .innerJoin(
      productSuppliers,
      eq(quotationLines.supplierId, productSuppliers.id),
    )
    .innerJoin(productClasses, eq(quotationLines.classId, productClasses.id))
    .innerJoin(
      productFireRatings,
      eq(quotationLines.fireRatingId, productFireRatings.id),
    )
    .innerJoin(
      productThicknesses,
      eq(quotationLines.thicknessId, productThicknesses.id),
    )
    .where(eq(quotationLines.versionId, versionId))
    .orderBy(asc(quotationLines.createdAt));

  return rows.map(({ line, ...parts }) => ({
    id: line.id,
    supplierId: line.supplierId,
    supplierNameEn: parts.supplierNameEn,
    supplierNameAr: parts.supplierNameAr,
    classId: line.classId,
    classNameEn: parts.classNameEn,
    classNameAr: parts.classNameAr,
    fireRatingId: line.fireRatingId,
    fireRatingNameEn: parts.fireRatingNameEn,
    fireRatingNameAr: parts.fireRatingNameAr,
    customColour: line.customColour,
    thicknessId: line.thicknessId,
    thicknessMm: parts.thicknessMm.replace(/\.?0+$/, ""),
    widthM: line.widthM,
    lengthM: line.lengthM,
    quantityPcs: line.quantityPcs,
    sqm: line.sqm,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
    vatAmount: line.vatAmount,
  }));
}

/**
 * A version's product lines, for the one caller outside this module `S120`.
 *
 * `dispatches.ts` compares a dispatch to *the version it was raised from*, and
 * the dispatch screen renders that version's lines beside the dispatched ones
 * when the two differ. Both need what `loadLines` already builds — the four
 * lookup names resolved `S53` — and a second loader over `quotation_lines`
 * would be a second answer to the same question, drifting on the thickness
 * trim or on which columns count.
 *
 * No visibility term, exactly as `loadLines` has none: the caller has already
 * decided whether this identity may see the record, and `getDispatch` asks
 * `canOpenRecord` for the thread before it renders a line of it.
 */
/**
 * Recompute a version's four totals, for the verify scripts that write a
 * `quotation_versions` row **by hand** — NOT a feature.
 *
 * Two of them do (`verify-phase9`, `verify-phase10a`), to reach a state their
 * own subject needs without going through the quotation gates, and since `S60`
 * is asserted over every row they each have to give their version a product
 * line. A line without its totals would leave the version's stored figures
 * disagreeing with the line they are made of — which `S77` reads as
 * `quotedSqm`.
 *
 * Exported rather than copied for `productLineMoney`'s reason: a fixture
 * holding its own arithmetic fails the totals checks for a reason about the
 * fixture, which is the least useful failure a verify script can produce.
 */
export function recomputeQuotationVersionTotals(
  versionId: string,
): Promise<void> {
  return db.transaction((tx) => recomputeVersionTotals(tx, versionId));
}

export function quotationVersionLines(
  versionId: string,
): Promise<QuotationLineRow[]> {
  return loadLines(versionId);
}

async function loadServiceLines(
  versionId: string,
): Promise<QuotationServiceLineRow[]> {
  const rows = await db
    .select({
      line: quotationServiceLines,
      serviceNameEn: serviceTypes.nameEn,
      serviceNameAr: serviceTypes.nameAr,
    })
    .from(quotationServiceLines)
    .innerJoin(
      serviceTypes,
      eq(quotationServiceLines.serviceTypeId, serviceTypes.id),
    )
    .where(eq(quotationServiceLines.versionId, versionId))
    .orderBy(asc(quotationServiceLines.createdAt));

  return rows.map(({ line, serviceNameEn, serviceNameAr }) => ({
    id: line.id,
    serviceTypeId: line.serviceTypeId,
    serviceNameEn,
    serviceNameAr,
    quantity: line.quantity,
    unit: line.unit,
    unitPrice: line.unitPrice,
    quotationLineId: line.quotationLineId,
    lineTotal: line.unitPrice
      ? fromScaled(
          multiplyMoneyBySqm(
            toScaled(line.unitPrice, MONEY_SCALE),
            toScaled(line.quantity, SQM_SCALE),
          ),
          MONEY_SCALE,
        )
      : null,
  }));
}

async function loadVersionDetail(
  version: QuotationVersion,
): Promise<QuotationVersionDetail> {
  const [creator] = version.createdBy
    ? await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, version.createdBy))
        .limit(1)
    : [];

  const [lines, serviceLines] = await Promise.all([
    loadLines(version.id),
    loadServiceLines(version.id),
  ]);

  return {
    ...version,
    createdByName: creator?.name ?? null,
    lines,
    serviceLines,
  };
}

export async function getQuotationThread(
  session: AuthSession,
  id: string,
): Promise<QuotationThreadDetail | null> {
  const [row] = await db
    .select({
      thread: quotationThreads,
      projectName: projects.name,
      companyName: companies.name,
      contactName: contacts.name,
      raisedByName: users.name,
    })
    .from(quotationThreads)
    .innerJoin(projects, eq(quotationThreads.projectId, projects.id))
    .innerJoin(companies, eq(quotationThreads.companyId, companies.id))
    .innerJoin(users, eq(quotationThreads.raisedByUserId, users.id))
    .leftJoin(contacts, eq(quotationThreads.contactId, contacts.id))
    .where(
      and(eq(quotationThreads.id, id), visibleQuotationThreadsFilter(session)),
    )
    .limit(1);

  if (!row) return null;

  const versionRows = await db
    .select({ version: quotationVersions })
    .from(quotationVersions)
    .where(eq(quotationVersions.threadId, id))
    .orderBy(desc(quotationVersions.versionNumber));

  const versions = versionRows.map((row) => row.version);
  const liveVersion = versionRows.find(
    (row) => row.version.status !== "superseded",
  );
  // A thread always has a live version — they are created together, in one
  // transaction. If this is ever null the data is broken, not the request.
  if (!liveVersion) throw new Error(`Thread ${id} has no live version`);

  const names = await namesFor([row.thread.cancelledByUserId]);

  const [projectViewable, companyViewable] = await Promise.all([
    // `canOpenRecord`, not `canViewRecord`: the question is whether to draw a
    // link, and `S76` gives the coordinator the project behind a quotation
    // while leaving every write on it refused. The company answer is unchanged
    // — `S76` names projects and contacts, not companies `[18 §2]`.
    canOpenRecord(session, "project", row.thread.projectId),
    canOpenRecord(session, "company", row.thread.companyId),
  ]);

  return {
    ...row.thread,
    projectName: row.projectName,
    companyName: row.companyName,
    contactName: row.contactName,
    raisedByName: row.raisedByName,
    cancelledByName: names.get(row.thread.cancelledByUserId ?? "") ?? null,
    versions,
    live: await loadVersionDetail(liveVersion.version),
    projectViewable,
    companyViewable,
  };
}

/** One query for the handful of user ids a detail screen names. */
async function namesFor(ids: (string | null)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (wanted.length === 0) return new Map();
  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(or(...wanted.map((id) => eq(users.id, id))));
  return new Map(rows.map((row) => [row.id, row.name]));
}

/** A superseded version, read-only `[07 C2]`. */
export async function getQuotationVersion(
  session: AuthSession,
  threadId: string,
  versionId: string,
): Promise<QuotationVersionDetail | null> {
  if (!(await canViewRecord(session, "quotation_thread", threadId))) {
    return null;
  }
  const [row] = await db
    .select({ version: quotationVersions })
    .from(quotationVersions)
    .where(
      and(
        eq(quotationVersions.id, versionId),
        eq(quotationVersions.threadId, threadId),
      ),
    )
    .limit(1);
  if (!row) return null;
  return loadVersionDetail(row.version);
}

/* ------------------------------------------------------------------ *
 * Business rules, checked in the application layer
 * ------------------------------------------------------------------ */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Log = (entry: AuditEntry) => void;

/**
 * The quotation's company must be one of the project's **live** links
 * `[16 §6]`.
 *
 * The project–company link is already the model of who is on a project
 * `[12 §5, §6]`, and a quotation addressed to a company with no connection to
 * the site is not something the business does. The refusal names the next step
 * rather than dead-ending: `quotations.errors.companyNotOnProject` tells the
 * rep to add the company to the project, where `14 §4`'s editor already lives.
 */
async function assertCompanyOnProject(
  projectId: string,
  companyId: string,
): Promise<void> {
  const [link] = await db
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
  if (!link) {
    throw new RuleError("quotations.errors.companyNotOnProject", "companyId");
  }
}

/** A contact belongs to one company `[07 A2]`; it must be that company's. */
async function assertContactOnCompany(
  companyId: string,
  contactId: string | null,
): Promise<void> {
  if (!contactId) return;
  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.companyId, companyId)))
    .limit(1);
  if (!contact) {
    throw new RuleError("quotations.errors.contactNotOnCompany", "contactId");
  }
}

/**
 * `12 §12` — a colour is required. This once named which of two fields was
 * missing; since `17 §2` there is only one, and since feature slice 6
 * `[26 §2]` the database enforces it directly (`custom_colour NOT NULL`) —
 * this is now a friendlier message ahead of that constraint, not the last
 * line of defense.
 */
function assertColourChoice(line: QuotationLineInput): void {
  if (!line.customColour) {
    throw new RuleError("quotations.errors.colourChoice", "customColour");
  }
}

/**
 * Lines may be edited only while the live version is still `requested`.
 *
 * Once the coordinator has issued it, the document exists in SMAC and a change
 * is a **new version**, not an edit `[07 C2]`. Returns the version row so the
 * caller does not read it twice.
 */
async function assertVersionEditable(
  tx: Tx,
  threadId: string,
): Promise<QuotationVersion> {
  const [thread] = await tx
    .select({ endState: quotationThreads.endState })
    .from(quotationThreads)
    .where(eq(quotationThreads.id, threadId))
    .limit(1);
  if (!thread) throw new RuleError("quotations.errors.notFound");
  if (thread.endState) {
    throw new RuleError("quotations.errors.threadClosed");
  }

  const version = await liveVersionOf(tx, threadId);
  if (version.status !== "requested") {
    throw new RuleError("quotations.errors.versionNotEditable");
  }
  return version;
}

async function liveVersionOf(
  tx: Tx,
  threadId: string,
): Promise<QuotationVersion> {
  const [version] = await tx
    .select()
    .from(quotationVersions)
    .where(
      and(
        eq(quotationVersions.threadId, threadId),
        ne(quotationVersions.status, "superseded"),
      ),
    )
    .orderBy(desc(quotationVersions.versionNumber))
    .limit(1);
  if (!version) throw new RuleError("quotations.errors.notFound");
  return version;
}

/** Visibility grants edit `[14 §2, §3]` — the same question the read asks. */
async function assertThreadVisible(
  session: AuthSession,
  threadId: string,
): Promise<void> {
  if (!(await canViewRecord(session, "quotation_thread", threadId))) {
    throw new RuleError("quotations.errors.notFound");
  }
}

/**
 * The coordinator's acts: issuing, returning for edit, accepting, rejecting
 * and cancelling.
 *
 * All five are gated on the one existing flag, `can_approve_quotation`, which
 * the seed grants to Sales Coordinator and Super Admin and to nobody else —
 * which is exactly "coordinator-only" `[07 C4]`, `[10 §8]`, `[04 flow 10]`,
 * with no role name in code and no invented flag. The executive deliberately
 * does not hold it `[12 §3]`.
 */
async function assertCoordinator(
  session: AuthSession,
  threadId: string,
): Promise<void> {
  await assertThreadVisible(session, threadId);
  if (!can(session, "canApproveQuotation")) {
    throw new RuleError("quotations.errors.coordinatorOnly");
  }
}

/* ------------------------------------------------------------------ *
 * Totals — recomputed after every line change `[16 §1]`
 * ------------------------------------------------------------------ */

/**
 * Recompute and store the four version totals.
 *
 * Derived columns, so they get no audit entry of their own: they are a pure
 * function of the line change that is already logged in this same
 * transaction, and a second entry would say nothing the first does not imply.
 */
async function recomputeVersionTotals(tx: Tx, versionId: string): Promise<void> {
  const lines = await tx
    .select({
      sqm: quotationLines.sqm,
      lineTotal: quotationLines.lineTotal,
      vatAmount: quotationLines.vatAmount,
    })
    .from(quotationLines)
    .where(eq(quotationLines.versionId, versionId));

  const services = await tx
    .select({
      quantity: quotationServiceLines.quantity,
      unitPrice: quotationServiceLines.unitPrice,
    })
    .from(quotationServiceLines)
    .where(eq(quotationServiceLines.versionId, versionId));

  // Service square metres are tracked separately and never enter total_sqm —
  // targets measure cladding dispatched, not fabrication `[08 D4]`, `[12 §10]`.
  let totalSqm = ZERO;
  let totalExclVat = ZERO;
  let totalVat = ZERO;

  for (const line of lines) {
    if (line.sqm) totalSqm += toScaled(line.sqm, SQM_SCALE);
    if (line.lineTotal) totalExclVat += toScaled(line.lineTotal, MONEY_SCALE);
    if (line.vatAmount) totalVat += toScaled(line.vatAmount, MONEY_SCALE);
  }

  // Services carry no VAT columns of their own `[09 §5.5]`, but they are line
  // items on the same SMAC quotation and that form taxes every line `[08 A]`.
  // The same fixed rate applies `S57` — the one constant, read here and in
  // `productLineMoney`, so a service and a product line can never disagree.
  const serviceVatRate = toScaled(VAT_RATE, MONEY_SCALE);
  for (const service of services) {
    if (!service.unitPrice) continue;
    const amount = multiplyMoneyBySqm(
      toScaled(service.unitPrice, MONEY_SCALE),
      toScaled(service.quantity, SQM_SCALE),
    );
    totalExclVat += amount;
    totalVat += applyPercent(amount, serviceVatRate);
  }

  await tx
    .update(quotationVersions)
    .set({
      totalSqm: fromScaled(totalSqm, SQM_SCALE),
      totalExclVat: fromScaled(totalExclVat, MONEY_SCALE),
      totalVat: fromScaled(totalVat, MONEY_SCALE),
      grandTotal: fromScaled(totalExclVat + totalVat, MONEY_SCALE),
    })
    .where(eq(quotationVersions.id, versionId));
}

/**
 * The money a product line carries.
 *
 * `sqm` is a generated column, so it does not exist until the row does — the
 * arithmetic is repeated here rather than read back, which is also what lets
 * an insert and its totals land in one round trip. It is the same expression
 * the database uses: `quantity_pcs × width_m × length_m` `[08 D2]`.
 *
 * **An unpriced line is not a zero-priced line** `[16 §1]`: with no unit price
 * both money columns stay null and the line contributes nothing to the totals.
 *
 * **Exported, and read by `src/lib/dispatches.ts` too** `S116`. A dispatch line
 * is the same shape as a quotation's product line, so its money must be the
 * same arithmetic — a second copy of this could drift on rounding or on `S57`'s
 * rate and the disagreement would be invisible, permanent, and exactly what
 * `S120`'s comparison would then measure. Its parameter is structural rather
 * than `QuotationLineInput` for that reason: a dispatch line's own input type
 * satisfies it without either module importing the other's shape.
 */
export function productLineMoney(input: {
  quantityPcs: string;
  widthM: string;
  lengthM: string;
  unitPrice: string | null;
}): {
  lineTotal: string | null;
  vatAmount: string | null;
} {
  if (!input.unitPrice) return { lineTotal: null, vatAmount: null };

  const sqm = divideRounded(
    toScaled(input.quantityPcs, SQM_SCALE) *
      toScaled(input.widthM, SQM_SCALE) *
      toScaled(input.lengthM, SQM_SCALE),
    pow10(SQM_SCALE * 2),
  );
  const lineTotal = multiplyMoneyBySqm(
    toScaled(input.unitPrice, MONEY_SCALE),
    sqm,
  );
  // **Fixed at 15%, never editable** `S57`. There is no rate on the input and
  // no column to hold one: a priced line is taxed, and that is the whole rule.
  const vatAmount = applyPercent(lineTotal, toScaled(VAT_RATE, MONEY_SCALE));

  return {
    lineTotal: fromScaled(lineTotal, MONEY_SCALE),
    vatAmount: fromScaled(vatAmount, MONEY_SCALE),
  };
}

/* ------------------------------------------------------------------ *
 * Inputs
 * ------------------------------------------------------------------ */

export type QuotationThreadInput = {
  /** Always `S50` — the form offers one of the company's or creates one. */
  projectId: string;
  companyId: string;
  contactId: string | null;
};

/**
 * What a rep chooses about a version beyond its lines — and since `0022` there
 * is exactly one thing.
 *
 * `S67` took `validUntil` and `deliveryPeriod`: validity and the delivery
 * period are SMAC's. `S70` and `S119` then took `paymentMethod` and
 * `shipmentTerms` onto the dispatch, where the coordinator records the first
 * `S70` and the rep chooses the second when requesting a dispatch `S119` —
 * both as pg enums, where these were free text nobody ever constrained.
 *
 * **`stock` is not nullable** `S118`. A quotation is drawn from one stock and
 * the rep chooses it when raising, so there is no caller with nothing to pass:
 * omitting it is a compile error rather than a row the database refuses at
 * runtime. That is the writer half of the `NOT NULL` on the column. The
 * DISPATCH now carries its own `S130`, and this one is only its default.
 */
export type QuotationVersionInput = {
  stock: Stock;
};

export type QuotationLineInput = {
  supplierId: string;
  classId: string;
  fireRatingId: string;
  customColour: string | null;
  thicknessId: string;
  widthM: string;
  lengthM: string;
  quantityPcs: string;
  unitPrice: string | null;
};

export type ServiceLineInput = {
  serviceTypeId: string;
  quantity: string;
  unitPrice: string | null;
  quotationLineId: string | null;
};

/* ------------------------------------------------------------------ *
 * Mutations
 * ------------------------------------------------------------------ */

async function insertLine(
  tx: Tx,
  log: Log,
  versionId: string,
  input: QuotationLineInput,
): Promise<string> {
  const [row] = await tx
    .insert(quotationLines)
    .values({
      versionId,
      supplierId: input.supplierId,
      classId: input.classId,
      fireRatingId: input.fireRatingId,
      // `assertColourChoice` (called by every path that reaches here) has
      // already refused a blank colour, so the database's `NOT NULL` is
      // never actually tested against `null` from application code.
      customColour: input.customColour!,
      thicknessId: input.thicknessId,
      // No `formFactor`. `12 §11` still says quotation lines are sheets only,
      // but the column recording it was written `'sheet'` 850 times and read
      // by nothing, so `0027` dropped it with its enum. The scope boundary is
      // the rule; it needed no column to state it.
      widthM: input.widthM,
      lengthM: input.lengthM,
      quantityPcs: input.quantityPcs,
      unitPrice: input.unitPrice,
      ...productLineMoney(input),
    })
    .returning();

  log({
    action: "quotation_line.added",
    entityType: "quotation_line",
    entityId: row.id,
    after: row,
  });
  return row.id;
}

async function insertServiceLine(
  tx: Tx,
  log: Log,
  versionId: string,
  input: ServiceLineInput,
): Promise<void> {
  const [row] = await tx
    .insert(quotationServiceLines)
    .values({
      versionId,
      serviceTypeId: input.serviceTypeId,
      quantity: input.quantity,
      // All services are priced per square metre `[12 §10]`; the application
      // writes it, for the same reason `form_factor` is written `[13 §2]`.
      unit: "sqm",
      unitPrice: input.unitPrice,
      quotationLineId: input.quotationLineId,
    })
    .returning();

  log({
    action: "quotation_service_line.added",
    entityType: "quotation_service_line",
    entityId: row.id,
    after: row,
  });
}

/**
 * The rep raises the request `[04 flow 6]`. **That request is version 1**:
 * status `requested`, origin `initial_request`, no SMAC reference `[10 §4]`.
 *
 * Thread, version and every line land in one transaction — a thread without a
 * live version is not a state the rest of this module can read.
 */
export async function createQuotationThread(
  session: AuthSession,
  thread: QuotationThreadInput,
  version: QuotationVersionInput,
  lines: QuotationLineInput[],
  serviceLines: ServiceLineInput[],
): Promise<QuotationThread> {
  // **The project is required** `S50`, so both rules that hang off it are
  // unconditional: visibility of the parent project `[11 §2]`, and the company
  // being one of that project's participants `[16 §6]`. A project the rep
  // created on this same submit passes both — he owns it, and the company was
  // linked as it was created.
  if (!(await canViewRecord(session, "project", thread.projectId))) {
    throw new RuleError("quotations.errors.projectNotVisible", "projectId");
  }
  await assertCompanyOnProject(thread.projectId, thread.companyId);
  await assertContactOnCompany(thread.companyId, thread.contactId);

  // `S60` — *a quotation always keeps at least one product line*, and this is
  // where it starts. Uncited until now, which is why nothing could be said to
  // enforce the rule by reading the code for it.
  if (lines.length === 0) {
    throw new RuleError("quotations.errors.atLeastOneLine");
  }
  lines.forEach(assertColourChoice);

  return withAudit(session.actor, async (tx, log) => {
    const [created] = await tx
      .insert(quotationThreads)
      .values({
        projectId: thread.projectId,
        companyId: thread.companyId,
        contactId: thread.contactId,
        raisedByUserId: session.user.id,
      })
      .returning();

    log({
      action: "quotation_thread.created",
      entityType: "quotation_thread",
      entityId: created.id,
      after: created,
    });

    const [firstVersion] = await tx
      .insert(quotationVersions)
      .values({
        threadId: created.id,
        versionNumber: 1,
        origin: "initial_request",
        status: "requested",
        // `S118` — the rep's choice at raise. The only place it is chosen.
        stock: version.stock,
        createdBy: session.user.id,
      })
      .returning();

    log({
      action: "quotation_version.created",
      entityType: "quotation_version",
      entityId: firstVersion.id,
      after: firstVersion,
    });

    for (const line of lines) {
      await insertLine(tx, log, firstVersion.id, line);
    }
    for (const service of serviceLines) {
      await insertServiceLine(tx, log, firstVersion.id, service);
    }
    await recomputeVersionTotals(tx, firstVersion.id);

    return created;
  });
}

export async function addQuotationLine(
  session: AuthSession,
  threadId: string,
  input: QuotationLineInput,
): Promise<void> {
  await assertThreadVisible(session, threadId);
  assertColourChoice(input);

  await withAudit(session.actor, async (tx, log) => {
    const version = await assertVersionEditable(tx, threadId);
    await insertLine(tx, log, version.id, input);
    await recomputeVersionTotals(tx, version.id);
  });
}

export async function updateQuotationLine(
  session: AuthSession,
  threadId: string,
  lineId: string,
  input: QuotationLineInput,
): Promise<void> {
  await assertThreadVisible(session, threadId);
  assertColourChoice(input);

  await withAudit(session.actor, async (tx, log) => {
    const version = await assertVersionEditable(tx, threadId);

    const [before] = await tx
      .select()
      .from(quotationLines)
      .where(
        and(
          eq(quotationLines.id, lineId),
          eq(quotationLines.versionId, version.id),
        ),
      )
      .limit(1);
    if (!before) throw new RuleError("quotations.errors.notFound");

    const [after] = await tx
      .update(quotationLines)
      // `assertColourChoice` above has already refused a blank colour.
      .set({
        ...input,
        customColour: input.customColour!,
        ...productLineMoney(input),
      })
      .where(eq(quotationLines.id, lineId))
      .returning();

    log({
      action: "quotation_line.updated",
      entityType: "quotation_line",
      entityId: lineId,
      before,
      after,
    });

    await recomputeVersionTotals(tx, version.id);
  });
}

/**
 * Remove a line.
 *
 * This is the one place FACET deletes a row, and it is not a business event
 * being erased: a line on a version that has never left `requested` is a
 * half-finished draft, not history. History is the superseded versions
 * `[07 C2]`, which are never touched. The removal is still audited with the
 * full row in `before`.
 */
export async function removeQuotationLine(
  session: AuthSession,
  threadId: string,
  lineId: string,
): Promise<void> {
  await assertThreadVisible(session, threadId);

  await withAudit(session.actor, async (tx, log) => {
    const version = await assertVersionEditable(tx, threadId);

    const remaining = await tx
      .select({ id: quotationLines.id })
      .from(quotationLines)
      .where(eq(quotationLines.versionId, version.id));

    const target = remaining.find((row) => row.id === lineId);
    if (!target) throw new RuleError("quotations.errors.notFound");
    // `S60` — the word in the rule is *keeps*, and this is the only statement
    // in the codebase that deletes a `quotation_lines` row. Between this and
    // `createQuotationThread` above, no application path can leave a version
    // with none.
    if (remaining.length <= 1) {
      throw new RuleError("quotations.errors.lastLine");
    }

    const [before] = await tx
      .select()
      .from(quotationLines)
      .where(eq(quotationLines.id, lineId))
      .limit(1);

    // A service line may point at this product line `[08 D4]`; clear the
    // reference rather than let the foreign key refuse the delete.
    await tx
      .update(quotationServiceLines)
      .set({ quotationLineId: null })
      .where(eq(quotationServiceLines.quotationLineId, lineId));

    await tx.delete(quotationLines).where(eq(quotationLines.id, lineId));

    log({
      action: "quotation_line.removed",
      entityType: "quotation_line",
      entityId: lineId,
      before,
    });

    await recomputeVersionTotals(tx, version.id);
  });
}

export async function addServiceLine(
  session: AuthSession,
  threadId: string,
  input: ServiceLineInput,
): Promise<void> {
  await assertThreadVisible(session, threadId);

  await withAudit(session.actor, async (tx, log) => {
    const version = await assertVersionEditable(tx, threadId);
    await insertServiceLine(tx, log, version.id, input);
    await recomputeVersionTotals(tx, version.id);
  });
}

export async function updateServiceLine(
  session: AuthSession,
  threadId: string,
  lineId: string,
  input: ServiceLineInput,
): Promise<void> {
  await assertThreadVisible(session, threadId);

  await withAudit(session.actor, async (tx, log) => {
    const version = await assertVersionEditable(tx, threadId);

    const [before] = await tx
      .select()
      .from(quotationServiceLines)
      .where(
        and(
          eq(quotationServiceLines.id, lineId),
          eq(quotationServiceLines.versionId, version.id),
        ),
      )
      .limit(1);
    if (!before) throw new RuleError("quotations.errors.notFound");

    const [after] = await tx
      .update(quotationServiceLines)
      .set({
        serviceTypeId: input.serviceTypeId,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        quotationLineId: input.quotationLineId,
      })
      .where(eq(quotationServiceLines.id, lineId))
      .returning();

    log({
      action: "quotation_service_line.updated",
      entityType: "quotation_service_line",
      entityId: lineId,
      before,
      after,
    });

    await recomputeVersionTotals(tx, version.id);
  });
}

export async function removeServiceLine(
  session: AuthSession,
  threadId: string,
  lineId: string,
): Promise<void> {
  await assertThreadVisible(session, threadId);

  await withAudit(session.actor, async (tx, log) => {
    const version = await assertVersionEditable(tx, threadId);

    const [before] = await tx
      .select()
      .from(quotationServiceLines)
      .where(
        and(
          eq(quotationServiceLines.id, lineId),
          eq(quotationServiceLines.versionId, version.id),
        ),
      )
      .limit(1);
    if (!before) throw new RuleError("quotations.errors.notFound");

    await tx
      .delete(quotationServiceLines)
      .where(eq(quotationServiceLines.id, lineId));

    log({
      action: "quotation_service_line.removed",
      entityType: "quotation_service_line",
      entityId: lineId,
      before,
    });

    await recomputeVersionTotals(tx, version.id);
  });
}

/* ------------------------------------------------------------------ *
 * The chain: issue → return for edit → revise → accept / reject / cancel
 * ------------------------------------------------------------------ */

/**
 * The coordinator has created the real quotation in SMAC and records its
 * reference `[04 flow 7, 11]`, `[10 §4]`. `requested → issued`.
 *
 * The reference is typed by a human and can be wrong `[04 A2]`, which is what
 * `smac_reference_verification` is for. FACET never generates the number — not
 * the first one, and not the `RE` form on a revision.
 */
export async function issueVersion(
  session: AuthSession,
  threadId: string,
  input: { smacReference: string; verification: SmacVerification },
): Promise<void> {
  await assertCoordinator(session, threadId);

  await withAudit(session.actor, async (tx, log) => {
    const version = await liveVersionOf(tx, threadId);
    if (version.status !== "requested") {
      throw new RuleError("quotations.errors.alreadyIssued");
    }

    // `S60` — **the last moment the rule can be kept.**
    //
    // Raising refuses a version with no lines and removal refuses the last
    // one, so no application path *creates* this state. What issuing is, is
    // the point after which it could never be **repaired**: `S61` makes lines
    // editable only while the live version is `requested`, so nothing adds a
    // line to an issued one, and `S66` makes a revision a new version rather
    // than a way back into this one.
    //
    // It is also the point at which four other rules start reading these
    // lines and would each get a quiet wrong answer from none of them:
    // `S126` makes an issued version the only thing dispatchable, `S116`
    // prefills a request from it, `S120` compares a dispatch against it, and
    // `S77` quotes its total.
    //
    // **Reachable, and not only in theory.** `createRevision` copies the
    // previous version's lines forward, so a version that is already lineless
    // — the thirteen this database held before `db:reset`, every one written
    // by a verify script inserting `quotation_versions` directly — produces a
    // lineless revision that is `requested`, and therefore issuable. This
    // refuses to let that state spread past the one row that has it.
    //
    // **Not a database CHECK, and it cannot be.** *At least one child row* is
    // not row-local, so no CHECK can express it; `CLAUDE.md` puts what a row
    // may contain in the database and this is not that. The pair that holds it
    // is this refusal and `verify:schema25` §18, which asserts over every row
    // ever written that none is lineless.
    const [line] = await tx
      .select({ id: quotationLines.id })
      .from(quotationLines)
      .where(eq(quotationLines.versionId, version.id))
      .limit(1);
    if (!line) {
      throw new RuleError("quotations.errors.atLeastOneLine");
    }

    const [after] = await tx
      .update(quotationVersions)
      .set({
        smacReference: input.smacReference,
        smacReferenceVerification: input.verification,
        status: "issued",
      })
      .where(eq(quotationVersions.id, version.id))
      .returning();

    log({
      action: "quotation_version.issued",
      entityType: "quotation_version",
      entityId: version.id,
      before: {
        status: version.status,
        smacReference: version.smacReference,
        smacReferenceVerification: version.smacReferenceVerification,
      },
      after: {
        status: after.status,
        smacReference: after.smacReference,
        smacReferenceVerification: after.smacReferenceVerification,
      },
    });
  });
}

/**
 * The coordinator sends it back for an edit round `[04 flow 10]`, with a reason.
 *
 * The version stays `requested` and editable — the round is a counter, not a
 * state change. The rep fixes the lines and the coordinator issues it.
 *
 * **The reason is a comment, not a field** `[25 §13]`: *"It is the same act. No
 * separate field."* So nothing is added to `quotation_versions` — the reason
 * lands on the thread's own conversation, where the rep is already reading, and
 * six months later the round-trip is on the record instead of in a phone
 * `[25 §9]`.
 *
 * **It is required.** A return with no reason is exactly the WhatsApp round-trip
 * `25 §9` exists to end: the rep has to ring somebody to find out what to fix.
 * `04 flow 10`'s cancellation reason is required for the same reason.
 *
 * The comment is written **inside this transaction**, so a reason cannot survive
 * a return that rolled back, nor a return leave no reason behind.
 *
 * It hangs on the **thread**, never the version: `comments_record_type` refuses
 * `quotation_version` on purpose — the conversation belongs to the thread, not
 * to one superseded version of it.
 *
 * **The raiser is tagged, and that is not a manual mention** `[25 §13]`. `25 §11`
 * governs a person choosing to tell a colleague something; this is the act
 * notifying the person it creates work for. The reason exists to end the
 * WhatsApp round-trip `[25 §9]`, and a reason nobody is told about does not end
 * it — the rep would learn of the return by opening a screen they have no
 * reason to open. So the tag is part of returning, not a decision the
 * coordinator makes each time, and there is no control for it.
 *
 * It is `raisedByUserId`, which is the rep who holds the thread **now**: `19 §1`
 * rewrites it on handover precisely so that whoever inherited the work is the
 * one told about it. `addMentions` drops a self-tag, so a coordinator returning
 * their own thread raises nothing.
 *
 * **This is a patch over a larger gap, recorded as `22 §6.11`:** a returned
 * quotation appears in no queue at all. `followUps()`'s four kinds have nothing
 * for "returned and not yet resubmitted", so the notification is the only thing
 * that reaches the rep — and a notification that is read once is gone, where a
 * follow-up persists until the condition clears `[21 §1]`.
 */
export async function returnForEdit(
  session: AuthSession,
  threadId: string,
  reason: string,
): Promise<void> {
  await assertCoordinator(session, threadId);

  const body = reason.trim();
  if (!body) {
    throw new RuleError("quotations.errors.returnReasonRequired", "reason");
  }

  await withAudit(session.actor, async (tx, log) => {
    const version = await liveVersionOf(tx, threadId);
    if (version.status !== "requested") {
      throw new RuleError("quotations.errors.versionNotEditable");
    }

    const [after] = await tx
      .update(quotationVersions)
      .set({ returnForEditRound: version.returnForEditRound + 1 })
      .where(eq(quotationVersions.id, version.id))
      .returning();

    log({
      action: "quotation_version.returned_for_edit",
      entityType: "quotation_version",
      entityId: version.id,
      before: { returnForEditRound: version.returnForEditRound },
      after: { returnForEditRound: after.returnForEditRound },
    });

    // Read inside the transaction, with everything else this act touches.
    const [thread] = await tx
      .select({ raisedByUserId: quotationThreads.raisedByUserId })
      .from(quotationThreads)
      .where(eq(quotationThreads.id, threadId))
      .limit(1);

    await insertComment(tx, log, session, {
      recordType: "quotation_thread",
      recordId: threadId,
      body,
      // The act tells the person it creates work for `[25 §13]` — see above.
      mentions: thread ? [thread.raisedByUserId] : [],
    });
  });
}

/**
 * A revision — version N+1, carrying forward the lines `[07 C2]`.
 *
 * Two origins, two callers, one mechanism:
 *  - `rep_change_request` — the rep asks for a change;
 *  - `coordinator_direct_edit` — the coordinator changes it on a call.
 *
 * There was a third, `expiry_revision`, until `S67`. Only a screen reading a
 * computed expiry could set it, and FACET no longer carries a validity date.
 *
 * The new version starts `requested` with **no SMAC reference**: the `RE`
 * number is typed when the coordinator issues it, like every other SMAC link
 * `[04 A2]`. The previous version becomes `superseded` in the same
 * transaction, which is what keeps "only the latest is live" true without a
 * database constraint no document asked for.
 */
export async function createRevision(
  session: AuthSession,
  threadId: string,
  origin: Exclude<QuotationVersionOrigin, "initial_request">,
): Promise<void> {
  if (origin === "coordinator_direct_edit") {
    await assertCoordinator(session, threadId);
  } else {
    await assertThreadVisible(session, threadId);
  }

  await withAudit(session.actor, async (tx, log) => {
    const [thread] = await tx
      .select()
      .from(quotationThreads)
      .where(eq(quotationThreads.id, threadId))
      .limit(1);
    if (!thread) throw new RuleError("quotations.errors.notFound");

    // An end state is final. `expired` stopped being one at `0014` and `S67`
    // has now taken the date behind it, so there is no special case here.
    if (thread.endState) {
      throw new RuleError("quotations.errors.threadClosed");
    }

    const previous = await liveVersionOf(tx, threadId);

    await tx
      .update(quotationVersions)
      .set({ status: "superseded" })
      .where(eq(quotationVersions.id, previous.id));
    log({
      action: "quotation_version.superseded",
      entityType: "quotation_version",
      entityId: previous.id,
      before: { status: previous.status },
      after: { status: "superseded" },
    });

    const [next] = await tx
      .insert(quotationVersions)
      .values({
        threadId,
        versionNumber: previous.versionNumber + 1,
        origin,
        status: "requested",
        // `S118` — carried forward. Nothing on this path can change the
        // stock: a revision takes no input, so the value is the one the rep
        // chose at raise until a rule says otherwise. It was three columns
        // until `0022`; the other two are the dispatch's now `S70` `S119`.
        stock: previous.stock,
        createdBy: session.user.id,
      })
      .returning();
    log({
      action: "quotation_version.created",
      entityType: "quotation_version",
      entityId: next.id,
      after: next,
    });

    // Carry the lines forward. A revision starts from what was quoted, not
    // from an empty form — the change is usually one price or one colour.
    const lines = await tx
      .select()
      .from(quotationLines)
      .where(eq(quotationLines.versionId, previous.id))
      .orderBy(asc(quotationLines.createdAt));
    const idMap = new Map<string, string>();
    for (const line of lines) {
      const [copy] = await tx
        .insert(quotationLines)
        .values({
          versionId: next.id,
          supplierId: line.supplierId,
          classId: line.classId,
          fireRatingId: line.fireRatingId,
          customColour: line.customColour,
          thicknessId: line.thicknessId,
          widthM: line.widthM,
          lengthM: line.lengthM,
          quantityPcs: line.quantityPcs,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
          vatAmount: line.vatAmount,
        })
        .returning();
      idMap.set(line.id, copy.id);
    }

    const services = await tx
      .select()
      .from(quotationServiceLines)
      .where(eq(quotationServiceLines.versionId, previous.id))
      .orderBy(asc(quotationServiceLines.createdAt));
    for (const service of services) {
      await tx.insert(quotationServiceLines).values({
        versionId: next.id,
        serviceTypeId: service.serviceTypeId,
        quantity: service.quantity,
        unit: service.unit,
        unitPrice: service.unitPrice,
        // Re-point at the copied line, never at the superseded version's.
        quotationLineId: service.quotationLineId
          ? (idMap.get(service.quotationLineId) ?? null)
          : null,
      });
    }

    await recomputeVersionTotals(tx, next.id);
  });
}

/**
 * Shared body for the three coordinator end states.
 *
 * **`reason` is what `S62` and `S128` both hang on, and it does two things in
 * one place.** `S62`: *returning, rejecting or cancelling requires a written
 * reason, which becomes a comment on the thread.* `S128`: that reason *reaches
 * everyone whose work it ends — the rep who raised it*. Doing both here rather
 * than in each caller is what stops rejection and cancellation drifting apart
 * again; `AUDIT 1` found the three acts behaving three different ways, with one
 * of the three matching the rule.
 *
 * `acceptThread` passes none, and rightly: an acceptance ends nobody's work.
 *
 * **The comment carries NO mention, and that is deliberate.** `returnForEdit`
 * tags the raiser because the tag is the only thing that reaches them — a
 * returned quotation appears in no queue at all `[22 §6.11]`. Here the news
 * item IS the telling, and `S92` names it as its own bell item; a mention
 * beside it would raise a second bell reading "Mentioned you" for the same
 * sentence.
 *
 * Both are written inside this transaction, so a reason cannot survive a
 * decision that rolled back, nor a decision leave nobody told.
 */
async function setEndState(
  session: AuthSession,
  threadId: string,
  endState: QuotationThreadEndState,
  extra: Partial<typeof quotationThreads.$inferInsert> = {},
  reason?: { body: string; decision: DecisionKind },
): Promise<void> {
  await assertCoordinator(session, threadId);

  await withAudit(session.actor, async (tx, log) => {
    const [before] = await tx
      .select()
      .from(quotationThreads)
      .where(eq(quotationThreads.id, threadId))
      .limit(1);
    if (!before) throw new RuleError("quotations.errors.notFound");
    // Re-deciding a decided quotation is a revision, not an edit. Every end
    // state is final; `expired` has not been one of them since `S67`.
    if (before.endState) {
      throw new RuleError("quotations.errors.threadClosed");
    }

    const [after] = await tx
      .update(quotationThreads)
      .set({ endState, ...extra })
      .where(eq(quotationThreads.id, threadId))
      .returning();

    log({
      action: `quotation_thread.${endState}`,
      entityType: "quotation_thread",
      entityId: threadId,
      before: { endState: before.endState },
      after: { endState: after.endState },
    });

    if (!reason) return;

    // `S62` — the reason becomes a comment on the THREAD, never the version:
    // `comments_record_type` refuses `quotation_version` on purpose, because
    // the conversation belongs to the thread rather than to one superseded
    // version of it. Same placement `returnForEdit` already uses.
    await insertComment(tx, log, session, {
      recordType: "quotation_thread",
      recordId: threadId,
      body: reason.body,
      mentions: [],
    });

    // `S128` — and the recipient is `raised_by_user_id`, the rep who holds the
    // thread NOW: `19 §1` rewrites it on handover precisely so that whoever
    // inherited the work is the one told about it. A coordinator closing her
    // own thread is not told about her own decision, which is `addMentions`'
    // self-drop written out, since `raise` does not do it.
    if (before.raisedByUserId !== session.user.id) {
      await raise(tx, log, {
        typeKey: NOTIFICATION_TYPES.decisionEndedWork,
        recipientUserId: before.raisedByUserId,
        payload: {
          decision: reason.decision,
          reason: reason.body,
          recordType: "quotation_thread",
          recordId: threadId,
          decidedByUserId: session.user.id,
        },
      });
    }
  });
}

/**
 * The coordinator accepts, after obtaining the signatures `S64` `S65` — not the
 * rep.
 *
 * **This is internal approval, not a won deal** `S65`, and `S132` makes that a
 * position: accepting moves the thread to *with the customer*, where the
 * customer is deciding and **the rep** owes the chase. The two columns that
 * used to sit between this and a dispatch are gone `S133` — `S70` records
 * payment on the dispatch and `S73` makes it a condition of approving one, so
 * no interval exists for a position to occupy.
 *
 * Nothing that counts, ranks or forecasts may read this end state as "bought"
 * — `07 D4`'s conversion measure and `10 §11`'s `quotations_accepted` are the
 * two places that will be tempting. Winning is an approved dispatch `S31`.
 */
export async function acceptThread(
  session: AuthSession,
  threadId: string,
): Promise<void> {
  await setEndState(session, threadId, "accepted");
}

/**
 * Rejection belongs to the quotation; loss belongs to the project `[07 C5]`.
 *
 * **A written reason is required** `S62` `S128`, and until this slice there was
 * none — no parameter, no column, no field on the screen — so a rejection left
 * nothing behind but an audit row recording the end-state change. `AUDIT 1`
 * called it the worst of `S62`'s three acts, because cancellation at least
 * persisted its reason somewhere a person could find it.
 *
 * **No `rejection_reason` column, deliberately.** `S62` says the reason
 * *becomes a comment on the thread*, which is a home somebody actually reads; a
 * column beside it would be a second home for one sentence, which
 * `quotation_threads.cancelled_at` was until `0027` dropped it as read by
 * nothing. The comment is the record, the notification is the telling, and the
 * audit row keeps both permanently `S112` `S107`.
 */
export async function rejectThread(
  session: AuthSession,
  threadId: string,
  reason: string,
): Promise<void> {
  const body = reason.trim();
  if (!body) {
    throw new RuleError(
      "quotations.errors.rejectionReasonRequired",
      "rejectionReason",
    );
  }
  await setEndState(
    session,
    threadId,
    "rejected",
    {},
    { body, decision: "quotation_rejected" },
  );
}

/**
 * Cancellation is coordinator-only `[07 C4]` and **a written reason is
 * required** `[10 §8]`: it kills a signed quotation, and the reason is the one
 * field that makes the audit entry worth reading.
 *
 * **It becomes a comment too now** `S62`, and it reaches the rep `S128`. The
 * column stays — the thread screen reads it — but a reason sitting only in a
 * column is what `S128` calls *the same as no reason at all*: the rep would
 * learn that a signed quotation had been killed by opening a screen they have
 * no reason to open. `AUDIT 1` recorded exactly that.
 */
export async function cancelThread(
  session: AuthSession,
  threadId: string,
  reason: string,
): Promise<void> {
  const body = reason.trim();
  if (!body) {
    throw new RuleError(
      "quotations.errors.cancellationReasonRequired",
      "cancellationReason",
    );
  }
  await setEndState(
    session,
    threadId,
    "cancelled",
    {
      // No `cancelledAt`: the column was dropped in `0027` after nine
      // cancellations wrote it and nothing ever read one. The
      // `quotation_thread.end_state_set` audit row carries the moment `S112`.
      cancelledByUserId: session.user.id,
      cancellationReason: body,
    },
    { body, decision: "quotation_cancelled" },
  );
}
