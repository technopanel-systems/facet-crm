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
import { formatSqm } from "@/lib/decimal";
import { can, requireSession } from "@/lib/authz";
import { getCompany } from "@/lib/companies";
import { getQuotationThread } from "@/lib/quotations";
import {
  DISPATCH_GROUPS,
  listDispatches,
  type DispatchGroup,
  type DispatchGroupCounts,
  type DispatchListRow,
} from "@/lib/dispatches";

import {
  FilterNav,
  ListCard,
  ScopeChip,
  SearchForm,
} from "../_components/list-controls";
import { refreshProps } from "../_components/refresh";
import { RefreshNotice } from "../_components/refresh-notice";
import { daysSince } from "../_components/turn";

export const dynamic = "force-dynamic";

/**
 * `D25`'s group heading key, in the **second person where the reader is that
 * person** — `/quotations`' `groupKey` exactly, and for the same reason: the
 * coordinator is the one identity FACET can name precisely `D2`.
 *
 * The rep half is NOT second-person. A draft pile holds every rep's drafts for
 * a manager or the coordinator, and there is no one name a header could carry —
 * `D29` settled that a header naming a person makes the person the subject. So
 * the pile says *waiting on the rep who raised it* and the row's RAISED BY
 * column says which, exactly as `/quotations` splits the same work.
 */
function groupKey(group: DispatchGroup, viewerIsCoordinator: boolean): string {
  if (group === "coordinator" && viewerIsCoordinator) {
    return "dispatches.groups.yours";
  }
  return `dispatches.groups.${group}`;
}

