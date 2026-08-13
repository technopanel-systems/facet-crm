import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/authz";
import { listCompanyOptions } from "@/lib/companies";
import { listContacts } from "@/lib/contacts";
import {
  FIELD_NOTE_CATEGORIES,
  REPORT_CHANNELS,
  REPORT_OUTCOMES,
  REPORT_SIGNALS,
  SIGNALS_WITH_REFERENCE,
} from "@/lib/enums";
import { bilingualName, listCities } from "@/lib/lookups";
import { listProjects } from "@/lib/projects";
import { getReport } from "@/lib/reports";

import { updateReportAction } from "../../actions";
import { ReportForm } from "../../report-form";

export const dynamic = "force-dynamic";

/**
 * Correcting a report `[20 §9]`.
 *
 * The same form as creation, because **every field is editable including the
 * anchor** — a report filed against the wrong company is corrected, not
 * abandoned, and FACET does not delete. The company control is therefore the
 * full picker here even when the report already names one.
 *
 * Only the author reaches this screen: `notFound()` rather than a message, so a
 * 404 does not confirm the report exists. `updateReport` refuses in step with
 * `reports.errors.authorOnly` — the UI is never the gate `[19 §3]`.
 */
export default async function EditReportPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await requireSession();
  const report = await getReport(session, id);
  if (!report || !report.isAuthor) notFound();

  const t = await getTranslations();
  const isFieldNote = report.entryType === "field_note";

  const [companies, contacts, projects, cities] = await Promise.all([
    isFieldNote ? [] : listCompanyOptions(session),
    report.companyId
      ? listContacts(session, { companyId: report.companyId }).then(
          (r) => r.rows,
        )
      : [],
    report.companyId
      ? listProjects(session, { companyId: report.companyId }).then(
          (r) => r.rows,
        )
      : [],
    isFieldNote ? listCities() : [],
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={t("reports.editTitle")}
        description={t("reports.detail.correctionHint")}
      />
      <ReportForm
        action={updateReportAction.bind(null, report.id)}
        entryType={report.entryType}
        values={{
          entryType: report.entryType,
          companyId: report.companyId,
          contactId: report.contactId,
          projectId: report.projectId,
          channel: report.channel,
          outcome: report.outcome,
          onHoldUntil: report.onHoldUntil,
          category: report.category,
          cityId: report.cityId,
          narrative: report.narrative,
          reportDate: report.reportDate,
          signals: report.signals,
        }}
        companies={companies.map((company) => ({
          id: company.id,
          label: bilingualName(company, locale),
          altLabel: company.nameAr ?? company.nameEn,
        }))}
        companyLabel={null}
        contacts={contacts.map((contact) => ({
          id: contact.id,
          label: bilingualName(contact, locale),
        }))}
        projects={projects.map((project) => ({
          id: project.id,
          label: bilingualName(project, locale),
        }))}
        cities={cities.map((city) => ({
          id: city.id,
          label: bilingualName(city, locale),
          altLabel: city.nameAr,
        }))}
        channels={REPORT_CHANNELS}
        outcomes={REPORT_OUTCOMES}
        categories={FIELD_NOTE_CATEGORIES}
        signals={REPORT_SIGNALS}
        signalsWithReference={SIGNALS_WITH_REFERENCE}
        submitLabel={t("reports.actions.save")}
        cancelHref={`/reports/${report.id}`}
        quotationHref={
          report.projectId
            ? `/quotations/new?projectId=${report.projectId}`
            : "/quotations/new"
        }
      />
    </div>
  );
}
