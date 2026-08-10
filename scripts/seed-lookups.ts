/**
 * Seed the lookup tables that `12 §14` calls for after the migration:
 * company categories `[12 §4]`, the product attribute lookups `[08 B1]`, and —
 * since `15` — lead sources `[15 §1]` and Saudi cities `[15 §3]`. `16 §4` adds
 * the service types.
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
 * database — categories and colours end up on real records, and FACET does
 * not delete history `[12 §7]`.
 */

process.loadEnvFile(".env");

import { eq } from "drizzle-orm";

import { closeDatabase, db } from "@/db";
import {
  cities,
  companyCategories,
  leadSources,
  productClasses,
  productColours,
  productFireRatings,
  productSuppliers,
  productThicknesses,
  serviceTypes,
} from "@/db/schema";

import { CITY_SEED } from "./seed/cities";
import { COMPANY_CATEGORY_SEED } from "./seed/company-categories";
import { LEAD_SOURCE_SEED } from "./seed/lead-sources";
import {
  PRODUCT_CLASS_SEED,
  PRODUCT_COLOUR_SEED,
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

/** `12 §4` — nine categories, keyed on the English name. */
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

type CodeRow = { code: string; nameEn: string; nameAr: string };

/** Suppliers N, K, D, C `[17 §1]`. The code is the name — no factory name is
 *  needed, and one would be invented product data. */
async function seedSuppliers(): Promise<Counts> {
  const counts = zero();
  for (const row of PRODUCT_SUPPLIER_SEED as readonly CodeRow[]) {
    const [existing] = await db
      .select()
      .from(productSuppliers)
      .where(eq(productSuppliers.code, row.code))
      .limit(1);

    if (!existing) {
      await db.insert(productSuppliers).values(row);
      counts.inserted += 1;
    } else if (existing.nameEn !== row.nameEn || existing.nameAr !== row.nameAr) {
      await db
        .update(productSuppliers)
        .set({ nameEn: row.nameEn, nameAr: row.nameAr })
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
  for (const row of PRODUCT_CLASS_SEED as readonly CodeRow[]) {
    const [existing] = await db
      .select()
      .from(productClasses)
      .where(eq(productClasses.code, row.code))
      .limit(1);

    if (!existing) {
      await db.insert(productClasses).values(row);
      counts.inserted += 1;
    } else if (existing.nameEn !== row.nameEn || existing.nameAr !== row.nameAr) {
      await db
        .update(productClasses)
        .set({ nameEn: row.nameEn, nameAr: row.nameAr })
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
  for (const row of PRODUCT_FIRE_RATING_SEED as readonly CodeRow[]) {
    const [existing] = await db
      .select()
      .from(productFireRatings)
      .where(eq(productFireRatings.code, row.code))
      .limit(1);

    if (!existing) {
      await db.insert(productFireRatings).values(row);
      counts.inserted += 1;
    } else if (existing.nameEn !== row.nameEn || existing.nameAr !== row.nameAr) {
      await db
        .update(productFireRatings)
        .set({ nameEn: row.nameEn, nameAr: row.nameAr })
        .where(eq(productFireRatings.id, existing.id));
      counts.updated += 1;
    } else {
      counts.unchanged += 1;
    }
  }
  return counts;
}

/** Colours — empty on purpose and permanently `[17 §2]`. The colour is typed
 *  into `quotation_lines.custom_colour`, not picked; the table stays because no
 *  document asks for it to be dropped. This loop therefore does nothing. */
async function seedColours(): Promise<Counts> {
  const counts = zero();
  for (const row of PRODUCT_COLOUR_SEED as readonly CodeRow[]) {
    const [existing] = await db
      .select()
      .from(productColours)
      .where(eq(productColours.code, row.code))
      .limit(1);

    if (!existing) {
      await db.insert(productColours).values(row);
      counts.inserted += 1;
    } else if (existing.nameEn !== row.nameEn || existing.nameAr !== row.nameAr) {
      await db
        .update(productColours)
        .set({ nameEn: row.nameEn, nameAr: row.nameAr })
        .where(eq(productColours.id, existing.id));
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
  report("cities", await seedCities());
  report("product suppliers", await seedSuppliers());
  report("product classes", await seedClasses());
  report("product fire ratings", await seedFireRatings());
  report("product colours", await seedColours());
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
