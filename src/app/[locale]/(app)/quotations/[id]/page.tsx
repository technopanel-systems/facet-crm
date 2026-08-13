import { notFound } from "next/navigation";
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";

import {
  DetailHeader,
  DetailRow,
  Fact,
  Facts,
} from "@/components/page-header";
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
import { bilingualName } from "@/lib/lookups";
import {
  listProductClasses,
  listProductFireRatings,
  listProductSuppliers,
  listProductThicknesses,
  listServiceTypes,
} from "@/lib/lookups";
import { getQuotationThread } from "@/lib/quotations";

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
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await requireSession();
  // Also runs the expiry sweep `[16 §3]`.
  const thread = await getQuotationThread(session, id);
  if (!thread) notFound();

  const t = await getTranslations();
  const format = await getFormatter();
  const dash = t("common.none");

  // No colour list `[17 §2]` — the colour is typed on the line.
  const [suppliers, classes, fireRatings, thicknesses, services] =
    await Promise.all([
      listProductSuppliers(),
      listProductClasses(),
      listProductFireRatings(),
      listProductThicknesses(),
      listServiceTypes(),
    ]);

  const live = thread.live;
  // Editable only while the version is still `requested` and the thread is
  // open: once issued, the document exists in SMAC and a change is a new
  // version `[07 C2]`. The server enforces this; here it just stops offering.
  const editable = live.status === "requested" && !thread.endState;
  const isCoordinator = can(session, "canApproveQuotation");

  // `25 §3`'s chain position, from the one definition `[src/lib/chain.ts]`.
  // `hasDispatch` is deliberately not passed: this page does not load
  // dispatches, so the chain stops at `paid` rather than claiming a position
  // it cannot see.
  const chain = chainState({
    versionStatus: live.status,
    endState: thread.endState,
    paymentConfirmedAt: thread.paymentConfirmedAt,
  });

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        name={bilingualName(
          { nameEn: thread.projectNameEn, nameAr: thread.projectNameAr },
          locale,
        )}
        state={bilingualName(
          { nameEn: thread.companyNameEn, nameAr: thread.companyNameAr },
          locale,
        )}
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

      {/* `22 §3` — the most important element on the screen. Every input is
          already in scope: the chain reads `live.status`, `endState` and
          `paymentConfirmedAt`, and `22 §6.6`'s chain STRIP stays deferred —
          naming the turn is the archetype, drawing the six steps is not. */}
      <TurnPanel
        who={initials(thread.raisedByName)}
        tone={chain.owedBy === null ? "calm" : "soon"}
        line={t(chainTurnKey(chain, isCoordinator), {
          name: thread.raisedByName,
        })}
        detail={t("quotations.detail.turnSince", {
          date: format.dateTime(
            thread.paymentConfirmedAt ?? thread.createdAt,
            { dateStyle: "long" },
          ),
        })}
      />

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
            <Fact label={t("quotations.fields.project")}>
              {thread.projectViewable ? (
                <Link
                  href={`/projects/${thread.projectId}`}
                  className="hover:underline"
                >
                  {bilingualName(
                    {
                      nameEn: thread.projectNameEn,
                      nameAr: thread.projectNameAr,
                    },
                    locale,
                  )}
                </Link>
              ) : (
                bilingualName(
                  { nameEn: thread.projectNameEn, nameAr: thread.projectNameAr },
                  locale,
                )
              )}
            </Fact>
            <Fact label={t("quotations.fields.company")}>
              {thread.companyViewable ? (
                <Link
                  href={`/companies/${thread.companyId}`}
                  className="hover:underline"
                >
                  {bilingualName(
                    {
                      nameEn: thread.companyNameEn,
                      nameAr: thread.companyNameAr,
                    },
                    locale,
                  )}
                </Link>
              ) : (
                bilingualName(
                  { nameEn: thread.companyNameEn, nameAr: thread.companyNameAr },
                  locale,
                )
              )}
            </Fact>
            <Fact label={t("quotations.fields.contact")}>
              {thread.contactNameEn
                ? bilingualName(
                    {
                      nameEn: thread.contactNameEn,
                      nameAr: thread.contactNameAr,
                    },
                    locale,
                  )
                : dash}
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
            <Fact label={t("quotations.fields.validUntil")}>
              <span dir="ltr">{live.validUntil ?? dash}</span>
            </Fact>
            {live.returnForEditRound > 0 ? (
              <Fact label={t("quotations.detail.returnedRounds")}>
                <span dir="ltr">{live.returnForEditRound}</span>
              </Fact>
            ) : null}
            <Fact label={t("quotations.fields.deliveryPeriod")}>
              {live.deliveryPeriod ?? dash}
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
    </div>
  );
}
