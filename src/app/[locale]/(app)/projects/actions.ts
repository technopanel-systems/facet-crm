"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { redirect } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import { setCreditSplit } from "@/lib/credit-splits";
import { PROJECT_END_STATES, REGIONS } from "@/lib/enums";
import {
  addProjectCompany,
  createProject,
  removeProjectCompany,
  updateProject,
  updateProjectCompany,
  type ProjectCompanyLink,
  type ProjectInput,
} from "@/lib/projects";
import { readFields, ruleErrorState, type FormState } from "@/lib/validation";

function readProjectForm(formData: FormData) {
  const fields = readFields(formData);
  const input: ProjectInput = {
    nameEn: fields.text("nameEn", { required: true, max: 200 }) ?? "",
    nameAr: fields.text("nameAr", { max: 200 }),
    // numeric(14,4) — kept as a string so a forecast the business is measured
    // on never passes through a float.
    sqmExpected: fields.decimal("sqmExpected", { min: 0, maxScale: 4 }),
    region: fields.option("region", REGIONS),
    cityId: fields.uuid("cityId"),
    endState: fields.option("endState", PROJECT_END_STATES),
    lossReason: fields.text("lossReason", { max: 2000 }),
  };
  return { fields, input };
}

/**
 * The company-link rows arrive as parallel repeated inputs plus a single
 * `buyerIndex`, because "at most one buyer" `[12 §6]` is a radio group: the
 * invalid two-buyer state cannot be expressed in the form at all.
 */
function readLinks(formData: FormData): ProjectCompanyLink[] {
  const fields = readFields(formData);
  const companyIds = fields.list("companyId");
  const roles = fields.list("role");
  const buyerIndex = formData.get("buyerIndex");

  return companyIds
    .map((companyId, index) => ({
      companyId,
      role: roles[index]?.trim() || null,
      isBuyer: buyerIndex === String(index),
    }))
    .filter((link) => link.companyId !== "");
}

export async function createProjectAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const { fields, input } = readProjectForm(formData);
  if (!fields.ok) return fields.state;

  let projectId: string;
  try {
    const project = await createProject(session, input, readLinks(formData));
    projectId = project.id;
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  const locale = await getLocale();
  revalidatePath("/projects");
  redirect({ href: `/projects/${projectId}`, locale });
  throw new Error("unreachable"); // redirect() never returns
}

export async function updateProjectAction(
  projectId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const { fields, input } = readProjectForm(formData);
  if (!fields.ok) return fields.state;

  try {
    await updateProject(session, projectId, input);
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  const locale = await getLocale();
  revalidatePath("/projects");
  redirect({ href: `/projects/${projectId}`, locale });
  throw new Error("unreachable"); // redirect() never returns
}

/* ------------------------------------------------------------------ *
 * Company links, edited from the project detail page
 * ------------------------------------------------------------------ */

export async function addProjectCompanyAction(
  projectId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const fields = readFields(formData);
  const companyId = fields.uuid("companyId", { required: true });
  const role = fields.text("role", { max: 200 });
  if (!fields.ok || !companyId) return fields.state;

  try {
    await addProjectCompany(session, projectId, {
      companyId,
      role,
      isBuyer: fields.checkbox("isBuyer"),
    });
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  revalidatePath(`/projects/${projectId}`);
  return {};
}

export async function updateProjectCompanyAction(
  projectId: string,
  linkId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const fields = readFields(formData);
  const role = fields.text("role", { max: 200 });
  if (!fields.ok) return fields.state;

  try {
    await updateProjectCompany(session, projectId, linkId, {
      role,
      isBuyer: fields.checkbox("isBuyer"),
    });
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  revalidatePath(`/projects/${projectId}`);
  return {};
}

/** Takes no form data — `useActionState` still supplies the previous state. */
export async function removeProjectCompanyAction(
  projectId: string,
  linkId: string,
): Promise<FormState> {
  const session = await requireSession();
  try {
    await removeProjectCompany(session, projectId, linkId);
  } catch (error) {
    return ruleErrorState(error);
  }

  revalidatePath(`/projects/${projectId}`);
  return {};
}

/**
 * Set the project's credit split `[07 D3]`, `[12 §1]`, `[18 §3]`.
 *
 * The form posts a checkbox list — WHO shares — and a date. No percentage is
 * read, because none is typed: `setCreditSplit` divides equally and computes
 * the shares itself.
 */
export async function setCreditSplitAction(
  projectId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const fields = readFields(formData);

  const effectiveFrom = fields.date("effectiveFrom", { required: true });
  const userIds = fields.list("userIds").filter((id) => id.length > 0);

  if (!fields.ok || !effectiveFrom) return fields.state;

  try {
    await setCreditSplit(session, projectId, { effectiveFrom, userIds });
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/targets");
  return {};
}
