"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * What a person sees when a screen breaks — `WORKFLOW §4` row 45, session
 * 55; `D52`'s instinct applied to a failure: say what happened, say what to
 * do, offer the act.
 *
 * Next replaces the failed subtree with this boundary and keeps the shell —
 * the rail stays, so the person is not stranded. Three sentences and two
 * controls: nothing they typed was saved (a server action that threw wrote
 * nothing — `withAudit` is one transaction `S112`); try again, which
 * re-renders the same screen; and if it happens twice, tell the manager and
 * quote the code. **The code is Next's own digest**, the one handle that
 * pairs what the person saw with what the server logged, so the report can
 * be *"it said 3f9a"* rather than *"it broke"*. Where a person's *"this is
 * wrong"* should go beyond that sentence — a box, a queue, a bell — is
 * undecided and recorded (`SPEC §16`), not invented here.
 *
 * The message never carries the error's text: a stack or a query in a
 * screen a rep photographs and forwards is the leak `[04 Q7]` warns about.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();

  return (
    <div
      data-slot="failed"
      data-digest={error.digest ?? undefined}
      className="flex max-w-2xl flex-col items-start gap-4 py-8"
    >
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
  );
}
