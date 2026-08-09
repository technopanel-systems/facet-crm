import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { DetailRow, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import { getCompany, listCompanyReps } from "@/lib/companies";
import { bilingualName, pickName } from "@/lib/lookups";

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
  const reps = await listCompanyReps(company.id);

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
    </main>
  );
}
