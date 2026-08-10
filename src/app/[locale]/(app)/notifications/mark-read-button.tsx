"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/validation";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * Mark one notification read — and only read `[07 G1]`.
 *
 * There is deliberately no dismiss control beside it. An act-now entry stays
 * until the condition it points at clears, which is what makes the tier worth
 * trusting; the row says so in words rather than leaving the missing button to
 * be read as an oversight.
 *
 * Its own form and its own action state, so one row's failure cannot disturb
 * another — the same reasoning as `TargetRow` and the quotation line editors.
 */
export function MarkReadButton({
  action,
  label,
  notificationId,
}: {
  action: Action;
  label: "markRead" | "markAllRead";
  notificationId?: string;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);

  return (
    <form action={formAction}>
      {notificationId ? (
        <input type="hidden" name="notificationId" value={notificationId} />
      ) : null}
      <Button type="submit" size="xs" variant="outline" disabled={pending}>
        {pending ? t("common.saving") : t(`notifications.actions.${label}`)}
      </Button>
      {state.error ? (
        <span role="alert" className="text-destructive text-start text-xs">
          {t(state.error)}
        </span>
      ) : null}
    </form>
  );
}
