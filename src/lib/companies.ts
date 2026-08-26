/**
 * Companies — the data layer `09 §3.1`.
 *
 * Two rules hold for every function here, and for the contact and project
 * modules built on the same shape:
 *
 *  1. **Every read composes a filter from `authz`.** No query in this file
 *     writes its own visibility predicate.
 *  2. **Every write goes through `withAudit`**, which owns the transaction and
 *     writes the audit rows in it `[07 E1]`. Features never write audit rows
 *     themselves.
 *
 * Visibility grants edit `[14 §2, §3]`, so the mutations check the same
 * question the reads do — there is no second permission to consult.
 */

import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import {
  cities,
  companies,
  companyCategories,
  companyReps,
  countries,
  leadSources,
  users,
} from "@/db/schema";
import { withAudit } from "@/lib/audit";
import {
  canViewRecord,
  visibleCompaniesFilter,
  type AuthSession,
} from "@/lib/authz";
import { companySilence } from "@/lib/coverage";
import { REGIONS, type Region, type SameValues } from "@/lib/enums";
import { assertLeadSourceSelectable, placeForCountry } from "@/lib/lookups";
import { normalizeName } from "@/lib/normalize";
// Qualification is a quotation event, so its predicate lives with quotations
// `[10 §1]`. The dependency runs one way only — that module never imports this
// one, so there is no cycle to unpick later.
import { companyIsQualified } from "@/lib/quotations";
import { getQuietThresholds } from "@/lib/settings";
import { RuleError } from "@/lib/validation";

export type Company = typeof companies.$inferSelect;

/** Compile-time proof that `enums.ts` still matches the database. */
export type RegionMatchesSchema = SameValues<
  Region,
  NonNullable<Company["region"]>
>;

export { REGIONS };
export type { Region };

/** Everything a rep may type on the company form. Most of it is nullable —
 *  unqualified entry needs almost nothing `[10 §2]`.
 *
 *  Three are not: the name `S12`, the phone `S13` and the country `S14`. They
 *  are non-nullable **here as well as in the database**, so an edit path that
 *  forgets one fails to compile rather than clearing it — which is what
 *  `updateCompany`'s callers get checked against.
 *
 *  `has_credit_terms` `[25 §7]` is deliberately NOT here: it is the manager's
 *  to set, not the rep's, and no screen sets it yet. */
export type CompanyInput = {
  /** One field, English or Arabic `S12`. */
  name: string;
  /** Mandatory `S13`, and the primary matching key `S23`. */
  phone: string;
  /** `S14`. Not nullable, and it decides the two below `S15`. */
  countryId: string;
  categoryId: string | null;
  vatNumber: string | null;
  /** `S15` — required when the country is Saudi Arabia, forbidden otherwise.
   *  Both are `placeForCountry`'s to enforce, not this type's, because the
   *  answer depends on `countryId` rather than on the field itself.
   *
   *  There is deliberately no `region` beside it: `S15` says the rep is never
   *  asked, so there is no form field to read and nothing for a caller to
   *  supply `[AUDIT 1 F3]`. The column is written from the city. */
  cityId: string | null;
  leadSourceId: string | null;
  notes: string | null;
};

export type CompanyListRow = {
  id: string;
  name: string;
  /** `S13` — always present, so the list never renders a dash for it. */
  phone: string;
  region: Region | null;
  categoryNameEn: string | null;
  categoryNameAr: string | null;
  cityNameEn: string | null;
  cityNameAr: string | null;
  /** Derived, never stored — see `companyIsQualified`. */
  isQualified: boolean;
  /**
   * `D26`'s silence meter, decided in SQL by `companySilence` and merely
   * rendered by the screen. **A threshold is never derived in a component**
   * (`CLAUDE.md`).
   */
  /** Days since the last interaction. **Null = never logged against** — which
   *  must not read the same as `0` (`coverage.ts`). */
  daysSince: number | null;
  /** Days the clock has actually run: since the last interaction, else since
   *  registration. This is what the order and the meter's fill are built on. */
  silentDays: number;
  thresholdDays: number;
  isQuiet: boolean;
  /** `20 §5` — suppressed until this date, and calm however old meanwhile. */
  onHoldUntil: string | null;
};

