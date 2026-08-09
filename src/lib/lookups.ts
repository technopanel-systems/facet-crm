/**
 * The lookup tables the CRM forms select from: cities `[07 A7]`, company
 * categories `[12 §4]` and lead sources `[10 §12]`.
 *
 * Reference data, so no visibility filter — these rows describe the world,
 * not anybody's customers.
 *
 * **All three can legitimately be empty.** `company_categories` is seeded
 * `[12 §4]`, but no document lists Saudi cities or the real lead-source
 * vocabulary, so those tables ship empty and their columns are nullable. A
 * form must render an empty select and still save — an empty lookup is a
 * missing decision, not a broken screen, and inventing values to fill the gap
 * is exactly what `CLAUDE.md` forbids.
 */

import { asc } from "drizzle-orm";

import { db } from "@/db";
import { cities, companyCategories, leadSources } from "@/db/schema";

/** The shape every lookup shares: an id and a name in both languages. */
export type LookupRow = {
  id: string;
  nameEn: string;
  nameAr: string;
};

export async function listCities(): Promise<LookupRow[]> {
  return db
    .select({ id: cities.id, nameEn: cities.nameEn, nameAr: cities.nameAr })
    .from(cities)
    .orderBy(asc(cities.nameEn));
}

export async function listCompanyCategories(): Promise<LookupRow[]> {
  return db
    .select({
      id: companyCategories.id,
      nameEn: companyCategories.nameEn,
      nameAr: companyCategories.nameAr,
    })
    .from(companyCategories)
    .orderBy(asc(companyCategories.nameEn));
}

export async function listLeadSources(): Promise<LookupRow[]> {
  return db
    .select({
      id: leadSources.id,
      nameEn: leadSources.nameEn,
      nameAr: leadSources.nameAr,
    })
    .from(leadSources)
    .orderBy(asc(leadSources.nameEn));
}

/**
 * The name to show for a lookup row.
 *
 * Lookup names are data, not message keys — a category added next year cannot
 * appear in `messages/*.json` — so this is where the locale is applied. Falls
 * back to English when the Arabic name is missing, which is better than a
 * blank option.
 */
export function lookupName(row: LookupRow, locale: string): string {
  return locale === "ar" ? row.nameAr || row.nameEn : row.nameEn;
}

/**
 * The same rule for records that carry a bilingual name of their own
 * (companies, contacts, projects), where `name_ar` is genuinely optional.
 */
export function bilingualName(
  row: { nameEn: string; nameAr: string | null },
  locale: string,
): string {
  return locale === "ar" ? row.nameAr || row.nameEn : row.nameEn;
}

/**
 * The same rule again, for a joined lookup name that arrived as two loose
 * columns and may be null because the join found nothing. Returns `null` so
 * the caller decides what an absent value looks like.
 */
export function pickName(
  locale: string,
  nameEn: string | null,
  nameAr: string | null,
): string | null {
  if (!nameEn) return null;
  return locale === "ar" ? nameAr || nameEn : nameEn;
}
