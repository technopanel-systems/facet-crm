"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import { FormField, SelectField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { PROJECT_END_STATES, REGIONS } from "@/lib/enums";
import type { LookupRow } from "@/lib/lookups";
import type { ProjectInput } from "@/lib/projects";
import { emptyFormState, type FormState } from "@/lib/validation";

import { ProjectCompaniesField, type CompanyOption } from "./project-companies-field";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export function ProjectForm({
  action,
  defaults,
  submitLabel,
  cancelHref,
  cities,
  companies,
  locale,
  /** Links are chosen at creation; afterwards they are managed on the detail
   *  page, where each row can be edited or removed on its own `[14 §4]`. */
  withCompanies = false,
}: {
  action: Action;
  defaults?: Partial<ProjectInput>;
  submitLabel: string;
  cancelHref: string;
  cities: LookupRow[];
  companies: CompanyOption[];
  locale: string;
  withCompanies?: boolean;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);
  const [endState, setEndState] = useState(defaults?.endState ?? "");

  const errors = state.fieldErrors ?? {};
  const value = (name: keyof ProjectInput) =>
    state.values?.[name] ?? (defaults?.[name] as string | null | undefined) ?? "";

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error ? (
        <p role="alert" className="text-destructive text-start text-sm">
          {t(state.error)}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          name="nameEn"
          label={t("common.nameEn")}
          error={errors.nameEn}
          required
        >
          <Input
            id="nameEn"
            name="nameEn"
            defaultValue={value("nameEn")}
            required
            aria-invalid={Boolean(errors.nameEn) || undefined}
            className="text-start"
          />
        </FormField>

        <FormField name="nameAr" label={t("common.nameAr")} error={errors.nameAr}>
          <Input
            id="nameAr"
            name="nameAr"
            dir="rtl"
            defaultValue={value("nameAr")}
            aria-invalid={Boolean(errors.nameAr) || undefined}
            className="text-start"
          />
        </FormField>

        {/* The forecast, and the only square-metre figure a human types —
            achieved SQM is derived from dispatches `[04 C1]`. */}
        <FormField
          name="sqmExpected"
          label={t("projects.fields.sqmExpected")}
          error={errors.sqmExpected}
        >
          <Input
            id="sqmExpected"
            name="sqmExpected"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.0001"
            dir="ltr"
            defaultValue={value("sqmExpected")}
            aria-invalid={Boolean(errors.sqmExpected) || undefined}
            className="text-start"
          />
        </FormField>

        <FormField name="region" label={t("common.region")} error={errors.region}>
          <SelectField
            name="region"
            defaultValue={value("region")}
            placeholder={t("common.none")}
            invalid={Boolean(errors.region)}
          >
            {REGIONS.map((region) => (
              <option key={region} value={region}>
                {t(`enums.region.${region}`)}
              </option>
            ))}
          </SelectField>
        </FormField>

        <FormField
          name="cityId"
          label={t("common.city")}
          error={errors.cityId}
          hint={cities.length === 0 ? t("common.noOptions") : undefined}
        >
          <SelectField
            name="cityId"
            defaultValue={value("cityId")}
            placeholder={t("common.none")}
            disabled={cities.length === 0}
            invalid={Boolean(errors.cityId)}
          >
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {locale === "ar" ? city.nameAr || city.nameEn : city.nameEn}
              </option>
            ))}
          </SelectField>
        </FormField>

        <FormField
          name="endState"
          label={t("projects.fields.endState")}
          error={errors.endState}
        >
          <SelectField
            name="endState"
            defaultValue={value("endState")}
            placeholder={t("projects.fields.endStateOpen")}
            invalid={Boolean(errors.endState)}
            onChange={setEndState}
          >
            {PROJECT_END_STATES.map((option) => (
              <option key={option} value={option}>
                {t(`enums.projectEndState.${option}`)}
              </option>
            ))}
          </SelectField>
        </FormField>
      </div>

      {/* Shown only for a lost project — the reason is required then `[07 C5]`,
          and asking for it at other times invites a meaningless answer. */}
      <div hidden={endState !== "lost"}>
        <FormField
          name="lossReason"
          label={t("projects.fields.lossReason")}
          error={errors.lossReason}
          required={endState === "lost"}
        >
          <Textarea
            id="lossReason"
            name="lossReason"
            rows={3}
            defaultValue={value("lossReason")}
            aria-invalid={Boolean(errors.lossReason) || undefined}
            className="text-start"
          />
        </FormField>
      </div>

      {withCompanies ? (
        <ProjectCompaniesField
          companies={companies}
          locale={locale}
          error={errors.companyId}
        />
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : submitLabel}
        </Button>
        <Button asChild type="button" variant="ghost">
          <Link href={cancelHref}>{t("common.cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
