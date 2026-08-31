import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { AuthSession } from "@/lib/authz";
import { listDispatches } from "@/lib/dispatches";
import { listQuotationThreads } from "@/lib/quotations";

/**
 * `D40` — **"Waiting on the coordinator", the bottleneck card**, because the
 * coordinator is one person and **both chains run through her**: the quotation
 * chain, and since `S72` and `S124` the dispatch chain too. `D64`'s fifth
 * block, on `sees_all_reps` — the same flag as the team table, since *a manager
 * watching one person's queue is the same act as watching the team's*.
 *
 * `D40` names a card and not its contents. Three decisions, recorded at `D40`.
 *
 * ## 1. The aggregate, not the list
 *
 * `D40`'s own reason asks for the watching, not the working, and the identity
 * it is for holds **neither** `can_approve_quotation` nor `can_dispatch` — so
 * rows carrying Issue and Decide would be rows the reader may not take. That is
 * `D65`'s *a column nobody may act on is worse than no column*, one step out.
 * Two counts, each a way in to the pile's own list.
 *
 * **`D65` renders these two piles as rows for the person who works them; this
 * renders the same two as figures for the person who watches them.** One
 * definition, two readings — not a second derivation.
 *
 * ## 2. The two sets are `D65`'s own
 *
 * `listQuotationThreads({ awaitingIssue: true })` and
 * `listDispatches({ status: "submitted" })`, exactly as `RequestsBlock` calls
 * them. **No predicate is written here.**
 *
 * Deliberately **not** `chainGroup(position) === "coordinator"`, which
 * `/quotations` groups by: that also holds `readyToShip`, a thread whose
 * dispatch has been submitted, so the same request would be counted once in
 * each tile.
 *
 * ## 3. No age on either tile, and that is a measured refusal
 *
 * A bottleneck wants a duration and these two piles have no comparable clock.
 * `quotation_versions` carries no `issued_at`, so the quotation side can offer
 * only the thread's `created_at` — which `quotations.ts` states outright is
 * *how old the DEAL is, not how long this position has been owed* — while
 * `submitted_at` on a dispatch is a true wait. Two figures meaning two things
 * under one heading is worse than neither. The audit clock that would answer
 * properly is `follow-ups.ts`'s, and reaching for it here is the second ladder
 * `D27` pins to one file: a rule change, not a slice decision.
 *
 * **Zero renders.** Two facts is not the empty shell `D70` refuses, and *the
 * bottleneck is clear* is what a watcher came to read.
 *
 * ## Whose card this is
 *
 * **Each tile is suppressed where the reader holds that chain's own flag** —
 * `D65`'s *each column follows its own flag*, read from the other side. The
 * manager holds neither, so he gets both; a Super Admin holds both, so the
 * parent renders no card at all rather than showing him a weaker copy of his
 * own queue directly above it. `D64`'s *absent, not disabled and not empty*.
 *
 * **Cost: two calls, and only for the identity that reads it.** The parent
 * gates before this fetches, the `RequestsBlock` shape, so a rep and the
 * coordinator pay nothing. Nothing fires per row.
 */
export async function BottleneckCard({ session }: { session: AuthSession }) {
  const t = await getTranslations();

  const watchesIssuing = !session.user.role.canApproveQuotation;
  const watchesDeciding = !session.user.role.canDispatch;

  const [quotations, dispatches] = await Promise.all([
    watchesIssuing
      ? listQuotationThreads(session, { awaitingIssue: true })
      : Promise.resolve(null),
    watchesDeciding
      ? listDispatches(session, { status: "submitted" })
      : Promise.resolve(null),
  ]);

  return (
    <Card data-slot="today-bottleneck">
      <CardHeader>
        <CardTitle className="text-start text-sm">
          {t("today.bottleneck.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {quotations ? (
            <Tile
              chain="quotations"
              label={t("today.bottleneck.quotations")}
              count={quotations.total}
              href="/quotations"
            />
          ) : null}
          {dispatches ? (
            <Tile
              chain="dispatches"
              label={t("today.bottleneck.dispatches")}
              count={dispatches.total}
              href="/dispatches"
            />
          ) : null}
        </div>
        {/* What the card is and is not, in the team table's footer voice: it
            names the one person both chains pass through, which is the whole
            content of `D40`'s reason and the thing two numbers cannot say. */}
        <p
          data-slot="today-bottleneck-note"
          className="text-faint text-start text-[11.5px]"
        >
          {t("today.bottleneck.note")}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * One pile: its size, and the way to it.
 *
 * **The whole tile is the link** — `D33`'s tiles are, and a count a reader
 * cannot follow is the control `D51` refuses. Bare `/quotations` and
 * `/dispatches`, because `D25`'s **first** group on each is this very pile, so
 * the unfiltered list already opens on it.
 *
 * **No tone** `D6`. Colour here describes elapsed time, and this tile carries
 * no clock — see the rule above. A red number on a big pile would be a
 * threshold invented in code, which becomes the number everyone believes in.
 */
function Tile({
  chain,
  label,
  count,
  href,
}: {
  chain: "quotations" | "dispatches";
  label: string;
  count: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      data-slot="today-bottleneck-count"
      data-chain={chain}
      data-count={count}
      className="hover:bg-surface-2 -m-2 rounded-lg p-2 text-start transition-colors"
    >
      <p className="text-faint text-[10.5px] font-semibold tracking-[.09em] uppercase">
        {label}
      </p>
      <p className="num mt-1.5 text-2xl font-semibold tracking-tight" dir="ltr">
        {count}
      </p>
    </Link>
  );
}
