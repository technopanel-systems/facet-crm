"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { redirect } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import { COMMENT_BODY_MAX, SMAC_VERIFICATIONS } from "@/lib/enums";
import {
  acceptThread,
  addQuotationLine,
  addServiceLine,
  cancelThread,
  confirmPayment,
  createQuotationThread,
  createRevision,
  extendValidity,
  issueVersion,
  markAcceptedForProcessing,
  rejectThread,
  removeQuotationLine,
  removeServiceLine,
  returnForEdit,
  updateQuotationLine,
  updateServiceLine,
  type QuotationLineInput,
  type ServiceLineInput,
} from "@/lib/quotations";
import { readFields, ruleErrorState, type FormState } from "@/lib/validation";

/**
 * Every action calls `requireSession()` itself. A server action is a
 * separately reachable POST endpoint; no layout wraps it, so the gate cannot
 * be inherited. The data layer then re-checks visibility and the permission
 * flag before it writes — these functions only shape the input.
 */

/* ------------------------------------------------------------------ *
 * Form readers
 * ------------------------------------------------------------------ */

/**
 * One product line, from a row of repeated inputs.
 *
 * **The colour is one typed value** `[17 §2]` — a code like `168` or a RAL or
 * Pantone special, both into `custom_colour`. `colour_id` is written null from
 * every form, so `12 §12`'s "one or the other, never both" is unreachable here
 * and the `num_nonnulls` CHECK stays a backstop rather than an error users hit.
 *
 * `sqm`, `line_total` and `vat_amount` are not read from the form at all —
 * FACET computes them `[16 §1]`.
 */
function readLine(
  fields: ReturnType<typeof readFields>,
  index: number,
  formData: FormData,
): QuotationLineInput | null {
  const at = (name: string) => {
    const value = formData.getAll(name)[index];
    return typeof value === "string" ? value.trim() : "";
  };

  const supplierId = at("supplierId");
  if (!supplierId) return null; // an untouched spare row

  const line: QuotationLineInput = {
    supplierId,
    classId: at("classId"),
    fireRatingId: at("fireRatingId"),
    colourId: null,
    customColour: at("customColour") || null,
    thicknessId: at("thicknessId"),
    widthM: at("widthM"),
    lengthM: at("lengthM"),
    quantityPcs: at("quantityPcs"),
    unitPrice: at("unitPrice") || null,
    vatRate: at("vatRate") || null,
  };

  // Shape only. Whether the ids exist, and whether this identity may use them,
  // is the data layer's job and cannot be answered here.
  for (const [name, value] of [
    ["classId", line.classId],
    ["fireRatingId", line.fireRatingId],
    ["thicknessId", line.thicknessId],
  ] as const) {
    if (!value) fields.fail(name, "validation.required");
  }
  for (const [name, value] of [
    ["widthM", line.widthM],
    ["lengthM", line.lengthM],
    ["quantityPcs", line.quantityPcs],
  ] as const) {
    if (!value) fields.fail(name, "validation.required");
    else if (!/^\d+(\.\d+)?$/.test(value)) fields.fail(name, "validation.notANumber");
  }
  for (const [name, value] of [
    ["unitPrice", line.unitPrice],
    ["vatRate", line.vatRate],
  ] as const) {
    if (value && !/^\d+(\.\d+)?$/.test(value)) {
      fields.fail(name, "validation.notANumber");
    }
  }

  return line;
}

function readServiceLine(
  fields: ReturnType<typeof readFields>,
  index: number,
  formData: FormData,
): ServiceLineInput | null {
  const at = (name: string) => {
    const value = formData.getAll(name)[index];
    return typeof value === "string" ? value.trim() : "";
  };

  const serviceTypeId = at("serviceTypeId");
  if (!serviceTypeId) return null;

  const quantity = at("serviceQuantity");
  if (!quantity) fields.fail("serviceQuantity", "validation.required");
  else if (!/^\d+(\.\d+)?$/.test(quantity)) {
    fields.fail("serviceQuantity", "validation.notANumber");
  }

  return {
    serviceTypeId,
    quantity,
    unitPrice: at("serviceUnitPrice") || null,
    quotationLineId: null, // set only when editing on the detail page
  };
}

