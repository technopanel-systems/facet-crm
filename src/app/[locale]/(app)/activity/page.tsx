import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import { dailyActivity, measuredPeople } from "@/lib/daily-activity";
import { STREAM_KINDS, parseStreamFilters, streamFor } from "@/lib/timeline";

import { FilterNav, ListCard } from "../_components/list-controls";
import { refreshProps } from "../_components/refresh";
import { RefreshNotice } from "../_components/refresh-notice";
import {
  StreamFilters,
  StreamList,
  withoutKey,
  type StreamQuery,
} from "../_components/stream";

export const dynamic = "force-dynamic";

const VIEWS = ["stream", "by-rep"] as const;
type View = (typeof VIEWS)[number];

/**
 * Activity — **one stream, three arrangements** `D45` `D30`.
 *
 * It replaces `/reports` and `/activity`, which were two screens reading two
 * things: a paginated table of report rows, and a table of per-person counts
 * over yesterday. They looked like different questions and were not — `D45`
 * says *"what happened" is one stream, not five screens*, and the one query is
 * `gather()` in `timeline.ts`, whose six sources are already `D45`'s three
 * kinds. `by-rep` counts the very events `?view=stream` lists, with the same
 * filters in the URL, so the two can no longer disagree.
 *
 * **`?view=calendar` is not built** `D31`: *cards and calendar only if someone
 * asks twice*. It is cheap — every event already carries `day` as a Riyadh
 * calendar day and `working-days.ts` knows which are working days — and cheap
 * is not the test the rule sets. `?view=cards` on `/projects` was declined on
 * the same reading in session 35; this is the second, and `WORKFLOW §5`
 * records that the rule has now been applied rather than merely written.
 *
 * **The two `[id]/timeline` routes stay** `D45`: *a record's timeline is the
 * same stream, scoped to that record*. They run the same `gather()` and render
 * the same `TimelineRow`, so they are not a second screen to be folded in.
 *
 * `D53` — nothing here is gated. Every filter scopes; a rep sees their own
 * row and their own events, and the coordinator sees nearly every observed
 * event and almost no typed one, because `S76` gives her the records and not
 * what the reps wrote about them.
 */
