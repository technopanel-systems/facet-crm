"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { redirect } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import {
  createCompany,
  updateCompany,
  REGIONS,
  WARMTHS,
  type CompanyInput,
} from "@/lib/companies";
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
 * Only `name_en` is required. `09 §3.1` says fields become required
 * progressively in the application layer but names no thresholds, so none are
 * invented `[14 §6]`.
 */
function readCompanyForm(formData: FormData) {
  const fields = readFields(formData);
  const input: CompanyInput = {
    nameEn: fields.text("nameEn", { required: true, max: 200 }) ?? "",
    nameAr: fields.text("nameAr", { max: 200 }),
    phone: fields.text("phone", { max: 50 }),
    categoryId: fields.uuid("categoryId"),
    vatNumber: fields.text("vatNumber", { max: 50 }),
    region: fields.option("region", REGIONS),
    cityId: fields.uuid("cityId"),
    leadSourceId: fields.uuid("leadSourceId"),
    notes: fields.text("notes", { max: 4000 }),
    warmth: fields.option("warmth", WARMTHS),
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