export default async function DispatchesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    page?: string;
    direct?: string;
    archive?: string;
    userId?: string;
    companyId?: string;
    threadId?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const search = await searchParams;
  const { q, page, direct, archive, userId, companyId, threadId } = search;

  const session = await requireSession();
  const t = await getTranslations();

  // `D2` speaks in the second person to the identity that owes the move, and
  // `S72` makes that identity the one holding `can_dispatch`.
  const viewerIsCoordinator = can(session, "canDispatch");

  // **Two scopes, not five, and the piles carry what the chips used to say.**
  // The status row was `Open · Awaiting approval · Approved · Draft · Refused`
  // — four of those five are now group headers `D25`, and a chip that
  // duplicates a header is a control that reorders nothing. What is left is the
  // one scope a group cannot express: `S122` keeps a refused request OUT of the
  // working lists, so the archive is a different set of rows rather than a
  // different arrangement of them.
  const archived = archive === "1";
  const currentPage = Number(page) || 1;
  const basePath = "/dispatches";

  // **Stamped before the query runs** `D72` — see `refresh.ts`. The narrowing
  // sent to the count route is the one the data module is given below, minus
  // `grouped` and `page`: those arrange and cut, and a count is over the whole
  // scope `CLAUDE.md`.
  const refresh = refreshProps({
    scope: "dispatches",
    locale,
    basePath,
    search,
    query: {
      q,
      userId,
      companyId,
      threadId,
      direct: direct === "1",
      status: archived ? "refused" : undefined,
    },
  });

  const { rows, total, groupCounts, foreignRepCount } = await listDispatches(session, {
    q,
    page: currentPage,
    userId,
    companyId,
    threadId,
    grouped: true,
    status: archived ? "refused" : undefined,
    // **The one route chip that survives**, and it is a narrowing rather than a
    // three-way switch: `?direct=1` shows free entries `S75`, absent shows
    // everything. No rule requires it — `[07 C6]` is an archive document and
    // `CLAUDE.md` says those are never authority — so it stands on the
    // founder's own reason, that free entries are 29% of the dataset and the
    // number he wants to move.
    direct: direct === "1" ? true : undefined,
  });

  // **The scope is named or it is not applied** `D59`. A company detail card
  // links here for the sixth dispatch onward `D70`, and a list that silently
  // returned a subset is the defect that broke three screens. `getCompany`
  // resolves the name through the reader's own filter, so a `?companyId=`
  // naming a company they may not open scopes the list and names nothing —
  // `visibleDispatchesFilter` had already decided which rows come back, and
  // company membership is not one of its terms `[18 §2]`.
  //
  // **`?threadId=` is the same shape and arrived with session 28**, because
  // `D70` asks a capped card for *the way to the rest* and a quotation's
  // dispatches card had none — `/dispatches` was indexed by company and not by
  // thread. `getQuotationThread` resolves the label through the reader's own
  // filter, and the label is the SMAC reference where the coordinator has
  // issued one and the project name `S50` until she has.
  const [scopedToCompany, scopedToThread] = await Promise.all([
    companyId ? getCompany(session, companyId) : null,
    threadId ? getQuotationThread(session, threadId) : null,
  ]);
  const scopeLabel =
    scopedToCompany?.name ??
    (scopedToThread
      ? (scopedToThread.live.smacReference ?? scopedToThread.projectName)
      : null);

  // **The rep column earns its place the way `/quotations`' raiser does** `D2`
  // — only where the list holds somebody else's work, counted over the whole
  // visible scope so it cannot appear on page 1 and vanish on page 2, and
  // **blank on the reader's own rows**. The third screen to ask this question
  // and the third to ask it in the data layer.
  const namesRep = foreignRepCount > 0;
  const columns = namesRep ? 6 : 5;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("dispatches.title")}
        description={t("dispatches.detail.creditsTargets")}
        action={
          // **No `can_dispatch` here** `S72`. *A rep requests a dispatch* — the
          // button used to render only for the flag, which was the whole act
          // being behind it. What is behind the flag now is approving, which
          // lives on a request's own screen.
          <Button asChild size="sm">
            <Link href="/dispatches/new">{t("dispatches.request")}</Link>
          </Button>
        }
      />

      <SearchForm
        basePath={basePath}
        defaultValue={q}
        placeholder={t("dispatches.searchPlaceholder")}
        hidden={{ direct, archive, userId, companyId, threadId }}
      />

      {scopeLabel ? (
        <ScopeChip label={scopeLabel} clearHref={basePath} />
      ) : null}

      {/* **One row, four controls.** Every chip carries the others' values and
          the current search — a chip navigating to a bare `?archive=1` throws
          the query away, which broke three lists `D59`.

          `userId` is the attainment table's deep-link target and has no control
          of its own, so the chips carry it rather than dropping it. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <FilterNav
          basePath={basePath}
          name="archive"
          active={archived ? "1" : undefined}
          query={q}
          extra={{ direct, userId, companyId, threadId }}
          options={[
            { label: t("dispatches.scope.working") },
            { value: "1", label: t("dispatches.scope.archive") },
          ]}
        />
        <FilterNav
          basePath={basePath}
          name="direct"
          active={direct === "1" ? "1" : undefined}
          query={q}
          extra={{ archive, userId, companyId, threadId }}
          options={[
            { label: t("dispatches.fields.filterAll") },
            { value: "1", label: t("dispatches.fields.filterDirect") },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        // `D52` `D60` — outside `ListCard`, where a pagination footer would
        // make an empty list read as broken, and a different key when a filter
        // is what emptied it. The filtered half's action is the way back.
        <div
          data-slot="dispatches-empty"
          data-filtered={q || archived || direct ? "true" : "false"}
          className="border-line flex flex-col items-center gap-3 rounded-[14px] border border-dashed p-8 text-center"
        >
          <p className="text-muted-foreground text-sm">
            {q || archived || direct
              ? t("dispatches.emptyFiltered")
              : t("dispatches.empty")}
          </p>
          {q || archived || direct ? (
            <Button asChild size="sm" variant="outline">
              <Link href={basePath}>{t("quotations.emptyFilteredAction")}</Link>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link href="/dispatches/new">{t("dispatches.request")}</Link>
            </Button>
          )}
        </div>
      ) : (
        <ListCard
          basePath={basePath}
          page={currentPage}
          total={total}
          query={q}
          extra={{ direct, archive, userId, companyId, threadId }}
          // `D72` — *in the header of the block it belongs to*. This is the
          // list the rule's own example is about: a rep submits at 9:15 and
          // the coordinator's open screen still says 9:00.
          header={<RefreshNotice {...refresh} variant="bar" />}
        >
          {/* **`table-fixed`, and it is not cosmetic** — the lesson
              `/quotations` paid for in session 26. `TableCell` carries
              `whitespace-nowrap`, so under auto layout the table's min-content
              width is the sum of every string in it, and a company name runs to
              59 characters. Fixed layout makes the declared widths bind and
              lets the name columns truncate. The row is 688px, or 816 with the
              rep, against the 1078 a 1366 laptop has after the rail and `D22`'s
              padding — `/quotations` sits at 912/1040, so this one has room the
              other does not. */}
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                {/* `D26`'s lead cell — **the square metres, mono, large**, and
                    it answers that object's question before a word is read:
                    *how much went out?* The dispatch DATE led this table until
                    now, which answered nothing and pushed the one figure a rep
                    is measured on `S83` into the middle of the row. */}
                <TableHead className="w-32" numeric>
                  {t("dispatches.fields.sqm")}
                </TableHead>
                {/* One unit, calendar days, one clock `[lastMovedAt]`. Headed
                    for what it measures rather than *whose move* — the pile
                    above the row already answers that `D2`, and `/projects`
                    heads the same kind of figure the same way. */}
                <TableHead className="w-24 text-start">
                  {t("dispatches.fields.lastMoved")}
                </TableHead>
                <TableHead className="w-56 text-start">
                  {t("dispatches.fields.company")}
                </TableHead>
                <TableHead className="w-28 text-start">
                  {t("dispatches.fields.source")}
                </TableHead>
                {/* What the pile cannot say: approved and cancelled share the
                    bottom group because neither owes anybody, and only the row
                    can tell them apart `S31` `S73`. */}
                <TableHead className="w-32 text-start">
                  {t("dispatches.fields.status")}
                </TableHead>
                {/* **`data-column`, not `data-slot`** — `TableHead` spreads
                    props over its own marker, so a `data-slot` here silently
                    replaces it. `WORKFLOW §5` carries the pattern. */}
                {namesRep ? (
                  <TableHead data-column="rep" className="w-32 text-start">
                    {t("dispatches.fields.rep")}
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {renderGrouped(
                rows,
                t,
                groupCounts,
                viewerIsCoordinator,
                namesRep,
                columns,
                session.user.id,
              )}
            </TableBody>
          </Table>
        </ListCard>
      )}
    </div>
  );
}

