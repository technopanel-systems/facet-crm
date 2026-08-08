import { defineRouting } from "next-intl/routing";

/**
 * English is the primary language; Arabic is available for staff who find
 * English hard (docs/07-phase4-answers.md E3).
 *
 * `localePrefix: "always"` means every URL states its locale — /en/... and
 * /ar/... — so there is no implicit redirect behaviour to reason about.
 */
export const routing = defineRouting({
  locales: ["en", "ar"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

/** Text direction for a locale. Arabic is the only RTL locale so far. */
export function getDirection(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}
