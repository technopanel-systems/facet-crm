import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  FOLLOW_UP_GROUP_NAMES,
  FOLLOW_UP_GROUPS,
  type FollowUpKind,
} from "@/lib/enums";
import { quotedCount } from "@/lib/quotations";
import { isRollupPeriod, rollupFor, rollupPeriod } from "@/lib/rollup";
import {
  achievementForPeriod,
  companyAchievementForPeriod,
  currentPeriod,
  previousPeriodStart,
} from "@/lib/targets";
import { systemHasWork } from "@/lib/timeline";
import { isWorkingDay, riyadhDayOf } from "@/lib/working-days";
import { percentOf } from "@/lib/decimal";

import {
  AttentionBlock,
  BigDealsBlock,
  FirstRun,
  OverseerTabs,
  StuckBlock,
  YesterdayPanel,
} from "./_components/overseer";
import { RequestsBlock } from "./_components/requests-block";
import { RollupBody, RollupPeriodNav } from "./_components/rollup";
import { shellCounts } from "./_components/shell-counts";
import { TargetBody, TargetPanel } from "./_components/target-panel";
import { TeamTable } from "./_components/team-table";
import { WaitingList } from "./_components/waiting-list";

export const dynamic = "force-dynamic";

/** How much of Slipping the dashboard shows before deferring to `/follow-ups`. */
const SLIPPING_ROWS = 6;

/** The same, for each of `D65`'s two columns. */
const REQUEST_ROWS = 5;

/**
 * Today `[22 §3]` — the dashboard archetype, one screen of blocks `D64`.
 *
 * **The page is one dashboard partitioned by the book-holder test** — the
 * session-side reading of `companyBookHolderFilter` (`S9`'s four holding
 * roles, `authz`'s documented proxy). A book holder gets the personal queue:
 * greeting, own target, requests, counts strip, waiting list. An overseer
 * gets the overseer surface the dashboard conversation decided
 * (`docs/archive/30-overseer-answers.md`): the tab strip `D76`, the band
 * `D77` `D38`, Stuck `D78`, attention `D79`, big deals `D80` — and **no
 * waiting list, no counts strip, no personal greeting** (`D64`'s session-50
 * narrowing, the founder's words: *their dashboard is for overseeing, not
 * for their own queue*). A manager's personal customers stay where a rep's
 * are — on Companies and Follow-ups.
 *
 * **It composes existing modules and writes no query and no predicate of its
 * own.** `followUpScope()`, `achievementForPeriod()`, `quotedCount()` and the
 * blocks' own fetches are each called exactly as their own screens call them;
 * the follow-ups derivation is shared with the rail through `shellCounts()`
 * so `/` computes it once.
 *
 * **Scoped, never gated** — every identity gets the same page and the flags
 * decide the blocks `D64`.
 */
