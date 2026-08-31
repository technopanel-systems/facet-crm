import { Fragment } from "react";
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

import { setTargetAction } from "./actions";
import { TargetRow } from "./target-row";

/**
 * `D49`'s table — **one row per rep, the goal and the attainment together.**
 *
 * They were never two questions, and splitting them put a rep's number on one
 * screen and what it was measured against on another. `/performance` and
 * `/targets` rendered this same component to stop the two drifting; session
 * `28b` merged the screens, so it moved out of `_components` and beside the one
 * page that calls it. There is nothing left for it to agree with.
 *
 * **Flat, and that is `D49` over `D24`.** `D24`'s List archetype is *grouped,
 * never flat*, with counts, and *one column says whose move it is*. A row here
 * is a **person**, who has no move, and `D25`'s groups are named for companies,
 * quotations and projects — never for people. `D49` is the rule written about
 * this screen and it says *one table*, naming no group. A measured /
 * not-measured split is the one honest candidate and no rule names it, so it is
 * `OPEN — not chosen` and recorded in `WORKFLOW §5` rather than invented here.
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

  // **No `phoneRows`, deliberately** `D55` — and `D49` is the second reason:
  // it asks this screen for the goal and the attainment TOGETHER, while
  // `D56`'s one kept column carries one of them. The rule does not fit a
  // laptop screen, which is why this table is excluded rather than bent. It
  // keeps `Table`'s horizontal scroller below `md`; declared rather than
  // inherited, with the row in `WORKFLOW §5`.
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
          {/* **No Actions column** `D58` `AD20`. The edit control is a
              disclosure in a row of its own beneath each person, so the table's
              cells hold values and nothing else. */}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <Fragment key={row.userId}>
            {/* The pair reads as one row: the values keep no bottom border
                when their own control row follows and draws it instead. */}
            <TableRow className={maySetTargets ? "border-b-0" : undefined}>
              <TableCell className="text-start font-medium">
                {/* **`dir="auto"` on the NAME** `D62`. A person's name may hold
                    either script and must read correctly on either page — this
                    cell was the one figure table without it while
                    `RequestOriginTable` beside it had it. */}
                <span dir="auto">{row.userName}</span>
              </TableCell>
              {/* Null is NOT zero `S83`: someone with no row is not measured
                  this month, which a `0` would misreport.

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
              <TableCell numeric className="text-xs">
                {/* Two translated words and two figures — a WORD run `D73`, so
                    `dir="auto"` on the run; forced LTR on the CELL read the
                    pairs backwards in Arabic (`A2-12`). */}
                <span dir="auto">
                  {t("targets.fields.linkedShort")} {formatSqm(row.linkedSqm)}
                  {" · "}
                  {t("targets.fields.directShort")}{" "}
                  {formatWholeSqm(
                    roundSqm(row.achievedSqm) - roundSqm(row.linkedSqm),
                  )}
                </span>
              </TableCell>
              {/* `percentOf`, not `Number(a) / Number(b)`: the dashboard panel
                  shows this same percentage `D32`, and two derivations of it is
                  how a figure and the percentage beside it start disagreeing. */}
              <TableCell numeric dir="ltr">
                {row.targetSqm
                  ? `${percentOf(row.achievedSqm, row.targetSqm, SQM_SCALE)}%`
                  : t("common.none")}
              </TableCell>
            </TableRow>
            {/* `D49`'s per-row edit control, out of the cell `D58`. Bound at
                THIS call site, one level above the component that calls
                `useActionState` — bound inside it, a form answers no raw POST
                at all (`WORKFLOW §5`). */}
            {maySetTargets ? (
              <TableRow data-slot="target-edit-row">
                <TableCell colSpan={5} className="pt-0 text-start">
                  <TargetRow
                    action={setTargetAction.bind(null, row.userId)}
                    period={period}
                    currentSqm={row.targetSqm}
                    label="targets.actions.openTarget"
                    act="target-edit"
                    handle="set-target"
                  />
                </TableCell>
              </TableRow>
            ) : null}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
