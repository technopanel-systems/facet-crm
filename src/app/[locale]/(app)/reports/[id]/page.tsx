import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import {
  DetailHeader,
  Fact,
  Facts,
  RecordRow,
} from "@/components/page-header";
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
import { lookupName } from "@/lib/lookups";
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

  const companyName = report.companyName;
  const projectName = report.projectName;

  return (
    <div className="flex flex-col gap-6">
      {/* The company names an interaction; a field note belongs to no
          customer `[20 §2]`, so it is named by what it is. Either way the
          header names the record rather than the screen. */}
      <DetailHeader
        name={companyName ?? t(`enums.reportEntryType.${report.entryType}`)}
        state={`${day(report.reportDate)} · ${report.userName}`}
        action={
          // `S39` — the author, on the day they wrote it. The data layer
          // refuses either way; this simply does not offer it.
          report.editable ? (
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
        <CardContent className="px-0">
          <Facts>
            <Fact label={t("reports.fields.reportDate")}>
              <span dir="ltr">{day(report.reportDate)}</span>
            </Fact>
            <Fact label={t("reports.fields.author")}>
              {report.userName}
            </Fact>

            {report.entryType === "interaction" ? (
              <>
                <Fact label={t("reports.fields.company")}>
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
                </Fact>
                <Fact label={t("reports.fields.contact")}>
                  {report.contactName}
                </Fact>
                <Fact label={t("reports.fields.project")}>
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
                </Fact>
                <Fact label={t("reports.fields.channel")}>
                  {report.channel
                    ? t(`enums.reportChannel.${report.channel}`)
                    : null}
                </Fact>
                <Fact label={t("reports.fields.outcome")}>
                  {report.outcome
                    ? t(`enums.reportOutcome.${report.outcome}`)
                    : null}
                </Fact>
                {report.onHoldUntil ? (
                  <Fact label={t("reports.fields.onHoldUntil")}>
                    <span dir="ltr">{day(report.onHoldUntil)}</span>
                  </Fact>
                ) : null}
              </>
            ) : (
              <>
                <Fact label={t("reports.fields.category")}>
                  {report.category
                    ? t(`enums.fieldNoteCategory.${report.category}`)
                    : null}
                </Fact>
                <Fact label={t("reports.fields.city")}>
                  {report.cityNameEn
                    ? lookupName({ nameEn: report.cityNameEn, nameAr: report.cityNameAr }, locale)
                    : null}
                </Fact>
              </>
            )}
          </Facts>

          {report.onHoldUntil ? (
            <p className="text-muted-foreground mt-4 text-start text-xs">
              {t("reports.detail.onHoldHint")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* The note half `[S38]`. A viewer who may not read it never receives
          it — the data layer withholds the column — and the card is absent
          entirely rather than greyed out or locked `[D47]`. */}
      {report.narrative === null ? null : (
        <Card>
          <CardHeader>
            <CardTitle className="text-start text-sm">
              {t("reports.fields.narrative")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* The rep's own words, kept as typed, as a quote block `[D47]`. */}
            <blockquote className="border-s-2 ps-4">
              <p
                dir="auto"
                className="text-start text-sm whitespace-pre-wrap"
              >
                {report.narrative}
              </p>
            </blockquote>
          </CardContent>
        </Card>
      )}

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
                <RecordRow
                  key={signal.signal}
                  title={
                    <Badge variant="outline">
                      {t(`enums.reportSignal.${signal.signal}`)}
                    </Badge>
                  }
                  when={signal.reference ?? dash}
                />
              ))}
            </ul>
          )}
          <p className="text-muted-foreground mt-4 text-start text-xs">
            {t("reports.detail.signalsHint")}
          </p>
        </CardContent>
      </Card>

      {/* D47 makes the note absent; absence is not secret. A reader who
          cannot tell a withheld note from a rep who wrote nothing has been
          misinformed rather than protected — so the page foot says whose the
          note is, away from where the note itself would have been. */}
      {!report.isAuthor ? (
        <p className="text-muted-foreground text-start text-xs">
          {t("reports.detail.authorOnlyHint")}
        </p>
      ) : report.editable ? null : (
        <p className="text-muted-foreground text-start text-xs">
          {t("reports.detail.standsHint")}
        </p>
      )}
    </div>
  );
}
