"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/authz";
import { setTarget } from "@/lib/targets";
import { readFields, ruleErrorState, type FormState } from "@/lib/validation";

/**
 * Set a target `[07 D1]`. Always a new row — a same-month correction
 * supersedes rather than edits `[10 §6]`, which `setTarget` enforces.
 *
 * `requireSession()` here, and the flag re-checked in the data layer: a server
 * action is a separately reachable POST endpoint that no layout wraps.
 */
export async function setTargetAction(
  userId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const fields = readFields(formData);

  const period = fields.text("period", { required: true, max: 10 });
  const sqm = fields.decimal("sqm", { required: true, min: 0, maxScale: 4 });

  if (!fields.ok || !period || !sqm) return fields.state;

  try {
    await setTarget(session, userId, period, sqm);
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  revalidatePath("/targets");
  return {};
}
