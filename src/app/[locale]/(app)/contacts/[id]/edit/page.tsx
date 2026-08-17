import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/authz";
import { listCompanyOptions } from "@/lib/companies";
import { getContact } from "@/lib/contacts";

import { updateContactAction } from "../../actions";
import { ContactForm } from "../../contact-form";

export const dynamic = "force-dynamic";

export default async function EditContactPage({
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
  const companies = await listCompanyOptions(session);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title={t("contacts.editTitle")} description={contact.name} />
      <ContactForm
        action={updateContactAction.bind(null, contact.id)}
        defaults={contact}
        submitLabel={t("common.save")}
        cancelHref={`/contacts/${contact.id}`}
        companies={companies}
      />
    </div>
  );
}
