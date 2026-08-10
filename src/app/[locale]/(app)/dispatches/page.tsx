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
import { can, requireSession } from "@/lib/authz";
import { listDispatches } from "@/lib/dispatches";
import { bilingualName } from "@/lib/lookups";

import { ListPagination, SearchForm } from "../_components/list-controls";

export const dynamic = "force-dynamic";

export default async function DispatchesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    page?: string;
    direct?: string;
    userId?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q, page, direct, userId } = await searchParams;

  const session = await requireSession();
  const t = await getTranslations();
  const format = await getFormatter();

  const currentPage = Number(page) || 1;
  const { rows, total } = await listDispatches(session, {
    q,
    page: currentPage,
    userId,
    // `07 C6` — the direct route has to be countable, so it is filterable.
    direct: direct === "1" ? true : direct === "0" ? false : undefined,
  });

  const basePath = "/dispatches";

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <PageHeader
        title={t("dispatches.title")}
        description={t("dispatches.detail.creditsTargets")}
        action={
          can(session, "canDispatch") ? (
            <Button asChild size="sm">
              <Link href="/dispatches/new">{t("dispatches.new")}</Link>
            </Button>
          ) : undefined
        }
      />

      <SearchForm
        basePath={basePath}
        defaultValue={q}
        placeholder={t("dispatches.searchPlaceholder")}
      />

      <nav className="flex flex-wrap gap-2" aria-label={t("common.filter")}>
        <Button asChild size="xs" variant={direct ? "outline" : "secondary"}>
          <Link href={basePath}>{t("dispatches.fields.filterAll")}</Link>
        </Button>
        <Button
          asChild
          size="xs"
          variant={direct === "0" ? "secondary" : "outline"}
        >
          <Link href={`${basePath}?direct=0`}>
            {t("dispatches.fields.filterLinked")}
          </Link>
        </Button>
        <Button
          asChild
          size="xs"
          variant={direct === "1" ? "secondary" : "outline"}
        >
          <Link href={`${basePath}?direct=1`}>
            {t("dispatches.fields.filterDirect")}
          </Link>
        </Button>
      </nav>

      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {q ? t("dispatches.emptyFiltered") : t("dispatches.empty")}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">
                    {t("dispatches.fields.dispatchDate")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("dispatches.fields.company")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("dispatches.fields.rep")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("dispatches.fields.sqm")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("dispatches.fields.source")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("dispatches.fields.recordedBy")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-start font-medium" dir="ltr">
                      <Link
                        href={`/dispatches/${row.id}`}
                        className="hover:underline"
                      >
                        {format.dateTime(new Date(`${row.dispatchDate}T00:00:00Z`), {
                          dateStyle: "medium",
                          timeZone: "UTC",
                        })}
                      </Link>
                    </TableCell>
                    {/* `18 §2` — the name always; the link only for someone who
                        may open the record. */}
                    <TableCell className="text-start">
                      {row.companyViewable ? (
                        <Link
                          href={`/companies/${row.companyId}`}
                          className="hover:underline"
                        >
                          {bilingualName({ nameEn: row.companyNameEn, nameAr: row.companyNameAr }, locale)}
                        </Link>
                      ) : (
                        bilingualName({ nameEn: row.companyNameEn, nameAr: row.companyNameAr }, locale)
                      )}
                    </TableCell>
                    <TableCell className="text-start">{row.userName}</TableCell>
                    <TableCell className="text-start" dir="ltr">
                      {row.sqm} {t("common.sqm")}
                    </TableCell>
                    <TableCell className="text-start">
                      {row.isDirect ? (
                        <Badge variant="outline">
                          {t("dispatches.fields.direct")}
                        </Badge>
                      ) : row.threadViewable ? (
                        <Link
                          href={`/quotations/${row.quotationThreadId}`}
                          className="hover:underline"
                          dir="ltr"
                        >
                          {row.smacReference ?? t("common.none")}
                        </Link>
                      ) : (
                        <span dir="ltr">
                          {row.smacReference ?? t("common.none")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-start">
                      {row.recordedByName}
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
    </main>
  );
}
