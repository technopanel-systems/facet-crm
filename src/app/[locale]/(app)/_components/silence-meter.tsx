import { getTranslations } from "next-intl/server";

import { cn } from "@/lib/utils";

import { toneClass, turnTone } from "./turn";

/**
 * `D26` — the **company** lead cell: *a small bar and a day count, coloured by
 * lateness*, answering **have I neglected this?** before a word is read.
 *
 * Each object type has its own first column and this is the company's. It is
 * not the name-and-something a contact row leads with `D26`, and it is not a
 * date: a rep reads *47 days*, never *12 Jul*, which is why this replaced the
 * CREATED column outright rather than sitting beside it.
 *
 * **It derives nothing** — the same discipline `chain-strip.tsx` keeps for
 * `D27` and `waiting-list.tsx` for `D34`. Every figure arrives already decided
 * by `companySilence` in `src/lib/coverage.ts`: how many days, against which
 * threshold, whether that is quiet, whether the clock is suppressed. A
 * threshold computed in a component is the defect `CLAUDE.md` records shipping
 * once already, and a second opinion about *how late is late* is the trap
 * `21 §7` names.
 *
 * **No JavaScript** `D20`: a flex row and a width percentage.
 */
export async function SilenceMeter({
  daysSince,
  silentDays,
  thresholdDays,
  isQuiet,
  onHoldUntil,
  variant = "cell",
}: {
  /** Null = never logged against. */
  daysSince: number | null;
  silentDays: number;
  thresholdDays: number;
  isQuiet: boolean;
  onHoldUntil: string | null;
  /**
   * `"cell"` is `D26`'s lead cell: the bar and the day count.
   *
   * `"inline"` is the turn panel's `[D24]`, where the count is already the
   * subject of the line beside it — *"nothing recorded for 118 days"* — so this
   * carries the **denominator** instead. That is the one thing the sentence
   * cannot say: 118 means neglected against a 60-day threshold and merely late
   * against a 30-day one, and a proportion is what a bar is for. It also takes
   * no tone of its own — inside a tinted band `currentColor` is the band's, and
   * a second red on red reads as a rendering fault.
   */
  variant?: "cell" | "inline";
}) {
  const t = await getTranslations();

  /**
   * `D6` — **colour describes how long something has waited, never how good
   * the outcome is.** Past due red, otherwise faint.
   *
   * **The amber band is unreachable here, deliberately.** `D6` gives three
   * tones and `D25` names three groups, and neither `SPEC.md` nor `DESIGN.md`
   * says where *due soon* starts for a company — the only boundary any rule
   * gives is the threshold itself `07 D5`. Inventing a window would make it
   * the number everyone believes in, so it is `OPEN — not chosen`
   * (`WORKFLOW §5`) and `turnTone` is called without `dueSoon` rather than
   * with a guess.
   *
   * **On hold is never late** `[20 §5]`: the clock is deliberately suppressed,
   * so the row is calm however long it has been — the same reading
   * `coverage-table.tsx` already applies.
   */
  const tone = turnTone({ overdue: isQuiet && !onHoldUntil });

  /** Capped at 100%: a bar past its own end says nothing the count does not,
   *  and an overflowing fill reads as a rendering fault. */
  const fill = Math.min(100, Math.round((silentDays / thresholdDays) * 100));

  const inline = variant === "inline";

  return (
    <span
      data-slot="silence-meter"
      data-days={daysSince === null ? "never" : String(daysSince)}
      data-tone={tone}
      data-quiet={isQuiet ? "true" : "false"}
      data-variant={variant}
      className="flex w-[92px] flex-col gap-1 text-start"
    >
      {/* `aria-hidden`: the bar restates the figure below it, which a screen
          reader should hear once. */}
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-full overflow-hidden rounded-full border",
          inline
            ? "border-current/25 bg-current/10"
            : "bg-surface-2 border-line",
        )}
      >
        <span
          className={cn(
            "block h-full rounded-full",
            inline
              ? "bg-current"
              : tone === "late"
                ? "bg-tone-red-fg"
                : "bg-line-strong",
          )}
          style={{ inlineSize: `${fill}%` }}
        />
      </span>
      {/* Never-logged is its own phrase and **never zero** — "Never" and
          "today" must not read the same (`coverage.ts`). The count is mono and
          `dir="ltr"`, a figure inside a sentence in either locale `D11`. */}
      {inline ? (
        <span className="num text-[11px] font-semibold opacity-70" dir="ltr">
          {t("companies.silence.threshold", { count: thresholdDays })}
        </span>
      ) : daysSince === null ? (
        <span className={cn("text-[11.5px] font-semibold", toneClass(tone))}>
          {t("companies.silence.never")}
        </span>
      ) : (
        <span
          className={cn("num text-[11.5px] font-semibold", toneClass(tone))}
          dir="ltr"
        >
          {t("companies.silence.days", { count: daysSince })}
        </span>
      )}
    </span>
  );
}