/**
 * `D25` — *companies group as gone quiet / due soon / recently touched*.
 *
 * **Two of the three are built.** `D25` names a middle group and no rule
 * anywhere says where *soon* starts: the thresholds `07 D5` gives are the
 * boundary between quiet and not, and there is no second one. A window chosen
 * here would become the number everyone believes in, so it is
 * `OPEN — not chosen` and recorded in `WORKFLOW §5` with the candidate
 * readings. `D6`'s amber band consequently goes unused on this screen — red
 * past the threshold, faint otherwise.
 */
export const COMPANY_ATTENTION_GROUPS = ["quiet", "touched"] as const;
export type CompanyAttentionGroup = (typeof COMPANY_ATTENTION_GROUPS)[number];

/**
 * `?sort=` — attention by default `D25`, with name and recency kept.
 *
 * Recency is `created_at desc`, which is what this list used to default to.
 * It stays reachable because it is the only order that answers *what did I add
 * last*, and because the demo base's three deliberately long names are recent
 * (`scripts/seed/demo/companies.ts`) — attention order buries them, so RTL
 * truncation is driven through this sort.
 */
export const COMPANY_SORTS = ["attention", "name", "recent"] as const;
export type CompanySort = (typeof COMPANY_SORTS)[number];

export function isCompanySort(value: string | undefined): value is CompanySort {
  return COMPANY_SORTS.includes(value as CompanySort);
}

export type CompanyListResult = {
  rows: CompanyListRow[];
  total: number;
  page: number;
  sort: CompanySort;
  /**
   * How many rows are in each group **across the whole scope**, not the page.
   * `D24` says a group header carries its count, and a header counting only
   * what happens to be on this page would lie on every page but the last.
   */
  groupCounts: Record<CompanyAttentionGroup, number>;
};

/** `09 §3.1` — no document sets a page size; 25 is a display detail. */
const PAGE_SIZE = 25;

/**
 * Free-text search. Matches the normalized name — so an Arabic query finds an
 * Arabic name written with different diacritics — or the phone, which `07 B6`
 * calls the strongest key a company has and `S23` makes the primary one. Since
 * `S13` every company has one, so the phone half can no longer miss a row for
 * want of a value.
 */
function searchFilter(query: string | undefined): SQL | undefined {
  const trimmed = query?.trim();
  if (!trimmed) return undefined;
  return or(
    ilike(companies.nameNormalized, `%${normalizeName(trimmed)}%`),
    ilike(companies.phone, `%${trimmed}%`),
  );
}

/**
 * The companies list — **ordered by attention** `D25`.
 *
 * `D25` says a list is grouped by whose move it is and names this list's
 * groups; `D2` says a row says whose move it is rather than what its status is.
 * Sorting by `created_at` answered neither — a rep does not open FACET to find
 * out what he added last.
 *
 * **The order is resolved in SQL, before `.limit()`.** Ordering a page after
 * fetching it is the failure `CLAUDE.md` records shipping once already, and it
 * fails silently: page two would simply hold rows that belong on page one.
 * `companySilence` exists so this is a join rather than a second derivation —
 * `follow-ups.ts` and `coverage()` had already drifted apart writing it twice.
 *
 * **`followUpScope()` is deliberately NOT the reader here.** It returns only
 * rows already past threshold, suppresses on-hold, archived and merged
 * companies, and merges three anchor types — so it cannot order the companies
 * that are *fine*, which is most of them, and a list that hides an on-hold
 * customer is a list a rep cannot find that customer in. It answers *what needs
 * me today*; this answers *where does each of my companies stand*.
 */
