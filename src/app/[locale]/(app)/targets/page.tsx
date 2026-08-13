import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { can, requireSession } from "@/lib/authz";
import { achievementForPeriod, currentPeriod, periodStart } from "@/lib/targets";

import { AttainmentTable } from "../_components/attainment-table";
import { ListCard } from "../_components/list-controls";

export const dynamic = "force-dynamic";

/** `YYYY-MM-01` → `YYYY-MM`, which is what `<input type="month">` wants. */
function asMonth(period: string): string {
  return period.slice(0, 7);
}

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

  return (
    <div className="flex flex-col gap-6">
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
