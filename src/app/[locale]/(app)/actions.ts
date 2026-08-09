"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";

import { signOut } from "@/auth";
import { requireSession, stopImpersonation } from "@/lib/authz";

export async function logoutAction(): Promise<void> {
  const locale = await getLocale();
  // Database strategy: signOut deletes the session row, then redirects.
  await signOut({ redirectTo: `/${locale}/login` });
}

export async function stopImpersonationAction(): Promise<void> {
  const session = await requireSession();
  await stopImpersonation(session);
  revalidatePath("/", "layout");
}
