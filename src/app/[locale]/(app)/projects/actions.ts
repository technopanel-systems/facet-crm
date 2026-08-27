"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { redirect } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import { setCreditSplit } from "@/lib/credit-splits";
import { PROJECT_END_STATES } from "@/lib/enums";
import {
  addProjectCompany,
  createProject,
  removeProjectCompany,
  updateProject,
  type ProjectCompanyLink,
  type ProjectInput,
} from "@/lib/projects";
import { readFields, ruleErrorState, type FormState } from "@/lib/validation";

function readProjectForm(formData: FormData) {
  const fields = readFields(formData);
  const input: ProjectInput = {
    name: fields.text("name", { required: true, max: 200 }) ?? "",
    // numeric(14,4) — kept as a string so a forecast the business is measured
    // on never passes through a float.
    sqmExpected: fields.decimal("sqmExpected", { min: 0, maxScale: 4 }),
    // No `region` beside it: the form offers no such control and
    // `regionForCity` has no fallback to give one to, so a reader that accepted
    // one would be accepting input nothing stores `D51`. The column is written
    // from the city.
    cityId: fields.uuid("cityId"),
    // One value since `S31` took `won` out of the vocabulary, so this reads
    // "lost, or open". Nothing may post `won` — it is derived from an approved
    // dispatch, and `verify:routes` asserts the select never offers it.
    endState: fields.option("endState", PROJECT_END_STATES),

    // Shape only — "required when lost, one of the nine, and only 'other'
    // takes the detail" is `assertLossReason`/`assertLossReasonDetail`'s job.
    lostReasonId: fields.uuid("lostReasonId"),
    lossReason: fields.text("lossReason", { max: 2000 }),
    inProduction: fields.checkbox("inProduction"),
    // `S29`'s fifth item. An unchecked box posts nothing, so clearing it is
    // the same act as never setting it `[validation.ts]`.
    committed: fields.checkbox("committed"),
  };
  return { fields, input };

}

/**
 * The participant rows arrive as repeated `companyId` inputs and nothing else.
 *
 * A participant carries no role label `S25` and no buyer flag `S26`, so one
 * repeated input is the whole repeater.
 */
function readLinks(formData: FormData): ProjectCompanyLink[] {
  return readFields(formData)
    .list("companyId")
    .filter((companyId) => companyId !== "")
    .map((companyId) => ({ companyId }));
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
 * Company links, added and removed on the project detail page
 * ------------------------------------------------------------------ */

export async function addProjectCompanyAction(
  projectId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const fields = readFields(formData);
  const companyId = fields.uuid("companyId", { required: true });
  if (!fields.ok || !companyId) return fields.state;

  try {
    await addProjectCompany(session, projectId, { companyId });
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
