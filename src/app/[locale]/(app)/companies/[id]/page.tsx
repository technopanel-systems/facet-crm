import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { DetailRow, PageHeader } from "@/components/page-header";
import { Timeline } from "@/components/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { can, listActiveUsers, requireSession } from "@/lib/authz";
import { getCompany, listCompanyReps } from "@/lib/companies";
import { listContacts } from "@/lib/contacts";
import { dormancyReviews, isCompanyQuiet } from "@/lib/dormancy";
import { bilingualName, pickName } from "@/lib/lookups";
import { listProjects } from "@/lib/projects";
import { companyOnHoldUntil } from "@/lib/reports";
import { getQuietThresholds } from "@/lib/settings";
import { companyTimeline, TIMELINE_CARD_LIMIT } from "@/lib/timeline";

import {
  archiveCompanyAction,
  reassignCompanyAction,
  reincludeCompanyAction,
} from "../actions";
import { DormancyPanel } from "./dormancy-panel";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await requireSession();
  const company = await getCompany(session, id);
  if (!company) notFound();

  const t = await getTranslations();
  const format = await getFormatter();
  const canAssign = can(session, "canAssign");
  const thresholds = await getQuietThresholds();

  const [
    reps,
    contacts,
    projects,
    timeline,
    onHoldUntil,
    quiet,
    reviews,
    assignableReps,
  ] = await Promise.all([
    listCompanyReps(company.id),
    // Scoped like any other contact read. Seeing the company is what grants
    // these `[14 §1]`, so on a shared company the second rep sees them too.
    listContacts(session, { companyId: company.id }),
    // And this is the opposite rule, on the same screen: `listProjects`
    // applies `visibleProjectsFilter`, which never consults company
    // membership. A rep holding this company through a share sees the company
    // and an EMPTY projects list `[04 Q7]`.
    listProjects(session, { companyId: company.id }),
    companyTimeline(session, company.id, { limit: TIMELINE_CARD_LIMIT }),
    // Derived on read, never stored on the company `[20 §5]`.
    companyOnHoldUntil(session, company.id),
    // The same derivation `follow-ups.ts` uses, not a second one `[21 §7]`.
    isCompanyQuiet(company.id, thresholds),
    dormancyReviews(company.id),
    canAssign ? listActiveUsers() : Promise.resolve([]),
  ]);

  const dash = t("common.none");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={bilingualName(company, locale)}
        description={
          company.archivedAt
            ? t("companies.detail.archived")
            : // `20 §5` — suppressed follow-ups are worth saying on the record
              // itself, not only on the coverage screen.
              onHoldUntil
              ? t("coverage.detail.onHoldUntil", { date: onHoldUntil })
              : undefined
        }
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={`/companies/${company.id}/edit`}>{t("common.edit")}</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-start text-sm">
            {t("companies.detail.details")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <DetailRow label={t("common.nameEn")}>{company.nameEn}</DetailRow>
            <DetailRow label={t("common.nameAr")}>
              {company.nameAr ?? dash}
            </DetailRow>
            <DetailRow label={t("common.phone")}>
              <span dir="ltr">{company.phone ?? dash}</span>
            </DetailRow>
            <DetailRow label={t("companies.fields.category")}>
              {pickName(locale, company.categoryNameEn, company.categoryNameAr) ??
                dash}
            </DetailRow>
            <DetailRow label={t("companies.fields.vatNumber")}>
              <span dir="ltr">{company.vatNumber ?? dash}</span>
            </DetailRow>
            <DetailRow label={t("common.region")}>
              {company.region ? t(`enums.region.${company.region}`) : dash}
            </DetailRow>
            <DetailRow label={t("common.city")}>
              {pickName(locale, company.cityNameEn, company.cityNameAr) ?? dash}
            </DetailRow>
            <DetailRow label={t("companies.fields.leadSource")}>
              {pickName(
                locale,
                company.leadSourceNameEn,
                company.leadSourceNameAr,
              ) ?? dash}
            </DetailRow>
            <DetailRow label={t("companies.fields.warmth")}>
              {company.warmth ? (
                <Badge variant="secondary">
                  {t(`enums.warmth.${company.warmth}`)}
                </Badge>
              ) : (
                t("companies.fields.warmthUnset")
              )}
            </DetailRow>
            {/* Two separate things, deliberately `[10 §1]`: warmth is the
                rep's judgement, qualification is what has actually happened.
                A company is qualified because a quotation was requested
                against it — there is nothing here for anyone to tick. */}
            <DetailRow label={t("common.qualified")}>
              {company.isQualified ? (
                <Badge variant="outline">{t("common.yes")}</Badge>
              ) : (
                <span className="text-muted-foreground">{t("common.no")}</span>
              )}
            </DetailRow>
            <DetailRow label={t("common.notes")}>
              {company.notes ?? dash}
            </DetailRow>
            <DetailRow label={t("common.createdBy")}>
              {company.createdByName ?? t("common.unknownUser")}
            </DetailRow>
            <DetailRow label={t("common.createdAt")}>
              {format.dateTime(company.createdAt, { dateStyle: "medium" })}
            </DetailRow>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-start text-sm">
            {t("companies.detail.reps")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {reps.map((rep) => (
              <li
                key={rep.id}
                className="flex flex-wrap items-center gap-2 text-start text-sm"
              >
                <span className="font-medium">{rep.userName}</span>
                {rep.isPrimary ? (
                  <Badge variant="secondary">
                    {t("companies.detail.primary")}
                  </Badge>
                ) : null}
                <span className="text-muted-foreground text-xs">
                  {t(`enums.companyRepOrigin.${rep.origin}`)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-start text-sm">
            {t("companies.detail.contacts")}
          </CardTitle>
          <Button asChild size="xs" variant="outline">
            <Link href={`/contacts/new?companyId=${company.id}`}>
              {t("companies.detail.addContact")}
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {contacts.rows.length === 0 ? (
            <p className="text-muted-foreground text-start text-sm">
              {t("companies.detail.noContacts")}
            </p>
          ) : (
            <ul className="flex flex-col">
              {contacts.rows.map((contact) => (
                <li
                  key={contact.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b py-2.5 last:border-b-0"
                >
                  <Link
                    href={`/contacts/${contact.id}`}
                    className="text-start text-sm font-medium hover:underline"
                  >
                    {bilingualName(contact, locale)}
                  </Link>
                  <span className="text-muted-foreground text-start text-sm">
                    {contact.position ?? dash}
                    {contact.phone ? (
                      <span dir="ltr" className="ms-3">
                        {contact.phone}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-start text-sm">
            {t("companies.detail.projects")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projects.rows.length === 0 ? (
            <p className="text-muted-foreground text-start text-sm">
              {t("companies.detail.noProjects")}
            </p>
          ) : (
            <ul className="flex flex-col">
              {projects.rows.map((project) => (
                <li
                  key={project.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b py-2.5 last:border-b-0"
                >
                  <Link
                    href={`/projects/${project.id}`}
                    className="text-start text-sm font-medium hover:underline"
                  >
                    {bilingualName(project, locale)}
                  </Link>
                  <span className="text-muted-foreground text-start text-sm">
                    {project.endState
                      ? t(`enums.projectEndState.${project.endState}`)
                      : t("projects.fields.endStateOpen")}
                    {project.sqmExpected ? (
                      <span dir="ltr" className="ms-3">
                        {project.sqmExpected}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* `07 E6` — rendered only when there is a decision to take: the company
          has gone quiet, or somebody has already taken one. A panel that showed
          on every company would make archiving look like an ordinary edit. */}
      {quiet || company.archivedAt || reviews.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-start text-sm">
              {t("dormancy.title")}
            </CardTitle>
            {company.archivedAt ? (
              <Badge variant="secondary">
                {t("enums.dormancyOutcome.archived")}
              </Badge>
            ) : quiet ? (
              <Badge variant="destructive">{t("dormancy.detail.quiet")}</Badge>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {/* Archiving is the end of the lifecycle: there is nothing left to
                decide, so no controls are offered. Nothing is deleted, so the
                record and its history stay `[12 §7]`. */}
            {company.archivedAt ? (
              <p className="text-muted-foreground text-start text-sm">
                {t("dormancy.detail.archived")}
              </p>
            ) : (
              <DormancyPanel
                reincludeAction={reincludeCompanyAction.bind(null, company.id)}
                reassignAction={
                  canAssign
                    ? reassignCompanyAction.bind(null, company.id)
                    : undefined
                }
                archiveAction={
                  canAssign
                    ? archiveCompanyAction.bind(null, company.id)
                    : undefined
                }
                reps={assignableReps}
              />
            )}

            <div className="flex flex-col gap-2">
              <p className="text-start text-sm font-medium">
                {t("dormancy.detail.history")}
              </p>
              {reviews.length === 0 ? (
                <p className="text-muted-foreground text-start text-sm">
                  {t("dormancy.detail.none")}
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {reviews.map((review) => (
                    <li
                      key={review.id}
                      className="text-muted-foreground text-start text-sm"
                    >
                      <span dir="ltr">
                        {format.dateTime(
                          new Date(`${review.decidedAt}T00:00:00Z`),
                          { dateStyle: "medium", timeZone: "UTC" },
                        )}
                      </span>{" "}
                      — {t(`enums.dormancyOutcome.${review.outcome}`)}{" "}
                      {t("dormancy.detail.by", { name: review.decidedByName })}
                      {review.toName
                        ? ` ${t("dormancy.detail.to", { name: review.toName })}`
                        : ""}
                      {review.note ? ` — ${review.note}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* `20 §6` — the rep's payoff for logging, and the reason the log button
          sits in its header rather than at the top of the page. */}
      <Timeline
        events={timeline.events}
        total={timeline.total}
        fullHistoryHref={`/companies/${company.id}/timeline`}
        action={
          <Button asChild size="xs">
            <Link href={`/reports/new?companyId=${company.id}`}>
              {t("reports.new")}
            </Link>
          </Button>
        }
      />
    </div>
  );
}
