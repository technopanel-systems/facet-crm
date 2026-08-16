/**
 * Product attribute lookups `[08 D1]`, `[09 §5.6]`.
 *
 * Rule for this file: **only values a document states**. `08 B1` decomposes a
 * real product code (`N- CA FR 168`) and lists the classes and the fire
 * ratings outright; `17 §1` and `17 §3` give the suppliers and the thicknesses.
 *
 * **There is no colour list here at all** `[17 §2]`: the colour is typed, not
 * picked. `quotation_lines.custom_colour` carries every line — a plain code
 * like `168` as readily as a RAL or Pantone special. The lookup table this
 * once seeded (empty) was dropped in feature slice 6 `[26 §2]`.
 *
 * `12 §8` also settles what is NOT here: no constraint ties a class to a fire
 * rating, because which combinations are real varies by factory. What exists
 * is defined by the `product_specifications` rows that get seeded — keyed on
 * supplier + class + fire rating + thickness `[12 §9]` — and no document lists
 * those combinations, so they are not seeded here either.
 */

/**
 * `17 §1` — four codes. `08 B1`'s G, G1 and Y are dropped: *"we dont need them
 * anymore."* They were never seeded, so nothing is deleted and no line can
 * point at them.
 *
 * **The code is the name**, deliberately — the founder says no factory name is
 * needed, and this is the same treatment `08 B1` already forced on the classes:
 * an invented longer form would be fiction. The code is also the first token of
 * the generated product name, so it is what everyone recognises anyway.
 */
export const PRODUCT_SUPPLIER_SEED = [
  { code: "N", nameEn: "N", nameAr: "N" },
  { code: "K", nameEn: "K", nameAr: "K" },
  { code: "D", nameEn: "D", nameAr: "D" },
  { code: "C", nameEn: "C", nameAr: "C" },
] as const;

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

/**
 * `17 §3` — 2 to 8 mm. **4 mm is the default and the only `isStandard` row**,
 * which is the single flag that keeps the thickness out of the generated
 * product name; every other thickness appends it `[08 B1]`, `[08 D1]`.
 *
 * 2, 3, 7 and 8 mm are not quoted today — they are there so the list does not
 * have to be edited the first time a future product needs one.
 */
export const PRODUCT_THICKNESS_SEED = [
  { thicknessMm: "2.00", isStandard: false },
  { thicknessMm: "3.00", isStandard: false },
  { thicknessMm: "4.00", isStandard: true },
  { thicknessMm: "5.00", isStandard: false },
  { thicknessMm: "6.00", isStandard: false },
  { thicknessMm: "7.00", isStandard: false },
  { thicknessMm: "8.00", isStandard: false },
] as const;
