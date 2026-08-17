/**
 * The lookup tables the CRM forms select from: countries `S14`, cities
 * `[07 A7]`, `[15 §3]`, company categories `[12 §4]` and lead sources
 * `[10 §12]`, `[15 §1]`.
 *
 * Reference data, so no **visibility** filter — these rows describe the world,
 * not anybody's customers. Lead sources do carry a **selectability** filter,
 * which is a different question: see below.
 *
 * Most can still legitimately be empty. `15` supplies the city and
 * lead-source values that `14` recorded as unknown, but the columns stay
 * nullable and a form must render an empty select and still save. An empty
 * lookup is a missing decision, not a broken screen. Countries are the one
 * exception, and not by choice here: `companies.country_id` is `NOT NULL`
 * `S14`, so migration 0010 puts Saudi Arabia in the table itself.
 *
 * Three rules live here rather than in a feature module, because each has to
 * give the same answer to a screen and to a write:
 *
 *  1. **Which lead sources may this identity choose** `[15 §2]` — the list and
 *     the check are built from one predicate, so a dropdown can never offer
 *     something the action then refuses, or hide something it would accept.
 *  2. **Which region a record gets** `[15 §4]` — derived from the city when
 *     there is one. The form displays it; the data layer decides it.
 *  3. **Whether a company has a city and a region at all** `S14` `S15` — Saudi
 *     companies do, everyone else has neither. The form hides the fields; the
 *     data layer is what makes them null.
 */

import { asc, eq, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  cities,
  companyCategories,
  countries,
  leadSources,
  lossReasons,
  productClasses,
  productFireRatings,
  productSuppliers,
  productThicknesses,
  serviceTypes,
} from "@/db/schema";
import { can, type AuthSession } from "@/lib/authz";
import { SAUDI_CODE, type Region } from "@/lib/enums";
import { RuleError } from "@/lib/validation";

/** The shape every lookup shares: an id and a name in both languages. */
export type LookupRow = {
  id: string;
  nameEn: string;
  nameAr: string;
};

/** A city carries its region, which is what `15 §4` derives from. */
export type CityRow = LookupRow & { region: Region };

export async function listCities(): Promise<CityRow[]> {
  return db
    .select({
      id: cities.id,
      nameEn: cities.nameEn,
      nameAr: cities.nameAr,
      region: cities.region,
    })
    .from(cities)
    .orderBy(asc(cities.nameEn));
}

/**
 * The region to write for a record `[15 §4]`.
 *
 * A city knows its region, so nobody is asked for it: with a city chosen the
 * city decides, and the submitted value is ignored rather than trusted. Without
 * one, the manually chosen region stands.
 *
 * This lives in the data layer on purpose. A form that fills the field in
 * JavaScript is a suggestion — every caller has to get the same answer,
 * including one that never rendered a form.
 */
export async function regionForCity(
  cityId: string | null,
  chosenRegion: Region | null,
): Promise<Region | null> {
  if (!cityId) return chosenRegion;

  const [city] = await db
    .select({ region: cities.region })
    .from(cities)
    .where(eq(cities.id, cityId))
    .limit(1);
  // A city id that resolves to nothing is a bad reference, not a missing
  // region — report it against the field rather than letting the foreign key
  // surface as a 500.
  if (!city) throw new RuleError("validation.invalid", "cityId");

  return city.region;
}

/* ------------------------------------------------------------------ *
 * Countries `S14`, and the Saudi-only rule `S15` hanging off them
 * ------------------------------------------------------------------ */

/**
 * A country carries its ISO code, which is what the Saudi branch tests — here
 * and in the form, which needs it to pick the default and to decide whether to
 * render a city field. `SAUDI_CODE` itself lives in `lib/enums.ts`, the module
 * a client component may import from.
 */
export type CountryRow = LookupRow & { code: string };

export async function listCountries(): Promise<CountryRow[]> {
  return db
    .select({
      id: countries.id,
      code: countries.code,
      nameEn: countries.nameEn,
      nameAr: countries.nameAr,
    })
    .from(countries)
    .orderBy(asc(countries.nameEn));
}

