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
import { bilingualName, pickName } from "@/lib/lookups";
import { listProjects } from "@/lib/projects";

import { ListCard, SearchForm } from "../_components/list-controls";

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
  const { rows, total } = await listProjects(session, { q, page: currentPage });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("projects.title")}
        action={
          <Button asChild size="sm">
            <Link href="/projects/new">{t("projects.new")}</Link>
          </Button>
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
                  {t("projects.fields.endState")}
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
                      {bilingualName(row, locale)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-start">{row.ownerName}</TableCell>
                  <TableCell numeric dir="ltr">
                    {row.sqmExpected ?? t("common.none")}
                  </TableCell>
                  <TableCell className="text-start">
                    {pickName(locale, row.cityNameEn, row.cityNameAr) ??
                      t("common.none")}
                  </TableCell>
                  <TableCell className="text-start">
                    {row.endState ? (
                      <Badge
                        variant={
                          row.endState === "lost" ? "destructive" : "secondary"
                        }
                      >
                        {t(`enums.projectEndState.${row.endState}`)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">
                        {t("projects.fields.endStateOpen")}
                      </span>
                    )}
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
