"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/** `D72` — *every 60 seconds*. One number, and the rule says where it lives. */
const EVERY_MS = 60_000;

/**
 * *"3 new — refresh"* `D72`.
 *
 * **Visible, never silent, and that is safety rather than taste.** A silent
 * update can move a row under the cursor between the decision to click and the
 * click, and on the coordinator's queue that means approving the wrong
 * dispatch. So this renders a line the person chooses to press, and **nothing
 * beneath it moves**: no row is inserted, removed, re-ordered or re-coloured,
 * no tile's figure changes. The only things that may change are the number in
 * this line and whether the line is there at all.
 *
 * **It is not a toast** `D58`. It is static, it stays until it is acted on, it
 * never floats over content and it never dismisses itself.
 *
 * **`D20` is satisfied by construction rather than by a waiver.** The component
 * renders no line at all until a poll has answered with a number above zero, so
 * with scripts off there is nothing here: the page renders, reads and works
 * exactly as it did. Nothing this file does is the thing that makes a screen
 * work — it makes one fresher. `verify:routes` §23 never sees it, because it is
 * an `<a>` and that scan walks forms.
 *
 * **Pressing it is a plain `<a>`, deliberately.** `D72`: *the refresh a person
 * presses is the ordinary server render they would have got from F5*. A
 * same-href client navigation is ambiguous about whether it re-fetches, and a
 * fetch-and-patch would redraw what this rule says must not move. The href is
 * built on the server so it carries the locale prefix.
 *
 * **A hidden tab polls nothing** `D72`, and returning to a visible one polls at
 * once rather than waiting out the remainder of a minute.
 */
export function RefreshNotice({
  scope,
  query,
  since,
  href,
  variant = "inline",
}: {
  /** Which list this block is — one of the count route's four. */
  scope: string;
  /**
   * **The canonical query the screen actually ran**, serialised — not
   * `location.search`, which is what the person typed. `D72` asks the route for
   * *the same query the screen ran*, and an unknown `?view=`, a stale filter or
   * a `?page=` would otherwise force the route to repeat every screen's
   * fallback logic. A count is over the scope, so no page number is in here.
   */
  query: string;
  /** The instant the server began this render — `renderedAt()`. */
  since: string;
  /** This screen's own URL, locale prefix and all. */
  href: string;
  /** `bar` draws the list card's own header rule; `inline` sits in a heading. */
  variant?: "bar" | "inline";
}) {
  const t = useTranslations("common");
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;

    const ask = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const search = new URLSearchParams(query);
        search.set("scope", scope);
        search.set("since", since);
        const answer = await fetch(`/api/updates?${search}`, {
          cache: "no-store",
        });
        if (!answer.ok || !alive) return;
        const body: unknown = await answer.json();
        const value = (body as { count?: unknown }).count;
        if (typeof value === "number") setCount(value);
      } catch {
        // A poll that fails leaves the screen exactly as it was. `D72` permits
        // this line to appear and its number to move and nothing else, so
        // there is nothing honest to say here and no state to fall back to.
      }
    };

    const timer = setInterval(ask, EVERY_MS);
    document.addEventListener("visibilitychange", ask);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", ask);
    };
    // The first ask is at t+60s on purpose: at mount the count is necessarily
    // zero, so a page load costs no extra request.
  }, [scope, query, since]);

  return (
    // `display: contents`, so with nothing new this element has no box at all
    // and the block above it is byte-for-byte the layout it was. It still
    // carries the transport — and `verify:routes` reads these markers to prove
    // the scope and the render moment reached the browser at all.
    <div
      className="contents"
      data-slot="refresh-notice"
      data-scope={scope}
      data-since={since}
      data-query={query}
      data-count={count}
    >
      {count > 0 ? (
        <a
          href={href}
          data-slot="refresh-line"
          // `D73` — a translated word and a figure in one run, so the run
          // resolves off its own word. No `dir="ltr"` on the count inside it:
          // that is for a bare figure, and forcing it here is what renders
          // *4 of 13* as *13 of 4* for an Arabic reader.
          dir="auto"
          className={cn(
            "text-foreground text-start text-xs font-semibold underline underline-offset-2 hover:no-underline",
            variant === "bar" && "border-line block border-b px-4 py-2.5",
          )}
        >
          {t("newSinceLoad", { count })}
        </a>
      ) : null}
    </div>
  );
}
