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
 */

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { visibleMeasuredUsersFilter, type AuthSession } from "@/lib/authz";
import { reportsInRange } from "@/lib/reports";
import {
  eventsInRange,
  type DateRange,
  type TimelineEvent,
} from "@/lib/timeline";

export type DailyActivityRow = {
  userId: string;
  userName: string;
  /** Interactions AND field notes `[20 §8]`. */
  reportsLogged: number;
  /** Distinct companies an interaction touched. A field note touches none. */
  companiesTouched: number;
  /** The four derived events, attributed to whoever performed them. */
  systemEvents: number;
  signalsRaised: number;
};

export type DailyActivity = {
  range: DateRange;
  rows: DailyActivityRow[];
  total: Omit<DailyActivityRow, "userId" | "userName">;
};

/** Yesterday in Riyadh, as `YYYY-MM-DD` — the view's default range `[20 §8]`. */
export function yesterday(): string {
  const now = new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    dateStyle: "short",
  }).format(new Date(now.getTime() - 24 * 60 * 60 * 1000));
}

export function defaultRange(): DateRange {
  const day = yesterday();
  return { from: day, to: day };
}

/**
 * One row per rep this identity may read, over the range.
 *
 * The reports half comes from `reports.ts` rather than being counted in SQL
 * here, so the report tally and the signal tally can never come from two
 * different definitions of the same set — and so both obey
 * `visibleRepReportsFilter` without a second copy of the rule.
 */
export async function dailyActivity(
  session: AuthSession,
  options: { range?: DateRange; userId?: string } = {},
): Promise<DailyActivity> {
  const range = options.range ?? defaultRange();

  const people = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(
      and(
        visibleMeasuredUsersFilter(session),
        options.userId ? eq(users.id, options.userId) : undefined,
      ),
    )
    .orderBy(asc(users.name));

  if (people.length === 0) {
    return { range, rows: [], total: emptyTotals() };
  }

  const ids = people.map((person) => person.id);
  const [reports, events] = await Promise.all([
    reportsInRange(session, range, ids),
    eventsInRange(session, range, ids),
  ]);

  const rows = people.map((person) => {
    const mine = reports.filter((report) => report.userId === person.id);
    const companies = new Set(
      mine
        .map((report) => report.companyId)
        .filter((id): id is string => id !== null),
    );
    return {
      userId: person.id,
      userName: person.name,
      reportsLogged: mine.length,
      companiesTouched: companies.size,
      // `report` events are the logged half and are already counted above;
      // counting them here too would double the figure the founder wants
      // shown BESIDE it, not merged into it.
      systemEvents: events.filter(
        (event) => event.actorUserId === person.id && event.kind !== "report",
      ).length,
      signalsRaised: mine.reduce(
        (sum, report) => sum + report.signals.length,
        0,
      ),
    };
  });

  return {
    range,
    rows,
    total: rows.reduce(
      (sum, row) => ({
        reportsLogged: sum.reportsLogged + row.reportsLogged,
        companiesTouched: sum.companiesTouched + row.companiesTouched,
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
    systemEvents: 0,
    signalsRaised: 0,
  };
}

/**
 * The actual entries behind one rep's row — what "expand a rep" shows
 * `[20 §8]`.
 *
 * Drawn from the same `timeline.ts` union the counts come from, so the list and
 * the number can never drift apart.
 */
export async function dailyActivityEntries(
  session: AuthSession,
  userId: string,
  range: DateRange,
): Promise<TimelineEvent[]> {
  const [visible] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), visibleMeasuredUsersFilter(session)))
    .limit(1);
  if (!visible) return [];

  return eventsInRange(session, range, [userId]);
}
