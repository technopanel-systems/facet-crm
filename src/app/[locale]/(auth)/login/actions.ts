"use server";

import { AuthError } from "next-auth";
import { getLocale } from "next-intl/server";

import { signIn } from "@/auth";

export type LoginState = {
  /** A translation key, never display text — the form renders t(error). */
  error?: string;
};

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const locale = await getLocale();
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: `/${locale}`,
    });
    return {};
  } catch (error) {
    // Every credential failure — unknown email, wrong password, deactivated
    // account — surfaces as the same message. No probing.
    if (error instanceof AuthError) {
      return { error: "auth.login.invalidCredentials" };
    }
    // Success is a redirect, which Next.js implements as a throw.
    throw error;
  }
}
