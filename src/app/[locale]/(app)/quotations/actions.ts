"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { redirect } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import { COMMENT_BODY_MAX, SMAC_VERIFICATIONS, STOCKS } from "@/lib/enums";
import { createProject } from "@/lib/projects";
import {
  acceptThread,
  addQuotationLine,
  addServiceLine,
  cancelThread,
  createQuotationThread,
  createRevision,
  issueVersion,
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

import { readProductLine } from "./line-form";

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
 * **The colour is one required typed value** `[17 §2]` — a code like `168` or
 * a RAL or Pantone special, into `custom_colour`. The lookup half and
 * `colour_id` with it are gone since feature slice 6 `[26 §2]`.
 *
 * The reading itself moved to `./line-form` when `S116` gave a dispatch the
 * same shape: this is now the quotation's half of it, which is the price being
 * optional `S58`. `QuotationLineInput` and `ProductLineFields` are the same
 * fields, so the cast is a name, not a conversion.
 */
function readLine(
  fields: ReturnType<typeof readFields>,
  index: number,
  formData: FormData,
): QuotationLineInput | null {
  return readProductLine(fields, index, formData);
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

  // `S50` — one of the two, never neither. An empty `projectId` is the form's
  // NEW-project branch rather than an omission, so the name is what is
  // required there; the browser asks for it too, and this asks again because a
  // POST is reachable without the form.
  const projectId = fields.uuid("projectId");
  const newProjectName = projectId
    ? null
    : fields.text("newProjectName", { required: true, max: 200 });
  const companyId = fields.uuid("companyId", { required: true });
  const contactId = fields.uuid("contactId");
  // `S118` — the rep chooses the stock when requesting, from a fixed list.
  // Required: a quotation is drawn from ONE stock and there is no moment in
  // its life with none, which is why the column is NOT NULL.
  const stock = fields.option("stock", STOCKS, { required: true });
  // `S67` — no validity date and no delivery period. Both are SMAC's. And
  // since `S70` and `S119` no payment method and no shipment terms either:
  // both are the dispatch's now, and typed rather than free text.

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

  if (!fields.ok || !companyId || !stock) return fields.state;

  let threadId: string;
  try {
    // `S50` — the project is created FIRST, in its own transaction, and the
    // thread then names it. Two transactions rather than one: threading this
    // through `createProject`'s own `withAudit` would be a refactor of the
    // audit layer to avoid a residue that is not a defect. A failure between
    // them leaves a project with no quotation, which `S24` makes a legal
    // record and which `/projects/new` already produces every day.
    //
    // Only a name and the chosen company. Expected square metres, the city and
    // the rest stay on `/projects/new` and the edit form — this is the one
    // action `S50` asks for, not a second project form.
    const anchorId =
      projectId ??
      (
        await createProject(
          session,
          {
            name: newProjectName ?? "",
            sqmExpected: null,
            cityId: null,
            endState: null,
            lostReasonId: null,
            lossReason: null,
            inProduction: false,
            committed: false,
          },
          [{ companyId }],
        )
      ).id;

    const thread = await createQuotationThread(
      session,
      { projectId: anchorId, companyId, contactId },
      { stock },
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
  origin: "rep_change_request" | "coordinator_direct_edit",
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

/**
 * `S62` `S128` — **rejection carries a written reason**, which is why this
 * stopped being a field-less bound-id act.
 *
 * It had none at all: no parameter, no column, no control — `AUDIT 1` called it
 * the worst of `S62`'s three acts. The reason becomes a comment on the thread
 * and reaches the rep who raised it; both happen in the data layer's own
 * transaction, so this only shapes the input.
 */
export async function rejectThreadAction(
  threadId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const fields = readFields(formData);
  // `COMMENT_BODY_MAX`, because the reason IS a comment `S62` — the same cap
  // `returnForEditAction` reads it under, rather than a second number.
  const reason = fields.text("rejectionReason", {
    required: true,
    max: COMMENT_BODY_MAX,
  });
  if (!fields.ok || !reason) return fields.state;

  try {
    await rejectThread(session, threadId, reason);
  } catch (error) {
    return ruleErrorState(error, fields.values);
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