export async function listCompanies(
  session: AuthSession,
  options: { q?: string; page?: number; sort?: CompanySort } = {},
): Promise<CompanyListResult> {
  const page = Math.max(1, options.page ?? 1);
  const sort = options.sort ?? "attention";
  const thresholds = await getQuietThresholds();
  const silence = companySilence(thresholds);
  const where = and(visibleCompaniesFilter(session), searchFilter(options.q));

  // `attention` leads with the quiet — `isQuiet desc` puts true first — and
  // ranks within each group by how long the clock has run, which is `D34`'s
  // *worked down by ranking*. `name` and `recent` are the two orders a rep may
  // still want; neither changes which rows are returned.
  const orderBy =
    sort === "name"
      ? [asc(companies.name)]
      : sort === "recent"
        ? [desc(companies.createdAt)]
        : [desc(silence.isQuiet), desc(silence.silentDays), asc(companies.name)];

  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      phone: companies.phone,
      region: companies.region,
      categoryNameEn: companyCategories.nameEn,
      categoryNameAr: companyCategories.nameAr,
      cityNameEn: cities.nameEn,
      cityNameAr: cities.nameAr,
      // Qualification is derived from the event, never set by hand
      // `[04 qualification]`, `[10 §1]` — a correlated EXISTS, not a column.
      isQualified: companyIsQualified(companies.id),
      lastInteractionAt: silence.lastInteractionAt,
      silentDays: silence.silentDays,
      thresholdDays: silence.thresholdDays,
      isQuiet: silence.isQuiet,
      onHoldUntil: silence.onHoldUntil,
    })
    .from(companies)
    .leftJoin(companyCategories, eq(companies.categoryId, companyCategories.id))
    .leftJoin(cities, eq(companies.cityId, cities.id))
    .innerJoin(silence, eq(silence.companyId, companies.id))
    .where(where)
    .orderBy(...orderBy)
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  // Same WHERE and the same join, so neither can disagree with the page. The
  // group counts come back in the same pass as the total, because `D24`'s
  // header counts the whole scope and a second query could see a different one.
  const [totals] = await db
    .select({
      total: count(),
      quiet: sql<number>`count(*) filter (where ${silence.isQuiet})`,
    })
    .from(companies)
    .innerJoin(silence, eq(silence.companyId, companies.id))
    .where(where);

  const total = totals?.total ?? 0;
  const quiet = Number(totals?.quiet ?? 0);

  return {
    rows: rows.map(({ lastInteractionAt, ...row }) => ({
      ...row,
      // Never logged is null, never zero — `coverage.ts` makes the point and
      // the meter depends on it: "Never" and "today" must not read the same.
      daysSince: lastInteractionAt
        ? row.silentDays
        : null,
    })),
    total,
    page,
    sort,
    groupCounts: { quiet, touched: total - quiet },
  };
}

/** The company select on the contact and project forms. */
export async function listCompanyOptions(
  session: AuthSession,
): Promise<{ id: string; name: string }[]> {
  return db
    .select({
      id: companies.id,
      name: companies.name,
    })
    .from(companies)
    .where(visibleCompaniesFilter(session))
    .orderBy(companies.name);
}

/**
 * Is there a company this identity may use — `listCompanyOptions` reduced to
 * whether it would be empty.
 *
 * A contact needs one `[07 A2]` and a project needs one `S27`, both checked in
 * the data layer, so an identity with none can open neither form and submit it.
 * That was true before `S76` and only reachable by URL; a coordinator now lands
 * on a full `/projects` list, where a New button that always fails is the
 * control `D51` says not to render. The two `new` pages gate on the options
 * they already load; this exists for the two list pages, which do not load them.
 */
export async function hasUsableCompany(session: AuthSession): Promise<boolean> {
  const [row] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(visibleCompaniesFilter(session))
    .limit(1);
  return row !== undefined;
}

