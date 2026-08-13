import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

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
import { can, listUsers, requireSession } from "@/lib/authz";
import { bilingualName } from "@/lib/lookups";

import { ListPagination, SearchForm } from "../_components/list-controls";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q, page, status } = await searchParams;

  const session = await requireSession();
  // A 404, never a message: it must not confirm that the capability exists.
  if (!can(session, "canManageUsers")) notFound();

  const t = await getTranslations();
  const format = await getFormatter();

  const currentPage = Number(page) || 1;
  const filter =
    status === "inactive" ? "inactive" : status === "all" ? "all" : "active";

  const { rows, total } = await listUsers(session, {
    q,
    page: currentPage,
    status: filter,
  });

  const basePath = "/users";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("team.title")}
        action={
          <Button asChild size="sm">
            <Link href="/users/new">{t("team.new")}</Link>
          </Button>
        }
      />

      <SearchForm
        basePath={basePath}
        defaultValue={q}
        placeholder={t("team.searchPlaceholder")}
      />

      <nav className="flex flex-wrap gap-2" aria-label={t("common.filter")}>
        <Button
          asChild
          size="xs"
          variant={filter === "active" ? "secondary" : "outline"}
        >
          <Link href={basePath}>{t("team.fields.filterActive")}</Link>
        </Button>
        <Button
          asChild
          size="xs"
          variant={filter === "inactive" ? "secondary" : "outline"}
        >
          <Link href={`${basePath}?status=inactive`}>
            {t("team.fields.filterInactive")}
          </Link>
        </Button>
        <Button
          asChild
          size="xs"
          variant={filter === "all" ? "secondary" : "outline"}
        >
          <Link href={`${basePath}?status=all`}>
            {t("team.fields.filterAll")}
          </Link>
        </Button>
      </nav>

      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {q ? t("team.emptyFiltered") : t("team.empty")}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">
                    {t("team.fields.name")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("team.fields.email")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("team.fields.role")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("team.fields.region")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("team.fields.status")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("common.createdAt")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-start font-medium">
                      <Link
                        href={`/users/${row.id}`}
                        className="hover:underline"
                      >
                        {row.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-start" dir="ltr">
                      {row.email}
                    </TableCell>
                    <TableCell className="text-start">
                      {bilingualName(
                        { nameEn: row.roleNameEn, nameAr: row.roleNameAr },
                        locale,
                      )}
                    </TableCell>
                    <TableCell className="text-start">
                      {row.region
                        ? t(`enums.region.${row.region}`)
                        : t("common.none")}
                    </TableCell>
                    <TableCell className="text-start">
                      {row.isActive ? (
                        <Badge variant="secondary">
                          {t("team.fields.statusActive")}
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          {t("team.fields.statusInactive")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-start" dir="ltr">
                      {format.dateTime(row.createdAt, {
                        dateStyle: "medium",
                      })}
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