export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<
    StreamQuery & {
      page?: string;
    }
  >;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const search = await searchParams;

  const session = await requireSession();
  const t = await getTranslations();

  const view: View = (VIEWS as readonly string[]).includes(search.view ?? "")
    ? (search.view as View)
    : "stream";

  const people = await measuredPeople(session);

  /**
   * Every parameter validated against the enum it belongs to before it reaches
   * the data layer, so a hand-typed `?outcome=nonsense` narrows to nothing
   * silently instead of being passed through.
   *
   * **The four enum checks moved to `parseStreamFilters` in `timeline.ts`**
   * when `D72` gave this same query a second reader: the count route must run
   * *the same query the screen ran*, and two copies of this reasoning would be
   * the second definition of the scope that rule forbids.
   *
   * **`who` stays here**, because checking it means reading the roster and this
   * screen already holds one for its filter panel. An id that is not on it
   * would otherwise be a probe returning an empty page for a real person and an
   * empty page for an invented one — the same answer, and therefore no answer.
   */
  const { filters, who: whoAsked } = parseStreamFilters(search);
  const who = people.some((person) => person.id === whoAsked)
    ? whoAsked
    : undefined;
  const { kind, outcome, signal, from, to } = filters;

  // **Stamped before the query runs** `D72` — see `refresh.ts`. The narrowing
  // is the normalised one above, never `search`: an unknown `?kind=` reaches
  // the count route as nothing at all, exactly as it reaches the stream.
  const refresh = refreshProps({
    scope: "stream",
    locale,
    basePath: "/activity",
    search,
    query: { q: search.q, kind, who, outcome, signal, from, to },
  });

  const query: StreamQuery = {
    view: search.view === "by-rep" ? "by-rep" : undefined,
    kind,
    who,
    outcome,
    signal,
    from,
    to,
    q: search.q,
  };
  const currentPage = Number(search.page) || 1;

  const stream =
    view === "stream"
      ? await streamFor(
          session,
          { ...filters, who: who ? [who] : undefined },
          { page: currentPage },
        )
      : null;
  const byRep =
    view === "by-rep"
      ? await dailyActivity(session, {
          range: from && to ? { from, to } : undefined,
          filters,
        })
      : null;

  const filtered = Boolean(
    search.q || kind || who || outcome || signal || from || to,
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("activity.title")}
        description={t("activity.detail.hint")}
      />

      {/* `D28`'s idiom, which `D30` takes: one query parameter, no second
          screen. `FilterNav` links carry the search and every other filter
          `D59`, so switching arrangement never throws the narrowing away. */}
      <FilterNav
        basePath="/activity"
        name="view"
        active={query.view}
        query={search.q}
        extra={withoutKey(query, "view")}
        options={[
          { label: t("activity.views.stream") },
          { value: "by-rep", label: t("activity.views.byRep") },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr] lg:items-start">
        {/* `D45` — *filters down the side*. */}
        <StreamFilters query={query} people={people} selfId={session.user.id} />

        <div className="flex min-w-0 flex-col gap-4">
          {/* `D45`'s *what kind*: typed, observed, said. Chips rather than a
              select because four options read as a set, and because this is
              the one filter that shapes what the screen IS. */}
          <FilterNav
            basePath="/activity"
            name="kind"
            active={kind}
            query={search.q}
            extra={withoutKey(query, "kind")}
            options={[
              { label: t("activity.kinds.all") },
              ...STREAM_KINDS.map((value) => ({
                value,
                label: t(`activity.kinds.${value}`),
              })),
            ]}
          />

          {/* Stated rather than discovered: an outcome and a signal are
              properties of a typed event, so either one empties the other two
              kinds. `D45` names all four filters in one breath and does not
              say they are uniform over its own three kinds. */}
          {outcome || signal ? (
            <p
              data-slot="stream-typed-only"
              className="text-muted-foreground text-start text-xs"
            >
              {t("activity.filters.typedOnly")}
            </p>
          ) : null}

          {stream ? (
            stream.total === 0 ? (
              // `D60` — outside the card, where a pagination footer would make
              // an empty list read as a broken page. `D52` — it says what
              // would make it non-empty and offers the action.
              <div className="border-line flex flex-col items-start gap-3 rounded-[12px] border border-dashed p-8">
                <p className="text-muted-foreground text-start text-sm">
                  {filtered ? t("activity.emptyFiltered") : t("activity.empty")}
                </p>
                <Button asChild size="sm">
                  <Link href="/reports/new">{t("reports.new")}</Link>
                </Button>
              </div>
            ) : (
              <ListCard
                basePath="/activity"
                page={stream.page}
                total={stream.total}
                query={search.q}
                extra={withoutKey(query)}
                header={<RefreshNotice {...refresh} variant="bar" />}
              >
                <StreamList
                  events={stream.events}
                  subjects={stream.subjects}
                />
              </ListCard>
            )
          ) : null}

          {byRep ? (
            <ByRep
              data={byRep}
              query={query}
              refresh={<RefreshNotice {...refresh} variant="bar" />}
            />
          ) : null}
        </div>
      </div>

      <p className="text-muted-foreground text-start text-xs">
        {t("activity.detail.notACombinedScore")}
      </p>
    </div>
  );
}

/**
 * `?view=by-rep` `D30` — the stream **counted**, one row per measured person.
 *
 * Every column sums events that are on the screen under `?view=stream` with
 * the same filters, and nothing here adds one column to another `[25 §14]`:
 * comments sit beside reports precisely so a rep cannot raise their activity
 * figure by talking to colleagues.
 *
 * **A person who did nothing renders a row of zeros.** `D70`'s *an empty block
 * is absent* governs a block; this is a row, and hiding it would hide the
 * thing `S42`'s daily report is opened to find out — who logged nothing.
 *
 * The row's way in is `?view=stream&who=<id>`, which is `D30`'s *just me*
 * chip pointed at somebody else. The old screen rendered a second timeline
 * underneath this table for `?rep=`; that was a screen inside a screen, and
 * `D45` says there is one.
 *
 * **The way in is the person's NAME, and there is no actions column.** Every
 * other list in FACET links its lead cell — a company's name, a dispatch's
 * date — and this table was the one that did not, carrying a seventh column
 * whose whole content was a button saying the same thing. That column is also
 * what made the table too wide: `TableHead` and `TableCell` both carry
 * `whitespace-nowrap`, so beside `D45`'s filter column the seven headers
 * measure past the content available at **1366**, which `D23` says to check
 * first, and `overflow-x-auto` would have hidden it as a sideways scroll
 * rather than a defect. Six columns fit. Session 26 found the same shape on
 * `/quotations` from the other end.
 */
