/**
 * How a product line reads, in one place `S53`.
 *
 * **No `"use client"` and no `@/lib/*` import.** A server page and a client
 * repeater both render a line, and this is the only way they can share one
 * answer: a data module would bundle the Postgres driver for the browser, and
 * a client module's exports are not callable from a server component.
 *
 * There was a `productDisplayName` in `src/lib/quotations.ts` until `S53`. It
 * rebuilt SMAC's own product code — `N- CA FR 168`, space after the hyphen and
 * all — and that string was the line's headline on every screen. `S53` says
 * FACET does not reproduce SMAC's code format, so the parts stay parts and the
 * screen sets them out as words.
 *
 * The locale pick is written out rather than imported from `lookups.ts` for
 * the reason above; it is the same rule `lookupName` applies, and
 * `line-fields.tsx`'s `optionLabel` already carries a second copy for the same
 * constraint.
 */

export type LineParts = {
  supplierNameEn: string;
  supplierNameAr: string;
  classNameEn: string;
  classNameAr: string;
  fireRatingNameEn: string;
  fireRatingNameAr: string;
  /** Already trimmed of trailing zeros by the data layer: `4`, not `4.00`. */
  thicknessMm: string;
  customColour: string | null;
};

function pick(en: string, ar: string, locale: string): string {
  return locale === "ar" ? ar || en : en;
}

/**
 * Supplier, class, fire rating, thickness, colour — as separate strings, in
 * the order a person describes a panel.
 *
 * Separate rather than pre-joined so each screen chooses its own separator and
 * emphasis: a row header spaces them, an `<option>` cannot. Returning one
 * joined token would be the old code by another name.
 *
 * The thickness carries its unit here because `4` alone is not a thickness. It
 * is no longer omitted when standard — that omission was SMAC's code rule, not
 * a fact about the panel, and a line that silently says nothing about its
 * thickness is worse to read than one that says `4 mm`.
 */
export function lineParts(line: LineParts, locale: string): string[] {
  const parts = [
    pick(line.supplierNameEn, line.supplierNameAr, locale),
    pick(line.classNameEn, line.classNameAr, locale),
    pick(line.fireRatingNameEn, line.fireRatingNameAr, locale),
    `${line.thicknessMm} mm`,
  ];
  // A colour is required `S54`, but the column is nullable and a line written
  // before that rule may hold none. An empty string in the middle of a row
  // reads as a bug, so it is dropped rather than rendered.
  if (line.customColour) parts.push(line.customColour);
  return parts;
}

/** The same parts where only one string will fit — an `<option>`, a link. */
export function lineLabel(line: LineParts, locale: string): string {
  return lineParts(line, locale).join(" · ");
}
