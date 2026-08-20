import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  DetailRow,
  Fact,
  Facts,
  DetailHeader,
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
import { requireSession } from "@/lib/authz";
import { getQuotationVersion } from "@/lib/quotations";

import { lineLabel } from "../../../line-display";

export const dynamic = "force-dynamic";

/**
 * A superseded version.
 *
 * Read-only, with no editing offered anywhere on the page: earlier versions
 * stay read-only and only the latest is live `[07 C2]`. This is the history a
 * rep wants when a quotation comes back different from what was requested —
 * the original ask, still legible next to what was actually issued `[10 §4]`.
 */
export default async function QuotationVersionPage({
  params,
}: {
  params: Promise<{ locale: string; id: string; versionId: string }>;
}) {
  const { locale, id, versionId } = await params;
  setRequestLocale(locale);

  const session = await requireSession();
  const version = await getQuotationVersion(session, id, versionId);
  if (!version) notFound();

  const t = await getTranslations();
  const dash = t("common.none");

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        name={`${t("quotations.fields.version")} ${version.versionNumber}`}
        state={t(`enums.quotationVersionStatus.${version.status}`)}
        reference={version.smacReference ?? undefined}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={`/quotations/${id}`}>{t("common.back")}</Link>
          </Button>
        }
      />

      <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-start text-sm">
        {t("quotations.detail.readOnly")}
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-start text-sm">
            {t("quotations.detail.details")}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Facts>
            <Fact label={t("quotations.fields.versionStatus")}>
              <Badge variant="outline">
                {t(`enums.quotationVersionStatus.${version.status}`)}
              </Badge>
            </Fact>
            <Fact label={t("quotations.fields.reference")}>
              <span dir="ltr">{version.smacReference ?? dash}</span>
            </Fact>
            <Fact label={t("quotations.fields.origin")}>
              {t(`enums.quotationVersionOrigin.${version.origin}`)}
            </Fact>
            <Fact label={t("common.createdBy")}>
              {version.createdByName ?? t("common.unknownUser")}
            </Fact>
          </Facts>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-start text-sm">
            {t("quotations.detail.lines")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">
                    {t("quotations.detail.product")}
                  </TableHead>
                  <TableHead numeric>
                    {t("quotations.detail.quantityPcs")}
                  </TableHead>
                  <TableHead numeric>{t("quotations.detail.sqm")}</TableHead>
                  <TableHead numeric>
                    {t("quotations.detail.unitPrice")}
                  </TableHead>
                  <TableHead numeric>
                    {t("quotations.detail.lineTotal")}
                  </TableHead>
                  <TableHead numeric>
                    {t("quotations.detail.vatAmount")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {version.lines.map((line) => (
                  <TableRow key={line.id}>
                    {/* Readable parts, not a rebuilt SMAC code `S53`. */}
                    <TableCell className="text-start" dir="auto">
                      {lineLabel(line, locale)}
                    </TableCell>
                    <TableCell numeric dir="ltr">
                      {line.quantityPcs}
                    </TableCell>
                    <TableCell numeric dir="ltr">
                      {line.sqm ?? dash}
                    </TableCell>
                    <TableCell numeric dir="ltr">
                      {line.unitPrice ?? dash}
                    </TableCell>
                    <TableCell numeric dir="ltr">
                      {line.lineTotal ?? dash}
                    </TableCell>
                    <TableCell numeric dir="ltr">
                      {line.vatAmount ?? dash}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {version.serviceLines.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">
                      {t("quotations.detail.service")}
                    </TableHead>
                    <TableHead className="text-start">
                      {t("quotations.detail.serviceQuantity")}
                    </TableHead>
                    <TableHead className="text-start">
                      {t("quotations.detail.unitPrice")}
                    </TableHead>
                    <TableHead className="text-start">
                      {t("quotations.detail.lineTotal")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {version.serviceLines.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="text-start">
                        {locale === "ar"
                          ? service.serviceNameAr || service.serviceNameEn
                          : service.serviceNameEn}
                      </TableCell>
                      <TableCell className="text-start" dir="ltr">
                        {service.quantity}
                      </TableCell>
                      <TableCell className="text-start" dir="ltr">
                        {service.unitPrice ?? dash}
                      </TableCell>
                      <TableCell className="text-start" dir="ltr">
                        {service.lineTotal ?? dash}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          <div className="rounded-lg border p-4">
            <dl>
              <DetailRow label={t("quotations.detail.totalSqm")}>
                <span dir="ltr">
                  {version.totalSqm ?? dash} {t("common.sqm")}
                </span>
              </DetailRow>
              <DetailRow label={t("quotations.detail.totalExclVat")}>
                <span dir="ltr">
                  {version.totalExclVat ?? dash} {t("common.sar")}
                </span>
              </DetailRow>
              <DetailRow label={t("quotations.detail.totalVat")}>
                <span dir="ltr">
                  {version.totalVat ?? dash} {t("common.sar")}
                </span>
              </DetailRow>
              <DetailRow label={t("quotations.fields.grandTotal")}>
                <span dir="ltr" className="font-semibold">
                  {version.grandTotal ?? dash} {t("common.sar")}
                </span>
              </DetailRow>
            </dl>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
