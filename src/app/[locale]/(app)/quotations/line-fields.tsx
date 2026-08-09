"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_SHEET_LENGTH_M,
  DEFAULT_SHEET_WIDTH_M,
  DEFAULT_VAT_RATE,
} from "@/lib/enums";
import { cn } from "@/lib/utils";

/**
 * The inputs for one product line, shared by the create form's repeated rows
 * and the detail page's per-row editors.
 *
 * These option types are declared here rather than imported from
 * `@/lib/lookups`, because this is a client component and a value import from
 * a data module would bundle the Postgres driver for the browser — the failure
 * only `npm run build` catches.
 */

export type CodeOption = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
};

export type NamedOption = { id: string; nameEn: string; nameAr: string };

export type ThicknessOption = {
  id: string;
  thicknessMm: string;
  isStandard: boolean;
};

export type ProductOptions = {
  suppliers: CodeOption[];
  classes: CodeOption[];
  fireRatings: CodeOption[];
  colours: CodeOption[];
  thicknesses: ThicknessOption[];
};

export type LineDefaults = {
  supplierId?: string | null;
  classId?: string | null;
  fireRatingId?: string | null;
  colourId?: string | null;
  customColour?: string | null;
  thicknessId?: string | null;
  widthM?: string | null;
  lengthM?: string | null;
  quantityPcs?: string | null;
  unitPrice?: string | null;
  vatRate?: string | null;
};

/** The same control styling `SelectField` applies, for the repeated rows that
 *  cannot use it: `SelectField` ties `id` to `name`, and these share a name. */
export const selectClasses = cn(
  "border-input bg-background text-foreground h-9 w-full rounded-md border",
  "ps-3 pe-8 text-start text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

export function optionLabel(row: NamedOption, locale: string): string {
  return locale === "ar" ? row.nameAr || row.nameEn : row.nameEn;
}

/** The code is what appears in the generated product name `[08 B1]`, so it is
 *  what a rep recognises; the name follows it as context. */
function codeLabel(row: CodeOption, locale: string): string {
  const name = optionLabel(row, locale);
  return name && name !== row.code ? `${row.code} — ${name}` : row.code;
}

function thicknessLabel(row: ThicknessOption): string {
  return `${row.thicknessMm.replace(/\.?0+$/, "")} mm`;
}

function Field({
  htmlFor,
  label,
  error,
  children,
}: {
  htmlFor: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-1.5">
      <Label
        htmlFor={htmlFor}
        className="text-muted-foreground text-start text-xs"
      >
        {label}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-destructive text-start text-xs">
          {t(error)}
        </p>
      ) : null}
    </div>
  );
}

