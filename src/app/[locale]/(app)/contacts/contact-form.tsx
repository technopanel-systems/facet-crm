"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormField, SelectField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import type { ContactInput } from "@/lib/contacts";
import { emptyFormState, type FormState } from "@/lib/validation";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export type CompanyOption = {
  id: string;
  nameEn: string;
  nameAr: string | null;
};

export function ContactForm({
  action,
  defaults,
  submitLabel,
  cancelHref,
  companies,
  locale,
}: {
  action: Action;
  defaults?: Partial<ContactInput>;
  submitLabel: string;
  cancelHref: string;
  companies: CompanyOption[];
  locale: string;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);

  const errors = state.fieldErrors ?? {};
  const value = (name: keyof ContactInput) =>
    state.values?.[name] ?? (defaults?.[name] as string | null | undefined) ?? "";

  const optionName = (company: CompanyOption) =>
    locale === "ar" ? company.nameAr || company.nameEn : company.nameEn;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error ? (
        <p role="alert" className="text-destructive text-start text-sm">
          {t(state.error)}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* A contact belongs to exactly one company `[07 A2]`, so this is
            required and the list holds only companies the user may see. */}
        <FormField
          name="companyId"
          label={t("contacts.fields.company")}
          error={errors.companyId}
          hint={companies.length === 0 ? t("common.noOptions") : undefined}
          required
        >
          <SelectField
            name="companyId"
            defaultValue={value("companyId")}
            placeholder={t("common.none")}
            disabled={companies.length === 0}
            invalid={Boolean(errors.companyId)}
          >
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {optionName(company)}
              </option>
            ))}
          </SelectField>
        </FormField>

        <FormField
          name="position"
          label={t("contacts.fields.position")}
          error={errors.position}
        >
          <Input
            id="position"
            name="position"
            defaultValue={value("position")}
            aria-invalid={Boolean(errors.position) || undefined}
            className="text-start"
          />
        </FormField>

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

        <FormField name="email" label={t("common.email")} error={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            dir="ltr"
            defaultValue={value("email")}
            aria-invalid={Boolean(errors.email) || undefined}
            className="text-start"
          />
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
        <Button type="submit" disabled={pending || companies.length === 0}>
          {pending ? t("common.saving") : submitLabel}
        </Button>
        <Button asChild type="button" variant="ghost">
          <Link href={cancelHref}>{t("common.cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
