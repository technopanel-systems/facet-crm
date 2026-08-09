/**
 * Seed the lookup tables that `12 §14` calls for after the migration:
 * company categories `[12 §4]` and the product attribute lookups `[08 B1]`.
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
  companyCategories,
  productClasses,
  productColours,
  productFireRatings,
  productSuppliers,
  productThicknesses,
} from "@/db/schema";

import { COMPANY_CATEGORY_SEED } from "./seed/company-categories";
import {
  PRODUCT_CLASS_SEED,
  PRODUCT_COLOUR_SEED,
  PRODUCT_FIRE_RATING_SEED,
  PRODUCT_SUPPLIER_SEED,
  PRODUCT_THICKNESS_SEED,
} from "./seed/products";

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

type CodeRow = { code: string; nameEn: string; nameAr: string };

/** Suppliers `[08 B1]` — empty until the factory names are known. */
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

/** Colours `[08 B1: "many"]` — empty; no document lists a code. Specials are
 *  never rows here, they are `quotation_lines.custom_colour` `[12 §12]`. */
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

/** 4, 5, 6 mm `[08 B1]`. Keyed on the value; `numeric` reads back as a
 *  string, so the seed writes the same scale Postgres stores. */
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

export async function seedLookups(): Promise<void> {
  report("company categories", await seedCompanyCategories());
  report("product suppliers", await seedSuppliers());
  report("product classes", await seedClasses());
  report("product fire ratings", await seedFireRatings());
  report("product colours", await seedColours());
  report("product thicknesses", await seedThicknesses());
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
