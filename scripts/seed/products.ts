/**
 * Product attribute lookups `[08 D1]`, `[09 §5.6]`.
 *
 * Rule for this file: **only values a document states**. `08 B1` decomposes a
 * real product code (`N- CA FR 168`) and lists the classes, the fire ratings
 * and the thicknesses outright, so those three seed with their real values.
 * The other two do not, and are therefore seeded empty:
 *
 *  - **Suppliers.** The seven codes are known — N, K, D, C, G, G1, Y — but no
 *    document says which factory each one is, and `product_suppliers`
 *    requires a bilingual name. A placeholder name would be invented product
 *    data. Fill this array in when the factory names are confirmed; the code
 *    below needs no change.
 *  - **Colours.** `08 B1` says only "many", and no document lists them. Note
 *    that specials never belong here: a RAL or Pantone one-off goes in
 *    `quotation_lines.custom_colour` `[12 §12]`, which is exactly what keeps
 *    this list clean enough to pick from.
 *
 * `12 §8` also settles what is NOT here: no constraint ties a class to a fire
 * rating, because which combinations are real varies by factory. What exists
 * is defined by the `product_specifications` rows that get seeded — keyed on
 * supplier + class + fire rating + thickness `[12 §9]` — and those need the
 * supplier names too, so they are not seeded here either.
 */

/** Codes N, K, D, C, G, G1, Y `[08 B1]` — names not in any document. */
export const PRODUCT_SUPPLIER_SEED: readonly {
  code: string;
  nameEn: string;
  nameAr: string;
}[] = [];

/** `08 B1`. The code is the name — an invented longer form would be fiction. */
export const PRODUCT_CLASS_SEED = [
  { code: "A", nameEn: "A", nameAr: "A" },
  { code: "B", nameEn: "B", nameAr: "B" },
  { code: "A2G1", nameEn: "A2G1", nameAr: "A2G1" },
  { code: "A2G2", nameEn: "A2G2", nameAr: "A2G2" },
] as const;

/** `08 B1`. "Normal" is the only one of the three that is a word, so it is the
 *  only one with an Arabic form; `B1` and `A2` are standards designations. */
export const PRODUCT_FIRE_RATING_SEED = [
  { code: "B1", nameEn: "B1", nameAr: "B1" },
  { code: "A2", nameEn: "A2", nameAr: "A2" },
  { code: "Normal", nameEn: "Normal", nameAr: "عادي" },
] as const;

/** No document lists a colour code `[08 B1: "many"]`. */
export const PRODUCT_COLOUR_SEED: readonly {
  code: string;
  nameEn: string;
  nameAr: string;
}[] = [];

/** `08 B1` — 4, 5 or 6 mm; 4 mm is standard and is omitted from the printed
 *  product name, which is what `isStandard` drives `[08 D1]`. */
export const PRODUCT_THICKNESS_SEED = [
  { thicknessMm: "4.00", isStandard: true },
  { thicknessMm: "5.00", isStandard: false },
  { thicknessMm: "6.00", isStandard: false },
] as const;
