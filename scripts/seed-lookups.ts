/**
 * Seed the lookup tables that `12 §14` calls for after the migration:
 * company categories `[12 §4]`, the product attribute lookups `[08 B1]`, and —
 * since `15` — lead sources `[15 §1]` and Saudi cities `[15 §3]`. `16 §4` adds
 * the service types, `25` adds the loss reasons `[25 §5]` and a tenth
 * company category `[25 §33]`, and `S14` adds the countries.
 * `npm run db:seed:lookups`, or `npm run db:seed` for these plus the roles.
 *
 * Idempotent by natural key — name for a category, code for a product
 * attribute, the value itself for a thickness. A second run inserts nothing
 * and corrects a name that has changed in the seed file. None of these tables
 * carries a unique index, so this is a read-then-write rather than an upsert;
 * that is deliberate, because `12 §14` asks for no index and a seed script is
 * not a reason to add one `[CLAUDE.md: never add what no document requires]`.
 *
 * Nothing here deletes. A value removed from a seed array stays in the
 * database — categories end up on real records, and FACET does not delete
 * history `[12 §7]`.
 */

process.loadEnvFile(".env");

import { eq } from "drizzle-orm";

import { closeDatabase, db } from "@/db";
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

import { CITY_SEED } from "./seed/cities";
import { COMPANY_CATEGORY_SEED } from "./seed/company-categories";
import { COUNTRY_SEED } from "./seed/countries";
import { LEAD_SOURCE_SEED } from "./seed/lead-sources";
import { LOSS_REASON_SEED } from "./seed/loss-reasons";
import {
  PRODUCT_CLASS_SEED,
  PRODUCT_FIRE_RATING_SEED,
  PRODUCT_SUPPLIER_SEED,
  PRODUCT_THICKNESS_SEED,
} from "./seed/products";
import { SERVICE_TYPE_SEED } from "./seed/services";

type Counts = { inserted: number; updated: number; unchanged: number };

const zero = (): Counts => ({ inserted: 0, updated: 0, unchanged: 0 });

function report(label: string, counts: Counts): void {
  console.log(
    `  ${label}: ${counts.inserted} inserted, ${counts.updated} updated, ` +
      `${counts.unchanged} unchanged`,
  );
}

/** `12 §4` + `25 §33` — ten categories, keyed on the English name. */
async function seedCompanyCategories(): Promise<Counts> {
  const counts = zero();
  for (const row of COMPANY_CATEGORY_SEED) {
    const [existing] = await db
      .select()
      .from(companyCategories)
      .where(eq(companyCategories.nameEn, row.nameEn))
      .limit(1);

    if (!existing) {
      await db.insert(companyCategories).values(row);
      counts.inserted += 1;
    } else if (existing.nameAr !== row.nameAr) {
      await db
        .update(companyCategories)
        .set({ nameAr: row.nameAr })
        .where(eq(companyCategories.id, existing.id));
      counts.updated += 1;
    } else {
      counts.unchanged += 1;
    }
  }
  return counts;
}

/**
 * Lead sources `[15 §1]`, keyed on the English name.
 *
 * `rep_selectable` is corrected on a second run like any other attribute: it is
 * configuration `[15 §2]`, so changing which sources a rep may pick is a seed
 * edit and a re-run, never a migration.
 */
async function seedLeadSources(): Promise<Counts> {
  const counts = zero();
  for (const row of LEAD_SOURCE_SEED) {
    const [existing] = await db
      .select()
      .from(leadSources)
      .where(eq(leadSources.nameEn, row.nameEn))
      .limit(1);

    if (!existing) {
      await db.insert(leadSources).values(row);
      counts.inserted += 1;
    } else if (
      existing.nameAr !== row.nameAr ||
      existing.repSelectable !== row.repSelectable
    ) {
      await db
        .update(leadSources)
        .set({ nameAr: row.nameAr, repSelectable: row.repSelectable })
        .where(eq(leadSources.id, existing.id));
      counts.updated += 1;
    } else {
      counts.unchanged += 1;
    }
  }
  return counts;
}

/**
 * Countries `S14`, keyed on `code`.
 *
 * A true upsert like the loss reasons, and for the same reason: `code` is the
 * identifier the application refers to — `SAUDI_CODE` decides whether a company
 * is offered a city at all `S15` — so a second row carrying `SA` would be a
 * live defect rather than untidiness. Both names are corrected on a re-run,
 * because the code, not the text, is what anything holds onto.
 *
 * Migration 0010 has already inserted Saudi Arabia: `companies.country_id` is
 * `NOT NULL` and its backfill needed a row to point at. This finds that row by
 * its code and leaves it alone.
 */
