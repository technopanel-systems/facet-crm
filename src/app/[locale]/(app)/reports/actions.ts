"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { redirect } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import {
  FIELD_NOTE_CATEGORIES,
  REPORT_CHANNELS,
  REPORT_ENTRY_TYPES,
  REPORT_OUTCOMES,
  REPORT_SIGNALS,
  SIGNAL_REFERENCE_MAX,
} from "@/lib/enums";
import {
  createReport,
  updateReport,
  type ReportInput,
  type SignalInput,
} from "@/lib/reports";
import {
  readFields,
  ruleErrorState,
  type FormState,
} from "@/lib/validation";

/**
 * Read the log form.
 *
 * Shape only — which fields are present and well formed. Whether an
 * interaction may name that project, and whether `on_hold` carries a date, are
 * business invariants and belong in `src/lib/reports.ts`, where they hold for
 * every caller `[13 §1]`.
 *
 * A field the entry type does not use is simply not read: the data layer drops
 * anything that does not belong, and `rep_reports_shape` refuses it at the
 * database if both are somehow wrong.
 */
function readReport(formData: FormData) {
  const fields = readFields(formData);

  const entryType = fields.option("entryType", REPORT_ENTRY_TYPES, {
    required: true,
  });
  const isInteraction = entryType === "interaction";

  const narrative = fields.text("narrative", { required: true, max: 5000 });
  const reportDate = fields.date("reportDate", { required: true });

  const companyId = isInteraction ? fields.uuid("companyId") : null;
  const contactId = isInteraction ? fields.uuid("contactId") : null;
  const projectId = isInteraction ? fields.uuid("projectId") : null;
  const channel = isInteraction
    ? fields.option("channel", REPORT_CHANNELS)
    : null;
  const outcome = isInteraction
    ? fields.option("outcome", REPORT_OUTCOMES)
    : null;
  const onHoldUntil = isInteraction ? fields.date("onHoldUntil") : null;

  const category = isInteraction
    ? null
    : fields.option("category", FIELD_NOTE_CATEGORIES);
  const cityId = isInteraction ? null : fields.uuid("cityId");

  // Repeated `signals` values, each with its reference in a per-signal field
  // name — never matched by submission order, which is the trap `18` hit.
  const signals: SignalInput[] = [];
  for (const raw of formData.getAll("signals")) {
    const value = String(raw);
    if (!(REPORT_SIGNALS as readonly string[]).includes(value)) {
      fields.fail("signals", "validation.invalidOption");
      continue;
    }
    const reference = fields.text(`signalReference.${value}`, {
      max: SIGNAL_REFERENCE_MAX,
    });
    signals.push({
      signal: value as SignalInput["signal"],
      reference: reference ?? null,
    });
  }

  return { fields, entryType, signals, values: { narrative, reportDate, companyId, contactId, projectId, channel, outcome, onHoldUntil, category, cityId } };
}

function toInput(
  read: ReturnType<typeof readReport>,
): ReportInput | null {
  const { entryType, values, signals } = read;
  if (!entryType || !values.narrative || !values.reportDate) return null;
  return {
    entryType,
    narrative: values.narrative,
    reportDate: values.reportDate,
    companyId: values.companyId,
    contactId: values.contactId,
    projectId: values.projectId,
    channel: values.channel,
    outcome: values.outcome,
    onHoldUntil: values.onHoldUntil,
    category: values.category,
    cityId: values.cityId,
    signals,
  };
}

export async function createReportAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const read = readReport(formData);
  const input = toInput(read);
  if (!read.fields.ok || !input) return read.fields.state;

  let reportId: string;
  try {
    const created = await createReport(session, input);
    reportId = created.id;
  } catch (error) {
    return ruleErrorState(error, read.fields.values);
  }

  const locale = await getLocale();
  // **`/reports` and `/performance` are both gone as routes** — session 27
  // made the stream `/activity` and `28b` merged Targets. What a report
  // actually moves now is the company's silence: the meter, the attention
  // order and the quiet group count on `/companies` `D25`.
  revalidatePath("/activity");
  revalidatePath("/companies", "layout");
  if (input.companyId) revalidatePath(`/companies/${input.companyId}`);
  if (input.projectId) revalidatePath(`/projects/${input.projectId}`);
  redirect({ href: `/reports/${reportId}`, locale });
  throw new Error("unreachable"); // redirect() never returns
}

export async function updateReportAction(
  reportId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const read = readReport(formData);
  const input = toInput(read);
  if (!read.fields.ok || !input) return read.fields.state;

  try {
    await updateReport(session, reportId, input);
  } catch (error) {
    return ruleErrorState(error, read.fields.values);
  }

  const locale = await getLocale();
  revalidatePath("/activity");
  // The anchor may have MOVED `[20 §9]`, so both timelines are stale: the one
  // it left and the one it joined. Revalidating the section covers both — and
  // the list's silence meter with them.
  revalidatePath("/companies", "layout");
  revalidatePath("/projects", "layout");
  redirect({ href: `/reports/${reportId}`, locale });
  throw new Error("unreachable");
}
