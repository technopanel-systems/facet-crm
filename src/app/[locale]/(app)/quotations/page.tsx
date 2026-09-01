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
import { can, requireSession } from "@/lib/authz";
import { CHAIN_GROUPS, chainOwner, type ChainGroup } from "@/lib/chain";
import { getCompany } from "@/lib/companies";
import { getProject } from "@/lib/projects";
import { formatSqm } from "@/lib/decimal";
import {
  listQuotationThreads,
  type QuotationGroupCounts,
  type QuotationThreadListRow,
} from "@/lib/quotations";

import { ListCard, ScopeChip, SearchForm } from "../_components/list-controls";
import { refreshProps } from "../_components/refresh";
import { RefreshNotice } from "../_components/refresh-notice";
import { daysSince, initials } from "../_components/turn";

export const dynamic = "force-dynamic";

/**
 * The bad terminal states get the destructive badge; nothing else does `D6`.
 *
 * `accepted` never reaches this function — a thread the coordinator accepted is
 * at `withCustomer` or further, never `closed` — which is the point `S65` and
 * `D6` both make: internal approval is not an outcome, and a coloured pill is
 * the first place that gets lost.
 */
function endStateVariant(state: string): "outline" | "destructive" {
  return state === "rejected" || state === "cancelled"
    ? "destructive"
    : "outline";
}

/**
 * `D25`'s group heading key, in the **second person where the reader is that
 * person** — the same condition `chainTurnKey` splits the turn line on, and the
 * only place whose-move is said now that the row does not repeat it.
 */
function groupKey(group: ChainGroup, viewerIsCoordinator: boolean): string {
  if (group === "coordinator" && viewerIsCoordinator) {
    return "quotations.groups.yours";
  }
  return `quotations.groups.${group}`;
}

