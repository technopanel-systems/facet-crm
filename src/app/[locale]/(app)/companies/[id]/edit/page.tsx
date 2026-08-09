import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/authz";
import { getCompany } from "@/lib/companies";
import {
  listCities,
  listCompanyCategories,
  listLeadSources,
} from "@/lib/lookups";

import { updateCompanyAction } from "../../actions";
import { CompanyForm } from "../../company-form";

export const dynamic = "force-dynamic";

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await requireSession();
  // Invisible and nonexistent are the same 404 — a rep must not be able to
  // probe for records they cannot see `[04 Q7]`.
  const company = await getCompany(session, id);
  if (!company) notFound();

  const t = await getTranslations();
  const [categories, cities, leadSources] = await Promise.all([
    listCompanyCategories(),
    listCities(),
    listLeadSources(),
  ]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <PageHeader title={t("companies.editTitle")} description={company.nameEn} />
      <CompanyForm
        action={updateCompanyAction.bind(null, company.id)}
        defaults={company}
        submitLabel={t("common.save")}
        cancelHref={`/companies/${company.id}`}
        categories={categories}
        cities={cities}
        leadSources={leadSources}
        locale={locale}
      />
    </main>
  );
}
