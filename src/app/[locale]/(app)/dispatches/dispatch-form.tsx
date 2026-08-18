"use client";

import { useActionState, useState } from "react";
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
  /** `S74` — the quotation's own project, already translated. Null when it
   *  has none `S50`, which is what puts the picker on this form. */
  projectLabel: string | null;
};

export type CompanyOption = { id: string; label: string };
export type RepOption = { id: string; name: string };
export type ProjectOption = { id: string; label: string };

/**
 * Recording a dispatch. Two modes, and the difference between them is the
 * whole of `07 C6`.
 *
 * **The mode is a URL parameter, not client state.** The direct mode needs to
 * search for a company, and a search that lives in the URL is shareable,
 * survives a reload and needs no JavaScript — the same reasoning `SearchForm`
 * already follows. Only the submit path is a client action.
 *
 * **The project follows the chosen quotation** `S74`, which is the one thing
 * here that IS client state: the quotation carrying a project shows it and
 * offers nothing to change, and the quotation with none `S50` shows a picker.
 * The server decides either way — it derives the project from the thread and
 * refuses a disagreeing one — so this only spares the coordinator a field
 * they may not answer.
 */
export function DispatchForm({
  action,
  mode,
  threads,
  companies,
  reps,
  projects,
  companyQuery,
  today,
}: {
  action: Action;
  mode: "linked" | "direct";
  threads: ThreadOption[];
  companies: CompanyOption[];
  reps: RepOption[];
  projects: ProjectOption[];
  companyQuery: string;
  today: string;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);
  const errors = state.fieldErrors ?? {};
  const [threadId, setThreadId] = useState(
    state.values?.quotationThreadId ?? "",
  );
  const thread = threads.find((row) => row.id === threadId);

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
        <>
          <FormField
            name="quotationThreadId"
            label={t("dispatches.fields.quotation")}
            error={errors.quotationThreadId}
            hint={t("dispatches.detail.derivedHint")}
            required
          >
            {/* Uncontrolled, like every other `SelectField`: the state only
                decides which project field appears, so `defaultValue` still
                wins after a rejected submit. */}
            <SelectField
              name="quotationThreadId"
              defaultValue={threadId}
              onChange={setThreadId}
              placeholder={t("dispatches.fields.quotationPlaceholder")}
              invalid={!!errors.quotationThreadId}
            >
              {threads.map((row) => (
                <option
                  key={row.id}
                  value={row.id}
                  // A DOM handle for `verify:routes`, which may not read a
                  // translated label to tell the two branches apart.
                  data-project={row.projectLabel === null ? "" : "set"}
                >
                  {row.label}
                </option>
              ))}
            </SelectField>
          </FormField>

          {/* `S74` — the project is shown, not chosen, when the quotation has
              one. No input: the server takes it from the quotation, so a field
              here would be a value the coordinator could only get wrong. */}
          {thread && thread.projectLabel !== null ? (
            <FormField
              name="project"
              label={t("dispatches.fields.project")}
              hint={t("dispatches.detail.projectFromQuotation")}
            >
              {/* The label above points at this, and a project name may
                  hold either script `D62`. */}
              <p id="project" dir="auto" className="text-sm font-medium">
                {thread.projectLabel}
              </p>
            </FormField>
          ) : null}

          {/* `S74` — and chosen when it has none `S50`. The hint says the
              second half of the rule out loud, because writing the project
              back onto the quotation is a consequence a coordinator should
              not discover afterwards. */}
          {thread && thread.projectLabel === null ? (
            <FormField
              name="projectId"
              label={t("dispatches.fields.project")}
              error={errors.projectId}
              hint={t("dispatches.detail.projectWriteBack")}
              required
            >
              <SelectField
                name="projectId"
                placeholder={t("dispatches.fields.projectPlaceholder")}
                invalid={!!errors.projectId}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.label}
                  </option>
                ))}
              </SelectField>
            </FormField>
          ) : null}
        </>
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
