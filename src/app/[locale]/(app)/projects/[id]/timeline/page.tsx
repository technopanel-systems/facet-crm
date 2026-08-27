import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { Timeline } from "@/components/timeline";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import { getProject } from "@/lib/projects";
import { projectTimeline } from "@/lib/timeline";

import { ListPagination } from "../../../_components/list-controls";

export const dynamic = "force-dynamic";

/** The full history behind the project card's capped timeline `[20 §6]`. */
export default async function ProjectTimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { page } = await searchParams;

  const session = await requireSession();
  const project = await getProject(session, id);
  if (!project) notFound();

  const t = await getTranslations();
  const currentPage = Number(page) || 1;
  const { events, total } = await projectTimeline(session, project.id, {
    page: currentPage,
  });

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={t("timeline.fullTitle")}
        description={project.name}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={`/projects/${project.id}`}>{t("common.back")}</Link>
          </Button>
        }
      />
      <Timeline events={events} total={total} />
      <ListPagination
        basePath={`/projects/${project.id}/timeline`}
        page={currentPage}
        total={total}
      />
    </div>
  );
}
