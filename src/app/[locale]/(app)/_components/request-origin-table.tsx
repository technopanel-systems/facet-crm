import { getTranslations } from "next-intl/server";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RequestOriginRow } from "@/lib/dispatches";

/**
 * `S123` — **who created a record is a measure**, one row per measured rep.
 *
 * *Two questions, two figures, and a screen showing both must say which is
 * which.* The two headings are the two questions, and the note above the table
 * carries the rest.
 *
 * **Nothing here blocks, warns or colours.** `S123` is *a number to look at,
 * never an enforcement* — *a rep in a meeting with no connection is a
 * legitimate exception* — so a high figure is styled exactly like a zero. `D6`
 * agrees from the other side: colour describes how long something has waited,
 * never how good the outcome is, and this is an outcome.
 *
 * **The three columns must not read as a sequence.** `raised - raisedForThem`
 * taken as *"requests the rep did properly"* is a fourth number none of them
 * supports: `editedByAnother` counts requests raised in any month, and one
 * request can sit in both it and `raisedForThem`. Two measures hold that line,
 * because either alone leaves the trap open — the `border-s` below puts the
 * window boundary in the markup where a reader meets it before the prose, and
 * `origin.noteNoArithmetic` gives the reason a divider cannot.
 *
 * Renders rows it is given and asks nothing itself: scoping already happened in
 * `requestOriginForPeriod`, via `visibleMeasuredUsersFilter` — the same shape
 * `AttainmentTable` beside it uses.
 */
export async function RequestOriginTable({
  rows,
}: {
  rows: RequestOriginRow[];
}) {
  const t = await getTranslations();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-start">
            {t("targets.fields.person")}
          </TableHead>
          <TableHead numeric>{t("performance.origin.raised")}</TableHead>
          <TableHead numeric>{t("performance.origin.raisedForThem")}</TableHead>
          {/* `D57` — logical, so the divider lands on the correct side in
              Arabic without an `rtl:` variant. */}
          <TableHead numeric className="border-line border-s">
            {t("performance.origin.editedByAnother")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.userId}>
            <TableCell className="text-start font-medium" dir="auto">
              {row.userName}
            </TableCell>
            {/* `D11` — mono and tabular through `numeric`; `dir="ltr"` because
                a figure reads left to right in both locales. Zero is a real
                answer here, unlike a target `[07 D1]`, so it is printed. */}
            <TableCell numeric dir="ltr">
              {row.raised}
            </TableCell>
            <TableCell numeric dir="ltr">
              {row.raisedForThem}
            </TableCell>
            <TableCell numeric dir="ltr" className="border-line border-s">
              {row.editedByAnother}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
