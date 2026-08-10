"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/authz";
import { markAllRead, markRead } from "@/lib/notifications";
import { readFields, type FormState } from "@/lib/validation";

/**
 * `07 G1` — **reading is not resolving.** These actions set `read_at` and never
 * `resolved_at`, so a persistent act-now entry stays in the badge until the
 * condition it points at actually clears. There is deliberately no "dismiss"
 * action to write: a notification that can be swiped away is one that gets
 * swiped away.
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
