import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { can, requireSession } from "@/lib/authz";
import {
  achievementForPeriod,
  companyAchievementForPeriod,
  currentPeriod,
  periodStart,
} from "@/lib/targets";

import { ListCard } from "../_components/list-controls";

import { AttainmentTable } from "./attainment-table";
import { CompanyTarget } from "./company-target";

export const dynamic = "force-dynamic";

/** `YYYY-MM-01` → `YYYY-MM`, which is what `<input type="month">` wants. */
function asMonth(period: string): string {
  return period.slice(0, 7);
}

/**
 * Targets `D49` — **one item on the rail, one table, one row per rep, the goal
 * and the attainment together.**
 *
 * **This screen absorbed `/performance` in session `28b`**, which was three
 * screens stacked under one title. `D49` had already ruled the two one item;
 * the rail carried both until the merge because moving the item first would
 * have hidden attainment from everyone who could reach it. Of the three blocks
 * that were there, **one is this table**, one moved and one was deleted:
 *
 *  - **Coverage was deleted.** `S88` says it outright — *there is no separate
 *    coverage screen* — and `D49` puts it with Reports and Follow-ups as the
 *    waiting list, filtered. `/companies` already lists every company with its
 *    silence meter, grouped quiet-first `D25`, and gained the Log action per
 *    row in the same slice; `/follow-ups` already lists the overdue half with
 *    the reps on each.
 *  - **`S123`'s two figures moved to `/users/[id]`.** They are facts about one
 *    person, and their clock is the ACT rather than the dispatch date this
 *    table is bounded by. Beside attainment they needed a paragraph to say so,
 *    and a caveat that three figures cannot be combined is a design failing
 *    rather than a disclaimer. On one person's own page there is no row to
 *    share and no second clock to disagree with.
 *
 * **Scoped, never gated** `S83`: a rep reads their own row, `sees_all_reps`
 * reads everyone's, and no permission flag guards the screen. Only the
 * set-target control is gated, by `canSetTargets` `S84`.
 *
 * **`S136`'s company target sits above the table**, on the same two conditions
 * the dashboard applies: `sees_all_reps` to read a company-scope figure at all
 * `D37` `D38`, and `can_set_company_target` — deliberately narrower than
 * `canSetTargets` — to set one. It renders when a figure exists **or** the viewer
 * may set the first one; otherwise it is absent rather than an empty shell `D53`.
 */
export default async function TargetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { period: requested } = await searchParams;

  const session = await requireSession();
  const t = await getTranslations();

  const period = /^\d{4}-\d{2}/.test(requested ?? "")
    ? periodStart(requested as string)
    : currentPeriod();

  const rows = await achievementForPeriod(session, period);
  const maySetTargets = can(session, "canSetTargets");

  // Null for anybody without `sees_all_reps`, so the block below costs one query
  // for a manager and none for a rep — the gated-before-it-fetches shape the
  // dashboard already uses for its own flag blocks.
  const company = await companyAchievementForPeriod(session, period);
  const maySetCompanyTarget = can(session, "canSetCompanyTarget");
  const showCompany =
    company !== null && (company.targetSqm !== null || maySetCompanyTarget);

  return (
    <div data-slot="attainment" className="flex flex-col gap-6">
      <PageHeader
        title={t("targets.title")}
        description={t("targets.detail.derivedNotice")}
      />

      <form method="get" className="flex flex-wrap items-end gap-2">
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

      {showCompany && company ? (
        <CompanyTarget
          attainment={company}
          period={period}
          maySet={maySetCompanyTarget}
        />
      ) : null}

      {/* No pager: `achievementForPeriod` returns the whole measured set for
          the month, so the footer is a count and nothing else. */}
      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {t("targets.empty")}
        </p>
      ) : (
        // A month's measured set is never paged, so the footer is the count.
        <ListCard basePath="/targets" page={1} total={rows.length}>
          <AttainmentTable
            rows={rows}
            period={period}
            maySetTargets={maySetTargets}
          />
        </ListCard>
      )}

      {/* `07 D2` — target progress and activity side by side, NEVER combined
          into one score. Since Phase 9 activity is real and derived `[20 §8]`,
          so this is a link rather than an apology — and it stays a link,
          because folding a number in here is the thing `07 D2` forbids. */}
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-muted-foreground text-start text-sm">
          {t("targets.detail.activityElsewhere")}
        </p>
        <Button asChild size="xs" variant="outline">
          <Link href="/activity">{t("targets.detail.viewActivity")}</Link>
        </Button>
      </div>
    </div>
  );
}
