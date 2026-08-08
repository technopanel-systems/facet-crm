"use client";

import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

/**
 * Switches locale while staying on the current page. Uses the locale-aware
 * Link from @/i18n/navigation so the prefix is rewritten, not appended.
 */
export function LocaleSwitcher() {
  const active = useLocale();
  const pathname = usePathname();
  const t = useTranslations("locale");

  return (
    <nav aria-label={t("label")} className="flex items-center gap-1">
      <Languages className="text-muted-foreground me-1 size-4" aria-hidden />
      {routing.locales.map((locale: Locale) => (
        <Button
          key={locale}
          asChild
          size="sm"
          variant={locale === active ? "secondary" : "ghost"}
          aria-current={locale === active ? "true" : undefined}
        >
          <Link href={pathname} locale={locale}>
            {t(locale)}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
