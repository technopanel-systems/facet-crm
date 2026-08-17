import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/authz";
import {
  listCities,
  listCompanyCategories,
  listCountries,
  listLeadSources,
} from "@/lib/lookups";

import { createCompanyAction } from "../actions";
import { CompanyForm } from "../company-form";

export const dynamic = "force-dynamic";

export default async function NewCompanyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession();

  const t = await getTranslations();
  const [categories, countries, cities, leadSources] = await Promise.all([
    listCompanyCategories(),
    listCountries(),
    listCities(),
    // No current value on a new company, so a rep sees only the selectable
    // sources `[15 §2]`.
    listLeadSources(session),
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title={t("companies.newTitle")} />
      <CompanyForm
        action={createCompanyAction}
        submitLabel={t("common.create")}
        cancelHref="/companies"
        categories={categories}
        countries={countries}
        cities={cities}
        leadSources={leadSources}
        locale={locale}
      />
    </div>
  );
}
