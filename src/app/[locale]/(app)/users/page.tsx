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
import { lookupName } from "@/lib/lookups";

import {
  FilterNav,
  ListCard,
  SearchForm,
} from "../_components/list-controls";

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

      {/* `active` is the default, so it is the chip with no parameter. */}
      <FilterNav
        basePath={basePath}
        name="status"
        active={filter === "active" ? undefined : filter}
        query={q}
        options={[
          { label: t("team.fields.filterActive") },
          { value: "inactive", label: t("team.fields.filterInactive") },
          { value: "all", label: t("team.fields.filterAll") },
        ]}
      />

      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {q ? t("team.emptyFiltered") : t("team.empty")}
        </p>
      ) : (
        <ListCard
          basePath={basePath}
          page={currentPage}
          total={total}
          query={q}
        >
          {/* **No `phoneRows`, deliberately** `D55` — managing people is
              laptop-first work, so this keeps `Table`'s horizontal scroller
              below `md` rather than becoming `D56`'s phone rows. Declared
              here rather than inherited, with the row in `WORKFLOW §5`, so
              the next reader does not read it as a list that was missed. */}
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
                <TableHead numeric>{t("common.createdAt")}</TableHead>
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
                  <TableCell className="num text-start" dir="ltr">
                    {row.email}
                  </TableCell>
                  <TableCell className="text-start">
                    {lookupName({ nameEn: row.roleNameEn, nameAr: row.roleNameAr }, locale)}
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
                  {/* No `dir` on a locale-formatted date — the attribute is
                      what scrambled the ar form (A2-1, `98f1e2e`). */}
                  <TableCell numeric>
                    {format.dateTime(row.createdAt, {
                      dateStyle: "medium",
                    })}
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
