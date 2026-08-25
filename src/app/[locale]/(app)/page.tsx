import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { RecordRow } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
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
import { FOLLOW_UP_KINDS } from "@/lib/enums";
import { lookupName } from "@/lib/lookups";
import { listNotifications } from "@/lib/notifications";
import { awaitingSignatureCount } from "@/lib/quotations";
import {
  achievementForPeriod,
  currentPeriod,
  previousPeriodStart,
  type AchievementRow,
} from "@/lib/targets";
import { cn } from "@/lib/utils";
import { isWorkingDay, riyadhDayOf } from "@/lib/working-days";

import { anchorHref } from "./_components/anchors";
import { shellCounts } from "./_components/shell-counts";
import { toneClass, turnTone } from "./_components/turn";

export const dynamic = "force-dynamic";

/** How much of the queue the dashboard shows before deferring to `/follow-ups`. */
const QUEUE_ROWS = 6;

/**
 * Today `[22 §3]` — the dashboard archetype, and the screen that replaced the
 * system-status page at `/`.
 *
 * **It composes existing modules and writes no query and no predicate of its
 * own.** `followUps()`, `unresolvedCount()`, `listNotifications()`,
 * `achievementForPeriod()` and `awaitingSignatureCount()` are each called
 * exactly as their own screens call them; the follow-ups derivation is shared
 * with the rail through `shellCounts()` so `/` computes it once.
 *
 * **It does not call `sweepNotifications()`.** That is a write path and it stays
 * on `/notifications`, where it already lives. The home page is the commonest
 * read in the application and must not change how often the sweep runs.
 *
 * **It shows no coverage region** `[22 §6.5]`. `coverage()` filters `quietOnly`
 * after paginating, so it returns the quiet companies among the alphabetically
 * first 25 rather than the first 25 quiet companies — a rep whose quiet
 * companies sort late would see an empty panel while nine were genuinely quiet.
 * The `company_quiet` tile below is safe and does render: that number comes from
 * `followUps().counts`, computed over the whole scope rather than over a page.
 *
 * **Scoped, never gated** — like `/follow-ups` and `/performance`'s coverage
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
  const [attainment, notifications] = await Promise.all([
    achievementForPeriod(session, period),
    listNotifications(session, { page: 1 }),
  ]);

  // `sees_all_reps` gets every measured rep back; everyone else gets exactly
  // their own row. Either way the panel is about the person reading it.
  const mine = attainment.find((row) => row.userId === session.user.id);
  // `targetSqm` is null when this identity is not measured this month — never
  // "0" — so the panel is absent rather than showing a target of nothing `D64`.
  const measured = mine && mine.targetSqm !== null ? mine : undefined;

  // `D32`'s two side figures cost a second attainment derivation and one
  // unpaginated thread read, so they are fetched only when the panel will
  // actually render. A block that does not qualify is absent `D64`, and absent
  // should also cost nothing on the commonest read in the application.
  const [lastMonth, awaitingSignature] = measured
    ? await Promise.all([
        achievementForPeriod(session, previousPeriodStart(period)).then(
          (rows) => rows.find((row) => row.userId === session.user.id),
        ),
        awaitingSignatureCount(session),
      ])
    : [undefined, 0];

  // The same one definition the bell and `/notifications` read `[21 §4]`.
  const waiting = notifications.rows.filter((row) => row.waiting);

  const queue = follow.rows.slice(0, QUEUE_ROWS);

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
          // The measure is on the FORM, not the input: `flex-1` here would
          // stretch to the content column and leave the button at the far
          // edge, and `D69` puts it beside the field.
          className="flex w-full max-w-sm min-w-0 items-center"
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
          <span dir="ltr">
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
          awaitingSignature={awaitingSignature}
          month={format.dateTime(new Date(`${period}T00:00:00Z`), {
            month: "long",
            timeZone: "UTC",
          })}
        />
      ) : null}

      {/* The concept KPI row: auto-fit minmax(178px,1fr), so a fifth tile
          would wrap of its own accord rather than needing a new breakpoint. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(178px,1fr))] gap-3">
        {FOLLOW_UP_KINDS.map((kind) => (
          <Link
            key={kind}
            href={`/follow-ups?kind=${kind}`}
            className="card-face glass hover:border-line-strong p-4 text-start transition-colors"
          >
            <Badge variant="outline">{t(`enums.followUpKind.${kind}`)}</Badge>
            <p className="num mt-2 text-2xl font-semibold tracking-tight">
              <span dir="ltr">{follow.counts[kind]}</span>
            </p>
          </Link>
        ))}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1.25fr_1fr]">
        <Card data-slot="today-queue">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-start text-sm">
              {t("today.queue.title")}
            </CardTitle>
            {follow.total > queue.length ? (
              <Button asChild size="xs" variant="ghost">
                <Link href="/follow-ups">
                  {t("today.queue.seeAll", { count: follow.total })}
                </Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {queue.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
                {t("today.queue.empty")}
              </p>
            ) : (
              <ul className="flex flex-col">
                {queue.map((row) => (
                  <RecordRow
                    key={`${row.kind}:${row.anchorId}`}
                    href={anchorHref(row.anchorType, row.anchorId)}
                    title={lookupName({ nameEn: row.anchorNameEn, nameAr: row.anchorNameAr }, locale)}
                    meta={`${t(`enums.followUpKind.${row.kind}`)}${
                      row.ownerNames.length > 0
                        ? ` · ${row.ownerNames.join(", ")}`
                        : ""
                    }`}
                    // Elapsed time, coloured by lateness `[22 §4]`. Every row
                    // here is past its threshold by construction —
                    // `follow-ups.ts` put it in the queue for that reason — so
                    // the tone reads that fact through the same helper the
                    // lists use rather than hard-coding red, as this row used
                    // to. The one row that is due rather than late is a
                    // `date_due` on the day it arrives: its threshold is zero,
                    // so age zero means the rep's date is today, not that they
                    // are behind `[25 §18]`. No threshold is derived here —
                    // this reads the age the data layer already computed.
                    whenClassName={toneClass(
                      turnTone({
                        overdue: row.ageDays > 0,
                        dueSoon: row.ageDays === 0,
                      }),
                    )}
                    when={
                      // Working days for the thresholds stated that way,
                      // calendar days for the rest `[21 §8]` — and its own
                      // phrase at zero, which only `date_due` reaches
                      // `[25 §18]`.
                      row.ageDays === 0
                        ? t("followUps.fields.dueToday")
                        : row.inWorkingDays
                          ? t("followUps.fields.workingDays", {
                              count: row.ageDays,
                            })
                          : t("followUps.fields.days", { count: row.ageDays })
                    }
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card data-slot="today-waiting">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-start text-sm">
              {t("today.waiting.title")}
            </CardTitle>
            <Button asChild size="xs" variant="ghost">
              <Link href="/notifications">{t("today.waiting.seeAll")}</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {waiting.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
                {t("today.waiting.empty")}
              </p>
            ) : (
              <ul className="flex flex-col">
                {waiting.map((row) => (
                  // A link only while the viewer may still open it `[20 §8.2]`:
                  // a share can be revoked and a company handed on, and the row
                  // outlives either. `RecordRow` links the TITLE, so an
                  // unopenable row passes no href and renders as plain text.
                  //
                  // A mention carries no anchor `[25 §11]` — its record is in
                  // the payload, already visibility-checked there — so the two
                  // routes to a link are read in one place here.
                  <RecordRow
                    key={row.id}
                    href={
                      row.payload?.kind === "mention"
                        ? (row.payload.href ?? undefined)
                        : row.anchorViewable && row.anchorId && row.anchorType
                          ? anchorHref(row.anchorType, row.anchorId)
                          : undefined
                    }
                    title={
                      row.typeName
                        ? t(`enums.notificationType.${row.typeName}`)
                        : row.typeKey
                    }
                    meta={
                      row.payload?.kind === "mention"
                        ? (row.payload.authorName ?? undefined)
                        : (row.anchorLabel ?? undefined)
                    }
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
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
  awaitingSignature,
  month,
}: {
  measured: AchievementRow;
  lastMonth: AchievementRow | undefined;
  awaitingSignature: number;
  month: string;
}) {
  const t = await getTranslations();

  const target = measured.targetSqm ?? "0";
  const { worked, total } = monthWorked(riyadhDayOf(new Date()));

  // Two plain integers, so the same helper answers at scale 0.
  const pacePct = percentOf(String(worked), String(total), 0);
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
    <Card data-slot="today-target">
      <CardHeader>
        <CardTitle className="text-start text-sm">
          {t("today.target.label", { month })}
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
            <span dir="ltr">
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
              2,000 m² is the same 2,000 counted three times. */}
          <SideFigure
            label={t("today.target.awaitingSignature")}
            value={String(awaitingSignature)}
            detail={t("today.target.awaitingSignatureUnit")}
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

