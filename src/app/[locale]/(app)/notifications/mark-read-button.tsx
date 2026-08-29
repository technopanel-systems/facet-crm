"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/validation";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * Mark one notification read `S91` — which is now the only disposal there is.
 *
 * There is deliberately no dismiss control beside it. `07 G1` withheld one so
 * an act-now entry could not be swiped past its condition; there are no
 * conditions since `S91`, and a bell carrying news `S92` has nothing a dismiss
 * would mean that read does not.
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
