import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

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
  /** Filters the search must not drop — see `FilterNav`. */
  hidden,
}: {
  basePath: string;
  defaultValue?: string;
  placeholder?: string;
  hidden?: Record<string, string | undefined>;
}) {
  const t = await getTranslations();

  return (
    <form method="get" className="flex flex-wrap items-center gap-2">
      {/* A new search resets to page 1 by omitting `page`, but it must not
          silently drop the filter the user is looking through. */}
      {Object.entries(hidden ?? {}).map(([name, value]) =>
        value ? (
          <input key={name} type="hidden" name={name} value={value} />
        ) : null,
      )}
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

export type FilterOption = {
  /** `undefined` is the "all" chip: the parameter is dropped entirely. */
  value?: string;
  /** Already translated. */
  label: string;
  /** Rendered after the label, e.g. a per-kind count. */
  count?: number;
};

/**
 * The filter chips, as links.
 *
 * **Every chip carries the current search.** `22 §3` says filters are GET
 * forms in the URL — shareable and reload-proof — and a chip that navigates to
 * a bare `?type=…` silently throws the user's query away. `/reports`,
 * `/dispatches` and `/users` all did that; `/follow-ups` and `/coverage` each
 * carried a private `withParams` helper to avoid it. This is that helper, once.
 *
 * The page number is deliberately *not* carried: page 3 of one filter is
 * rarely page 3 of another.
 */
export async function FilterNav({
  basePath,
  name,
  options,
  active,
  query,
  extra,
}: {
  basePath: string;
  /** The search parameter these chips set, e.g. `kind`. */
  name: string;
  options: FilterOption[];
  active?: string;
  query?: string;
  /** Other parameters to preserve, e.g. `/companies`' `sort`. */
  extra?: Record<string, string | undefined>;
}) {
  const t = await getTranslations();

  const href = (value?: string) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    for (const [key, item] of Object.entries(extra ?? {})) {
      if (item) params.set(key, item);
    }
    if (value) params.set(name, value);
    const search = params.toString();
    return search ? `${basePath}?${search}` : basePath;
  };

  return (
    <nav className="flex flex-wrap gap-2" aria-label={t("common.filter")}>
      {options.map((option) => {
        const on = (option.value ?? "") === (active ?? "");
        return (
          <Button
            key={option.value ?? "all"}
            asChild
            size="xs"
            variant={on ? "secondary" : "ghost"}
          >
            {/* **`data-chip`, never `data-slot`** — `Button` sets
                `data-slot="button"` and spreads props after it, so a `data-slot`
                passed here would silently REPLACE the component's own marker
                rather than joining it (`WORKFLOW §5`, and the same trap
                `/follow-ups`' age cell already carries a comment about). The
                count is on the chip rather than on its span so one read gets
                the href, the value and the number together `S45-5`. */}
            <Link
              href={href(option.value)}
              aria-current={on ? "true" : undefined}
              data-chip={option.value ?? ""}
              data-count={
                option.count !== undefined ? String(option.count) : undefined
              }
            >
              {option.label}
              {option.count !== undefined ? (
                /* **No `ms-*` here.** The chip is `inline-flex` with `gap-1`
                   from `size="xs"`, and a logical margin resolves against this
                   span's OWN `dir="ltr"` — so `ms-1.5` compiled to
                   `margin-left` and in Arabic put its space on the count's
                   outer edge while the number ran into the label. The gap was
                   already there; the margin was the bug. Fourth sighting of
                   `CLAUDE.md`'s rule, after the rail, `/companies` and the
                   board `D57`. */
                <span className="num opacity-70" dir="ltr">
                  {option.count}
                </span>
              ) : null}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}

/**
 * The list archetype's frame `[22 §3]`: a bordered card holding the table, with
 * **pagination in the footer**.
 *
 * It replaces the `<div className="overflow-x-auto rounded-lg border">` that
 * eleven pages hand-rolled around `<Table>`, which also double-wrapped
 * `Table`'s own scroll container.
 *
 * The footer renders whenever there are rows, not only when there is a second
 * page: "Showing 1–7 of 7" is the count a rep wants, and a card whose footer
 * appears and disappears with the row count reads as a rendering bug.
 */
export async function ListCard({
  basePath,
  page,
  total,
  query,
  extra,
  header,
  children,
}: {
  basePath: string;
  page: number;
  total: number;
  query?: string;
  /** Filters the pager must carry, so page 2 of a filtered list still is. */
  extra?: Record<string, string | undefined>;
  /**
   * **The card's own header** — `D72`'s *where it renders*, and the only thing
   * that goes here.
   *
   * This card had a footer and no header until session 42, because nothing had
   * ever needed one. It is rendered bare rather than inside a bar of its own:
   * `RefreshNotice` draws no box when there is nothing new, so an unconditional
   * wrapper here would paint an empty rule across every list in the product —
   * the `D61` mistake in a different shape.
   */
  header?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      data-slot="list-card"
      // `D70`'s *states its total*, made assertable. The footer says it in a
      // translated sentence, which a black-box script may not read, and
      // counting the rendered rows cannot tell page 1 of 3 from a short list —
      // the same argument `data-total` on the timeline card already makes.
      data-total={String(total)}
      className="card-face glass"
    >
      {header}
      {children}
      <ListPagination
        basePath={basePath}
        page={page}
        total={total}
        query={query}
        extra={extra}
      />
    </div>
  );
}

/**
 * The footer bar: a count, and previous / next as links.
 *
 * Links, not buttons: paging is navigation, and the back button should work.
 */
export async function ListPagination({
  basePath,
  page,
  total,
  query,
  extra,
}: {
  basePath: string;
  page: number;
  total: number;
  query?: string;
  extra?: Record<string, string | undefined>;
}) {
  const t = await getTranslations();
  if (total === 0) return null;

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const href = (target: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    for (const [key, item] of Object.entries(extra ?? {})) {
      if (item) params.set(key, item);
    }
    if (target > 1) params.set("page", String(target));
    const search = params.toString();
    return search ? `${basePath}?${search}` : basePath;
  };

  return (
    <div
      className={cn(
        "border-line text-faint flex flex-wrap items-center justify-between gap-3",
        "border-t px-4 py-2.5 text-xs",
      )}
    >
      {/* Prose, not a column of figures — so no `num`. Forcing mono here would
          render the Arabic words in a monospace fallback, and `dir="ltr"`
          would reverse the sentence to line up three digits. */}
      <p className="text-start">{t("common.showing", { from, to, total })}</p>
      {lastPage > 1 ? (
        <div className="flex items-center gap-2">
          <Button asChild={page > 1} size="xs" variant="outline" disabled={page <= 1}>
            {page > 1 ? (
              <Link href={href(page - 1)}>{t("common.previous")}</Link>
            ) : (
              <span>{t("common.previous")}</span>
            )}
          </Button>
          <Button
            asChild={page < lastPage}
            size="xs"
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
      ) : null}
    </div>
  );
}

/**
 * A list narrowed to one record, and the way back out — `D59`, `D52`.
 *
 * A company detail page's related cards cap at five and link here for the rest
 * `D70`, which means these lists can arrive already scoped. A list that
 * silently returns a subset is the failure `D59` records breaking three
 * screens: the reader cannot tell a filtered list from a short one. So the
 * scope is **named**, in the reader's own language, with a link that clears it.
 *
 * It is not a `FilterNav` chip: those are a fixed set of options over the whole
 * list, and this is one arbitrary record's id arriving from somewhere else.
 * `label` is already resolved by the caller — the id alone would name nothing.
 */
export async function ScopeChip({
  label,
  clearHref,
}: {
  /** Already translated and already resolved — a company's name, not its id. */
  label: string;
  /** The same list with the scope dropped. */
  clearHref: string;
}) {
  const t = await getTranslations();

  return (
    <div
      data-slot="scope-chip"
      className="border-line flex flex-wrap items-center gap-2 rounded-[10px] border border-dashed px-3 py-2 text-start"
    >
      {/* `dir="auto"` on the NAME `D62` — the row also holds a translated
          label and a control, and putting it on the wrapper would drag both to
          the far inline-end. */}
      <span className="text-muted-foreground text-xs">
        {t("common.filter")}
      </span>
      <span className="text-[13px] font-semibold" dir="auto">
        {label}
      </span>
      <Button asChild size="xs" variant="ghost" className="ms-auto">
        <Link href={clearHref}>{t("common.clear")}</Link>
      </Button>
    </div>
  );
}
