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
import {
  isCompanySort,
  listCompanies,
  type CompanyListRow,
} from "@/lib/companies";
import { pickName } from "@/lib/lookups";

import { FilterNav, ListCard, SearchForm } from "../_components/list-controls";
import { SilenceMeter } from "../_components/silence-meter";

// Session and database on every request.
export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string; sort?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q, page, sort } = await searchParams;

  const session = await requireSession();
  const t = await getTranslations();

  const currentPage = Number(page) || 1;
  const { rows, total, sort: activeSort, groupCounts } = await listCompanies(
    session,
    {
      q,
      page: currentPage,
      // An unknown `?sort=` falls back to the default rather than 404ing: it is
      // a display preference in a URL people edit and share, not a record.
      sort: isCompanySort(sort) ? sort : undefined,
    },
  );

  // Filters the search and the pager must carry, so neither throws the other
  // away `D59`. Only a non-default sort is worth putting in a URL.
  const extra = { sort: activeSort === "attention" ? undefined : activeSort };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("companies.title")}
        action={
          <Button asChild size="sm">
            <Link href="/companies/new">{t("companies.new")}</Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        <SearchForm basePath="/companies" defaultValue={q} hidden={extra} />
        {/* `D25`'s order is the default and the two others are kept because a
            rep sometimes wants them. Chips rather than a `<select>`: the value
            belongs in the URL `D20` `D45`, and `FilterNav` already carries the
            current search, which is what three lists got wrong `D59`. */}
        <FilterNav
          basePath="/companies"
          name="sort"
          active={activeSort === "attention" ? undefined : activeSort}
          query={q}
          options={[
            { label: t("companies.sort.attention") },
            { value: "name", label: t("companies.sort.name") },
            { value: "recent", label: t("companies.sort.recent") },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        // Outside `ListCard` `D60` — inside a card with a pagination footer an
        // empty list reads as a broken page rather than an empty one.
        //
        // **Emptiness is judged on `q` alone.** A sort never removes a row, so
        // asking about it here would show the filtered message on a full list.
        // `D52` wants both to say what would make the list non-empty and to
        // offer the action; the filtered half's action is the way back.
        <div
          data-slot="companies-empty"
          data-filtered={q ? "true" : "false"}
          className="border-line flex flex-col items-center gap-3 rounded-[14px] border border-dashed p-8 text-center"
        >
          <p className="text-muted-foreground text-sm">
            {q ? t("companies.emptyFiltered") : t("companies.empty")}
          </p>
          {q ? (
            <Button asChild size="sm" variant="outline">
              <Link href="/companies">{t("companies.emptyFilteredAction")}</Link>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link href="/companies/new">{t("companies.new")}</Link>
            </Button>
          )}
        </div>
      ) : (
        <ListCard
          basePath="/companies"
          page={currentPage}
          total={total}
          query={q}
          extra={extra}
        >
          {/* `D56` — below `md` this becomes rows: the meter, the name, and
              **Log**. The meter already holds the elapsed time `D26`, and Log
              is what `28b` made this list a work queue with, so phone,
              category and city are the secondary columns that go. */}
          <Table phoneRows>
            <TableHeader>
              <TableRow>
                {/* `D26`'s lead cell. The header names what the meter measures
                    rather than the column's shape — CREATED is gone, and this
                    is what replaced it: the figure the order is built on. */}
                <TableHead className="text-start">
                  {t("companies.fields.lastTouched")}
                </TableHead>
                <TableHead className="text-start">
                  {t("common.name")}
                </TableHead>
                <TableHead className="text-start">
                  {t("common.phone")}
                </TableHead>
                <TableHead className="text-start">
                  {t("companies.fields.category")}
                </TableHead>
                <TableHead className="text-start">
                  {t("common.city")}
                </TableHead>
                {/* **The Log action, gained in `28b`.** `/companies` was the
                    only company list without one — `/follow-ups`, the
                    dashboard waiting list and the company detail `D46` all
                    carry it, and the coverage table that also did was deleted
                    with `/performance` `S88`. No rule asks for it; the
                    inconsistency was the reason. It is what turns the list
                    from a directory into a work queue, and logging is what
                    takes a company off the quiet group above `S32`. */}
                <TableHead className="text-start">
                  {t("common.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* `D25` — grouped, never flat `D24`, and only under the
                  attention order: under name or recency the groups would
                  interleave and a header would be a lie. */}
              {activeSort === "attention"
                ? renderGrouped(rows, locale, t, groupCounts)
                : rows.map((row) => (
                    <CompanyRow key={row.id} row={row} locale={locale} t={t} />
                  ))}
            </TableBody>
          </Table>
        </ListCard>
      )}
    </div>
  );
}

type Translate = Awaited<ReturnType<typeof getTranslations>>;