export function LineFields({
  options,
  locale,
  idPrefix,
  defaults,
  errors = {},
}: {
  options: ProductOptions;
  locale: string;
  /** Makes label/control ids unique across repeated rows. */
  idPrefix: string;
  defaults?: LineDefaults;
  errors?: Record<string, string>;
}) {
  const t = useTranslations();
  // `12 §12` — one colour or the other. A select rather than a radio group,
  // because repeated radio rows sharing a name would be ONE group and the
  // server could not tell which row it belonged to.
  const [colourKind, setColourKind] = useState(
    defaults?.customColour ? "custom" : "standard",
  );

  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <Field
        htmlFor={id("supplierId")}
        label={t("quotations.detail.supplier")}
        error={errors.supplierId}
      >
        <select
          id={id("supplierId")}
          name="supplierId"
          defaultValue={defaults?.supplierId ?? ""}
          disabled={options.suppliers.length === 0}
          className={selectClasses}
        >
          <option value="">{t("common.none")}</option>
          {options.suppliers.map((row) => (
            <option key={row.id} value={row.id}>
              {codeLabel(row, locale)}
            </option>
          ))}
        </select>
      </Field>

      <Field
        htmlFor={id("classId")}
        label={t("quotations.detail.productClass")}
        error={errors.classId}
      >
        <select
          id={id("classId")}
          name="classId"
          defaultValue={defaults?.classId ?? ""}
          className={selectClasses}
        >
          <option value="">{t("common.none")}</option>
          {options.classes.map((row) => (
            <option key={row.id} value={row.id}>
              {codeLabel(row, locale)}
            </option>
          ))}
        </select>
      </Field>

      {/* No constraint ties a class to a fire rating — which combinations are
          real varies by factory `[12 §8]`. */}
      <Field
        htmlFor={id("fireRatingId")}
        label={t("quotations.detail.fireRating")}
        error={errors.fireRatingId}
      >
        <select
          id={id("fireRatingId")}
          name="fireRatingId"
          defaultValue={defaults?.fireRatingId ?? ""}
          className={selectClasses}
        >
          <option value="">{t("common.none")}</option>
          {options.fireRatings.map((row) => (
            <option key={row.id} value={row.id}>
              {codeLabel(row, locale)}
            </option>
          ))}
        </select>
      </Field>

      <Field
        htmlFor={id("thicknessId")}
        label={t("quotations.detail.thickness")}
        error={errors.thicknessId}
      >
        <select
          id={id("thicknessId")}
          name="thicknessId"
          defaultValue={defaults?.thicknessId ?? ""}
          className={selectClasses}
        >
          <option value="">{t("common.none")}</option>
          {options.thicknesses.map((row) => (
            <option key={row.id} value={row.id}>
              {thicknessLabel(row)}
            </option>
          ))}
        </select>
      </Field>

      <Field htmlFor={id("colourKind")} label={t("quotations.detail.colour")}>
        <select
          id={id("colourKind")}
          name="colourKind"
          value={colourKind}
          onChange={(event) => setColourKind(event.target.value)}
          className={selectClasses}
        >
          <option value="standard">{t("quotations.detail.colourStandard")}</option>
          <option value="custom">{t("quotations.detail.colourCustom")}</option>
        </select>
      </Field>

      {/* Both controls always submit, so the parallel rows stay index-aligned;
          the server reads whichever `colourKind` names. Hiding rather than
          disabling is what keeps that true — a disabled input sends nothing. */}
      <div hidden={colourKind !== "standard"}>
        <Field
          htmlFor={id("colourId")}
          label={t("quotations.detail.colourStandard")}
          error={errors.colourId}
        >
          <select
            id={id("colourId")}
            name="colourId"
            defaultValue={defaults?.colourId ?? ""}
            disabled={options.colours.length === 0}
            className={selectClasses}
          >
            <option value="">{t("common.none")}</option>
            {options.colours.map((row) => (
              <option key={row.id} value={row.id}>
                {codeLabel(row, locale)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* The rare RAL/Pantone special `[12 §12]`. Specials stay off the lookup
          so one-off customer colours do not pollute the list every rep picks
          from. */}
      <div hidden={colourKind !== "custom"}>
        <Field
          htmlFor={id("customColour")}
          label={t("quotations.detail.customColour")}
        >
          <Input
            id={id("customColour")}
            name="customColour"
            dir="ltr"
            defaultValue={defaults?.customColour ?? ""}
            placeholder="RAL 9016"
            className="text-start"
          />
        </Field>
      </div>

      {/* Standard values offered as defaults, both editable — constraining
          them would block real orders `[08 D3]`. */}
      <Field
        htmlFor={id("widthM")}
        label={t("quotations.detail.width")}
        error={errors.widthM}
      >
        <Input
          id={id("widthM")}
          name="widthM"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.0001"
          dir="ltr"
          defaultValue={defaults?.widthM ?? DEFAULT_SHEET_WIDTH_M}
          className="text-start"
        />
      </Field>

      <Field
        htmlFor={id("lengthM")}
        label={t("quotations.detail.length")}
        error={errors.lengthM}
      >
        <Input
          id={id("lengthM")}
          name="lengthM"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.0001"
          dir="ltr"
          defaultValue={defaults?.lengthM ?? DEFAULT_SHEET_LENGTH_M}
          className="text-start"
        />
      </Field>

      <Field
        htmlFor={id("quantityPcs")}
        label={t("quotations.detail.quantityPcs")}
        error={errors.quantityPcs}
      >
        <Input
          id={id("quantityPcs")}
          name="quantityPcs"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.0001"
          dir="ltr"
          defaultValue={defaults?.quantityPcs ?? ""}
          className="text-start"
        />
      </Field>

      {/* Per square metre `[16 §1]`, not per sheet. Area and every total are
          calculated from it — nobody types a total. */}
      <Field
        htmlFor={id("unitPrice")}
        label={t("quotations.detail.unitPrice")}
        error={errors.unitPrice}
      >
        <Input
          id={id("unitPrice")}
          name="unitPrice"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          dir="ltr"
          defaultValue={defaults?.unitPrice ?? ""}
          className="text-start"
        />
      </Field>

      <Field
        htmlFor={id("vatRate")}
        label={t("quotations.detail.vatRate")}
        error={errors.vatRate}
      >
        <Input
          id={id("vatRate")}
          name="vatRate"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          dir="ltr"
          defaultValue={defaults?.vatRate ?? DEFAULT_VAT_RATE}
          className="text-start"
        />
      </Field>
    </div>
  );
}

export function ServiceFields({
  services,
  locale,
  idPrefix,
  defaults,
  errors = {},
}: {
  services: NamedOption[];
  locale: string;
  idPrefix: string;
  defaults?: { serviceTypeId?: string | null; quantity?: string | null; unitPrice?: string | null };
  errors?: Record<string, string>;
}) {
  const t = useTranslations();
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field
        htmlFor={id("serviceTypeId")}
        label={t("quotations.detail.service")}
        error={errors.serviceTypeId}
      >
        <select
          id={id("serviceTypeId")}
          name="serviceTypeId"
          defaultValue={defaults?.serviceTypeId ?? ""}
          disabled={services.length === 0}
          className={selectClasses}
        >
          <option value="">{t("common.none")}</option>
          {services.map((row) => (
            <option key={row.id} value={row.id}>
              {optionLabel(row, locale)}
            </option>
          ))}
        </select>
      </Field>

      {/* Every service is priced per square metre `[12 §10]`, so there is no
          unit to choose — the application writes it. */}
      <Field
        htmlFor={id("serviceQuantity")}
        label={t("quotations.detail.serviceQuantity")}
        error={errors.serviceQuantity}
      >
        <Input
          id={id("serviceQuantity")}
          name="serviceQuantity"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.0001"
          dir="ltr"
          defaultValue={defaults?.quantity ?? ""}
          className="text-start"
        />
      </Field>

      <Field
        htmlFor={id("serviceUnitPrice")}
        label={t("quotations.detail.unitPrice")}
        error={errors.serviceUnitPrice}
      >
        <Input
          id={id("serviceUnitPrice")}
          name="serviceUnitPrice"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          dir="ltr"
          defaultValue={defaults?.unitPrice ?? ""}
          className="text-start"
        />
      </Field>
    </div>
  );
}
