import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Inter, Noto_Sans_Arabic, JetBrains_Mono } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { DirectionProvider } from "@/components/direction-provider";
import { getDirection, routing } from "@/i18n/routing";

import "../globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-latin",
  display: "swap",
});

const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
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

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${inter.variable} ${notoArabic.variable} ${mono.variable}`}
      style={{
        // Arabic renders in Noto Sans Arabic, everything else in Inter.
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
