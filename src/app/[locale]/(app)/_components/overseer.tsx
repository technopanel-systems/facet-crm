import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { AuthSession } from "@/lib/authz";
import { attentionPeople, neverContactedByRep } from "@/lib/coverage";
import { movementOnDay } from "@/lib/audit";
import {
  divideRounded,
  formatSqm,
  formatWholeSqm,
  fromScaled,
  percentOf,
  pow10,
  roundSqm,
  SQM_SCALE,
  toScaled,
  ZERO,
} from "@/lib/decimal";
import { dispatchesInPeriod, listDispatches } from "@/lib/dispatches";
import { listPendingRemovalRequests } from "@/lib/dormancy";
import { listOpenDuplicateFlags } from "@/lib/duplicates";
import type { FollowUpKind } from "@/lib/enums";
import { biggestOpenDeals } from "@/lib/projects";
import { listQuotationThreads } from "@/lib/quotations";
import {
  lastReportDayByRep,
  reportsOnDay,
  riyadhDay,
  today,
} from "@/lib/reports";
import {
  ATTENTION_SILENT_DAYS_DEFAULT,
  ATTENTION_SILENT_DAYS_KEY,
  getPositiveIntSetting,
} from "@/lib/settings";
import type { AchievementRow } from "@/lib/targets";
import { cn } from "@/lib/utils";
import {
  calendarDaysBetween,
  isOpeningWeek,
  previousWorkingDay,
  shiftDays,
} from "@/lib/working-days";

/**
 * The overseer surface — `D64`'s `sees_all_reps` half, built to the approved
 * drawings (`docs/archive/30-overseer-answers.md`): the tab strip `D76`, the
 * band `D77` `D38`, Stuck `D78` (`D40` and `D41` inside), Who needs attention
 * `D79`, Big deals in play `D80`, and the first-run screen `D81`.
 */

/* ------------------------------------------------------------------ *
 * `D76` — the tab strip
 * ------------------------------------------------------------------ */

/**
 * Today · Reports · Team, as plain GET links on the one dashboard `D20`
 * `D28`. The parent renders this only when more than one group qualifies, so
 * a rep and the coordinator never see it. **The Reports pill joined in the
 * slice that built the tab** (session 52) — `D51` kept it off the strip until
 * something stood behind it.
 *
 * Hand-rolled pills rather than `Button`, so the `D74` floor is said here:
 * anything not on `Button`'s base has to carry 44px below `md` itself.
 */
export async function OverseerTabs({
  active,
}: {
  active: "today" | "reports" | "team";
}) {
  const t = await getTranslations();

  const pill = (on: boolean) =>
    cn(
      "inline-flex items-center rounded-full border px-4 py-1.5 text-[13.5px]",
      "max-md:min-h-11 transition-colors",
      on
        ? "border-transparent bg-foreground text-background font-semibold"
        : "border-line-strong text-muted-foreground font-medium hover:bg-surface-2",
    );

  return (
    <nav data-slot="today-tabs" className="flex flex-wrap gap-2">
      <Link
        href="/"
        data-tab="today"
        aria-current={active === "today" ? "page" : undefined}
        className={pill(active === "today")}
      >
        {t("today.tabs.today")}
      </Link>
      <Link
        href="/?tab=reports"
        data-tab="reports"
        aria-current={active === "reports" ? "page" : undefined}
        className={pill(active === "reports")}
      >
        {t("today.tabs.reports")}
      </Link>
      <Link
        href="/?tab=team"
        data-tab="team"
        aria-current={active === "team" ? "page" : undefined}
        className={pill(active === "team")}
      >
        {t("today.tabs.team")}
      </Link>
    </nav>
  );
}

/* ------------------------------------------------------------------ *
 * `D77` — Yesterday, and the band it shares with the company target
 * ------------------------------------------------------------------ */

type DayFigures = {
  day: string;
  sqm: string;
  approvals: number;
  issued: number;
  reports: number;
};

/**
 * One day's movement. Dispatched m² is **the same derivation as the month
 * figure beside it, over one day** — `dispatchesInPeriod` with a one-day
 * window — so the band cannot disagree with itself `D77`. Approvals and
 * issues come from the audit log (`movementOnDay` — an issue has no column),
 * and reports from `report_date`, the day the rep says the work happened.
 */
