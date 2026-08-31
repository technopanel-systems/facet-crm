import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import type { AuthSession } from "@/lib/authz";
import { quietCountsByRep } from "@/lib/coverage";
import { dailyActivity } from "@/lib/daily-activity";
import { formatSqm, percentOf, SQM_SCALE } from "@/lib/decimal";
import type { FollowUpScope } from "@/lib/follow-ups";
import type { AchievementRow } from "@/lib/targets";
import { cn } from "@/lib/utils";
import { riyadhDayOf, weekStart } from "@/lib/working-days";

import { paceGeometry } from "./pace";

/**
 * `D39` — **the team table**: one row per rep, a small pace bar with the tick,
 * m² dispatched of target, waiting-on-them as two counts, logged this week,
 * quiet companies. `D64`'s fourth block, on `sees_all_reps`.
 *
 * **Activity and target sit side by side and are never combined into a score.**
 * That is the rule's own last clause and it is load-bearing: there is no
 * ranking column, no total row and no composite figure here, and the footer
 * says so in words rather than leaving it to be inferred.
 *
 * ## The five figures, and where each comes from
 *
 * Four of the five were already computed per rep before this block existed;
 * none of them gained a subject parameter, and `scopeForUser` is not called.
 *
 *  1. **The pace bar and its tick** — `paceGeometry`, shared with `D32`'s
 *     signature panel so the overage rescale has one implementation. `pacePct`
 *     is a **prop**: today's position in the month is the same number for every
 *     rep, so the page computes it once and the tick cannot drift down the
 *     table.
 *  2. **m² of target** — `achievementForPeriod`, passed in. The dashboard
 *     already ran it for the panel above, and for a `sees_all_reps` identity it
 *     already returns every measured rep. **Zero extra queries.**
 *  3. **Waiting on them** — `followUpScope`, passed in. It is scoped by the
 *     SESSION rather than by "me", so a manager's scope already holds every
 *     rep's rows; this folds it and does not widen it. **Zero extra queries** —
 *     `shellCounts()` had already derived it for `D34`'s list below.
 *  4. **Logged this week** — `dailyActivity` over a Sunday-to-today range. It
 *     counts the stream `D45`, which is the one definition of *logged*.
 *  5. **Quiet companies** — `quietCountsByRep`, one grouped aggregate over the
 *     same `companySilence` subquery `/companies` joins.
 *
 * **Two calls, and the cost does not grow with the team.** N appears only
 * inside an `inArray`; nothing is asked once per rep. A block firing five
 * queries per rep on the commonest read in the application would be a defect
 * with every number correct.
 *
 * ## Which reps are rows
 *
 * **Everyone `D64`'s first block would render for, read wider** — an active
 * user this identity may read who has a target row for the period. That is
 * `D64`'s own condition rather than a new predicate, and it is `D38`'s shape:
 * the first block read at company scope. A rep with no target is **absent**,
 * not a blank bar, because `D32` says someone unmeasured has no target to be
 * ahead or behind of. `S83` makes targets independent of role, so a manager
 * carrying one appears in his own table; that is the rule behaving correctly
 * and is not special-cased.
 *
 * ## Whose row a figure counts on
 *
 * Columns 4 and 6 fold by **live `company_reps` membership** — `FollowUpRow`'s
 * `owners`, *every live rep who could act on it*, which `/follow-ups` already
 * displays. Three consequences, stated rather than discovered: a company shared
 * TO a rep counts on its owner's row; a project with no live company link
 * counts for nobody; and a company with two reps counts on **both** rows, so
 * **the columns do not sum to a company total** — which is consistent with this
 * rule forbidding a total, not a defect.
 */
