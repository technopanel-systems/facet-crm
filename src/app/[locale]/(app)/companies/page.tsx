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
import { listCompanies } from "@/lib/companies";
import { pickName } from "@/lib/lookups";

import { ListCard, SearchForm } from "../_components/list-controls";

// Session and database on every request.
export const dynamic = "force-dynamic";

export default async function CompaniesPage({
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
  const format = await getFormatter();

  const { rows, total } = await listCompanies(session, {
    q,
    page: Number(page) || 1,
  });
  const currentPage = Number(page) || 1;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("companies.title")}
        action={
          <Button asChild size="sm">
            <Link href="/companies/new">{t("companies.new")}</Link>
          </Button>
        }
      />

      <SearchForm basePath="/companies" defaultValue={q} />

      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {q ? t("companies.emptyFiltered") : t("companies.empty")}
        </p>
      ) : (
        <ListCard
          basePath="/companies"
          page={currentPage}
          total={total}
          query={q}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">
                  {t("common.name")}
                </TableHead>
                <TableHead className="text-start">
                  {t("common.phone")}
                </TableHead>
                <TableHead className="text-start">
                  {t("companies.fields.category")}
                </TableHead>
                <TableHead className="text-start">
                  {t("common.city")}
                </TableHead>
                {/* Derived from the quotation event, never set by hand
                    `[04 qualification]`, `[10 §1]`. A warmth column stood
                    beside this one until `25 §6` cut it; qualification is the
                    half of `10 §1` that survives, because it is what has
                    actually happened rather than what a rep thinks
                    `[25 §16]`. */}
                <TableHead className="text-start">
                  {t("common.qualified")}
                </TableHead>
                <TableHead numeric>{t("common.createdAt")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-start font-medium">
                    <Link
                      href={`/companies/${row.id}`}
                      className="hover:underline"
                    >
                      {row.name}
                    </Link>
                  </TableCell>
                  {/* A phone number is read left-to-right in both locales.
                      Mono but NOT end-aligned: it is an identifier, not a
                      magnitude — the concept's `.code` rather than `.num`. */}
                  <TableCell className="num text-start" dir="ltr">
                    {row.phone ?? t("common.none")}
                  </TableCell>
                  <TableCell className="text-start">
                    {pickName(locale, row.categoryNameEn, row.categoryNameAr) ??
                      t("common.none")}
                  </TableCell>
                  <TableCell className="text-start">
                    {pickName(locale, row.cityNameEn, row.cityNameAr) ??
                      t("common.none")}
                  </TableCell>
                  <TableCell className="text-start">
                    {row.isQualified ? (
                      <Badge variant="outline">{t("common.qualified")}</Badge>
                    ) : (
                      <span className="text-muted-foreground">
                        {t("common.none")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell numeric className="text-muted-foreground">
                    {format.dateTime(row.createdAt, { dateStyle: "medium" })}
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