/**
 * Where a company is, for the columns that record it `S14` `S15`.
 *
 * `S15` is Saudi-only: a Saudi company's region comes from its city, and a
 * company anywhere else has neither. So this answers both columns at once
 * rather than leaving a caller to remember the second — which is the shape
 * that lets a non-Saudi company keep a stale Riyadh city through one edit.
 *
 * Three things happen here, in order:
 *
 *  1. **The country id is resolved**, so a tampered or stale `<select>` value
 *     is reported against its field rather than surfacing as a foreign-key
 *     500 — the job `regionForCity` and `assertLeadSourceSelectable` already
 *     do for `cityId` and `leadSourceId`.
 *  2. **Not Saudi Arabia → both are null.** Whatever the form posted is
 *     discarded, not trusted: there are no foreign cities in `cities` for it
 *     to have meant, and a region is a Saudi administrative region.
 *  3. **Saudi Arabia → `regionForCity` decides**, exactly as it did before
 *     this rule existed.
 *
 * It lives in the data layer for the reason `regionForCity` does: a form that
 * hides the city field in JavaScript is a suggestion, and every caller has to
 * get the same answer — including one that never rendered a form.
 *
 * Companies only. `regionForCity` stays as it is because `projects` has a city
 * and a region and no country `S14`.
 */
