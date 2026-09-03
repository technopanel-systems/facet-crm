import { getLocale, getTranslations } from "next-intl/server";

import { getDirection, type Locale } from "@/i18n/routing";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * The 404 for a URL nothing claimed — the root `not-found.tsx`, which Next
 * renders for every unmatched URL `D53`, session 55. It renders inside the
 * root layout, so it is in the reader's language, direction and theme, and
 * outside the `(app)` shell, because the person may not be signed in: an
 * anonymous visitor mistyping a link gets this page and not a redirect that
 * would tell them which routes exist.
 *
 * It says nothing about why, for the reason `(app)/not-found.tsx` gives: a
 * hidden record and a missing one must look identical `[04 Q7]`. One way out,
 * named as the rail names it — *Today* — which is the sign-in screen for
 * somebody who is not signed in.
 */
export default async function LocaleNotFound() {
  const t = await getTranslations();
  const locale = await getLocale();

  // The direction is stated here as well as on `<html>`, so the words read
  // the right way round whichever document holds them.
  return (
    <main
      lang={locale}
      dir={getDirection(locale as Locale)}
      className="mx-auto flex min-h-svh max-w-2xl flex-col items-start justify-center gap-4 px-6 py-8"
    >
      <div data-slot="not-found" className="flex flex-col items-start gap-4">
        <h1 className="text-start text-xl font-semibold tracking-tight">
          {t("errors.notFound.title")}
        </h1>
        <p className="text-muted-foreground text-start text-sm">
          {t("errors.notFound.body")}
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/">{t("errors.notFound.home")}</Link>
        </Button>
      </div>
    </main>
  );
}
