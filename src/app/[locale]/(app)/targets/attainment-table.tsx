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

/**
 * `D49`'s table — **one row per person, the goal and the attainment
 * together** — as the book-holder reads it: their own row `S83`.
 *
 * They were never two questions, and splitting them put a rep's number on one
 * screen and what it was measured against on another. `/performance` and
 * `/targets` rendered this same component to stop the two drifting; session
 * `28b` merged the screens, so it moved out of `_components` and beside the one
 * page that calls it. There is nothing left for it to agree with.
 *
 * **No edit control any more** (session 53). The per-row disclosure `D58`
 * went to the Team tab with the overseer, which is the only identity that
 * ever held `can_set_targets` — a book-holder was offered nothing here, and
 * now nothing is bound here either. `TargetRow` lives in `_components`.
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
export async function AttainmentTable({ rows }: { rows: AchievementRow[] }) {
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
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.userId}>
            <TableCell className="text-start font-medium">
              {/* **`dir="auto"` on the NAME** `D62`. A person's name may hold
                  either script and must read correctly on either page. */}
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
            <TableCell numeric className="text-[12.5px]">
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
        ))}
      </TableBody>
    </Table>
  );
}
