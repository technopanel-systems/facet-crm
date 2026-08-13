import type { ChainState } from "@/lib/chain";
import { cn } from "@/lib/utils";

/**
 * `22 §4` — whose move it is, not what the status is.
 *
 * > "Waiting on Rawan — signatures" beats "Issued".
 * > "Your turn" beats "Returned".
 * > "Nothing recorded for 23 days" beats "Lead".
 *
 * A status pill may still render beside this; it is never the only thing a row
 * says. A status names the state a record is in — this names the person the
 * record is waiting on, which is the thing a rep opens FACET to find out.
 *
 * **The tone maps a boolean the data layer has already derived.** It computes
 * no threshold of its own: `isQuiet` comes from `coverage()`, and a follow-up
 * row exists at all only because `follow-ups.ts` decided it had waited long
 * enough. A second derivation of "how late is late" is exactly the trap
 * `21 §7` names, and `22 §4` colours *how long something has waited*, never
 * how good the outcome is.
 */
export type TurnTone = "late" | "soon" | "calm";

const TONE: Record<TurnTone, string> = {
  late: "text-tone-red-fg",
  soon: "text-tone-amber-fg",
  calm: "text-faint",
};

/** For a caller that colours its own element rather than using `Turn`. */
export function toneClass(tone: TurnTone): string {
  return TONE[tone];
}

export function turnTone({
  overdue,
  dueSoon,
}: {
  overdue?: boolean;
  dueSoon?: boolean;
}): TurnTone {
  if (overdue) return "late";
  if (dueSoon) return "soon";
  return "calm";
}

/**
 * The turn as a table cell's content: the line naming who owes the next
 * action, and beneath it the elapsed duration coloured by lateness.
 *
 * `elapsed` is already translated and already pluralised by the caller —
 * working days for the two thresholds `07 D5` states that way, calendar days
 * for the rest `[21 §8]`, and only the caller knows which.
 */
export function Turn({
  line,
  elapsed,
  tone = "calm",
}: {
  line: string;
  elapsed?: string;
  tone?: TurnTone;
}) {
  return (
    <span data-slot="turn" className="flex flex-col gap-0.5 text-start">
      <span className="text-[13px] font-medium">{line}</span>
      {elapsed ? (
        <span className={cn("num text-xs font-semibold", TONE[tone])} dir="ltr">
          {elapsed}
        </span>
      ) : null}
    </span>
  );
}

/**
 * The same thing as a detail screen's panel `[22 §3]` — the most important
 * element on the screen, so it is a tinted band rather than a line of text.
 *
 * `who` is initials, matching the rail's avatar treatment. It is decorative:
 * the name is in `line` where a screen reader will reach it.
 */
export function TurnPanel({
  who,
  line,
  detail,
  tone = "soon",
}: {
  who?: string;
  line: string;
  detail?: string;
  tone?: TurnTone;
}) {
  const band =
    tone === "late"
      ? "bg-tone-red text-tone-red-fg"
      : tone === "soon"
        ? "bg-tone-amber text-tone-amber-fg"
        : "bg-surface-2 text-foreground";

  return (
    <div
      data-slot="turn-panel"
      className={cn(
        "flex items-center gap-3 rounded-[10px] px-3.5 py-3 text-start",
        band,
      )}
    >
      {who ? (
        <span
          aria-hidden
          className="grid size-8.5 flex-none place-items-center rounded-full bg-[linear-gradient(140deg,#31527F,#1B2F4C)] text-xs font-semibold text-white"
        >
          {who}
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold">{line}</span>
        {detail ? (
          <span className="text-muted-foreground mt-0.5 block text-[12.5px]">
            {detail}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/**
 * The message key for a chain position's turn line — `22 §4` in the second
 * person **where that person is the reader**, which is a condition, not a
 * mandate.
 *
 * The coordinator half is second-person, because `canApproveQuotation` names
 * that identity exactly. The rep half names the raiser instead, because a
 * thread row carries `raisedByName` and no id: there is no way to tell whether
 * the reader *is* that rep without comparing display names, and two people
 * called Mohammed would then read each other's turn as their own. Naming them
 * is what `22 §4`'s own example does — "Waiting on Rawan — signatures".
 */
export function chainTurnKey(
  { position, owedBy }: ChainState,
  viewerIsCoordinator: boolean,
): string {
  if (owedBy === null) return `chain.turn.none.${position}`;
  if (owedBy === "coordinator") {
    return viewerIsCoordinator
      ? `chain.turn.yours.${position}`
      : `chain.turn.coordinator.${position}`;
  }
  return `chain.turn.rep.${position}`;
}

/** Whole days elapsed — a display figure, not a threshold. */
export function daysSince(from: Date, now = new Date()): number {
  return Math.max(
    0,
    Math.floor((now.getTime() - from.getTime()) / 86_400_000),
  );
}

/** Two letters, the way the rail already does it. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
