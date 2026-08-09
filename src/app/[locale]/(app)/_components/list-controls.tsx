import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";

/** Kept in step with `PAGE_SIZE` in the data modules. */
const PAGE_SIZE = 25;

/**
 * Search as a plain GET form.
 *
 * The query lands in the URL, which means a search is shareable, survives a
 * reload and needs no client JavaScript. Every list screen uses this one.
 */
export async function SearchForm({
  basePath,
  defaultValue,
  /** Already translated. Lists that search something other than a name and a
   *  phone say so — the default is the companies wording. */
  placeholder,
}: {
  basePath: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  const t = await getTranslations();

  return (
    <form method="get" className="flex flex-wrap items-center gap-2">
      <Input
        type="search"
        name="q"
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder ?? t("common.searchPlaceholder")}
        aria-label={t("common.search")}
        className="max-w-xs text-start"
      />
      <Button type="submit" size="sm" variant="secondary">
        {t("common.search")}
      </Button>
      {defaultValue ? (
        // Clearing is navigation back to the unfiltered list, which also
        // drops the page number — page 3 of a search rarely exists unfiltered.
        <Button asChild size="sm" variant="ghost">
          <Link href={basePath}>{t("common.clear")}</Link>
        </Button>
      ) : null}
    </form>
  );
}

/**
 * Previous / next links carrying the current search.
 *
 * Links, not buttons: paging is navigation, and the back button should work.
 */
export async function ListPagination({
  basePath,
  page,
  total,
  query,
}: {
  basePath: string;
  page: number;
  total: number;
  query?: string;
}) {
  const t = await getTranslations();
  if (total <= PAGE_SIZE) return null;

  const lastPage = Math.ceil(total / PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const href = (target: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (target > 1) params.set("page", String(target));
    const search = params.toString();
    return search ? `${basePath}?${search}` : basePath;
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-muted-foreground text-start text-sm">
        {t("common.showing", { from, to, total })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          asChild={page > 1}
          size="sm"
          variant="outline"
          disabled={page <= 1}
        >
          {page > 1 ? (
            <Link href={href(page - 1)}>{t("common.previous")}</Link>
          ) : (
            <span>{t("common.previous")}</span>
          )}
        </Button>
        <Button
          asChild={page < lastPage}
          size="sm"
          variant="outline"
          disabled={page >= lastPage}
        >
          {page < lastPage ? (
            <Link href={href(page + 1)}>{t("common.next")}</Link>
          ) : (
            <span>{t("common.next")}</span>
          )}
        </Button>
      </div>
    </div>
  );
}
