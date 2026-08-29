"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/authz";
import { markAllRead, markRead } from "@/lib/notifications";
import { readFields, type FormState } from "@/lib/validation";

/**
 * **Reading is the whole disposal** `S91`. `07 G1` set `read_at` and never
 * `resolved_at`, so a persistent act-now entry stayed in the badge until its
 * condition cleared; there are no persistent entries and no conditions, so this
 * is what takes a row out of the count. There is still no "dismiss" action and
 * there is nothing for one to do — `07 G1` refused the swipe to protect work,
 * and a bell carries none `S92`.
 *
 * No layout wraps a server action, so each one calls `requireSession()` itself;
 * the recipient term is then applied inside `markRead` / `markAllRead`, in the
 * statement's own `WHERE` `[00 §1.13]`.
 */
export async function markReadAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const fields = readFields(formData);
  // Posted rather than bound, so the row carries `name="notificationId"` — a
  // DOM marker a verification pass can assert on, which a translated string
  // never is.
  const notificationId = fields.uuid("notificationId", { required: true });
  if (!fields.ok || !notificationId) return fields.state;

  // A mismatched id updates zero rows rather than somebody else's, and nothing
  // is reported back either way: whether a notification exists is not something
  // a non-recipient should be able to probe for.
  await markRead(session, notificationId);
  revalidatePath("/notifications");
  return {};
}

export async function markAllReadAction(): Promise<FormState> {
  const session = await requireSession();
  await markAllRead(session);
  revalidatePath("/notifications");
  return {};
}