/**
 * `D25`'s groups, with `D24`'s counts.
 *
 * **Two groups, not three.** `D25` names *gone quiet / due soon / recently
 * touched* and no rule says where *soon* starts — see `COMPANY_ATTENTION_GROUPS`
 * in `src/lib/companies.ts` and the `WORKFLOW §5` row. The middle group is
 * absent rather than guessed at.
 *
 * **The count is the whole scope's, not the page's** — it comes from the same
 * query as `total`. A header counting only the rows that happen to be on this
 * page would read *Gone quiet · 25* on every page but the last.
 *
 * The rows arrive ordered, so a group is a contiguous run and nothing is
 * re-sorted here.
 */
function renderGrouped(
  rows: CompanyListRow[],
  locale: string,
  t: Translate,
  counts: { quiet: number; touched: number },
) {
  const quiet = rows.filter((row) => row.isQuiet);
  const touched = rows.filter((row) => !row.isQuiet);

  return [
    ...section("quiet", quiet, counts.quiet),
    ...section("touched", touched, counts.touched),
  ];

  function section(
    group: "quiet" | "touched",
    groupRows: CompanyListRow[],
    count: number,
  ) {
    if (groupRows.length === 0) return [];
    return [
      <TableRow
        key={`group-${group}`}
        data-slot="company-group"
        data-group={group}
        data-count={String(count)}
        className="hover:bg-transparent"
      >
        <TableCell colSpan={6} phone="group" className="text-start">
          {/* No `dir="auto"` anywhere on this header: it holds a translated
              label and a number, never a company name, and putting it on the
              block is precisely the defect the dashboard's planned-group
              header carried `D62`.

              **A flex row with a gap, never `ms-*` on the count.** The count
              carries `dir="ltr"`, and `margin-inline-start` resolves against
              the element's OWN direction — so `ms-2` compiled to `margin-left`
              and in Arabic the gap landed on the count's outer edge while the
              number ran into the label. English worked by accident. `gap` has
              no side to get wrong `D57`, which is what the board header
              already does correctly. */}
          <span className="flex items-baseline gap-2">
            <span className="text-faint text-[10.5px] font-semibold tracking-[.09em] uppercase">
              {t(`companies.groups.${group}`)}
            </span>
            <span className="text-faint num text-[10.5px]" dir="ltr">
              {count}
            </span>
          </span>
        </TableCell>
      </TableRow>,
      ...groupRows.map((row) => (
        <CompanyRow key={row.id} row={row} locale={locale} t={t} />
      )),
    ];
  }
}

function CompanyRow({
  row,
  locale,
  t,
}: {
  row: CompanyListRow;
  locale: string;
  t: Translate;
}) {
  return (
    <TableRow>
      <TableCell phone="lead" className="text-start">
        <SilenceMeter
          daysSince={row.daysSince}
          silentDays={row.silentDays}
          thresholdDays={row.thresholdDays}
          isQuiet={row.isQuiet}
          onHoldUntil={row.onHoldUntil}
        />
      </TableCell>
      <TableCell phone="name" className="text-start font-medium">
        <Link href={`/companies/${row.id}`} className="hover:underline">
          {/* **`dir="auto"` on the NAME, never on the cell** `D62`. Since `S12`
              a company has one name field written in English or Arabic, so an
              Arabic name must read correctly on an English page — and the cell
              also holds the qualified mark below, which is not the value and
              would be dragged to the far inline-end with it. */}
          <span dir="auto">{row.name}</span>
        </Link>
        {/* Qualification lost its column and became a mark here.
            **Derived from the quotation event, never set by hand**
            `[04 qualification]`, `[10 §1]` — and it is what picks the meter's
            threshold, so it belongs beside the name rather than competing with
            the meter for the lead cell `D26`.

            **Unqualified renders nothing at all** — absent, not a dash. The
            column it replaced showed `common.none` on more than half the rows,
            which is a column mostly saying nothing, and `D2` asks a row to say
            whose move it is rather than to carry a flag. */}
        {row.isQualified ? (
          <span
            data-slot="company-qualified"
            title={t("common.qualified")}
            className="border-line text-faint ms-2 inline-block rounded-[6px] border px-1.5 py-0.5 align-middle text-[10.5px] font-semibold"
          >
            {t("companies.qualifiedMark")}
          </span>
        ) : null}
      </TableCell>
      {/* A phone number is read left-to-right in both locales. Mono but NOT
          end-aligned: it is an identifier, not a magnitude — the concept's
          `.code` rather than `.num`. Mandatory since `S13`, so there is nothing
          to fall back to. */}
      <TableCell className="num text-start" dir="ltr">
        {row.phone}
      </TableCell>
      <TableCell className="text-start">
        {pickName(locale, row.categoryNameEn, row.categoryNameAr) ??
          t("common.none")}
      </TableCell>
      <TableCell className="text-start">
        {pickName(locale, row.cityNameEn, row.cityNameAr) ?? t("common.none")}
      </TableCell>
      <TableCell phone="action" className="text-start">
        <Button asChild size="xs" variant="outline">
          <Link href={`/reports/new?companyId=${row.id}`}>
            {t("reports.new")}
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}
