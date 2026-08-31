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
        // `D73` — `elapsed` is `D34`'s calendar-day figure, which is a
        // number and a translated word, so the run resolves off the word. A
        // bare figure would land on LTR through `auto` anyway: with no strong
        // character the algorithm falls back to it.
        <span className={cn("num text-xs font-semibold", TONE[tone])} dir="auto">
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
  meter,
  tone = "soon",
}: {
  who?: string;
  line: string;
  detail?: string;
  /**
   * A figure the line cannot carry — `D26`'s silence bar on a company, showing
   * the elapsed time as a **proportion of its threshold**. It renders at the
   * far inline-end and never restates the count: the number is in `line`, said
   * once.
   */
  meter?: React.ReactNode;
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
          className="grid size-8.5 flex-none place-items-center rounded-full bg-(image:--avatar-person-grad) text-xs font-semibold text-white"
        >
          {who}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold">{line}</span>
        {detail ? (
          <span className="text-muted-foreground mt-0.5 block text-[12.5px]">
            {detail}
          </span>
        ) : null}
      </span>
      {meter ? <span className="flex-none">{meter}</span> : null}
    </div>
  );
}

/**
 * The message key for a **company's** turn — `D2` `D24`.
 *
 * A company has no chain position `[chain.ts]`, so this is not `chainTurnKey`'s
 * sibling over a ladder of six; it is the six states `companyTurn` resolves,
 * each of which already knows who owes the move.
 *
 * **Second person where the reader IS the holder.** `chainTurnKey` names the
 * rep instead, and says why: a thread row carries `raisedByName` and no id, so
 * two people called Mohammed would read each other's turn as their own. That
 * objection does not apply here — a company's memberships carry user ids, so
 * the comparison is honest and the second person is the clearer sentence.
 * `D2`'s own example is the third-person half: *"Waiting on Rawan"*.
 */
export function companyTurnKey(
  state:
    | "archived"
    | "onHold"
    | "planned"
    | "due"
    | "quiet"
    | "calm"
    | "never",
  viewerIsHolder: boolean,
): string {
  if (state === "archived" || state === "onHold") {
    return `companies.turn.${state}`;
  }
  return `companies.turn.${viewerIsHolder ? "yours" : "theirs"}.${state}`;
}

/**
 * The message key for a **dispatch's** turn — `D26`'s *who does this wait on?*,
 * `S88`.
 *
 * Lifted out of `/dispatches`' row, which was the only place it existed, when
 * the company page grew a dispatches card and would otherwise have written the
 * same four-rung ladder a second time. `D26` states the two ends of it outright:
 * *a submitted request owes the coordinator; an approved dispatch owes nobody*.
 * Approved and refused both name who ended it instead — one is an event that
 * happened, the other is archived `S122`.
 */
export function dispatchTurnKey(
  status: "draft" | "submitted" | "approved" | "refused" | "cancelled",
): string {
  switch (status) {
    // The raiser's, and who may still edit it while it is a draft `S125`.
    case "draft":
      return "dispatches.turn.rep";
    case "submitted":
      return "dispatches.turn.coordinator";
    case "approved":
      return "dispatches.turn.approved";
    // **`cancelled` gained a line of its own here.** The ladder this replaced
    // ended `: t("dispatches.turn.refused")`, so a cancelled dispatch read
    // *Refused* — and the two are different acts with different rules: `S122`
    // archives a refusal out of the working lists, while `S73`'s cancellation
    // stays visible as history, un-wins its project and takes back the credit.
    // The default scope keeps cancelled rows and drops refused ones, so
    // `/dispatches` was the screen showing it, and extracting the ladder
    // without fixing it would have printed the same wrong word twice.
    case "cancelled":
      return "dispatches.turn.cancelled";
    case "refused":
      return "dispatches.turn.refused";
  }
}

/** Whether a dispatch's turn line names somebody — `rep` and `approved` take a
 *  `{name}`, the other three do not. Keeps the parameter decision beside the
 *  key that needs it rather than in each caller. */
export function dispatchTurnNames(
  status: "draft" | "submitted" | "approved" | "refused" | "cancelled",
): boolean {
  return status === "draft" || status === "approved";
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
  // **Two fields, not a whole `ChainState`.** `reached` is the strip's, and
  // asking for it made every caller that holds only a position fabricate one —
  // `/projects` and the company page both wrote `reached: position`, which is
  // false on a closed thread and was never read. A narrower parameter is what
  // stops a caller inventing a field to satisfy a signature.
  { position, owedBy }: Pick<ChainState, "position" | "owedBy">,
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
