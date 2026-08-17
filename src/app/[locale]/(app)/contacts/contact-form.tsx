"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import {
  FormField,
  FormShell,
  SelectField,
} from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import type { ContactInput } from "@/lib/contacts";
import { emptyFormState, type FormState } from "@/lib/validation";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export type CompanyOption = {
  id: string;
  /** One field, English or Arabic `S12`. */
  name: string;
};

export function ContactForm({
  action,
  defaults,
  submitLabel,
  cancelHref,
  companies,
}: {
  action: Action;
  defaults?: Partial<ContactInput>;
  submitLabel: string;
  cancelHref: string;
  companies: CompanyOption[];
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);

  const errors = state.fieldErrors ?? {};
  const value = (name: keyof ContactInput) =>
    state.values?.[name] ?? (defaults?.[name] as string | null | undefined) ?? "";

  return (
    <FormShell
      action={formAction}
      error={state.error}
      actions={
        <>
          <Button type="submit" disabled={pending || companies.length === 0}>
            {pending ? t("common.saving") : submitLabel}
          </Button>
          <Button asChild type="button" variant="ghost">
            <Link href={cancelHref}>{t("common.cancel")}</Link>
          </Button>
        </>
      }
    >
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
              {company.name}
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

      {/* One field, English or Arabic `S19`. `dir="auto"` because the script
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
