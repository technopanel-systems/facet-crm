import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import {
  DetailHeader,
  Fact,
  Facts,
  RecordRow,
} from "@/components/page-header";
import { Timeline } from "@/components/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { can, listActiveUsers, requireSession } from "@/lib/authz";
import { getCompany, listCompanyReps } from "@/lib/companies";
import { listContacts } from "@/lib/contacts";
import { dormancyReviews, isCompanyQuiet } from "@/lib/dormancy";
import { lookupName, pickName } from "@/lib/lookups";
import { listProjects } from "@/lib/projects";
import { companyOnHoldUntil } from "@/lib/reports";
import { getQuietThresholds } from "@/lib/settings";
import { companyTimeline, TIMELINE_CARD_LIMIT } from "@/lib/timeline";

import {
  archiveCompanyAction,
  reassignCompanyAction,
  reincludeCompanyAction,
} from "../actions";
import { CommentBox } from "../../_components/comment-box";
import { NextFollowUpPanel } from "../../_components/next-follow-up-panel";
import { projectStateKey } from "../../_components/project-state";

import { SharingPanel } from "../../_components/sharing-panel";

import {
  TurnPanel,
  daysSince,
  initials,
  turnTone,
} from "../../_components/turn";
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

  // The elapsed figure for the turn panel, from the timeline the page has
  // already fetched — `22 §4`'s "Nothing recorded for 23 days". It is a
  // display number over data in hand, not a second answer to "is this quiet":
  // that judgement is `quiet` above, and it stays `isCompanyQuiet`'s alone.
  const lastEventDay = timeline.events[0]?.day ?? null;
  const sinceLastEvent = lastEventDay
    ? daysSince(new Date(`${lastEventDay}T00:00:00Z`))
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        name={company.name}
        state={[
          pickName(locale, company.categoryNameEn, company.categoryNameAr),
          pickName(locale, company.cityNameEn, company.cityNameAr),
        ]
          .filter(Boolean)
          .join(" · ")}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={`/companies/${company.id}/edit`}>{t("common.edit")}</Link>
          </Button>
        }
      />

      {/* `22 §3`'s turn panel — the most important element on the screen.
          Every input is already computed above: `quiet` is `isCompanyQuiet`,
          which is the derivation `follow-ups.ts` uses rather than a second one
          `[21 §7]`, and `onHoldUntil` is `20 §5`'s suppression. The elapsed
          figure is the timeline's most recent day, which the page already
          loaded — nothing new is fetched and no threshold is invented here. */}
      <TurnPanel
        who={company.createdByName ? initials(company.createdByName) : undefined}
        tone={turnTone({ overdue: quiet && !onHoldUntil && !company.archivedAt })}
        line={
          company.archivedAt
            ? t("companies.detail.archived")
            : onHoldUntil
              ? t("coverage.detail.onHoldUntil", { date: onHoldUntil })
              : lastEventDay === null
                ? t("coverage.fields.neverLogged")
                : quiet
                  ? t("coverage.fields.quietFor", { count: sinceLastEvent })
                  : t("coverage.fields.coveredFor", { count: sinceLastEvent })
        }
        detail={
          company.archivedAt || onHoldUntil
            ? undefined
            : t("companies.detail.turnDetail")
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-start text-sm">
            {t("companies.detail.details")}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Facts>
            {/* No dash branch: mandatory since `S13`. */}
            <Fact label={t("common.phone")} numeric>
              <span dir="ltr">{company.phone}</span>
            </Fact>
            <Fact label={t("companies.fields.category")}>
              {pickName(locale, company.categoryNameEn, company.categoryNameAr) ??
                dash}
            </Fact>
            <Fact label={t("companies.fields.vatNumber")} numeric>
              <span dir="ltr">{company.vatNumber ?? dash}</span>
            </Fact>
            {/* Country above region and city, the order the form asks in and
                the order they depend in `S14` `S15`. Always present, so no
                dash branch; the two below hold one for a company outside
                Saudi Arabia, which is a real and permanent state, not a gap
                somebody forgot to fill. */}
            <Fact label={t("common.country")} name="country">
              {lookupName(
                {
                  nameEn: company.countryNameEn,
                  nameAr: company.countryNameAr,
                },
                locale,
              )}
            </Fact>
            <Fact label={t("common.region")} name="region">
              {company.region ? t(`enums.region.${company.region}`) : dash}
            </Fact>
            <Fact label={t("common.city")} name="city">
              {pickName(locale, company.cityNameEn, company.cityNameAr) ?? dash}
            </Fact>
            <Fact label={t("companies.fields.leadSource")}>
              {pickName(
                locale,
                company.leadSourceNameEn,
                company.leadSourceNameAr,
              ) ?? dash}
            </Fact>
            {/* A warmth Fact stood here until `25 §6` cut it. Qualification is
                the half of `10 §1` that survives: it is what has actually
                happened, not what a rep thinks. A company is qualified because
                a quotation was requested against it — there is nothing here
                for anyone to tick `[25 §16]`. */}
            <Fact label={t("common.qualified")}>
              {company.isQualified ? (
                <Badge variant="outline">{t("common.yes")}</Badge>
              ) : (
                <span className="text-muted-foreground">{t("common.no")}</span>
              )}
            </Fact>
            <Fact label={t("common.createdBy")}>
              {company.createdByName ?? t("common.unknownUser")}
            </Fact>
            <Fact label={t("common.createdAt")} numeric>
              {format.dateTime(company.createdAt, { dateStyle: "medium" })}
            </Fact>
            {/* A sentence, not a datum — it spans the grid so it is readable
                rather than squeezed into a 140px column. */}
            <Fact label={t("common.notes")} wide>
              {company.notes ?? dash}
            </Fact>
          </Facts>
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

      {/* `22 §3` — related records as cards, in the concept's two-column
          grid. The timeline is the wide side: it is the rep's payoff for
          logging `[20 §6]`, and the reason its log button sits in its own
          header rather than at the top of the page. */}
      <div className="grid items-start gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="flex flex-col gap-4">
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
            // One thread per record `[25 §9]`: the conversation sits inside the
            // timeline card, not beside it. The Log button stays where it is —
            // a report is what happened with the customer and a comment is what
            // colleagues say about it, and the two are not the same act.
            composer={
              <CommentBox
                session={session}
                recordType="company"
                recordId={company.id}
              />
            }
          />
        </div>

        <div className="flex flex-col gap-4">
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

          {/* Beside the reps, because both answer "who is on this" — a
              membership is the rep's own book `[09 §3.2]`, a share is access to
              a record somebody else still holds `[07 B2]`. Renders nothing at
              all for a viewer with no shares to see and no flag to act. */}
          <SharingPanel
            session={session}
            recordType="company"
            recordId={company.id}
          />

          {/* `25 §18` — the rep's own date, which outranks the automatic
              clock. On a company it suppresses the quiet and catalogue chases
              until it arrives, and then becomes the follow-up itself. */}
          <NextFollowUpPanel
            session={session}
            recordType="company"
            recordId={company.id}
            value={company.nextFollowUpAt}
          />

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
                    <RecordRow
                      key={contact.id}
                      href={`/contacts/${contact.id}`}
                      title={contact.name}
                      meta={contact.position ?? dash}
                      when={contact.phone ?? undefined}
                    />
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
                    <RecordRow
                      key={project.id}
                      href={`/projects/${project.id}`}
                      title={lookupName(project, locale)}
                      // The same answer the projects list and the project's
                      // own screen give — one precedence `[projectState]`, so
                      // a project cannot read as won here and open there.
                      meta={t(projectStateKey(project))}

                      when={project.sqmExpected ?? undefined}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
