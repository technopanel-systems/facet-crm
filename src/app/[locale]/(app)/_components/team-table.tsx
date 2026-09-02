import { Fragment } from "react";
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
import {
  attentionPeople,
  bookHolders,
  neverContactedByRep,
  quietCountsByRep,
} from "@/lib/coverage";
import { dailyActivity } from "@/lib/daily-activity";
import { formatSqm, percentOf, SQM_SCALE } from "@/lib/decimal";
import type { FollowUpScope } from "@/lib/follow-ups";
import type { AchievementRow } from "@/lib/targets";
import { cn } from "@/lib/utils";
import { riyadhDayOf, weekStart } from "@/lib/working-days";

import { setTargetAction, setTargetForAction } from "../targets/actions";

import { paceGeometry } from "./pace";
import { TargetRow } from "./target-row";
import { UnlistedTargetForm } from "./unlisted-target";

/**
 * `D39` — **the team table**: one row per person, a small pace bar with the
 * tick, m² dispatched of target, waiting-on-them as two counts, logged this
 * week, quiet companies, and `S138`'s never-contacted count. `D64`'s last
 * block, behind the Team tab `D76`, on `sees_all_reps`.
 *
 * **Activity and target sit side by side and are never combined into a score.**
 * That is the rule's own last clause and it is load-bearing: there is no
 * ranking column, no total row and no composite figure here, and the footer
 * says so in words rather than leaving it to be inferred.
 *
 * ## Which people are rows — the founder's answer 12
 *
 * **Every active book-holder the reader may see who holds at least one live
 * company, plus anyone carrying a target row for the period** (`D39` as
 * amended, `docs/archive/30-overseer-answers.md`). `teamRowSet` below is
 * that sentence: `attentionPeople` is the first set — the same roster *Who
 * needs attention* reads, so the two blocks cannot disagree about who is on
 * the team — and `achievementForPeriod`'s rows with a target are the second.
 * A person with no target **is a row**, with every real figure and a dash
 * where the target and the pace bar would be. Majed holding fourteen
 * companies unseen is what the old row set caused: it measured people
 * against targets, and absence hid him. The only difference between a row
 * with a target and one without is whether achievement can be measured
 * against anything.
 *
 * ## The seven figures, and where each comes from
 *
 * None of them gained a subject parameter, and `scopeForUser` is not called.
 *
 *  1. **The pace bar and its tick** — `paceGeometry`, shared with `D32`'s
 *     signature panel so the overage rescale has one implementation. `pacePct`
 *     is a **prop**: today's position in the month is the same number for every
 *     rep, so the page computes it once and the tick cannot drift down the
 *     table. **A dash where there is no target** — not an empty bar `D53`.
 *  2. **m² of target** — `achievementForPeriod`, passed in. The dashboard
 *     already ran it for the band above. **Zero extra queries.**
 *  3. **Waiting on them** — `followUpScope`, passed in. It is scoped by the
 *     SESSION rather than by "me", so a manager's scope already holds every
 *     rep's rows; this folds it and does not widen it. **Zero extra queries** —
 *     `shellCounts()` had already derived it for the rail's count.
 *  4. **Logged this week** — `dailyActivity` over a Sunday-to-today range. It
 *     counts the stream `D45`, which is the one definition of *logged*.
 *  5. **Quiet companies** — `quietCountsByRep`, one grouped aggregate over the
 *     same `companySilence` subquery `/companies` joins.
 *  6. **Never contacted** — `neverContactedByRep`, `S138`'s manager count,
 *     the same aggregate `D79` reads at its floor. Here the whole figure.
 *
 * **Four calls, and the cost does not grow with the team.** N appears only
 * inside an `inArray`; nothing is asked once per rep.
 *
 * ## Whose row a figure counts on
 *
 * Columns 4, 6 and 7 fold by **live `company_reps` membership** —
 * `FollowUpRow`'s `owners`, *every live rep who could act on it*, which
 * `/follow-ups` already displays. Three consequences, stated rather than
 * discovered: a company shared TO a rep counts on its owner's row; a project
 * with no live company link counts for nobody; and a company with two reps
 * counts on **both** rows, so **the columns do not sum to a company total** —
 * which is consistent with this rule forbidding a total, not a defect.
 *
 * ## The edit control — per row, never in a cell
 *
 * `D49` asks for an edit control per row and `D58` bans inline cell editing;
 * the two are reconciled by the row rather than the cell, exactly as
 * `/targets` did it in `28b`: each person gets a second `<TableRow>` beneath
 * their figures holding `TargetRow`'s native disclosure, for `can_set_targets`
 * alone. The mockup drew an *Edit* column; a control in a cell is the thing
 * `D58` names, and a disclosure beneath the row is what shipped and what
 * `verify:routes` §17 drives.
 */
