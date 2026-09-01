import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/authz";
import { getCompany } from "@/lib/companies";
import {
  listCities,
  listCompanyCategories,
  listCountries,
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
  const [categories, countries, cities, leadSources] = await Promise.all([
    listCompanyCategories(),
    listCountries(),
    listCities(),
    // The company's own lead source is passed in so a rep editing a
    // marketing-sourced company keeps it rather than blanking it `[15 §2.1]`.
    listLeadSources(session, company.leadSourceId),
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title={t("companies.editTitle")} description={company.name} />
      <CompanyForm
        action={updateCompanyAction.bind(null, company.id)}
        defaults={company}
        submitLabel={t("common.save")}
        cancelHref={`/companies/${company.id}`}
        categories={categories}
        countries={countries}
        cities={cities}
        leadSources={leadSources}
        // `S17` — a carried source may be changed but never cleared; a
        // pre-rule blank may stay blank, so the field is required exactly
        // when a value exists.
        leadSourceRequired={Boolean(company.leadSourceId)}
        locale={locale}
      />
    </div>
  );
}
