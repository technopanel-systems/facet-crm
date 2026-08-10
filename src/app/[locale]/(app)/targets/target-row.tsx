"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emptyFormState, type FormState } from "@/lib/validation";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * The set-target control for one person, in one month.
 *
 * Its own form and its own action state, so one person's error cannot blank
 * another person's input — the same reasoning as the quotation line editors.
 * Setting a target never edits: `setTarget` writes a superseding row
 * `[07 D1]`, `[10 §6]`, and the field shows what is in force now.
 */
export function TargetRow({
  action,
  period,
  currentSqm,
}: {
  action: Action;
  period: string;
  currentSqm: string | null;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);
  const error = state.error ?? state.fieldErrors?.sqm;

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="period" value={period} />
      <Input
        name="sqm"
        type="number"
        inputMode="decimal"
        min="0"
        step="0.0001"
        dir="ltr"
        className="h-8 w-32 text-start"
        defaultValue={currentSqm ?? ""}
        aria-label={t("targets.fields.targetSqm")}
        aria-invalid={!!error || undefined}
      />
      <Button type="submit" size="xs" variant="outline" disabled={pending}>
        {pending ? t("common.saving") : t("targets.actions.setTarget")}
      </Button>
      {error ? (
        <span role="alert" className="text-destructive text-start text-xs">
          {t(error)}
        </span>
      ) : null}
    </form>
  );
}
