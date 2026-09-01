"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { redirect } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import {
  createCompany,
  updateCompany,
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
function readCompanyForm(
  formData: FormData,
  { leadSourceRequired }: { leadSourceRequired: boolean },
) {
  const fields = readFields(formData);
  const input: CompanyInput = {
    name: fields.text("name", { required: true, max: 200 }) ?? "",
    phone: fields.text("phone", { required: true, max: 50 }) ?? "",
    countryId: fields.uuid("countryId", { required: true }) ?? "",
    categoryId: fields.uuid("categoryId"),
    // Posted only for a Saudi country, and `placeForCountry` discards it
    // otherwise `S15` — the form does not render the field, and the data layer
    // does not trust that it didn't. It is not `{ required: true }` here for
    // the same reason: whether a city is required depends on the country, so
    // the refusal belongs where the country is resolved.
    //
    // **There is no `region` beside it.** `S15` says the rep is never asked,
    // so the form posts none and this reader must not invent a way to accept
    // one `[AUDIT 1 F3]`.
    cityId: fields.uuid("cityId"),
    // `S17` — mandatory when a company is CREATED, so the create action passes
    // true and the update action false: a pre-rule blank may stay blank on
    // edit, and the data layer refuses only a CLEARING. The requirement sits
    // at this door rather than inside `createCompany`, because the seed and
    // the verify fixtures legitimately recreate the pre-rule world — the 261
    // blanks — and the form is the only door a rep can reach.
    leadSourceId: fields.uuid("leadSourceId", { required: leadSourceRequired }),
    notes: fields.text("notes", { max: 4000 }),
  };
  return { fields, input };
}

export async function createCompanyAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const { fields, input } = readCompanyForm(formData, {
    leadSourceRequired: true,
  });
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
  const { fields, input } = readCompanyForm(formData, {
    leadSourceRequired: false,
  });
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
 * because a decision here changes `/follow-ups` and this list's own silence
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
