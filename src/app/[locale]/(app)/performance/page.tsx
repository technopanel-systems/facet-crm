import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { can, requireSession } from "@/lib/authz";
import { coverage } from "@/lib/coverage";
import { achievementForPeriod, currentPeriod, periodStart } from "@/lib/targets";

import { AttainmentTable } from "../_components/attainment-table";
import { CoverageTable } from "../_components/coverage-table";
import { ListPagination, SearchForm } from "../_components/list-controls";

export const dynamic = "force-dynamic";

/** `YYYY-MM-01` → `YYYY-MM`, which is what `<input type="month">` wants. */
function asMonth(period: string): string {
  return period.slice(0, 7);
}

/**
 * Performance `[22 §7]` — where targets and coverage merged when the rail
 * dropped to six items.
 *
 * **It is a composition, not a new capability.** `achievementForPeriod` and
 * `coverage` are called exactly as `/targets` and `/coverage` call them, and
 * both of those screens still exist and still work; they simply left the rail.
 * The tables are the same components both use, so the three can never drift.
 *
 * **Scoped, never gated** `[20 §7]`: a rep sees their own row and their own
 * companies, `sees_all_reps` sees everyone's, and no permission flag guards the
 * screen. Only the set-target control is gated, by `canSetTargets`.
 *
 * `07 D2` — target progress and activity sit side by side and are **never**
 * combined into one score, which is why activity is a link out rather than a
 * number folded in. Reports is a link for the reason `22 §6.3` records: neither
 * screen yet answers "everything I logged", so both stay reachable.
 */
export default async function PerformancePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    period?: string;
    q?: string;
    page?: string;
    rep?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { period: requested, q, page, rep } = await searchParams;

  const session = await requireSession();
  const t = await getTranslations();

  const period = /^\d{4}-\d{2}/.test(requested ?? "")
    ? periodStart(requested as string)
    : currentPeriod();
  const currentPage = Number(page) || 1;

  const [attainment, cover] = await Promise.all([
    achievementForPeriod(session, period),
    coverage(session, { q, page: currentPage, userId: rep }),
  ]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8">
      <PageHeader
        title={t("performance.title")}
        description={t("performance.detail.hint")}
      />

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-start text-base font-semibold tracking-tight">
            {t("performance.detail.targets")}
          </h2>
          <form method="get" className="flex flex-wrap items-end gap-2">
            {q ? <input type="hidden" name="q" value={q} /> : null}
            {rep ? <input type="hidden" name="rep" value={rep} /> : null}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="period" className="text-start text-sm font-medium">
                {t("targets.fields.period")}
              </label>
              <Input
                id="period"
                name="period"
                type="month"
                defaultValue={asMonth(period)}
                dir="ltr"
                className="w-44 text-start"
              />
            </div>
            <Button type="submit" variant="outline">
              {t("common.apply")}
            </Button>
          </form>
        </div>

        <p className="text-muted-foreground text-start text-sm">
          {t("targets.detail.derivedNotice")}
        </p>

        <AttainmentTable
          rows={attainment}
          period={period}
          maySetTargets={can(session, "canSetTargets")}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-start text-base font-semibold tracking-tight">
          {t("performance.detail.coverage")}
        </h2>

        <p className="text-muted-foreground text-start text-sm">
          {t("coverage.detail.thresholds", {
            qualified: cover.thresholds.qualified,
            unqualified: cover.thresholds.unqualified,
          })}{" "}
          {t("coverage.detail.yours")}
        </p>

        <SearchForm
          basePath="/performance"
          defaultValue={q}
          placeholder={t("coverage.searchPlaceholder")}
        />

        <CoverageTable
          rows={cover.rows}
          locale={locale}
          empty={q ? t("coverage.emptyFiltered") : t("coverage.empty")}
        />

        <ListPagination
          basePath="/performance"
          page={currentPage}
          total={cover.total}
          query={q}
        />
      </section>

      {/* `07 D2` — side by side, never one score. Reports stays reachable here
          because a company detail page is the wrong place to ask "what did I
          log this week" `[22 §6.3]`. */}
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-muted-foreground text-start text-sm">
          {t("targets.detail.activityElsewhere")}
        </p>
        <Button asChild size="xs" variant="outline">
          <Link href="/activity">{t("targets.detail.viewActivity")}</Link>
        </Button>
        <Button asChild size="xs" variant="outline">
          <Link href="/reports">{t("performance.detail.viewReports")}</Link>
        </Button>
      </div>
    </main>
  );
}
