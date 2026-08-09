/**
 * Service types `[10 §12]`, `[16 §4]`.
 *
 * `08 B4` names the four services — CNC, cutting, bending, notching — and
 * `10 §12` accepted a lookup table for them precisely because the list will
 * change: adding a fifth service must be a seed edit, not a migration.
 *
 * The Arabic came from the founder `[16 §4]`, which is why these four are
 * seeded while `product_suppliers` and `product_colours` in `./products.ts`
 * stay empty. The difference is not effort: nobody has said which factory the
 * code `N` is, so a supplier name would be invented product data. A translation
 * of "Cutting" that the founder supplied is not.
 *
 * All services are priced **per square metre** `[12 §10]`, so there is no unit
 * on these rows — the application writes `unit = 'sqm'` on every service line,
 * the same way it writes `form_factor = 'sheet'` `[13 §2]`.
 */

export const SERVICE_TYPE_SEED = [
  { nameEn: "CNC", nameAr: "سي ان سي" },
  { nameEn: "Cutting", nameAr: "القص" },
  { nameEn: "Bending", nameAr: "الثني" },
  { nameEn: "Notching", nameAr: "التفريز" },
] as const;
