import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { can, requireSession } from "@/lib/authz";
import { achievementForPeriod, currentPeriod, periodStart } from "@/lib/targets";

import { setTargetAction } from "./actions";
import { TargetRow } from "./target-row";

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
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
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
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">
                  {t("targets.fields.person")}
                </TableHead>
                <TableHead className="text-start">
                  {t("targets.fields.targetSqm")}
                </TableHead>
                <TableHead className="text-start">
                  {t("targets.fields.achievedSqm")}
                </TableHead>
                <TableHead className="text-start">
                  {t("targets.fields.ofWhich")}
                </TableHead>
                <TableHead className="text-start">
                  {t("targets.fields.progress")}
                </TableHead>
                {maySetTargets ? (
                  <TableHead className="text-start">
                    {t("common.actions")}
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.userId}>
                  <TableCell className="text-start font-medium">
                    {row.userName}
                  </TableCell>
                  {/* Null is NOT zero `[07 D1]`: someone with no row is not
                      measured this month, which a `0` would misreport. */}
                  <TableCell className="text-start" dir="ltr">
                    {row.targetSqm ?? (
                      <span className="text-muted-foreground" dir="auto">
                        {t("targets.fields.notMeasured")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-start" dir="ltr">
                    <Link
                      href={`/dispatches?userId=${row.userId}`}
                      className="hover:underline"
                    >
                      {row.achievedSqm}
                    </Link>
                  </TableCell>
                  {/* `07 C6` — the direct route, countable. */}
                  <TableCell className="text-start text-xs" dir="ltr">
                    {t("targets.fields.linkedShort")} {row.linkedSqm}
                    {" · "}
                    {t("targets.fields.directShort")} {row.directSqm}
                  </TableCell>
                  <TableCell className="text-start" dir="ltr">
                    {row.targetSqm
                      ? `${Math.round(
                          (Number(row.achievedSqm) / Number(row.targetSqm)) * 100,
                        )}%`
                      : t("common.none")}
                  </TableCell>
                  {maySetTargets ? (
                    <TableCell className="text-start">
                      <TargetRow
                        action={setTargetAction.bind(null, row.userId)}
                        period={period}
                        currentSqm={row.targetSqm}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
    </main>
  );
}
