import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/authz";
import { coverage, coverageRepOptions } from "@/lib/coverage";

import { CoverageTable } from "../_components/coverage-table";
import {
  FilterNav,
  ListCard,
  SearchForm,
} from "../_components/list-controls";

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

  // FilterNav carries the search through every chip now `[22 §3]`.
  const basePath = "/coverage";

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
        hidden={{ rep, quiet }}
      />

      <FilterNav
        basePath={basePath}
        name="quiet"
        active={quietOnly ? "1" : undefined}
        query={q}
        extra={{ rep }}
        options={[
          { label: t("coverage.fields.filterAll") },
          { value: "1", label: t("coverage.fields.filterQuiet") },
        ]}
      />

      {/* Offered only when there is more than one person to choose between:
          a rep gets only their own name, which makes the control pointless. */}
      {repOptions.length > 1 ? (
        <FilterNav
          basePath={basePath}
          name="rep"
          active={rep}
          query={q}
          extra={{ quiet }}
          options={[
            { label: t("coverage.fields.allReps") },
            ...repOptions.map((option) => ({
              value: option.id,
              label: option.name,
            })),
          ]}
        />
      ) : null}

      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {q || rep || quietOnly
            ? t("coverage.emptyFiltered")
            : t("coverage.empty")}
        </p>
      ) : (
        <ListCard
          basePath={basePath}
          page={currentPage}
          total={total}
          query={q}
          extra={{ rep, quiet }}
        >
          <CoverageTable rows={rows} locale={locale} />
        </ListCard>
      )}
    </div>
  );
}
