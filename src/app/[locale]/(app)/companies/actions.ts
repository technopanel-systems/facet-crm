"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { redirect } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import {
  createCompany,
  updateCompany,
  REGIONS,
  type CompanyInput,
} from "@/lib/companies";
import {
  archiveCompany,
  reassignCompany,
  reincludeCompany,
} from "@/lib/dormancy";
import {
  readFields,
  ruleErrorState,
  type FormState,
} from "@/lib/validation";

/**
 * `requireSession` is called here, not inherited from the (app) layout: a
 * server action is a separately reachable POST endpoint and no layout wraps
 * it. The data layer then re-checks visibility before it writes.
 *
 * Three fields are required: the name — one field, English or Arabic `S12` —
 * the phone `S13`, and the country `S14`. Beyond those, `09 §3.1` says fields
 * become required progressively in the application layer but names no
 * thresholds, so none are invented `[14 §6]`.
 *
 * The required check is here **as well as** on the input and in the database.
 * That is not belt-and-braces for its own sake: the `required` attribute is a
 * browser convenience a POST can skip entirely, the `NOT NULL` gives a 500
 * rather than a message under the field, and only this layer can answer with a
 * translation key the form renders where the rep is looking.
 *
 * `?? ""` on a required field is unreachable — `fields.ok` is false whenever
 * one failed, and both actions return before the input is used. It is there to
 * satisfy the non-nullable `CompanyInput`, which is what makes an edit path
 * that drops the phone `S13` fail to compile.
 */
function readCompanyForm(formData: FormData) {
  const fields = readFields(formData);
  const input: CompanyInput = {
    name: fields.text("name", { required: true, max: 200 }) ?? "",
    phone: fields.text("phone", { required: true, max: 50 }) ?? "",
    countryId: fields.uuid("countryId", { required: true }) ?? "",
    categoryId: fields.uuid("categoryId"),
    vatNumber: fields.text("vatNumber", { max: 50 }),
    // Both are posted only for a Saudi country and `placeForCountry` discards
    // them otherwise `S15` — the form does not render the fields, and the data
    // layer does not trust that it didn't.
    region: fields.option("region", REGIONS),
    cityId: fields.uuid("cityId"),
    leadSourceId: fields.uuid("leadSourceId"),
    notes: fields.text("notes", { max: 4000 }),
  };
  return { fields, input };
}

export async function createCompanyAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const { fields, input } = readCompanyForm(formData);
  if (!fields.ok) return fields.state;

  let companyId: string;
  try {
    const company = await createCompany(session, input);
    companyId = company.id;
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  const locale = await getLocale();
  revalidatePath("/companies");
  redirect({ href: `/companies/${companyId}`, locale });
  throw new Error("unreachable"); // redirect() never returns
}

export async function updateCompanyAction(
  companyId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const { fields, input } = readCompanyForm(formData);
  if (!fields.ok) return fields.state;

  try {
    await updateCompany(session, companyId, input);
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  const locale = await getLocale();
  revalidatePath("/companies");
  redirect({ href: `/companies/${companyId}`, locale });
  throw new Error("unreachable"); // redirect() never returns
}

/* ------------------------------------------------------------------ *
 * Dormancy — `07 E6`'s three routes `[21 §6]`
 * ------------------------------------------------------------------ */

/**
 * Each route re-checks its own permission in the data layer: the rep may
 * re-include their own company, and reassigning or archiving needs
 * `can_assign`. Rendering the control is presentation; `dormancy.ts` is the
 * gate.
 *
 * `revalidatePath("/companies", "layout")` rather than the detail path alone,
 * because a decision here changes `/follow-ups` and `/performance`'s coverage
 * section too — a re-included company leaves the queue, and an archived one
 * leaves both.
 */
export async function reincludeCompanyAction(
  companyId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const fields = readFields(formData);
  const note = fields.text("note", { max: 500 });
  if (!fields.ok) return fields.state;

  try {
    await reincludeCompany(session, companyId, note ?? undefined);
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  revalidatePath("/companies", "layout");
  revalidatePath("/follow-ups");
  return {};
}

export async function reassignCompanyAction(
  companyId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const fields = readFields(formData);
  const toUserId = fields.uuid("toUserId", { required: true });
  if (!fields.ok || !toUserId) return fields.state;

  try {
    await reassignCompany(session, companyId, toUserId);
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  revalidatePath("/companies", "layout");
  revalidatePath("/follow-ups");
  return {};
}

export async function archiveCompanyAction(
  companyId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const fields = readFields(formData);
  const note = fields.text("note", { required: true, max: 500 });
  if (!fields.ok || !note) return fields.state;

  try {
    await archiveCompany(session, companyId, note);
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  revalidatePath("/companies", "layout");
  revalidatePath("/follow-ups");
  return {};
}
