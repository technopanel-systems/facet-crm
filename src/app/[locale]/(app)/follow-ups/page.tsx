import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
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
import { requireSession } from "@/lib/authz";
import {
  asFollowUpGroup,
  FOLLOW_UP_GROUP_NAMES,
  FOLLOW_UP_GROUPS,
} from "@/lib/enums";
import { followUps } from "@/lib/follow-ups";
import { cn } from "@/lib/utils";

import { anchorHref } from "../_components/anchors";
import {
  FilterNav,
  ListCard,
  SearchForm,
} from "../_components/list-controls";
import { toneClass, turnTone } from "../_components/turn";

export const dynamic = "force-dynamic";

/**
 * Follow-ups `[07 D5]`, `[21 §9]` — one work queue over everything past its
 * threshold, oldest first.
 *
 * **Not gated, scoped** — the shape every silence reader uses `[20 §7]`. A
 * rep sees their own, `sees_all_reps` sees everyone's, and
 * no permission flag exists for either. The predicates are
 * `visibleCompaniesFilter`, `visibleProjectsFilter` and
 * `visibleQuotationThreadsFilter`, reused; this phase writes none of its own.
 *
 * **Nothing on this page is stored.** Every row is derived on read `[21 §1]`,
 * which is why a company that was chased yesterday and logged this morning is
 * simply absent today, with nothing to clean up.
 *
 * **`/companies` is the leading indicator and this is the queue.** That list
 * carries every company with its silence meter, grouped quiet-first `D25`;
 * this one carries only what is past a threshold, across all six kinds. There
 * is no third screen between them: `S88` deleted the coverage table in `28b`,
 * and the sentence that used to stand here — *coverage is deliberately left
 * alone, it lists every company with its age* — had been describing
 * `/companies` since the silence meter landed.
 */
