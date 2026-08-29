import { cache } from "react";

import { requireSession } from "@/lib/authz";
import { followUpScope } from "@/lib/follow-ups";
import { unreadCount } from "@/lib/notifications";

/**
 * The two numbers the shell shows: the Today badge and the bell.
 *
 * **The bell's number is UNREAD since `S91`.** It was unresolved act-now rows,
 * over a join and three terms; nothing writes `resolved_at` now, so that count
 * could only ever have risen. Reading is the disposal.
 *
 * Wrapped in React `cache()` with **zero arguments**, so the layout and the
 * Today screen share one computation per request rather than deriving the same
 * follow-ups twice on `/`. Zero arguments matters — `cache()` keys on argument
 * identity, and a freshly-built session object would never hit.
 *
 * **The cost, stated:** the derivation now runs on every page render to feed
 * the badge, where before only `/follow-ups` paid for it. There is no
 * count-only path in `follow-ups.ts` — `counts` comes back with the rows
 * either way.
 *
 * **It reads the whole scope rather than page one** `followUpScope`. The rail
 * wants only `total`, but `/` splits the same rows into `D34`'s two sections,
 * and the planned half sorts last. One derivation, both readers — the same
 * reason this wrapper exists at all.
 *
 * Nothing here is new logic. Both functions are called exactly as their own
 * screens call them `[22 §7]`.
 */
export const shellCounts = cache(async () => {
  const session = await requireSession();
  const [follow, unread] = await Promise.all([
    followUpScope(session),
    unreadCount(session),
  ]);
  return { session, follow, unread };
});