async function seedCountries(): Promise<Counts> {
  const counts = zero();
  for (const row of COUNTRY_SEED) {
    const [existing] = await db
      .select()
      .from(countries)
      .where(eq(countries.code, row.code))
      .limit(1);

    if (!existing) {
      await db.insert(countries).values(row);
      counts.inserted += 1;
    } else if (
      existing.nameEn !== row.nameEn ||
      existing.nameAr !== row.nameAr
    ) {
      await db
        .update(countries)
        .set({ nameEn: row.nameEn, nameAr: row.nameAr })
        .where(eq(countries.id, existing.id));
      counts.updated += 1;
    } else {
      counts.unchanged += 1;
    }
  }
  return counts;
}

/**
 * Saudi cities `[15 §3]`, keyed on the English name.
 *
 * A city that changes region on a re-run is updated in place rather than
 * replaced: `companies.city_id` and `projects.city_id` point at these rows, and
 * FACET does not delete a row that history references `[12 §7]`. Existing
 * records keep the region written at the time `[15 §4]` — re-drawing the
 * grouping is not meant to rewrite what was already recorded.
 */
async function seedCities(): Promise<Counts> {
  const counts = zero();
  for (const row of CITY_SEED) {
    const [existing] = await db
      .select()
      .from(cities)
      .where(eq(cities.nameEn, row.nameEn))
      .limit(1);

    if (!existing) {
      await db.insert(cities).values(row);
      counts.inserted += 1;
    } else if (
      existing.nameAr !== row.nameAr ||
      existing.region !== row.region
    ) {
      await db
        .update(cities)
        .set({ nameAr: row.nameAr, region: row.region })
        .where(eq(cities.id, existing.id));
      counts.updated += 1;
    } else {
      counts.unchanged += 1;
    }
  }
  return counts;
}

/**
 * Loss reasons `[25 §5]`, keyed on `code`.
 *
 * The one lookup here with a unique index, so this is a true upsert rather
 * than the read-then-write its siblings use. That is not inconsistency: the
 * others carry no natural key a document asked for, while `25 §5` makes the
 * code the identifier `src/lib/projects.ts` branches on, and a second row
 * called `other` would be a live defect rather than a tidiness problem.
 *
 * Nothing deletes. A reason the founder prunes from this list stays in the
 * database, because projects point at it and FACET does not delete history
 * `[12 §7]` — pruning means it stops being offered, not that past losses lose
 * their reason.
 */
async function seedLossReasons(): Promise<Counts> {
  const counts = zero();
  for (const row of LOSS_REASON_SEED) {
    const [existing] = await db
      .select()
      .from(lossReasons)
      .where(eq(lossReasons.code, row.code))
      .limit(1);

    if (!existing) {
      await db.insert(lossReasons).values(row);
      counts.inserted += 1;
    } else if (
      existing.nameEn !== row.nameEn ||
      existing.nameAr !== row.nameAr
    ) {
      await db
        .update(lossReasons)
        .set({ nameEn: row.nameEn, nameAr: row.nameAr })
        .where(eq(lossReasons.id, existing.id));
      counts.updated += 1;
    } else {
      counts.unchanged += 1;
    }
  }
  return counts;
}

/**
 * The three product lookups are keyed on `name_en`, not on a `code`. `0027`
 * dropped the code column from all three: `S53` says FACET does not reproduce
 * SMAC's product code, nothing rendered it, and the code WAS the name in every
 * seeded row `[08 B1]` — so the upsert key is the same string it always was.
 */
type NameRow = { nameEn: string; nameAr: string };

/** Suppliers N, K, D, C `[17 §1]`. The code is the name — no factory name is
 *  needed, and one would be invented product data. */
async function seedSuppliers(): Promise<Counts> {
  const counts = zero();
  for (const row of PRODUCT_SUPPLIER_SEED as readonly NameRow[]) {
    const [existing] = await db
      .select()
      .from(productSuppliers)
      .where(eq(productSuppliers.nameEn, row.nameEn))
      .limit(1);

    if (!existing) {
      await db.insert(productSuppliers).values(row);
      counts.inserted += 1;
    } else if (existing.nameAr !== row.nameAr) {
      // `name_en` is the key now, so only the Arabic form can have drifted.
      await db
        .update(productSuppliers)
        .set({ nameAr: row.nameAr })
        .where(eq(productSuppliers.id, existing.id));
      counts.updated += 1;
    } else {
      counts.unchanged += 1;
    }
  }
  return counts;
}

