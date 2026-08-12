import { Bell } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AppRail } from "@/components/app-rail";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Link } from "@/i18n/navigation";
import { can } from "@/lib/authz";
import { bilingualName } from "@/lib/lookups";

import { logoutAction, stopImpersonationAction } from "./actions";
import { shellCounts } from "./_components/shell-counts";
import { ThemeToggle } from "./_components/theme-toggle";

/**
 * The protected shell. Every screen inside (app) exists behind this layout,
 * so `requireSession` here IS the enforcement point for RENDERING — pages
 * never check again, and the impersonation banner `[07 A6]` is persistent by
 * construction: it renders above whatever page is open.
 *
 * It is NOT the enforcement point for writes. A server action is a separately
 * reachable POST endpoint that no layout wraps, so every action calls
 * `requireSession()` itself and every mutation re-checks record visibility in
 * the data layer.
 *
 * `22 §7` replaced the horizontal nav with a rail. The page area keeps each
 * screen's own `max-w-*` container for this stage `[22 §6.1]`; the shell
 * supplies the frame and nothing else.
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

  const t = await getTranslations();
  // `19 §4` — the layout computes, the client component receives primitives.
  const { session, follow, unresolved } = await shellCounts();

  return (
    <div className="bg-canvas flex min-h-svh flex-col md:flex-row">
      <AppRail
        canManageUsers={can(session, "canManageUsers")}
        todayCount={follow.total}
        userName={session.user.name}
        roleLabel={bilingualName(session.user.role, locale)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {session.isImpersonating ? (
          <div className="bg-tone-amber text-tone-amber-fg">
            <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-2">
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

        <header className="border-line bg-canvas/85 sticky top-0 z-20 border-b backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-end gap-2 px-6 py-2.5">
            <Link
              href="/notifications"
              aria-label={t("nav.notifications")}
              title={t("nav.notifications")}
              className="text-muted-foreground hover:bg-surface hover:border-line hover:text-foreground relative grid size-8 place-items-center rounded-lg border border-transparent transition-colors"
            >
              <Bell className="size-4" aria-hidden />
              {unresolved > 0 ? (
                <span
                  data-slot="bell-dot"
                  className="bg-brand border-canvas absolute end-1.5 top-1.5 size-2 rounded-full border-2"
                  aria-hidden
                />
              ) : null}
              <span className="sr-only" dir="ltr">
                {unresolved}
              </span>
            </Link>
            <LocaleSwitcher />
            <ThemeToggle />
            <form action={logoutAction}>
              <Button type="submit" size="sm" variant="ghost">
                {t("auth.signOut")}
              </Button>
            </form>
          </div>
        </header>

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
