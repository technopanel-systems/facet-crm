import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The heading strip every CRM screen opens with: title on the reading side,
 * primary action on the far side. Logical alignment only, so Arabic mirrors
 * with no `rtl:` variant.
 */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="text-start">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

/**
 * The detail archetype's header `[22 §3]` — the concept's `.deal-h`.
 *
 * The record's **name**, a line of **state**, and the **mono reference**
 * inline in that line. Not `PageHeader`: a detail screen's identity is three
 * things, and squeezing a reference and a state into `description` is how
 * `/dispatches/[id]` ended up titled with a quantity.
 *
 * The name takes `dir="auto"` `D62`: since `S12` and `S19` a company or
 * contact name is one field holding either script, so its direction is a
 * property of the value rather than of the page. A Latin-initial name is
 * unaffected, which is why this sits on the shared heading rather than on an
 * opt-in prop a later screen would forget to pass.
 */
export function DetailHeader({
  name,
  state,
  reference,
  action,
}: {
  name: string;
  /** Already translated. City, owner, end state — whatever names the record. */
  state?: string;
  /** A SMAC reference or similar. Always mono, always LTR `[22 §2]`. */
  reference?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div className="min-w-0 text-start">
        <h1
          dir="auto"
          className="text-2xl leading-tight font-semibold tracking-tight"
        >
          {name}
        </h1>
        {state || reference ? (
          <p className="text-muted-foreground mt-1 text-[13px]">
            {state}
            {state && reference ? " · " : null}
            {reference ? (
              <span className="num text-faint" dir="ltr">
                {reference}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

/**
 * The bordered fact grid `[22 §3]` — the concept's `.facts`.
 *
 * `auto-fit minmax(170px,1fr)`, and **the rules are drawn by the cells, not by
 * the container** — that is the whole trick:
 *
 * The concept shows exactly four facts on one row, so it can say
 * `border-inline-end` per fact and `none` on the last. A company detail has
 * **nine**, which at laptop width wraps to a short last row. Any
 * container-drawn line work (`gap-px` over a coloured ground) paints an empty
 * track as a solid block of `--line`, which reads as a broken cell. Borders on
 * the cells leave it simply blank, because there is no cell there to draw one
 * `D61`.
 *
 * **The track was `140px` and is now `170px`** `D70`. At 1366 the narrower one
 * fitted seven of the company's ordinary facts on a row and left the eighth
 * alone underneath — a ragged edge that read as a mistake. The wider track
 * wraps them four and three.
 *
 * The wrapper exists to clip the first column's start border, which `-ms-px`
 * pushes outside. Without it the grid would show a doubled edge against the
 * card border, since `CardContent` is `px-0` here.
 */
export function Facts({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden">
      <dl
        data-slot="facts"
        className="-ms-px grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))]"
      >
        {children}
      </dl>
    </div>
  );
}

/**
 * One fact. `null` renders the em dash rather than collapsing the cell — an
 * empty field and a missing field look the same to a rep, and both are worth
 * seeing.
 *
 * `numeric` is opt-in, not automatic: the concept's four facts happen to all
 * be numbers, but a fact whose value is a person's name must not render mono.
 *
 * `name` emits `data-fact`, for the same reason the loss-reason `<option>`
 * carries `data-code`: `verify:routes` is a black-box script that may not
 * import `src/`, and a fact's only other handle is its label — a translated
 * string, which next-intl ships to every page whether it rendered or not.
 * Opt-in, so a fact nothing asserts on stays plain markup.
 */
export function Fact({
  label,
  name,
  numeric,
  wide,
  lead,
  children,
}: {
  label: string;
  /** A stable DOM handle for verification. Never displayed. */
  name?: string;
  numeric?: boolean;
  /** For a value that is a sentence — notes, a reason — rather than a datum. */
  wide?: boolean;
  /**
   * The one fact the reader came for `D70`.
   *
   * `D70` says what leads is chosen by what the reader is doing when they open
   * the screen, never by the order the fields were declared in. A company's
   * **phone** leads because a rep reads it standing outside the customer's
   * office; it is mandatory `S13` and the primary matching key `S23`. Eleven
   * equal cells had no lead at all, which is what made the grid a wall.
   *
   * At most one per grid. It spans two tracks and sets its value at 17px.
   */
  lead?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      data-fact={name}
      data-lead={lead ? "true" : undefined}
      className={cn(
        // `border-t` is the row rule and, on the first row, the rule under the
        // card header. `border-s` is the column rule; the first column's is
        // clipped by `Facts`.
        "border-line border-s border-t px-4 py-3 text-start",
        wide && "col-span-full",
        // Two tracks, but only where there are two to take — at one column the
        // span would be the whole row anyway, and `sm:` keeps a phone from
        // inheriting a rule written for a laptop `D55`.
        lead && "sm:col-span-2",
      )}
    >
      <dt className="text-faint text-[11px]">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 font-semibold",
          lead ? "text-[17px] leading-snug" : "text-sm",
          numeric && "num",
          wide && "font-normal",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

/**
 * A value that is deliberately not there **yet**, as against one that is
 * simply empty.
 *
 * `S50`'s project-less quotation is what this was built for, and that case no
 * longer exists. What it is for now is the same shape wherever it recurs — a
 * company's SMAC reference before the coordinator issues one is the surviving
 * caller. An em-dash is what every other absent value renders as, and it says
 * "nothing here", which is the wrong sentence for a value that is coming. This
 * one says what is missing and what fills it, in normal weight rather than the
 * semibold a real value carries, so the row reads as answered-later rather
 * than as a field somebody skipped.
 *
 * `data-slot="fact-absent"` is a DOM handle, for the same reason `Fact` takes
 * a `name`: `verify:routes` may not read a translated string, and the
 * difference between "absent" and "an em-dash" is exactly what it must assert.
 */
export function Absent({ children }: { children: ReactNode }) {
  return (
    <span
      data-slot="fact-absent"
      className="text-muted-foreground font-normal"
    >
      {children}
    </span>
  );
}

/**
 * A related record inside a card `[22 §3]` — the concept's `.row`.
 *
 * This replaces the class string that was copy-pasted into five files. Wrap a
 * group of them in `<ul className="flex flex-col">`.
 */
export function RecordRow({
  title,
  href,
  mark,
  meta,
  when,
  whenClassName,
  whenData,
  action,
}: {
  title: ReactNode;
  href?: string;
  /**
   * A lead glyph before the name — `D34`'s one-letter kind mark on the waiting
   * list. Optional, because the five other callers answer "what kind of thing
   * is this" from the card they sit in.
   */
  mark?: ReactNode;
  meta?: ReactNode;
  when?: ReactNode;
  /** The lateness colour, where the caller has one `[22 §4]`. */
  whenClassName?: string;
  /**
   * A stable DOM handle on the elapsed figure, emitted as `data-when`. `Fact`
   * carries a `name` prop for the same reason: `verify:routes` may not import
   * `src/`, and the figure's only other handle is a translated string. It is
   * what lets the colour be asserted **against the number that chose it** —
   * `D6` at zero is a claim about a derivation, not about a label.
   */
  whenData?: string;
  action?: ReactNode;
}) {
  return (
    <li className="border-line flex items-center gap-3 border-b py-2.5 last:border-b-0">
      {mark ? <span className="flex-none">{mark}</span> : null}
      <span className="min-w-0 flex-1 text-start">
        <span className="block truncate text-[13.5px] font-semibold">
          {href ? (
            <Link href={href} className="hover:underline">
              {title}
            </Link>
          ) : (
            title
          )}
        </span>
        {meta ? (
          <span className="text-muted-foreground mt-0.5 block truncate text-xs">
            {meta}
          </span>
        ) : null}
      </span>
      {when ? (
        // **No `dir` on this slot** — it carried `dir="ltr"`, and that
        // scrambled every ar-locale date a caller passed through it: `Intl`
        // embeds U+200F marks that place the date's segments inside an RTL
        // run, and the forced LTR fought them (`98f1e2e`'s mechanism, seen
        // here on the requests block). Callers whose content is genuinely
        // raw-LTR — a typed reference — isolate it themselves.
        <span
          data-when={whenData}
          className={cn(
            "num flex-none text-[11.5px] font-semibold",
            whenClassName ?? "text-faint",
          )}
        >
          {when}
        </span>
      ) : null}
      {action ? <span className="flex-none">{action}</span> : null}
    </li>
  );
}

/**
 * A labelled value on a detail screen. `null` renders the em dash rather than
 * collapsing the row — an empty field and a missing field look the same to a
 * rep, and both are worth seeing.
 *
 * Kept for the label/value lists that are genuinely a list and not a grid of
 * facts — a totals block, a version's terms. `Facts` is the archetype.
 */
export function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="border-line flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b py-2.5 last:border-b-0">
      <dt className="text-muted-foreground text-start text-sm">{label}</dt>
      <dd className="text-start text-sm font-medium">{children}</dd>
    </div>
  );
}
