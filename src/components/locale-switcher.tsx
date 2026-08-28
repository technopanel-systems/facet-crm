"use client";

import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

/**
 * Switches locale while staying on the current page. Uses the locale-aware
 * Link from @/i18n/navigation so the prefix is rewritten, not appended.
 *
 * **One control, naming the locale it switches TO** — `ThemeToggle`'s shape,
 * which sits three elements along in the same header row and has always been
 * written this way: *"The label names the theme being switched to, which is
 * what a screen reader user needs to hear before pressing it."* The same
 * sentence is true of a language.
 *
 * **Why it changed, `38c`.** It was two buttons and a `Languages` icon — 154px
 * of a 323px header at 375 — and the row wrapped to two lines in both locales,
 * sticky, on every screen in the product. `D74` then made it worse rather than
 * better: the bell and the theme toggle are controls a thumb has to hit and
 * were 32px, so bringing them to 44 pushed the row to ~348px. Something had to
 * leave, and with exactly two locales a toggle loses nothing a toggle can lose:
 * the pressed state said *which language you are reading*, and the page itself
 * says that in every word on it.
 *
 * `aria-current` goes with the second button. The `aria-label` carries the
 * destination in the **target** language, which is the one a reader who wants
 * it will recognise.
 */
export function LocaleSwitcher() {
  const active = useLocale();
  const t = useTranslations("locale");
  const pathname = usePathname();

  // Two locales, so "the other one" is total. `routing.locales` stays the
  // source rather than a literal pair — if a third is ever added this breaks
  // loudly here instead of quietly rendering the wrong one.
  const next = routing.locales.find(
    (locale: Locale) => locale !== active,
  ) as Locale;

  return (
    <Button
      asChild
      size="sm"
      variant="ghost"
      aria-label={t("switchTo", { language: t(next) })}
      title={t("switchTo", { language: t(next) })}
    >
      {/* The label is the language's own endonym `D62` — *العربية* on an
          English page, *English* on an Arabic one — so it carries its own
          direction and needs no `dir` from the row around it. */}
      <Link href={pathname} locale={next} lang={next}>
        {t(next)}
      </Link>
    </Button>
  );
}
