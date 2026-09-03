import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
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
import { cn } from "@/lib/utils";
import { isOpeningWeek } from "@/lib/working-days";

import { paceGeometry } from "./pace";

/**
 * What `D32`'s panel reads, and the whole of it.
 *
 * A person's row `S83` and the company's figure `S136` are different decisions
 * over different tables, and this is the shape they have in common — which is why
 * `D38` can be *the same signature panel read wider* rather than a second one.
 * `null` is *not measured*, never zero `D32`.
 */
export type PanelFigures = { targetSqm: string | null; achievedSqm: string };

/**
 * `D32` — the target with a pace line. **Lived inside `page.tsx` until the
 * overseer band** `D77`: the band renders the same figures inside one shared
 * card, so the body is split from the card exactly as `TargetPanel` and
 * `CompanyAttainment` already share `PanelFigures` — one derivation, two
 * frames, no copy to drift.
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
export async function TargetBody({
  measured,
  lastMonth,
  quoted,
  pacePct,
  daysWorked,
  daysInMonth,
  sides = true,
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
  /** Computed once by the page, so `D39`'s table cannot draw a different
   *  tick from this panel's. */
  pacePct: number;
  daysWorked: number;
  daysInMonth: number;
  /** The rep drill-in draws the body without `D32`'s two side figures —
   *  `quotedCount` answers for a scope, not a person, and a wrong figure is
   *  worse than none. Everything above the side block is unchanged. */
  sides?: boolean;
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
  //
  // **The opening week says *the month has just started*** `D32` — in both
  // directions. Through the first working week the comparison has no meaning
  // yet (nothing dispatched on the 2nd is not a rep 545 m² behind, and 500 m²
  // on the 2nd is not a rep ahead), so neither word is printed. The figure is
  // the figure: the tick, both percentages and `data-gap` are unchanged.
  const opening = isOpeningWeek(worked);
  const paceKey = opening
    ? "today.target.pace.opening"
    : gap > ZERO
      ? "today.target.pace.ahead"
      : gap < ZERO
        ? "today.target.pace.behind"
        : "today.target.pace.onPace";

  const lastMonthPct =
    lastMonth && lastMonth.targetSqm
      ? percentOf(lastMonth.achievedSqm, lastMonth.targetSqm, SQM_SCALE)
      : null;

  return (
    <div className="flex flex-col gap-3">
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
        // `S94` — the two working-day counts the pace is made of, so
        // `verify:routes` §47 can hold the tick to the calendar it read.
        data-days-worked={worked}
        data-days-in-month={total}
        // `D32`'s opening week, as a marker: the words are translated, so
        // `verify:routes` §41 holds the attribute to its own working-day count.
        data-opening={opening ? "" : undefined}
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

      {sides ? (
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
      ) : null}
    </div>
  );
}

/** The rep's own standalone card — `D64`'s first block in its no-flag frame.
 *  The overseer reads the same body inside `D77`'s band instead. */
export async function TargetPanel(props: {
  measured: PanelFigures;
  lastMonth: PanelFigures | undefined;
  quoted: number;
  month: string;
  /** `D38` — which question this panel is answering. A DOM marker rather than a
   *  tone or a layout change: the panel is the same one either way. */
  scope: "own" | "company";
  pacePct: number;
  daysWorked: number;
  daysInMonth: number;
}) {
  const t = await getTranslations();

  return (
    <Card data-slot="today-target" data-scope={props.scope}>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-start text-sm">
          {/* **The words say which scope this is, and the panel does not
              otherwise change.** `D38` asks for the same signature panel read
              wider — that is about the panel, not its title — and a manager who
              cannot tell whose 5,082 he is reading is exactly the confusion
              `25a` surfaced: two correct figures answering different questions,
              indistinguishable on screen. */}
          {t(
            props.scope === "company"
              ? "today.target.labelCompany"
              : "today.target.label",
            { month: props.month },
          )}
        </CardTitle>
        {/* `S94` — the way in to the calendar for a book-holder, on the one
            screen where his leave is felt: the tick. Not a rail item `D49`. */}
        {props.scope === "own" ? (
          <Button asChild size="xs" variant="ghost">
            <Link href="/calendar" data-slot="time-off-link">
              {t("today.target.timeOff")}
            </Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <TargetBody
          measured={props.measured}
          lastMonth={props.lastMonth}
          quoted={props.quoted}
          pacePct={props.pacePct}
          daysWorked={props.daysWorked}
          daysInMonth={props.daysInMonth}
        />
      </CardContent>
    </Card>
  );
}

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
 * **8px, `--radius-lg` ends, `--brand-grad` fill** — `D15`'s SECOND and last
 * use, in the `bg-(image:…)` form the primary button already uses. No bloom:
 * the refusal recorded here is now `D16` itself, which has one use and this is
 * not it.
 *
 * **The tick is a 2px bar, never a glow** — `D16`'s one is spoken for. It
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
 * third use of the gradient `D15` — it is the target bar's fill, continued,
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
