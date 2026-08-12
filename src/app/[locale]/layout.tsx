import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  IBM_Plex_Sans,
  IBM_Plex_Sans_Arabic,
  IBM_Plex_Mono,
} from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { DirectionProvider } from "@/components/direction-provider";
import { getDirection, routing } from "@/i18n/routing";
import { getTheme } from "@/lib/theme";

import "../globals.css";

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

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "app" });

  return { title: t("name"), description: t("tagline") };
}

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