/** `D32`'s two small figures, beneath the bar. `D12`'s section label, then the
 *  figure, then one line of what it is measured against. */
function SideFigure({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div>
      <p className="text-faint text-[10.5px] font-semibold tracking-[.09em] uppercase">
        {label}
      </p>
      <p className="num mt-1 text-[17px] font-semibold" dir="ltr">
        {value}
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
 * **The percentage is not clamped; only the fill is.** A rep at 120% reads
 * 120% and sees a full bar — clamping the figure would quietly report a miss.
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
  const fillPct = Math.min(100, Math.max(0, achievementPct));
  const tickOnFill = fillPct >= pacePct;

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="bg-surface-2 border-line relative h-2 overflow-hidden rounded-lg border"
        role="progressbar"
        aria-valuenow={fillPct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="absolute inset-y-0 start-0 rounded-lg bg-(image:--brand-grad)"
          style={{ inlineSize: `${fillPct}%` }}
        />
        <div
          data-slot="today-tick"
          aria-hidden
          className={cn(
            "absolute inset-y-0 w-0.5",
            tickOnFill ? "bg-canvas" : "bg-foreground",
          )}
          style={{ insetInlineStart: `calc(${pacePct}% - 1px)` }}
        />
      </div>
      {/* The concept's `.legend`: mono, faint, the scale under the bar. */}
      <div className="num text-faint flex justify-between text-[11px]" dir="ltr">
        <span>0</span>
        <span>{achievementPct}%</span>
        <span>{target}</span>
      </div>
    </div>
  );
}