type Translate = Awaited<ReturnType<typeof getTranslations>>;

/**
 * `D25`'s piles, with `D24`'s counts.
 *
 * **The count is the whole scope's, not the page's** — `listDispatches` folds
 * the counts into its own count query, so a header cannot read *· 35* on every
 * page but the last.
 *
 * The rows arrive in `DISPATCH_GROUPS` order because the SQL ordered them that
 * way, so a group is a contiguous run and nothing is re-sorted here. An empty
 * pile renders no header at all — `D70`, a block with nothing in it is absent
 * rather than an empty shell.
 */
function renderGrouped(
  rows: DispatchListRow[],
  t: Translate,
  counts: DispatchGroupCounts,
  viewerIsCoordinator: boolean,
  namesRep: boolean,
  columns: number,
  viewerUserId: string,
) {
  return DISPATCH_GROUPS.flatMap((group) => {
    const groupRows = rows.filter((row) => row.group === group);
    if (groupRows.length === 0) return [];
    return [
      <TableRow
        key={`group-${group}`}
        data-slot="dispatch-group"
        data-group={group}
        data-count={String(counts[group])}
        className="hover:bg-transparent"
      >
        <TableCell colSpan={columns} className="text-start">
          {/* No `dir="auto"` anywhere on this header: it holds a translated
              label and a number, never a name `D62`.

              **A flex row with a gap, never `ms-*` on the count.** The count
              carries `dir="ltr"`, and `margin-inline-start` resolves against
              the element's OWN direction — so `ms-2` compiled to `margin-left`
              and in Arabic the gap landed on the count's outer edge while the
              number ran into the label. English worked by accident. `gap` has
              no side to get wrong `D57`, which is what the board header
              already does correctly. */}
          <span className="flex items-baseline gap-2">
            <span className="text-faint text-[10.5px] font-semibold tracking-[.09em] uppercase">
              {t(groupKey(group, viewerIsCoordinator))}
            </span>
            <span className="text-faint num text-[10.5px]" dir="ltr">
              {counts[group]}
            </span>
          </span>
        </TableCell>
      </TableRow>,
      ...groupRows.map((row) => (
        <DispatchRow
          key={row.id}
          row={row}
          t={t}
          namesRep={namesRep}
          viewerUserId={viewerUserId}
        />
      )),
    ];
  });
}

