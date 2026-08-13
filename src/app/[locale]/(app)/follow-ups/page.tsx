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

import { anchorHref } from "../_components/anchors";
import { ListPagination, SearchForm } from "../_components/list-controls";

export const dynamic = "force-dynamic";

/**
 * Follow-ups `[07 D5]`, `[21 §9]` — one work queue over everything past its
 * threshold, oldest first.
 *
 * **Not gated, scoped** — the same shape `/coverage` uses `[20 §7]`. A rep sees
 * their own, `sees_all_reps` sees everyone's, and no permission flag exists for
 * either. The predicates are `visibleCompaniesFilter`,
 * `visibleProjectsFilter` and `visibleQuotationThreadsFilter`, reused; this
 * phase writes none of its own.
 *
 * **Nothing on this page is stored.** Every row is derived on read `[21 §1]`,
 * which is why a company that was chased yesterday and logged this morning is
 * simply absent today, with nothing to clean up.
 *
 * `/coverage` is deliberately left alone `[21 §9]`: it lists every company with
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

  const basePath = "/follow-ups";
  const withParams = (extra: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    for (const [key, value] of Object.entries(extra)) {
      if (value) search.set(key, value);
    }
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("followUps.title")}
        description={t("followUps.detail.hint")}
      />

      <p className="text-muted-foreground text-start text-sm">
        {t("followUps.detail.thresholds", {
          quotation: thresholds.quotationNoResponse,
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

      <nav className="flex flex-wrap gap-2" aria-label={t("common.filter")}>
        <Button asChild size="xs" variant={activeKind ? "outline" : "secondary"}>
          <Link href={withParams({})}>{t("followUps.fields.allKinds")}</Link>
        </Button>
        {FOLLOW_UP_KINDS.map((value) => (
          <Button
            key={value}
            asChild
            size="xs"
            variant={activeKind === value ? "secondary" : "outline"}
          >
            <Link href={withParams({ kind: value })}>
              {t(`enums.followUpKind.${value}`)} ({counts[value]})
            </Link>
          </Button>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {q || activeKind
            ? t("followUps.emptyFiltered")
            : t("followUps.empty")}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
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
                  <TableHead className="text-start">
                    {t("followUps.fields.since")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("followUps.fields.age")}
                  </TableHead>
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
                    <TableCell className="text-start" dir="ltr">
                      {format.dateTime(new Date(`${row.since}T00:00:00Z`), {
                        dateStyle: "medium",
                        timeZone: "UTC",
                      })}
                    </TableCell>
                    <TableCell className="text-start" dir="ltr">
                      {/* Working days for the two thresholds `07 D5` states
                          that way; calendar days for the rest `[21 §8]`. */}
                      {row.inWorkingDays
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
          </div>

          <ListPagination
            basePath={basePath}
            page={currentPage}
            total={total}
            query={q}
          />
        </>
      )}
    </div>
  );
}
