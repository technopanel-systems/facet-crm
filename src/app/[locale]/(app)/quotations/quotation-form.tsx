"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { emptyFormState, type FormState } from "@/lib/validation";

import {
  LineFields,
  ServiceFields,
  optionLabel,
  selectClasses,
  type NamedOption,
  type ProductOptions,
} from "./line-fields";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export type ProjectOption = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  /** The project's live company links — the only companies a quotation on it
   *  may name `[16 §6]`. */
  companies: { id: string; nameEn: string; nameAr: string | null }[];
  contacts: { id: string; companyId: string; nameEn: string; nameAr: string | null }[];
};

/**
 * The rep's quotation request `[04 flow 6]`. **This form creates version 1**
 * `[10 §4]` — status `requested`, no SMAC reference, which the coordinator
 * fills in later.
 */
export function QuotationForm({
  action,
  projects,
  products,
  services,
  locale,
  defaultProjectId,
}: {
  action: Action;
  projects: ProjectOption[];
  products: ProductOptions;
  services: NamedOption[];
  locale: string;
  defaultProjectId?: string;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);
  const errors = state.fieldErrors ?? {};

  const [projectId, setProjectId] = useState(
    state.values?.projectId ?? defaultProjectId ?? "",
  );
  const [companyId, setCompanyId] = useState(state.values?.companyId ?? "");
  const [lineCount, setLineCount] = useState(1);
  const [serviceCount, setServiceCount] = useState(0);

  const project = projects.find((row) => row.id === projectId);
  const companies = project?.companies ?? [];
  const contacts = (project?.contacts ?? []).filter(
    (contact) => contact.companyId === companyId,
  );

  const name = (row: { nameEn: string; nameAr: string | null }) =>
    locale === "ar" ? row.nameAr || row.nameEn : row.nameEn;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error ? (
        <p role="alert" className="text-destructive text-start text-sm">
          {t(state.error)}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* A rep can hold many projects, so this is the second field to earn a
            combobox after the city `[15 §5]` — same reasoning, list length. */}
        <FormField
          name="projectId"
          label={t("quotations.fields.project")}
          error={errors.projectId}
          required
          hint={projects.length === 0 ? t("common.noOptions") : undefined}
        >
          <Combobox
            name="projectId"
            defaultValue={projectId}
            options={projects.map((row) => ({
              value: row.id,
              label: name(row),
              altLabel: locale === "ar" ? row.nameEn : (row.nameAr ?? undefined),
            }))}
            placeholder={t("common.none")}
            searchPlaceholder={t("common.search")}
            emptyLabel={t("common.noMatches")}
            clearLabel={t("common.none")}
            disabled={projects.length === 0}
            invalid={Boolean(errors.projectId)}
            onChange={(value) => {
              setProjectId(value);
              setCompanyId(""); // the company list belongs to the project
            }}
          />
        </FormField>

        {/* Restricted to the project's live links `[16 §6]`, and the hint says
            where to go when the customer is not one of them — a rule with no
            next step gets worked around. */}
        <FormField
          name="companyId"
          label={t("quotations.fields.company")}
          error={errors.companyId}
          required
        >
          <select
            id="companyId"
            name="companyId"
            value={companyId}
            onChange={(event) => setCompanyId(event.target.value)}
            disabled={!project}
            aria-invalid={Boolean(errors.companyId) || undefined}
            aria-describedby={errors.companyId ? "companyId-error" : undefined}
            className={selectClasses}
          >
            <option value="">{t("common.none")}</option>
            {companies.map((row) => (
              <option key={row.id} value={row.id}>
                {name(row)}
              </option>
            ))}
          </select>
        </FormField>

        {project && companies.length === 0 ? (
          <p className="text-muted-foreground text-start text-xs sm:col-span-2">
            {t("quotations.errors.companyNotOnProject")}{" "}
            <Link
              href={`/projects/${project.id}`}
              className="text-primary underline underline-offset-4"
            >
              {name(project)}
            </Link>
          </p>
        ) : null}

        <FormField
          name="contactId"
          label={t("quotations.fields.contact")}
          error={errors.contactId}
        >
          <select
            id="contactId"
            name="contactId"
            defaultValue=""
            disabled={!companyId}
            className={selectClasses}
          >
            <option value="">{t("common.none")}</option>
            {contacts.map((row) => (
              <option key={row.id} value={row.id}>
                {name(row)}
              </option>
            ))}
          </select>
        </FormField>

        {/* Per quotation, varies case by case — three days, seven, longer
            `[07 C7]`. On expiry the record is kept and marked `[16 §3]`. */}
        <FormField
          name="validUntil"
          label={t("quotations.fields.validUntil")}
          error={errors.validUntil}
        >
          <Input
            id="validUntil"
            name="validUntil"
            type="date"
            dir="ltr"
            defaultValue={state.values?.validUntil ?? ""}
            aria-invalid={Boolean(errors.validUntil) || undefined}
            className="text-start"
          />
        </FormField>

        <FormField
          name="deliveryPeriod"
          label={t("quotations.fields.deliveryPeriod")}
          error={errors.deliveryPeriod}
        >
          <Input
            id="deliveryPeriod"
            name="deliveryPeriod"
            defaultValue={state.values?.deliveryPeriod ?? ""}
            className="text-start"
          />
        </FormField>

        <FormField
          name="paymentMethod"
          label={t("quotations.fields.paymentMethod")}
          error={errors.paymentMethod}
        >
          <Input
            id="paymentMethod"
            name="paymentMethod"
            defaultValue={state.values?.paymentMethod ?? ""}
            className="text-start"
          />
        </FormField>

        <FormField
          name="shipmentTerms"
          label={t("quotations.fields.shipmentTerms")}
          error={errors.shipmentTerms}
        >
          <Input
            id="shipmentTerms"
            name="shipmentTerms"
            defaultValue={state.values?.shipmentTerms ?? ""}
            className="text-start"
          />
        </FormField>
      </div>

      <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">
          {t("quotations.detail.lines")}
        </legend>

        {products.suppliers.length === 0 ? (
          <p role="alert" className="text-destructive text-start text-sm">
            {t("quotations.errors.noSuppliers")}
          </p>
        ) : null}

        {Array.from({ length: lineCount }, (_, index) => (
          <div key={index} className="border-t pt-4 first:border-t-0 first:pt-0">
            <LineFields
              options={products}
              locale={locale}
              idPrefix={`line-${index}`}
              errors={errors}
            />
          </div>
        ))}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => setLineCount((count) => count + 1)}
          >
            {t("quotations.detail.addLine")}
          </Button>
          {lineCount > 1 ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => setLineCount((count) => Math.max(1, count - 1))}
            >
              {t("common.remove")}
            </Button>
          ) : null}
        </div>
      </fieldset>

      {/* Not every product receives a service `[08 B4]`, so this starts empty. */}
      <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">
          {t("quotations.detail.serviceLines")}
        </legend>

        {serviceCount === 0 ? (
          <p className="text-muted-foreground text-start text-sm">
            {t("quotations.detail.noServiceLines")}
          </p>
        ) : null}

        {Array.from({ length: serviceCount }, (_, index) => (
          <div key={index} className="border-t pt-4 first:border-t-0 first:pt-0">
            <ServiceFields
              services={services}
              locale={locale}
              idPrefix={`service-${index}`}
              errors={errors}
            />
          </div>
        ))}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={services.length === 0}
            onClick={() => setServiceCount((count) => count + 1)}
          >
            {t("quotations.detail.addService")}
          </Button>
          {serviceCount > 0 ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => setServiceCount((count) => Math.max(0, count - 1))}
            >
              {t("common.remove")}
            </Button>
          ) : null}
        </div>
      </fieldset>

      <p className="text-muted-foreground text-start text-xs">
        {t("quotations.detail.computed")}
      </p>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : t("common.create")}
        </Button>
        <Button asChild type="button" variant="ghost">
          <Link href="/quotations">{t("common.cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}

export { optionLabel };
