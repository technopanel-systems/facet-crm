import type { ReactNode } from "react";
import { getFormatter, getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatSqm } from "@/lib/decimal";
import { lookupName } from "@/lib/lookups";
import {
  ROLLUP_PERIODS,
  type ConversionRow,
  type CoordinatorNow,
  type Losses,
  type MonthColumn,
  type QuotedSilent,
  type RealCustomers,
  type Returning,
  type Rollup,
  type RollupPeriodKey,
  type Sources,
} from "@/lib/rollup";
import { cn } from "@/lib/utils";

/**
 * The Reports tab `D42`–`D44` — eight blocks under three headings, built to
 * the approved drawings (`docs/archive/30-overseer-answers.md`).
 *
 * **Charts are CSS bars, never SVG.** SVG has no logical direction, so every
 * x-coordinate would be hand-mirrored in Arabic — the defect class `AUDIT 2`
 * catalogued. A CSS bar is `start-0` plus an inline size, a column chart is
 * a flex row, and both flip for free under `dir="rtl"` `D57`. Four forms
 * only: the single bar, the two-segment comparison, the ranked list and the
 * monthly columns.
 *
 * **Every chart prints its figures as text.** The geometry is a reading aid
 * and is `aria-hidden`; the number is the fact, and it is what
 * `verify:routes` §42 reads. A ranked list is useless when values cluster
 * and unreadable when one dwarfs the rest — the proposal's heavy drawing
 * proved both — so the figure is never smaller than the bar's own row.
 *
 * **Solid red for what happened, neutral for the remainder.** The fill is
 * `--brand`, the flat red the count badge and the bell already wear —
 * `--brand-grad` has exactly two uses `D15` and neither is a chart. Never
 * green-for-good `D6`.
 *
 * **A block with nothing to show is absent** `D70`; a heading whose blocks
 * are all absent goes with them; and when every block is absent the tab
 * says so once, outside any card `D52` `D60`.
 */

/** Up to this many columns share a row with *why we lose*; beyond it the
 *  chart takes the row — six is also the phone's cap `D42`. */
const CONTEXT_COLUMNS_MAX = 6;

/* ------------------------------------------------------------------ *
 * The period switcher — URL state `D20`
 * ------------------------------------------------------------------ */

export async function RollupPeriodNav({ active }: { active: RollupPeriodKey }) {
  const t = await getTranslations();
  return (
    <nav
      data-slot="rollup-periods"
      aria-label={t("rollup.periodLabel")}
      className="flex flex-wrap gap-2"
    >
      {ROLLUP_PERIODS.map((key) => {
        const on = key === active;
        return (
          <Link
            key={key}
            href={key === "month" ? "/?tab=reports" : `/?tab=reports&period=${key}`}
            data-period={key}
            aria-current={on ? "true" : undefined}
            // A chip, one step quieter than the tab pills above it, and the
            // `D74` floor said here because this is not a `Button`.
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1 text-[12.5px]",
              "max-md:min-h-11 transition-colors",
              on
                ? "border-line-strong bg-surface-2 font-semibold"
                : "text-muted-foreground hover:bg-surface-2 border-transparent",
            )}
          >
            {t(`rollup.periods.${key}`)}
          </Link>
        );
      })}
    </nav>
  );
}

/* ------------------------------------------------------------------ *
 * The chart primitives — four forms, CSS only
 * ------------------------------------------------------------------ */

/** The track and its fill. `start-0` and an inline size: the whole of the
 *  mirror is the browser's `D57`. The track's edge is `--line-strong`, one
 *  step up from the pace bar's, because a chart row can legitimately be all
 *  track — *0 of 5* — and a zero has to be seen as a bar with nothing in it,
 *  not as nothing. */