async function ByRep({
  data,
  query,
  /**
   * `D72`'s line. **This arrangement polls too**, and on the same scope: it is
   * a count of the very events `?view=stream` lists, so a screen that went
   * stale in one goes stale in both.
   */
  refresh,
}: {
  data: Awaited<ReturnType<typeof dailyActivity>>;
  query: StreamQuery;
  refresh: ReactNode;
}) {
  const t = await getTranslations();

  const entriesHref = (userId: string) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(withoutKey(query, "view"))) {
      if (value) params.set(key, value);
    }
    if (query.q) params.set("q", query.q);
    params.set("who", userId);
    return `/activity?${params.toString()}`;
  };

  if (data.rows.length === 0) {
    return (
      <p className="border-line text-muted-foreground rounded-[12px] border border-dashed p-8 text-start text-sm">
        {t("activity.empty")}
      </p>
    );
  }

  return (
    <>
      <p className="text-muted-foreground text-start text-sm">
        {t("activity.detail.attribution")}
      </p>
      {/* No pager: the roster is every person this identity may read, so the
          footer is a count and nothing else. */}
      <ListCard
        basePath="/activity"
        page={1}
        total={data.rows.length}
        header={refresh}
      >
        {/* **No `phoneRows`, deliberately** `D55` — five figures per rep is
            a manager's arrangement, and this is the one table in the product
            with a `<TableFooter>` of totals that has to stay beside them. It
            keeps `Table`'s horizontal scroller below `md` rather than
            becoming `D56`'s phone rows; declared rather than inherited, with
            the row in `WORKFLOW §5`. */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">
                {t("activity.fields.person")}
              </TableHead>
              <TableHead numeric>{t("activity.fields.reportsLogged")}</TableHead>
              {/* Immediately beside the report count and never inside it —
                  `25 §14` shows the two as `reports: 4 · comments: 7`, and
                  the whole point of the adjacency is that nothing adds
                  them. */}
              <TableHead numeric>
                {t("activity.fields.commentsLogged")}
              </TableHead>
              <TableHead numeric>
                {t("activity.fields.companiesTouched")}
              </TableHead>
              <TableHead numeric>{t("activity.fields.systemEvents")}</TableHead>
              <TableHead numeric>{t("activity.fields.signalsRaised")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row) => (
              <TableRow key={row.userId}>
                {/* `dir="auto"` on the NAME `D62`, never on the cell — the
                    cell also holds a link and, in the footer row, a label. */}
                <TableCell className="text-start font-medium">
                  <Link
                    href={entriesHref(row.userId)}
                    className="hover:underline"
                    dir="auto"
                  >
                    {row.userName}
                  </Link>
                </TableCell>
                <TableCell numeric dir="ltr">
                  {row.reportsLogged}
                </TableCell>
                <TableCell numeric dir="ltr">
                  {row.commentsLogged}
                </TableCell>
                <TableCell numeric dir="ltr">
                  {row.companiesTouched}
                </TableCell>
                <TableCell numeric dir="ltr">
                  {row.systemEvents}
                </TableCell>
                <TableCell numeric dir="ltr">
                  {row.signalsRaised}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="text-start font-medium">
                {t("activity.detail.teamTotal")}
              </TableCell>
              <TableCell numeric dir="ltr">
                {data.total.reportsLogged}
              </TableCell>
              <TableCell numeric dir="ltr">
                {data.total.commentsLogged}
              </TableCell>
              <TableCell numeric dir="ltr">
                {data.total.companiesTouched}
              </TableCell>
              <TableCell numeric dir="ltr">
                {data.total.systemEvents}
              </TableCell>
              <TableCell numeric dir="ltr">
                {data.total.signalsRaised}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </ListCard>
    </>
  );
}