export type CompanyDetail = Company & {
  categoryNameEn: string | null;
  categoryNameAr: string | null;
  /** Not nullable: `country_id` is `NOT NULL` `S14`, so this is an inner join
   *  and the screen renders the name rather than a dash. */
  countryNameEn: string;
  countryNameAr: string;
  cityNameEn: string | null;
  cityNameAr: string | null;
  leadSourceNameEn: string | null;
  leadSourceNameAr: string | null;
  createdByName: string | null;
  /**
   * **Derived, never a field anyone sets** `[04 qualification]`, `[10 §1]`.
   *
   * A company is qualified because a quotation was requested against it. There
   * is no column, no flag and no tick box — the funnel is computed from what
   * has actually happened, which is what stops a rep moving a company forward
   * without anything happening.
   */
  isQualified: boolean;
};

/**
 * One company, or `null` when this identity may not see it.
 *
 * The visibility filter is composed into the WHERE rather than checked
 * afterwards, so the detail screen and the list can never drift apart, and a
 * caller cannot forget the check and still get a row. `null` means "no such
 * company, as far as you are concerned" — pages render 404, which is what
 * keeps invisible and nonexistent indistinguishable.
 */
export async function getCompany(
  session: AuthSession,
  id: string,
): Promise<CompanyDetail | null> {
  const [row] = await db
    .select({
      company: companies,
      categoryNameEn: companyCategories.nameEn,
      categoryNameAr: companyCategories.nameAr,
      countryNameEn: countries.nameEn,
      countryNameAr: countries.nameAr,
      cityNameEn: cities.nameEn,
      cityNameAr: cities.nameAr,
      leadSourceNameEn: leadSources.nameEn,
      leadSourceNameAr: leadSources.nameAr,
      createdByName: users.name,
      isQualified: companyIsQualified(companies.id),
    })
    .from(companies)
    .leftJoin(companyCategories, eq(companies.categoryId, companyCategories.id))
    // An INNER join, alone among these: every company has a country `S14`, and
    // a left join here would type the name as nullable and make the screen
    // carry a branch that can never be taken.
    .innerJoin(countries, eq(companies.countryId, countries.id))
    .leftJoin(cities, eq(companies.cityId, cities.id))
    .leftJoin(leadSources, eq(companies.leadSourceId, leadSources.id))
    .leftJoin(users, eq(companies.createdBy, users.id))
    .where(and(eq(companies.id, id), visibleCompaniesFilter(session)))
    .limit(1);

  if (!row) return null;
  return {
    ...row.company,
    categoryNameEn: row.categoryNameEn,
    categoryNameAr: row.categoryNameAr,
    countryNameEn: row.countryNameEn,
    countryNameAr: row.countryNameAr,
    cityNameEn: row.cityNameEn,
    cityNameAr: row.cityNameAr,
    leadSourceNameEn: row.leadSourceNameEn,
    leadSourceNameAr: row.leadSourceNameAr,
    createdByName: row.createdByName,
    isQualified: row.isQualified,
  };
}

export type CompanyRep = {
  id: string;
  userId: string;
  userName: string;
  isPrimary: boolean;
  origin: (typeof companyReps.$inferSelect)["origin"];
};

/**
 * The reps currently holding a company.
 *
 * A removed membership is history `[04 Q8]` — the row stays so a granted
 * delete request is auditable, but the person is no longer a rep on this
 * company and must not be listed as one.
 */
export async function listCompanyReps(
  companyId: string,
): Promise<CompanyRep[]> {
  return db
    .select({
      id: companyReps.id,
      userId: companyReps.userId,
      userName: users.name,
      isPrimary: companyReps.isPrimary,
      origin: companyReps.origin,
    })
    .from(companyReps)
    .innerJoin(users, eq(companyReps.userId, users.id))
    .where(
      and(
        eq(companyReps.companyId, companyId),
        isNull(companyReps.removedAt),
      ),
    )
    .orderBy(desc(companyReps.isPrimary));
}

