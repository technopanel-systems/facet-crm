/**
 * One product line, for the verify scripts that write a `quotation_versions`
 * row **by hand** rather than through `createQuotationThread` — NOT a feature.
 *
 * Two scripts insert a version directly, to reach a state their own subject
 * needs without going through the quotation gates: `verify-phase9`, whose
 * subject is coverage and the timeline, and `verify-phase10a`, whose subject is
 * dormancy and follow-ups. Neither cares what the quotation contains, and both
 * were therefore leaving it empty.
 *
 * `S60` says a quotation always keeps at least one product line, and until now
 * nothing said so anywhere a reader would find it: `createQuotationThread` and
 * `removeQuotationLine` both enforced it without citing it, and no assertion
 * held it over the rows. These two scripts were the only thing in the project
 * producing a version with none — thirteen of them by the time it was counted —
 * and a lineless version is not a harmless fixture. It is offered by
 * `listDispatchableThreads` as dispatchable `S126` and prefills nothing `S116`,
 * its `total_sqm` is the figure `S77` calls quoted, and `S120` compares every
 * dispatch against its lines.
 *
 * The sibling of `dispatch-fixture.ts`, which exists for the same reason one
 * rule earlier: `S116` gave dispatches their own lines, and four scripts
 * writing a `dispatches` row by hand had to start giving them one.
 */

import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  productClasses,
  productFireRatings,
  productSuppliers,
  productThicknesses,
  quotationLines,
} from "@/db/schema";
import {
  productLineMoney,
  recomputeQuotationVersionTotals,
} from "@/lib/quotations";

const UNIT_PRICE = "120.00";

/**
 * Give a hand-written version the one product line `S60` requires.
 *
 * **Width and length are 1**, so `quantity_pcs × 1 × 1` makes `sqm` whatever
 * the caller asks for — `dispatch-fixture.ts`'s device, and honest about what
 * it is: a fixture shaped to a number, not a panel anybody would order.
 *
 * The totals are recomputed through `quotations.ts`'s own function rather than
 * worked out here. A version whose stored figures disagree with the line they
 * are made of would be a second defect introduced while fixing the first, and
 * `verify:schema25` §12 asserts those figures over every row that carries them.
 */
export async function addQuotationLineRow(
  versionId: string,
  sqm = "12.0000",
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
    throw new Error("The product lookups are not seeded. Run: npm run db:seed");
  }

  const money = productLineMoney({
    quantityPcs: sqm,
    widthM: "1.0000",
    lengthM: "1.0000",
    unitPrice: UNIT_PRICE,
  });

  await db.insert(quotationLines).values({
    versionId,
    supplierId: supplier.id,
    classId: productClass.id,
    fireRatingId: fireRating.id,
    customColour: "168",
    thicknessId: thickness.id,
    widthM: "1.0000",
    lengthM: "1.0000",
    quantityPcs: sqm,
    unitPrice: UNIT_PRICE,
    lineTotal: money.lineTotal,
    vatAmount: money.vatAmount,
  });

  await recomputeQuotationVersionTotals(versionId);
}
