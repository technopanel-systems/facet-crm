import type { Metadata } from "next";
import {
  IBM_Plex_Sans,
  IBM_Plex_Sans_Arabic,
  IBM_Plex_Mono,
} from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { DirectionProvider } from "@/components/direction-provider";
import { getDirection, type Locale } from "@/i18n/routing";
import { getTheme } from "@/lib/theme";

import "./globals.css";

/**
 * **The root layout, at the root** — moved here from `[locale]/layout.tsx`
 * in session 55 (`WORKFLOW §4` row 45).
 *
 * While the `<html>` shell lived under the locale segment, every
 * `notFound()` in the product — the permission 404 `D53` included — was
 * answered with Next's own error shell (`<html id="__next_error__">`) and
 * the page streamed only in the script payload: a 404 was **blank with
 * scripts off**, against `D20`, since session 23, and `verify:routes` §6
 * read its class string out of the payload and stayed green. A not-found
 * boundary renders inside the nearest ROOT layout, and Next found none
 * above the locale segment. With the shell here, `not-found.tsx` beside it
 * answers a URL nothing claims, `(app)/not-found.tsx` answers a hidden
 * record, and both are server-rendered inside this document.
 *
 * The locale comes from `getLocale()` — the middleware's resolution of the
 * URL — never from `params`, which a root layout does not have. The locale
 * segment's own layout keeps the guard (`hasLocale`) and `setRequestLocale`.
 */

// IBM Plex throughout `[22 §2]`. All three are static families, so the weights
// are listed explicitly — there is no variable axis to fall back on.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-latin",
  display: "swap",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-mono-app",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "app" });
  return { title: t("name"), description: t("tagline") };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = (await getLocale()) as Locale;
  const dir = getDirection(locale);
  // `22 §5` — server-read, so the right palette is in the first byte of HTML.
  // `:root` IS this element, so `.dark`'s tokens win over the light ones by
  // specificity and every `--background: var(--canvas)` resolves dark.
  const theme = await getTheme();

  return (
    <html
      lang={locale}
      dir={dir}
      data-theme={theme}
      className={`${plexSans.variable} ${plexArabic.variable} ${plexMono.variable} ${
        theme === "dark" ? "dark" : ""
      }`}
      style={{
        // Arabic renders in IBM Plex Sans Arabic, everything else in Plex Sans.
        ["--font-app" as string]:
          locale === "ar" ? "var(--font-arabic)" : "var(--font-latin)",
      }}
      suppressHydrationWarning
    >
      <body className="min-h-svh antialiased">
        <NextIntlClientProvider>
          <DirectionProvider dir={dir}>{children}</DirectionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
