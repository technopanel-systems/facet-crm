import { cache } from "react";

import { requireSession } from "@/lib/authz";
import { followUps } from "@/lib/follow-ups";
import { unresolvedCount } from "@/lib/notifications";

/**
 * The two numbers the shell shows: the Today badge and the bell.
 *
 * Wrapped in React `cache()` with **zero arguments**, so the layout and the
 * Today screen share one computation per request rather than deriving the same
 * follow-ups twice on `/`. Zero arguments matters — `cache()` keys on argument
 * identity, and a freshly-built session object would never hit.
 *
 * **The cost, stated:** `followUps()` now runs on every page render to feed the
 * badge, where before only `/follow-ups` paid for it. There is no count-only
 * path in `follow-ups.ts` — `counts` comes back with page one either way.
 *
 * Nothing here is new logic. Both functions are called exactly as their own
 * screens call them `[22 §7]`.
 */
export const shellCounts = cache(async () => {
  const session = await requireSession();
  const [follow, unresolved] = await Promise.all([
    followUps(session),
    unresolvedCount(session),
  ]);
  return { session, follow, unresolved };
});
