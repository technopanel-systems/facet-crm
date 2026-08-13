import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { DetailRow, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import { bilingualName } from "@/lib/lookups";
import { getReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await requireSession();
  const report = await getReport(session, id);
  if (!report) notFound();

  const t = await getTranslations();
  const format = await getFormatter();
  const dash = t("common.none");

  const day = (value: string) =>
    format.dateTime(new Date(`${value}T00:00:00Z`), {
      dateStyle: "medium",
      timeZone: "UTC",
    });

  const companyName = report.companyNameEn
    ? bilingualName(
        { nameEn: report.companyNameEn, nameAr: report.companyNameAr },
        locale,
      )
    : null;
  const projectName = report.projectNameEn
    ? bilingualName(
        { nameEn: report.projectNameEn, nameAr: report.projectNameAr },
        locale,
      )
    : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("reports.detail.title")}
        description={
          report.entryType === "interaction"
            ? t("reports.detail.interactionHint")
            : t("reports.detail.fieldNoteHint")
        }
        action={
          // `20 §9` — only the author corrects a report. The data layer
          // refuses either way; this simply does not offer it.
          report.isAuthor ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/reports/${report.id}/edit`}>{t("common.edit")}</Link>
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-start text-sm">
            {t(`enums.reportEntryType.${report.entryType}`)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col">
            <DetailRow label={t("reports.fields.reportDate")}>
              <span dir="ltr">{day(report.reportDate)}</span>
            </DetailRow>
            <DetailRow label={t("reports.fields.author")}>
              {report.userName}
            </DetailRow>

            {report.entryType === "interaction" ? (
              <>
                <DetailRow label={t("reports.fields.company")}>
                  {companyName === null ? null : report.companyViewable ? (
                    <Link
                      href={`/companies/${report.companyId}`}
                      className="hover:underline"
                    >
                      {companyName}
                    </Link>
                  ) : (
                    companyName
                  )}
                </DetailRow>
                <DetailRow label={t("reports.fields.contact")}>
                  {report.contactNameEn
                    ? bilingualName(
                        {
                          nameEn: report.contactNameEn,
                          nameAr: report.contactNameAr,
                        },
                        locale,
                      )
                    : null}
                </DetailRow>
                <DetailRow label={t("reports.fields.project")}>
                  {projectName === null ? null : report.projectViewable ? (
                    <Link
                      href={`/projects/${report.projectId}`}
                      className="hover:underline"
                    >
                      {projectName}
                    </Link>
                  ) : (
                    projectName
                  )}
                </DetailRow>
                <DetailRow label={t("reports.fields.channel")}>
                  {report.channel
                    ? t(`enums.reportChannel.${report.channel}`)
                    : null}
                </DetailRow>
                <DetailRow label={t("reports.fields.outcome")}>
                  {report.outcome
                    ? t(`enums.reportOutcome.${report.outcome}`)
                    : null}
                </DetailRow>
                {report.onHoldUntil ? (
                  <DetailRow label={t("reports.fields.onHoldUntil")}>
                    <span dir="ltr">{day(report.onHoldUntil)}</span>
                  </DetailRow>
                ) : null}
              </>
            ) : (
              <>
                <DetailRow label={t("reports.fields.category")}>
                  {report.category
                    ? t(`enums.fieldNoteCategory.${report.category}`)
                    : null}
                </DetailRow>
                <DetailRow label={t("reports.fields.city")}>
                  {report.cityNameEn
                    ? bilingualName(
                        { nameEn: report.cityNameEn, nameAr: report.cityNameAr },
                        locale,
                      )
                    : null}
                </DetailRow>
              </>
            )}
          </dl>

          {report.onHoldUntil ? (
            <p className="text-muted-foreground mt-4 text-start text-xs">
              {t("reports.detail.onHoldHint")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-start text-sm">
            {t("reports.fields.narrative")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* The rep's own words, kept as typed. */}
          <p className="text-start text-sm whitespace-pre-wrap">
            {report.narrative}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-start text-sm">
            {t("reports.fields.signals")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {report.signals.length === 0 ? (
            <p className="text-muted-foreground text-start text-sm">
              {t("reports.detail.noSignals")}
            </p>
          ) : (
            <ul className="flex flex-col">
              {report.signals.map((signal) => (
                <li
                  key={signal.signal}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b py-2.5 last:border-b-0"
                >
                  <Badge variant="outline">
                    {t(`enums.reportSignal.${signal.signal}`)}
                  </Badge>
                  <span className="text-muted-foreground text-sm">
                    {signal.reference ?? dash}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-muted-foreground mt-4 text-start text-xs">
            {t("reports.detail.signalsHint")}
          </p>
        </CardContent>
      </Card>

      {!report.isAuthor ? (
        <p className="text-muted-foreground text-start text-xs">
          {t("reports.detail.authorOnlyHint")}
        </p>
      ) : null}
    </div>
  );
}