function Bar({ pct }: { pct: number }) {
  return (
    <div
      aria-hidden
      className="bg-surface-2 border-line-strong relative h-[7px] overflow-hidden rounded-lg border"
    >
      <div
        className="bg-brand absolute inset-y-0 start-0 rounded-lg"
        style={{ inlineSize: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

/** One row of a ranked list or a two-segment comparison: a label, the figure
 *  as text at the inline end, the bar beneath, and an optional second line. */
function BarRow({
  slot,
  attrs,
  label,
  figure,
  pct,
  below,
  first,
}: {
  slot: string;
  attrs: Record<string, string | number | undefined>;
  label: ReactNode;
  figure: ReactNode;
  pct: number;
  below?: ReactNode;
  first: boolean;
}) {
  return (
    <div
      data-slot={slot}
      {...attrs}
      className={cn("flex flex-col gap-1 py-2", !first && "border-line border-t")}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 text-[13px] font-medium wrap-break-word md:truncate">
          {label}
        </p>
        <p className="num text-muted-foreground shrink-0 text-[12.5px]">
          {figure}
        </p>
      </div>
      <Bar pct={pct} />
      {below ? (
        <p className="text-muted-foreground text-[12.5px]">{below}</p>
      ) : null}
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground text-start text-[12.5px]">{children}</p>
  );
}

function BlockTitle({ children }: { children: ReactNode }) {
  return (
    <CardHeader>
      <CardTitle className="text-start text-sm">{children}</CardTitle>
    </CardHeader>
  );
}

/* ------------------------------------------------------------------ *
 * The month
 * ------------------------------------------------------------------ */

/**
 * `D42` — monthly columns. A flex row, so the months run from the reading
 * edge in both languages; the window's months take the fill, context months
 * the track. **On a phone the chart caps at six periods**, hiding the oldest
 * columns — the figure of a hidden column is off the screen too, which is
 * why the phone shows six and not a squeezed twelve.
 */
async function MonthsBlock({
  columns,
  wide,
}: {
  columns: MonthColumn[];
  /** Twelve columns need the whole row — at half width their figures run
   *  together on a laptop, and a figure that cannot be read is no figure. */
  wide: boolean;
}) {
  const t = await getTranslations();
  const format = await getFormatter();
  const max = Math.max(...columns.map((column) => Number(column.sqm)));

  return (
    <Card
      data-slot="rollup-months"
      data-columns={columns.length}
      className={cn(wide && "lg:col-span-2")}
    >
      <BlockTitle>{t("rollup.months.title")}</BlockTitle>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-end gap-2 sm:gap-3">
          {columns.map((column) => {
            const value = Number(column.sqm);
            const pct = max > 0 ? (value / max) * 100 : 0;
            return (
              <div
                key={column.month}
                data-slot="rollup-column"
                data-month={column.month}
                data-sqm={formatSqm(column.sqm)}
                data-count={column.count}
                data-in-period={column.inPeriod ? "" : undefined}
                className="flex min-w-0 flex-1 flex-col items-center gap-1.5 max-md:nth-last-[n+7]:hidden"
              >
                <p className="num text-[12.5px] font-semibold">
                  <span dir="ltr">{formatSqm(column.sqm)}</span>
                </p>
                <div
                  aria-hidden
                  className="flex h-24 w-full max-w-14 items-end"
                >
                  {/* A context month is neutral, and it has to be SEEN to
                      be neutral: `--surface-2` on the card was the card's
                      own ground within a few percent in both themes, so the
                      comparison columns read as outlines — the shot sweep
                      found it in dark and in light. `--line-strong` is the
                      same ink the dividers are drawn in, a step darker than
                      a track, and it is a fill nobody could mistake for the
                      period's red. */}
                  <div
                    className={cn(
                      "w-full rounded-t-md",
                      column.inPeriod ? "bg-brand" : "bg-line-strong",
                    )}
                    style={{ blockSize: value === 0 ? "2px" : `${pct}%` }}
                  />
                </div>
                {/* A month is a value unique to its column, so it renders at
                    `D12`'s 12.5px floor and not as a section label. No
                    `dir`: a locale-formatted date places itself `D73`. */}
                <p className="text-muted-foreground text-[12.5px]">
                  {format.dateTime(new Date(`${column.month}T00:00:00Z`), {
                    month: "short",
                    timeZone: "UTC",
                  })}
                </p>
              </div>
            );
          })}
        </div>
        <Note>{t("rollup.months.note")}</Note>
      </CardContent>
    </Card>
  );
}

/** `D44` — loss reasons ranked by count, the metres beside each, and the
 *  signal line. Bars scale to the commonest reason. */
async function LossesBlock({ losses, locale }: { losses: Losses; locale: string }) {
  const t = await getTranslations();
  const max = Math.max(...losses.rows.map((row) => row.count));

  return (
    <Card
      data-slot="rollup-losses"
      data-losses={losses.losses}
      data-with-signal={losses.withSignal}
      data-days-before={losses.daysBefore ?? ""}
    >
      <BlockTitle>{t("rollup.losses.title")}</BlockTitle>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col">
          {losses.rows.map((row, index) => (
            <BarRow
              key={row.reasonId}
              slot="rollup-loss"
              attrs={{
                "data-code": row.code,
                "data-count": row.count,
                "data-sqm": formatSqm(row.sqm),
              }}
              first={index === 0}
              label={<span dir="auto">{lookupName(row, locale)}</span>}
              figure={
                <span dir="auto">
                  {t("rollup.losses.beside", {
                    sqm: formatSqm(row.sqm),
                    count: row.count,
                  })}
                </span>
              }
              pct={(row.count / max) * 100}
            />
          ))}
        </div>
        <Note>{t("rollup.losses.note")}</Note>
        <p
          data-slot="rollup-signals"
          className="text-start text-[12.5px] font-medium"
        >
          <span dir="auto">
            {losses.withSignal > 0 && losses.daysBefore !== null
              ? t("rollup.losses.signals", {
                  withSignal: losses.withSignal,
                  losses: losses.losses,
                  days: losses.daysBefore,
                })
              : t("rollup.losses.signalsNone")}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * The pipeline
 * ------------------------------------------------------------------ */

/** A count of deals, never metres `S68` — and a snapshot, said as such. */
async function QuotedBlock({ quoted }: { quoted: QuotedSilent }) {
  const t = await getTranslations();
  return (
    <Card
      data-slot="rollup-quoted"
      data-silent={quoted.silent}
      data-live={quoted.live}
      data-past={quoted.pastThreshold}
    >
      <BlockTitle>{t("rollup.quoted.title")}</BlockTitle>
      <CardContent className="flex flex-col gap-1 text-start">
        <p className="num text-[26px] leading-tight font-semibold tracking-tight">
          <span dir="auto">
            {t("rollup.quoted.figure", {
              silent: quoted.silent,
              live: quoted.live,
            })}
          </span>
        </p>
        <p className="text-muted-foreground text-[13px]">
          {t("rollup.quoted.lede")}
        </p>
        <p className="text-[12.5px] font-medium">
          <span dir="auto">
            {quoted.pastThreshold > 0
              ? t("rollup.quoted.past", { count: quoted.pastThreshold })
              : t("rollup.quoted.pastNone")}
          </span>
        </p>
        <p className="text-faint text-[12.5px]">{t("rollup.quoted.snapshot")}</p>
      </CardContent>
    </Card>
  );
}

/** `D40`'s piles with the metres they carry — also a snapshot. */
async function CoordinatorBlock({ now }: { now: CoordinatorNow }) {
  const t = await getTranslations();
  const clear = now.toIssue === 0 && now.requests === 0;
  return (
    <Card
      data-slot="rollup-coordinator"
      data-issue={now.toIssue}
      data-requests={now.requests}
      data-sqm={formatSqm(now.sqm)}
      data-oldest={now.oldestDays ?? ""}
    >
      <BlockTitle>{t("rollup.coordinator.title")}</BlockTitle>
      <CardContent className="flex flex-col gap-1 text-start">
        {clear ? (
          <p className="text-[15px] font-semibold">{t("rollup.coordinator.clear")}</p>
        ) : (
          <>
            <p className="text-[15px] font-semibold">
              <span dir="auto">
                {t("rollup.coordinator.line", {
                  quotations: now.toIssue,
                  requests: now.requests,
                })}
              </span>
            </p>
            {now.requests > 0 && now.oldestDays !== null ? (
              <p className="text-muted-foreground text-[12.5px]">
                <span dir="auto">
                  {t("rollup.coordinator.detail", {
                    sqm: formatSqm(now.sqm),
                    days: now.oldestDays,
                  })}
                </span>
              </p>
            ) : null}
          </>
        )}
        <p className="text-faint text-[12.5px]">{t("rollup.quoted.snapshot")}</p>
      </CardContent>
    </Card>
  );
}

/** `D43` `S142` — two figures per rep, side by side, never one score. */
async function ConversionBlock({ rows }: { rows: ConversionRow[] }) {
  const t = await getTranslations();
  return (
    <Card data-slot="rollup-conversion" data-rows={rows.length}>
      <BlockTitle>{t("rollup.conversion.title")}</BlockTitle>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col">
          {rows.map((row, index) => (
            <BarRow
              key={row.userId}
              slot="rollup-rep"
              attrs={{
                "data-user": row.userId,
                "data-quoted": row.quoted,
                "data-delivered": row.delivered,
                "data-open": row.open,
                "data-sitting": row.sittingDays ?? "",
              }}
              first={index === 0}
              label={<span dir="auto">{row.userName}</span>}
              figure={
                <span dir="auto">
                  {t("rollup.conversion.delivered", {
                    delivered: row.delivered,
                    quoted: row.quoted,
                  })}
                </span>
              }
              pct={(row.delivered / row.quoted) * 100}
              below={
                <span dir="auto">
                  {row.open === 0 || row.sittingDays === null
                    ? t("rollup.conversion.openNone")
                    : row.open === 1
                      ? t("rollup.conversion.openOne", {
                          open: row.open,
                          days: row.sittingDays,
                        })
                      : t("rollup.conversion.open", {
                          open: row.open,
                          days: row.sittingDays,
                        })}
                </span>
              }
            />
          ))}
        </div>
        <Note>{t("rollup.conversion.note")}</Note>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * The customers
 * ------------------------------------------------------------------ */

/** `S17` — the ranked list, with *not recorded* as its own bar. */
async function SourcesBlock({ sources, locale }: { sources: Sources; locale: string }) {
  const t = await getTranslations();
  const max = Math.max(...sources.rows.map((row) => row.count));
  return (
    <Card data-slot="rollup-sources" data-total={sources.total}>
      <BlockTitle>{t("rollup.sources.title")}</BlockTitle>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col">
          {sources.rows.map((row, index) => (
            <BarRow
              key={row.id ?? "none"}
              slot="rollup-source"
              attrs={{ "data-source": row.id ?? "none", "data-count": row.count }}
              first={index === 0}
              label={
                <span dir="auto">
                  {row.id && row.nameEn
                    ? lookupName({ nameEn: row.nameEn, nameAr: row.nameAr }, locale)
                    : t("rollup.sources.notRecorded")}
                </span>
              }
              figure={
                <span dir="auto">
                  {t("rollup.sources.count", { count: row.count })}
                </span>
              }
              pct={(row.count / max) * 100}
            />
          ))}
        </div>
        <Note>{t("rollup.sources.note")}</Note>
      </CardContent>
    </Card>
  );
}

/** `S139` — per rep, the buyers in the window who have bought on new work. */
async function ReturningBlock({ returning }: { returning: Returning }) {
  const t = await getTranslations();
  return (
    <Card
      data-slot="rollup-returning"
      data-buyers={returning.buyers}
      data-returned={returning.returned}
    >
      <BlockTitle>{t("rollup.returning.title")}</BlockTitle>
      <CardContent className="flex flex-col gap-3">
        <p className="text-start text-[13px] font-medium">
          <span dir="auto">
            {t("rollup.returning.total", {
              returned: returning.returned,
              buyers: returning.buyers,
            })}
          </span>
        </p>
        <div className="flex flex-col">
          {returning.rows.map((row, index) => (
            <BarRow
              key={row.userId ?? "none"}
              slot="rollup-returning-rep"
              attrs={{
                "data-user": row.userId ?? "none",
                "data-buyers": row.buyers,
                "data-returned": row.returned,
              }}
              first={index === 0}
              label={
                <span dir="auto">
                  {row.userName ?? t("rollup.returning.unheld")}
                </span>
              }
              figure={
                <span dir="auto">
                  {t("rollup.returning.row", {
                    returned: row.returned,
                    buyers: row.buyers,
                  })}
                </span>
              }
              pct={(row.returned / row.buyers) * 100}
            />
          ))}
        </div>
        <Note>{t("rollup.returning.note")}</Note>
      </CardContent>
    </Card>
  );
}

/** `S140` — one figure, ever. */
async function RealBlock({ real }: { real: RealCustomers }) {
  const t = await getTranslations();
  return (
    <Card data-slot="rollup-real" data-real={real.real} data-companies={real.companies}>
      <BlockTitle>{t("rollup.real.title")}</BlockTitle>
      <CardContent className="flex flex-col gap-1 text-start">
        <p className="num text-[26px] leading-tight font-semibold tracking-tight">
          <span dir="ltr">{real.real}</span>
        </p>
        <p className="text-muted-foreground text-[13px]">
          <span dir="auto">{t("rollup.real.of", { companies: real.companies })}</span>
        </p>
        <Note>{t("rollup.real.note")}</Note>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * The tab
 * ------------------------------------------------------------------ */

async function Section({
  name,
  children,
  columns,
}: {
  name: "month" | "pipeline" | "customers";
  children: ReactNode;
  columns: string;
}) {
  const t = await getTranslations();
  return (
    <section
      data-slot="rollup-section"
      data-section={name}
      className="flex flex-col gap-3"
    >
      <h2 className="text-faint text-start text-[10.5px] font-semibold tracking-[.09em] uppercase">
        {t(`rollup.sections.${name}`)}
      </h2>
      <div className={cn("grid items-start gap-6", columns)}>{children}</div>
    </section>
  );
}

/**
 * The three headings, each rendered only when a block beneath it stands, and
 * one sentence when none does. The pipeline's two snapshot blocks stack in
 * one column beside the per-rep list — the two short readings against the
 * one that grows with the team, `D70`'s balance-by-height.
 */
export async function RollupBody({
  rollup,
  locale,
}: {
  rollup: Rollup;
  locale: string;
}) {
  const t = await getTranslations();

  const monthStands = rollup.months !== null || rollup.losses !== null;
  const customersStand =
    rollup.sources !== null || rollup.returning !== null || rollup.real !== null;
  // The pipeline always stands: its two snapshot readings are measured
  // answers, zero included, and the coordinator's pile is a fact today.

  return (
    <div data-slot="rollup" data-period={rollup.period.key} className="flex flex-col gap-8">
      {monthStands ? (
        <Section name="month" columns="lg:grid-cols-2">
          {rollup.months ? (
            <MonthsBlock
              columns={rollup.months}
              wide={rollup.months.length > CONTEXT_COLUMNS_MAX}
            />
          ) : null}
          {rollup.losses ? (
            <LossesBlock losses={rollup.losses} locale={locale} />
          ) : null}
        </Section>
      ) : null}

      <Section name="pipeline" columns="lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <QuotedBlock quoted={rollup.quoted} />
          <CoordinatorBlock now={rollup.coordinator} />
        </div>
        {rollup.conversion ? <ConversionBlock rows={rollup.conversion} /> : null}
      </Section>

      {customersStand ? (
        <Section name="customers" columns="md:grid-cols-2 xl:grid-cols-3">
          {rollup.sources ? (
            <SourcesBlock sources={rollup.sources} locale={locale} />
          ) : null}
          {rollup.returning ? <ReturningBlock returning={rollup.returning} /> : null}
          {rollup.real ? <RealBlock real={rollup.real} /> : null}
        </Section>
      ) : null}

      {!monthStands && !customersStand && rollup.conversion === null ? (
        <p data-slot="rollup-empty" className="text-muted-foreground text-start text-sm">
          {t("rollup.empty")}
        </p>
      ) : null}
    </div>
  );
}
