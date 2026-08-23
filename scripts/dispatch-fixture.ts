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

import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import {
  dispatchLines,
  dispatches,
  productClasses,
  productFireRatings,
  productSuppliers,
  productThicknesses,
} from "@/db/schema";
import { dispatchDiffers } from "@/lib/dispatches";
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

  // **And now `S120`'s flag can be true.** The same shape as the arithmetic
  // above, one rule later: a hand-written row has to satisfy
  // `dispatches_difference_flag` at INSERT, before any line exists, so its
  // callers write `false` there — and `false` would then be a claim that this
  // fixture matched the quotation it names, which nothing checked.
  //
  // `verify:schema25` §17 is what makes that matter: it asserts over EVERY row
  // that a dispatch which differs from its version has somebody named for it,
  // and a fixture left at `false` while its line differs would fail that check
  // for a reason about the fixture — the least useful failure a verify script
  // can produce, and the one this file's `productLineMoney` note already
  // records happening once.
  //
  // Corrected with `dispatchDiffers` itself, so the fixture cannot hold a
  // second definition of the word. A free-entry row `S75` names no version and
  // is left alone: its pair is null, and null is not false.
  await db
    .update(dispatches)
    .set({ differedAtSubmission: dispatchDiffers, linesChangedAfterSubmission: false })
    .where(
      and(
        eq(dispatches.id, dispatchId),
        isNotNull(dispatches.quotationVersionId),
        isNotNull(dispatches.submittedAt),
      ),
    );
}
