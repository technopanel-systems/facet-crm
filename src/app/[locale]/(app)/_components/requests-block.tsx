import { getFormatter, getTranslations } from "next-intl/server";

import { RecordRow } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { AuthSession } from "@/lib/authz";
import { listDispatches } from "@/lib/dispatches";
import { lookupName } from "@/lib/lookups";
import { listQuotationThreads } from "@/lib/quotations";
import { riyadhDayOf } from "@/lib/working-days";

import { toneClass, turnTone } from "./turn";

/**
 * `D65` — **the coordinator's dashboard leads with Requests: one heading, two
 * columns.** Quotation requests needing issuing on one side, dispatch requests
 * needing a decision on the other, **oldest first in each**.
 *
 * They sit beside each other rather than interleaved because they are
 * different work — issuing is a task, deciding a dispatch is a judgement — and
 * one merged queue would ask her to switch between the two on every row.
 *
 * **This replaces the notifications list that stood under *Waiting on you*.**
 * `D64` names that outright: *"`/` renders a notifications list under that
 * heading, which is not this block."* It was 25 rows of *"A decision ended
 * your work"* for a rep who owed nothing — news, which `S92` says belongs on
 * the bell, not work.
 *
 * **The block is `D64`'s, gated on `can_approve_quotation` OR `can_dispatch`;
 * each column then follows its own flag.** `D64` decides whether the block
 * appears and `D65` does not say what a holder of only one flag sees — but a
 * `can_dispatch`-only identity reading a quotation column would be reading
 * their own threads under a heading that claims to be a queue, because
 * `visibleQuotationThreadsFilter` scopes rather than empties. A column nobody
 * may act on is worse than no column. That is a decision this slice makes and
 * `DESIGN.md` now records it at `D65`.
 *
 * **Neither column writes a predicate.** The first composes
 * `listQuotationThreads({ awaitingIssue: true })`, whose condition is
 * `chain.ts`'s — a `requested` version sits at a position `chainOwner` says
 * the coordinator owes `[07 C2]`. The second is
 * `listDispatches({ status: "submitted" })`, already ordered oldest first as
 * the queue `S87` says it is.
 *
 * **`D65`'s day count — approved · issued · refused — is not built here.** It
 * is a fourth query and no row of this slice asked for it; it is recorded in
 * `WORKFLOW §5` rather than half-built.
 */
export async function RequestsBlock({
  session,
  locale,
  limit,
}: {
  session: AuthSession;
  locale: string;
  /** How much of each queue the dashboard shows before deferring. */
  limit: number;
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  const mayIssue = session.user.role.canApproveQuotation;
  const mayDecide = session.user.role.canDispatch;

  const [quotations, dispatches] = await Promise.all([
    mayIssue
      ? listQuotationThreads(session, { awaitingIssue: true })
      : Promise.resolve(null),
    mayDecide
      ? listDispatches(session, { status: "submitted" })
      : Promise.resolve(null),
  ]);

  /**
   * A timestamp rendered as the calendar day it happened on **in Riyadh** —
   * `riyadhDayOf` is that one definition, and the formatting then goes through
   * UTC so the day it produced is the day that renders.
   */
  const day = (at: Date) =>
    format.dateTime(new Date(`${riyadhDayOf(at)}T00:00:00Z`), {
      dateStyle: "medium",
      timeZone: "UTC",
    });

  return (
    <Card data-slot="today-requests">
      <CardHeader>
        <CardTitle className="text-start text-sm">
          {t("today.requests.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid items-start gap-x-8 gap-y-6 lg:grid-cols-2">
          {quotations ? (
            <Column
              slot="today-requests-quotations"
              label={t("today.requests.quotations")}
              total={quotations.total}
              shown={Math.min(limit, quotations.rows.length)}
              href="/quotations"
              seeAll={t("today.requests.seeAll")}
              empty={t("today.requests.quotationsEmpty")}
            >
              {quotations.rows.slice(0, limit).map((thread) => (
                <RecordRow
                  key={thread.id}
                  href={`/quotations/${thread.id}`}
                  title={
                    <span dir="auto">
                      {/* `S51`'s ladder — the reference, else the project,
                          else the company, which `S50` guarantees is there. */}
                      {thread.smacReference ??
                        (thread.projectNameEn
                          ? lookupName(
                              {
                                nameEn: thread.projectNameEn,
                                nameAr: thread.projectNameAr,
                              },
                              locale,
                            )
                          : thread.companyName)}
                    </span>
                  }
                  meta={<span dir="auto">{thread.companyName}</span>}
                  when={day(thread.createdAt)}
                />
              ))}
            </Column>
          ) : null}

          {dispatches ? (
            <Column
              slot="today-requests-dispatches"
              label={t("today.requests.dispatches")}
              total={dispatches.total}
              shown={Math.min(limit, dispatches.rows.length)}
              href="/dispatches?status=submitted"
              seeAll={t("today.requests.seeAll")}
              empty={t("today.requests.dispatchesEmpty")}
            >
              {dispatches.rows.slice(0, limit).map((row) => (
                <RecordRow
                  key={row.id}
                  href={`/dispatches/${row.id}`}
                  title={<span dir="auto">{row.companyName}</span>}
                  meta={
                    row.smacReference ? (
                      <span className="num" dir="ltr">
                        {row.smacReference}
                      </span>
                    ) : (
                      t("dispatches.fields.direct")
                    )
                  }
                  // Submitted and undecided by construction — the queue is
                  // what it is waiting in, so the tone reads that rather than
                  // deriving a second answer `[21 §7]`.
                  whenClassName={toneClass(turnTone({ overdue: true }))}
                  when={row.submittedAt ? day(row.submittedAt) : undefined}
                />
              ))}
            </Column>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/** One side of `D65`'s heading — its label, its rows, and what it is not. */
function Column({
  slot,
  label,
  total,
  shown,
  href,
  seeAll,
  empty,
  children,
}: {
  slot: string;
  label: string;
  total: number;
  shown: number;
  href: string;
  seeAll: string;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section data-slot={slot} className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-faint text-[10.5px] font-semibold tracking-[.09em] uppercase">
          {label}
          <span className="num ms-1.5" dir="ltr">
            {total}
          </span>
        </p>
        {total > shown ? (
          <Button asChild size="xs" variant="ghost">
            <Link href={href}>{seeAll}</Link>
          </Button>
        ) : null}
      </div>
      {total === 0 ? (
        <p className="text-muted-foreground mt-1 text-start text-[12.5px]">
          {empty}
        </p>
      ) : (
        <ul className="flex flex-col">{children}</ul>
      )}
    </section>
  );
}