export default async function TodayPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; period?: string }>;
}) {
  const { locale } = await params;
  const { tab, period: periodParam } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations();
  const format = await getFormatter();

  const { session, follow } = await shellCounts();
  const period = currentPeriod();
  const attainment = await achievementForPeriod(session, period);

  // `D64` — the requests block appears when either flag qualifies it, and
  // `D65`'s two columns then follow their own.
  const mayIssue = session.user.role.canApproveQuotation;
  const mayDecide = session.user.role.canDispatch;

  // `D64`'s book-holder partition, session-side: `companyBookHolderFilter`
  // is `seesAllReps = false`, asked here of the reader's own role.
  const overseer = session.user.role.seesAllReps;

  /*
   * `D32`'s expected-to-date, computed ONCE for the whole screen.
   *
   * It is a property of today, never of a person — working days done this month
   * over the working days in it — so every pace bar and `D79`'s behind-pace
   * rows read the same number, and no two ticks on one screen can disagree.
   */
  const { worked: daysWorked, total: daysInMonth } = monthWorked(
    riyadhDayOf(new Date()),
  );
  // Two plain integers, so the same helper answers at scale 0.
  const pacePct = percentOf(String(daysWorked), String(daysInMonth), 0);

  const month = format.dateTime(new Date(`${period}T00:00:00Z`), {
    month: "long",
    timeZone: "UTC",
  });

  /* ------------------------------------------------------------------ *
   * The book holder's screen — `D64`'s no-flag case, unchanged shape
   * ------------------------------------------------------------------ */

  if (!overseer) {
    const mine = attainment.find((row) => row.userId === session.user.id);
    // `targetSqm` is null when nothing is set for this person this month —
    // never "0" — so the panel is absent rather than showing a target of
    // nothing `D32` `D64`.
    const measured = mine?.targetSqm == null ? undefined : mine;

    // `D32`'s two side figures cost a second attainment derivation and one
    // unpaginated thread read, so they are fetched only when the panel will
    // actually render `D64`.
    const previous = previousPeriodStart(period);
    const [lastMonth, quoted] = measured
      ? await Promise.all([
          achievementForPeriod(session, previous).then((rows) =>
            rows.find((row) => row.userId === session.user.id),
          ),
          quotedCount(session),
        ])
      : [undefined, 0];

    return (
      <div className="flex flex-col gap-6">
        <Shortcuts locale={locale} />

        <div className="text-start" data-slot="today-greeting">
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
            scope="own"
            pacePct={pacePct}
            daysWorked={daysWorked}
            daysInMonth={daysInMonth}
            month={month}
          />
        ) : null}

        {/* `D64`'s second block. **Absent**, not empty and not disabled
            `D53`, for anyone holding neither flag. */}
        {mayIssue || mayDecide ? (
          <RequestsBlock session={session} limit={REQUEST_ROWS} locale={locale} />
        ) : null}

        <CountsStrip counts={follow.counts} />

        {/* `D34` takes the **whole** scope: its planned section holds the rows
            that sort last, so a page of the queue would show it empty. */}
        <WaitingList rows={follow.rows} slippingLimit={SLIPPING_ROWS} />
      </div>
    );
  }

  /* ------------------------------------------------------------------ *
   * The overseer surface — `D64`'s `sees_all_reps` half `D76`–`D81`
   * ------------------------------------------------------------------ */

  const activeTab =
    tab === "team" ? "team" : tab === "reports" ? "reports" : "today";

  // `D76` — the Reports tab: `D42`'s rollup over `?period=` `D20`, read
  // company-wide for `sees_all_reps` and nothing else `D53`. A rep typing
  // `?tab=reports` by hand never reaches this branch — the book-holder
  // screen above returned first, and the tab is a grouping of flag-qualified
  // blocks, never a door past the flags.
  if (activeTab === "reports") {
    const key = isRollupPeriod(periodParam) ? periodParam : "month";
    const span = rollupPeriod(key);
    const rollup = await rollupFor(session, span);
    return (
      <div className="flex flex-col gap-6">
        <Shortcuts locale={locale} />
        <OverseerTabs active="reports" />
        <RollupPeriodNav active={key} />
        {rollup ? <RollupBody rollup={rollup} locale={locale} /> : null}
      </div>
    );
  }

  if (activeTab === "team") {
    const targeted = attainment.filter((row) => row.targetSqm !== null);
    return (
      <div className="flex flex-col gap-6">
        <Shortcuts locale={locale} />
        <OverseerTabs active="team" />
        {targeted.length > 0 ? (
          <TeamTable
            session={session}
            attainment={attainment}
            follow={follow}
            pacePct={pacePct}
          />
        ) : (
          // `D52` — an empty state says what would make it non-empty and
          // offers the action; outside a card, where a bare shell would read
          // as broken `D60`.
          <div className="text-start">
            <p className="text-muted-foreground text-sm">
              {t("today.teamEmpty")}
            </p>
            <Button asChild variant="outline" className="mt-3">
              <Link href="/targets">{t("nav.targets")}</Link>
            </Button>
          </div>
        )}
      </div>
    );
  }

  // `D81` — three empty tables mean a first-run screen, not a row of zeros.
  const hasWork = await systemHasWork();

  if (!hasWork) {
    return (
      <div className="flex flex-col gap-6">
        <Shortcuts locale={locale} />
        <OverseerTabs active="today" />
        <FirstRun />
      </div>
    );
  }

  // `D38` — the company target, `S136`'s figure. Null target means the band's
  // target half is absent and Yesterday takes the row alone `D77` `D53`.
  const company = await companyAchievementForPeriod(session, period);
  const measured = company?.targetSqm == null ? undefined : company;

  const previous = previousPeriodStart(period);
  const [lastMonth, quoted] = measured
    ? await Promise.all([
        companyAchievementForPeriod(session, previous).then(
          (row) => row ?? undefined,
        ),
        quotedCount(session),
      ])
    : [undefined, 0];

  return (
    <div className="flex flex-col gap-6">
      <Shortcuts locale={locale} />
      <OverseerTabs active="today" />

      {/* `D77` — one band: the company target at the inline start, Yesterday
          at the inline end; with no company target, Yesterday alone. */}
      <Card data-slot="today-band">
        <CardContent>
          {measured ? (
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_19rem]">
              <div data-slot="today-target" data-scope="company">
                <p className="text-faint mb-2 text-[10.5px] font-semibold tracking-[.09em] uppercase">
                  {t("today.target.labelCompany", { month })}
                </p>
                <TargetBody
                  measured={measured}
                  lastMonth={lastMonth}
                  quoted={quoted}
                  pacePct={pacePct}
                  daysWorked={daysWorked}
                  daysInMonth={daysInMonth}
                />
              </div>
              <div className="border-line border-t pt-4 md:border-s md:border-t-0 md:ps-6 md:pt-0">
                <YesterdayPanel solo={false} />
              </div>
            </div>
          ) : (
            <YesterdayPanel solo />
          )}
        </CardContent>
      </Card>

      {/* `D64`'s requests block, for an overseer who also holds a queue flag
          — the super admin. Absent for the manager and the executive `D53`. */}
      {mayIssue || mayDecide ? (
        <RequestsBlock session={session} limit={REQUEST_ROWS} locale={locale} />
      ) : null}

      {/* `D78` — Stuck, full width. */}
      <StuckBlock session={session} counts={follow.counts} />

      {/* `D79` and `D80`, side by side — the two blocks that grow together
          as data arrives, so the hole closes rather than opens. */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <AttentionBlock
          session={session}
          attainment={attainment}
          pacePct={pacePct}
          daysWorked={daysWorked}
          daysInMonth={daysInMonth}
        />
        <BigDealsBlock session={session} />
      </div>
    </div>
  );
}

/**
 * `D69` — the dashboard's first element, above everything. Two controls,
 * rendered for everyone whatever flags they hold, so there is no condition
 * for `D64` to test.
 */
async function Shortcuts({ locale }: { locale: string }) {
  const t = await getTranslations();
  return (
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
 * which days those are `S87`; the panel does not get a second answer.
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