export async function TeamTable({
  session,
  attainment,
  follow,
  pacePct,
}: {
  session: AuthSession;
  /** `achievementForPeriod` for the current period, already fetched. */
  attainment: AchievementRow[];
  /** `followUpScope`, already derived by `shellCounts()`. */
  follow: FollowUpScope;
  /** `D32`'s expected-to-date, computed once by the page. */
  pacePct: number;
}) {
  const t = await getTranslations();

  // `D64`'s first block, read wider: a target row exists for this person.
  // `targetSqm` is null and never `"0"` for somebody unmeasured `S83`, so this
  // is the same test `page.tsx` makes for the panel, applied to every row.
  const rows = attainment.filter((row) => row.targetSqm !== null);
  if (rows.length === 0) return null;

  const ids = rows.map((row) => row.userId);
  const today = riyadhDayOf(new Date());

  const [activity, quiet] = await Promise.all([
    // Sunday to today. `weekStart` derives the boundary from `S93`'s weekend
    // rather than choosing one, and `to` is today because nothing can have been
    // logged in the rest of the week.
    dailyActivity(session, { range: { from: weekStart(today), to: today } }),
    quietCountsByRep(ids),
  ]);

  const loggedBy = new Map(
    activity.rows.map((row) => [row.userId, row.reportsLogged]),
  );

  /*
   * **The two counts are the split the waiting list already ships** —
   * `waiting-list.tsx` and `/follow-ups` both render
   * `turnTone({ overdue: ageDays > 0, dueSoon: ageDays === 0 })`. Every row
   * `gather` returns is already past its threshold, so `ageDays === 0` is
   * reachable only by a date the rep set for TODAY: overdue is what has
   * slipped, due-soon is what he planned for this morning. No new window is
   * invented here, and this is NOT `D25`'s `OPEN — not chosen` *due soon*,
   * which asks a different question about companies still below a threshold.
   */
  const waiting = new Map<string, { overdue: number; dueSoon: number }>(
    ids.map((id) => [id, { overdue: 0, dueSoon: 0 }]),
  );
  for (const row of follow.rows) {
    for (const owner of row.owners) {
      const bucket = waiting.get(owner.id);
      if (!bucket) continue;
      if (row.ageDays > 0) bucket.overdue += 1;
      else bucket.dueSoon += 1;
    }
  }

  return (
    <Card data-slot="today-team">
      <CardHeader>
        <CardTitle className="text-start text-sm">
          {t("today.team.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/* **No `phoneRows`**, the `/targets` precedent `D55`: this is a
            manager's table read on a laptop, and `D56`'s one kept column
            carries one of the goal and the attainment where this rule asks for
            both. It keeps `Table`'s scroller, declared here rather than
            inherited. */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">
                {t("today.team.rep")}
              </TableHead>
              <TableHead className="text-start">
                {t("today.team.pace")}
              </TableHead>
              <TableHead numeric>{t("today.team.sqm")}</TableHead>
              <TableHead className="text-start">
                {t("today.team.waiting")}
              </TableHead>
              <TableHead numeric>{t("today.team.logged")}</TableHead>
              <TableHead numeric>{t("today.team.quiet")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const target = row.targetSqm as string;
              const achievementPct = percentOf(
                row.achievedSqm,
                target,
                SQM_SCALE,
              );
              const bar = paceGeometry(achievementPct, pacePct);
              const owed = waiting.get(row.userId) ?? { overdue: 0, dueSoon: 0 };
              const logged = loggedBy.get(row.userId) ?? 0;
              const quietCount = quiet.get(row.userId) ?? 0;

              return (
                /* `data-slot` REPLACES `TableRow`'s own marker — `table.tsx`
                   spreads props over it — and that is deliberate here, the
                   `dispatch-row` idiom. `WORKFLOW §5` records the case where
                   the same displacement was a slip, so it is named rather than
                   left to look like one: nothing asserts `table-row` inside
                   this table. */
                <TableRow
                  key={row.userId}
                  data-slot="team-row"
                  data-user={row.userId}
                  data-sqm={formatSqm(row.achievedSqm)}
                  data-target={formatSqm(target)}
                  data-overdue={owed.overdue}
                  data-due-soon={owed.dueSoon}
                  data-logged={logged}
                  data-quiet={quietCount}
                >
                  {/* `dir="auto"` on the NAME, never the cell `D62`. */}
                  <TableCell className="text-start font-medium">
                    <span dir="auto">{row.userName}</span>
                  </TableCell>
                  <TableCell className="text-start">
                    <MiniBar
                      geometry={bar}
                      achievementPct={achievementPct}
                      pacePct={pacePct}
                      label={t("today.team.paceOf", {
                        pct: String(achievementPct),
                      })}
                    />
                  </TableCell>
                  {/* Whole metres, here as everywhere a figure is a sum or a
                      target `D32`. The link is `/targets`' own idiom — the way
                      through to the records the number is made of. `D39` did
                      not ask for it; `DESIGN.md` records the decision. */}
                  <TableCell numeric dir="ltr">
                    <Link
                      href={`/dispatches?userId=${row.userId}`}
                      className="num hover:underline"
                    >
                      {formatSqm(row.achievedSqm)}
                      <span className="text-faint"> / </span>
                      {formatSqm(target)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-start">
                    {/* A `gap`, never a logical margin — the badges carry
                        `dir="ltr"`, and `ms-*` on an element that sets its own
                        direction lands on the wrong side in Arabic
                        (`CLAUDE.md`). */}
                    <span className="flex items-center gap-1.5">
                      <WaitingBadge count={owed.overdue} overdue />
                      <WaitingBadge count={owed.dueSoon} />
                    </span>
                  </TableCell>
                  <TableCell numeric dir="ltr">
                    {logged}
                  </TableCell>
                  {/* **No tone** `D6`. `D39` names a colour for the waiting
                      pair and none here, and no rule says how many quiet
                      companies is too many — a threshold invented in code
                      becomes the number everyone believes in. */}
                  <TableCell numeric dir="ltr">
                    {quietCount}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* `D39`'s footer — **what the table is for and is not.** Two spans:
            the first explains the tick, which is the one element on this table
            nobody would otherwise read; the second is the rule's own sentence.
            **The rule illustrates it with a rep's name and that name is not
            shipped** — it names a real colleague, a static claim about who
            logged most would be false most days, and deriving it would be the
            ranking this rule forbids. `DESIGN.md` records the decision at
            `D39`. */}
        <div
          data-slot="today-team-footer"
          className="text-faint flex flex-wrap justify-between gap-x-6 gap-y-1 text-start text-[11.5px]"
        >
          <span>{t("today.team.tickNote")}</span>
          <span>{t("today.team.notAFormula")}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * `D39`'s small pace bar — `D32`'s bar at table scale. Same fill, same tick,
 * same rescale, and no legend: the figures are the column beside it.
 */
function MiniBar({
  geometry,
  achievementPct,
  pacePct,
  label,
}: {
  geometry: ReturnType<typeof paceGeometry>;
  achievementPct: number;
  pacePct: number;
  label: string;
}) {
  return (
    <div
      data-slot="team-bar"
      data-scale={geometry.scale}
      data-pct={achievementPct}
      // **The pace, not the tick's position.** The position is `pacePct`
      // divided by this row's own scale, so it legitimately differs down the
      // table; the pace itself is one number for the whole screen, and that is
      // the thing a reader can hold every row to `D32`.
      data-pace={pacePct}
      className="bg-surface-2 border-line relative h-[7px] w-32 overflow-hidden rounded-lg border"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.max(0, achievementPct)}
      aria-valuemin={0}
      aria-valuemax={geometry.scale}
    >
      <div
        className="absolute inset-y-0 start-0 rounded-lg bg-(image:--brand-grad)"
        style={{ inlineSize: `${geometry.fillPct}%` }}
      />
      {/* Past the target `D32` — the same fill at lower opacity, so the step is
          the target mark and nothing new is drawn to say where it was. */}
      {geometry.overPct > 0 ? (
        <div
          className="absolute inset-y-0 rounded-e-lg bg-(image:--brand-grad) opacity-45"
          style={{
            insetInlineStart: `${geometry.fillPct}%`,
            inlineSize: `${geometry.overPct}%`,
          }}
        />
      ) : null}
      {/* A 2px bar, never a glow — `D16`'s six are spoken for. Its colour is
          chosen by side, not by outcome, so `D21` stands. */}
      <div
        data-slot="team-tick"
        aria-hidden
        className={cn(
          "absolute inset-y-0 w-0.5",
          geometry.tickOnFill ? "bg-canvas" : "bg-foreground",
        )}
        style={{ insetInlineStart: `calc(${geometry.tickPct}% - 1px)` }}
      />
    </div>
  );
}

/**
 * One of `D39`'s two counts. **Overdue in red, due soon plain** — the rule
 * names both tones, and the red is `D6`'s own: it describes how long something
 * has waited, which is exactly what an overdue row is.
 */
function WaitingBadge({
  count,
  overdue = false,
}: {
  count: number;
  overdue?: boolean;
}) {
  return (
    <b
      data-slot={overdue ? "team-overdue" : "team-due-soon"}
      dir="ltr"
      className={cn(
        "num rounded-[5px] border px-1.5 py-px text-[11px] font-semibold",
        overdue
          ? "bg-tone-red text-tone-red-fg border-tone-red-fg/30"
          : "bg-surface-2 border-line-strong",
      )}
    >
      {count}
    </b>
  );
}