async function dayFigures(day: string): Promise<DayFigures> {
  const [movement, logged, dispatched] = await Promise.all([
    movementOnDay(day),
    reportsOnDay(day),
    dispatchesInPeriod(day, shiftDays(day, 1)),
  ]);

  let total = ZERO;
  for (const dispatch of dispatched) {
    total += toScaled(dispatch.sqm, SQM_SCALE);
  }

  return {
    day,
    sqm: fromScaled(total, SQM_SCALE),
    approvals: movement.approved,
    issued: movement.issued,
    reports: logged,
  };
}

/**
 * `D77` — the previous working day's four figures, plus Saturday exactly when
 * something happened on one.
 *
 * On a Sunday the working day is Thursday `S93`, and the Saturday between is
 * read too: Saturday is not a working day and nobody is expected to work it,
 * but reps outside Riyadh or working from home sometimes do, and that work
 * must show — **an empty Saturday section never renders** (the founder's
 * answer 7). Friday never renders a section; the answer named Saturday alone.
 */
export async function YesterdayPanel({ solo }: { solo: boolean }) {
  const t = await getTranslations();

  const now = today();
  const figures = await dayFigures(previousWorkingDay(now));

  // The only day a Saturday sits between the previous working day and now is
  // Sunday — on a Saturday itself, "yesterday" is Thursday and today's own
  // work is not yesterday's.
  const isSunday = new Date(`${now}T00:00:00Z`).getUTCDay() === 0;
  const saturday = isSunday ? await dayFigures(shiftDays(now, -1)) : null;
  const saturdayMoved =
    saturday !== null &&
    (saturday.sqm !== "0" ||
      saturday.approvals > 0 ||
      saturday.issued > 0 ||
      saturday.reports > 0);

  return (
    <div data-slot="today-yesterday" data-day={figures.day}>
      <p className="text-faint text-[10.5px] font-semibold tracking-[.09em] uppercase">
        {t("today.yesterday.title")}
      </p>
      <p className="text-muted-foreground text-[12.5px]">
        {t("today.yesterday.subtitle")}
      </p>
      <FigureGrid figures={figures} solo={solo} />
      {saturdayMoved ? (
        <div
          data-slot="yesterday-saturday"
          data-day={saturday.day}
          className="border-line mt-3 border-t pt-3"
        >
          <p className="text-faint text-[10.5px] font-semibold tracking-[.09em] uppercase">
            {t("today.yesterday.saturday")}
          </p>
          <FigureGrid figures={saturday} solo={solo} />
        </div>
      ) : null}
    </div>
  );
}

function FigureGrid({ figures, solo }: { figures: DayFigures; solo: boolean }) {
  return (
    <div
      className={cn(
        "mt-2 grid gap-x-4 gap-y-2.5",
        solo ? "max-w-2xl grid-cols-2 sm:grid-cols-4" : "grid-cols-2",
      )}
    >
      <Figure name="dispatched" value={formatSqm(figures.sqm)} sqm />
      <Figure name="approvals" value={String(figures.approvals)} />
      <Figure name="issued" value={String(figures.issued)} />
      <Figure name="reports" value={String(figures.reports)} />
    </div>
  );
}

