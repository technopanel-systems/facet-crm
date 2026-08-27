import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/validation";

/**
 * A native disclosure. No script, no round trip, and its contents are in the
 * markup whether it is open or shut — which is what `D20`'s operability half
 * needs and what `useState` could never give it.
 *
 * The marker is hidden on both engines: `list-none` covers the standard
 * `display: list-item` marker and the `::-webkit-details-marker` rule covers
 * Safari, which still paints its own triangle. `D17` names the closed list of
 * motions and a disclosure is not on it, so it opens instantly rather than
 * animating.
 *
 * **Shared from its second call site, not its third.** It was written for
 * `quotations/[id]/thread-lines.tsx` in session 28 and `D58` sends the target
 * editor here in `28b` — two copies would be two `::-webkit-details-marker`
 * rules, and the quiet-threshold drift `21 §7` names is what happens when the
 * second copy is allowed to exist. It carries no `"use client"` of its own: a
 * client component may import it, and a server one may too.
 */
export function Disclosure({
  label,
  open,
  act,
  className,
  children,
}: {
  label: string;
  open: boolean;
  /** A DOM handle for `verify:routes`, which may not read a translated
   *  string to tell two forms apart (`CLAUDE.md`). */
  act: string;
  /** Layout the caller owns — `thread-lines` claims the row when open, the
   *  target editor is already in a row of its own and claims nothing. */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <details open={open} data-slot={act} className={className}>
      <Button asChild size="xs" variant="ghost">
        <summary className="w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          {label}
        </summary>
      </Button>
      <div className="mt-3">{children}</div>
    </details>
  );
}

/** Whether this form came back rejected — what reopens its `<details>`. */
export function rejected(state: FormState): boolean {
  return Boolean(
    state.error ?? Object.values(state.fieldErrors ?? {}).length > 0,
  );
}
