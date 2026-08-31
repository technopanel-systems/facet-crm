import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  divideRounded,
  formatSqm,
  formatWholeSqm,
  percentOf,
  pow10,
  roundSqm,
  SQM_SCALE,
  toScaled,
  ZERO,
} from "@/lib/decimal";
import {
  FOLLOW_UP_GROUP_NAMES,
  FOLLOW_UP_GROUPS,
  type FollowUpKind,
} from "@/lib/enums";
import { quotedCount } from "@/lib/quotations";
import {
  achievementForPeriod,
  companyAchievementForPeriod,
  currentPeriod,
  previousPeriodStart,
} from "@/lib/targets";
import { cn } from "@/lib/utils";
import { isWorkingDay, riyadhDayOf } from "@/lib/working-days";

import { BottleneckCard } from "./_components/bottleneck-card";
import { paceGeometry } from "./_components/pace";
import { RequestsBlock } from "./_components/requests-block";
import { shellCounts } from "./_components/shell-counts";
import { TeamTable } from "./_components/team-table";
import { WaitingList } from "./_components/waiting-list";

export const dynamic = "force-dynamic";

/** How much of Slipping the dashboard shows before deferring to `/follow-ups`. */
const SLIPPING_ROWS = 6;

/** The same, for each of `D65`'s two columns. */
const REQUEST_ROWS = 5;

/**
 * Today `[22 §3]` — the dashboard archetype, and the screen that replaced the
 * system-status page at `/`.
 *
 * **It composes existing modules and writes no query and no predicate of its
 * own.** `followUpScope()`, `achievementForPeriod()`, `quotedCount()`
 * and — inside `D65`'s block — `listQuotationThreads()` and `listDispatches()`
 * are each called exactly as their own screens call them; the follow-ups
 * derivation is shared with the rail through `shellCounts()` so `/` computes it
 * once, and `D34`'s two sections are cut from that one scope rather than from a
 * page of it.
 *
 * **It renders no notifications.** It used to, under `D65`'s heading — 25 rows
 * of *"A decision ended your work"* on a rep's screen — and `D64` names that
 * outright as the block standing in for something else. News belongs to the
 * bell `S92`; work belongs to the list.
 *
 * **There is no sweep to call any more.** `sweepNotifications()` lived on
 * `/notifications` and ran on read because FACET has no scheduler; `S91` deleted
 * the resolution conditions and the digest it existed to produce, so neither
 * screen writes on a read now. This one never did.
 *
 * **It shows no coverage region** `[22 §6.5]`. `coverage()` filters `quietOnly`
 * after paginating, so it returns the quiet companies among the alphabetically
 * first 25 rather than the first 25 quiet companies — a rep whose quiet
 * companies sort late would see an empty panel while nine were genuinely quiet.
 * The `company_quiet` tile below is safe and does render: that number comes from
 * `followUps().counts`, computed over the whole scope rather than over a page.
 *
 * **Scoped, never gated** — like `/follow-ups` and `/companies`' silence
 * section, every identity gets the same screen and the visibility filters
 * decide the rows.
 */
