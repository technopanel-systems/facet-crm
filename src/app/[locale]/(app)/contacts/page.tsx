import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
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
import { listContacts } from "@/lib/contacts";
import { bilingualName } from "@/lib/lookups";

import { ListPagination, SearchForm } from "../_components/list-controls";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
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
  const { rows, total } = await listContacts(session, { q, page: currentPage });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("contacts.title")}
        action={
          <Button asChild size="sm">
            <Link href="/contacts/new">{t("contacts.new")}</Link>
          </Button>
        }
      />

      <SearchForm basePath="/contacts" defaultValue={q} />

      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {q ? t("contacts.emptyFiltered") : t("contacts.empty")}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">
                    {t("common.nameEn")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("contacts.fields.company")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("contacts.fields.position")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("common.phone")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("common.email")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-start font-medium">
                      <Link
                        href={`/contacts/${row.id}`}
                        className="hover:underline"
                      >
                        {bilingualName(row, locale)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-start">
                      <Link
                        href={`/companies/${row.companyId}`}
                        className="hover:underline"
                      >
                        {bilingualName(
                          { nameEn: row.companyNameEn, nameAr: row.companyNameAr },
                          locale,
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="text-start">
                      {row.position ?? t("common.none")}
                    </TableCell>
                    <TableCell className="text-start" dir="ltr">
                      {row.phone ?? t("common.none")}
                    </TableCell>
                    <TableCell className="text-start" dir="ltr">
                      {row.email ?? t("common.none")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ListPagination
            basePath="/contacts"
            page={currentPage}
            total={total}
            query={q}
          />
        </>
      )}
    </div>
  );
}
