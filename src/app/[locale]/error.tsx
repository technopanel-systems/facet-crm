"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * The failure boundary for anything under a locale that is not inside the
 * `(app)` shell — the sign-in screen, the 404, the catch-all. Same words,
 * same two controls as `(app)/error.tsx` (`WORKFLOW §4` row 45); the locale
 * layout above it survives, so the language and the theme do too. The
 * reasons for what it says and what it withholds are in that file.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col items-start justify-center gap-4 px-6 py-8">
      <div data-slot="failed" data-digest={error.digest ?? undefined} className="flex flex-col items-start gap-4">
        <h1 className="text-start text-xl font-semibold tracking-tight">
          {t("errors.failed.title")}
        </h1>
        <p className="text-muted-foreground text-start text-sm">
          {t("errors.failed.body")}
        </p>
        {error.digest ? (
          <p className="text-muted-foreground text-start text-sm">
            {t("errors.failed.quote")}{" "}
            <span className="num" dir="ltr">
              {error.digest}
            </span>
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={reset}>
            {t("errors.failed.retry")}
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/">{t("errors.notFound.home")}</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
