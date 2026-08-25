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
import { formatSqm } from "@/lib/decimal";
import { requireSession } from "@/lib/authz";
import { hasUsableCompany } from "@/lib/companies";
import { lookupName, pickName } from "@/lib/lookups";
import { listProjects } from "@/lib/projects";

import { ListCard, SearchForm } from "../_components/list-controls";
import { ProjectStateBadge } from "../_components/project-state";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
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
  // A project needs a company `S27`, so an identity with none may read this
  // list and start nothing from it — the `S76` reader exactly. `D51`: the
  // button is not rendered rather than rendered and refused, and
  // `/projects/new` answers `notFound()` for the same identity.
  const [{ rows, total }, mayCreate] = await Promise.all([
    listProjects(session, { q, page: currentPage }),
    hasUsableCompany(session),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("projects.title")}
        action={
          mayCreate ? (
            <Button asChild size="sm">
              <Link href="/projects/new">{t("projects.new")}</Link>
            </Button>
          ) : undefined
        }
      />

      <SearchForm basePath="/projects" defaultValue={q} />

      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {q ? t("projects.emptyFiltered") : t("projects.empty")}
        </p>
      ) : (
        <ListCard
          basePath="/projects"
          page={currentPage}
          total={total}
          query={q}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">
                  {t("common.nameEn")}
                </TableHead>
                <TableHead className="text-start">
                  {t("projects.fields.owner")}
                </TableHead>
                <TableHead numeric>
                  {t("projects.fields.sqmExpected")}
                </TableHead>
                <TableHead className="text-start">
                  {t("common.city")}
                </TableHead>
                <TableHead className="text-start">
                  {t("projects.fields.state")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-start font-medium">
                    <Link
                      href={`/projects/${row.id}`}
                      className="hover:underline"
                    >
                      {lookupName(row, locale)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-start">{row.ownerName}</TableCell>
                  <TableCell numeric dir="ltr">
                    {row.sqmExpected ? formatSqm(row.sqmExpected) : t("common.none")}
                  </TableCell>
                  <TableCell className="text-start">
                    {pickName(locale, row.cityNameEn, row.cityNameAr) ??
                      t("common.none")}
                  </TableCell>
                  {/* Won is derived from an approved dispatch `S31` and
                      resolved in SQL by `listProjects`, so this column costs
                      no query of its own and cannot disagree with the
                      dispatches behind it. `D2` is not answered here: this
                      list still has no whose-move column, which is `D25`'s
                      slice and not this rule's. */}
                  <TableCell className="text-start">
                    <ProjectStateBadge row={row} />
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