/* ------------------------------------------------------------------ *
 * Create — the rep's request, which IS version 1 `[10 §4]`, `[04 flow 6]`
 * ------------------------------------------------------------------ */

export async function createQuotationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const fields = readFields(formData);

  const projectId = fields.uuid("projectId", { required: true });
  const companyId = fields.uuid("companyId", { required: true });
  const contactId = fields.uuid("contactId");
  const version = {
    validUntil: fields.date("validUntil"),
    deliveryPeriod: fields.text("deliveryPeriod", { max: 200 }),
    paymentMethod: fields.text("paymentMethod", { max: 200 }),
    shipmentTerms: fields.text("shipmentTerms", { max: 200 }),
  };

  const lineCount = formData.getAll("supplierId").length;
  const lines: QuotationLineInput[] = [];
  for (let index = 0; index < lineCount; index += 1) {
    const line = readLine(fields, index, formData);
    if (line) lines.push(line);
  }

  const serviceCount = formData.getAll("serviceTypeId").length;
  const serviceLines: ServiceLineInput[] = [];
  for (let index = 0; index < serviceCount; index += 1) {
    const service = readServiceLine(fields, index, formData);
    if (service) serviceLines.push(service);
  }

  if (!fields.ok || !projectId || !companyId) return fields.state;

  let threadId: string;
  try {
    const thread = await createQuotationThread(
      session,
      { projectId, companyId, contactId },
      version,
      lines,
      serviceLines,
    );
    threadId = thread.id;
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  const locale = await getLocale();
  revalidatePath("/quotations");
  redirect({ href: `/quotations/${threadId}`, locale });
  throw new Error("unreachable"); // redirect() never returns
}

/* ------------------------------------------------------------------ *
 * Lines, edited row by row on the detail page
 * ------------------------------------------------------------------ */

/** The detail-page line forms post ONE row, so index 0 is the whole form. */
function readSingleLine(formData: FormData) {
  const fields = readFields(formData);
  const line = readLine(fields, 0, formData);
  return { fields, line };
}

