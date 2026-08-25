import { getTranslations } from "next-intl/server";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import {
  formatSqm,
  formatWholeSqm,
  percentOf,
  roundSqm,
  SQM_SCALE,
} from "@/lib/decimal";
import type { AchievementRow } from "@/lib/targets";

import { setTargetAction } from "../targets/actions";
import { TargetRow } from "../targets/target-row";

/**
 * Target attainment for a period — one row per measured rep.
 *
 * Extracted so `/targets` and `/performance` render the identical table
 * `[22 §7]`. Two screens hand-rolling the same columns is how the achieved
 * figure and the percentage beside it end up disagreeing.
 *
 * It renders rows it is given and asks nothing itself: scoping already happened
 * in `achievementForPeriod`, via `visibleMeasuredUsersFilter`.
 */
export async function AttainmentTable({
  rows,
  period,
  maySetTargets,
}: {
  rows: AchievementRow[];
  period: string;
  maySetTargets: boolean;
}) {
  const t = await getTranslations();

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
        {t("targets.empty")}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-start">
            {t("targets.fields.person")}
          </TableHead>
          <TableHead numeric>{t("targets.fields.targetSqm")}</TableHead>
          <TableHead numeric>{t("targets.fields.achievedSqm")}</TableHead>
          <TableHead numeric>{t("targets.fields.ofWhich")}</TableHead>
          <TableHead numeric>{t("targets.fields.progress")}</TableHead>
          {maySetTargets ? (
            <TableHead className="text-start">{t("common.actions")}</TableHead>
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
                measured this month, which a `0` would misreport.

                Every figure in this table is a SUM or a TARGET, so every one
                of them rounds to whole square metres `D32`. A quotation or
                dispatch LINE does not — that is a document line, and it
                reconciles against what SMAC issued `S5`. */}
            <TableCell numeric dir="ltr">
              {row.targetSqm ? (
                formatSqm(row.targetSqm)
              ) : (
                <span className="text-muted-foreground font-sans" dir="auto">
                  {t("targets.fields.notMeasured")}
                </span>
              )}
            </TableCell>
            <TableCell numeric dir="ltr">
              <Link
                href={`/dispatches?userId=${row.userId}`}
                className="hover:underline"
              >
                {formatSqm(row.achievedSqm)}
              </Link>
            </TableCell>
            {/* `07 C6` — the direct route, countable.

                **Direct is derived from the other two, not rounded on its
                own.** `linked + direct` is exactly `achieved` in the data;
                rounding all three independently can gain or lose a metre, and
                a breakdown that does not add up to the figure two columns to
                its left is a defect nobody would think to look for. */}
            <TableCell numeric className="text-xs" dir="ltr">
              {t("targets.fields.linkedShort")} {formatSqm(row.linkedSqm)}
              {" · "}
              {t("targets.fields.directShort")}{" "}
              {formatWholeSqm(roundSqm(row.achievedSqm) - roundSqm(row.linkedSqm))}
            </TableCell>
            {/* `percentOf`, not `Number(a) / Number(b)`: the dashboard panel
                shows this same percentage `D32`, and two derivations of it is
                how a figure and the percentage beside it start disagreeing. */}
            <TableCell numeric dir="ltr">
              {row.targetSqm
                ? `${percentOf(row.achievedSqm, row.targetSqm, SQM_SCALE)}%`
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
  );
}
