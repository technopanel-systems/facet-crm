import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { DetailRow, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import { getContact } from "@/lib/contacts";
import { bilingualName } from "@/lib/lookups";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await requireSession();
  const contact = await getContact(session, id);
  if (!contact) notFound();

  const t = await getTranslations();
  const format = await getFormatter();
  const dash = t("common.none");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={bilingualName(contact, locale)}
        description={contact.position ?? undefined}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={`/contacts/${contact.id}/edit`}>{t("common.edit")}</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-start text-sm">
            {t("contacts.detail.details")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <DetailRow label={t("contacts.fields.company")}>
              <Link
                href={`/companies/${contact.companyId}`}
                className="hover:underline"
              >
                {bilingualName(
                  {
                    nameEn: contact.companyNameEn,
                    nameAr: contact.companyNameAr,
                  },
                  locale,
                )}
              </Link>
            </DetailRow>
            <DetailRow label={t("common.nameEn")}>{contact.nameEn}</DetailRow>
            <DetailRow label={t("common.nameAr")}>
              {contact.nameAr ?? dash}
            </DetailRow>
            <DetailRow label={t("contacts.fields.position")}>
              {contact.position ?? dash}
            </DetailRow>
            <DetailRow label={t("common.phone")}>
              <span dir="ltr">{contact.phone ?? dash}</span>
            </DetailRow>
            <DetailRow label={t("common.email")}>
              <span dir="ltr">{contact.email ?? dash}</span>
            </DetailRow>
            <DetailRow label={t("common.notes")}>
              {contact.notes ?? dash}
            </DetailRow>
            <DetailRow label={t("common.createdBy")}>
              {contact.createdByName ?? t("common.unknownUser")}
            </DetailRow>
            <DetailRow label={t("common.createdAt")}>
              {format.dateTime(contact.createdAt, { dateStyle: "medium" })}
            </DetailRow>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
