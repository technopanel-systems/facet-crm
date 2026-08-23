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
} from "@/components/page-header";
import { Timeline } from "@/components/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { can, requireSession } from "@/lib/authz";
import { chainState } from "@/lib/chain";
import { listDispatches } from "@/lib/dispatches";
import { lookupName } from "@/lib/lookups";
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
import { SharingPanel } from "../../_components/sharing-panel";
import {
  TurnPanel,
  chainTurnKey,
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
  const [suppliers, classes, fireRatings, thicknesses, services, dispatched] =
    await Promise.all([
      listProductSuppliers(),
      listProductClasses(),
      listProductFireRatings(),
      listProductThicknesses(),
      listServiceTypes(),
      // Whether anything has left the warehouse against this thread — the one
      // input `getQuotationThread` cannot carry, because dispatch lives in its
      // own table. No new query: `listDispatches` already filters by thread.
      // Safe by construction — `visibleDispatchesFilter`'s thread-cascade term
      // means whoever can see this thread can see the dispatches against it,
      // so the node cannot read hollow to someone who ought to see it filled.
      //
      // **`status: "approved"`** `S72`. The sixth node means goods have moved,
      // and a request sitting with the coordinator has moved nothing — without
      // this scope a rep would advance their own chain by asking.
      listDispatches(session, { threadId: id, status: "approved" }),
    ]);

  // `25 §9` — one thread per record. A quotation has no derived events of its
  // own on this screen (its versions are the table above), so this carries the
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

  // `25 §3`'s chain position, from the one definition `[src/lib/chain.ts]`.
  const chain = chainState({
    versionStatus: live.status,
    endState: thread.endState,
    paymentConfirmedAt: thread.paymentConfirmedAt,
    // `24 §"partial dispatches are the expected case"` — the question is
    // whether ANY has gone out, never how much. The remainder is deliberately
    // never shown as a number `[25 §26]`.
    hasDispatch: dispatched.total > 0,
  });

  // `S50` — a quotation may have no project. The project is what normally
  // names this screen; with none, the COMPANY does, which `S51` guarantees is
  // there, and the state line says what is missing and when it arrives. A
  // header reading "No project" would make the absence the loudest thing on a
  // screen that is about a quotation.
  const projectName = thread.projectNameEn
    ? lookupName(
        { nameEn: thread.projectNameEn, nameAr: thread.projectNameAr },
        locale,
      )
    : null;

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        name={projectName ?? thread.companyName}
        state={
          projectName
            ? thread.companyName
            : t("quotations.detail.noProjectState")
        }
        reference={live.smacReference ?? undefined}
        action={
          thread.endState ? (
            <Badge
              variant={
                thread.endState === "rejected" || thread.endState === "cancelled"
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
          explanation. `22 §3` makes the turn panel the most important element
          on the screen, and `22 §6.6`'s strip goes under it rather than beside
          it — the sentence says whose move it is, the strip says how far this
          has come and what happens next. Both read one `chainState()`. */}
      <Card>
        <CardContent className="flex flex-col gap-5.5">
          <TurnPanel
            who={initials(thread.raisedByName)}
            tone={chain.owedBy === null ? "calm" : "soon"}
            line={t(chainTurnKey(chain, isCoordinator), {
              name: thread.raisedByName,
            })}
            // "Sitting here since 3 August" under "Nothing outstanding —
            // dispatched" contradicts itself, and `22 §4` colours *how long
            // something has waited* — when nothing waits, there is no
            // duration to give. Newly reachable: before `hasDispatch` was
            // passed this page could not reach a position that owes nobody
            // except a closed one.
            detail={
              chain.owedBy === null
                ? undefined
                : t("quotations.detail.turnSince", {
                    date: format.dateTime(
                      thread.paymentConfirmedAt ?? thread.createdAt,
                      { dateStyle: "long" },
                    ),
                  })
            }
          />
          <ChainStrip chain={chain} viewerIsCoordinator={isCoordinator} explain />
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
              {projectName === null ? (
                <Absent>{t("quotations.detail.noProject")}</Absent>
              ) : thread.projectViewable ? (
                <Link
                  href={`/projects/${thread.projectId}`}
                  className="hover:underline"
                >
                  {projectName}
                </Link>
              ) : (
                projectName
              )}
            </Fact>
            <Fact label={t("quotations.fields.company")}>
              {thread.companyViewable ? (
                <Link
                  href={`/companies/${thread.companyId}`}
                  className="hover:underline"
                >
                  {thread.companyName}
                </Link>
              ) : (
                thread.companyName
              )}
            </Fact>
            <Fact label={t("quotations.fields.contact")}>
              {thread.contactName ?? dash}
            </Fact>
            <Fact label={t("quotations.fields.raisedBy")}>
              {thread.raisedByName}
            </Fact>
            <Fact label={t("quotations.detail.raisedOn")}>
              {format.dateTime(thread.createdAt, { dateStyle: "medium" })}
            </Fact>

            {/* Payment and acceptance-for-processing are where the CUSTOMER
                commits `[16 §5]` — the end state above is internal approval. */}
            <Fact label={t("quotations.detail.paymentConfirmedAt")}>
              {thread.paymentConfirmedAt ? (
                format.dateTime(thread.paymentConfirmedAt, {
                  dateStyle: "medium",
                })
              ) : (
                <span className="text-muted-foreground">
                  {t("quotations.detail.notConfirmed")}
                </span>
              )}
            </Fact>
            {thread.paymentConfirmedByName ? (
              <Fact label={t("quotations.detail.paymentConfirmedBy")}>
                {thread.paymentConfirmedByName}
              </Fact>
            ) : null}
            <Fact label={t("quotations.detail.acceptedForProcessing")}>
              {thread.acceptedForProcessingAt
                ? format.dateTime(thread.acceptedForProcessingAt, {
                    dateStyle: "medium",
                  })
                : dash}
            </Fact>

            {thread.endState === "cancelled" ? (
              <>
                <Fact label={t("quotations.detail.cancelledBy")}>
                  {thread.cancelledByName ?? t("common.unknownUser")}
                </Fact>
                <Fact label={t("quotations.detail.cancellationReason")}>
                  {thread.cancellationReason ?? dash}
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
              <span dir="ltr">{live.smacReference ?? dash}</span>
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
              <Fact label={t("quotations.detail.returnedRounds")}>
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
            <Fact label={t("quotations.fields.paymentMethod")}>
              {live.paymentMethod ?? dash}
            </Fact>
            <Fact label={t("quotations.fields.shipmentTerms")}>
              {live.shipmentTerms ?? dash}
            </Fact>
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
                  {live.totalSqm ?? dash} {t("common.sqm")}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-start text-sm">
            {t("quotations.detail.versionHistory")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">
                    {t("quotations.fields.version")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("quotations.fields.reference")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("quotations.fields.origin")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("quotations.fields.versionStatus")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("quotations.fields.grandTotal")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("common.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {thread.versions.map((version) => (
                  <TableRow key={version.id}>
                    <TableCell className="text-start" dir="ltr">
                      {version.versionNumber}
                    </TableCell>
                    <TableCell className="text-start" dir="ltr">
                      {version.smacReference ?? dash}
                    </TableCell>
                    <TableCell className="text-start">
                      {t(`enums.quotationVersionOrigin.${version.origin}`)}
                    </TableCell>
                    <TableCell className="text-start">
                      <Badge variant="outline">
                        {t(`enums.quotationVersionStatus.${version.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-start" dir="ltr">
                      {version.grandTotal
                        ? `${version.grandTotal} ${t("common.sar")}`
                        : dash}
                    </TableCell>
                    <TableCell className="text-start">
                      {version.status === "superseded" ? (
                        <Button asChild size="xs" variant="ghost">
                          <Link
                            href={`/quotations/${thread.id}/versions/${version.id}`}
                          >
                            {t("common.view")}
                          </Link>
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
            paymentConfirmed={Boolean(thread.paymentConfirmedAt)}
            acceptedForProcessing={Boolean(thread.acceptedForProcessingAt)}
          />
        </CardContent>
      </Card>

      {/* Sharing `[07 B1]`, `[07 B2]`. A thread share is the narrowest of the
          three: it reveals this conversation and its dispatches `[18 §2]`, and
          neither the project it was raised on nor the company behind it. A rep
          brought in to help with one quotation gets one quotation. */}
      <SharingPanel
        session={session}
        recordType="quotation_thread"
        recordId={thread.id}
      />

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

      {/* `25 §9` — the thread this screen exists to replace WhatsApp for. The
          rep and the coordinator coordinate a quotation here instead, and
          `25 §13`'s return-for-edit reason lands in this same conversation
          rather than in a field of its own. */}
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
  );
}
