"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/authz";
import { SHARED_RECORD_TYPES } from "@/lib/enums";
import { grantShare, revokeShare } from "@/lib/sharing";
import { readFields, ruleErrorState, type FormState } from "@/lib/validation";

/**
 * The sharing write path's two POSTs `[07 B1]`, `[25 §30]`.
 *
 * They live beside the panel in `_components/` rather than in a section's own
 * `actions.ts`: sharing hangs on three record types and owns no route, and a
 * route folder with no `page.tsx` would read as a screen somebody forgot to
 * build.
 *
 * `requireSession` is called here, not inherited: a server action is a
 * separately reachable POST that no layout wraps. Shape only — every invariant
 * (`can_share`, visibility of the record, an active recipient, no second live
 * row) is in `src/lib/sharing.ts`, where it holds for the verify script too.
 */

/** The paths a share changes: the record itself, and the grantee's badge. */
function revalidateFor(recordType: string, recordId: string): void {
  if (recordType === "company") revalidatePath(`/companies/${recordId}`);
  if (recordType === "project") revalidatePath(`/projects/${recordId}`);
  if (recordType === "quotation_thread") {
    revalidatePath(`/quotations/${recordId}`);
  }
  // A grant raises a `share.granted` and a revoke lets the sweep withdraw it.
  revalidatePath("/notifications");
}

export async function grantShareAction(
  recordType: string,
  recordId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();

  // Narrowed against the runtime list, not cast: `record_shares.record_type`
  // carries six values and only three grant anything `[21 §3]`.
  const type = SHARED_RECORD_TYPES.find((value) => value === recordType);
  if (!type) return { error: "sharing.errors.recordTypeNotShareable" };

  const fields = readFields(formData);
  const toUserId = fields.uuid("sharedWithUserId", { required: true });
  if (!fields.ok || !toUserId) return fields.state;

  try {
    await grantShare(session, type, recordId, toUserId);
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  revalidateFor(type, recordId);
  // No redirect: the panel is on the screen the form is already on, and the
  // revalidated page shows the new row in place — `addCommentAction`'s shape.
  return {};
}

/**
 * Revoke one share.
 *
 * The share id is **bound server-side**, never a form field: the panel binds it
 * per row, so a tampered POST cannot name a different share. `revokeShare`
 * re-checks the flag and the anchor's visibility regardless — the UI is never
 * the gate.
 */
export async function revokeShareAction(
  shareId: string,
  recordType: string,
  recordId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();

  // The form has no fields of its own — the id is bound, not posted — but a
  // refusal still returns through `ruleErrorState`, which wants the submitted
  // values so the shape matches every other action's.
  const fields = readFields(formData);

  try {
    await revokeShare(session, shareId);
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  revalidateFor(recordType, recordId);
  return {};
}
