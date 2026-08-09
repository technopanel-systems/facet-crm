"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import { FormField, SelectField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import type { CityRow, LookupRow } from "@/lib/lookups";
// Enums come from `lib/enums`, never from `lib/companies`: importing a data
// module here would pull the Postgres driver into the browser bundle.
import { REGIONS, WARMTHS } from "@/lib/enums";
import type { CompanyInput } from "@/lib/companies";
import { emptyFormState, type FormState } from "@/lib/validation";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export type CompanyDefaults = Partial<CompanyInput>;

/**
 * One form for both create and edit — the fields are identical, so a second
 * component would be two things to keep in step.
 *
 * `values` from a rejected submit wins over `defaults`, so a validation error
 * never silently empties what the user typed.
 */
export function CompanyForm({
  action,
  defaults,
  submitLabel,
  cancelHref,
  categories,
  cities,
  leadSources,
  locale,
}: {
  action: Action;
  defaults?: CompanyDefaults;
  submitLabel: string;
  cancelHref: string;
  categories: LookupRow[];
  cities: CityRow[];
  leadSources: LookupRow[];
  locale: string;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);

  const errors = state.fieldErrors ?? {};
  const value = (name: keyof CompanyInput) =>
    state.values?.[name] ?? (defaults?.[name] as string | null | undefined) ?? "";

  const optionName = (row: LookupRow) =>
    locale === "ar" ? row.nameAr || row.nameEn : row.nameEn;

  // `15 §4` — the city decides the region. This state only drives what the
  // user sees; the data layer derives the value that is actually written, so a
  // stale or tampered display cannot put a record in the wrong region.
  const [cityId, setCityId] = useState(value("cityId"));
  const cityRegion = cities.find((city) => city.id === cityId)?.region ?? null;

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
            defaultValue={value("nameAr")}
            dir="rtl"
            aria-invalid={Boolean(errors.nameAr) || undefined}
            className="text-start"
          />
        </FormField>

        {/* A phone number is read left-to-right whatever the interface language. */}
        <FormField name="phone" label={t("common.phone")} error={errors.phone}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            dir="ltr"
            defaultValue={value("phone")}
            aria-invalid={Boolean(errors.phone) || undefined}
            className="text-start"
          />
        </FormField>

        <FormField
          name="vatNumber"
          label={t("companies.fields.vatNumber")}
          error={errors.vatNumber}
        >
          <Input
            id="vatNumber"
            name="vatNumber"
            dir="ltr"
            defaultValue={value("vatNumber")}
            aria-invalid={Boolean(errors.vatNumber) || undefined}
            className="text-start"
          />
        </FormField>

        <FormField
          name="categoryId"
          label={t("companies.fields.category")}
          error={errors.categoryId}
          hint={categories.length === 0 ? t("common.noOptions") : undefined}
        >
          <SelectField
            name="categoryId"
            defaultValue={value("categoryId")}
            placeholder={t("common.none")}
            disabled={categories.length === 0}
            invalid={Boolean(errors.categoryId)}
          >
            {categories.map((row) => (
              <option key={row.id} value={row.id}>
                {optionName(row)}
              </option>
            ))}
          </SelectField>
        </FormField>

        <FormField
          name="leadSourceId"
          label={t("companies.fields.leadSource")}
          error={errors.leadSourceId}
          hint={leadSources.length === 0 ? t("common.noOptions") : undefined}
        >
          <SelectField
            name="leadSourceId"
            defaultValue={value("leadSourceId")}
            placeholder={t("common.none")}
            disabled={leadSources.length === 0}
            invalid={Boolean(errors.leadSourceId)}
          >
            {leadSources.map((row) => (
              <option key={row.id} value={row.id}>
                {optionName(row)}
              </option>
            ))}
          </SelectField>
        </FormField>

        {/* City before region, because the city now answers the region
            `[15 §4]` and a field should not sit above the one that fills it. */}
        <FormField
          name="cityId"
          label={t("common.city")}
          error={errors.cityId}
          hint={cities.length === 0 ? t("common.noOptions") : undefined}
        >
          <Combobox
            name="cityId"
            defaultValue={value("cityId")}
            options={cities.map((row) => ({
              value: row.id,
              label: optionName(row),
              // The other language's name, so search works in both `[15 §5]`.
              altLabel: locale === "ar" ? row.nameEn : row.nameAr,
            }))}
            placeholder={t("common.none")}
            searchPlaceholder={t("common.searchCity")}
            emptyLabel={t("common.noMatches")}
            clearLabel={t("common.none")}
            disabled={cities.length === 0}
            invalid={Boolean(errors.cityId)}
            onChange={setCityId}
          />
        </FormField>

        <FormField
          name="region"
          label={t("common.region")}
          error={errors.region}
          hint={cityRegion ? t("common.regionFromCity") : undefined}
        >
          {cityRegion ? (
            // Derived, so it is shown rather than asked. No input is posted:
            // the data layer reads the city's region regardless `[15 §4]`.
            <p
              className="border-input bg-muted text-muted-foreground flex h-9
                items-center rounded-md border px-3 text-start text-sm"
            >
              {t(`enums.region.${cityRegion}`)}
            </p>
          ) : (
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
          )}
        </FormField>

        <FormField
          name="warmth"
          label={t("companies.fields.warmth")}
          error={errors.warmth}
        >
          <SelectField
            name="warmth"
            defaultValue={value("warmth")}
            placeholder={t("companies.fields.warmthUnset")}
            invalid={Boolean(errors.warmth)}
          >
            {WARMTHS.map((warmth) => (
              <option key={warmth} value={warmth}>
                {t(`enums.warmth.${warmth}`)}
              </option>
            ))}
          </SelectField>
        </FormField>
      </div>

      <FormField name="notes" label={t("common.notes")} error={errors.notes}>
        <Textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={value("notes")}
          aria-invalid={Boolean(errors.notes) || undefined}
          className="text-start"
        />
      </FormField>

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
