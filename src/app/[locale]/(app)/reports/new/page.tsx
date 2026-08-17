import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/authz";
import { getCompany, listCompanyOptions } from "@/lib/companies";
import { listContacts } from "@/lib/contacts";
import {
  FIELD_NOTE_CATEGORIES,
  REPORT_CHANNELS,
  REPORT_OUTCOMES,
  REPORT_SIGNALS,
  SIGNALS_WITH_REFERENCE,
} from "@/lib/enums";
import { listCities, lookupName } from "@/lib/lookups";
import { listProjects } from "@/lib/projects";
import { today } from "@/lib/reports";

import { createReportAction } from "../actions";
import { ReportForm } from "../report-form";

export const dynamic = "force-dynamic";

/**
 * The log form `[20 §12]`.
 *
 * **`?companyId=` prefills and `?type=field_note` switches mode** — both in the
 * URL rather than in client state, the same shape as
 * `contacts/new?companyId=` and `dispatches/new?mode=direct`. That is what lets
 * the company page's Log button open this already filled in.
 */
export default async function NewReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ companyId?: string; type?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { companyId, type } = await searchParams;

  const session = await requireSession();
  const t = await getTranslations();

  const entryType = type === "field_note" ? "field_note" : "interaction";
  const isFieldNote = entryType === "field_note";

  // A company handed in by URL is resolved through the gated reader, so a
  // hidden one is a 404 rather than a silently ignored prefill.
  const prefilled =
    !isFieldNote && companyId ? await getCompany(session, companyId) : null;
  if (!isFieldNote && companyId && !prefilled) notFound();

  const [companies, contacts, projects, cities] = await Promise.all([
    isFieldNote || prefilled ? [] : listCompanyOptions(session),
    prefilled
      ? listContacts(session, { companyId: prefilled.id }).then((r) => r.rows)
      : [],
    prefilled
      ? listProjects(session, { companyId: prefilled.id }).then((r) => r.rows)
      : [],
    isFieldNote ? listCities() : [],
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={
          isFieldNote ? t("reports.newFieldNoteTitle") : t("reports.newTitle")
        }
      />
      <ReportForm
        action={createReportAction}
        entryType={entryType}
        values={{
          entryType,
          companyId: prefilled?.id ?? null,
          contactId: null,
          projectId: null,
          channel: null,
          outcome: null,
          onHoldUntil: null,
          category: null,
          cityId: null,
          narrative: "",
          reportDate: today(),
          signals: [],
        }}
        companies={companies.map((company) => ({
          id: company.id,
          label: company.name,
        }))}
        companyLabel={prefilled ? prefilled.name : null}
        contacts={contacts.map((contact) => ({
          id: contact.id,
          label: contact.name,
        }))}
        projects={projects.map((project) => ({
          id: project.id,
          label: lookupName(project, locale),
        }))}
        cities={cities.map((city) => ({
          id: city.id,
          label: lookupName(city, locale),
          altLabel: city.nameAr,
        }))}
        channels={REPORT_CHANNELS}
        outcomes={REPORT_OUTCOMES}
        categories={FIELD_NOTE_CATEGORIES}
        signals={REPORT_SIGNALS}
        signalsWithReference={SIGNALS_WITH_REFERENCE}
        submitLabel={t("reports.actions.log")}
        cancelHref={prefilled ? `/companies/${prefilled.id}` : "/reports"}
        // A quotation is raised on a PROJECT, not a company `[20 §3]`, so the
        // link carries nothing when no project has been chosen yet.
        quotationHref="/quotations/new"
      />
    </div>
  );
}
