import { notFound } from "next/navigation";
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";

import { DetailRow, PageHeader } from "@/components/page-header";
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
import { bilingualName } from "@/lib/lookups";
import {
  listProductClasses,
  listProductColours,
  listProductFireRatings,
  listProductSuppliers,
  listProductThicknesses,
  listServiceTypes,
} from "@/lib/lookups";
import { getQuotationThread } from "@/lib/quotations";

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

  const [suppliers, classes, fireRatings, colours, thicknesses, services] =
    await Promise.all([
      listProductSuppliers(),
      listProductClasses(),
      listProductFireRatings(),
      listProductColours(),
      listProductThicknesses(),
      listServiceTypes(),
    ]);

  const live = thread.live;
  // Editable only while the version is still `requested` and the thread is
  // open: once issued, the document exists in SMAC and a change is a new
  // version `[07 C2]`. The server enforces this; here it just stops offering.
  const editable = live.status === "requested" && !thread.endState;
  const isCoordinator = can(session, "canApproveQuotation");

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <PageHeader
        title={live.smacReference ?? t("quotations.fields.endStateOpen")}
        description={`${bilingualName(
          { nameEn: thread.projectNameEn, nameAr: thread.projectNameAr },
          locale,
        )} · ${bilingualName(
          { nameEn: thread.companyNameEn, nameAr: thread.companyNameAr },
          locale,
        )}`}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-start text-sm">
            {t("quotations.detail.details")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            {/* The title, always; the link only for someone who may open the
                project. A coordinator sees every quotation and none of the
                customer detail behind it `[16 §10]`. */}
            <DetailRow label={t("quotations.fields.project")}>
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
            </DetailRow>
            <DetailRow label={t("quotations.fields.company")}>
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
            </DetailRow>
            <DetailRow label={t("quotations.fields.contact")}>
              {thread.contactNameEn
                ? bilingualName(
                    {
                      nameEn: thread.contactNameEn,
                      nameAr: thread.contactNameAr,
                    },
                    locale,
                  )
                : dash}
            </DetailRow>
            <DetailRow label={t("quotations.fields.raisedBy")}>
              {thread.raisedByName}
            </DetailRow>
            <DetailRow label={t("quotations.detail.raisedOn")}>
              {format.dateTime(thread.createdAt, { dateStyle: "medium" })}
            </DetailRow>

            {/* Payment and acceptance-for-processing are where the CUSTOMER
                commits `[16 §5]` — the end state above is internal approval. */}
            <DetailRow label={t("quotations.detail.paymentConfirmedAt")}>
              {thread.paymentConfirmedAt ? (
                format.dateTime(thread.paymentConfirmedAt, {
                  dateStyle: "medium",
                })
              ) : (
                <span className="text-muted-foreground">
                  {t("quotations.detail.notConfirmed")}
                </span>
              )}
            </DetailRow>
            {thread.paymentConfirmedByName ? (
              <DetailRow label={t("quotations.detail.paymentConfirmedBy")}>
                {thread.paymentConfirmedByName}
              </DetailRow>
            ) : null}
            <DetailRow label={t("quotations.detail.acceptedForProcessing")}>
              {thread.acceptedForProcessingAt
                ? format.dateTime(thread.acceptedForProcessingAt, {
                    dateStyle: "medium",
                  })
                : dash}
            </DetailRow>

            {thread.endState === "cancelled" ? (
              <>
                <DetailRow label={t("quotations.detail.cancelledBy")}>
                  {thread.cancelledByName ?? t("common.unknownUser")}
                </DetailRow>
                <DetailRow label={t("quotations.detail.cancellationReason")}>
                  {thread.cancellationReason ?? dash}
                </DetailRow>
              </>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-start text-sm">
            {t("quotations.detail.liveVersion")} · {live.versionNumber}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <dl>
            <DetailRow label={t("quotations.fields.versionStatus")}>
              <Badge variant="outline">
                {t(`enums.quotationVersionStatus.${live.status}`)}
              </Badge>
            </DetailRow>
            <DetailRow label={t("quotations.fields.reference")}>
              <span dir="ltr">{live.smacReference ?? dash}</span>
              {live.smacReference ? (
                <span className="text-muted-foreground ms-2 text-xs">
                  {t(
                    `enums.smacVerification.${live.smacReferenceVerification}`,
                  )}
                </span>
              ) : null}
            </DetailRow>
            <DetailRow label={t("quotations.fields.origin")}>
              {t(`enums.quotationVersionOrigin.${live.origin}`)}
            </DetailRow>
            <DetailRow label={t("quotations.fields.validUntil")}>
              <span dir="ltr">{live.validUntil ?? dash}</span>
            </DetailRow>
            {live.returnForEditRound > 0 ? (
              <DetailRow label={t("quotations.detail.returnedRounds")}>
                <span dir="ltr">{live.returnForEditRound}</span>
              </DetailRow>
            ) : null}
            <DetailRow label={t("quotations.fields.deliveryPeriod")}>
              {live.deliveryPeriod ?? dash}
            </DetailRow>
            <DetailRow label={t("quotations.fields.paymentMethod")}>
              {live.paymentMethod ?? dash}
            </DetailRow>
            <DetailRow label={t("quotations.fields.shipmentTerms")}>
              {live.shipmentTerms ?? dash}
            </DetailRow>
          </dl>

          <ThreadLines
            threadId={thread.id}
            lines={live.lines}
            serviceLines={live.serviceLines}
            options={{ suppliers, classes, fireRatings, colours, thicknesses }}
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
    </main>
  );
}
