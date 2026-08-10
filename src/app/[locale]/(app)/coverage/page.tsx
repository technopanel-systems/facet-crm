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
import { coverage, coverageRepOptions } from "@/lib/coverage";
import { bilingualName } from "@/lib/lookups";

import { ListPagination, SearchForm } from "../_components/list-controls";

export const dynamic = "force-dynamic";

/**
 * Coverage `[20 §7]` — which companies have gone quiet.
 *
 * **Not gated, scoped.** A rep sees their own companies; `sees_all_reps` sees
 * everyone's and may narrow with `?rep=`. This is deliberately the rep's own
 * work tool: they are the person who can act on a quiet company, and a
 * diagnostic only a supervisor can see is a scoreboard rather than a queue.
 *
 * There is nothing to submit here, so nothing is late and nothing is
 * penalised — that is what supersedes `07 D6`'s submission model.
 */
export default async function CoveragePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    page?: string;
    rep?: string;
    quiet?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q, page, rep, quiet } = await searchParams;

  const session = await requireSession();
  const t = await getTranslations();
  const format = await getFormatter();

  const currentPage = Number(page) || 1;
  const quietOnly = quiet === "1";

  const [{ rows, total, thresholds }, repOptions] = await Promise.all([
    coverage(session, { q, page: currentPage, userId: rep, quietOnly }),
    coverageRepOptions(session),
  ]);

  const basePath = "/coverage";
  const withParams = (extra: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    for (const [key, value] of Object.entries(extra)) {
      if (value) search.set(key, value);
    }
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <PageHeader
        title={t("coverage.title")}
        description={t("coverage.detail.hint")}
      />

      <p className="text-muted-foreground text-start text-sm">
        {t("coverage.detail.thresholds", {
          qualified: thresholds.qualified,
          unqualified: thresholds.unqualified,
        })}{" "}
        {t("coverage.detail.yours")}
      </p>

      <SearchForm
        basePath={basePath}
        defaultValue={q}
        placeholder={t("coverage.searchPlaceholder")}
      />

      <nav className="flex flex-wrap gap-2" aria-label={t("common.filter")}>
        <Button asChild size="xs" variant={quietOnly ? "outline" : "secondary"}>
          <Link href={withParams({ rep })}>
            {t("coverage.fields.filterAll")}
          </Link>
        </Button>
        <Button asChild size="xs" variant={quietOnly ? "secondary" : "outline"}>
          <Link href={withParams({ rep, quiet: "1" })}>
            {t("coverage.fields.filterQuiet")}
          </Link>
        </Button>

        {/* Offered only when there is more than one person to choose between:
            a rep gets only their own name, which makes the control pointless. */}
        {repOptions.length > 1 ? (
          <>
            <Button asChild size="xs" variant={rep ? "outline" : "secondary"}>
              <Link href={withParams({ quiet: quiet })}>
                {t("coverage.fields.allReps")}
              </Link>
            </Button>
            {repOptions.map((option) => (
              <Button
                key={option.id}
                asChild
                size="xs"
                variant={rep === option.id ? "secondary" : "outline"}
              >
                <Link href={withParams({ rep: option.id, quiet })}>
                  {option.name}
                </Link>
              </Button>
            ))}
          </>
        ) : null}
      </nav>

      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {q || rep || quietOnly
            ? t("coverage.emptyFiltered")
            : t("coverage.empty")}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">
                    {t("coverage.fields.company")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("coverage.fields.reps")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("coverage.fields.lastInteraction")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("coverage.fields.daysSince")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("common.qualified")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("coverage.fields.status")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("common.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.companyId}>
                    <TableCell className="text-start font-medium">
                      <Link
                        href={`/companies/${row.companyId}`}
                        className="hover:underline"
                      >
                        {bilingualName(
                          {
                            nameEn: row.companyNameEn,
                            nameAr: row.companyNameAr,
                          },
                          locale,
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="text-start">
                      {row.repNames.length > 0
                        ? row.repNames.join(", ")
                        : t("common.none")}
                    </TableCell>
                    <TableCell className="text-start" dir="ltr">
                      {row.lastInteractionOn
                        ? format.dateTime(
                            new Date(`${row.lastInteractionOn}T00:00:00Z`),
                            { dateStyle: "medium", timeZone: "UTC" },
                          )
                        : t("coverage.fields.never")}
                    </TableCell>
                    <TableCell className="text-start" dir="ltr">
                      {/* Never logged is not zero days. */}
                      {row.daysSince ?? t("common.none")}
                    </TableCell>
                    <TableCell className="text-start">
                      {row.isQualified ? t("common.yes") : t("common.no")}
                    </TableCell>
                    <TableCell className="text-start">
                      {row.onHoldUntil ? (
                        <Badge variant="outline">
                          {t("coverage.detail.onHoldUntil", {
                            date: row.onHoldUntil,
                          })}
                        </Badge>
                      ) : row.isQuiet ? (
                        <Badge variant="destructive">
                          {t("coverage.fields.quiet")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          {t("coverage.fields.covered")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-start">
                      <Button asChild size="xs" variant="outline">
                        <Link href={`/reports/new?companyId=${row.companyId}`}>
                          {t("reports.new")}
                        </Link>
                      </Button>
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
