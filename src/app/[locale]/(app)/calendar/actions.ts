"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/authz";
import {
  addNonWorkingDays,
  NON_WORKING_KINDS,
  removeNonWorkingDays,
  type NonWorkingKind,
} from "@/lib/calendar";
import { readFields, ruleErrorState, type FormState } from "@/lib/validation";

/**
 * Enter a range of non-working time `S94`. One action for both kinds: the
 * form says which, and the data layer decides who may enter it `S109`.
 *
 * `requireSession()` here — a server action is a separately reachable POST
 * endpoint that no layout wraps. Every screen that reads the pace or the
 * reminders is revalidated, because a holiday moves the tick on all of them.
 */
export async function addNonWorkingDaysAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const fields = readFields(formData);

  const kindText = fields.text("kind", { required: true, max: 20 });
  const kind = NON_WORKING_KINDS.find((k) => k === kindText) as
    | NonWorkingKind
    | undefined;
  if (!kind) {
    return { error: "calendar.errors.kindUnknown", values: fields.values };
  }
  // Each form names its fields by kind — `leaveStartsOn`, `holidayStartsOn`
  // — so two forms on one page never share a name `D20`.
  const prefix = kind === "leave" ? "leave" : "holiday";
  const userId = fields.text("userId", { max: 64 });
  const startsOn = fields.text(`${prefix}StartsOn`, { required: true, max: 10 });
  const endsOn = fields.text(`${prefix}EndsOn`, { required: true, max: 10 });
  const label = fields.text(`${prefix}Label`, { required: true, max: 120 });

  if (!fields.ok || !startsOn || !endsOn || !label) {
    return fields.state;
  }

  try {
    await addNonWorkingDays(session, {
      kind,
      // The leave form posts the person; with no picker it posts nobody and
      // the data layer reads that as the reader's own.
      userId: kind === "leave" ? (userId || session.user.id) : null,
      startsOn,
      endsOn,
      label,
    });
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  revalidatePath("/calendar");
  revalidatePath("/");
  revalidatePath("/follow-ups");
  return {};
}

/** Soft-remove one range — it stops counting; the row stays `S107`. */
export async function removeNonWorkingDaysAction(
  id: string,
  _previous: FormState,
): Promise<FormState> {
  void _previous;
  const session = await requireSession();
  try {
    await removeNonWorkingDays(session, id);
  } catch (error) {
    return ruleErrorState(error, {});
  }
  revalidatePath("/calendar");
  revalidatePath("/");
  revalidatePath("/follow-ups");
  return {};
}
