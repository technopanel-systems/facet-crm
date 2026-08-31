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
import { Link } from "@/i18n/navigation";
import { REGIONS } from "@/lib/enums";
import { emptyFormState, type FormState } from "@/lib/validation";

/**
 * Create and edit a user.
 *
 * `REGIONS` comes from `@/lib/enums`, which imports nothing — importing a data
 * module here would pull the Postgres driver into the browser bundle, and only
 * `npm run build` catches that. `RoleChoice` is re-declared for the same
 * reason: the server page passes the rows in.
 *
 * Role and region are native `<select>`s `[14]` — short lists, no client
 * state, no JavaScript needed to submit, and the browser places the RTL popup.
 */

type RoleChoice = { id: string; nameEn: string; nameAr: string };

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export function UserForm({
  action,
  roles,
  locale,
  defaults,
  submitLabel,
  cancelHref,
  /** Creation only — the password is set once, here `[11 §5]`. */
  withPassword = false,
}: {
  action: Action;
  roles: RoleChoice[];
  locale: string;
  defaults?: {
    name: string;
    email: string;
    roleId: string;
    region: string | null;
  };
  submitLabel: string;
  cancelHref: string;
  withPassword?: boolean;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);
  const errors = state.fieldErrors ?? {};

  const value = (name: "name" | "email" | "roleId" | "region") =>
    state.values?.[name] ?? defaults?.[name] ?? "";

  const roleName = (row: RoleChoice) =>
    locale === "ar" ? row.nameAr || row.nameEn : row.nameEn;

  return (
    <FormShell
      action={formAction}
      error={state.error}
      actions={
        <>
          <Button type="submit" disabled={pending}>
            {pending ? t("common.saving") : submitLabel}
          </Button>
          <Button asChild variant="ghost">
            <Link href={cancelHref}>{t("common.cancel")}</Link>
          </Button>
        </>
      }
    >
      <FormField
        name="name"
        label={t("team.fields.name")}
        error={errors.name}
        required
      >
        <Input
          id="name"
          name="name"
          defaultValue={value("name")}
          required
          maxLength={200}
          aria-invalid={Boolean(errors.name) || undefined}
          className="text-start"
        />
      </FormField>

      <FormField
        name="email"
        label={t("team.fields.email")}
        error={errors.email}
        hint={t("team.fields.emailHint")}
        required
      >
        <Input
          id="email"
          name="email"
          type="email"
          dir="ltr"
          defaultValue={value("email")}
          required
          maxLength={320}
          aria-invalid={Boolean(errors.email) || undefined}
          className="text-start"
        />
      </FormField>

      {withPassword ? (
        <FormField
          name="password"
          label={t("team.fields.password")}
          error={errors.password}
          hint={t("team.fields.passwordHint")}
          required
        >
          <Input
            id="password"
            name="password"
            type="password"
            dir="ltr"
            required
            minLength={8}
            maxLength={200}
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password) || undefined}
            className="text-start"
          />
        </FormField>
      ) : null}

      <FormField
        name="roleId"
        label={t("team.fields.role")}
        error={errors.roleId}
        required
      >
        <SelectField
          name="roleId"
          defaultValue={value("roleId")}
          placeholder={t("team.fields.rolePlaceholder")}
          required
          invalid={Boolean(errors.roleId)}
        >
          {roles.map((row) => (
            <option key={row.id} value={row.id}>
              {roleName(row)}
            </option>
          ))}
        </SelectField>
      </FormField>

      {/* `19 §2` — a user's region is the rep's BASE, not a site location, so
          it is asked for rather than derived from a city. */}
      <FormField
        name="region"
        label={t("team.fields.region")}
        error={errors.region}
      >
        <SelectField
          name="region"
          defaultValue={value("region")}
          placeholder={t("team.fields.regionPlaceholder")}
          invalid={Boolean(errors.region)}
        >
          {REGIONS.map((region) => (
            <option key={region} value={region}>
              {t(`enums.region.${region}`)}
            </option>
          ))}
        </SelectField>
      </FormField>
    </FormShell>
  );
}
