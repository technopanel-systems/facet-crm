import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/authz";
import {
  listProductClasses,
  listProductFireRatings,
  listProductSuppliers,
  listProductThicknesses,
  listServiceTypes,
} from "@/lib/lookups";
import { listQuotationProjectOptions } from "@/lib/quotations";

import { createQuotationAction } from "../actions";
import { QuotationForm } from "../quotation-form";

export const dynamic = "force-dynamic";

export default async function NewQuotationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { projectId } = await searchParams;

  const session = await requireSession();
  const t = await getTranslations();

  // No colour list `[17 §2]` — the colour is typed on the line.
  const [projects, suppliers, classes, fireRatings, thicknesses, services] =
    await Promise.all([
      listQuotationProjectOptions(session),
      listProductSuppliers(),
      listProductClasses(),
      listProductFireRatings(),
      listProductThicknesses(),
      listServiceTypes(),
    ]);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      {/* The rep raises the request with the details filled in `[04 flow 6]`,
          and that request IS version 1 `[10 §4]` — there is no separate
          request record and no draft state to promote later. */}
      <PageHeader title={t("quotations.newTitle")} />
      <QuotationForm
        action={createQuotationAction}
        projects={projects}
        products={{ suppliers, classes, fireRatings, thicknesses }}
        services={services}
        locale={locale}
        defaultProjectId={projectId}
      />
    </main>
  );
}
