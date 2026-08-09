import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { DetailRow, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import { listCompanyOptions } from "@/lib/companies";
import { bilingualName, pickName } from "@/lib/lookups";
import { getProject } from "@/lib/projects";

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
    </main>
  );
}
