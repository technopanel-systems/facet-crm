import { Bell } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AppRail } from "@/components/app-rail";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Link } from "@/i18n/navigation";
import { can } from "@/lib/authz";
import { lookupName } from "@/lib/lookups";

import { shellCounts } from "./_components/shell-counts";
import { ThemeToggle } from "./_components/theme-toggle";

/**
 * The protected shell. Every screen inside (app) exists behind this layout,
 * so `requireSession` here IS the enforcement point for RENDERING — pages
 * never check again.
 *
 * **No impersonation banner here.** `startImpersonation` `[07 A5, A6]` has no
 * caller, so `session.isImpersonating` can never be true — a stop control
 * that can never appear was the lie; feature slice 6 removed it rather than
 * ship a banner nobody can trigger `[26 §4]`. The session plumbing
 * (`isImpersonating`, `realUser`, `stopImpersonation`) stays: it is correct,
 * waiting on the start control, not dead.
 *
 * It is NOT the enforcement point for writes. A server action is a separately
 * reachable POST endpoint that no layout wraps, so every action calls
 * `requireSession()` itself and every mutation re-checks record visibility in
 * the data layer.
 *
 * `D49` replaced the horizontal nav with a rail. **This layout owns the content
 * column** `D23`: the start-aligned 1320px page area, its padding, and the
 * `<main>` landmark. Pages carry only their own flow — a `gap`, and a narrower
 * measure where the archetype needs one.
 *
 * **No `mx-auto`, deliberately** `D23`. Start-aligned is the proportion: the
 * page area hugs the rail rather than floating on a wide screen. A capped
 * block with no margin utility does this in both directions — over-constrained
 * resolution gives the slack to the inline end for the header's inner row, and
 * flex cross-axis `stretch` falls back to `flex-start` for `<main>`. Adding
 * `me-auto` would be a no-op that implies the alignment is fragile.
 *
 * The header's inner row takes the SAME cap and the same inline padding as
 * `<main>`, which is what finally lines the bell / locale / theme cluster up
 * with page content — before this they were `px-6` at full column width against
 * `mx-auto max-w-Nxl px-6`, and never matched.
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
  const { session, follow, unread } = await shellCounts();

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <AppRail
        canManageUsers={can(session, "canManageUsers")}
        holdsBook={!session.user.role.seesAllReps}
        todayCount={follow.total}
        userName={session.user.name}
        roleLabel={lookupName(session.user.role, locale)}
      />

      {/* `min-w-0` stops a wide table blowing the column out and squeezing the
          rail. The 1320px cap below does NOT replace it: a max-width on a child
          clamps that child's box, not the column's min-content contribution. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Sticky, blur and border stay on <header> — it is a stretched flex
            item, so the rule spans the full viewport minus the rail. */}
        <header className="border-line bg-canvas/85 glass sticky top-0 z-20 border-b">
          <div className="flex w-full max-w-330 flex-wrap items-center justify-end gap-3 px-6.5 py-2.75">
            <Link
              href="/notifications"
              aria-label={t("nav.notifications")}
              title={t("nav.notifications")}
              // `D74` — a floor below `md`, and `D22`'s 32px above it. `38a`
              // put the same pair on `Button`'s base and this is not a
              // `Button`, which is why it was missed.
              className="text-muted-foreground hover:bg-surface hover:border-line hover:text-foreground relative grid size-8 place-items-center rounded-lg border border-transparent transition-colors max-md:size-11"
            >
              <Bell className="size-4" aria-hidden />
              {unread > 0 ? (
                <span
                  data-slot="bell-dot"
                  className="bg-brand border-canvas absolute end-1.5 top-1.5 size-2 rounded-full border-2"
                  aria-hidden
                />
              ) : null}
              <span className="sr-only" dir="ltr">
                {unread}
              </span>
            </Link>
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </header>

        {/* `D23`'s column: max-width 1320, start-aligned, no auto margin.
            `max-w-330` is 330 × 4px. Padding is `D22`.

            `max-md:pb-20` is the sheet's clearance `D56`: below `md` the rail
            is a bar fixed to the bottom edge, so the last row of every screen
            would sit under it. **No `env(safe-area-inset-bottom)` and no
            `viewport-fit=cover`** — nothing exports `viewport`, so Next emits
            its default `width=device-width, initial-scale=1` with no
            `viewport-fit`, and iOS therefore insets the viewport itself and the
            bar already clears the home indicator. Opting into `cover` would
            create the problem `env()` then solves. */}
        <main className="w-full max-w-330 flex-1 px-6.5 pt-5.5 pb-10 max-md:pb-20">
          {children}
        </main>
      </div>
    </div>
  );
}