export async function placeForCountry(
  countryId: string,
  cityId: string | null,
  chosenRegion: Region | null,
): Promise<{ cityId: string | null; region: Region | null }> {
  const [country] = await db
    .select({ code: countries.code })
    .from(countries)
    .where(eq(countries.id, countryId))
    .limit(1);
  if (!country) throw new RuleError("validation.invalid", "countryId");

  if (country.code !== SAUDI_CODE) return { cityId: null, region: null };

  return { cityId, region: await regionForCity(cityId, chosenRegion) };
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

/** A loss reason carries its `code` `[25 §5]` — the token `projects.ts` branches
 *  on to tell `other` apart from the rest, without hardcoding its uuid. */
export type LossReasonRow = LookupRow & { code: string };

/**
 * The nine loss reasons `[25 §5]`, for the screen that offers them.
 *
 * No selectability filter and no visibility filter: a reason describes the
 * world, like a city. Ordered by the English name for now, as every other
 * lookup here is — `25 §5` states the list, not an order to display it in.
 */
export async function listLossReasons(): Promise<LossReasonRow[]> {
  return db
    .select({
      id: lossReasons.id,
      nameEn: lossReasons.nameEn,
      nameAr: lossReasons.nameAr,
      code: lossReasons.code,
    })
    .from(lossReasons)
    .orderBy(asc(lossReasons.nameEn));
}

/**
 * The code behind a loss-reason id `[25 §5]`.
 *
 * `projects.ts` reads it to decide whether the free-text detail is required
 * (`other`) or forbidden (every other code) — the rule a CHECK cannot hold,
 * because it would have to subquery this table to read the code behind a
 * uuid. One query does double duty: it also catches a tampered or stale id
 * from a `<select>` that no longer offers it, the same job `regionForCity`
 * and `assertLeadSourceSelectable` do for `cityId` and `leadSourceId`.
 *
 * Returns `null` for an id that does not resolve, rather than throwing —
 * the caller knows the field name to report against and this does not.
 */
export async function lossReasonCode(id: string): Promise<string | null> {
  const [reason] = await db
    .select({ code: lossReasons.code })
    .from(lossReasons)
    .where(eq(lossReasons.id, id))
    .limit(1);
  return reason?.code ?? null;
}

/**
 * The lead sources this identity may pick `[15 §2]`.
 *
 * `can_assign` — marketing, desk reps, managers, super admin `[07 A5]`,
 * `[12 §2]` — sees every option. Everyone else sees the `rep_selectable` ones.
 * The flag is read through `can()`; no role name appears here, and no new
 * permission was invented for this.
 *
 * `currentId` is what makes `15 §2.1` work: a company already sourced to
 * marketing keeps that value in a rep's list, so re-saving the form cannot
 * silently blank it. It is added to the list, never to the set of things the
 * rep may newly choose — `assertLeadSourceSelectable` is what enforces that,
 * and the two agree because the same `rep_selectable` column answers both.
 */
export async function listLeadSources(
  session: AuthSession,
  currentId?: string | null,
): Promise<LookupRow[]> {
  const terms: SQL[] = [eq(leadSources.repSelectable, true)];
  if (currentId) terms.push(eq(leadSources.id, currentId));

  const filter: SQL | undefined = can(session, "canAssign")
    ? undefined
    : or(...terms);

  return db
    .select({
      id: leadSources.id,
      nameEn: leadSources.nameEn,
      nameAr: leadSources.nameAr,
    })
    .from(leadSources)
    .where(filter)
    .orderBy(asc(leadSources.nameEn));
}

/**
 * May this identity set the record's lead source to `next`? `[15 §2]`
 *
 * Called by the data layer, so the rule holds for every caller — a rep who
 * posts a restricted id straight to the server action is refused exactly like
 * one who never saw the option. Hiding it in the dropdown is presentation;
 * this is the rule.
 *
 * Two things are deliberately allowed:
 *  - **Clearing.** Removing a lead source is not choosing a restricted one.
 *  - **Re-saving an unchanged value** `[15 §2.1]`. A rep editing a company
 *    the marketing team sourced keeps it; only a *change* is checked. FACET
 *    does not lose data to a permission rule.
 */
export async function assertLeadSourceSelectable(
  session: AuthSession,
  next: string | null,
  previous: string | null = null,
): Promise<void> {
  if (!next || next === previous) return;

  const [source] = await db
    .select({ repSelectable: leadSources.repSelectable })
    .from(leadSources)
    .where(eq(leadSources.id, next))
    .limit(1);
  if (!source) throw new RuleError("validation.invalid", "leadSourceId");

  if (source.repSelectable) return;
  if (can(session, "canAssign")) return;

  throw new RuleError(
    "companies.errors.leadSourceNotSelectable",
    "leadSourceId",
  );
}

/* ------------------------------------------------------------------ *
 * Product attribute lookups `[08 D1]`, `[09 §5.6]`
 *
 * Reference data like the three above — no visibility filter, and no
 * selectability rule either: nothing in any document restricts who may quote
 * which supplier.
 *
 * **There is no colour reader here.** `17 §2` makes the colour free text on
 * the line; the lookup table it once pointed at is gone since feature slice 6
 * `[26 §2]`, and the value lives only in `quotation_lines.custom_colour`.
 *
 * Suppliers are seeded `[17 §1]`, which is what makes a quotation line saveable
 * at all — `supplier_id` is `NOT NULL`. The screens still handle an empty list,
 * because an unseeded database is a real state.
 * ------------------------------------------------------------------ */

/** A product attribute whose `code` is the token in the generated name. */
export type ProductCodeRow = LookupRow & { code: string };

/** 4 mm is standard and is omitted from the generated name `[08 B1]`. */
export type ThicknessRow = {
  id: string;
  thicknessMm: string;
  isStandard: boolean;
};

export async function listProductSuppliers(): Promise<ProductCodeRow[]> {
  return db
    .select({
      id: productSuppliers.id,
      code: productSuppliers.code,
      nameEn: productSuppliers.nameEn,
      nameAr: productSuppliers.nameAr,
    })
    .from(productSuppliers)
    .orderBy(asc(productSuppliers.code));
}

export async function listProductClasses(): Promise<ProductCodeRow[]> {
  return db
    .select({
      id: productClasses.id,
      code: productClasses.code,
      nameEn: productClasses.nameEn,
      nameAr: productClasses.nameAr,
    })
    .from(productClasses)
    .orderBy(asc(productClasses.code));
}

export async function listProductFireRatings(): Promise<ProductCodeRow[]> {
  return db
    .select({
      id: productFireRatings.id,
      code: productFireRatings.code,
      nameEn: productFireRatings.nameEn,
      nameAr: productFireRatings.nameAr,
    })
    .from(productFireRatings)
    .orderBy(asc(productFireRatings.code));
}

export async function listProductThicknesses(): Promise<ThicknessRow[]> {
  return db
    .select({
      id: productThicknesses.id,
      thicknessMm: productThicknesses.thicknessMm,
      isStandard: productThicknesses.isStandard,
    })
    .from(productThicknesses)
    .orderBy(asc(productThicknesses.thicknessMm));
}

/** `[10 §12]`, seeded per `[16 §4]`. All are priced per m² `[12 §10]`. */
export async function listServiceTypes(): Promise<LookupRow[]> {
  return db
    .select({
      id: serviceTypes.id,
      nameEn: serviceTypes.nameEn,
      nameAr: serviceTypes.nameAr,
    })
    .from(serviceTypes)
    .orderBy(asc(serviceTypes.nameEn));
}

/**
 * The name to show for a lookup row.
 *
 * Lookup names are data, not message keys — a category added next year cannot
 * appear in `messages/*.json` — so this is where the locale is applied. Falls
 * back to English when the Arabic name is missing, which is better than a
 * blank option.
 *
 * It covers any row carrying a bilingual name pair, projects included, so
 * `name_ar` is nullable here. Companies and contacts no longer have a pair
 * `S12` `S19` — render their `name` directly.
 */
export function lookupName(
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
