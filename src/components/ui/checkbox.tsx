import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * A native `<input type="checkbox">`, styled `D14`.
 *
 * **It was Radix's primitive until session 40**, and Radix renders a
 * `<button role="checkbox">` with an `aria-hidden` input beside it at
 * `tabIndex:-1` and `pointer-events:none` — "so that events bubble to forms
 * without JS (SSR)", which is bubbling rather than operating. With scripts off
 * only the default value could ever post, so a credit split could not be set
 * at all (`credit-splits.ts` refuses an empty `userIds`, and that control is
 * its only writer). That is enablement, which `D20` forbids.
 *
 * **The treatment is unchanged** — same size, same radius, same border, same
 * brand fill when checked. Only the element is different, so no call site
 * changed beyond `onCheckedChange` becoming `onChange`.
 *
 * Two notes on how the look survives `appearance-none`:
 *
 *  - **The tick is a background image, not a pseudo-element.** `::before` and
 *    `::after` on an `<input>` are a replaced-element edge case browsers do
 *    not agree on; a background image is not. Every `/` in it is written
 *    `%2F` and the URL carries no quotes at all. Both are the same trap:
 *    Tailwind scans the SOURCE TEXT, so a bare slash reads as the opacity
 *    modifier and an escaped quote reaches the stylesheet as a literal
 *    backslash — either way the declaration is dropped or malformed, in
 *    silence. This shipped tickless for one build before the compiled CSS
 *    was read back. Its stroke is `#fff` because
 *    `--brand-ink` is `#ffffff` in BOTH themes (`globals.css:198`, `:283`) —
 *    a data URI cannot read a custom property, so the token is quoted here
 *    rather than approximated.
 *  - **The expanded hit area is gone with the pseudo-element**, and nothing is
 *    lost: all seven call sites pair the box with a `<label htmlFor>`, which
 *    is the target a thumb actually lands on.
 */
function Checkbox({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 appearance-none rounded-[4px] border border-input",
        "bg-center bg-no-repeat transition-colors outline-none",
        "group-has-disabled/field:opacity-50",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        "aria-invalid:checked:border-primary",
        "dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        "checked:border-primary checked:bg-primary dark:checked:bg-primary",
        "checked:bg-[image:url(data:image/svg+xml,%3Csvg%20xmlns=%27http:%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox=%270%200%2016%2016%27%3E%3Cpath%20fill=%27none%27%20stroke=%27%23fff%27%20stroke-width=%272.5%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%20d=%27m3.5%208.5%203%203%206-6%27%2F%3E%3C%2Fsvg%3E)]",
        className
      )}
      {...props}
    />
  )
}

export { Checkbox }
