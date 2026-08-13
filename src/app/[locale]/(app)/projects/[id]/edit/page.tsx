import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/authz";
import { listCities } from "@/lib/lookups";
import { getProject } from "@/lib/projects";

import { updateProjectAction } from "../../actions";
import { ProjectForm } from "../../project-form";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await requireSession();
  const project = await getProject(session, id);
  if (!project) notFound();

  const t = await getTranslations();
  const cities = await listCities();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title={t("projects.editTitle")} description={project.nameEn} />
      {/* No company field here: links are managed row by row on the detail
          page, where each can be edited or removed on its own `[14 §4]`. */}
      <ProjectForm
        action={updateProjectAction.bind(null, project.id)}
        defaults={project}
        submitLabel={t("common.save")}
        cancelHref={`/projects/${project.id}`}
        cities={cities}
        companies={[]}
        locale={locale}
      />
    </div>
  );
}
