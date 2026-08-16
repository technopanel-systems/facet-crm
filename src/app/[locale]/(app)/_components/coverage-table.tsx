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

import { Turn, turnTone } from "./turn";

/**
 * The coverage table — every company this identity may read, with how long it
 * has been since anyone logged against it.
 *
 * Extracted so `/coverage` and `/performance` would always render the
 * identical table `[22 §7]` — `/coverage` is gone since feature slice 6
 * `[26 §2]`, but the extraction stays: `/performance` is now this table's
 * only caller, and the component boundary is still the right shape if a
 * second one ever needs it. It renders **only** the table: the empty state
 * and the `ListCard` frame belong to the caller, because an empty state
 * inside a card with a pagination footer reads as a broken page rather than
 * an empty one.
 *
 * **`quietOnly` is not offered here**, and the reason is `22 §6.5`: `coverage()`
 * filters it after paginating, so a caller asking for quiet companies gets the
 * quiet ones among the alphabetically first 25 rather than the first 25 quiet
 * ones. The filter moved to `/performance` along with the rest of `/coverage`'s
 * capability `[26 §2]`; the defect moved with it, unfixed — nothing new is
 * built on top of it until it is fixed in the data layer.
 */
export async function CoverageTable({
  rows,
  locale,
}: {
  rows: CoverageRow[];
  locale: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-start">
            {t("coverage.fields.company")}
          </TableHead>
          <TableHead className="text-start">
            {t("coverage.fields.reps")}
          </TableHead>
          <TableHead numeric>
            {t("coverage.fields.lastInteraction")}
          </TableHead>
          {/* `22 §4`'s own worked example lives here: "Nothing recorded for
              23 days" beats "Lead". `daysSince` and `isQuiet` are both
              already on the row, so the column is a rendering of what
              `coverage()` decided, not a second opinion about it. */}
          <TableHead className="text-start">
            {t("common.whoseMove")}
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
            <TableCell numeric dir="ltr">
              {row.lastInteractionOn
                ? format.dateTime(
                    new Date(`${row.lastInteractionOn}T00:00:00Z`),
                    { dateStyle: "medium", timeZone: "UTC" },
                  )
                : t("coverage.fields.never")}
            </TableCell>
            <TableCell className="text-start">
              <Turn
                line={
                  row.onHoldUntil
                    ? t("coverage.detail.onHoldUntil", {
                        date: row.onHoldUntil,
                      })
                    : // Never logged is not zero days.
                      row.daysSince === null
                      ? t("coverage.fields.neverLogged")
                      : row.isQuiet
                        ? t("coverage.fields.quietFor", {
                            count: row.daysSince,
                          })
                        : t("coverage.fields.coveredFor", {
                            count: row.daysSince,
                          })
                }
                // On hold is not late: `20 §5` says the clock is deliberately
                // suppressed, so the row is calm however long it has been.
                tone={turnTone({
                  overdue: row.isQuiet && !row.onHoldUntil,
                })}
              />
            </TableCell>
            <TableCell className="text-start">
              {row.isQualified ? t("common.yes") : t("common.no")}
            </TableCell>
            <TableCell className="text-start">
              {/* The date is in the turn cell; the pill is only the state. */}
              {row.onHoldUntil ? (
                <Badge variant="outline">{t("coverage.fields.onHold")}</Badge>
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
  );
}
