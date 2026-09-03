import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * The locale segment — the guard and the request locale, nothing else.
 * The `<html>` shell, the fonts, the theme and the providers moved to the
 * root layout in session 55 (`src/app/layout.tsx` says why); a segment
 * layout that rendered `<html>` left every `notFound()` outside a root
 * layout and every 404 blank with scripts off.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Required for static rendering of this segment.
  setRequestLocale(locale);

  return children;
}
