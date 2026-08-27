/**
 * The daily activity view `[20 §8]` — what a manager looks at on a Sunday
 * morning, and what a rep sees of their own day.
 *
 * **It merges logged reports with the system events FACET already records, and
 * that is the whole point** `[20 §8]`. A view showing only logged reports
 * becomes the attendance check that coverage exists to avoid, and reps will
 * write filler to fill it. Real activity shown beside logged activity is what
 * keeps it honest: a rep who logged nothing but confirmed two payments and
 * pushed a dispatch out has had a working day, and this must say so.
 *
 * **It does not replace coverage.** Daily is the follow-up conversation;
 * coverage `[20 §7]` is the leading indicator.
 *
 * **Scoped, never gated** `[20 §8]`. `sees_all_reps` gets every rep;
 * everyone else gets exactly their own row. The predicate is
 * `visibleMeasuredUsersFilter`, already in `authz` for precisely this shape of
 * question — `07 D2`'s "target progress and activity level side by side"
 * cannot be answered by two screens that disagree about whose numbers a person
 * may read.
 *
 * **Every event lands on the row of whoever performed it** `[20 §8]`, using the
 * actor `timeline.ts` resolves. The grouping key is that actor and nothing
 * else: never the credited rep, never the record's owner. The consequence is
 * stated rather than hidden — a rep's system-event count looks thinner than
 * expected, because the coordinator performs much of the quotation chain. That
 * is correct. The view shows who acted.
 *
 * **Field notes count** toward the logged-reports figure `[20 §8]`. They are
 * activity; they simply belong to no customer.
 *
 * Nothing here combines activity with target into a single score `[07 D2]`.
 *
 * **Since session 27 this counts the stream and does not re-read anything**
 * `D45`. It used to run `reportsInRange` beside `eventsInRange` — two readings
 * of one set, which is how a count and a list start disagreeing, and the very
 * thing `reportsInRange`'s own docblock said it existed to prevent while being
 * the second reading. `D30` settles it: `by-rep` is an ARRANGEMENT of the
 * stream, so it folds `streamEvents` and nothing else, and every column here
 * counts rows a person can see for themselves under `?view=stream` with the
 * same filters in the URL.
 *
 * **The roster is still its own query, and that is not a second answer.** It
 * asks who is being measured, not what happened — so a rep who did nothing in
 * the range gets a row of zeros rather than vanishing. That is the point of
 * the screen: `S42` makes this what a manager reads as the daily report, and
 * the first thing they look for is who logged nothing.
 */

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { visibleMeasuredUsersFilter, type AuthSession } from "@/lib/authz";
import {
  streamEvents,
  type DateRange,
  type StreamFilters,
} from "@/lib/timeline";

export type DailyActivityRow = {
  userId: string;
  userName: string;
  /** Interactions AND field notes `[20 §8]`. */
  reportsLogged: number;
  /** Distinct companies an interaction touched. A field note touches none. */
  companiesTouched: number;
  /**
   * Comments written, **counted and never summed with reports** `[25 §14]`.
   *
   * Its own column, beside `reportsLogged` and never inside it: the founder
   * wants comments visible in reporting — a rep sometimes uses one to log
   * detail — but merging them would let a rep raise his activity count by
   * talking to colleagues, diluting the number that matters. Same principle as
   * `07 D2`: shown side by side, never combined.
   *
   * It is also **not** a `companiesTouched`. A comment is colleagues talking
   * about a customer, not contact with one, so it can never satisfy a coverage
   * threshold `[25 §9]`.
   */
  commentsLogged: number;
  /** The derived events, attributed to whoever performed them. */
  systemEvents: number;
  signalsRaised: number;
};

export type DailyActivity = {
  /** `null` is the whole visible history — `D45` gives the stream no default
   *  range and this is the same set, counted. */
  range: DateRange | null;
  rows: DailyActivityRow[];
  total: Omit<DailyActivityRow, "userId" | "userName">;
};

/**
 * One row per rep this identity may read, counting the stream `D30`.
 *
 * Every figure comes from ONE list of events, so the report tally, the comment
 * tally and the signal tally cannot come from two definitions of the same set —
 * and every one of them obeys the six sources' own filters without a second
 * copy of any rule. `filters` is whatever the stream is showing, so switching
 * `?view=` never changes which events are being counted.
 */
