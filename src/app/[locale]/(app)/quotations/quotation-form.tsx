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
import { Link } from "@/i18n/navigation";
// A value import from a data module would bundle the Postgres driver here.
// `enums.ts` imports nothing, on purpose, so a closed set is safe to read.
import { STOCKS } from "@/lib/enums";
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
  /** One field, English or Arabic `S26`. */
  name: string;
  /** The project's live company links — the only companies a quotation on it
   *  may name `[16 §6]`. */
  companies: { id: string; name: string }[];
};

export type CompanyOption = { id: string; name: string };
export type ContactOption = { id: string; companyId: string; name: string };

/**
 * The rep's quotation request `[04 flow 6]`. **This form creates version 1**
 * `[10 §4]` — status `requested`, no SMAC reference, which the coordinator
 * fills in later.
 *
 * **The project is optional** `S50`. Which companies may be named follows from
 * that: with a project, its live links and nothing wider `[16 §6]`; without
 * one, every company this rep may use. The server applies the same pair, so
 * neither list offers what the action would refuse.
 */
export function QuotationForm({
  action,
  projects,
  companies,
  contacts,
  products,
  services,
  locale,
  defaultProjectId,
}: {
  action: Action;
  projects: ProjectOption[];
  companies: CompanyOption[];
  contacts: ContactOption[];
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
  // `16 §6` narrows to the project's participants; with no project `S50`
  // there is nothing to narrow by, so it is ordinary company visibility.
  const companyOptions = project ? project.companies : companies;
  const contactOptions = contacts.filter(
    (contact) => contact.companyId === companyId,
  );

  return (
    <FormShell
      action={formAction}
      error={state.error}
      wide
      actions={
        <>
          <Button type="submit" disabled={pending}>
            {pending ? t("common.saving") : t("common.create")}
          </Button>
          <Button asChild type="button" variant="ghost">
            <Link href="/quotations">{t("common.cancel")}</Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {/* A rep can hold many projects, so this is the second field to earn a
            combobox after the city `[15 §5]` — same reasoning, list length. */}
        {/* Not required `S50` — a rep sometimes quotes before the project
            exists. The hint says what happens to the gap rather than leaving
            it looking like a field somebody forgot. */}
        <FormField
          name="projectId"
          label={t("quotations.fields.project")}
          error={errors.projectId}
          hint={
            projects.length === 0
              ? t("quotations.detail.noProjectsYet")
              : t("quotations.detail.projectOptional")
          }
        >
          <Combobox
            name="projectId"
            defaultValue={projectId}
            // No `altLabel`: it carried the other-language name so a search
            // could match either, and a project has one name now `S26`.
            options={projects.map((row) => ({
              value: row.id,
              label: row.name,
            }))}
            placeholder={t("common.none")}
            searchPlaceholder={t("common.search")}
            emptyLabel={t("common.noMatches")}
            clearLabel={t("quotations.fields.projectNone")}
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
            disabled={companyOptions.length === 0}
            aria-invalid={Boolean(errors.companyId) || undefined}
            aria-describedby={errors.companyId ? "companyId-error" : undefined}
            className={selectClasses}
          >
            <option value="">{t("common.none")}</option>
            {companyOptions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
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
              <span dir="auto">{project.name}</span>
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
            {contactOptions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </FormField>

        {/* `S118` — the rep chooses the stock when requesting. A fixed list
            of four, so a native `<select>` `D20` and not the city's combobox:
            that exception is scoped to a two-hundred-item list.

            No default. No rule picks one, and a prefilled stock is a stock
            somebody would submit without reading — the value SMAC's inventory
            is drawn against. `required` makes the browser refuse the
            placeholder; the action refuses it again. */}
        <FormField
          name="stock"
          label={t("quotations.fields.stock")}
          error={errors.stock}
          required
        >
          <SelectField
            name="stock"
            defaultValue={state.values?.stock ?? ""}
            placeholder={t("common.none")}
            required
            invalid={Boolean(errors.stock)}
          >
            {STOCKS.map((stock) => (
              <option key={stock} value={stock}>
                {t(`enums.stock.${stock}`)}
              </option>
            ))}
          </SelectField>
        </FormField>

        {/* `S67` — the form asks for no validity date and no delivery
            period. Both are SMAC's, and a field FACET still rendered is a
            field a rep would still fill.

            `S70` and `S119` took the two that were here — how the customer
            pays and how it ships — onto the DISPATCH, for the same reason.
            Payment is the coordinator's, recorded when she approves `S73`;
            shipment is chosen when a dispatch is requested, not when a
            quotation is. Both are closed lists there, where here they were
            free text that never agreed with any rule. */}
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
    </FormShell>
  );
}

export { optionLabel };
