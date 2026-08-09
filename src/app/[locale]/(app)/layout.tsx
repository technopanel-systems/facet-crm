import { getTranslations, setRequestLocale } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { requireSession } from "@/lib/authz";

import { logoutAction, stopImpersonationAction } from "./actions";

/**
 * The protected shell. Every screen inside (app) exists behind this layout,
 * so `requireSession` here IS the enforcement point — pages never check
 * again, and the impersonation banner `[07 A6]` is persistent by
 * construction: it renders above whatever page is open.
 */
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await requireSession();
  const t = await getTranslations();

  return (
    <div className="flex min-h-svh flex-col">
      {session.isImpersonating ? (
        <div className="bg-amber-400 text-amber-950">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-6 py-2">
            <p className="text-start text-sm font-medium">
              {t("auth.impersonation.banner", {
                real: session.realUser.name,
                target: session.user.name,
              })}
            </p>
            <form action={stopImpersonationAction}>
              <Button type="submit" size="sm" variant="outline">
                {t("auth.impersonation.stop")}
              </Button>
            </form>
          </div>
        </div>
      ) : null}

      <header className="border-b">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-6 py-3">
          <div className="text-start">
            <p className="font-semibold tracking-tight">{t("app.name")}</p>
            <p className="text-muted-foreground text-xs">
              {t("auth.signedInAs", { name: session.user.name })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <form action={logoutAction}>
              <Button type="submit" size="sm" variant="ghost">
                {t("auth.signOut")}
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex-1">{children}</div>
    </div>
  );
}
