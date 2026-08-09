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

import { and, count, desc, eq, ilike, isNull, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  cities,
  companies,
  companyCategories,
  companyReps,
  leadSources,
  users,
} from "@/db/schema";
import { withAudit } from "@/lib/audit";
import {
  canViewRecord,
  visibleCompaniesFilter,
  type AuthSession,
} from "@/lib/authz";
import {
  REGIONS,
  WARMTHS,
  type Region,
  type SameValues,
  type Warmth,
} from "@/lib/enums";
import { assertLeadSourceSelectable, regionForCity } from "@/lib/lookups";
import { normalizedNameFor } from "@/lib/normalize";
import { RuleError } from "@/lib/validation";

export type Company = typeof companies.$inferSelect;

/** Compile-time proof that `enums.ts` still matches the database. */
export type RegionMatchesSchema = SameValues<
  Region,
  NonNullable<Company["region"]>
>;
export type WarmthMatchesSchema = SameValues<
  Warmth,
  NonNullable<Company["warmth"]>
>;

export { REGIONS, WARMTHS };
export type { Region, Warmth };

/** Everything a rep may type on the company form. Both enums are nullable —
 *  unqualified entry needs almost nothing `[10 §2]`. */
export type CompanyInput = {
  nameEn: string;
  nameAr: string | null;
  phone: string | null;
  categoryId: string | null;
  vatNumber: string | null;
  region: Region | null;
  cityId: string | null;
  leadSourceId: string | null;
  notes: string | null;
  warmth: Warmth | null;
};

export type CompanyListRow = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  phone: string | null;
  warmth: Warmth | null;
  region: Region | null;
  categoryNameEn: string | null;
  categoryNameAr: string | null;
  cityNameEn: string | null;
  cityNameAr: string | null;
  createdAt: Date;
};

/** `09 §3.1` — no document sets a page size; 25 is a display detail. */
const PAGE_SIZE = 25;

/**
 * Free-text search. Matches the normalized name — so an Arabic query finds an
 * Arabic name written with different diacritics — or the phone, which `07 B6`
 * calls the strongest key a company has.
 */
function searchFilter(query: string | undefined): SQL | undefined {
  const trimmed = query?.trim();
  if (!trimmed) return undefined;
  return or(
    ilike(companies.nameNormalized, `%${normalizedNameFor({ nameEn: trimmed })}%`),
    ilike(companies.phone, `%${trimmed}%`),
  );
}

export async function listCompanies(
  session: AuthSession,
  options: { q?: string; page?: number } = {},
): Promise<{ rows: CompanyListRow[]; total: number; page: number }> {
  const page = Math.max(1, options.page ?? 1);
  const where = and(visibleCompaniesFilter(session), searchFilter(options.q));

  const rows = await db
    .select({
      id: companies.id,
      nameEn: companies.nameEn,
      nameAr: companies.nameAr,
      phone: companies.phone,
      warmth: companies.warmth,
      region: companies.region,
      categoryNameEn: companyCategories.nameEn,
      categoryNameAr: companyCategories.nameAr,
      cityNameEn: cities.nameEn,
      cityNameAr: cities.nameAr,
      createdAt: companies.createdAt,
    })
    .from(companies)
    .leftJoin(companyCategories, eq(companies.categoryId, companyCategories.id))
    .leftJoin(cities, eq(companies.cityId, cities.id))
    .where(where)
    .orderBy(desc(companies.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  // Same WHERE, so the count can never disagree with the page.
  const [totals] = await db
    .select({ total: count() })
    .from(companies)
    .where(where);

  return { rows, total: totals?.total ?? 0, page };
}

/** The company select on the contact and project forms. */
export async function listCompanyOptions(
  session: AuthSession,
): Promise<{ id: string; nameEn: string; nameAr: string | null }[]> {
  return db
    .select({
      id: companies.id,
      nameEn: companies.nameEn,
      nameAr: companies.nameAr,
    })
    .from(companies)
    .where(visibleCompaniesFilter(session))
    .orderBy(companies.nameEn);
}

export type CompanyDetail = Company & {
  categoryNameEn: string | null;
  categoryNameAr: string | null;
  cityNameEn: string | null;
  cityNameAr: string | null;
  leadSourceNameEn: string | null;
  leadSourceNameAr: string | null;
  createdByName: string | null;
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
      cityNameEn: cities.nameEn,
      cityNameAr: cities.nameAr,
      leadSourceNameEn: leadSources.nameEn,
      leadSourceNameAr: leadSources.nameAr,
      createdByName: users.name,
    })
    .from(companies)
    .leftJoin(companyCategories, eq(companies.categoryId, companyCategories.id))
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
    cityNameEn: row.cityNameEn,
    cityNameAr: row.cityNameAr,
    leadSourceNameEn: row.leadSourceNameEn,
    leadSourceNameAr: row.leadSourceNameAr,
    createdByName: row.createdByName,
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
 * primary `[04 Q11]` and the origin is `self_registered` — a rep's own find
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
  const now = new Date();

  // Both rules run before the transaction opens: they only read, and a refusal
  // should not have started one.
  await assertLeadSourceSelectable(session, input.leadSourceId);
  const region = await regionForCity(input.cityId, input.region);

  return withAudit(session.actor, async (tx, log) => {
    const [company] = await tx
      .insert(companies)
      .values({
        ...input,
        // The city decides the region when there is one `[15 §4]`; whatever
        // the form posted is not consulted.
        region,
        nameNormalized: normalizedNameFor(input),
        // Warmth is the rep's judgement, and who set it is part of the record
        // `[10 §1]`. Stamped only when a value was actually chosen.
        warmthSetBy: input.warmth ? session.user.id : null,
        warmthSetAt: input.warmth ? now : null,
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

/** The columns a rep may change, for the before/after diff. */
const EDITABLE = [
  "nameEn",
  "nameAr",
  "phone",
  "categoryId",
  "vatNumber",
  "region",
  "cityId",
  "leadSourceId",
  "notes",
  "warmth",
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

    // What will actually be written: the region comes from the city when there
    // is one `[15 §4]`. The diff below compares against this, not against the
    // form, so a derived region shows up in the audit log as a real change.
    const values: CompanyInput = {
      ...input,
      region: await regionForCity(input.cityId, input.region),
    };

    const changed = EDITABLE.filter((key) => before[key] !== values[key]);
    if (changed.length === 0) return before;

    const warmthChanged = values.warmth !== before.warmth;

    const [after] = await tx
      .update(companies)
      .set({
        ...values,
        nameNormalized: normalizedNameFor(values),
        // Only a real change restamps warmth; re-saving the form must not
        // rewrite who judged the company and when `[10 §1]`.
        ...(warmthChanged
          ? {
              warmthSetBy: input.warmth ? session.user.id : null,
              warmthSetAt: input.warmth ? new Date() : null,
            }
          : {}),
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