async function Figure({
  name,
  value,
  sqm = false,
}: {
  name: "dispatched" | "approvals" | "issued" | "reports";
  value: string;
  sqm?: boolean;
}) {
  const t = await getTranslations();
  return (
    <div data-figure={name} data-value={value}>
      <p className="num text-[19px] leading-tight font-semibold">
        {/* The `dir` isolates the figure inline, so the block keeps the
            page's alignment (`A2-13`). */}
        <span dir="ltr">{value}</span>
        {sqm ? (
          <span className="text-muted-foreground ms-1 font-sans text-[12.5px] font-normal">
            {t("common.sqm")}
          </span>
        ) : null}
      </p>
      <p className="text-muted-foreground text-[12.5px]">
        {t(`today.yesterday.${name}`)}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * `D78` — Stuck
 * ------------------------------------------------------------------ */

/**
 * One full-width block: the things sitting that should be moving.
 *
 * **With the coordinator** is `D40`'s aggregate — the two counts are `D65`'s
 * own sets, fetched exactly as `RequestsBlock` fetches them, and the *oldest*
 * line is the dispatch pile's clock alone (`submitted_at`, the one true
 * wait — `D40` states it so nobody reads it as both piles'). Each pile is
 * suppressed where the reader holds that chain's own flag, so a holder of
 * both gets no coordinator section at all.
 *
 * **Needs a decision (`D41`) is ABSENT** — not zero, not explained: both
 * objects it names have no writer, no rows, and product copy never names
 * unbuilt machinery `D78`.
 *
 * **Untouched too long** always carries its breakdown (the founder's answer
 * 9), read from the follow-up ladder the waiting list already derived — the
 * counts prop is `followUpScope`'s, so this block costs the ladder nothing.
 */
/** `D41`'s rows before *and N more* — `D79`'s cap, one fewer. */
const DECISION_ROWS = 5;

export async function StuckBlock({
  session,
  counts,
}: {
  session: AuthSession;
  counts: Record<FollowUpKind, number>;
}) {
  const t = await getTranslations();

  const watchesIssuing = !session.user.role.canApproveQuotation;
  const watchesDeciding = !session.user.role.canDispatch;
  // `D41` — *Needs a decision*, each half on `S8`'s own flag.
  const decides = session.user.role.canApproveDelete;
  const resolves = session.user.role.canResolveDuplicate;

  const [quotations, dispatchList, removals, duplicates] = await Promise.all([
    watchesIssuing
      ? listQuotationThreads(session, { awaitingIssue: true })
      : Promise.resolve(null),
    watchesDeciding
      ? listDispatches(session, { status: "submitted" })
      : Promise.resolve(null),
    decides ? listPendingRemovalRequests(session) : Promise.resolve(null),
    resolves ? listOpenDuplicateFlags(session) : Promise.resolve(null),
  ]);
  const decisionsWaiting = (removals?.total ?? 0) + (duplicates?.total ?? 0);

  // The submitted pile is oldest-first `S87` `S89`, so the first row IS the
  // oldest — no second query and no second ordering to drift.
  const oldestSubmitted = dispatchList?.rows[0]?.submittedAt ?? null;
  const oldestDays = oldestSubmitted
    ? calendarDaysBetween(riyadhDay(oldestSubmitted), today())
    : null;

  const queueClear =
    (quotations?.total ?? 0) === 0 && (dispatchList?.total ?? 0) === 0;

  // `D78` — the ladder's untouched kinds by anchor. `date_due` is a rep's own
  // plan, not something stuck, and is not counted.
  const companies = counts.company_quiet + counts.catalogue_no_response;
  const projects = counts.project_stage_unchanged;
  const quotationCount =
    counts.quotation_no_response + counts.quotation_returned;
  const untouched = companies + projects + quotationCount;

  return (
    <Card data-slot="today-stuck">
      <CardHeader>
        <CardTitle className="text-start text-sm">
          {t("today.stuck.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-6 gap-y-5">
        {watchesIssuing || watchesDeciding ? (
          <div
            data-slot="stuck-coordinator"
            data-issue={quotations?.total ?? ""}
            data-dispatch={dispatchList?.total ?? ""}
            data-oldest={oldestDays ?? ""}
            className="text-start"
          >
            <p className="text-faint text-[10.5px] font-semibold tracking-[.09em] uppercase">
              {t("today.stuck.coordinator")}
            </p>
            {queueClear ? (
              <p className="mt-1.5 text-[15px] font-semibold">
                {t("today.stuck.clear")}
              </p>
            ) : (
              <>
                {/* `D40` — each count is a way in to the pile's own list.
                    Bare `/quotations` and `/dispatches`, because `D25`'s
                    first group on each IS this pile. `D73` — each run holds
                    a figure and translated words, so it resolves off its own
                    words. */}
                <p className="mt-1.5 text-[15px]">
                  {quotations ? (
                    <Link
                      href="/quotations"
                      data-slot="stuck-way-in"
                      data-chain="quotations"
                      className="hover:underline"
                    >
                      <span dir="auto">
                        {t("today.stuck.toIssue", { count: quotations.total })}
                      </span>
                    </Link>
                  ) : null}
                  {quotations && dispatchList ? " · " : null}
                  {dispatchList ? (
                    <Link
                      href="/dispatches"
                      data-slot="stuck-way-in"
                      data-chain="dispatches"
                      className="hover:underline"
                    >
                      <span dir="auto">
                        {t("today.stuck.requests", {
                          count: dispatchList.total,
                        })}
                      </span>
                    </Link>
                  ) : null}
                </p>
                {oldestDays !== null ? (
                  <p className="text-muted-foreground mt-0.5 text-[12.5px]">
                    {t("today.stuck.oldest", { count: oldestDays })}
                  </p>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {/* `D41` — *Needs a decision*, present since session 54 for the
            holder of `can_approve_delete`: the archive requests `S105`,
            oldest first `S87`, each row a way in to the company where the
            three decisions are. `D79`'s cap and *and N more*; at zero one
            line, `D78`'s own shape. Duplicates join it with `S22`'s
            detector. */}
        {removals || duplicates ? (
          <div
            data-slot="stuck-decisions"
            data-requests={removals?.total ?? ""}
            data-duplicates={duplicates?.total ?? ""}
            className="text-start"
          >
            <p className="text-faint text-[10.5px] font-semibold tracking-[.09em] uppercase">
              {t("today.stuck.decisions")}
            </p>
            {decisionsWaiting === 0 ? (
              <p className="text-muted-foreground mt-1.5 text-[13px]">
                {t("today.stuck.decisionsNone")}
              </p>
            ) : (
              <>
                {/* One line, the two counts each a run of its own `D73`,
                    and a half the reader does not hold is simply absent. */}
                <p className="mt-1.5 text-[15px]">
                  {removals ? (
                    <span dir="auto">
                      {t("today.stuck.removalRequests", { count: removals.total })}
                    </span>
                  ) : null}
                  {removals && duplicates ? " · " : null}
                  {duplicates ? (
                    <span dir="auto">
                      {t("today.stuck.duplicates", { count: duplicates.total })}
                    </span>
                  ) : null}
                </p>
                {duplicates && duplicates.total > 0 ? (
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {duplicates.rows.slice(0, DECISION_ROWS).map((flag) => (
                      <li
                        key={flag.id}
                        data-slot="stuck-duplicate"
                        data-flag={flag.id}
                        className="text-[12.5px]"
                      >
                        <Link
                          href={`/companies/duplicates/${flag.id}`}
                          className="font-medium hover:underline"
                        >
                          <span dir="auto">
                            {t("today.stuck.duplicatePair", {
                              a: flag.a.name,
                              b: flag.b.name,
                            })}
                          </span>
                        </Link>
                        <span className="text-faint"> · </span>
                        <span className="text-muted-foreground" dir="auto">
                          {t("today.stuck.since", {
                            count: calendarDaysBetween(
                              riyadhDay(flag.createdAt),
                              today(),
                            ),
                          })}
                        </span>
                      </li>
                    ))}
                    {duplicates.total > DECISION_ROWS ? (
                      <li className="text-faint text-[12.5px]">
                        <span dir="auto">
                          {t("today.stuck.andMore", {
                            count: duplicates.total - DECISION_ROWS,
                          })}
                        </span>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
                {removals && removals.total > 0 ? (
                  <>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {removals.rows.slice(0, DECISION_ROWS).map((request) => (
                    <li
                      key={request.id}
                      data-slot="stuck-decision"
                      data-company={request.companyId}
                      className="text-[12.5px]"
                    >
                      <Link
                        href={`/companies/${request.companyId}`}
                        className="font-medium hover:underline"
                      >
                        <span dir="auto">{request.companyName}</span>
                      </Link>
                      <span className="text-faint"> · </span>
                      <span className="text-muted-foreground" dir="auto">
                        {t("today.stuck.askedBy", {
                          name: request.requestedByName,
                          count: calendarDaysBetween(
                            riyadhDay(request.createdAt),
                            today(),
                          ),
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
                {removals.total > DECISION_ROWS ? (
                  <p className="text-faint mt-0.5 text-[12.5px]">
                    <span dir="auto">
                      {t("today.stuck.andMore", {
                        count: removals.total - DECISION_ROWS,
                      })}
                    </span>
                  </p>
                ) : null}
                  </>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        <div
          data-slot="stuck-untouched"
          data-total={untouched}
          data-companies={companies}
          data-projects={projects}
          data-quotations={quotationCount}
          className="text-start"
        >
          <p className="text-faint text-[10.5px] font-semibold tracking-[.09em] uppercase">
            {t("today.stuck.untouched")}
          </p>
          {untouched === 0 ? (
            <p className="text-muted-foreground mt-1.5 text-[13px]">
              {t("today.stuck.untouchedNone")}
            </p>
          ) : (
            <>
              <p className="num mt-0.5 text-2xl font-semibold tracking-tight">
                <span dir="ltr">{untouched}</span>
              </p>
              <p className="text-muted-foreground text-[12.5px]">
                <span dir="auto">
                  {t("today.stuck.untouchedBreakdown", {
                    companies,
                    projects,
                    quotations: quotationCount,
                  })}
                </span>
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * `D79` — Who needs attention
 * ------------------------------------------------------------------ */

/**
 * `S138`'s count reaches the block at this floor. The founder named the
 * mechanism, not the floor — `SPEC §16` records it as open, re-raised with
 * pilot data.
 */
const NEVER_CONTACTED_FLOOR = 10;

/** The block caps here with *and N more* `D79`, so it cannot push the page
 *  down without limit. */
const ATTENTION_ROWS = 6;

type AttentionRow = {
  userId: string;
  name: string;
  kind: "silent" | "behind" | "never";
  /** silent — days since the last report, null = never logged at all. */
  days?: number | null;
  /** behind — the gap in whole metres, and the two percentages. */
  gapSqm?: string;
  pct?: number;
  expected?: number;
  /** never — `S138`'s count. */
  count?: number;
};

/**
 * `D79` — the people a manager should ask about today, at most six rows.
 *
 * Three conditions, each derived `S108`, over the active book-holders the
 * reader may see who hold at least one live company (`attentionPeople`):
 * **gone silent** — nothing logged in `attention.silent_days` `S141`;
 * **behind pace** — a target row this month with achievement short of the
 * pace expectation, `D32`'s own arithmetic per person; **never contacted** —
 * `S138`'s per-rep count at the floor above. A person may appear once per
 * condition — two problems are two rows. Silent first (longest first), then
 * behind (largest gap), then never (largest count). When nobody qualifies
 * the block is absent `D70`.
 *
 * **Nobody is behind in the opening week** `D32` `D79` — `isOpeningWeek`,
 * the same line the pace panel reads, so the band and this block cannot
 * disagree about whether the month has started. Silent and never-contacted
 * are unaffected: a rep who has logged nothing for fourteen days is silent
 * whatever the date.
 */
export async function AttentionBlock({
  session,
  attainment,
  pacePct,
  daysWorked,
  daysInMonth,
}: {
  session: AuthSession;
  /** `achievementForPeriod`, already fetched by the page. */
  attainment: AchievementRow[];
  pacePct: number;
  daysWorked: number;
  daysInMonth: number;
}) {
  const t = await getTranslations();

  const people = await attentionPeople(session);
  if (people.length === 0) return null;
  const ids = people.map((person) => person.id);

  const [lastByRep, neverByRep, silentDays] = await Promise.all([
    lastReportDayByRep(ids),
    neverContactedByRep(ids),
    getPositiveIntSetting(
      ATTENTION_SILENT_DAYS_KEY,
      ATTENTION_SILENT_DAYS_DEFAULT,
    ),
  ]);

  const now = today();
  const measuredBy = new Map(attainment.map((row) => [row.userId, row]));
  const opening = isOpeningWeek(daysWorked);

  const silent: AttentionRow[] = [];
  const behindRaw: { row: AttentionRow; gap: bigint }[] = [];
  const never: AttentionRow[] = [];

  for (const person of people) {
    // `S141` — gone silent. A person who never logged is the case at its
    // oldest and sorts first.
    const last = lastByRep.get(person.id);
    const sinceLast = last ? calendarDaysBetween(last, now) : null;
    if (!last || (sinceLast !== null && sinceLast >= silentDays)) {
      silent.push({
        userId: person.id,
        name: person.name,
        kind: "silent",
        days: sinceLast,
      });
    }

    // `D32`'s own arithmetic, per person: the gap subtracts the two
    // whole-metre figures a reader could check by hand, never the rounded
    // percentage.
    const measured = measuredBy.get(person.id);
    if (!opening && measured?.targetSqm != null) {
      const pct = percentOf(measured.achievedSqm, measured.targetSqm, SQM_SCALE);
      const expectedWhole = divideRounded(
        divideRounded(
          toScaled(measured.targetSqm, SQM_SCALE) * BigInt(daysWorked),
          BigInt(daysInMonth),
        ),
        pow10(SQM_SCALE),
      );
      const gap = expectedWhole - roundSqm(measured.achievedSqm);
      if (pct < pacePct && gap > ZERO) {
        behindRaw.push({
          gap,
          row: {
            userId: person.id,
            name: person.name,
            kind: "behind",
            gapSqm: formatWholeSqm(gap),
            pct,
            expected: pacePct,
          },
        });
      }
    }

    const neverCount = neverByRep.get(person.id) ?? 0;
    if (neverCount >= NEVER_CONTACTED_FLOOR) {
      never.push({
        userId: person.id,
        name: person.name,
        kind: "never",
        count: neverCount,
      });
    }
  }

  silent.sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity));
  behindRaw.sort((a, b) => (b.gap > a.gap ? 1 : b.gap < a.gap ? -1 : 0));
  never.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

  const rows = [...silent, ...behindRaw.map((entry) => entry.row), ...never];
  if (rows.length === 0) return null;
  const shown = rows.slice(0, ATTENTION_ROWS);

  return (
    <Card
      data-slot="today-attention"
      data-rows={rows.length}
      // Per-condition tallies, so `verify:routes` §41 can hold each kind to
      // its own SQL without re-deriving the cap — rendered rows stop at six
      // while these count the whole set.
      data-silent={silent.length}
      data-behind={behindRaw.length}
      data-never={never.length}
      data-opening={opening ? "" : undefined}
    >
      <CardHeader>
        <CardTitle className="text-start text-sm">
          {t("today.attention.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col">
        {shown.map((row, index) => (
          <div
            key={`${row.kind}-${row.userId}`}
            data-slot="attention-row"
            data-kind={row.kind}
            data-user={row.userId}
            data-days={row.kind === "silent" ? (row.days ?? "never") : undefined}
            data-count={row.kind === "never" ? row.count : undefined}
            data-gap={row.kind === "behind" ? row.gapSqm : undefined}
            className={cn(
              "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-2.5",
              "md:grid-cols-[10rem_minmax(0,1fr)_auto]",
              index > 0 && "border-line border-t",
            )}
          >
            {/* One name field, either script `D62`. */}
            <p className="min-w-0 font-semibold wrap-break-word">
              <span dir="auto">{row.name}</span>
            </p>
            <p className="text-muted-foreground col-start-1 row-start-2 min-w-0 text-[13px] wrap-break-word md:col-start-2 md:row-start-1">
              <span dir="auto">
                {row.kind === "silent"
                  ? row.days == null
                    ? t("today.attention.silentNever")
                    : t("today.attention.silent", { count: row.days })
                  : row.kind === "behind"
                    ? t("today.attention.behind", {
                        sqm: row.gapSqm ?? "0",
                        pct: String(row.pct ?? 0),
                        expected: String(row.expected ?? 0),
                      })
                    : t("today.attention.never", { count: row.count ?? 0 })}
              </span>
            </p>
            {/* The one door every `sees_all_reps` holder may open — the
                person's own stream. `/users/[id]` is `can_manage_users`'
                door and an executive does not hold it `D79`. Hand-rolled, so
                the `D74` floor is said here. */}
            <Link
              href={`/activity?who=${row.userId}`}
              className="border-line-strong text-muted-foreground hover:bg-surface-2 col-start-2 row-start-1 row-span-2 inline-flex items-center justify-center self-center rounded-full border px-3.5 py-1 text-[12.5px] whitespace-nowrap transition-colors max-md:min-h-11 md:col-start-3 md:row-span-1"
            >
              {t("today.attention.open")}
            </Link>
          </div>
        ))}
        {rows.length > shown.length ? (
          <p
            data-slot="attention-more"
            className="text-muted-foreground border-line border-t pt-2.5 text-[12.5px]"
          >
            {t("today.attention.more", { count: rows.length - shown.length })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * `D80` — Big deals in play
 * ------------------------------------------------------------------ */

/**
 * The biggest five open deals by expected size — the founder's answer 4:
 * never a threshold. Each row is the project's name, its `S132` position as
 * a plain pill (`D6` — no colour), and one line: expected m², how long it
 * has been sitting (`/projects`' own clock `D26`), and its owner. Expected
 * m² is never summed across the rows `D80`. With no open deal the block is
 * absent `D70`.
 */
export async function BigDealsBlock({ session }: { session: AuthSession }) {
  const t = await getTranslations();

  const deals = await biggestOpenDeals(session);
  if (deals.length === 0) return null;

  const now = today();

  return (
    <Card data-slot="today-deals" data-count={deals.length}>
      <CardHeader>
        <CardTitle className="text-start text-sm">
          {t("today.deals.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col">
        {deals.map((deal, index) => {
          const days = calendarDaysBetween(deal.lastMovedOn, now);
          return (
            <div
              key={deal.id}
              data-slot="deal-row"
              data-id={deal.id}
              data-sqm={formatSqm(deal.sqmExpected)}
              data-position={deal.position}
              data-days={days}
              className={cn("py-2.5", index > 0 && "border-line border-t")}
            >
              <div className="flex items-baseline gap-2.5">
                {/* One name field, either script `S26` `D62`; truncation is a
                    laptop necessity and a phone defect `D56`, so it is scoped
                    to `md`. */}
                <p className="min-w-0 flex-1 font-semibold wrap-break-word md:truncate">
                  <Link href={`/projects/${deal.id}`} className="hover:underline">
                    <span dir="auto">{deal.name}</span>
                  </Link>
                </p>
                <span className="bg-surface-2 text-muted-foreground rounded-full px-2.5 py-0.5 text-[12.5px] whitespace-nowrap">
                  {t(`chain.step.${deal.position}`)}
                </span>
              </div>
              <p className="text-muted-foreground mt-0.5 text-[13px]">
                <span dir="auto">
                  {t("today.deals.expected", { sqm: formatSqm(deal.sqmExpected) })}
                </span>
                {" · "}
                <span dir="auto">{t("today.deals.sitting", { count: days })}</span>
                {" · "}
                <span dir="auto">{deal.ownerName}</span>
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * `D81` — the first-run screen
 * ------------------------------------------------------------------ */

/**
 * While the system has never recorded any work — no report, no quotation
 * thread, no dispatch, three empty tables read at query time — the overseer's
 * Today says what to do first instead of a row of zeros: *zeros on day one
 * look broken to a rep who has never seen it working* (the founder's answer
 * 11). The moment any of the three tables holds a row, the real blocks take
 * over; nothing is stored `S108`.
 */
export async function FirstRun() {
  const t = await getTranslations();

  const steps = [
    { key: "companies", href: "/companies/new" },
    { key: "log", href: "/reports/new" },
    // The Team tab is where an overseer sets the month's target `D49`.
    { key: "target", href: "/?tab=team" },
  ] as const;

  return (
    <Card data-slot="today-firstrun">
      <CardHeader>
        <CardTitle className="text-start">{t("today.firstRun.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground max-w-prose text-start text-sm">
          {t("today.firstRun.lede")}
        </p>
        <div className="flex flex-col gap-3">
          {steps.map((step) => (
            <div
              key={step.key}
              className="flex flex-wrap items-center gap-x-4 gap-y-1"
            >
              <Button asChild variant="outline">
                <Link href={step.href}>{t(`today.firstRun.${step.key}`)}</Link>
              </Button>
              <p className="text-muted-foreground text-[12.5px]">
                {t(`today.firstRun.${step.key}Note`)}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