/** Classes A, B, A2G1, A2G2 `[08 B1]`. */
async function seedClasses(): Promise<Counts> {
  const counts = zero();
  for (const row of PRODUCT_CLASS_SEED as readonly NameRow[]) {
    const [existing] = await db
      .select()
      .from(productClasses)
      .where(eq(productClasses.nameEn, row.nameEn))
      .limit(1);

    if (!existing) {
      await db.insert(productClasses).values(row);
      counts.inserted += 1;
    } else if (existing.nameAr !== row.nameAr) {
      // `name_en` is the key now, so only the Arabic form can have drifted.
      await db
        .update(productClasses)
        .set({ nameAr: row.nameAr })
        .where(eq(productClasses.id, existing.id));
      counts.updated += 1;
    } else {
      counts.unchanged += 1;
    }
  }
  return counts;
}

/** Fire ratings B1, A2, Normal `[08 B1]`. No constraint ties these to a
 *  class — which combinations are real varies by factory `[12 §8]`. */
async function seedFireRatings(): Promise<Counts> {
  const counts = zero();
  for (const row of PRODUCT_FIRE_RATING_SEED as readonly NameRow[]) {
    const [existing] = await db
      .select()
      .from(productFireRatings)
      .where(eq(productFireRatings.nameEn, row.nameEn))
      .limit(1);

    if (!existing) {
      await db.insert(productFireRatings).values(row);
      counts.inserted += 1;
    } else if (existing.nameAr !== row.nameAr) {
      // `name_en` is the key now, so only the Arabic form can have drifted.
      await db
        .update(productFireRatings)
        .set({ nameAr: row.nameAr })
        .where(eq(productFireRatings.id, existing.id));
      counts.updated += 1;
    } else {
      counts.unchanged += 1;
    }
  }
  return counts;
}

/** 2 to 8 mm `[17 §3]`, 4 mm the only standard one. Keyed on the value;
 *  `numeric` reads back as a string, so the seed writes the same scale
 *  Postgres stores. */
async function seedThicknesses(): Promise<Counts> {
  const counts = zero();
  for (const row of PRODUCT_THICKNESS_SEED) {
    const [existing] = await db
      .select()
      .from(productThicknesses)
      .where(eq(productThicknesses.thicknessMm, row.thicknessMm))
      .limit(1);

    if (!existing) {
      await db.insert(productThicknesses).values(row);
      counts.inserted += 1;
    } else if (existing.isStandard !== row.isStandard) {
      await db
        .update(productThicknesses)
        .set({ isStandard: row.isStandard })
        .where(eq(productThicknesses.id, existing.id));
      counts.updated += 1;
    } else {
      counts.unchanged += 1;
    }
  }
  return counts;
}

/** CNC, cutting, bending, notching `[08 B4]`, `[16 §4]`, keyed on the English
 *  name. All are priced per m² `[12 §10]`, so there is no unit column here. */
async function seedServiceTypes(): Promise<Counts> {
  const counts = zero();
  for (const row of SERVICE_TYPE_SEED) {
    const [existing] = await db
      .select()
      .from(serviceTypes)
      .where(eq(serviceTypes.nameEn, row.nameEn))
      .limit(1);

    if (!existing) {
      await db.insert(serviceTypes).values(row);
      counts.inserted += 1;
    } else if (existing.nameAr !== row.nameAr) {
      await db
        .update(serviceTypes)
        .set({ nameAr: row.nameAr })
        .where(eq(serviceTypes.id, existing.id));
      counts.updated += 1;
    } else {
      counts.unchanged += 1;
    }
  }
  return counts;
}

export async function seedLookups(): Promise<void> {
  report("company categories", await seedCompanyCategories());
  report("lead sources", await seedLeadSources());
  report("loss reasons", await seedLossReasons());
  report("countries", await seedCountries());
  report("cities", await seedCities());
  report("product suppliers", await seedSuppliers());
  report("product classes", await seedClasses());
  report("product fire ratings", await seedFireRatings());
  report("product thicknesses", await seedThicknesses());
  report("service types", await seedServiceTypes());
}

// Run directly (tsx scripts/seed-lookups.ts) — also imported by scripts/seed.ts.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("seed-lookups.ts")) {
  seedLookups()
    .then(async () => {
      await closeDatabase();
    })
    .catch(async (error) => {
      console.error(error);
      await closeDatabase();
      process.exit(1);
    });
}
