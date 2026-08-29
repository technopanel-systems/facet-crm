"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { redirect } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import { addComment, updateComment } from "@/lib/comments";
import { COMMENT_BODY_MAX, COMMENT_RECORD_TYPES } from "@/lib/enums";
import { readFields, ruleErrorState, type FormState } from "@/lib/validation";

/**
 * Read the comment box.
 *
 * Shape only — whether this identity may see the record, and whether they wrote
 * the comment they are editing, are business invariants and belong in
 * `src/lib/comments.ts`, where they hold for every caller `[13 §1]`.
 *
 * The body is capped at `COMMENT_BODY_MAX` — a report's narrative length. An
 * uncapped body breaks the timeline layout on all six screens that render one,
 * and no colleague note needs to run longer than the account of the visit it is
 * about.
 */
function readComment(formData: FormData) {
  const fields = readFields(formData);
  const body = fields.text("body", { required: true, max: COMMENT_BODY_MAX });

  // Repeated checkbox values `[25 §11]`. A malformed id fails the whole submit
  // rather than being dropped: it can only come from a tampered form, and
  // silently posting a comment that tagged nobody would be worse.
  const mentions = fields.list("mentions").filter((value) => value !== "");
  for (const [index, userId] of mentions.entries()) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      fields.fail(`mentions.${index}`, "validation.invalid");
    }
  }

  return { fields, body, mentions };
}

/** The paths a comment can change. A comment shows on its record's thread and,
 *  through `/activity`, in the day's counts `[25 §14]`. Two records since
 *  `27b`, not five `S114`. */
function revalidateFor(recordType: string, recordId: string): void {
  revalidatePath("/activity");
  if (recordType === "project") revalidatePath(`/projects/${recordId}`);
  if (recordType === "quotation_thread") {
    revalidatePath(`/quotations/${recordId}`);
  }
}

export async function addCommentAction(
  recordType: string,
  recordId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();

  const type = COMMENT_RECORD_TYPES.find((value) => value === recordType);
  if (!type) return { error: "comments.errors.recordNotFound" };

  const { fields, body, mentions } = readComment(formData);
  if (!fields.ok || !body) return fields.state;

  try {
    await addComment(session, {
      recordType: type,
      recordId,
      body,
      mentions,
    });
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  revalidateFor(type, recordId);
  // No redirect: the thread is on the screen the composer is already on
  // `[25 §9]`, and the revalidated page shows the new comment in place.
  return {};
}

export async function updateCommentAction(
  commentId: string,
  recordType: string,
  recordId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const { fields, body, mentions } = readComment(formData);
  if (!fields.ok || !body) return fields.state;

  try {
    await updateComment(session, commentId, { body, mentions });
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  const locale = await getLocale();
  revalidateFor(recordType, recordId);
  redirect({ href: recordHref(recordType, recordId), locale });
  throw new Error("unreachable"); // redirect() never returns
}

/**
 * Back to the thread the comment lives on. There is no comment page `[25 §9]`.
 *
 * **The fallback is the project, and that is the safe half of the pair.**
 * `recordType` arrives as a bound `string`, so this cannot be exhaustive over
 * the union; it used to fall through to `/companies/`, which after `S114` would
 * send a reader to a record that can hold no comment at all. Both live values
 * are named, and the one that is reached by falling through is a real anchor.
 */
function recordHref(recordType: string, recordId: string): string {
  if (recordType === "quotation_thread") return `/quotations/${recordId}`;
  return `/projects/${recordId}`;
}