/**
 * Register a company.
 *
 * Two rows, one transaction: the company, and the membership that makes it
 * the creating rep's `[09 §3.2]`. The registering rep automatically becomes
 * primary `S18` and the origin is `self_registered` — a rep's own find
 * registers to himself `[07 B3]`.
 *
 * Under impersonation `session.user.id` is the impersonated rep, so the
 * company belongs to him; `session.actor` carries both identities into the
 * audit rows `[07 A6]`.
 */
export async function createCompany(
  session: AuthSession,
  input: CompanyInput,
): Promise<Company> {
  // Both rules run before the transaction opens: they only read, and a refusal
  // should not have started one.
  await assertLeadSourceSelectable(session, input.leadSourceId);
  const place = await placeForCountry(input.countryId, input.cityId);

  return withAudit(session.actor, async (tx, log) => {
    const [company] = await tx
      .insert(companies)
      .values({
        ...input,
        // The country decides whether there is a city at all `S15`, and the
        // city decides the region. Nothing the form posted for either is
        // consulted — the input is spread first and overwritten here, and
        // `region` is not on the input at all.
        ...place,
        nameNormalized: normalizeName(input.name),
        createdBy: session.user.id,
      })
      .returning();

    log({
      action: "company.created",
      entityType: "company",
      entityId: company.id,
      after: company,
    });

    const [rep] = await tx
      .insert(companyReps)
      .values({
        companyId: company.id,
        userId: session.user.id,
        isPrimary: true,
        origin: "self_registered",
        createdBy: session.user.id,
      })
      .returning();

    log({
      action: "company_rep.added",
      entityType: "company_rep",
      entityId: rep.id,
      after: rep,
    });

    return company;
  });
}

/**
 * The columns a rep may change, for the before/after diff.
 *
 * **`region` stays here though it left `CompanyInput`** `S15`. A rep cannot
 * type it, but changing the city changes it, and the audit log should say so:
 * dropping it would silently hide the one consequence picking a city has.
 */
const EDITABLE = [
  "name",
  "phone",
  "countryId",
  "categoryId",
  "vatNumber",
  "region",
  "cityId",
  "leadSourceId",
  "notes",
] as const;

export async function updateCompany(
  session: AuthSession,
  id: string,
  input: CompanyInput,
): Promise<Company> {
  // Visibility grants edit `[14 §2, §3]` — the same question the read asks.
  if (!(await canViewRecord(session, "company", id))) {
    throw new RuleError("companies.errors.notFound");
  }

  return withAudit(session.actor, async (tx, log) => {
    const [before] = await tx
      .select()
      .from(companies)
      .where(eq(companies.id, id))
      .limit(1);
    if (!before) throw new RuleError("companies.errors.notFound");

    // `15 §2.1` — only a *change* is checked, which is why this needs the
    // previous value and therefore runs after the row is read. A rep re-saving
    // a company the marketing team sourced keeps it.
    await assertLeadSourceSelectable(
      session,
      input.leadSourceId,
      before.leadSourceId,
    );

    // What will actually be written: the region comes from the city `S15`, and
    // both go when the country is not Saudi. The diff below compares against
    // this, not against the form, so a derived region — or a city dropped by a
    // change of country — shows up in the audit log as the real change it is.
    //
    // Inferred rather than annotated `CompanyInput`, because the written shape
    // is wider than the typed one: `region` is derived here and is not a field
    // a caller may supply.
    const values = {
      ...input,
      ...(await placeForCountry(input.countryId, input.cityId)),
    };

    const changed = EDITABLE.filter((key) => before[key] !== values[key]);
    if (changed.length === 0) return before;

    const [after] = await tx
      .update(companies)
      .set({
        ...values,
        nameNormalized: normalizeName(values.name),
      })
      .where(eq(companies.id, id))
      .returning();

    log({
      action: "company.updated",
      entityType: "company",
      entityId: id,
      before: Object.fromEntries(changed.map((key) => [key, before[key]])),
      after: Object.fromEntries(changed.map((key) => [key, after[key]])),
    });

    return after;
  });
}