export default async function TodayPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const format = await getFormatter();

  const { session, follow } = await shellCounts();
  const period = currentPeriod();
  const attainment = await achievementForPeriod(session, period);

  // `D64` — the block appears when either flag qualifies it, and `D65`'s two
  // columns then follow their own. Read once here so the page can decide
  // whether the block exists at all before it costs two queries.
  const mayIssue = session.user.role.canApproveQuotation;
  const mayDecide = session.user.role.canDispatch;

  /*
   * `D32`'s expected-to-date, computed ONCE for the whole screen.
   *
   * It is a property of today, never of a person — working days done this month
   * over the working days in it — so the panel below and every row of `D39`'s
   * team table read the same number. Hoisted here when the team table arrived:
   * two callers deriving it separately is how one tick drifts from another on
   * the same screen, and a reader comparing a rep's bar against the company's
   * would have no way to tell which had moved.
   */
  const { worked: daysWorked, total: daysInMonth } = monthWorked(
    riyadhDayOf(new Date()),
  );
  // Two plain integers, so the same helper answers at scale 0.
  const pacePct = percentOf(String(daysWorked), String(daysInMonth), 0);

  /*
   * `D64`'s first block, and the one block a flag **widens** rather than reveals.
   *
   * **`sees_all_reps` reads it at company scope** `D38` — the whole company's
   * dispatched square metres against the company target `S136` — and everybody
   * else reads their own row. It is the same panel either way, not a seventh
   * block, which is why the branch is over what the panel is HANDED and never
   * over which component renders.
   *
   * **A holder's own row is deliberately not read here.** `S136` says a person
   * who sells and holds this flag carries no target of their own: their metres
   * are already inside the company total, so a personal denominator would measure
   * the same work twice. `/targets` and `D39`'s table are per-person by design and
   * still show one if it exists.
   */
  const company = await companyAchievementForPeriod(session, period);
  const mine = attainment.find((row) => row.userId === session.user.id);
  const inScope = company ?? mine;
  // `targetSqm` is null when nothing is set for this scope this month — never
  // "0" — so the panel is absent rather than showing a target of nothing `D64`.
  // For a flag holder that means: no company target, no first block at all.
  const measured = inScope?.targetSqm == null ? undefined : inScope;

  // `D32`'s two side figures cost a second attainment derivation and one
  // unpaginated thread read, so they are fetched only when the panel will
  // actually render. A block that does not qualify is absent `D64`, and absent
  // should also cost nothing on the commonest read in the application.
  //
  // **`quoted` needs no widening**: `quotedCount` filters through
  // `visibleQuotationThreadsFilter`, which is unconstrained for `sees_all_reps`,
  // so a manager's count is already the company's.
  const previous = previousPeriodStart(period);
  const [lastMonth, quoted] = measured
    ? await Promise.all([
        company
          ? companyAchievementForPeriod(session, previous).then(
              (row) => row ?? undefined,
            )
          : achievementForPeriod(session, previous).then((rows) =>
              rows.find((row) => row.userId === session.user.id),
            ),
        quotedCount(session),
      ])
    : [undefined, 0];

  return (
    <div className="flex flex-col gap-6">
      {/* `D69` — the dashboard's first element, above the greeting and above
          `D64`'s first block. Two controls, rendered for everyone whatever
          flags they hold, so there is no condition for `D64` to test. */}
      <div
        data-slot="today-shortcuts"
        className="flex flex-wrap items-center gap-2"
      >
        {/* The only cross-route GET form in the application, so the only one
            that needs an explicit action — and `localePrefix: "always"` means
            that action must carry the locale or Arabic lands on the English
            list. `getPathname` reads the same routing table `Link` does. The
            cast is safe: `[locale]/layout.tsx` `notFound()`s anything else
            before this renders. */}
        <form
          method="get"
          action={getPathname({ href: "/companies", locale: locale as Locale })}
          // The measure is on the FORM, not the input — `flex-1` on a wide
          // screen would stretch to the whole content column and leave the
          // button at the far edge, and the two belong beside each other.
          //
          // **Below `sm` the measure is what broke it** `38c`: `w-full` claims
          // the entire 323px line at 375, so the ~46px Log button wrapped and
          // sat alone on a row of its own — which reads as a control somebody
          // forgot rather than the second half of `D69`'s pair. Below `sm` the
          // form takes the space the button leaves; at `sm` and up the 384px
          // measure is exactly as it was.
          className="flex min-w-0 flex-1 items-center sm:w-full sm:max-w-sm sm:flex-none"
        >
          <Input
            type="search"
            name="q"
            placeholder={t("common.searchPlaceholder")}
            aria-label={t("common.search")}
            className="text-start"
          />
          {/* Not a third control `D69` — nothing renders. A single-field form
              submits on Enter, but this covers IME composition and the mobile
              keyboards that do not fire one. Do not delete it. */}
          <button type="submit" className="sr-only">
            {t("common.search")}
          </button>
        </form>
        <Button asChild>
          <Link href="/reports/new">{t("reports.new")}</Link>
        </Button>
      </div>

      <div className="text-start">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("today.greeting", { name: session.user.name })}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {/* No `dir` on the date — its ar form places itself with U+200F
              marks, and `dir="ltr"` scrambled it (A2-1, `98f1e2e`). */}
          <span>
            {format.dateTime(new Date(), {
              dateStyle: "full",
              timeZone: "Asia/Riyadh",
            })}
          </span>
          {" · "}
          {/* The zero case is its own key, not an ICU `=0` branch:
              `check:messages` reads `{word` as a placeholder name, so a
              literal branch starting with a letter fails parity against an
              Arabic branch starting with an Arabic letter. */}
          {follow.total === 0
            ? t("today.needsYouZero")
            : t("today.needsYou", { count: follow.total })}
        </p>
      </div>

      {measured ? (
        <TargetPanel
          measured={measured}
          lastMonth={lastMonth}
          quoted={quoted}
          scope={company ? "company" : "own"}
          pacePct={pacePct}
          daysWorked={daysWorked}
          daysInMonth={daysInMonth}
          month={format.dateTime(new Date(`${period}T00:00:00Z`), {
            month: "long",
            timeZone: "UTC",
          })}
        />
      ) : null}

      {/* `D64`'s second block, between the target and the waiting list.
          **Absent**, not empty and not disabled `D53`, for anyone holding
          neither flag — which today is every rep and the manager, who reads
          the same two piles as figures instead `D40`. */}
      {mayIssue || mayDecide ? (
        <RequestsBlock session={session} limit={REQUEST_ROWS} locale={locale} />
      ) : null}

      <CountsStrip counts={follow.counts} />

      {/* `D34` takes the **whole** scope: its planned section holds the rows
          that sort last, so a page of the queue would show it empty. */}
      <WaitingList rows={follow.rows} slippingLimit={SLIPPING_ROWS} />

      {/* `D64`'s fourth block, after the waiting list in that rule's fixed
          order. **Gated before it fetches**, the `RequestsBlock` shape above:
          a block that does not qualify is absent `D53`, and absent should also
          cost nothing on the commonest read in the application. `attainment`
          and `follow` are already derived for the two blocks above, so for a
          `sees_all_reps` identity this adds two calls and for everyone else it
          adds none. */}
      {session.user.role.seesAllReps ? (
        <TeamTable
          session={session}
          attainment={attainment}
          follow={follow}
          pacePct={pacePct}
        />
      ) : null}

      {/* `D64`'s fifth block, after the team table in that rule's fixed order
          and on the same flag `D40`. **Gated before it fetches**, and gated on
          more than the flag: a tile is suppressed where the reader holds that
          chain's own flag, so an identity holding BOTH gets no card at all
          rather than a weaker copy of `D65`'s block sitting above it. The
          manager holds neither and gets both tiles. `D53` — absent, not
          disabled and not empty. */}
      {session.user.role.seesAllReps && (!mayIssue || !mayDecide) ? (
        <BottleneckCard session={session} />
      ) : null}
    </div>
  );
}

