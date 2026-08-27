"use client";

import {
  Activity,
  Building2,
  FileText,
  FolderOpen,
  House,
  Target,
  Truck,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The rail `D49` — **seven items** in two groups, plus Today.
 *
 * Session `28b` took it there. It carried eight until then, deliberately:
 * `D49` merges Performance into Targets and that is a screen change, so moving
 * the rail item before the screens merged would have hidden attainment from
 * everyone who could reach it. Performance sat **last in `track`** precisely so
 * that deleting one line would leave `D49`'s order already correct, which is
 * what happened.
 *
 * It replaced a twelve-item horizontal nav. Contacts, Reports, Coverage,
 * Follow-ups and Notifications are still not top-level: contacts live inside a
 * company, coverage is `/companies` and `/follow-ups` `S88`, and follow-ups and
 * notifications became the Today count and the bell. `/reports` and
 * `/performance` are gone as routes; **every other one of those still works** —
 * that was navigation, not routing.
 *
 * `D50` governs how it is gated: this component is `"use client"` and cannot
 * call `can()`, so the `(app)` layout computes the flags and passes them down
 * as booleans. It imports NOTHING from `@/lib/authz`, not even a type — a
 * type-only import is one careless edit away from becoming a value import that
 * ships the Postgres driver to the browser.
 *
 * Hiding a link is cosmetic `D50`. `/users` returns `notFound()` on its own
 * `D53`.
 */

const GROUPS = [
  {
    key: "sell",
    items: [
      { href: "/companies", key: "companies", Icon: Building2 },
      { href: "/projects", key: "projects", Icon: FolderOpen },
      { href: "/quotations", key: "quotations", Icon: FileText },
      { href: "/dispatches", key: "dispatches", Icon: Truck },
    ],
  },
  {
    key: "track",
    items: [
      { href: "/activity", key: "activity", Icon: Activity },
      { href: "/targets", key: "targets", Icon: Target },
      { href: "/users", key: "team", Icon: Users, requires: "canManageUsers" },
    ],
  },
] as const;

type RailFlags = {
  canManageUsers: boolean;
  /** Follow-ups waiting on this identity — the Today badge `D49`. */
  todayCount: number;
  userName: string;
  roleLabel: string;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function AppRail({
  canManageUsers,
  todayCount,
  userName,
  roleLabel,
}: RailFlags) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  // Prefix match so a detail page keeps its section lit. Today is the one
  // exception: every path starts with "/", so it must match exactly.
  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  const link = (
    href: string,
    label: string,
    Icon: typeof House,
    count?: number,
  ) => {
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-rail-active text-rail-strong"
            : "text-rail-text hover:bg-rail-active hover:text-rail-strong",
        )}
      >
        <Icon
          className={cn(
            "size-4 flex-none",
            active ? "text-(--red-500)" : undefined,
          )}
          aria-hidden
        />
        <span className="whitespace-nowrap">{label}</span>
        {count !== undefined && count > 0 ? (
          <span
            className="bg-(--red-600) ms-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold text-white"
            dir="ltr"
          >
            {count}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <aside className="bg-rail glass flex flex-col gap-0.5 px-3 py-3 md:sticky md:top-0 md:h-svh md:w-59 md:flex-none md:py-4">
      <div className="hidden items-center gap-2.5 px-2 pt-1 pb-4 md:flex">
        <div
          className="grid size-8 flex-none place-items-center rounded-lg bg-[linear-gradient(140deg,var(--red-500),#7A1020)] text-sm font-bold text-white"
          aria-hidden
        >
          {t("brandMark")}
        </div>
        <div className="text-start">
          <span className="text-rail-strong block text-sm font-semibold">
            {t("brand")}
          </span>
          <span className="text-rail-text block text-[11px] opacity-70">
            {t("brandSub")}
          </span>
        </div>
      </div>

      {/* Below md the rail is a horizontally scrollable strip: no Sheet
          component, no new dependency, no JavaScript. */}
      <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col md:gap-0.5 md:overflow-visible">
        {link("/", t("today"), House, todayCount)}

        {GROUPS.map((group) => {
          const items = group.items.filter(
            (item) => !("requires" in item) || canManageUsers,
          );
          if (items.length === 0) return null;
          return (
            <div
              key={group.key}
              className="contents md:block md:space-y-0.5 md:pt-2"
            >
              <p className="text-rail-text hidden px-2.5 pt-2 pb-1.5 text-[10.5px] font-semibold tracking-widest uppercase opacity-45 md:block">
                {t(group.key)}
              </p>
              {items.map((item) => link(item.href, t(item.key), item.Icon))}
            </div>
          );
        })}
      </nav>

      {/* `isolate` is not decoration — it is the fix for the avatar painting
          over the name in Brave at 1366, dark (`WORKFLOW §5`). The measurement
          is clean in headless Chrome at that exact configuration, so it is a
          compositing difference, not a layout one: `glass` gives the <aside>
          a `backdrop-filter`, which promotes it to its own layer, and Brave
          composites that layer on the GPU where headless Chrome does it in
          software. A footer with its own stacking context is not painted by
          the aside's promoted layer. **`glass` stays** — `D8`, `D14` and `D21`
          make the rail one of exactly two surfaces that may carry `--blur`. */}
      <div className="relative isolate mt-auto hidden items-center gap-2.5 border-t border-white/10 pt-3.5 md:flex">
        <div
          className="grid size-8 flex-none place-items-center rounded-full bg-[linear-gradient(140deg,#8A3244,#4A1622)] text-xs font-semibold text-white"
          aria-hidden
        >
          {initials(userName)}
        </div>
        <div className="min-w-0 text-start">
          <span className="text-rail-strong block truncate text-[13px] font-semibold">
            {userName}
          </span>
          <span className="text-rail-text block truncate text-[11px] opacity-80">
            {roleLabel}
          </span>
        </div>
      </div>
    </aside>
  );
}
