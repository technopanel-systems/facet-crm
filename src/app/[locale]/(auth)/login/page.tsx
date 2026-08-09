import { getTranslations, setRequestLocale } from "next-intl/server";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/authz";

import { LoginForm } from "./login-form";

// Session lookup reads cookies — always per request.
export const dynamic = "force-dynamic";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (session) redirect({ href: "/", locale });

  const t = await getTranslations();

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 px-6">
      <div className="w-full max-w-sm">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("app.name")}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {t("auth.login.title")}
            </p>
          </div>
          <LocaleSwitcher />
        </header>
        <LoginForm />
      </div>
    </main>
  );
}
