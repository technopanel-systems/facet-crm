"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/validation";

/**
 * Deactivate or reactivate, whichever applies — never both.
 *
 * A client component only because the refusal has to be shown: `19 §5` makes
 * self-deactivation a real, reachable error, and a plain `<form>` with a server
 * action has nowhere to render one.
 */
export function AccountActionForm({
  action,
  label,
  hint,
  variant,
  slot,
}: {
  action: (state: FormState) => Promise<FormState>;
  label: string;
  hint: string;
  variant: "destructive" | "secondary";
  /**
   * Which of the two this is, as a DOM marker. The label is translated and the
   * class is styling, so neither identifies the form — and `verify:routes` §30
   * has to POST the deactivation and never the reactivation, on a page that
   * renders three forms `CLAUDE.md`. Named by the caller rather than derived
   * from `variant`, so appearance never decides identity.
   */
  slot: "account-deactivate" | "account-reactivate";
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);

  return (
    <form
      action={formAction}
      data-slot={slot}
      className="flex flex-col items-start gap-3"
    >
      <p className="text-muted-foreground text-start text-sm">{hint}</p>
      {state.error ? (
        <p role="alert" className="text-destructive text-start text-sm">
          {t(state.error)}
        </p>
      ) : null}
      <Button type="submit" size="sm" variant={variant} disabled={pending}>
        {pending ? t("common.saving") : label}
      </Button>
    </form>
  );
}
