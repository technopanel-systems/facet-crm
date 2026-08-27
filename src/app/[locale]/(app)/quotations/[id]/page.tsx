import { notFound } from "next/navigation";
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";

import {
  Absent,
  DetailHeader,
  DetailRow,
  Fact,
  Facts,
  RecordRow,
} from "@/components/page-header";
import { Timeline } from "@/components/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatSqm } from "@/lib/decimal";
import { can, requireSession } from "@/lib/authz";
import { chainState } from "@/lib/chain";
import { listDispatches } from "@/lib/dispatches";
import {
  listProductClasses,
  listProductFireRatings,
  listProductSuppliers,
  listProductThicknesses,
  listServiceTypes,
} from "@/lib/lookups";
import { getQuotationThread } from "@/lib/quotations";
import { recordTimeline } from "@/lib/timeline";

import { ChainStrip } from "../../_components/chain-strip";
import { CommentBox } from "../../_components/comment-box";
import { ListPagination } from "../../_components/list-controls";
import { NextFollowUpPanel } from "../../_components/next-follow-up-panel";
import {
  RelatedCard,
  RELATED_CARD_LIMIT,
} from "../../_components/related-card";
import { SharingPanel } from "../../_components/sharing-panel";
import {
  TurnPanel,
  chainTurnKey,
  daysSince,
  dispatchTurnKey,
  dispatchTurnNames,
  initials,
} from "../../_components/turn";
import { ThreadActions } from "./thread-actions";
import { ThreadLines } from "./thread-lines";

export const dynamic = "force-dynamic";