export default async function QuotationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    page?: string;
    companyId?: string;
    projectId?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const search = await searchParams;
  const { q, page, companyId, projectId } = search;

  // **Stamped before the query runs** `D72`, so the count can over-report by a
  // query's duration and never miss a row. See `refresh.ts`.
  const refresh = refreshProps({
    scope: "quotations",
    locale,
    basePath: "/quotations",
    search,
    query: { q, companyId, projectId },
  });

  const session = await requireSession();
  const t = await getTranslations();
  // `D2` speaks in the second person to the identity that owes the move. The
  // coordinator is the one FACET can name exactly.
  const viewerIsCoordinator = can(session, "canApproveQuotation");

  const currentPage = Number(page) || 1;
  const { rows, total, groupCounts, foreignRaiserCount } =
    await listQuotationThreads(session, {
      q,
      companyId,
      projectId,
      page: currentPage,
    });

  // **The scope is named or it is not applied** `D59`. A company detail card
  // links here for the sixth quotation onward `D70`, and a list that silently
  // returned a subset is the defect that broke three screens. `getCompany`
  // resolves the name through the reader's own visibility filter, so a
  // `?companyId=` naming a company they may not see scopes the list and names
  // nothing — the rows were already filtered by
  // `visibleQuotationThreadsFilter`, which company membership never widens.
  //
  // **`?projectId=` is the same shape and arrived with session 28**, because
  // `D70` asks a capped card for *the way to the rest* and a project's
  // quotations card had none — `/quotations` was indexed by company and not by
  // project. `getProject` resolves the name through `visibleProjectsFilter`,
  // which is the reader's own gate `S30`, so an id naming a project they may
  // not open scopes nothing they could not already see.
  const [scopedToCompany, scopedToProject] = await Promise.all([
    companyId ? getCompany(session, companyId) : null,
    projectId ? getProject(session, projectId) : null,
  ]);
  const scopedTo = scopedToCompany ?? scopedToProject;
  // Filters the search and the pager must carry, so neither throws the other
  // away `D59`.
  const extra = { companyId, projectId };
  // **The reader's own name on every row says nothing** `D2`. The column earns
  // its place only where the list holds somebody ELSE's work, counted over the
  // whole visible scope so it cannot appear on page 1 and vanish on page 2.
  //
  // **This was `raiserCount > 1` and the test was too weak.** Rep-a sees 71
  // threads he raised and 1 reaching him through a shared project — two
  // raisers, so the column rendered and printed his own name 71 times, which is
  // the thing `D2` says says nothing. Counting only the others is the honest
  // question, and `listProjects` now asks it the same way.
  const namesRaiser = foreignRaiserCount > 0;
  const columns = namesRaiser ? 7 : 6;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("quotations.title")}
        action={
          <Button asChild size="sm">
            <Link href="/quotations/new">{t("quotations.new")}</Link>
          </Button>
        }
      />

      <SearchForm
        basePath="/quotations"
        defaultValue={q}
        placeholder={t("quotations.searchPlaceholder")}
        hidden={extra}
      />

      {scopedTo ? (
        <ScopeChip label={scopedTo.name} clearHref="/quotations" />
      ) : null}

      {rows.length === 0 ? (
        // Outside `ListCard` `D60` — inside a card with a pagination footer an
        // empty list reads as a broken page rather than an empty one. `D52`
        // wants both what would make it non-empty and the action; the filtered
        // half's action is the way back.
        <div
          data-slot="quotations-empty"
          data-filtered={q ? "true" : "false"}
          className="border-line flex flex-col items-center gap-3 rounded-[14px] border border-dashed p-8 text-center"
        >
          <p className="text-muted-foreground text-sm">
            {q ? t("quotations.emptyFiltered") : t("quotations.empty")}
          </p>
          {q ? (
            <Button asChild size="sm" variant="outline">
              <Link href="/quotations">
                {t("quotations.emptyFilteredAction")}
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link href="/quotations/new">{t("quotations.new")}</Link>
            </Button>
          )}
        </div>
      ) : (
        <ListCard
          basePath="/quotations"
          page={currentPage}
          total={total}
          query={q}
          extra={extra}
          // `D72` — *in the header of the block it belongs to*. It draws no box
          // until something has arrived, so this card is unchanged until then.
          header={<RefreshNotice {...refresh} variant="bar" />}
        >
          {/* **`table-fixed`, and it is not cosmetic.** Every cell carries
              `whitespace-nowrap`, so under auto layout the table's min-content
              width is the sum of every string in it — and a company name runs
              to 56 characters. At 1366 that pushed the total off mid-word and
              the state column past the edge entirely `D23`. Fixed layout makes
              the declared widths bind and lets the two name columns truncate.
              The whole row is 912px, or 1040 with the raiser, against the
              1078 a 1366 laptop has after the rail and `D22`'s padding. */}
          {/* `D56` — below `md` this becomes rows: the days it has waited,
              the project name, and **position**. The lead cell IS the elapsed
              here `D26`, and position is which of the coordinator's three
              moves is owed — the thing a pile header cannot say. The company
              name goes with the other secondary columns. */}
          <Table phoneRows className="table-fixed">
            <TableHeader>
              <TableRow>
                {/* **The order is what a rep scans for**: how long, where it
                    stands, what it is, how big. The company and the SMAC
                    reference are lookup fields — you read them once you have
                    found the row — so they follow rather than lead.

                    `D26`'s lead cell — *who does this wait on?* The pile's name
                    answers the person; this carries how long it has stood, and
                    the avatar where the row can name somebody.

                    **Headed `Waiting`, not `Whose move`.** The cell holds a day
                    count and nothing else since the turn line moved to the pile
                    header, and a header asking *whose move* over a bare number
                    answers a question the column stopped answering.
                    `common.whoseMove` is left alone — `/projects` and
                    `coverage-table.tsx` both still head an actual whose-move
                    column with it. */}
                <TableHead className="w-28 text-start">
                  {t("quotations.fields.waiting")}
                </TableHead>
                {/* What the group header cannot say: WHICH move. Three
                    positions share the coordinator's pile and no two of them
                    are the same work `S63` `S65` `S72`. */}
                <TableHead className="w-36 text-start">
                  {t("quotations.fields.position")}
                </TableHead>
                <TableHead className="w-56 text-start">
                  {t("quotations.fields.project")}
                </TableHead>
                {/* **Square metres, not riyals** `S6` — targets are measured in
                    square metres, never currency, and this is the screen a rep
                    opens to see what is waiting on him. The riyal total is the
                    coordinator's number and she has SMAC `S5` `S63`. */}
                <TableHead className="w-28" numeric>
                  {t("quotations.fields.totalSqm")}
                </TableHead>
                <TableHead className="w-56 text-start">
                  {t("quotations.fields.company")}
                </TableHead>
                <TableHead className="w-24 text-start">
                  {t("quotations.fields.reference")}
                </TableHead>
                {/* **`data-column`, not `data-slot`.** `TableHead` sets
                    `data-slot="table-head"` and then spreads props over it, so
                    a `data-slot` passed in here silently REPLACES the
                    component's own marker — which `/companies` asserts as a
                    route marker. `/projects` overrides it the same way on its
                    owner column; recorded in `WORKFLOW §5` rather than fixed
                    from this session. */}
                {namesRaiser ? (
                  <TableHead data-column="raiser" className="w-32 text-start">
                    {t("quotations.fields.raisedBy")}
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
                namesRaiser,
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
 * `D25`'s groups, with `D24`'s counts.
 *
 * **Two of `D25`'s three, plus one it does not name.** `S133` left
 * `withCustomer` as the only rep-owed thread position, so *your move* and
 * *waiting on the customer* select the same rows — see `chainGroup` in
 * `chain.ts` for why the third name is superseded rather than split. The
 * bottom group is won and closed together: they owe nobody, and a list must
 * still show every row it returns.
 *
 * **The count is the whole scope's, not the page's** — `listQuotationThreads`
 * folds before it cuts, so a header cannot read *· 25* on every page but the
 * last.
 *
 * The rows arrive in `CHAIN_GROUPS` order, so a group is a contiguous run and
 * nothing is re-sorted here.
 */
function renderGrouped(
  rows: QuotationThreadListRow[],
  t: Translate,
  counts: QuotationGroupCounts,
  viewerIsCoordinator: boolean,
  namesRaiser: boolean,
  columns: number,
  viewerUserId: string,
) {
  return CHAIN_GROUPS.flatMap((group) => {
    const groupRows = rows.filter((row) => row.group === group);
    if (groupRows.length === 0) return [];
    return [
      <TableRow
        key={`group-${group}`}
        data-slot="quotation-group"
        data-group={group}
        data-count={String(counts[group])}
        className="hover:bg-transparent"
      >
        <TableCell colSpan={columns} phone="group" className="text-start">
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
        <QuotationRow
          key={row.id}
          row={row}
          t={t}
          namesRaiser={namesRaiser}
          viewerUserId={viewerUserId}
        />
      )),
    ];
  });
}

function QuotationRow({
  row,
  t,
  namesRaiser,
  viewerUserId,
}: {
  row: QuotationThreadListRow;
  t: Translate;
  namesRaiser: boolean;
  viewerUserId: string;
}) {
  // **The avatar renders only where the row names a person.** A thread carries
  // `raised_by_user_id` and no issuer or acceptor, nothing assigns a thread to
  // one coordinator, and `can_approve_quotation` is a flag more than one user
  // could hold — so `D26`'s own example, *"Rawan · signatures"*, names somebody
  // this row cannot name. Rather than invent a name or a glyph, the cell shows
  // one where there is one. (`D26`'s other example, *"You · confirm payment"*,
  // names an act `S133` deleted — `WORKFLOW §5` carries the pattern.)
  const named = chainOwner(row.position) === "rep";
  const closed = row.position === "closed" && row.endState !== null;

  return (
    // `data-position` is the row's own answer, and `verify:routes` §11 pairs it
    // against the chain strip on the thread's detail page. That is the
    // assertion this slice needed: the list said *with the customer* and the
    // detail said *won*, from one function, and nothing failed.
    <TableRow
      data-slot="quotation-row"
      data-id={row.id}
      data-position={row.position}
    >
      {/* `D26`'s lead cell. **The turn line is gone and the group carries it**:
          it rendered identically on every row of a pile, and `D29` already
          settled this shape for the board — the pile's name answers `D2` once,
          and the row says what the pile cannot. What is left here is the one
          figure a header can never carry. */}
      <TableCell phone="lead" className="text-start">
        <span data-slot="turn" className="flex items-center gap-2">
          {named ? (
            <span
              aria-hidden
              className="grid size-7 flex-none place-items-center rounded-full bg-(image:--avatar-person-grad) text-[10.5px] font-semibold text-white"
            >
              {initials(row.raisedByName)}
            </span>
          ) : null}
          {/* Uncoloured on purpose, and calendar days for every row `D34`. No
              document sets a lateness threshold for a quotation thread — `S67`
              took away the one date that might have looked like one, and the
              single threshold that exists `07 D5` covers one position of six
              and lives in `follow-ups.ts`. A tone invented here would become
              the number everyone believes in. */}
          {/* `D73` — the run holds a translated word, so it resolves off its own
              word. `dir="ltr"` here rendered *5 يوم* as *يوم 5* for an Arabic
              reader: digits are weak, the word is strong, and forcing LTR puts
              them the wrong way round. */}
          <span className="num text-faint text-[12.5px] font-semibold" dir="auto">
            {t("followUps.fields.days", { count: daysSince(row.createdAt) })}
          </span>
        </span>
      </TableCell>
      {/* **Two columns became one.** The version STATUS and the end STATE each
          said what the group and this label already say; what neither said was
          which of the coordinator's three moves is owed. On a closed thread the
          end state is the label, because *why* is the only fact left — the
          group already said it is over. The version number survives `S66`: a
          revision is a fact nothing else on the row carries. */}
      <TableCell phone="keep" className="text-start">
        <Badge variant={closed ? endStateVariant(row.endState!) : "outline"}>
          {/* Truncation is the fixed layout's answer to a narrow column and
              belongs to it: below `md` there is no column and the label wraps
              `D56`. */}
          <span className="md:truncate">
            {closed
              ? t(`enums.quotationThreadEndState.${row.endState}`)
              : t(`chain.step.${row.position}`)}
          </span>
          <span className="num" dir="ltr">{` · ${row.versionNumber}`}</span>
        </Badge>
      </TableCell>
      {/* **The link moved to the project.** It sat on the SMAC reference, which
          is null on a requested thread — so a rep clicked a dash. The name is
          the row's identity, which is where `/companies` and `/projects` both
          put it. */}
      <TableCell phone="name" className="text-start font-medium">
        <Link href={`/quotations/${row.id}`} className="block hover:underline">
          {/* `S50` — always there, and it may hold either script `D62`. On the
              NAME, never the cell. */}
          <span className="block md:truncate" dir="auto" title={row.projectName}>
            {row.projectName}
          </span>
        </Link>
      </TableCell>
      {/* `S59` — service-line metres are excluded, deliberately: targets
          measure cladding, not fabrication. `S68` forbids SUMMING quotations,
          which is why no total appears under this column and never will. */}
      <TableCell numeric>
        {/* The unit is a translated word, so this is a WORD run and takes
            `dir="auto"` on the run — `dir="ltr"` on the CELL rendered it
            unit-first in Arabic (`A2-12`), and a `dir` never sits on a cell. */}
        <span dir="auto">
          {row.totalSqm
            ? `${formatSqm(row.totalSqm)} ${t("common.sqm")}`
            : t("common.none")}
        </span>
      </TableCell>
      <TableCell className="text-start">
        {/* This carried no `dir` at all until session 26. One name field since
            `S12`, written in either script, so an Arabic company name has to
            read correctly on an English page `D62`. */}
        <span className="block truncate" dir="auto" title={row.companyName}>
          {row.companyName}
        </span>
      </TableCell>
      <TableCell className="num text-start" dir="ltr">
        {row.smacReference ?? t("common.none")}
      </TableCell>
      {namesRaiser ? (
        // **Blank where the reader raised it**, and blank means *mine* `D2`.
        // The cell still renders, so every row keeps the same column count as
        // its header. `dir="auto"` stays on the NAME `D62`, never the cell.
        <TableCell
          className="text-start"
          data-raiser={row.raisedByUserId === viewerUserId ? "self" : "other"}
        >
          {row.raisedByUserId === viewerUserId ? null : (
            <span className="block truncate" dir="auto" title={row.raisedByName}>
              {row.raisedByName}
            </span>
          )}
        </TableCell>
      ) : null}
    </TableRow>
  );
}
