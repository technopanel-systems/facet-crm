/**
 * Reading one product line off a form, in one place `S53` `S116`.
 *
 * **No `"use server"` and no `@/lib/*` data import.** Two server actions read
 * the same repeated inputs — a quotation's lines and a dispatch's — and `S116`
 * says outright that they are *the same shape as a quotation's product lines*.
 * A `"use server"` module may only export async functions, so this cannot live
 * beside either action; it sits next to `line-display.ts`, which exists for the
 * mirror-image reason on the rendering side.
 *
 * The one difference between the two callers is `priceRequired`. A quotation
 * line may carry no price `S58` — it contributes nothing and the screen says so
 * — while **every dispatched line carries one** `S116`: *nothing is dispatched
 * free*. That is a flag rather than two readers, because everything else about
 * the row is identical and two copies would drift.
 *
 * Shape only, as every form reader is. Whether an id exists and whether this
 * identity may use it is the data layer's question.
 */

import type { readFields } from "@/lib/validation";

export type ProductLineFields = {
  supplierId: string;
  classId: string;
  fireRatingId: string;
  customColour: string | null;
  thicknessId: string;
  widthM: string;
  lengthM: string;
  quantityPcs: string;
  unitPrice: string | null;
};

/** `1`, `1.5`, `0.0001` — never a sign, never an exponent. */
const DECIMAL = /^\d+(\.\d+)?$/;

/**
 * One row of repeated inputs, at `index`, or `null` for an untouched spare.
 *
 * `sqm`, `line_total` and `vat_amount` are never read from a form — FACET
 * computes them `[16 §1]` `S55`. **Nor is the VAT rate**, which no form offers
 * and no column holds: it is fixed at 15% `S57`.
 */
export function readProductLine(
  fields: ReturnType<typeof readFields>,
  index: number,
  formData: FormData,
  options: { priceRequired?: boolean } = {},
): ProductLineFields | null {
  const at = (name: string) => {
    const value = formData.getAll(name)[index];
    return typeof value === "string" ? value.trim() : "";
  };

  const supplierId = at("supplierId");
  if (!supplierId) return null; // an untouched spare row

  const line: ProductLineFields = {
    supplierId,
    classId: at("classId"),
    fireRatingId: at("fireRatingId"),
    customColour: at("customColour") || null,
    thicknessId: at("thicknessId"),
    widthM: at("widthM"),
    lengthM: at("lengthM"),
    quantityPcs: at("quantityPcs"),
    unitPrice: at("unitPrice") || null,
  };

  for (const [name, value] of [
    ["classId", line.classId],
    ["fireRatingId", line.fireRatingId],
    ["thicknessId", line.thicknessId],
  ] as const) {
    if (!value) fields.fail(name, "validation.required");
  }
  for (const [name, value] of [
    ["widthM", line.widthM],
    ["lengthM", line.lengthM],
    ["quantityPcs", line.quantityPcs],
  ] as const) {
    if (!value) fields.fail(name, "validation.required");
    else if (!DECIMAL.test(value)) fields.fail(name, "validation.notANumber");
  }
  // `S116` — a dispatch line with no price cannot be recorded, and the field
  // it belongs to is where the message goes. `recordDispatch` refuses it again.
  if (!line.unitPrice && options.priceRequired) {
    fields.fail("unitPrice", "validation.required");
  }
  if (line.unitPrice && !DECIMAL.test(line.unitPrice)) {
    fields.fail("unitPrice", "validation.notANumber");
  }

  return line;
}
