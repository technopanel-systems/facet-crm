"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import {
  FormField,
  FormShell,
  SelectField,
} from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { emptyFormState, type FormState } from "@/lib/validation";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * Option types are re-declared here rather than imported from the data
 * modules: this is a client component, and a value import from `@/lib/...`
 * would bundle the Postgres driver for the browser — a failure only
 * `npm run build` catches.
 */
export type ThreadOption = {
  id: string;
  label: string;
  companyLabel: string;
  raisedByName: string;
  quotedSqm: string | null;
  dispatchedSqm: string;
};

export type CompanyOption = { id: string; label: string };
export type RepOption = { id: string; name: string };

/**
 * Recording a dispatch. Two modes, and the difference between them is the
 * whole of `07 C6`.
 *
 * **The mode is a URL parameter, not client state.** The direct mode needs to
 * search for a company, and a search that lives in the URL is shareable,
 * survives a reload and needs no JavaScript — the same reasoning `SearchForm`
 * already follows. Only the submit path is a client action.
 */
export function DispatchForm({
  action,
  mode,
  threads,
  companies,
  reps,
  companyQuery,
  today,
}: {
  action: Action;
  mode: "linked" | "direct";
  threads: ThreadOption[];
  companies: CompanyOption[];
  reps: RepOption[];
  companyQuery: string;
  today: string;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <FormShell
      action={formAction}
      error={state.error}
      actions={
        <>
          <Button type="submit" disabled={pending}>
            {pending ? t("common.saving") : t("dispatches.actions.record")}
          </Button>
          <Button asChild type="button" variant="ghost">
            <Link href="/dispatches">{t("common.cancel")}</Link>
          </Button>
        </>
      }
    >
      {mode === "linked" ? (
        <FormField
          name="quotationThreadId"
          label={t("dispatches.fields.quotation")}
          error={errors.quotationThreadId}
          hint={t("dispatches.detail.derivedHint")}
          required
        >
          <SelectField
            name="quotationThreadId"
            placeholder={t("dispatches.fields.quotationPlaceholder")}
            invalid={!!errors.quotationThreadId}
          >
            {threads.map((thread) => (
              <option key={thread.id} value={thread.id}>
                {thread.label}
              </option>
            ))}
          </SelectField>
        </FormField>
      ) : (
        <>
          <FormField
            name="companyId"
            label={t("dispatches.fields.company")}
            error={errors.companyId}
            hint={t("dispatches.detail.companySearchHint")}
            required
          >
            <SelectField
              name="companyId"
              placeholder={
                companyQuery.length < 2
                  ? t("dispatches.fields.companySearchFirst")
                  : t("dispatches.fields.companyPlaceholder")
              }
              disabled={companies.length === 0}
              invalid={!!errors.companyId}
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.label}
                </option>
              ))}
            </SelectField>
          </FormField>

          <FormField
            name="userId"
            label={t("dispatches.fields.rep")}
            error={errors.userId}
            required
          >
            <SelectField
              name="userId"
              placeholder={t("dispatches.fields.repPlaceholder")}
              invalid={!!errors.userId}
            >
              {reps.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  {rep.name}
                </option>
              ))}
            </SelectField>
          </FormField>
        </>
      )}

      <FormField
        name="sqm"
        label={t("dispatches.fields.sqm")}
        error={errors.sqm}
        required
      >
        <Input
          id="sqm"
          name="sqm"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.0001"
          dir="ltr"
          className="text-start"
          defaultValue={state.values?.sqm}
          aria-invalid={!!errors.sqm || undefined}
        />
      </FormField>

      <FormField
        name="dispatchDate"
        label={t("dispatches.fields.dispatchDate")}
        error={errors.dispatchDate}
        required
      >
        <Input
          id="dispatchDate"
          name="dispatchDate"
          type="date"
          dir="ltr"
          className="text-start"
          defaultValue={state.values?.dispatchDate ?? today}
          aria-invalid={!!errors.dispatchDate || undefined}
        />
      </FormField>
    </FormShell>
  );
}