function DispatchRow({
  row,
  t,
  namesRep,
  viewerUserId,
}: {
  row: DispatchListRow;
  t: Translate;
  namesRep: boolean;
  viewerUserId: string;
}) {
  return (
    // `data-status` is the row's own answer and `data-group` the pile it landed
    // in; `verify:routes` §24 pairs them, which is what catches a row ordered
    // into one pile while claiming another.
    <TableRow
      data-slot="dispatch-row"
      data-id={row.id}
      data-status={row.status}
      data-group={row.group}
    >
      {/* `D26`'s lead cell, and the row's link. The company name carried the
          link on `/quotations`' idiom — the row's identity going to its own
          record — but a dispatch's identity is a quantity, which is what `D26`
          says answers its question. The company keeps its own link below. */}
      <TableCell numeric className="font-medium" data-lead="sqm">
        <Link
          href={`/dispatches/${row.id}`}
          className="num text-[15px] hover:underline"
          dir="ltr"
        >
          {formatSqm(row.sqm)}{" "}
          <span className="text-faint text-xs font-normal">
            {t("common.sqm")}
          </span>
        </Link>
      </TableCell>
      {/* Uncoloured on purpose `D6`. Colour describes how long something has
          waited against a threshold, and **no document sets one for a dispatch
          request** — `S89` orders the coordinator's queue by when it was
          submitted and names no lateness at all. A tone invented here would
          become the number everyone believes in. */}
      <TableCell className="text-start">
        {/* `D73` — the run holds a translated word, so it resolves off its own
              word. `dir="ltr"` here rendered *5 يوم* as *يوم 5* for an Arabic
              reader: digits are weak, the word is strong, and forcing LTR puts
              them the wrong way round. */}
        <span className="num text-faint text-xs font-semibold" dir="auto">
          {t("followUps.fields.days", { count: daysSince(row.lastMovedAt) })}
        </span>
      </TableCell>
      {/* `18 §2` — the name always; the link only for someone who may open the
          record. `dir="auto"` on the NAME, never the cell `D62`. */}
      <TableCell className="text-start">
        {row.companyViewable ? (
          <Link
            href={`/companies/${row.companyId}`}
            className="block hover:underline"
          >
            <span className="block truncate" dir="auto" title={row.companyName}>
              {row.companyName}
            </span>
          </Link>
        ) : (
          <span className="block truncate" dir="auto" title={row.companyName}>
            {row.companyName}
          </span>
        )}
      </TableCell>
      {/* Where this came from `S75`, and nothing about how it differs.
          **The `S120` marker is gone from this list** `D66`: *a dispatch's
          difference from its quotation is recorded, never flagged*, because
          roughly half of all dispatches differ and a warning that fires half
          the time is not a warning. Measured on this dataset it is worse than
          the rule assumed — see `WORKFLOW §5`. It renders on the dispatch
          itself, which is where `D66` says the rep, the coordinator and the
          manager already see it. */}
      <TableCell
        className="text-start"
        data-source={row.isDirect ? "direct" : "linked"}
      >
        {row.isDirect ? (
          <Badge variant="outline">{t("dispatches.fields.direct")}</Badge>
        ) : row.threadViewable ? (
          <Link
            href={`/quotations/${row.quotationThreadId}`}
            className="num hover:underline"
            dir="ltr"
          >
            {row.smacReference ?? t("common.none")}
          </Link>
        ) : (
          <span className="num" dir="ltr">
            {row.smacReference ?? t("common.none")}
          </span>
        )}
      </TableCell>
      {/* No tone `D6` — a cancellation is a state of a record rather than an
          elapsed time, and `S77` refuses to read the gap as a verdict. */}
      <TableCell className="text-start">
        <Badge
          variant={row.status === "approved" ? "default" : "outline"}
          data-status={row.status}
        >
          <span className="truncate">{t(`dispatches.status.${row.status}`)}</span>
        </Badge>
      </TableCell>
      {namesRep ? (
        // **Blank where the row credits the reader**, and blank means *mine*
        // `D2` — `/quotations`' raiser cell exactly.
        <TableCell
          className="text-start"
          data-rep={row.userId === viewerUserId ? "self" : "other"}
        >
          {row.userId === viewerUserId ? null : (
            <span className="block truncate" dir="auto" title={row.userName}>
              {row.userName}
            </span>
          )}
        </TableCell>
      ) : null}
    </TableRow>
  );
}
