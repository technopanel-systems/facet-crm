"use client";

import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_SHEET_LENGTH_M,
  DEFAULT_SHEET_WIDTH_M,
} from "@/lib/enums";
import { cn } from "@/lib/utils";

/**
 * The inputs for one product line, shared by the create form's repeated rows
 * and the detail page's per-row editors.
 *
 * **Ordinary readable fields, in two bands** `S53` `D63`. What the product is —
 * supplier, class, fire rating, thickness, colour — then a rule, then how much
 * of it and at what price. The bands are separated and never labelled: five
 * rows on a create form would repeat the same two headings ten times.
 *
 * The old order was not this. It was SMAC's product code read left to right,
 * because `productDisplayName` reassembled that code and the form was laid out
 * to match it — colour sat fourth *because that is where it landed in the
 * generated name*. FACET does not reproduce SMAC's code format, so the order is
 * now the order a person fills it in.
 *
 * **There is no VAT field** `S57`. The rate is fixed at 15%, lives in
 * `VAT_RATE`, and is not a question anyone is asked.
 *
 * These option types are declared here rather than imported from
 * `@/lib/lookups`, because this is a client component and a value import from
 * a data module would bundle the Postgres driver for the browser — the failure
 * only `npm run build` catches.
 */

export type NamedOption = { id: string; nameEn: string; nameAr: string };

export type ThicknessOption = {
  id: string;
  thicknessMm: string;
  isStandard: boolean;
};

/** No colour list `[17 §2]` — the colour is typed, not picked. */
export type ProductOptions = {
  suppliers: NamedOption[];
  classes: NamedOption[];
  fireRatings: NamedOption[];
  thicknesses: ThicknessOption[];
};

export type LineDefaults = {
  supplierId?: string | null;
  classId?: string | null;
  fireRatingId?: string | null;
  customColour?: string | null;
  thicknessId?: string | null;
  widthM?: string | null;
  lengthM?: string | null;
  quantityPcs?: string | null;
  unitPrice?: string | null;
};

/** The same control styling `SelectField` applies, for the repeated rows that
 *  cannot use it: `SelectField` ties `id` to `name`, and these share a name.
 *  Kept byte-for-byte in step with it — this copy had drifted to `h-9`,
 *  `rounded-md` and `ring-[3px]`, so a line's selects stood 4px taller than
 *  every other select in the app and never showed an invalid ring. */
export const selectClasses = cn(
  "border-input bg-background text-foreground h-8 w-full rounded-lg border",
  "ps-3 pe-8 text-start text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
  "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

export function optionLabel(row: NamedOption, locale: string): string {
  return locale === "ar" ? row.nameAr || row.nameEn : row.nameEn;
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
  const id = (name: string) => `${idPrefix}-${name}`;
  const standardThicknessId = options.thicknesses.find(
    (row) => row.isStandard,
  )?.id;

  return (
    <div className="flex flex-col gap-4">
      {/* What the product is. Four picks, then the one thing typed. */}
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                  {optionLabel(row, locale)}
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
                  {optionLabel(row, locale)}
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
                  {optionLabel(row, locale)}
                </option>
              ))}
            </select>
          </Field>

          <Field
            htmlFor={id("thicknessId")}
            label={t("quotations.detail.thickness")}
            error={errors.thicknessId}
          >
            {/* 4 mm is the default `[17 §3]` — a new line starts on the standard
                sheet rather than on "none", which is not a thickness anybody
                means. It sits with the other picks now; it used to be justified
                as "the one the generated name omits", which was a fact about
                SMAC's code rather than about the panel. */}
            <select
              id={id("thicknessId")}
              name="thicknessId"
              defaultValue={defaults?.thicknessId ?? standardThicknessId ?? ""}
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
        </div>

        {/* One text field, not a list `[17 §2]`. The ordinary colour code and
            the rare RAL or Pantone special go in the same box, because a colour
            list nobody maintains is a dropdown that is always missing the
            colour in front of the coordinator. */}
        <div className="lg:max-w-xs">
          <Field
            htmlFor={id("customColour")}
            label={t("quotations.detail.colour")}
            error={errors.customColour}
          >
            <Input
              id={id("customColour")}
              name="customColour"
              dir="ltr"
              defaultValue={defaults?.customColour ?? ""}
              placeholder={t("quotations.detail.colourPlaceholder")}
              className="num text-start"
            />
          </Field>
        </div>
      </div>

      {/* How much of it, and at what price. The rule is the grouping `D63`. */}
      <div className="grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
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
            className="num text-start"
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
            className="num text-start"
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
            className="num text-start"
          />
        </Field>

        {/* Per square metre `[16 §1]`, not per sheet. Area and every total are
            calculated from it — nobody types a total, and nobody is shown one
            until the row exists `D63`. */}
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
            className="num text-start"
          />
        </Field>
      </div>
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
          className="num text-start"
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
          className="num text-start"
        />
      </Field>
    </div>
  );
}
