/**
 * Company categories — the nine values named by the founder in `12 §4`,
 * closing `07 F5`, plus `Personal` as a tenth `[25 §33]`: for people buying
 * for a house or a private project. `Other` is the fallback where none of the
 * others fits, so `Personal` goes before it and `Other` stays last.
 *
 * The list is data, not an enum, because `09 §3.6` records it as "accepted
 * for now and revised later". Adding a category is a row, never a migration —
 * which is exactly what `25 §33` turned out to be.
 *
 * Arabic names are translations of the founder's English list, not new
 * categories — the list itself is exactly the nine in `12 §4` plus `25 §33`'s
 * tenth, in that order.
 */

export const COMPANY_CATEGORY_SEED = [
  { nameEn: "Factory", nameAr: "مصنع" },
  { nameEn: "Contractor", nameAr: "مقاول" },
  { nameEn: "Advertising", nameAr: "دعاية وإعلان" },
  { nameEn: "Real Estate", nameAr: "عقارات" },
  { nameEn: "Owner", nameAr: "مالك" },
  { nameEn: "Consultant", nameAr: "استشاري" },
  { nameEn: "Station Management", nameAr: "إدارة محطات" },
  { nameEn: "Workshop", nameAr: "ورشة" },
  /** `[25 §33]` — a house or a private project, not a business. */
  { nameEn: "Personal", nameAr: "شخصي" },
  { nameEn: "Other", nameAr: "أخرى" },
] as const;
