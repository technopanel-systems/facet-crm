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
          className="text-[25px] leading-tight font-semibold tracking-tight"
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
 * `auto-fit minmax(140px,1fr)`, as the concept has it. **The rules are drawn
 * by the cells, not by the container**, and that is the whole trick:
 *
 * The concept shows exactly four facts on one row, so it can say
 * `border-inline-end` per fact and `none` on the last. A company detail has
 * **thirteen**, which at laptop width wraps to seven tracks and then six —
 * leaving one track of the last row empty. Any container-drawn line work
 * (`gap-px` over a coloured ground) paints that empty track as a solid block
 * of `--line`, which reads as a broken cell. Borders on the cells leave it
 * simply blank, because there is no cell there to draw one.
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
        className="-ms-px grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))]"
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
 */
export function Fact({
  label,
  numeric,
  wide,
  children,
}: {
  label: string;
  numeric?: boolean;
  /** For a value that is a sentence — notes, a reason — rather than a datum. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        // `border-t` is the row rule and, on the first row, the rule under the
        // card header. `border-s` is the column rule; the first column's is
        // clipped by `Facts`.
        "border-line border-s border-t px-4 py-3 text-start",
        wide && "col-span-full",
      )}
    >
      <dt className="text-faint text-[11px]">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-sm font-semibold",
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
 * A related record inside a card `[22 §3]` — the concept's `.row`.
 *
 * This replaces the class string that was copy-pasted into five files. Wrap a
 * group of them in `<ul className="flex flex-col">`.
 */
export function RecordRow({
  title,
  href,
  meta,
  when,
  whenClassName,
  action,
}: {
  title: ReactNode;
  href?: string;
  meta?: ReactNode;
  when?: ReactNode;
  /** The lateness colour, where the caller has one `[22 §4]`. */
  whenClassName?: string;
  action?: ReactNode;
}) {
  return (
    <li className="border-line flex items-center gap-3 border-b py-2.5 last:border-b-0">
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
        <span
          className={cn(
            "num flex-none text-[11.5px] font-semibold",
            whenClassName ?? "text-faint",
          )}
          dir="ltr"
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
