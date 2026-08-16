"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { redirect } from "@/i18n/navigation";
import {
  createUser,
  deactivateUser,
  reactivateUser,
  requireSession,
  updateUser,
} from "@/lib/authz";
import { REGIONS } from "@/lib/enums";
import { reassignHandover } from "@/lib/team";
import { readFields, ruleErrorState, type FormState } from "@/lib/validation";

/**
 * A server action is a separately reachable POST that no layout wraps, so
 * every one of these calls `requireSession()` itself and every write re-checks
 * `can_manage_users` in the data layer `[19 §4]`.
 */

export async function createUserAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const fields = readFields(formData);

  const name = fields.text("name", { required: true, max: 200 });
  const email = fields.text("email", { required: true, max: 320 });
  const roleId = fields.uuid("roleId", { required: true });
  const password = fields.text("password", { required: true, max: 200 });
  const region = fields.option("region", REGIONS);

  if (!fields.ok || !name || !email || !roleId || !password) {
    return fields.state;
  }

  let userId: string;
  try {
    // Only the id is used. A `User` row carries `password_hash` and must never
    // travel any further than this.
    const created = await createUser(session, {
      name,
      email,
      roleId,
      password,
      region: region ?? null,
    });
    userId = created.id;
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  const locale = await getLocale();
  revalidatePath("/users");
  redirect({ href: `/users/${userId}`, locale });
  throw new Error("unreachable"); // redirect() never returns
}

export async function updateUserAction(
  userId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const fields = readFields(formData);

  const name = fields.text("name", { required: true, max: 200 });
  const email = fields.text("email", { required: true, max: 320 });
  const roleId = fields.uuid("roleId", { required: true });
  const region = fields.option("region", REGIONS);

  if (!fields.ok || !name || !email || !roleId) return fields.state;

  try {
    await updateUser(session, userId, {
      name,
      email,
      roleId,
      region: region ?? null,
    });
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  const locale = await getLocale();
  revalidatePath("/users");
  redirect({ href: `/users/${userId}`, locale });
  throw new Error("unreachable");
}

export async function deactivateUserAction(
  userId: string,
  previous: FormState,
): Promise<FormState> {
  const session = await requireSession();
  try {
    await deactivateUser(session, userId);
  } catch (error) {
    // `19 §5`'s self-deactivation refusal lands here, as a key.
    return ruleErrorState(error, previous.values);
  }
  revalidatePath("/users");
  revalidatePath(`/users/${userId}`);
  return {};
}

export async function reactivateUserAction(
  userId: string,
  previous: FormState,
): Promise<FormState> {
  const session = await requireSession();
  try {
    await reactivateUser(session, userId);
  } catch (error) {
    return ruleErrorState(error, previous.values);
  }
  revalidatePath("/users");
  revalidatePath(`/users/${userId}`);
  return {};
}

export async function reassignHandoverAction(
  fromUserId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const fields = readFields(formData);

  const toUserId = fields.uuid("toUserId", { required: true });
  const selection = {
    membershipIds: fields.list("membershipIds"),
    projectIds: fields.list("projectIds"),
    threadIds: fields.list("threadIds"),
  };

  if (!fields.ok || !toUserId) return fields.state;

  try {
    await reassignHandover(session, fromUserId, toUserId, selection);
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  const locale = await getLocale();
  // Two people's visibility just changed — every list that composes an
  // ownership filter has to be re-read.
  revalidatePath("/users");
  revalidatePath("/companies");
  revalidatePath("/projects");
  revalidatePath("/quotations");
  // Back to the same screen: the handed-over rows are simply gone from it,
  // which is the feedback.
  redirect({ href: `/users/${fromUserId}/handover`, locale });
  throw new Error("unreachable");
}
