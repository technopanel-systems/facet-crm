"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { emptyFormState, type FormState } from "@/lib/validation";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export type SplitCandidate = { id: string; name: string; inForce: boolean };
export type SplitShare = { userId: string; userName: string; percentage: string };

/**
 * The credit split for a project — the rare exception, sized like one
 * `[18 §3]`.
 *
 * **It asks WHO, never how much.** Credit divides equally and no percentage is
 * typed anywhere in FACET, which is what closes `04 D2`. The shares below are
 * shown as computed text, not inputs.
 *
 * **One form for the whole generation**, unlike `ProjectLinks` next door which
 * uses one small form per row. A generation is atomic: "the split in force on a
 * date" is only meaningful if every row of it was written together. Do not
 * "fix" this back into per-row forms.
 *
 * No history list. Splits supersede rather than edit `[07 D3]`, and the audit
 * log holds what changed and who changed it.
 */
export function CreditSplit({
  action,
  candidates,
  inForce,
  effectiveFrom,
  today,
  mayEdit,
}: {
  action: Action;
  candidates: SplitCandidate[];
  inForce: SplitShare[] | null;
  effectiveFrom: string | null;
  today: string;
  mayEdit: boolean;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);
  const error = state.error ?? state.fieldErrors?.userIds;

  return (
    <div className="flex flex-col gap-4">
      {inForce ? (
        <dl className="flex flex-col gap-1.5 text-sm">
          <p className="text-muted-foreground text-start text-xs">
            {t("credit.detail.inForceSince", { date: effectiveFrom ?? "" })}
          </p>
          {inForce.map((share) => (
            <div key={share.userId} className="flex justify-between gap-3">
              <dt className="text-start">{share.userName}</dt>
              <dd className="text-start" dir="ltr">
                {share.percentage}%
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        // The normal case `[18 §1]`: no split, and the rep named on each
        // dispatch takes all of it.
        <p className="text-muted-foreground text-start text-sm">
          {t("credit.detail.noSplit")}
        </p>
      )}

      {mayEdit ? (
        <form action={formAction} className="flex flex-col gap-3 border-t pt-4">
          <p className="text-start text-sm font-medium">
            {t("credit.actions.setSplit")}
          </p>
          <p className="text-muted-foreground text-start text-xs">
            {t("credit.actions.setSplitHint")}
          </p>

          <ul className="flex flex-col gap-2">
            {candidates.map((candidate) => (
              <li key={candidate.id} className="flex items-center gap-2">
                <Checkbox
                  id={`split-${candidate.id}`}
                  name="userIds"
                  value={candidate.id}
                  defaultChecked={candidate.inForce}
                />
                <label
                  htmlFor={`split-${candidate.id}`}
                  className="text-start text-sm"
                >
                  {candidate.name}
                </label>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="effectiveFrom"
                className="text-start text-xs font-medium"
              >
                {t("credit.fields.effectiveFrom")}
              </label>
              <Input
                id="effectiveFrom"
                name="effectiveFrom"
                type="date"
                min={today}
                defaultValue={state.values?.effectiveFrom ?? today}
                dir="ltr"
                className="h-8 w-44 text-start"
                aria-invalid={!!state.fieldErrors?.effectiveFrom || undefined}
              />
            </div>
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              {pending ? t("common.saving") : t("common.save")}
            </Button>
          </div>

          {error ? (
            <p role="alert" className="text-destructive text-start text-xs">
              {t(error)}
            </p>
          ) : null}
          {state.fieldErrors?.effectiveFrom ? (
            <p role="alert" className="text-destructive text-start text-xs">
              {t(state.fieldErrors.effectiveFrom)}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
