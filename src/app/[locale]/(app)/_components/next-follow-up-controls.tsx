"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emptyFormState, type FormState } from "@/lib/validation";

/**
 * The date field, its clear, and what the panel says beside them `[25 §18]`.
 *
 * **Each form carries its own `useActionState`**, so a rejected set cannot
 * blank the clear — `SharingControls`' shape, and `DormancyPanel`'s before it.
 *
 * **A native `<input type="date">`**, deliberately: no client state, nothing to
 * submit with JavaScript, and the browser places the RTL picker. The same
 * reasoning `15 §5` gives for the native `<select>`.
 *
 * Every type here is re-declared rather than imported. A client component that
 * value-imports a `@/lib` data module bundles the Postgres driver for the
 * browser, and only `npm run build` catches it.
 */
type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export type NextFollowUpView = {
  /** `YYYY-MM-DD`, or null when no date is set. */
  value: string | null;
  /** Pre-formatted by the server component — a date needs the request locale. */
  valueLabel: string | null;
  /** Who set the value in force, and when. Null when no audit row was found. */
  setByName: string | null;
  setOnLabel: string | null;
  /**
   * Set when the anchor's company is on hold **past** the date, so the
   * follow-up will not raise on the day it is set for.
   */
  heldUntilLabel: string | null;
  heldCompanyName: string | null;
};

export function NextFollowUpControls({
  view,
  setAction,
  clearAction,
}: {
  view: NextFollowUpView;
  setAction: Action;
  clearAction: Action;
}) {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-3">
      {view.value ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-col text-start">
            {/* No `dir` — the label is a locale-formatted date whose ar form
                places itself with U+200F marks; `dir="ltr"` scrambled it
                (A2-1, `98f1e2e`). */}
            <span className="num text-sm font-medium">{view.valueLabel}</span>
            {/* One column per record and the last writer wins, so the person
                whose reminder just changed has to be able to see that it did.
                It does not prevent the overwrite — either of them may
                legitimately move it. */}
            {view.setByName && view.setOnLabel ? (
              <span
                data-slot="next-follow-up-set-by"
                className="text-muted-foreground text-xs"
              >
                {t("followUps.nextFollowUp.setBy", {
                  name: view.setByName,
                  date: view.setOnLabel,
                })}
              </span>
            ) : null}
          </span>
          <ClearForm action={clearAction} />
        </div>
      ) : (
        <p className="text-muted-foreground text-start text-sm">
          {t("followUps.nextFollowUp.none")}
        </p>
      )}

      {/* A date that cannot fire on the day it is set for must say so. The
          precedence is not changed — on hold is about the customer and it is
          right that it wins — it is only stated. */}
      {view.heldUntilLabel && view.heldCompanyName ? (
        <p
          role="status"
          data-slot="next-follow-up-held"
          className="border-line text-muted-foreground border-t pt-3 text-start text-xs"
        >
          {t("followUps.nextFollowUp.heldUntil", {
            company: view.heldCompanyName,
            date: view.heldUntilLabel,
          })}
        </p>
      ) : null}

      <SetForm action={setAction} current={view.value} />

      <p className="text-muted-foreground text-start text-xs">
        {t("followUps.nextFollowUp.hint")}
      </p>
    </div>
  );
}

function SetForm({
  action,
  current,
}: {
  action: Action;
  current: string | null;
}) {
  const t = useTranslations();
  const [state, submit, pending] = useActionState(action, emptyFormState);

  return (
    <form
      action={submit}
      data-slot="next-follow-up-set"
      className="border-line flex flex-col gap-2 border-t pt-3"
    >
      <FormField
        label={t("followUps.nextFollowUp.label")}
        name="nextFollowUpAt"
        error={state.fieldErrors?.nextFollowUpAt ?? state.error}
      >
        <Input
          type="date"
          name="nextFollowUpAt"
          defaultValue={state.values?.nextFollowUpAt ?? current ?? ""}
          aria-invalid={Boolean(state.fieldErrors?.nextFollowUpAt) || undefined}
        />
      </FormField>
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? t("common.saving") : t("followUps.nextFollowUp.save")}
        </Button>
      </div>
    </form>
  );
}

function ClearForm({ action }: { action: Action }) {
  const t = useTranslations();
  const [state, submit, pending] = useActionState(action, emptyFormState);

  return (
    <form
      action={submit}
      data-slot="next-follow-up-clear"
      className="flex flex-col items-end gap-1"
    >
      <Button type="submit" size="xs" variant="outline" disabled={pending}>
        {pending ? t("common.saving") : t("followUps.nextFollowUp.clear")}
      </Button>
      {state.error ? (
        <p role="alert" className="text-destructive text-end text-xs">
          {t(state.error)}
        </p>
      ) : null}
    </form>
  );
}