export async function teamRowSet(
  session: AuthSession,
  attainment: AchievementRow[],
): Promise<AchievementRow[]> {
  const holders = await attentionPeople(session);
  const holding = new Set(holders.map((person) => person.id));
  return attainment.filter(
    (row) => row.targetSqm !== null || holding.has(row.userId),
  );
}

/**
 * `D39`'s two sections — targeted people, then everyone else. A section
 * with nobody in it is not returned, so nothing renders a header over
 * nothing `D70`.
 */
function sections(
  rows: AchievementRow[],
): { group: "targeted" | "holding"; people: AchievementRow[] }[] {
  const targeted = rows.filter((row) => row.targetSqm !== null);
  const holding = rows.filter((row) => row.targetSqm === null);
  return [
    { group: "targeted" as const, people: targeted },
    { group: "holding" as const, people: holding },
  ].filter((section) => section.people.length > 0);
}

export async function TeamTable({
  session,
  rows,
  follow,
  pacePct,
  period,
  maySetTargets,
}: {
  session: AuthSession;
  /** `teamRowSet` — already the `D39` row set, never empty here. */
  rows: AchievementRow[];
  /** `followUpScope`, already derived by `shellCounts()`. */
  follow: FollowUpScope;
  /** `D32`'s expected-to-date, computed once by the page. */
  pacePct: number;
  /** `YYYY-MM-01`, for the edit rows. */
  period: string;
  /** `can_set_targets` `S84` — the edit rows render for the holder alone. */
  maySetTargets: boolean;
}) {
  const t = await getTranslations();

  const ids = rows.map((row) => row.userId);
  const today = riyadhDayOf(new Date());

  const [activity, quiet, never] = await Promise.all([
    // Sunday to today. `weekStart` derives the boundary from `S93`'s weekend
    // rather than choosing one, and `to` is today because nothing can have been
    // logged in the rest of the week.
    dailyActivity(session, { range: { from: weekStart(today), to: today } }),
    quietCountsByRep(ids),
    neverContactedByRep(ids),
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
    <Card data-slot="today-team" data-rows={rows.length}>
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
              <TableHead className="text-start">{t("today.team.rep")}</TableHead>
              <TableHead className="text-start">{t("today.team.pace")}</TableHead>
              <TableHead numeric>{t("today.team.sqm")}</TableHead>
              <TableHead className="text-start">
                {t("today.team.waiting")}
              </TableHead>
              <TableHead numeric>{t("today.team.logged")}</TableHead>
              <TableHead numeric>{t("today.team.quiet")}</TableHead>
              <TableHead numeric>{t("today.team.never")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* `D39`'s two sections (session 54): the people carrying a
                target first, then everyone else holding a live company —
                *a book-holder with no target is a different kind of row*.
                One table, two group rows with their counts, the shape
                `/companies`' groups take; a section nobody is in is absent
                `D70`. The rows arrive ordered by name, so each section keeps
                that order without re-sorting. */}
            {sections(rows).flatMap(({ group, people }) => [
              <TableRow
                key={`group-${group}`}
                data-slot="team-group"
                data-group={group}
                data-count={String(people.length)}
                className="hover:bg-transparent"
              >
                <TableCell colSpan={7} className="text-start">
                  {/* A flex row with a gap, never `ms-*` on the count —
                      the count carries `dir="ltr"` and a logical margin
                      resolves against its OWN direction `D57`. */}
                  <span className="flex items-baseline gap-2">
                    <span className="text-faint text-[10.5px] font-semibold tracking-[.09em] uppercase">
                      {t(`today.team.groups.${group}`)}
                    </span>
                    <span className="text-faint num text-[10.5px]" dir="ltr">
                      {people.length}
                    </span>
                  </span>
                </TableCell>
              </TableRow>,
              ...people.map((row) => {
              const target = row.targetSqm;
              const achievementPct =
                target === null
                  ? null
                  : percentOf(row.achievedSqm, target, SQM_SCALE);
              const owed = waiting.get(row.userId) ?? { overdue: 0, dueSoon: 0 };
              const logged = loggedBy.get(row.userId) ?? 0;
              const quietCount = quiet.get(row.userId) ?? 0;
              const neverCount = never.get(row.userId) ?? 0;

              return (
                <Fragment key={row.userId}>
                  {/* `data-slot` REPLACES `TableRow`'s own marker —
                      `table.tsx` spreads props over it — and that is
                      deliberate here, the `dispatch-row` idiom; `verify:routes`
                      §35 asserts the displacement. The values keep no bottom
                      border when their own control row follows and draws it
                      instead. */}
                  <TableRow
                    data-slot="team-row"
                    data-user={row.userId}
                    data-sqm={formatSqm(row.achievedSqm)}
                    // Empty, never "0", for a person with no target `S83` —
                    // the marker the dash rows carry.
                    data-target={target === null ? "" : formatSqm(target)}
                    data-overdue={owed.overdue}
                    data-due-soon={owed.dueSoon}
                    data-logged={logged}
                    data-quiet={quietCount}
                    data-never={neverCount}
                    className={maySetTargets ? "border-b-0" : undefined}
                  >
                    {/* The name is the way into the person's world — the
                        drill-in is `?rep=` on the same tab `D76` `D28`, so
                        the strip stays and the Team pill stays lit.
                        `dir="auto"` on the NAME, never the cell `D62`. */}
                    {/* A long name WRAPS rather than widening the table into
                        its scroller — a 52-character Arabic name pushed the
                        never-contacted column off the card at 1366 (session
                        53, looked at). `Table` sets `nowrap`; this cell alone
                        lifts it and takes a measure. */}
                    <TableCell className="max-w-56 min-w-36 text-start font-medium whitespace-normal wrap-break-word">
                      <Link
                        href={`/?tab=team&rep=${row.userId}`}
                        data-slot="team-open"
                        className="hover:underline"
                      >
                        <span dir="auto">{row.userName}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-start">
                      {achievementPct === null ? (
                        <NoTarget label={t("today.team.noTarget")} />
                      ) : (
                        <MiniBar
                          geometry={paceGeometry(achievementPct, pacePct)}
                          achievementPct={achievementPct}
                          pacePct={pacePct}
                          label={t("today.team.paceOf", {
                            pct: String(achievementPct),
                          })}
                        />
                      )}
                    </TableCell>
                    {/* Whole metres, here as everywhere a figure is a sum or a
                        target `D32`. The link is `/targets`' own idiom — the
                        way through to the records the number is made of.
                        `D39` did not ask for it; `DESIGN.md` records the
                        decision. A dash for the target and the percentage
                        when there is none: the achieved figure is real
                        whatever it is measured against. */}
                    <TableCell numeric dir="ltr" className="whitespace-nowrap">
                      <Link
                        href={`/dispatches?userId=${row.userId}`}
                        className="num hover:underline"
                      >
                        {formatSqm(row.achievedSqm)}
                      </Link>
                      <span className="text-faint"> / </span>
                      {target === null ? (
                        <NoTarget label={t("today.team.noTarget")} />
                      ) : (
                        <>
                          {formatSqm(target)}
                          <span className="text-faint"> · </span>
                          <span className="text-muted-foreground">
                            {achievementPct}%
                          </span>
                        </>
                      )}
                    </TableCell>
                    <TableCell className="text-start">
                      {/* A `gap`, never a logical margin — each run carries
                          `dir`, and `ms-*` on an element that sets its own
                          direction lands on the wrong side in Arabic
                          (`CLAUDE.md`). */}
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        <WaitingCount count={owed.overdue} overdue />
                        <span className="text-faint">·</span>
                        <WaitingCount count={owed.dueSoon} />
                      </span>
                    </TableCell>
                    <TableCell numeric dir="ltr">
                      {logged}
                    </TableCell>
                    {/* **No tone** `D6` on either count. `D39` names a colour
                        for the waiting pair and none here, and no rule says
                        how many quiet or never-contacted companies is too
                        many — a threshold invented in code becomes the number
                        everyone believes in. `D79`'s floor of 10 is that
                        block's, not this column's. */}
                    <TableCell numeric dir="ltr">
                      {quietCount}
                    </TableCell>
                    <TableCell numeric dir="ltr">
                      {neverCount}
                    </TableCell>
                  </TableRow>
                  {/* `D49`'s per-row edit control, out of the cell `D58`. Bound
                      at THIS call site, one level above the component that
                      calls `useActionState` — bound inside it, a form answers
                      no raw POST at all (`WORKFLOW §5`). */}
                  {maySetTargets ? (
                    <TableRow data-slot="target-edit-row">
                      <TableCell colSpan={7} className="pt-0 text-start">
                        <TargetRow
                          action={setTargetAction.bind(null, row.userId)}
                          period={period}
                          currentSqm={row.targetSqm}
                          label="targets.actions.openTarget"
                          act="target-edit"
                          handle="set-target"
                        />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
              }),
            ])}
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
 * **Set a target for someone not listed** — the one thing `D39`'s row set
 * cannot carry (`D49`, session 53). A rep with no company and no target yet
 * has no row, and `/targets` — where every active person used to be a row —
 * is the book-holder's own screen now. So the holder of `can_set_targets`
 * gets one disclosure beneath the table, offering the active book-holders
 * who have no row this month. **Absent when everybody has one** `D53` `D70`:
 * on the seeded database every holder holds a company, so it does not render.
 */
export async function UnlistedTarget({
  session,
  excludeIds,
  period,
}: {
  session: AuthSession;
  excludeIds: readonly string[];
  period: string;
}) {
  const listed = new Set(excludeIds);
  const people = (await bookHolders(session)).filter(
    (person) => !listed.has(person.id),
  );
  if (people.length === 0) return null;

  return (
    <div data-slot="team-unlisted" data-count={people.length} className="text-start">
      <UnlistedTargetForm
        action={setTargetForAction}
        period={period}
        people={people}
      />
    </div>
  );
}

/**
 * The dash `D39` — *a dash where the target and pace bar would be*. One
 * glyph, `common.none`, with the reason as its accessible name; nothing is
 * drawn that could be read as a bar at zero `D53`.
 */
function NoTarget({ label }: { label: string }) {
  return (
    <span
      data-slot="team-no-target"
      role="img"
      aria-label={label}
      className="text-faint"
    >
      —
    </span>
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
      {/* A 2px bar, never a glow — `D16`'s one is spoken for. Its colour is
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
 * One of `D39`'s two counts, with its word — *9 overdue · 2 due*, the
 * approved drawing's form. **Overdue in red, due soon plain** — the rule
 * names both tones, and the red is `D6`'s own: it describes how long
 * something has waited, which is exactly what an overdue row is. **Zero
 * overdue takes no red**: nothing is waiting, so there is nothing for the
 * colour to describe. A word run, so `dir="auto"` `D73`.
 */
async function WaitingCount({
  count,
  overdue = false,
}: {
  count: number;
  overdue?: boolean;
}) {
  const t = await getTranslations();
  return (
    <span
      data-slot={overdue ? "team-overdue" : "team-due-soon"}
      data-count={count}
      dir="auto"
      className={cn(
        "num text-[12.5px]",
        overdue && count > 0
          ? "text-tone-red-fg font-semibold"
          : "text-muted-foreground",
      )}
    >
      {t(overdue ? "today.team.overdue" : "today.team.dueSoon", { count })}
    </span>
  );
}
