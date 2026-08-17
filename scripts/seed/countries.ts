/**
 * Countries `S14` — Saudi Arabia, the Gulf states, and the three `S14` names.
 *
 * `S14` says "Egypt, Jordan, Syria and others" without listing them, so this is
 * the founder's list rather than an invented one: **Saudi Arabia plus Egypt,
 * Jordan, Syria and the Gulf states.** Nine rows. Anywhere else a customer
 * turns up is a one-line addition here and a re-seed — never a migration,
 * which is the whole reason this is a lookup table and not an enum.
 *
 * `code` is ISO 3166-1 alpha-2 and is the identifier the application uses.
 * `SAUDI_CODE` in `src/lib/lookups.ts` is the one place it is read: `S15`
 * derives a region from a city only for a Saudi company, and that branch must
 * not hang off a display name somebody may edit.
 *
 * Names are the common English rendering and the common Arabic one — what a
 * rep would say, not the full protocol form. "Saudi Arabia", not "the Kingdom
 * of Saudi Arabia"; the select is read at a glance in a customer's lobby.
 *
 * Nothing here deletes. A country removed from this list stays in the database,
 * because companies point at it and FACET does not delete history `[12 §7]`.
 */

export const COUNTRY_SEED = [
  { code: "SA", nameEn: "Saudi Arabia", nameAr: "السعودية" },
  { code: "AE", nameEn: "United Arab Emirates", nameAr: "الإمارات" },
  { code: "BH", nameEn: "Bahrain", nameAr: "البحرين" },
  { code: "KW", nameEn: "Kuwait", nameAr: "الكويت" },
  { code: "OM", nameEn: "Oman", nameAr: "عُمان" },
  { code: "QA", nameEn: "Qatar", nameAr: "قطر" },
  { code: "EG", nameEn: "Egypt", nameAr: "مصر" },
  { code: "JO", nameEn: "Jordan", nameAr: "الأردن" },
  { code: "SY", nameEn: "Syria", nameAr: "سوريا" },
] as const;
