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
 * **The company is chosen first, then the project** `S50`. A quotation always
 * names one, so the only question is which: a new project, pre-named from the
 * company the rep has just picked, or one of that company's projects he can
 * already see `S30` `[16 §6]`. **The default is the new project.**
 *
 * The empty value of the project `<select>` IS the new-project case rather than
 * a blank — there is no blank left to offer — which is why the name input sits
 * under it and no third control decides between them. The server applies the
 * same rule, so neither list offers what the action would refuse.
 */
export function QuotationForm({
  action,
  projects,
  companies,
  contacts,
  products,
  services,
  locale,
  defaultCompanyId,
}: {
  action: Action;
  projects: ProjectOption[];
  companies: CompanyOption[];
  contacts: ContactOption[];
  products: ProductOptions;
  services: NamedOption[];
  locale: string;
  defaultCompanyId?: string;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);
  const errors = state.fieldErrors ?? {};

  const [companyId, setCompanyId] = useState(
    state.values?.companyId ?? defaultCompanyId ?? "",
  );
  const [projectId, setProjectId] = useState(state.values?.projectId ?? "");
  // Null means *follow the company*, which is what the pre-name is. A rep who
  // types over it owns the value from then on; changing the company clears it
  // back to null so the suggestion follows again. No effect, no stale name.
  const [typedName, setTypedName] = useState<string | null>(
    state.values?.newProjectName ?? null,
  );
  const [lineCount, setLineCount] = useState(1);
  const [serviceCount, setServiceCount] = useState(0);

  const company = companies.find((row) => row.id === companyId);
  // `16 §6` — the projects this company is a live participant of, filtered
  // from what the server already sent. The inversion added no query.
  const projectOptions = projects.filter((row) =>
    row.companies.some((link) => link.id === companyId),
  );
  const contactOptions = contacts.filter(
    (contact) => contact.companyId === companyId,
  );
  const newProjectName = typedName ?? company?.name ?? "";

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
        {/* The first field since `S50`: every company this rep may use, and
            the project choice below is narrowed by it `[16 §6]`. A native
            `<select>` `D20` — and there is no longer a combobox for it to be
            weighed against: the city's is deleted and the ~200-item list is a
            grouped native select too. The usability question at bulk-import
            scale stays in `WORKFLOW §5`, not this form. */}
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
            onChange={(event) => {
              setCompanyId(event.target.value);
              // A project was chosen as this company's; it is not the next
              // company's, and the pre-name follows the new one.
              setProjectId("");
              setTypedName(null);
            }}
            disabled={companies.length === 0}
            aria-invalid={Boolean(errors.companyId) || undefined}
            aria-describedby={errors.companyId ? "companyId-error" : undefined}
            className={selectClasses}
          >
            <option value="">{t("common.none")}</option>
            {companies.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </FormField>

        {/* `S50` — a quotation always names a project, so the question is
            which, never whether. **The empty value is the NEW project**, not
            none, and it is the default; the name under it arrives pre-filled
            with the company's, which invents nothing — it is what the rep has
            just typed. `dir="auto"`, because a project name may hold either
            script `D62`.

            `data-project-mode` is the DOM handle `verify:routes` reads to tell
            the two branches apart, which it may not do from a label. */}
        <FormField
          name="projectId"
          label={t("quotations.fields.project")}
          error={errors.projectId ?? errors.newProjectName}
          hint={projectId ? undefined : t("quotations.detail.projectNewHint")}
          required
        >
          <div
            className="flex flex-col gap-2"
            data-project-mode={projectId ? "existing" : "new"}
          >
            <select
              id="projectId"
              name="projectId"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              aria-invalid={Boolean(errors.projectId) || undefined}
              className={selectClasses}
            >
              <option value="">{t("quotations.fields.projectNew")}</option>
              {projectOptions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            {projectId ? null : (
              <Input
                name="newProjectName"
                value={newProjectName}
                onChange={(event) => setTypedName(event.target.value)}
                required
                dir="auto"
                aria-label={t("quotations.fields.projectNewName")}
                aria-invalid={Boolean(errors.newProjectName) || undefined}
                className="text-start"
              />
            )}
          </div>
        </FormField>

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
