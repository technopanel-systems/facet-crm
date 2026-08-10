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
 * Hiding the link is cosmetic. `/users` returns `notFound()` on its own and
 * every write re-checks the flag in the data layer; the nav is not the gate.
 */

type NavFlags = { canManageUsers: boolean };

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
          </Link>
        );
      })}
    </nav>
  );
}
