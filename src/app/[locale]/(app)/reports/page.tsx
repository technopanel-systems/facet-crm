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
import { REPORT_ENTRY_TYPES, REPORT_OUTCOMES } from "@/lib/enums";
import { bilingualName } from "@/lib/lookups";
import { listReports } from "@/lib/reports";

import { ListPagination, SearchForm } from "../_components/list-controls";

export const dynamic = "force-dynamic";

/**
 * The reports list.
 *
 * **Not gated** `[20 §13]`: every rep logs, and the list shows whatever
 * `visibleRepReportsFilter` allows — a report follows its anchor `[20 §10]`.
 * Filters are GET parameters in the URL, as everywhere else.
 */
export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    page?: string;
    type?: string;
    outcome?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q, page, type, outcome } = await searchParams;

  const session = await requireSession();
  const t = await getTranslations();
  const format = await getFormatter();

  const entryType = (REPORT_ENTRY_TYPES as readonly string[]).includes(
    type ?? "",
  )
    ? (type as (typeof REPORT_ENTRY_TYPES)[number])
    : undefined;
  const chosenOutcome = (REPORT_OUTCOMES as readonly string[]).includes(
    outcome ?? "",
  )
    ? (outcome as (typeof REPORT_OUTCOMES)[number])
    : undefined;

  const currentPage = Number(page) || 1;
  const { rows, total } = await listReports(session, {
    q,
    page: currentPage,
    entryType,
    outcome: chosenOutcome,
  });

  const basePath = "/reports";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("reports.title")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <Link href="/reports/new">
                {t("reports.actions.logInteraction")}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/reports/new?type=field_note">
                {t("reports.actions.logFieldNote")}
              </Link>
            </Button>
          </div>
        }
      />

      <SearchForm
        basePath={basePath}
        defaultValue={q}
        placeholder={t("reports.searchPlaceholder")}
      />

      <nav className="flex flex-wrap gap-2" aria-label={t("common.filter")}>
        <Button asChild size="xs" variant={type ? "outline" : "secondary"}>
          <Link href={basePath}>{t("reports.fields.filterAll")}</Link>
        </Button>
        <Button
          asChild
          size="xs"
          variant={type === "interaction" ? "secondary" : "outline"}
        >
          <Link href={`${basePath}?type=interaction`}>
            {t("reports.fields.filterInteractions")}
          </Link>
        </Button>
        <Button
          asChild
          size="xs"
          variant={type === "field_note" ? "secondary" : "outline"}
        >
          <Link href={`${basePath}?type=field_note`}>
            {t("reports.fields.filterFieldNotes")}
          </Link>
        </Button>
      </nav>

      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {q || type || outcome
            ? t("reports.emptyFiltered")
            : t("reports.empty")}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">
                    {t("reports.fields.reportDate")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("reports.fields.entryType")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("reports.fields.company")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("reports.fields.outcome")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("reports.fields.signals")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("reports.fields.author")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-start font-medium" dir="ltr">
                      <Link
                        href={`/reports/${row.id}`}
                        className="hover:underline"
                      >
                        {format.dateTime(
                          new Date(`${row.reportDate}T00:00:00Z`),
                          { dateStyle: "medium", timeZone: "UTC" },
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="text-start">
                      <Badge
                        variant={
                          row.entryType === "interaction"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {t(`enums.reportEntryType.${row.entryType}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-start">
                      {/* A field note belongs to no customer `[20 §2]`. */}
                      {row.companyNameEn
                        ? bilingualName(
                            {
                              nameEn: row.companyNameEn,
                              nameAr: row.companyNameAr,
                            },
                            locale,
                          )
                        : t("common.none")}
                    </TableCell>
                    <TableCell className="text-start">
                      {row.outcome
                        ? t(`enums.reportOutcome.${row.outcome}`)
                        : row.category
                          ? t(`enums.fieldNoteCategory.${row.category}`)
                          : t("common.none")}
                    </TableCell>
                    <TableCell className="text-start">
                      {row.signals.length === 0 ? (
                        t("common.none")
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {row.signals.map((signal) => (
                            <Badge key={signal.signal} variant="outline">
                              {t(`enums.reportSignal.${signal.signal}`)}
                            </Badge>
                          ))}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-start">{row.userName}</TableCell>
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