export default async function FollowUpsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string; group?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q, page, group } = await searchParams;

  const session = await requireSession();
  const t = await getTranslations();
  const format = await getFormatter();

  const currentPage = Number(page) || 1;
  // `D33`'s four, not `FOLLOW_UP_KINDS`' six — the counts strip links here
  // with `?group=`, and a tile showing 9 must land on a list of 9. The
  // per-kind option survives on `followUps()` for the verify script, which
  // asks one condition at a time; no screen offers it.
  const activeGroup = asFollowUpGroup(group);

  const { rows, total, counts, thresholds } = await followUps(session, {
    q,
    page: currentPage,
    group: activeGroup,
  });

  // The private `withParams` that used to live here is now `FilterNav`'s, so
  // no filter on any list drops the search any more `[22 §3]`.
  const basePath = "/follow-ups";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("followUps.title")}
        description={t("followUps.detail.hint")}
      />

      <p className="text-muted-foreground text-start text-sm">
        {t("followUps.detail.thresholds", {
          quotation: thresholds.quotationNoResponse,
          returned: thresholds.quotationReturned,
          catalogue: thresholds.catalogueNoResponse,
          project: thresholds.projectStageUnchanged,
          qualified: thresholds.qualified,
          unqualified: thresholds.unqualified,
        })}{" "}
        {t("followUps.detail.suppressed")}
      </p>

      <SearchForm
        basePath={basePath}
        defaultValue={q}
        placeholder={t("followUps.searchPlaceholder")}
      />

      <FilterNav
        basePath={basePath}
        name="group"
        active={activeGroup}
        query={q}
        options={[
          { label: t("followUps.fields.allKinds") },
          ...FOLLOW_UP_GROUP_NAMES.map((value) => ({
            value,
            label: t(`today.counts.${value}`),
            count: FOLLOW_UP_GROUPS[value].reduce(
              (sum, kind) => sum + counts[kind],
              0,
            ),
          })),
        ]}
      />

      {rows.length === 0 ? (
        // **Marked, like every other list's empty state** — `/companies` and
        // `/dispatches` both carry one and this screen was the only list
        // without. Without it a filtered group of nothing renders no
        // `list-card`, no `data-total` and no marker at all, so a check cannot
        // tell an empty group from a broken page — and a chip reading 0 has to
        // be readable as 0 `S45-5`.
        <p
          data-slot="follow-ups-empty"
          data-filtered={q || activeGroup ? "true" : "false"}
          className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm"
        >
          {q || activeGroup
            ? t("followUps.emptyFiltered")
            : t("followUps.empty")}
        </p>
      ) : (
        <ListCard
          basePath={basePath}
          page={currentPage}
          total={total}
          query={q}
        >
          {/* `D56` — below `md` this becomes rows: the kind, the record, and
              **the age**. The kind badge IS the *why* this row is on the list,
              so it is the lead cell and the one column is the figure the list
              is worked down by `D34`. **The Log button goes**, and the exit
              door survives without it: the record cell is already a link to
              the anchor. */}
          <Table phoneRows>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">
                  {t("followUps.fields.kind")}
                </TableHead>
                <TableHead className="text-start">
                  {t("followUps.fields.record")}
                </TableHead>
                <TableHead className="text-start">
                  {t("followUps.fields.company")}
                </TableHead>
                <TableHead className="text-start">
                  {t("followUps.fields.reps")}
                </TableHead>
                <TableHead numeric>{t("followUps.fields.since")}</TableHead>
                <TableHead numeric>{t("followUps.fields.age")}</TableHead>
                <TableHead className="text-start">
                  {t("common.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.kind}:${row.anchorId}`}>
                  <TableCell phone="lead" className="text-start">
                    <Badge variant="outline">
                      {t(`enums.followUpKind.${row.kind}`)}
                    </Badge>
                  </TableCell>
                  <TableCell phone="name" className="text-start font-medium">
                    <Link href={anchorHref(row.anchorType, row.anchorId)} className="hover:underline">
                      <span dir="auto">{row.anchorName}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-start">
                    {row.companyId && row.companyName ? (
                      <Link
                        href={`/companies/${row.companyId}`}
                        className="hover:underline"
                      >
                        {row.companyName}
                      </Link>
                    ) : (
                      t("common.none")
                    )}
                  </TableCell>
                  <TableCell className="text-start">
                    {row.ownerNames.length > 0
                      ? row.ownerNames.join(", ")
                      : t("common.none")}
                  </TableCell>
                  <TableCell numeric dir="ltr">
                    {format.dateTime(new Date(`${row.since}T00:00:00Z`), {
                      dateStyle: "medium",
                      timeZone: "UTC",
                    })}
                  </TableCell>
                  {/* `22 §4` — waiting time coloured by lateness. **Every row
                      on this screen is past its threshold**, and not by a
                      judgement made here: `follow-ups.ts` put it in the queue
                      precisely for that reason `[07 D5]`. The colour reads
                      that fact rather than re-deriving it `[21 §7]`.

                      The exception is a `date_due` on the day it arrives. Its
                      threshold is zero, so an age of zero says the rep's date
                      is today — due, not late `[25 §18]`. Still no threshold
                      here: this reads the age the data layer computed. */}
                  <TableCell
                    numeric
                    phone="keep"
                    // **`data-column`, not `data-slot`** — `TableCell` sets its
                    // own `data-slot` and then spreads props over it, so one
                    // passed here would silently replace the component's marker
                    // (`WORKFLOW §5`). The cell beside this one is a bare date
                    // and correctly keeps `dir="ltr"`, so `D73` needs a handle
                    // for THIS cell rather than for every numeric cell.
                    data-column="age"
                    className={cn(
                      "font-semibold",
                      toneClass(
                        turnTone({
                          overdue: row.ageDays > 0,
                          dueSoon: row.ageDays === 0,
                        }),
                      ),
                    )}
                    // `D73` — both branches below are translated phrases
                    // carrying a figure, so the cell resolves off its own
                    // word. `numeric` still ends-aligns it `D11`.
                    dir="auto"
                  >
                    {/* **One unit for the whole list** `D34` — calendar days
                        for every kind, so two rows can be ranked against each
                        other by eye. The thresholds are untouched and are
                        still stated in their own units in the line above.
                        Zero has its own phrase, which only `date_due`
                        reaches: a rep's date that arrived today has waited no
                        days, and "0 days" reads as a defect `[25 §18]`. */}
                    {row.ageDays === 0
                      ? t("followUps.fields.dueToday")
                      : t("followUps.fields.days", { count: row.ageDays })}
                  </TableCell>
                  <TableCell className="text-start">
                    {row.companyId ? (
                      <Button asChild size="xs" variant="outline">
                        <Link href={`/reports/new?companyId=${row.companyId}`}>
                          {t("reports.new")}
                        </Link>
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ListCard>
      )}
    </div>
  );
}
