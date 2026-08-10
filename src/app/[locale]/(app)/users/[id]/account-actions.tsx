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
}: {
  action: (state: FormState) => Promise<FormState>;
  label: string;
  hint: string;
  variant: "destructive" | "secondary";
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);

  return (
    <form action={formAction} className="flex flex-col items-start gap-3">
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