export async function addQuotationLineAction(
  threadId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const { fields, line } = readSingleLine(formData);
  if (!line) fields.fail("supplierId", "validation.required");
  if (!fields.ok || !line) return fields.state;

  try {
    await addQuotationLine(session, threadId, line);
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  revalidatePath(`/quotations/${threadId}`);
  return {};
}

export async function updateQuotationLineAction(
  threadId: string,
  lineId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const { fields, line } = readSingleLine(formData);
  if (!line) fields.fail("supplierId", "validation.required");
  if (!fields.ok || !line) return fields.state;

  try {
    await updateQuotationLine(session, threadId, lineId, line);
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  revalidatePath(`/quotations/${threadId}`);
  return {};
}

/** Takes no form data — `useActionState` still supplies the previous state. */
export async function removeQuotationLineAction(
  threadId: string,
  lineId: string,
): Promise<FormState> {
  const session = await requireSession();
  try {
    await removeQuotationLine(session, threadId, lineId);
  } catch (error) {
    return ruleErrorState(error);
  }
  revalidatePath(`/quotations/${threadId}`);
  return {};
}

export async function addServiceLineAction(
  threadId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const fields = readFields(formData);
  const service = readServiceLine(fields, 0, formData);
  if (!service) fields.fail("serviceTypeId", "validation.required");
  const appliesTo = fields.uuid("quotationLineId");
  if (!fields.ok || !service) return fields.state;

  try {
    await addServiceLine(session, threadId, { ...service, quotationLineId: appliesTo });
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  revalidatePath(`/quotations/${threadId}`);
  return {};
}

export async function updateServiceLineAction(
  threadId: string,
  lineId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const fields = readFields(formData);
  const service = readServiceLine(fields, 0, formData);
  if (!service) fields.fail("serviceTypeId", "validation.required");
  const appliesTo = fields.uuid("quotationLineId");
  if (!fields.ok || !service) return fields.state;

  try {
    await updateServiceLine(session, threadId, lineId, {
      ...service,
      quotationLineId: appliesTo,
    });
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  revalidatePath(`/quotations/${threadId}`);
  return {};
}

export async function removeServiceLineAction(
  threadId: string,
  lineId: string,
): Promise<FormState> {
  const session = await requireSession();
  try {
    await removeServiceLine(session, threadId, lineId);
  } catch (error) {
    return ruleErrorState(error);
  }
  revalidatePath(`/quotations/${threadId}`);
  return {};
}

/* ------------------------------------------------------------------ *
 * The chain
 * ------------------------------------------------------------------ */

export async function issueVersionAction(
  threadId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const fields = readFields(formData);
  // Typed by a human, so it can be wrong `[04 A2]` — hence the verification
  // state alongside it. FACET never generates the number.
  const smacReference = fields.text("smacReference", {
    required: true,
    max: 50,
  });
  const verification =
    fields.option("verification", SMAC_VERIFICATIONS) ?? "unverified";
  if (!fields.ok || !smacReference) return fields.state;

  try {
    await issueVersion(session, threadId, { smacReference, verification });
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  revalidatePath("/quotations");
  revalidatePath(`/quotations/${threadId}`);
  return {};
}

/**
 * `25 §13` — the return carries a reason, and the reason is a comment.
 *
 * It stopped being a zero-field action here: the reason is required, so the
 * panel is a form with a field rather than a lone button.
 */
export async function returnForEditAction(
  threadId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const fields = readFields(formData);
  const reason = fields.text("reason", {
    required: true,
    max: COMMENT_BODY_MAX,
  });
  if (!fields.ok || !reason) return fields.state;

  try {
    await returnForEdit(session, threadId, reason);
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }
  revalidatePath(`/quotations/${threadId}`);
  return {};
}

export async function createRevisionAction(
  threadId: string,
  origin: "rep_change_request" | "coordinator_direct_edit" | "expiry_revision",
): Promise<FormState> {
  const session = await requireSession();
  try {
    await createRevision(session, threadId, origin);
  } catch (error) {
    return ruleErrorState(error);
  }
  revalidatePath("/quotations");
  revalidatePath(`/quotations/${threadId}`);
  return {};
}

export async function extendValidityAction(
  threadId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const fields = readFields(formData);
  const validUntil = fields.date("validUntil", { required: true });
  if (!fields.ok || !validUntil) return fields.state;

  try {
    await extendValidity(session, threadId, validUntil);
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  revalidatePath("/quotations");
  revalidatePath(`/quotations/${threadId}`);
  return {};
}

/**
 * Acceptance is the coordinator's, after signatures `[04 flow 10]`, `[07 C3]`.
 * It is internal approval, not the customer's commitment `[16 §5]`.
 */
export async function acceptThreadAction(threadId: string): Promise<FormState> {
  const session = await requireSession();
  try {
    await acceptThread(session, threadId);
  } catch (error) {
    return ruleErrorState(error);
  }
  revalidatePath("/quotations");
  revalidatePath(`/quotations/${threadId}`);
  return {};
}

export async function rejectThreadAction(threadId: string): Promise<FormState> {
  const session = await requireSession();
  try {
    await rejectThread(session, threadId);
  } catch (error) {
    return ruleErrorState(error);
  }
  revalidatePath("/quotations");
  revalidatePath(`/quotations/${threadId}`);
  return {};
}

export async function cancelThreadAction(
  threadId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const fields = readFields(formData);
  // Required `[10 §8]` — the one field that makes the audit entry worth
  // reading. Checked again in the data layer, for callers with no form.
  const reason = fields.text("cancellationReason", {
    required: true,
    max: 2000,
  });
  if (!fields.ok || !reason) return fields.state;

  try {
    await cancelThread(session, threadId, reason);
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  revalidatePath("/quotations");
  revalidatePath(`/quotations/${threadId}`);
  return {};
}

/** The rep's tick, with a date `[07 C3]`. */
export async function confirmPaymentAction(
  threadId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const fields = readFields(formData);
  const confirmedOn = fields.date("confirmedOn", { required: true });
  if (!fields.ok || !confirmedOn) return fields.state;

  try {
    await confirmPayment(session, threadId, confirmedOn);
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  revalidatePath("/quotations");
  revalidatePath(`/quotations/${threadId}`);
  return {};
}

export async function markAcceptedForProcessingAction(
  threadId: string,
): Promise<FormState> {
  const session = await requireSession();
  try {
    await markAcceptedForProcessing(session, threadId);
  } catch (error) {
    return ruleErrorState(error);
  }
  revalidatePath(`/quotations/${threadId}`);
  return {};
}
