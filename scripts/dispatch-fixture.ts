/**
 * One dispatch line, for the verify scripts that write a dispatch **by hand**
 * rather than through `recordDispatch` — NOT a feature.
 *
 * Four scripts insert a `dispatches` row directly, to reach a state their own
 * subject needs without going through the dispatch gates. Since `S116` a
 * dispatch carries its own lines and its square metres are the sum of them, so
 * a hand-written row with no line is a dispatch that reads as 0 m² — which is
 * exactly what `verify:schema25` §14 refuses, and what would silently zero
 * `S26`'s figures. This gives each of them the one line it needs.
 *
 * **Width and length are 1**, so `quantity_pcs × 1 × 1` makes `sqm` whatever
 * the caller asks for. That keeps every figure those scripts already assert on
 * unchanged, and it is honest about what it is: a fixture shaped to a number,
 * not a panel anybody would order.
 */

import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  dispatchLines,
  productClasses,
  productFireRatings,
  productSuppliers,
  productThicknesses,
} from "@/db/schema";
import { productLineMoney } from "@/lib/quotations";

const UNIT_PRICE = "95.00";

/**
 * Give a hand-written dispatch the one priced line `S116` requires.
 *
 * Returns nothing: the caller already holds the dispatch, and the line is a
 * precondition rather than a subject. Throws if the product lookups are not
 * seeded, which is the same failure every one of these scripts already reports.
 */
export async function addDispatchLine(
  dispatchId: string,
  sqm: string,
): Promise<void> {
  const [supplier] = await db.select().from(productSuppliers).limit(1);
  const [productClass] = await db.select().from(productClasses).limit(1);
  const [fireRating] = await db.select().from(productFireRatings).limit(1);
  const [thickness] = await db
    .select()
    .from(productThicknesses)
    .where(eq(productThicknesses.isStandard, true))
    .limit(1);

  if (!supplier || !productClass || !fireRating || !thickness) {
    throw new Error(
      "The product lookups are not seeded. Run: npm run db:seed",
    );
  }

  // **`productLineMoney`, not a copy of it.** `verify:schema25` §14 asserts
  // that every dispatch line's total is its price times its square metres and
  // its VAT is 15% of that `S56` `S57`; a fixture doing its own arithmetic
  // fails those checks for a reason that is about the fixture, which is the
  // least useful failure a verify script can produce. It did, once.
  const money = productLineMoney({
    quantityPcs: sqm,
    widthM: "1.0000",
    lengthM: "1.0000",
    unitPrice: UNIT_PRICE,
  });

  await db.insert(dispatchLines).values({
    dispatchId,
    supplierId: supplier.id,
    classId: productClass.id,
    fireRatingId: fireRating.id,
    customColour: "168",
    thicknessId: thickness.id,
    widthM: "1.0000",
    lengthM: "1.0000",
    quantityPcs: sqm,
    unitPrice: UNIT_PRICE,
    lineTotal: money.lineTotal as string,
    vatAmount: money.vatAmount as string,
  });
}
