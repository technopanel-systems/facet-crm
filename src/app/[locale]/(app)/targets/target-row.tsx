"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emptyFormState, type FormState } from "@/lib/validation";

import { Disclosure, rejected } from "../_components/disclosure";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * The set-target control for one person, in one month.
 *
 * **It is not in a cell any more** `D58`, `AD20`. It used to render an `<Input>`
 * and a save button inside a `<TableCell>`, which is inline cell editing in the
 * plain sense of `D58`'s ban however the control behaved. `D49` asks for an
 * edit control **per row**, and the two are reconciled by the row rather than
 * the cell: `AttainmentTable` gives each person a second `<TableRow>` beneath
 * their figures and this disclosure lives in it, so no cell in the table is
 * editable and every row still carries its own control.
 *
 * **The disclosure is `Disclosure`** — the shared one, native, its fields in the
 * markup whether it is open or shut `D20`. A rejected POST reopens it, so a
 * scripts-off failure re-renders with the message showing rather than folding
 * the error away where nobody would find it.
 *
 * Its own form and its own action state, so one person's error cannot blank
 * another person's input — the same reasoning as the quotation line editors.
 * Setting a target never edits: `setTarget` writes a superseding row `S84`,
 * and the field shows what is in force now.
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
    <Disclosure
      label={t("targets.actions.openTarget")}
      open={rejected(state)}
      act="target-edit"
    >
      {/* `data-act` is `verify:routes` §17's handle — a bound action moved
          into a disclosure is exactly the shape that hung, and a translated
          string could not tell this form from another. */}
      <form
        action={formAction}
        data-act="set-target"
        className="flex flex-wrap items-center gap-2"
      >
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
    </Disclosure>
  );
}
