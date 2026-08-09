/**
 * Company categories — the nine values named by the founder in `12 §4`,
 * closing `07 F5`. `Other` is the fallback where none of the others fits.
 *
 * The list is data, not an enum, because `09 §3.6` records it as "accepted
 * for now and revised later". Adding a category is a row, never a migration.
 *
 * Arabic names are translations of the founder's English list, not new
 * categories — the list itself is exactly the nine in `12 §4`, in that order.
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
  { nameEn: "Other", nameAr: "أخرى" },
] as const;
