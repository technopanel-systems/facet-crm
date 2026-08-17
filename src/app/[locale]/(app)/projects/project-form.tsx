"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import {
  FormField,
  FormShell,
  SelectField,
} from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { OTHER_LOSS_REASON_CODE, PROJECT_END_STATES, REGIONS } from "@/lib/enums";
import type { CityRow, LossReasonRow } from "@/lib/lookups";
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
  lossReasons,
  locale,
  /** Links are chosen at creation; afterwards they are managed on the detail
   *  page, where each row can be edited or removed on its own `[14 §4]`. */
  withCompanies = false,
}: {
  action: Action;
  defaults?: Partial<ProjectInput>;
  submitLabel: string;
  cancelHref: string;
  cities: CityRow[];
  companies: CompanyOption[];
  lossReasons: LossReasonRow[];
  locale: string;
  withCompanies?: boolean;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);
  const [endState, setEndState] = useState(defaults?.endState ?? "");

  const errors = state.fieldErrors ?? {};
  const value = (name: keyof ProjectInput) =>
    state.values?.[name] ?? (defaults?.[name] as string | null | undefined) ?? "";

  // `15 §4` — display only; the data layer derives what is written.
  const [cityId, setCityId] = useState(value("cityId"));
  const cityRegion = cities.find((city) => city.id === cityId)?.region ?? null;

  // `25 §5` — which of the nine, so the detail field knows whether it is
  // `other`'s intake or forbidden. Matched by code, never the uuid itself.
  const [lostReasonId, setLostReasonId] = useState(value("lostReasonId"));
  const isOtherReason =
    lossReasons.find((r) => r.id === lostReasonId)?.code ===
    OTHER_LOSS_REASON_CODE;

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

      {/* City before region — the city answers the region `[15 §4]`. */}
      <FormField
        name="cityId"
        label={t("common.city")}
        error={errors.cityId}
        hint={cities.length === 0 ? t("common.noOptions") : undefined}
      >
        <Combobox
          name="cityId"
          defaultValue={value("cityId")}
          options={cities.map((city) => ({
            value: city.id,
            label: locale === "ar" ? city.nameAr || city.nameEn : city.nameEn,
            altLabel: locale === "ar" ? city.nameEn : city.nameAr,
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

      {/* Shown only for a lost project — the reason is required then `[07 C5]`,
          `[25 §5]`, and asking for it at other times invites a meaningless
          answer. Left `hidden` rather than unmounted: a stale pick here is
          discarded server-side the moment `endState` is not `lost`, so it
          cannot produce an error on a field the rep can no longer see. */}
      <div hidden={endState !== "lost"}>
        <FormField
          name="lostReasonId"
          label={t("projects.fields.lossReason")}
          error={errors.lostReasonId}
          hint={lossReasons.length === 0 ? t("common.noOptions") : undefined}
          required={endState === "lost"}
        >
          <SelectField
            name="lostReasonId"
            defaultValue={value("lostReasonId")}
            placeholder={t("common.none")}
            invalid={Boolean(errors.lostReasonId)}
            disabled={lossReasons.length === 0}
            onChange={setLostReasonId}
          >
            {lossReasons.map((reason) => (
              <option key={reason.id} value={reason.id} data-code={reason.code}>
                {locale === "ar" ? reason.nameAr || reason.nameEn : reason.nameEn}
              </option>
            ))}
          </SelectField>
        </FormField>

        {/* Unmounted, not merely `hidden` — a hidden textarea still posts its
            value. A rep who types detail for `other` and then picks a real
            reason must not have that stale text silently refused: removing
            the field from the DOM removes it from the submit too `[25 §5]`. */}
        {isOtherReason ? (
          <FormField
            name="lossReason"
            label={t("projects.fields.lossReasonDetail")}
            error={errors.lossReason}
            required
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
        ) : null}
      </div>

      <div className="flex h-9 items-center gap-2">
        <Checkbox
          id="inProduction"
          name="inProduction"
          defaultChecked={defaults?.inProduction ?? false}
        />
        {/* `25 §4` — a plain label the rep sets. Deliberately unverified, and
            never wired to the production module: production sometimes
            changes and stock sometimes covers an order. */}
        <Label htmlFor="inProduction">{t("projects.fields.inProduction")}</Label>
      </div>

      {withCompanies ? (
        <ProjectCompaniesField
          companies={companies}
          error={errors.companyId}
        />
      ) : null}
    </FormShell>
  );
}
