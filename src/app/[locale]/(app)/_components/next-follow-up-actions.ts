"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/authz";
import { setNextFollowUp } from "@/lib/follow-ups";
import { readFields, ruleErrorState, type FormState } from "@/lib/validation";

/**
 * The rep's own follow-up date `[25 §18]` — one POST, and its clear.
 *
 * Beside the panel in `_components/` rather than in a section's `actions.ts`,
 * for `sharing-actions.ts`'s reason: the date hangs on three record types and
 * owns no route of its own.
 *
 * `requireSession` is called here, not inherited — a server action is a
 * separately reachable POST that no layout wraps. Shape only: the gate
 * (`canViewRecord`), the past-date refusal and the audit entry are all in
 * `src/lib/follow-ups.ts`, where they hold for the verify script too.
 */

/** The three anchors `25 §18` names. Narrowed against a list, never cast. */
const ANCHORS = ["company", "project", "quotation_thread"] as const;
type Anchor = (typeof ANCHORS)[number];

/** The record's own screen — the queue and the rail badge move with it. */
function revalidateFor(recordType: Anchor, recordId: string): void {
  if (recordType === "company") revalidatePath(`/companies/${recordId}`);
  if (recordType === "project") revalidatePath(`/projects/${recordId}`);
  if (recordType === "quotation_thread") {
    revalidatePath(`/quotations/${recordId}`);
  }
  // Setting or clearing a date adds or removes rows from both.
  revalidatePath("/follow-ups");
  revalidatePath("/");
}

/**
 * Set or move the date.
 *
 * `recordType` and `recordId` are **bound server-side** by the panel, never
 * posted, so a tampered form cannot name a different record. `setNextFollowUp`
 * re-checks visibility regardless — the UI is never the gate.
 */
export async function setNextFollowUpAction(
  recordType: string,
  recordId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();

  const type = ANCHORS.find((value) => value === recordType);
  if (!type) return { error: "followUps.errors.notYours" };

  const fields = readFields(formData);
  const date = fields.date("nextFollowUpAt", { required: true });
  if (!fields.ok || !date) return fields.state;

  try {
    await setNextFollowUp(session, type, recordId, date);
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  revalidateFor(type, recordId);
  // No redirect: the panel is on the screen the form is already on, and the
  // revalidated page shows the new date in place — `grantShareAction`'s shape.
  return {};
}

/**
 * Clear it, and let `07 D5`'s thresholds apply again `[25 §18]`.
 *
 * Its own action rather than an empty string through the setter: an empty date
 * input and a deliberate clear are different intents, and `readFields.date`
 * would have to stop being `required` to tell them apart — which would let a
 * mis-submitted empty form silently wipe a date somebody set.
 */
export async function clearNextFollowUpAction(
  recordType: string,
  recordId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();

  const type = ANCHORS.find((value) => value === recordType);
  if (!type) return { error: "followUps.errors.notYours" };

  // No fields of its own — the record is bound, not posted — but a refusal
  // still returns through `ruleErrorState`, which wants the submitted values
  // so the shape matches every other action's.
  const fields = readFields(formData);

  try {
    await setNextFollowUp(session, type, recordId, null);
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  revalidateFor(type, recordId);
  return {};
}
