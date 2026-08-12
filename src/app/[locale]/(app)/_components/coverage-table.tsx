import { getFormatter, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import type { CoverageRow } from "@/lib/coverage";
import { bilingualName } from "@/lib/lookups";

/**
 * The coverage table — every company this identity may read, with how long it
 * has been since anyone logged against it.
 *
 * Extracted so `/coverage` and `/performance` render the identical table
 * `[22 §7]`.
 *
 * **`quietOnly` is not offered here**, and the reason is `22 §6.5`: `coverage()`
 * filters it after paginating, so a caller asking for quiet companies gets the
 * quiet ones among the alphabetically first 25 rather than the first 25 quiet
 * ones. The filter still exists on `/coverage`, where it always has; nothing new
 * is built on top of it until it is fixed in the data layer.
 */
export async function CoverageTable({
  rows,
  locale,
  empty,
}: {
  rows: CoverageRow[];
  locale: string;
  empty: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
        {empty}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-start">
              {t("coverage.fields.company")}
            </TableHead>
            <TableHead className="text-start">
              {t("coverage.fields.reps")}
            </TableHead>
            <TableHead className="text-start">
              {t("coverage.fields.lastInteraction")}
            </TableHead>
            <TableHead className="text-start">
              {t("coverage.fields.daysSince")}
            </TableHead>
            <TableHead className="text-start">{t("common.qualified")}</TableHead>
            <TableHead className="text-start">
              {t("coverage.fields.status")}
            </TableHead>
            <TableHead className="text-start">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.companyId}>
              <TableCell className="text-start font-medium">
                <Link
                  href={`/companies/${row.companyId}`}
                  className="hover:underline"
                >
                  {bilingualName(
                    { nameEn: row.companyNameEn, nameAr: row.companyNameAr },
                    locale,
                  )}
                </Link>
              </TableCell>
              <TableCell className="text-start">
                {row.repNames.length > 0
                  ? row.repNames.join(", ")
                  : t("common.none")}
              </TableCell>
              <TableCell className="num text-start" dir="ltr">
                {row.lastInteractionOn
                  ? format.dateTime(
                      new Date(`${row.lastInteractionOn}T00:00:00Z`),
                      { dateStyle: "medium", timeZone: "UTC" },
                    )
                  : t("coverage.fields.never")}
              </TableCell>
              <TableCell className="num text-start" dir="ltr">
                {/* Never logged is not zero days. */}
                {row.daysSince ?? t("common.none")}
              </TableCell>
              <TableCell className="text-start">
                {row.isQualified ? t("common.yes") : t("common.no")}
              </TableCell>
              <TableCell className="text-start">
                {row.onHoldUntil ? (
                  <Badge variant="outline">
                    {t("coverage.detail.onHoldUntil", {
                      date: row.onHoldUntil,
                    })}
                  </Badge>
                ) : row.isQuiet ? (
                  <Badge variant="destructive">
                    {t("coverage.fields.quiet")}
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    {t("coverage.fields.covered")}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-start">
                <Button asChild size="xs" variant="outline">
                  <Link href={`/reports/new?companyId=${row.companyId}`}>
                    {t("reports.new")}
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
