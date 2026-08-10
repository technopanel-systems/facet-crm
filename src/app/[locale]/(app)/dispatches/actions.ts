"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { redirect } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import { recordDispatch } from "@/lib/dispatches";
import { readFields, ruleErrorState, type FormState } from "@/lib/validation";

/**
 * Every action calls `requireSession()` itself. A server action is a
 * separately reachable POST endpoint; no layout wraps it, so the gate cannot
 * be inherited. `recordDispatch` then re-checks `can_dispatch`, the payment
 * gate `[07 C3]` and the company lookup `[18 §2]` before it writes — this
 * function only shapes the input.
 */
export async function recordDispatchAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const fields = readFields(formData);

  // The two modes of `07 C6`. Against a quotation, company and rep are
  // DERIVED from the thread `[18 §7]` and the form does not offer them; a
  // direct sale has nothing to derive from, so it must name both.
  const quotationThreadId = fields.uuid("quotationThreadId");
  const isDirect = !quotationThreadId;

  const companyId = isDirect
    ? fields.uuid("companyId", { required: true })
    : null;
  const userId = isDirect ? fields.uuid("userId", { required: true }) : null;
  // `min: 0` rejects a negative here; the data layer rejects zero with its own
  // rule `[dispatches.errors.sqmPositive]`, because "nothing went out" is a
  // business statement rather than a malformed field.
  const sqm = fields.decimal("sqm", { required: true, min: 0, maxScale: 4 });
  const dispatchDate = fields.date("dispatchDate", { required: true });

  if (!fields.ok || !sqm || !dispatchDate) return fields.state;

  let dispatchId: string;
  try {
    const dispatch = await recordDispatch(session, {
      sqm,
      dispatchDate,
      quotationThreadId,
      companyId,
      userId,
    });
    dispatchId = dispatch.id;
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  const locale = await getLocale();
  revalidatePath("/dispatches");
  revalidatePath("/targets");
  redirect({ href: `/dispatches/${dispatchId}`, locale });
  throw new Error("unreachable"); // redirect() never returns
}
