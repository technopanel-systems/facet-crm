import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { can, requireSession } from "@/lib/authz";
import { coverage, coverageRepOptions } from "@/lib/coverage";
import { requestOriginForPeriod } from "@/lib/dispatches";
import {
  achievementForPeriod,
  currentPeriod,
  nextPeriodStart,
  periodStart,
} from "@/lib/targets";

import { AttainmentTable } from "../_components/attainment-table";
import { CoverageTable } from "../_components/coverage-table";
import { FilterNav, ListCard, SearchForm } from "../_components/list-controls";
import { RequestOriginTable } from "../_components/request-origin-table";

export const dynamic = "force-dynamic";

/** `YYYY-MM-01` → `YYYY-MM`, which is what `<input type="month">` wants. */
function asMonth(period: string): string {
  return period.slice(0, 7);
}

/**
 * Performance `[22 §7]` — where targets and coverage merged when the rail
 * dropped to six items.
 *
 * **It was a composition, then became the only owner.** `achievementForPeriod`
 * and `coverage` were first called here exactly as `/targets` and the
 * standalone `/coverage` screen called them, so the tables could never drift.
 * Feature slice 6 deleted `/coverage` as a route — it was orphaned from the
 * rail — but moved its quiet-only and per-rep filtering here first, onto the
 * same `coverage()` call and the same `CoverageTable` `[26 §2]`: `20 §7`
 * requires the capability, not the separate screen.
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
    quiet?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { period: requested, q, page, rep, quiet } = await searchParams;

  const session = await requireSession();
  const t = await getTranslations();

  const period = /^\d{4}-\d{2}/.test(requested ?? "")
    ? periodStart(requested as string)
    : currentPeriod();
  const currentPage = Number(page) || 1;
  const quietOnly = quiet === "1";

  const [attainment, origin, cover, repOptions] = await Promise.all([
    achievementForPeriod(session, period),
    // `S123` — the same month, bounded by the ACT rather than by the dispatch
    // date the two tables around it use. The section says so; see the note.
    requestOriginForPeriod(session, period, nextPeriodStart(period)),
    coverage(session, { q, page: currentPage, userId: rep, quietOnly }),
    coverageRepOptions(session),
  ]);

  return (
    <div className="flex flex-col gap-8">
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

        {attainment.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
            {t("targets.empty")}
          </p>
        ) : (
          // No pager: `achievementForPeriod` returns the whole measured set
          // for the month, so the footer is a count and nothing else.
          <ListCard basePath="/performance" page={1} total={attainment.length}>
            <AttainmentTable
              rows={attainment}
              period={period}
              maySetTargets={can(session, "canSetTargets")}
            />
          </ListCard>
        )}
      </section>

      {/* `S123` — **who created a record is a measure.** Third section rather
          than a fourth screen: it is a measure, and `/performance` is where
          measures live and where `visibleMeasuredUsersFilter` already decides
          whose. No permission gate — *a number to look at, never an
          enforcement* — so a rep reads their own row here as they read their
          own attainment above. */}
      <section data-slot="request-origin" className="flex flex-col gap-4">
        <h2 className="text-start text-base font-semibold tracking-tight">
          {t("performance.origin.title")}
        </h2>

        {/* Three sentences, and each one closes a way of misreading the table.
            The first because the attainment table above is dispatch-dated and
            this one counts acts — two clocks on one screen with nothing saying
            so is how somebody reads the wrong number. The second because the
            third column is not a share of the first. The third because three
            numbers in a row invite subtraction, and no fourth number here is
            true. */}
        <p className="text-muted-foreground text-start text-sm">
          {t("performance.origin.noteActs")}{" "}
          {t("performance.origin.noteWindow")}{" "}
          {t("performance.origin.noteNoArithmetic")}
        </p>

        {origin.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
            {t("performance.origin.empty")}
          </p>
        ) : (
          // No pager, for `AttainmentTable`'s reason: `requestOriginForPeriod`
          // returns the whole measured set, so the footer is a count.
          <ListCard basePath="/performance" page={1} total={origin.length}>
            <RequestOriginTable rows={origin} />
          </ListCard>
        )}
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
          hidden={{ period: asMonth(period), rep, quiet }}
        />

        <FilterNav
          basePath="/performance"
          name="quiet"
          active={quietOnly ? "1" : undefined}
          query={q}
          extra={{ period: asMonth(period), rep }}
          options={[
            { label: t("coverage.fields.filterAll") },
            { value: "1", label: t("coverage.fields.filterQuiet") },
          ]}
        />

        {/* Offered only when there is more than one person to choose between:
            a rep gets only their own name, which makes the control pointless. */}
        {repOptions.length > 1 ? (
          <FilterNav
            basePath="/performance"
            name="rep"
            active={rep}
            query={q}
            extra={{ period: asMonth(period), quiet }}
            options={[
              { label: t("coverage.fields.allReps") },
              ...repOptions.map((option) => ({
                value: option.id,
                label: option.name,
              })),
            ]}
          />
        ) : null}

        {cover.rows.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
            {q || rep || quietOnly
              ? t("coverage.emptyFiltered")
              : t("coverage.empty")}
          </p>
        ) : (
          <ListCard
            basePath="/performance"
            page={currentPage}
            total={cover.total}
            query={q}
            extra={{ period: asMonth(period), rep, quiet }}
          >
            <CoverageTable rows={cover.rows} />
          </ListCard>
        )}
      </section>

      {/* `07 D2` — side by side, never one score. Reports stays reachable here
          because a company detail page is the wrong place to ask "what did I
          log this week" `[22 §6.3]`. */}
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-muted-foreground text-start text-sm">
          {t("targets.detail.activityElsewhere")}
        </p>
        {/* One link, since session 27: `/reports` and `/activity` were two
            screens answering one question and `D45` made them one. */}
        <Button asChild size="xs" variant="outline">
          <Link href="/activity">{t("targets.detail.viewActivity")}</Link>
        </Button>
      </div>
    </div>
  );
}
