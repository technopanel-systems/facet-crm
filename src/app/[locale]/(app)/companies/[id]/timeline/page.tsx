import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { Timeline } from "@/components/timeline";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import { getCompany } from "@/lib/companies";
import { bilingualName } from "@/lib/lookups";
import { companyTimeline } from "@/lib/timeline";

import { ListPagination } from "../../../_components/list-controls";

export const dynamic = "force-dynamic";

/**
 * The full history behind the detail page's capped card `[20 §6]`.
 *
 * This route is why the cap is safe. Without it a rep inheriting a company with
 * years of history would read twenty entries and nothing else — the one case
 * the whole phase exists for.
 */
export default async function CompanyTimelinePage({
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
  const company = await getCompany(session, id);
  if (!company) notFound();

  const t = await getTranslations();
  const currentPage = Number(page) || 1;
  const { events, total } = await companyTimeline(session, company.id, {
    page: currentPage,
  });

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={t("timeline.fullTitle")}
        description={bilingualName(company, locale)}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={`/companies/${company.id}`}>{t("common.back")}</Link>
          </Button>
        }
      />
      <Timeline events={events} total={total} />
      {/* `ListPagination`'s own PAGE_SIZE is kept in step with
          `TIMELINE_PAGE_SIZE`, the same convention every other list follows. */}
      <ListPagination
        basePath={`/companies/${company.id}/timeline`}
        page={currentPage}
        total={total}
      />
    </div>
  );
}