/**
 * Who this identity is allowed to read a figure for — the roster, and nothing
 * about what happened.
 *
 * **Exported since session 27** because `by-rep` and the stream's *who* filter
 * ask the same question and must not answer it twice: a person offered in the
 * filter who then has no row, or a row for somebody the filter will not offer,
 * are the same defect from two sides.
 *
 * `S111` — an account deactivates rather than being deleted, and this is the
 * *roster* half of that rule, not the display half. History keeps naming a
 * departed person on the records they touched; a list of who is being measured
 * does not. `achievementForPeriod` `[targets.ts]` is the same question and
 * already asked it, so the two rosters answered it two different ways until
 * this line existed.
 */
export async function measuredPeople(
  session: AuthSession,
  userId?: string,
): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(
      and(
        eq(users.isActive, true),
        visibleMeasuredUsersFilter(session),
        userId ? eq(users.id, userId) : undefined,
      ),
    )
    .orderBy(asc(users.name));
}

export async function dailyActivity(
  session: AuthSession,
  options: { range?: DateRange; userId?: string; filters?: StreamFilters } = {},
): Promise<DailyActivity> {
  const range = options.range ?? null;

  const people = await measuredPeople(session, options.userId);

  if (people.length === 0) {
    return { range, rows: [], total: emptyTotals() };
  }

  const ids = people.map((person) => person.id);
  const events = await streamEvents(session, {
    ...options.filters,
    who: ids,
    from: range?.from,
    to: range?.to,
  });

  const rows = people.map((person) => {
    const mine = events.filter((event) => event.actorUserId === person.id);
    const reports = mine.flatMap((event) =>
      event.kind === "report" ? [event.report] : [],
    );
    const companies = new Set(
      mine
        .filter((event) => event.kind === "report")
        .map((event) => event.companyId)
        .filter((id): id is string => id !== null),
    );
    return {
      userId: person.id,
      userName: person.name,
      reportsLogged: reports.length,
      companiesTouched: companies.size,
      commentsLogged: mine.filter((event) => event.kind === "comment").length,
      // `report` events are the logged half and are already counted above;
      // counting them here too would double the figure the founder wants
      // shown BESIDE it, not merged into it. `comment` is the same argument a
      // second time `[25 §14]` — it has its own column, so counting it as a
      // system event would put it in two totals and quietly make it worth
      // twice a report.
      systemEvents: mine.filter(
        (event) => event.kind !== "report" && event.kind !== "comment",
      ).length,
      signalsRaised: reports.reduce(
        (sum, report) => sum + report.signals.length,
        0,
      ),
    };
  });

  return {
    range,
    rows,
    // Each column sums down its own list. Nothing here adds one column to
    // another, which is `25 §14` holding at the totals row too.
    total: rows.reduce(
      (sum, row) => ({
        reportsLogged: sum.reportsLogged + row.reportsLogged,
        companiesTouched: sum.companiesTouched + row.companiesTouched,
        commentsLogged: sum.commentsLogged + row.commentsLogged,
        systemEvents: sum.systemEvents + row.systemEvents,
        signalsRaised: sum.signalsRaised + row.signalsRaised,
      }),
      emptyTotals(),
    ),
  };
}

function emptyTotals(): Omit<DailyActivityRow, "userId" | "userName"> {
  return {
    reportsLogged: 0,
    companiesTouched: 0,
    commentsLogged: 0,
    systemEvents: 0,
    signalsRaised: 0,
  };
}

/*
 * `dailyActivityEntries` is gone, and its going is the slice `D45`.
 *
 * It answered *"what did this rep actually do"* by re-running the union for
 * one person and rendering the result under the counts table — which is a
 * second screen inside the first, and `D45` says there is one stream. The act
 * is now `?view=stream&who=<id>`: the same events, in the arrangement built
 * for reading them, with a URL that can be sent to somebody. `D30` makes *just
 * me* a filter chip on the stream for exactly this reason, and a rep's row is
 * the same chip pointed at somebody else.
 *
 * `visibleMeasuredUsersFilter` guarded it and still does — `by-rep` only ever
 * offers a link for a person whose row it rendered, and the stream's own six
 * filters scope what that link then returns.
 */
