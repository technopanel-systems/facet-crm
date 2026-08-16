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
import { FOLLOW_UP_KINDS } from "@/lib/enums";
import { followUps } from "@/lib/follow-ups";
import { bilingualName } from "@/lib/lookups";
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
 * **Not gated, scoped** — the same shape `/performance`'s coverage section
 * uses `[20 §7]`. A rep sees their own, `sees_all_reps` sees everyone's, and
 * no permission flag exists for either. The predicates are
 * `visibleCompaniesFilter`, `visibleProjectsFilter` and
 * `visibleQuotationThreadsFilter`, reused; this phase writes none of its own.
 *
 * **Nothing on this page is stored.** Every row is derived on read `[21 §1]`,
 * which is why a company that was chased yesterday and logged this morning is
 * simply absent today, with nothing to clean up.
 *
 * Coverage is deliberately left alone `[21 §9]`: it lists every company with
 * its age, which is the leading indicator. This lists only what is overdue.
 */
export default async function FollowUpsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string; kind?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q, page, kind } = await searchParams;

  const session = await requireSession();
  const t = await getTranslations();
  const format = await getFormatter();

  const currentPage = Number(page) || 1;
  const activeKind = FOLLOW_UP_KINDS.find((value) => value === kind);

  const { rows, total, counts, thresholds } = await followUps(session, {
    q,
    page: currentPage,
    kind: activeKind,
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
        name="kind"
        active={activeKind}
        query={q}
        options={[
          { label: t("followUps.fields.allKinds") },
          ...FOLLOW_UP_KINDS.map((value) => ({
            value,
            label: t(`enums.followUpKind.${value}`),
            count: counts[value],
          })),
        ]}
      />

      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {q || activeKind
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
          <Table>
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
                  <TableCell className="text-start">
                    <Badge variant="outline">
                      {t(`enums.followUpKind.${row.kind}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-start font-medium">
                    <Link href={anchorHref(row.anchorType, row.anchorId)} className="hover:underline">
                      {bilingualName(
                        { nameEn: row.anchorNameEn, nameAr: row.anchorNameAr },
                        locale,
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="text-start">
                    {row.companyId && row.companyNameEn ? (
                      <Link
                        href={`/companies/${row.companyId}`}
                        className="hover:underline"
                      >
                        {bilingualName(
                          {
                            nameEn: row.companyNameEn,
                            nameAr: row.companyNameAr,
                          },
                          locale,
                        )}
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
                    className={cn(
                      "font-semibold",
                      toneClass(
                        turnTone({
                          overdue: row.ageDays > 0,
                          dueSoon: row.ageDays === 0,
                        }),
                      ),
                    )}
                    dir="ltr"
                  >
                    {/* Working days for the thresholds stated that way,
                        calendar days for the rest `[21 §8]` — and its own
                        phrase at zero, which only `date_due` reaches: a rep's
                        date that arrived today has waited no days, and "0
                        days" in this column reads as a defect `[25 §18]`. */}
                    {row.ageDays === 0
                      ? t("followUps.fields.dueToday")
                      : row.inWorkingDays
                        ? t("followUps.fields.workingDays", {
                            count: row.ageDays,
                          })
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
