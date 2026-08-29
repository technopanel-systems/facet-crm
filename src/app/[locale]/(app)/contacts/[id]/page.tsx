import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import {
  Fact,
  Facts,
  DetailHeader,
} from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { canViewRecord, requireSession } from "@/lib/authz";
import { getContact } from "@/lib/contacts";

export const dynamic = "force-dynamic";

/**
 * **Details and Edit, and nothing else since `27b`.**
 *
 * It carried a timeline card whose only content was the conversation, and
 * `S114` took the conversation off a contact. Nothing else anchors to one — a
 * report anchors to a company `[20 §2]`, a quotation to a thread — so the card
 * could hold nothing ever again and it is gone rather than empty `D70`. Its
 * pagination went with it, and so did the `page` search param that drove it.
 */
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

  // Read or act — the project detail page's note `S76`. False only for the
  // reader `S76` admits, and presentation only: `updateContact` refuses on its
  // own `S109`.
  const mayEdit = await canViewRecord(session, "contact", contact.id);

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        name={contact.name}
        state={contact.position ?? undefined}
        reference={contact.phone ?? undefined}
        action={
          mayEdit ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/contacts/${contact.id}/edit`}>
                {t("common.edit")}
              </Link>
            </Button>
          ) : undefined
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
            {/* Not viewable means no link `S76` — the contact list's note. */}
            <Fact label={t("contacts.fields.company")}>
              {contact.companyViewable ? (
                <Link
                  href={`/companies/${contact.companyId}`}
                  className="hover:underline"
                >
                  {contact.companyName}
                </Link>
              ) : (
                contact.companyName
              )}
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
    </div>
  );
}
