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
const SECTIONS = [
  { href: "/companies", key: "companies" },
  { href: "/contacts", key: "contacts" },
  { href: "/projects", key: "projects" },
  { href: "/quotations", key: "quotations" },
  { href: "/dispatches", key: "dispatches" },
  { href: "/targets", key: "targets" },
] as const;

/*
 * These entries are NOT permission-gated, and need not be: both new screens
 * are meaningful for every role. A rep opening `/dispatches` sees the
 * dispatches that credit them; a rep opening `/targets` sees their own target
 * and achievement. What each role may DO is decided in the data layer.
 *
 * The next screen that is meaningless without a flag will need a different
 * answer — this component is `"use client"` and cannot call `can()`, so the
 * flags would have to be passed down from the `(app)` layout as booleans.
 */

export function AppNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {SECTIONS.map((section) => {
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
