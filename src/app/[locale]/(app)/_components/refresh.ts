import { cache } from "react";

import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/**
 * The instant this request began rendering — `D72`'s *the moment it was
 * rendered*, which the count route compares against.
 *
 * **Wrapped in React `cache()` with zero arguments**, the `shellCounts()`
 * idiom, so every block on one page carries ONE instant and two notices on the
 * dashboard cannot disagree about when the page was drawn. Zero arguments
 * matters — `cache()` keys on argument identity.
 *
 * **It is read before the screen's queries run**, and that direction is
 * deliberate. A row written between this stamp and the query lands in the page
 * AND in the count, so the notice can over-report by one query's duration. The
 * other direction — stamping after the query — would let a row written in that
 * window fall between the two and never be counted at all. **A wasted click is
 * a cost; a missed row is the failure `D72` exists to prevent.**
 *
 * ISO 8601 with a `Z`, because it crosses to the browser as a string and comes
 * back in a query parameter.
 */
export const renderedAt = cache((): string => new Date().toISOString());

/** Whatever a page's `searchParams` promise resolved to. */
type Search = Record<string, string | string[] | undefined>;

/**
 * Everything `RefreshNotice` needs from the server, built once per block.
 *
 * **Two different strings, and the difference is the point.**
 *
 * - `query` is **the canonical narrowing the screen actually ran** — the
 *   options it handed its data module, with unknown values already resolved and
 *   no page number. `D72` asks the count route for *the same query the screen
 *   ran*; sending `location.search` instead would send what the person typed,
 *   and the route would have to repeat every screen's fallback logic.
 * - `href` is **the URL the person is on**, page number and all, because `D72`
 *   says pressing the line gives *the ordinary server render they would have
 *   got from F5* — and F5 does not drop you back to page one.
 *
 * A count is over the whole scope `CLAUDE.md`, which is why `page` belongs in
 * one of these and not the other.
 */
export function refreshProps(options: {
  /** One of the count route's four. */
  scope: string;
  locale: string;
  /** The screen's own route, unprefixed — `getPathname` adds the locale. */
  basePath: string;
  /** The page's raw `searchParams`, for the href. */
  search: Search;
  /** The narrowing the data module was given. `true` serialises as `1`. */
  query: Record<string, string | boolean | undefined>;
}): { scope: string; query: string; since: string; href: string } {
  const canonical = new URLSearchParams();
  for (const [name, value] of Object.entries(options.query)) {
    if (value === undefined || value === false) continue;
    canonical.set(name, value === true ? "1" : value);
  }

  const here = new URLSearchParams();
  for (const [name, value] of Object.entries(options.search)) {
    if (typeof value === "string" && value !== "") here.set(name, value);
  }
  // The cast is safe: `[locale]/layout.tsx` `notFound()`s anything else long
  // before a page renders — the same call the dashboard's search form makes.
  const path = getPathname({
    href: options.basePath,
    locale: options.locale as Locale,
  });
  const search = here.toString();

  return {
    scope: options.scope,
    query: canonical.toString(),
    since: renderedAt(),
    href: search ? `${path}?${search}` : path,
  };
}
