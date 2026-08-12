"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

/**
 * Login.
 *
 * It used to hand-roll its own `<label>` and `<input>` with a private class
 * string, which drifted from `Input` the moment `Input` changed. It uses the
 * shared components now, so a restyle reaches it too `[22 §7]`.
 */
export function LoginForm() {
  const t = useTranslations();
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormField name="email" label={t("auth.login.email")} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          dir="ltr"
          className="text-start"
        />
      </FormField>
      <FormField name="password" label={t("auth.login.password")} required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </FormField>
      {state.error ? (
        <p role="alert" className="text-destructive text-start text-sm">
          {t(state.error)}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("auth.login.submitting") : t("auth.login.submit")}
      </Button>
    </form>
  );
}
