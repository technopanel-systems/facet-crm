import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/authz";
import { listCompanyOptions } from "@/lib/companies";
import { listCities, listLossReasons } from "@/lib/lookups";

import { createProjectAction } from "../actions";
import { ProjectForm } from "../project-form";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await requireSession();
  const t = await getTranslations();
  const [cities, companies, lossReasons] = await Promise.all([
    listCities(),
    listCompanyOptions(session),
    listLossReasons(),
  ]);
  // A project requires a company `S27`, `[07 A9]`, and `createProject` checks
  // each one against what this identity may use. None means no form — the
  // contact form's note, for the same reason `D51`, `D53`.
  if (companies.length === 0) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title={t("projects.newTitle")} />
      {/* The company link is part of creation, not an afterthought: a project
          requires one, deliberately, so the rep has to find who is behind it
          `[07 A9]`. */}
      <ProjectForm
        action={createProjectAction}
        submitLabel={t("common.create")}
        cancelHref="/projects"
        cities={cities}
        companies={companies}
        lossReasons={lossReasons}
        locale={locale}
        withCompanies
      />
    </div>
  );
}
