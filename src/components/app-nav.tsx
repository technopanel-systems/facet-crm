"use client";

import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/**
 * The CRM sections. Client-side only because the active item comes from the
 * pathname; `usePathname` here is next-intl's, so it returns the path WITHOUT
 * the locale prefix and `/en/companies` and `/ar/companies` both match
 * `/companies`.
 */
/**
 * `requires` names a permission the viewer must hold for the entry to appear.
 * Absent means everyone sees it.
 */
const SECTIONS = [
  { href: "/companies", key: "companies" },
  { href: "/contacts", key: "contacts" },
  { href: "/projects", key: "projects" },
  { href: "/quotations", key: "quotations" },
  { href: "/dispatches", key: "dispatches" },
  { href: "/reports", key: "reports" },
  { href: "/coverage", key: "coverage" },
  { href: "/follow-ups", key: "followUps" },
  { href: "/activity", key: "activity" },
  { href: "/notifications", key: "notifications" },
  { href: "/targets", key: "targets" },
  { href: "/users", key: "team", requires: "canManageUsers" },
] as const;

/*
 * Most entries are NOT permission-gated, and need not be: they are meaningful
 * for every role. A rep opening `/dispatches` sees the dispatches that credit
 * them; a rep opening `/targets` sees their own target and achievement. What
 * each role may DO is decided in the data layer.
 *
 * `/users` is the first screen that is meaningless without a flag, and `19 §4`
 * is the answer this comment used to ask for: **the `(app)` layout computes the
 * flags and passes them down as booleans.** The layout already holds the
 * session; this component is `"use client"` and must never call `can()` or
 * import from `@/lib/authz` — not even a type, because a type-only import is
 * one careless edit away from shipping the Postgres driver to the browser.
 *
 * Phase 9 added three entries and **gated none of them** `[20 §7]`, `[20 §8]`.
 * `/coverage` and `/activity` look like manager screens and are not: both are
 * SCOPED, so a rep opening either sees their own companies and their own row.
 * Coverage is deliberately the rep's own work tool — "which of my companies
 * have gone quiet" is the clearest answer to what they get back for logging,
 * and a diagnostic only a supervisor can see is a scoreboard rather than a
 * queue.
 *
 * Phase 10a added two more and gated neither `[21 §9]`. `/follow-ups` is the
 * same scoped-not-gated shape as coverage; `/notifications` is addressed to one
 * person, so there is nothing a flag could usefully decide.
 *
 * Hiding the link is cosmetic. `/users` returns `notFound()` on its own and
 * every write re-checks the flag in the data layer; the nav is not the gate.
 */

/**
 * `19 §4` — the `(app)` layout computes these and passes primitives down.
 * `unresolvedCount` is a number rather than a flag, which is the same rule
 * extended by one step: still no `can()` call and still no `@/lib/authz` import
 * in a client component.
 */
type NavFlags = { canManageUsers: boolean; unresolvedCount: number };

export function AppNav(flags: NavFlags) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const visible = SECTIONS.filter(
    (section) => !("requires" in section) || flags[section.requires],
  );

  return (
    <nav className="flex items-center gap-1">
      {visible.map((section) => {
        // Prefix match so a detail page keeps its section highlighted.
        const active =
          pathname === section.href || pathname.startsWith(`${section.href}/`);
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
            )}
          >
            {t(section.key)}
            {/* Act-now notifications persist until the condition clears
                `[07 G1]`, so this count is a queue length, not an unread
                tally — it does not fall when the page is opened. */}
            {section.href === "/notifications" && flags.unresolvedCount > 0 ? (
              <span
                className="bg-destructive text-destructive-foreground ms-1.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs"
                dir="ltr"
              >
                {flags.unresolvedCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
