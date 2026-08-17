"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import {
  FormField,
  FormShell,
  SelectField,
} from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import type { CityRow, CountryRow, LookupRow } from "@/lib/lookups";
// Values come from `lib/enums`, never from `lib/lookups` or `lib/companies`:
// importing a data module here would pull the Postgres driver into the browser
// bundle. The `import type` lines above are erased and pull in nothing.
import { REGIONS, SAUDI_CODE } from "@/lib/enums";
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
  countries,
  cities,
  leadSources,
  locale,
}: {
  action: Action;
  defaults?: CompanyDefaults;
  submitLabel: string;
  cancelHref: string;
  categories: LookupRow[];
  countries: CountryRow[];
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

  // A new company starts on Saudi Arabia, because most of them are `S14` and
  // making the ordinary case cost a click to tidy up the rare one is the wrong
  // trade. On an edit the company's own country wins.
  const saudiId = countries.find((row) => row.code === SAUDI_CODE)?.id ?? "";
  const defaultCountryId = value("countryId") || saudiId;

  // `S15` — a city and a region are Saudi-only. Both states below drive what
  // the user sees and nothing else: the data layer resolves what is actually
  // written, so a stale or tampered display cannot put a record in the wrong
  // region, nor leave a Riyadh city on a company that moved to Egypt.
  const [countryId, setCountryId] = useState(defaultCountryId);
  const isSaudi =
    countries.find((row) => row.id === countryId)?.code === SAUDI_CODE;

  // `15 §4` — the city decides the region.
  const [cityId, setCityId] = useState(value("cityId"));
  const cityRegion = cities.find((city) => city.id === cityId)?.region ?? null;

  return (
    <FormShell
      action={formAction}
      error={state.error}
      actions={
        <>
          <Button type="submit" disabled={pending}>
            {pending ? t("common.saving") : submitLabel}
          </Button>
          <Button asChild type="button" variant="ghost">
            <Link href={cancelHref}>{t("common.cancel")}</Link>
          </Button>
        </>
      }
    >
      {/* One field, English or Arabic `S12`. `dir="auto"` because the script
          is a property of what the rep types, not of the interface `D62`. */}
      <FormField name="name" label={t("common.name")} error={errors.name} required>
        <Input
          id="name"
          name="name"
          defaultValue={value("name")}
          required
          dir="auto"
          aria-invalid={Boolean(errors.name) || undefined}
          className="text-start"
        />
      </FormField>

      {/* Mandatory `S13`, because `S23` matches companies on it. A phone
          number is read left-to-right whatever the interface language. */}
      <FormField
        name="phone"
        label={t("common.phone")}
        error={errors.phone}
        required
      >
        <Input
          id="phone"
          name="phone"
          type="tel"
          required
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

      {/* Country before city, because the country decides whether there is a
          city field at all `S14` `S15` — a field must not sit above the one
          that governs it. Required, and it holds a lookup id rather than a
          typed name, so `D62`'s `dir="auto"` does not apply. */}
      <FormField
        name="countryId"
        label={t("common.country")}
        error={errors.countryId}
        required
      >
        <SelectField
          name="countryId"
          defaultValue={defaultCountryId}
          placeholder={t("common.none")}
          required
          invalid={Boolean(errors.countryId)}
          onChange={setCountryId}
        >
          {countries.map((row) => (
            // `data-code` so `verify:routes` can tell Saudi Arabia from the
            // rest without importing `src/` or reading a translated label —
            // the device the loss-reason picker already uses.
            <option key={row.id} value={row.id} data-code={row.code}>
              {optionName(row)}
            </option>
          ))}
        </SelectField>
      </FormField>

      {/* `S15` is Saudi-only: `cities` holds Saudi cities and `region` is a
          Saudi administrative region, so a company anywhere else is asked for
          neither. Not disabled, not greyed — simply not there, which is `D47`'s
          rule; and `placeForCountry` nulls both columns whatever a POST
          claims. */}
      {isSaudi ? (
        <>
          {/* City before region, because the city now answers the region
              `[15 §4]` and a field should not sit above the one that fills
              it. */}
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
        </>
      ) : null}

      {/* A warmth select sat here until `25 §6` cut it. Credit terms `[25 §7]`
          do NOT replace it on this form: they are the manager's to set, not
          the rep's. */}

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
    </FormShell>
  );
}
