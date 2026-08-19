import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/authz";
import { listCompanyOptions } from "@/lib/companies";

import { createContactAction } from "../actions";
import { ContactForm } from "../contact-form";

export const dynamic = "force-dynamic";

export default async function NewContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { companyId } = await searchParams;

  const session = await requireSession();
  const t = await getTranslations();
  const companies = await listCompanyOptions(session);
  // A contact belongs to exactly one company `[07 A2]` and `createContact`
  // checks it, so with no company to name there is no form to fill — `D51`, and
  // `D53` for the shape of the refusal. The `S76` reader is the identity this
  // catches: they read every contact and may use no company.
  if (companies.length === 0) notFound();

  // `?companyId=` prefills the select when arriving from a company page. It is
  // a convenience only — the option list is already scoped, and the action
  // re-checks the id, so a tampered value cannot select an unseen company.
  const prefill = companies.some((company) => company.id === companyId)
    ? companyId
    : undefined;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title={t("contacts.newTitle")} />
      <ContactForm
        action={createContactAction}
        defaults={prefill ? { companyId: prefill } : undefined}
        submitLabel={t("common.create")}
        cancelHref={prefill ? `/companies/${prefill}` : "/contacts"}
        companies={companies}
      />
    </div>
  );
}
