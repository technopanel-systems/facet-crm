import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { DetailRow, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { can, listActiveUsers, requireSession } from "@/lib/authz";
import { listCompanyOptions } from "@/lib/companies";
import { getCreditSplitInForce } from "@/lib/credit-splits";
import { bilingualName, pickName } from "@/lib/lookups";
import { getProject } from "@/lib/projects";

import { setCreditSplitAction } from "../actions";
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
  const [split, people] = await Promise.all([
    getCreditSplitInForce(session, project.id),
    listActiveUsers(),
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

  const dash = t("common.none");

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <PageHeader
        title={bilingualName(project, locale)}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={`/projects/${project.id}/edit`}>{t("common.edit")}</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-start text-sm">
            {t("projects.detail.details")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <DetailRow label={t("common.nameEn")}>{project.nameEn}</DetailRow>
            <DetailRow label={t("common.nameAr")}>
              {project.nameAr ?? dash}
            </DetailRow>
            <DetailRow label={t("projects.fields.owner")}>
              {project.ownerName}
            </DetailRow>
            <DetailRow label={t("projects.fields.sqmExpected")}>
              <span dir="ltr">{project.sqmExpected ?? dash}</span>
            </DetailRow>
            <DetailRow label={t("common.region")}>
              {project.region ? t(`enums.region.${project.region}`) : dash}
            </DetailRow>
            <DetailRow label={t("common.city")}>
              {pickName(locale, project.cityNameEn, project.cityNameAr) ?? dash}
            </DetailRow>
            <DetailRow label={t("projects.fields.endState")}>
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
            </DetailRow>
            {project.endState === "lost" ? (
              <DetailRow label={t("projects.fields.lossReason")}>
                {project.lossReason ?? dash}
              </DetailRow>
            ) : null}
            <DetailRow label={t("common.createdBy")}>
              {project.createdByName ?? t("common.unknownUser")}
            </DetailRow>
            <DetailRow label={t("common.createdAt")}>
              {format.dateTime(project.createdAt, { dateStyle: "medium" })}
            </DetailRow>
          </dl>
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
    </main>
  );
}
