import { getTranslations, setRequestLocale } from "next-intl/server";

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
import { bilingualName } from "@/lib/lookups";
import { listQuotationThreads } from "@/lib/quotations";

import { ListPagination, SearchForm } from "../_components/list-controls";

export const dynamic = "force-dynamic";

/**
 * The bad terminal states get the destructive badge; `accepted` gets the plain
 * one, deliberately. It is internal approval, not a won deal `[16 §5]` — a
 * success-coloured pill would be the first place that distinction is lost.
 */
function endStateVariant(state: string): "secondary" | "destructive" {
  return state === "rejected" || state === "cancelled" ? "destructive" : "secondary";
}

export default async function QuotationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q, page } = await searchParams;

  const session = await requireSession();
  const t = await getTranslations();

  const currentPage = Number(page) || 1;
  // Reading the list is also what expires overdue quotations `[16 §3]`.
  const { rows, total } = await listQuotationThreads(session, {
    q,
    page: currentPage,
  });

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <PageHeader
        title={t("quotations.title")}
        action={
          <Button asChild size="sm">
            <Link href="/quotations/new">{t("quotations.new")}</Link>
          </Button>
        }
      />

      <SearchForm
        basePath="/quotations"
        defaultValue={q}
        placeholder={t("quotations.searchPlaceholder")}
      />

      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {q ? t("quotations.emptyFiltered") : t("quotations.empty")}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">
                    {t("quotations.fields.reference")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("quotations.fields.project")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("quotations.fields.company")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("quotations.fields.versionStatus")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("quotations.fields.validUntil")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("quotations.fields.grandTotal")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("quotations.fields.endState")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-start font-medium" dir="ltr">
                      <Link
                        href={`/quotations/${row.id}`}
                        className="hover:underline"
                      >
                        {row.smacReference ?? t("common.none")}
                      </Link>
                    </TableCell>
                    <TableCell className="text-start">
                      {bilingualName(
                        { nameEn: row.projectNameEn, nameAr: row.projectNameAr },
                        locale,
                      )}
                    </TableCell>
                    <TableCell className="text-start">
                      {bilingualName(
                        { nameEn: row.companyNameEn, nameAr: row.companyNameAr },
                        locale,
                      )}
                    </TableCell>
                    <TableCell className="text-start">
                      <Badge variant="outline">
                        {t(`enums.quotationVersionStatus.${row.versionStatus}`)}
                        {` · ${row.versionNumber}`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-start" dir="ltr">
                      {row.validUntil ?? t("common.none")}
                    </TableCell>
                    <TableCell className="text-start" dir="ltr">
                      {row.grandTotal
                        ? `${row.grandTotal} ${t("common.sar")}`
                        : t("common.none")}
                    </TableCell>
                    <TableCell className="text-start">
                      {row.endState ? (
                        <Badge variant={endStateVariant(row.endState)}>
                          {t(`enums.quotationThreadEndState.${row.endState}`)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">
                          {t("quotations.fields.endStateOpen")}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ListPagination
            basePath="/quotations"
            page={currentPage}
            total={total}
            query={q}
          />
        </>
      )}
    </main>
  );
}
