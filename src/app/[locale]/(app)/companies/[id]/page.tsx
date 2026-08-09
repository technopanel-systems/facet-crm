import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { DetailRow, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import { getCompany, listCompanyReps } from "@/lib/companies";
import { listContacts } from "@/lib/contacts";
import { bilingualName, pickName } from "@/lib/lookups";
import { listProjects } from "@/lib/projects";

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
  const [reps, contacts, projects] = await Promise.all([
    listCompanyReps(company.id),
    // Scoped like any other contact read. Seeing the company is what grants
    // these `[14 §1]`, so on a shared company the second rep sees them too.
    listContacts(session, { companyId: company.id }),
    // And this is the opposite rule, on the same screen: `listProjects`
    // applies `visibleProjectsFilter`, which never consults company
    // membership. A rep holding this company through a share sees the company
    // and an EMPTY projects list `[04 Q7]`.
    listProjects(session, { companyId: company.id }),
  ]);

  const dash = t("common.none");

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <PageHeader
        title={bilingualName(company, locale)}
        description={company.archivedAt ? t("companies.detail.archived") : undefined}
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
    </main>
  );
}
