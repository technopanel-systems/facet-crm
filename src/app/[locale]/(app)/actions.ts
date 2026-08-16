"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";

import { signOut } from "@/auth";
import { requireSession } from "@/lib/authz";
import { isTheme, THEME_COOKIE } from "@/lib/theme";

export async function logoutAction(): Promise<void> {
  const locale = await getLocale();
  // Database strategy: signOut deletes the session row, then redirects.
  await signOut({ redirectTo: `/${locale}/login` });
}

/**
 * Persist the theme `[22 §5]`. An action is its own POST that no layout wraps,
 * so it gates itself — a preference is still not something an anonymous caller
 * should be able to set.
 *
 * The submitted value is validated rather than trusted: anything that is not
 * `dark` or `light` falls back to the default.
 */
export async function setThemeAction(formData: FormData): Promise<void> {
  await requireSession();

  const submitted = formData.get("theme");
  const theme =
    typeof submitted === "string" && isTheme(submitted) ? submitted : "dark";

  const store = await cookies();
  store.set(THEME_COOKIE, theme, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
}
