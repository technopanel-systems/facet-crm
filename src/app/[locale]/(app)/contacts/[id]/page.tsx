import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import {
  Fact,
  Facts,
  DetailHeader,
} from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timeline } from "@/components/timeline";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import { getContact } from "@/lib/contacts";
import { bilingualName } from "@/lib/lookups";
import { recordTimeline } from "@/lib/timeline";

import { CommentBox } from "../../_components/comment-box";
import { ListPagination } from "../../_components/list-controls";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, id } = await params;
  const { page } = await searchParams;
  setRequestLocale(locale);

  const session = await requireSession();
  const contact = await getContact(session, id);
  if (!contact) notFound();

  const t = await getTranslations();
  const format = await getFormatter();
  const dash = t("common.none");

  // `25 §9` — one thread per record. A contact has no derived events of its
  // own, so its thread is the conversation and nothing else; it pages rather
  // than capping, because there is no full-history route to send anyone to.
  const timeline = await recordTimeline(session, "contact", contact.id, {
    page: Number(page) || 1,
  });

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        name={bilingualName(contact, locale)}
        state={contact.position ?? undefined}
        reference={contact.phone ?? undefined}
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
        <CardContent className="px-0">
          <Facts>
            <Fact label={t("contacts.fields.company")}>
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
            </Fact>
            <Fact label={t("common.nameEn")}>{contact.nameEn}</Fact>
            <Fact label={t("common.nameAr")}>
              {contact.nameAr ?? dash}
            </Fact>
            <Fact label={t("contacts.fields.position")}>
              {contact.position ?? dash}
            </Fact>
            <Fact label={t("common.phone")}>
              <span dir="ltr">{contact.phone ?? dash}</span>
            </Fact>
            <Fact label={t("common.email")}>
              <span dir="ltr">{contact.email ?? dash}</span>
            </Fact>
            <Fact label={t("common.notes")}>
              {contact.notes ?? dash}
            </Fact>
            <Fact label={t("common.createdBy")}>
              {contact.createdByName ?? t("common.unknownUser")}
            </Fact>
            <Fact label={t("common.createdAt")}>
              {format.dateTime(contact.createdAt, { dateStyle: "medium" })}
            </Fact>
          </Facts>
        </CardContent>
      </Card>

      <Timeline
        events={timeline.events}
        total={timeline.total}
        composer={
          <CommentBox
            session={session}
            recordType="contact"
            recordId={contact.id}
          />
        }
      />
      <ListPagination
        basePath={`/contacts/${contact.id}`}
        page={timeline.page}
        total={timeline.total}
      />
    </div>
  );
}
