import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import {
  DetailHeader,
  Fact,
  Facts,
} from "@/components/page-header";
import { Timeline } from "@/components/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { can, listActiveUsers, requireSession } from "@/lib/authz";
import { listCompanyOptions } from "@/lib/companies";
import { getCreditSplitInForce } from "@/lib/credit-splits";
import { bilingualName, pickName } from "@/lib/lookups";
import { getProject } from "@/lib/projects";
import { projectTimeline, TIMELINE_CARD_LIMIT } from "@/lib/timeline";

import { setCreditSplitAction } from "../actions";
import {
  TurnPanel,
  daysSince,
  initials,
} from "../../_components/turn";
import { CreditSplit } from "./credit-split";
import { ProjectLinks } from "./project-links";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await requireSession();
  const project = await getProject(session, id);
  if (!project) notFound();

  const t = await getTranslations();
  const format = await getFormatter();
  // The add-a-company select is scoped to what this identity may use; the
  // action re-checks it, so a tampered option cannot link an unseen company.
  const companies = await listCompanyOptions(session);

  // `18 §3` — the split names people, so the picker is the user directory.
  const [split, people, timeline] = await Promise.all([
    getCreditSplitInForce(session, project.id),
    listActiveUsers(),
    projectTimeline(session, project.id, { limit: TIMELINE_CARD_LIMIT }),
  ]);
  const inForceIds = new Set(split?.rows.map((row) => row.userId) ?? []);
  const candidates = people.map((person) => ({
    id: person.id,
    name: person.name,
    // Prefilled: whoever is on the split now, or the owner when there is none
    // — `07 D3`'s baseline is 100% to the owner.
    inForce: split
      ? inForceIds.has(person.id)
      : person.id === project.ownerUserId,
  }));
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    dateStyle: "short",
  }).format(new Date());

  // The elapsed figure for the turn panel, from the timeline already fetched.
  const lastEventDay = timeline.events[0]?.day ?? null;
  const sinceLastEvent = lastEventDay
    ? daysSince(new Date(`${lastEventDay}T00:00:00Z`))
    : 0;

  const dash = t("common.none");

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        name={bilingualName(project, locale)}
        state={[
          project.ownerName,
          project.endState
            ? t(`enums.projectEndState.${project.endState}`)
            : t("projects.fields.endStateOpen"),
        ]
          .filter(Boolean)
          .join(" · ")}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={`/projects/${project.id}/edit`}>{t("common.edit")}</Link>
          </Button>
        }
      />

      {/* `22 §3`'s turn panel. A resolved project owes nobody the next action;
          an open one is its owner's, and the elapsed figure is the timeline
          this page already loaded. No threshold is derived here — `25 §4`'s
          "in production", "on hold until" and "lost" are the rep's own inputs
          and none of them is built yet, so this says only what is known. */}
      <TurnPanel
        who={initials(project.ownerName)}
        tone={project.endState ? "calm" : "soon"}
        line={
          project.endState
            ? t(`enums.projectEndState.${project.endState}`)
            : t("projects.detail.turnOwner", { name: project.ownerName })
        }
        detail={
          lastEventDay === null
            ? t("coverage.fields.neverLogged")
            : t("coverage.fields.coveredFor", { count: sinceLastEvent })
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-start text-sm">
            {t("projects.detail.details")}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Facts>
            <Fact label={t("common.nameEn")}>{project.nameEn}</Fact>
            <Fact label={t("common.nameAr")}>
              {project.nameAr ?? dash}
            </Fact>
            <Fact label={t("projects.fields.owner")}>
              {project.ownerName}
            </Fact>
            <Fact label={t("projects.fields.sqmExpected")}>
              <span dir="ltr">{project.sqmExpected ?? dash}</span>
            </Fact>
            <Fact label={t("common.region")}>
              {project.region ? t(`enums.region.${project.region}`) : dash}
            </Fact>
            <Fact label={t("common.city")}>
              {pickName(locale, project.cityNameEn, project.cityNameAr) ?? dash}
            </Fact>
            <Fact label={t("projects.fields.endState")}>
              {project.endState ? (
                <Badge
                  variant={
                    project.endState === "lost" ? "destructive" : "secondary"
                  }
                >
                  {t(`enums.projectEndState.${project.endState}`)}
                </Badge>
              ) : (
                t("projects.fields.endStateOpen")
              )}
            </Fact>
            {project.endState === "lost" ? (
              <Fact label={t("projects.fields.lossReason")}>
                {project.lossReason ?? dash}
              </Fact>
            ) : null}
            <Fact label={t("common.createdBy")}>
              {project.createdByName ?? t("common.unknownUser")}
            </Fact>
            <Fact label={t("common.createdAt")}>
              {format.dateTime(project.createdAt, { dateStyle: "medium" })}
            </Fact>
          </Facts>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-start text-sm">
            {t("projects.detail.companies")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectLinks
            projectId={project.id}
            links={project.links}
            companies={companies}
            locale={locale}
          />
        </CardContent>
      </Card>

      {/* Credit split `[07 D3]`, `[18 §3]` — the rare exception. Read-only for
          any project viewer, because it is how a rep learns why they were
          credited half; the editor is `can_set_credit_split` only `[12 §1]`. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-start text-sm">
            {t("credit.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CreditSplit
            action={setCreditSplitAction.bind(null, project.id)}
            candidates={candidates}
            inForce={split?.rows ?? null}
            effectiveFrom={split?.effectiveFrom ?? null}
            today={today}
            mayEdit={can(session, "canSetCreditSplit")}
          />
        </CardContent>
      </Card>

      {/* `20 §6` — the project's own history. A report naming this project
          appears here AND on its company's timeline; a direct dispatch has no
          project and appears only on the company's `[07 C6]`. There is no Log
          button here: an interaction is anchored to a COMPANY `[20 §2]`, and
          the company page is where one starts. */}
      <Timeline
        events={timeline.events}
        total={timeline.total}
        fullHistoryHref={`/projects/${project.id}/timeline`}
      />
    </div>
  );
}