export default async function QuotationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, id } = await params;
  const { page } = await searchParams;
  setRequestLocale(locale);

  const session = await requireSession();
  const thread = await getQuotationThread(session, id);
  if (!thread) notFound();

  const t = await getTranslations();
  const format = await getFormatter();
  const dash = t("common.none");

  // No colour list `[17 §2]` — the colour is typed on the line.
  const [
    suppliers,
    classes,
    fireRatings,
    thicknesses,
    services,
    dispatched,
    submitted,
    dispatches,
  ] = await Promise.all([
    listProductSuppliers(),
    listProductClasses(),
    listProductFireRatings(),
    listProductThicknesses(),
    listServiceTypes(),
    // The two inputs `getQuotationThread` cannot carry, because dispatch lives
    // in its own table `S132`. No new join: `listDispatches` already filters by
    // thread. Safe by construction — `visibleDispatchesFilter`'s thread-cascade
    // term means whoever can see this thread can see the dispatches against it,
    // so neither node can read hollow to someone who ought to see it filled.
    //
    // **`approved` is `won`** `S31` `S72` — goods have moved.
    listDispatches(session, { threadId: id, status: "approved" }),
    // **`submitted` is `ready to ship`** `S132` `S88` — the coordinator is
    // checking it. A `draft` is deliberately not asked for: `S132` says a draft
    // is the rep's own to edit `S125` and can sit for ever, so it is not a
    // place the deal has reached, and without that scope a rep would advance
    // his own chain by opening a form.
    listDispatches(session, { threadId: id, status: "submitted" }),
    // **The card, and it is a third query rather than a fold of the two
    // above.** Those two are counts resolved in SQL; picking the approved rows
    // out of an unfiltered page would be filtering after pagination, which
    // `CLAUDE.md` names as the defect that returns silently empty screens.
    // Default scope, so `S122`'s refused requests stay in the archive and
    // `S31`'s cancelled ones stay visible as history.
    listDispatches(session, { threadId: id }),
  ]);

  // `25 §9` — one thread per record. A quotation has no derived events of its
  // own on this screen (its versions are the card below), so this carries the
  // conversation, and it pages rather than capping: there is no full-history
  // route to send anyone to.
  const timeline = await recordTimeline(session, "quotation_thread", id, {
    page: Number(page) || 1,
  });

  const live = thread.live;
  // Editable only while the version is still `requested` and the thread is
  // open: once issued, the document exists in SMAC and a change is a new
  // version `[07 C2]`. The server enforces this; here it just stops offering.
  const editable = live.status === "requested" && !thread.endState;
  const isCoordinator = can(session, "canApproveQuotation");

  // `S132`'s chain position, from the one definition `[src/lib/chain.ts]`.
  const chain = chainState({
    versionStatus: live.status,
    endState: thread.endState,
    // `24 §"partial dispatches are the expected case"` — the question is
    // whether ANY has gone out, never how much. The remainder is deliberately
    // never shown as a number `D42`.
    hasDispatch: dispatched.total > 0,
    hasSubmittedDispatch: submitted.total > 0,
  });

  // `S50` — the project names this screen and the company is the state line
  // under it. Both are always there now, so neither falls back to the other.
  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        name={thread.projectName}
        state={thread.companyName}
        reference={live.smacReference ?? undefined}
        action={
          thread.endState ? (
            // A DOM marker, so `verify:routes` can tell the three end states
            // apart without reading a translated string (`CLAUDE.md`).
            <Badge
              data-end-state={thread.endState}
              variant={
                thread.endState === "rejected" ||
                thread.endState === "cancelled"
                  ? "destructive"
                  : "secondary"
              }
            >
              {t(`enums.quotationThreadEndState.${thread.endState}`)}
            </Badge>
          ) : undefined
        }
      />

      {/* The concept's `.chain-card`: the turn, then the six steps, then the
          explanation. `D24` makes the turn panel the most important element on
          the screen, and `D27`'s strip goes under it rather than beside it —
          the sentence says whose move it is, the strip says how far this has
          come and what happens next. Both read one `chainState()`. */}
      <Card>
        <CardContent className="flex flex-col gap-5.5">
          <TurnPanel
            who={initials(thread.raisedByName)}
            /* **Uncoloured, and that is `D6` rather than an omission.** The
               tone was amber wherever anybody owed the next action and calm
               where nobody did — which colours the OUTCOME, not how long
               something has waited. `/quotations` already reasoned this out
               for the same object and left its own figure grey: no document
               sets a lateness threshold for a quotation thread, `S67` removed
               the one date that might have looked like one, and the single
               threshold that exists `07 D5` covers one position of six and
               lives in `follow-ups.ts`. A tone invented here would become the
               number everyone believes in. */
            tone="calm"
            line={t(chainTurnKey(chain, isCoordinator), {
              name: thread.raisedByName,
            })}
            /* **What the figure actually measures, said truthfully.** This
               read *"Sitting here since 3 August"* from `thread.createdAt` —
               the age of the THREAD — beneath a line naming the position it is
               in now, so a thread raised in January and issued yesterday
               claimed to have sat at *quoted* for six months. There is no
               column recording when a position was entered, and inventing one
               is a column no rule asks for. So it says what it has: how long
               ago this was raised, which is exactly the figure `/quotations`
               puts in its own lead cell, from the same field. Absent where
               nothing waits — a duration under *"nothing outstanding"*
               contradicts itself. */
            detail={
              chain.owedBy === null
                ? undefined
                : t("quotations.detail.raisedDaysAgo", {
                    count: daysSince(thread.createdAt),
                  })
            }
          />
          <ChainStrip
            chain={chain}
            viewerIsCoordinator={isCoordinator}
            explain
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-start text-sm">
            {t("quotations.detail.details")}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Facts>
            {/* The title, always; the link only for someone who may open the
                project. A coordinator sees every quotation and none of the
                customer detail behind it `[16 §10]`. */}
            <Fact label={t("quotations.fields.project")} name="project">
              {thread.projectViewable ? (
                <Link
                  href={`/projects/${thread.projectId}`}
                  className="hover:underline"
                >
                  <span dir="auto">{thread.projectName}</span>
                </Link>
              ) : (
                <span dir="auto">{thread.projectName}</span>
              )}
            </Fact>
            <Fact label={t("quotations.fields.company")}>
              {thread.companyViewable ? (
                <Link
                  href={`/companies/${thread.companyId}`}
                  className="hover:underline"
                >
                  <span dir="auto">{thread.companyName}</span>
                </Link>
              ) : (
                <span dir="auto">{thread.companyName}</span>
              )}
            </Fact>
            <Fact label={t("quotations.fields.contact")}>
              {thread.contactName ? (
                <span dir="auto">{thread.contactName}</span>
              ) : (
                dash
              )}
            </Fact>
            <Fact label={t("quotations.fields.raisedBy")}>
              <span dir="auto">{thread.raisedByName}</span>
            </Fact>
            <Fact label={t("quotations.detail.raisedOn")} numeric>
              {format.dateTime(thread.createdAt, { dateStyle: "medium" })}
            </Fact>

            {thread.endState === "cancelled" ? (
              <>
                <Fact label={t("quotations.detail.cancelledBy")}>
                  <span dir="auto">
                    {thread.cancelledByName ?? t("common.unknownUser")}
                  </span>
                </Fact>
                {/* A sentence, not a datum `D70` — it spans the grid rather
                    than being squeezed into one column. */}
                <Fact label={t("quotations.detail.cancellationReason")} wide>
                  <span dir="auto">{thread.cancellationReason ?? dash}</span>
                </Fact>
              </>
            ) : null}
          </Facts>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-start text-sm">
            {t("quotations.detail.liveVersion")} · {live.versionNumber}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Facts>
            <Fact label={t("quotations.fields.versionStatus")}>
              <Badge variant="outline">
                {t(`enums.quotationVersionStatus.${live.status}`)}
              </Badge>
            </Fact>
            <Fact label={t("quotations.fields.reference")}>
              <span dir="ltr" className="num">
                {live.smacReference ?? dash}
              </span>
              {live.smacReference ? (
                <span className="text-muted-foreground ms-2 text-xs">
                  {t(
                    `enums.smacVerification.${live.smacReferenceVerification}`,
                  )}
                </span>
              ) : null}
            </Fact>
            <Fact label={t("quotations.fields.origin")}>
              {t(`enums.quotationVersionOrigin.${live.origin}`)}
            </Fact>
            {live.returnForEditRound > 0 ? (
              <Fact label={t("quotations.detail.returnedRounds")} numeric>
                <span dir="ltr">{live.returnForEditRound}</span>
              </Fact>
            ) : null}
            {/* `S118` — what this version is drawn from. On the version and
                not the thread, because `S120` compares a dispatch against the
                version it was raised from. `name` is the DOM handle
                `verify:routes` asserts on, never the translated label. */}
            <Fact label={t("quotations.fields.stock")} name="stock">
              {t(`enums.stock.${live.stock}`)}
            </Fact>
            {/* Payment and shipment are the DISPATCH's `S70` `S119`, and the
                two Facts that used to sit here are gone with their columns.
                Nothing replaces them on a quotation: a quotation is not what
                either is a property of, and a derived echo of some dispatch's
                choice would be a figure this screen had to keep true. */}
          </Facts>

          <ThreadLines
            threadId={thread.id}
            lines={live.lines}
            serviceLines={live.serviceLines}
            options={{ suppliers, classes, fireRatings, thicknesses }}
            services={services}
            locale={locale}
            editable={editable}
          />

          {/* Calculated by FACET from the lines — nobody types a total
              `[16 §1]`. Where FACET and SMAC ever disagree, SMAC is correct
              `[08 D5]`. */}
          <div className="rounded-lg border p-4">
            <dl>
              <DetailRow label={t("quotations.detail.totalSqm")}>
                <span dir="ltr">
                  {live.totalSqm ? formatSqm(live.totalSqm) : dash}{" "}
                  {t("common.sqm")}
                </span>
              </DetailRow>
              <DetailRow label={t("quotations.detail.totalExclVat")}>
                <span dir="ltr">
                  {live.totalExclVat ?? dash} {t("common.sar")}
                </span>
              </DetailRow>
              <DetailRow label={t("quotations.detail.totalVat")}>
                <span dir="ltr">
                  {live.totalVat ?? dash} {t("common.sar")}
                </span>
              </DetailRow>
              <DetailRow label={t("quotations.fields.grandTotal")}>
                <span dir="ltr" className="font-semibold">
                  {live.grandTotal ?? dash} {t("common.sar")}
                </span>
              </DetailRow>
            </dl>
            <p className="text-muted-foreground mt-2 text-start text-xs">
              {t("quotations.detail.computed")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* **Full width, above the split, and that is `D70` read the right way
          round.** The two columns are balanced by height, and the narrow one is
          where things a reader READS go. `S62`'s five acts — issue, return,
          accept, reject, cancel — are what the coordinator opens this screen to
          do, and a 1fr rail is not where the work goes. `ThreadActions` renders
          nothing at all for a rep on a closed thread, so an identity with no
          act available gets no shell `D70`. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-start text-sm">
            {t("common.actions")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ThreadActions
            threadId={thread.id}
            isCoordinator={isCoordinator}
            liveStatus={live.status}
            endState={thread.endState}
            nextVersionNumber={live.versionNumber + 1}
          />
        </CardContent>
      </Card>

      {/* `D24` — related records as cards, in the concept's two-column grid,
          **balanced by height** `D70`. The conversation is the long side: on a
          thread it is what this screen exists to replace WhatsApp for. */}
      <div className="grid items-start gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="flex flex-col gap-4">
          {/* `25 §9` — the thread the rep and the coordinator coordinate in,
              and `25 §13`'s return-for-edit reason lands in this same
              conversation rather than in a field of its own `S62`. */}
          <Timeline
            events={timeline.events}
            total={timeline.total}
            composer={
              <CommentBox
                session={session}
                recordType="quotation_thread"
                recordId={thread.id}
              />
            }
          />
          <ListPagination
            basePath={`/quotations/${thread.id}`}
            page={timeline.page}
            total={timeline.total}
          />
        </div>

        <div className="flex flex-col gap-4">
          {/* `S77` — one quotation produces any number of dispatches. The
              thread had no way to reach any of them: `/dispatches` links here
              and nothing linked back. Every row is the company page's
              dispatches card exactly — `D26`'s square metres, and one ladder in
              `turn.tsx` `[dispatchTurnKey]` — rather than a third variant. */}
          <RelatedCard
            title={t("dispatches.title")}
            total={dispatches.total}
            href={`/dispatches?threadId=${thread.id}`}
            empty={t("quotations.detail.noDispatches")}
          >
            {dispatches.rows.slice(0, RELATED_CARD_LIMIT).map((row) => (
              <RecordRow
                key={row.id}
                href={`/dispatches/${row.id}`}
                title={
                  <span className="num" dir="ltr">
                    {row.smacReference ?? dash}
                  </span>
                }
                // `D26` — a submitted request owes the coordinator `S72`; an
                // approved, refused or cancelled one owes nobody. Five states,
                // three answers.
                meta={t(
                  dispatchTurnKey(row.status),
                  dispatchTurnNames(row.status)
                    ? {
                        name:
                          (row.status === "approved"
                            ? row.approvedByName
                            : row.recordedByName) ?? dash,
                      }
                    : undefined,
                )}
                // `D26`'s lead figure — how much went out, mono.
                when={`${formatSqm(row.sqm)} ${t("common.sqm")}`}
              />
            ))}
          </RelatedCard>

          {/* `S66` — a revision carries an RE number and supersedes the
              previous one. This was a six-column `<Table>` inside a card, which
              is the list archetype `D24` puts on a list screen; a related
              record on a detail screen is a `RecordRow`.

              **A plain card, not a `RelatedCard`, and neither half of that
              component would be honest here.** `RELATED_CARD_LIMIT` exists for
              a card whose rest live behind a filtered list `D70`, and no route
              lists one thread's versions — a cap would hide rows with no way to
              them. Nor can this card ever be empty: `S52` creates version 1
              when the thread is raised, so an empty sentence would be a string
              nothing can render. A version history is bounded by revisions
              `S66`, which are rare. */}
          <Card
            data-slot="version-history"
            data-total={String(thread.versions.length)}
          >
            <CardHeader>
              <CardTitle className="text-start text-sm">
                {t("quotations.detail.versionHistory")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col">
                {thread.versions.map((version) => (
                  <RecordRow
                    key={version.id}
                    title={
                      version.smacReference ? (
                        <span className="num" dir="ltr">
                          {version.smacReference}
                        </span>
                      ) : (
                        <Absent>{t("quotations.fields.endStateOpen")}</Absent>
                      )
                    }
                    meta={[
                      `${t("quotations.fields.version")} ${version.versionNumber}`,
                      t(`enums.quotationVersionStatus.${version.status}`),
                      t(`enums.quotationVersionOrigin.${version.origin}`),
                    ].join(" · ")}
                    when={
                      version.grandTotal
                        ? `${version.grandTotal} ${t("common.sar")}`
                        : undefined
                    }
                    action={
                      version.status === "superseded" ? (
                        <Button asChild size="xs" variant="ghost">
                          <Link
                            href={`/quotations/${thread.id}/versions/${version.id}`}
                          >
                            {t("common.view")}
                          </Link>
                        </Button>
                      ) : undefined
                    }
                  />
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* `25 §18` — the rep's own date. On a thread it suppresses both the
              no-response chase and `22 §6.11`'s returned-for-edits one until it
              arrives, which is the escape hatch for a rep who has nothing to
              change: they say when they will get to it, and the queue believes
              them. */}
          <NextFollowUpPanel
            session={session}
            recordType="quotation_thread"
            recordId={thread.id}
            value={thread.nextFollowUpAt}
          />

          {/* Sharing `[07 B1]`, `[07 B2]`. A thread share is the narrowest of
              the three: it reveals this conversation and its dispatches
              `[18 §2]`, and neither the project it was raised on nor the
              company behind it. A rep brought in to help with one quotation
              gets one quotation. */}
          <SharingPanel
            session={session}
            recordType="quotation_thread"
            recordId={thread.id}
          />
        </div>
      </div>
    </div>
  );
}
