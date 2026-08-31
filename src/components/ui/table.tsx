"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * `D56` — **a phone row keeps its lead cell, the name, and the one column the
 * list's own anatomy needs.** `phoneRows` is what opts a table into that
 * arrangement below `md`; `globals.css` carries the layout.
 *
 * **One DOM, two arrangements.** The markup is identical at every width, so
 * `verify:routes` reads the same markers on a phone as on a laptop, the two
 * views cannot drift apart, and no script is involved `D20`.
 *
 * It also takes the scroll container off below `md`: *hidden, not scrolled*,
 * and a container that scrolls sideways is how a phone hides a defect instead
 * of showing it (`WORKFLOW §5 AD8`). Without it, `/companies` looked
 * survivable at 375 with Category, City and Actions off-screen entirely.
 *
 * **It is opt-in, and the tables that decline it declare why at the call site.**
 * `/users`, `/targets` and `/activity?view=by-rep` are laptop-first `D55`, and
 * the three detail line tables are genuinely wide. Those keep the scroller.
 */
function Table({
  className,
  phoneRows,
  ...props
}: React.ComponentProps<"table"> & { phoneRows?: boolean }) {
  return (
    <div
      data-slot="table-container"
      className={cn(
        "relative w-full",
        // `D56` — below `md` a phone-row table has nothing to scroll, because
        // it is no longer laid out as columns.
        phoneRows ? "md:overflow-x-auto" : "overflow-x-auto",
      )}
    >
      <table
        data-slot="table"
        data-phone-rows={phoneRows ? "" : undefined}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

/**
 * `numeric` is one prop, not two classes remembered separately — the same
 * reasoning that made `num` a single utility `D11`. It carries both halves of
 * `D24`'s List clause: numeric columns are **end-aligned and mono**.
 *
 * Put it on the `TableHead` as well as the `TableCell`, always. A right-aligned
 * column under a left-aligned heading is the thing the rule exists to stop.
 */
type NumericProps = { numeric?: boolean }

function TableHead({
  className,
  numeric,
  ...props
}: React.ComponentProps<"th"> & NumericProps) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "px-4 py-2.5 text-start align-middle text-[10.5px] font-semibold tracking-[.09em] whitespace-nowrap text-faint uppercase [&:has([role=checkbox])]:pe-0",
        numeric && "text-end",
        className
      )}
      {...props}
    />
  )
}

/**
 * `D56`'s kept set, declared per cell rather than remembered per screen — the
 * same one-prop shape `numeric` above already has.
 *
 * | Value | Below `md` |
 * |---|---|
 * | `lead` | `D26`'s first column, at the inline start, spanning both lines |
 * | `name` | the record's name, first line, free to wrap |
 * | `keep` | **the one column** the list's anatomy needs, second line |
 * | `action` | the one column where it is a control — same slot, inline end |
 * | `group` | a group header's cell `D24`, full width |
 * | *(absent)* | **hidden** `D56` — not scrolled |
 *
 * **`keep` and `action` occupy the same grid slot**, so *the one column* is
 * enforced by the layout rather than by a person remembering it: a row that
 * annotates two of them collides visibly, and `verify:routes §27` fails it.
 *
 * Where the lead cell IS the name — a contact `D26` — a row fills two slots,
 * not three, and `D56` says so outright rather than leaving it per list.
 */
type PhoneSlot = "lead" | "name" | "keep" | "action" | "group"

function TableCell({
  className,
  numeric,
  phone,
  ...props
}: React.ComponentProps<"td"> & NumericProps & { phone?: PhoneSlot }) {
  return (
    <td
      data-slot="table-cell"
      data-phone={phone}
      className={cn(
        "px-4 py-3 align-middle whitespace-nowrap [&:has([role=checkbox])]:pe-0",
        numeric && "num text-end",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