/**
 * `D33` — **a plain quartered row inside one card, not four KPI cards.**
 *
 * **Four tiles over six conditions, and no condition is dropped.** The two
 * pairs live in `FOLLOW_UP_GROUPS`; this sums the counts the derivation
 * already returned and adds none of its own. Six equal-weight tiles is what
 * `D21` names outright, and it is what stood here — six bordered `card-face`
 * links, which was also four cards too many.
 *
 * **Each tile links into the waiting list, filtered to its own kinds** `D33`.
 * The link carries `?group=`, not `?kind=`, because two of the four cover two
 * kinds and a tile showing 9 must land on a list of 9.
 *
 * **The rules are drawn by the cells, not the container** `D61` — the strip
 * wraps to two rows on a laptop, and a container-drawn grid paints the empty
 * track as a solid block. The wrapper clips the first cell's outer edges.
 *
 * `S89`'s fifth condition — a dispatch request sitting with the coordinator —
 * is deliberately absent: `D33` puts it in `D65`'s block, where it can be
 * acted on, rather than in a count.
 */
async function CountsStrip({
  counts,
}: {
  counts: Record<FollowUpKind, number>;
}) {
  const t = await getTranslations();

  return (
    <Card data-slot="today-counts" className="overflow-hidden py-0">
      <div className="-ms-px -mt-px grid grid-cols-2 lg:grid-cols-4">
        {FOLLOW_UP_GROUP_NAMES.map((group) => {
          const total = FOLLOW_UP_GROUPS[group].reduce(
            (sum, kind) => sum + counts[kind],
            0,
          );
          return (
            <Link
              key={group}
              href={`/follow-ups?group=${group}`}
              data-slot="today-count"
              data-group={group}
              data-count={total}
              className="border-line hover:bg-surface-2 border-s border-t px-4 py-4 text-start transition-colors"
            >
              <p className="text-faint text-[10.5px] font-semibold tracking-[.09em] uppercase">
                {t(`today.counts.${group}`)}
              </p>
              {/* `dir` on the inline run, never the block `p` — a block's
                  `text-align: start` resolves against its OWN direction, so
                  the number pinned to the tile's LEFT edge in Arabic, a tile's
                  width from its label (`A2-13`). */}
              <p className="num mt-1.5 text-2xl font-semibold tracking-tight">
                <span dir="ltr">{total}</span>
              </p>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

/**
 * How much of the month has been **worked**, and how much of it there is —
 * `D32`.
 *
 * **Working days, not calendar days.** A rep dispatches Sunday to Thursday, so
 * a calendar denominator would show them slipping every weekend and catching up
 * every Monday for no real reason. `isWorkingDay` is the one definition of
 * which days those are `S87`, `D35`; the panel does not get a second answer.
 *
 * **Today counts**, and that is what makes the fraction reach 100% on the last
 * working day. Counting only the days already finished tops out below it, and
 * the last day of every month would read *ahead of pace* while the rep was
 * short. It then **holds at 100% through any trailing Friday and Saturday**.
 *
 * **No public holiday is skipped**, because `working-days.ts` skips none and
 * records a holiday calendar as `OPEN — not chosen` `[21 §8]`. Through Eid the
 * fraction advances while nothing ships. A calendar denominator is equally
 * blind, so this is not a cost of counting working days — `WORKFLOW §5` carries
 * the row.
 */
function monthWorked(today: string): { worked: number; total: number } {
  const [year, month, dayOfMonth] = today.split("-").map(Number);
  // Day 0 of the next month is the last day of this one.
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();

  let worked = 0;
  let total = 0;
  for (let day = 1; day <= days; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!isWorkingDay(date)) continue;
    total += 1;
    if (day <= dayOfMonth) worked += 1;
  }
  // A month with no working day cannot exist. The floor is here so a division
  // can never be by zero, not because the case is reachable.
  return { worked, total: Math.max(1, total) };
}

/**
 * `D32` — the target with a pace line.
 *
 * **Every figure here is scaled `bigint`.** A target multiplied by a float is
 * exactly what `src/lib/decimal.ts` exists to prevent, and a square-metre
 * number the business is measured on must not pass through one. The single
 * float in this panel is the tick's CSS position, which is presentation and
 * never feeds a displayed figure.
 *
 * **The gap is subtracted from the figures on screen**, not from the raw
 * decimals and not from the percentage: 675 − 655 is 20, so a rep checking the
 * arithmetic off the screen gets the same number back. 800 × 82% is 656, not
 * 655, because the percentage is itself rounded — it is display-only, and this
 * is why the gap is not derived from it.
 */
async function TargetPanel({
  measured,
  lastMonth,
  quoted,
  month,
  scope,
  pacePct,
  daysWorked,
  daysInMonth,
}: {
  /**
   * **The two fields this panel actually reads, and nothing more.**
   *
   * It never touched `userId`, `userName` or the three breakdown figures, so
   * narrowing the prop from `AchievementRow` is what lets `D38` be literal: one
   * component serves both scopes, and there is no copy to drift. `AchievementRow`
   * and `CompanyAttainment` both satisfy it structurally.
   */
  measured: PanelFigures;
  lastMonth: PanelFigures | undefined;
  quoted: number;
  month: string;
  /** `D38` — which question this panel is answering. A DOM marker rather than a
   *  tone or a layout change: the panel is the same one either way. */
  scope: "own" | "company";
  /** Computed once by the page, so `D39`'s table cannot draw a different
   *  tick from this panel's. */
  pacePct: number;
  daysWorked: number;
  daysInMonth: number;
}) {
  const t = await getTranslations();

  const target = measured.targetSqm ?? "0";
  const worked = daysWorked;
  const total = daysInMonth;

  const achievementPct = percentOf(measured.achievedSqm, target, SQM_SCALE);

  // The target's share of the month, rounded to whole metres exactly as the
  // achieved figure beside it is — so the gap subtracts the two numbers the
  // rep can actually read off the screen.
  const expectedWhole = divideRounded(
    divideRounded(toScaled(target, SQM_SCALE) * BigInt(worked), BigInt(total)),
    pow10(SQM_SCALE),
  );
  const gap = roundSqm(measured.achievedSqm) - expectedWhole;

  // `D6` is untouched: no tone on any of the three. Ahead-of-pace is an
  // outcome, and colour in FACET describes how long something has waited,
  // never how good the outcome is. The words carry the meaning.
  const paceKey =
    gap > ZERO
      ? "today.target.pace.ahead"
      : gap < ZERO
        ? "today.target.pace.behind"
        : "today.target.pace.onPace";

  const lastMonthPct =
    lastMonth && lastMonth.targetSqm
      ? percentOf(lastMonth.achievedSqm, lastMonth.targetSqm, SQM_SCALE)
      : null;

  return (
    <Card data-slot="today-target" data-scope={scope}>
      <CardHeader>
        <CardTitle className="text-start text-sm">
          {/* **The words say which scope this is, and the panel does not
              otherwise change.** `D38` asks for the same signature panel read
              wider — that is about the panel, not its title — and a manager who
              cannot tell whose 5,082 he is reading is exactly the confusion
              `25a` surfaced: two correct figures answering different questions,
              indistinguishable on screen. */}
          {t(
            scope === "company"
              ? "today.target.labelCompany"
              : "today.target.label",
            { month },
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="num text-start text-3xl font-semibold tracking-tight">
            <span
              data-slot="today-achieved"
              data-sqm={formatSqm(measured.achievedSqm)}
              dir="ltr"
            >
              {formatSqm(measured.achievedSqm)}
            </span>
            <span className="text-muted-foreground ms-1.5 font-sans text-sm font-medium">
              {t("common.sqm")}
            </span>
          </p>
          <p
            data-slot="today-target-sqm"
            data-sqm={formatSqm(target)}
            className="num text-muted-foreground text-end text-sm"
          >
            {/* `D73` — *of 800 m²* / *من ٨٠٠ م²*: a translated word and a
                figure in one run, so it resolves off the word. Under
                `dir="ltr"` the Arabic read with its parts the wrong way
                round, which is the `28b` defect the rule was written from. */}
            <span dir="auto">
              {t("today.target.of", { target: formatSqm(target) })}
            </span>
          </p>
        </div>

        {/* Both percentages end up on screen — what has been achieved, and
            what the month expects by now. 84% means nothing on its own. */}
        <p
          data-slot="today-pace"
          data-pct={pacePct}
          data-gap={formatWholeSqm(gap < ZERO ? -gap : gap)}
          className="text-muted-foreground text-start text-[12.5px]"
        >
          {t(paceKey, {
            pct: String(pacePct),
            sqm: formatWholeSqm(gap < ZERO ? -gap : gap),
          })}
        </p>

        <Progress
          achievementPct={achievementPct}
          pacePct={pacePct}
          target={formatSqm(target)}
        />

        <div
          data-slot="today-side"
          className="border-line mt-1 flex flex-wrap gap-x-10 gap-y-3 border-t pt-3 text-start"
        >
          {/* A COUNT, never a sum `S68` — one project quoted three times at
              2,000 m² is the same 2,000 counted three times. `name` gives
              `verify:routes` §40 the handle it pairs against `/quotations`'
              own rows — the tile was dispatch-blind once (`A2-5`) and nothing
              could read it. */}
          <SideFigure
            name="quoted"
            label={t("today.target.quoted")}
            value={String(quoted)}
            detail={t("today.target.quotedUnit")}
          />
          <SideFigure
            label={t("today.target.lastMonth")}
            value={formatSqm(lastMonth?.achievedSqm ?? "0")}
            detail={
              lastMonth?.targetSqm && lastMonthPct !== null
                ? t("today.target.lastMonthOf", {
                    pct: String(lastMonthPct),
                    target: formatSqm(lastMonth.targetSqm),
                  })
                : undefined
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * What `D32`'s panel reads, and the whole of it.
 *
 * A person's row `S83` and the company's figure `S136` are different decisions
 * over different tables, and this is the shape they have in common — which is why
 * `D38` can be *the same signature panel read wider* rather than a second one.
 * `null` is *not measured*, never zero `D32`.
 */
type PanelFigures = { targetSqm: string | null; achievedSqm: string };

/** `D32`'s two small figures, beneath the bar. `D12`'s section label, then the
 *  figure, then one line of what it is measured against. */
function SideFigure({
  name,
  label,
  value,
  detail,
}: {
  /** A stable DOM handle (`data-side`) — the label is translated and cannot
   *  identify the figure to a script; `Fact`'s `name` is the same device. */
  name?: string;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div data-side={name}>
      <p className="text-faint text-[10.5px] font-semibold tracking-[.09em] uppercase">
        {label}
      </p>
      {/* Same as the counts strip: the `dir` isolates the figure inline, so
          the block keeps the page's alignment (`A2-13`). */}
      <p className="num mt-1 text-[17px] font-semibold">
        <span dir="ltr">{value}</span>
      </p>
      {detail ? (
        <p className="text-muted-foreground text-[11.5px]">{detail}</p>
      ) : null}
    </div>
  );
}

/**
 * The attainment bar and `D32`'s pace tick.
 *
 * **8px, `--radius-lg` ends, `--brand-grad` fill** — `D15`'s third use, in the
 * `bg-(image:…)` form the primary button already uses. No bloom: `D16` permits
 * one on this fill and nothing requires it.
 *
 * **The tick is a 2px bar, never a glow** — `D16`'s six are spoken for. It
 * takes `--text` on the empty track and `--canvas` inside the fill, because one
 * colour cannot read against both a translucent inset and a saturated
 * red-orange gradient in both themes. That is one ternary off a comparison the
 * panel already makes, not a new effect, so `D21` is untouched.
 *
 * **The percentage is never clamped**, and since `D32`'s overage rule the fill
 * is not clamped either — it is **rescaled**. 819 of 800 used to draw exactly
 * the same full bar as 800 of 800, so the one thing a rep most wants to see
 * was the one thing the bar could not say.
 *
 * **The track's scale is the target until achievement passes it**, and then it
 * is the achievement. The solid fill runs to where the target sits; the excess
 * continues past it in the same `--brand-grad` at lower opacity. That is not a
 * seventh use of the gradient `D15` — it is the target bar's fill, continued,
 * and the opacity step is what marks where the target was.
 *
 * **The tick divides by the same scale**, or the pace mark would drift off the
 * day it means the moment a rep went past target.
 *
 * **The legend's end stays the target through all of it.** The scale is
 * geometry; the axis still measures the target, and a bar labelled with its own
 * achievement reads as on-target at every figure.
 */
function Progress({
  achievementPct,
  pacePct,
  target,
}: {
  achievementPct: number;
  pacePct: number;
  target: string;
}) {
  // **The geometry is `paceGeometry`'s and not restated here** — `D39`'s team
  // table draws the same bar at a smaller size, and a second copy of the
  // rescale is how the two start disagreeing about where the target sits.
  const reached = Math.max(0, achievementPct);
  const { scale, fillPct, overPct, tickPct, tickOnFill } = paceGeometry(
    achievementPct,
    pacePct,
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div
        data-slot="today-bar"
        // What 100% of the track means — the target, or the achievement once
        // it has outgrown it. The tick divides by this, so a reader asserting
        // the tick's position has the same number the panel used.
        data-scale={scale}
        className="bg-surface-2 border-line relative h-2 overflow-hidden rounded-lg border"
        role="progressbar"
        // The real figure against the real scale, so a screen reader hears
        // "819 of 800" rather than the clamped 100 the bar used to report.
        aria-valuenow={reached}
        aria-valuemin={0}
        aria-valuemax={scale}
      >
        <div
          className="absolute inset-y-0 start-0 rounded-lg bg-(image:--brand-grad)"
          style={{ inlineSize: `${fillPct}%` }}
        />
        {/* Past the target `D32`. Same fill, lower opacity — the step is the
            target mark, so nothing new is drawn to say where it was. */}
        {overPct > 0 ? (
          <div
            data-slot="today-overage"
            data-pct={achievementPct}
            className="absolute inset-y-0 rounded-e-lg bg-(image:--brand-grad) opacity-45"
            style={{
              insetInlineStart: `${fillPct}%`,
              inlineSize: `${overPct}%`,
            }}
          />
        ) : null}
        <div
          data-slot="today-tick"
          aria-hidden
          className={cn(
            "absolute inset-y-0 w-0.5",
            tickOnFill ? "bg-canvas" : "bg-foreground",
          )}
          style={{ insetInlineStart: `calc(${tickPct}% - 1px)` }}
        />
      </div>
      {/* The concept's `.legend`: mono, faint, the scale under the bar. **The
          end is the TARGET, always** — that is what the axis means, and the
          overage is the segment drawn past it. Reading the achievement there
          made the bar say 963 of 963, which is every rep exactly on target. */}
      {/* No `dir` on the container — it lays out three children, and forcing
          it LTR ran the axis against its own bar in Arabic (`A2-11`): the fill
          anchors at inline-start, so the legend must read from the same edge.
          Each figure isolates itself instead. */}
      <div className="num text-faint flex justify-between text-[11px]">
        <span dir="ltr">0</span>
        <span dir="ltr">{achievementPct}%</span>
        <span data-slot="today-legend-end" dir="ltr">
          {target}
        </span>
      </div>
    </div>
  );
}
