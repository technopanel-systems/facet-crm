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
import { hasUsableCompany } from "@/lib/companies";
import { listContacts } from "@/lib/contacts";

import { ListCard, SearchForm } from "../_components/list-controls";

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
  // A contact belongs to a company `[07 A2]`, so an identity with none may read
  // this list and start nothing from it — the projects list's note, for the
  // other half of `S76` `D51`.
  const [{ rows, total }, mayCreate] = await Promise.all([
    listContacts(session, { q, page: currentPage }),
    hasUsableCompany(session),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("contacts.title")}
        action={
          mayCreate ? (
            <Button asChild size="sm">
              <Link href="/contacts/new">{t("contacts.new")}</Link>
            </Button>
          ) : undefined
        }
      />

      <SearchForm basePath="/contacts" defaultValue={q} />

      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {q ? t("contacts.emptyFiltered") : t("contacts.empty")}
        </p>
      ) : (
        <ListCard
          basePath="/contacts"
          page={currentPage}
          total={total}
          query={q}
        >
          {/* `D56` — below `md` this becomes rows, and it is the list where
              **the lead cell IS the name** `D26`, so a row fills two slots
              rather than three. The one column is the **phone**, on `D70`'s
              argument: a rep reads it standing outside the customer's office.
              Position goes with company and email. */}
          <Table phoneRows>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">
                  {t("common.name")}
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
                  <TableCell phone="name" className="text-start font-medium">
                    <Link
                      href={`/contacts/${row.id}`}
                      className="hover:underline"
                    >
                      {/* `dir="auto"` on the NAME, never on the cell `D62`.
                          Since `S19` a contact has one name field written in
                          either script; this was the one list-name cell in the
                          product without it. */}
                      <span dir="auto">{row.name}</span>
                    </Link>
                  </TableCell>
                  {/* Not viewable means no link `S76`: a reader who holds
                      contacts and no company sees the name and cannot open the
                      record behind it — `listProjectCompanies`' shape. */}
                  <TableCell className="text-start">
                    {row.companyViewable ? (
                      <Link
                        href={`/companies/${row.companyId}`}
                        className="hover:underline"
                      >
                        {row.companyName}
                      </Link>
                    ) : (
                      row.companyName
                    )}
                  </TableCell>
                  <TableCell className="text-start">
                    {row.position ?? t("common.none")}
                  </TableCell>
                  <TableCell phone="keep" className="num text-start" dir="ltr">
                    {row.phone ?? t("common.none")}
                  </TableCell>
                  <TableCell className="num text-start" dir="ltr">
                    {row.email ?? t("common.none")}
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
