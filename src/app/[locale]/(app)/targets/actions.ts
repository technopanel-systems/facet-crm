"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/authz";
import { setCompanyTarget, setTarget } from "@/lib/targets";
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

  // The Team tab is where an overseer now sets and reads it `D39` `D49`;
  // `/targets` is the book-holder's own screen and reads the same row.
  revalidatePath("/");
  revalidatePath("/targets");
  return {};
}

/**
 * The same write for **someone not listed** on the Team tab (`D39`, session
 * 53) — a rep with no company and no target yet has no row to carry a bound
 * action, so this one reads the person from the form instead. `setTarget`
 * re-checks the flag and that the person is active; nothing is decided here.
 */
export async function setTargetForAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const fields = readFields(formData);

  const userId = fields.text("userId", { required: true, max: 64 });
  const period = fields.text("period", { required: true, max: 10 });
  const sqm = fields.decimal("sqm", { required: true, min: 0, maxScale: 4 });

  if (!fields.ok || !userId || !period || !sqm) return fields.state;

  try {
    await setTarget(session, userId, period, sqm);
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  revalidatePath("/");
  revalidatePath("/targets");
  return {};
}

/**
 * Set the company target `S136`. Always a new row, as the per-person action is —
 * `setCompanyTarget` enforces that a same-month correction supersedes `S84`.
 *
 * **No bound argument, and that is the difference.** The per-rep action binds a
 * `userId` at its call site; a company target names nobody, so this one takes the
 * `useActionState` pair alone and matches `TargetRow`'s `Action` type unbound.
 *
 * `requireSession()` here and the flag re-checked in the data layer, for the
 * reason above: a server action is a separately reachable POST endpoint that no
 * layout wraps.
 */
export async function setCompanyTargetAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const fields = readFields(formData);

  const period = fields.text("period", { required: true, max: 10 });
  const sqm = fields.decimal("sqm", { required: true, min: 0, maxScale: 4 });

  if (!fields.ok || !period || !sqm) return fields.state;

  try {
    await setCompanyTarget(session, period, sqm);
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  revalidatePath("/targets");
  revalidatePath("/");
  return {};
}
