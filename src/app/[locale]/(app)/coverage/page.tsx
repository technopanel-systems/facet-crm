import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import { coverage, coverageRepOptions } from "@/lib/coverage";

import { CoverageTable } from "../_components/coverage-table";
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
    <div className="flex flex-col gap-6">
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

      <CoverageTable
        rows={rows}
        locale={locale}
        empty={
          q || rep || quietOnly
            ? t("coverage.emptyFiltered")
            : t("coverage.empty")
        }
      />

      <ListPagination
        basePath={basePath}
        page={currentPage}
        total={total}
        query={q}
      />
    </div>
  );
}
