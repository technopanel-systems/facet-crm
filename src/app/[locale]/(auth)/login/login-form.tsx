"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const t = useTranslations();
  const [state, action, pending] = useActionState(loginAction, initialState);

  const inputClasses =
    "border-input bg-background w-full rounded-md border px-3 py-2 text-sm " +
    "outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-start">
        <span className="text-sm font-medium">{t("auth.login.email")}</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          dir="ltr"
          className={`${inputClasses} text-start`}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-start">
        <span className="text-sm font-medium">{t("auth.login.password")}</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClasses}
        />
      </label>
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
