"use client";

import {
  Activity,
  Building2,
  ChevronUp,
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
 *
 * ## Below `md` it is `D56`'s bottom sheet
 *
 * It was a horizontally scrollable strip across the top, and the strip was the
 * wrong half of `AD8`: `D56` says the rail **becomes a bottom sheet**, and the
 * comment defending the strip — "no Sheet component, no new dependency, no
 * JavaScript" — named a Radix `Sheet`, which `D20` as rewritten no longer needs
 * anyone to avoid. Eight `flex-none` links ran ~891px inside 351px, so Targets
 * and Team were two swipes off the screen on every page in the product.
 *
 * **It is a native `<details>` and there is no client state** `D20`. The
 * `<summary>` is the closed bar; the panel is its `peer`, revealed by CSS.
 *
 * **The nav is a SIBLING of the `<details>`, never a child.** Every engine
 * hides a closed `<details>`' non-summary children through a slot or
 * `::details-content`, and author CSS cannot reliably re-show them — so nesting
 * would leave `D49`'s seven links unreachable at `md` and up, where there is no
 * disclosure to open. As a peer it is one selector, the links are in the markup
 * in both states, and that is what `verify:routes` reads and what `useState`
 * could never give it.
 *
 * **It closes itself on navigation**, free: every link is a full page load, so
 * the next document renders the `<details>` shut.
 *
 * `flex-col-reverse` below `md` pins the bar to the bottom edge and grows the
 * panel upward out of it. Opening must not move the thing that was tapped.
 *
 * **`glass` stays.** `D8`, `D14` and `D21` make the rail one of exactly two
 * surfaces that may carry `--blur`, and the sheet IS the rail.
 *
 * **No chevron rotation and no slide** `D17`. The motion list is closed and a
 * disclosure is not on it — the same reading `disclosure.tsx` already applies.
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

/**
 * `D49`'s count — on a rail link, and on the sheet's closed bar.
 *
 * **The auto margin is on the LABEL beside it, never on this.**
 * `margin-inline-start` resolves against the element's OWN direction, and this
 * run carries `dir="ltr"` because it is a bare figure `D73`. So `ms-auto` here
 * compiled to `margin-left: auto`, which in an RTL row sits on the badge's
 * main-END side: it pushes the badge back against the label and leaves the
 * slack on its outer edge. English worked by accident. That is the defect
 * `companies/page.tsx` records in the same words, and the fix is the same one —
 * put the margin on a run that inherits the page's direction, so it has no side
 * to get wrong `D57`.
 */
function Count({ count }: { count: number }) {
  return (
    <span
      className="bg-(--red-600) inline-flex min-w-5 flex-none items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold text-white"
      dir="ltr"
    >
      {count}
    </span>
  );
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
          "flex flex-none items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors",
          // `D74` — 44px on a phone, the laptop's own density above it `D22`.
          "min-h-11 py-2.5 md:min-h-0 md:py-2",
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
        <span className="me-auto whitespace-nowrap">{label}</span>
        {count !== undefined && count > 0 ? <Count count={count} /> : null}
      </Link>
    );
  };

  // What the closed bar names. Nothing matches on `/reports/new`,
  // `/follow-ups` or `/notifications` — none of them is a rail item `D49` — so
  // the bar says *Menu* rather than naming a section the reader is not in.
  const items = [
    { href: "/", key: "today" },
    ...GROUPS.flatMap((group) =>
      group.items.filter((item) => !("requires" in item) || canManageUsers),
    ),
  ];
  const current = items.find((item) => isActive(item.href));

  return (
    <aside
      data-slot="app-rail"
      className={cn(
        // `D56` — below `md` a bar fixed to the bottom edge, with the panel
        // growing upward out of it. `inset-x-0` compiles to `inset-inline` in
        // Tailwind v4, so it is logical `D57`.
        "bg-rail glass fixed inset-x-0 bottom-0 z-30 flex flex-col-reverse",
        "border-t border-white/10",
        // `md` and up: `D49`'s rail, unchanged.
        "md:sticky md:inset-auto md:top-0 md:h-svh md:w-59 md:flex-none md:flex-col md:gap-0.5 md:border-t-0 md:px-3 md:py-4",
      )}
    >
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

      {/* The bar. FIRST in the DOM because the two blocks below are its
          `peer`s — a peer selector reaches forward only — and LAST on screen,
          because `flex-col-reverse` pins it to the bottom edge. */}
      <details data-slot="rail-sheet" className="peer md:hidden">
        <summary
          data-slot="rail-sheet-bar"
          className={cn(
            "text-rail-strong flex min-h-11 cursor-pointer list-none items-center gap-2.5 px-3 py-2.5",
            "[&::-webkit-details-marker]:hidden",
          )}
        >
          <span
            className="grid size-8 flex-none place-items-center rounded-lg bg-[linear-gradient(140deg,var(--red-500),#7A1020)] text-sm font-bold text-white"
            aria-hidden
          >
            {t("brandMark")}
          </span>
          <span className="me-auto truncate text-sm font-semibold">
            {current ? t(current.key) : t("menu")}
          </span>
          {/* `D49`'s count survives the collapse. It is the one thing on the
              rail that says work has arrived, and a sheet that hid it until
              somebody opened the sheet would be a count nobody sees. */}
          {todayCount > 0 ? <Count count={todayCount} /> : null}
          <ChevronUp className="size-4 flex-none opacity-60" aria-hidden />
        </summary>
      </details>

      {/* `md:min-h-0` and the scroll are `WORKFLOW §5`'s own row: the `<nav>`
          could not shrink — `md:overflow-visible` won, so `min-height: auto`
          held it at content height — free space went negative on a short
          viewport, `mt-auto` below resolved to 0, and the footer landed
          outside the aside: 166px below its own box at 305px. It needs `md`
          width AND a short window, which an iPhone in landscape (852×393) is,
          so the sheet does not make it moot. */}
      <nav
        className={cn(
          "flex flex-col gap-1 px-3 pb-2 md:gap-0.5 md:px-0 md:pb-0",
          "hidden peer-open:max-md:flex md:flex",
          "max-md:max-h-[60svh] max-md:overflow-y-auto md:min-h-0 md:overflow-y-auto",
        )}
      >
        {link("/", t("today"), House, todayCount)}

        {GROUPS.map((group) => {
          const groupItems = group.items.filter(
            (item) => !("requires" in item) || canManageUsers,
          );
          if (groupItems.length === 0) return null;
          return (
            <div key={group.key} className="space-y-0.5 pt-2">
              <p className="text-rail-text px-2.5 pt-2 pb-1.5 text-[10.5px] font-semibold tracking-widest uppercase opacity-45">
                {t(group.key)}
              </p>
              {groupItems.map((item) => link(item.href, t(item.key), item.Icon))}
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
          make the rail one of exactly two surfaces that may carry `--blur`.

          On a phone it is the TOP of the opened sheet — identity above the
          links, which is where a phone menu puts it — so the rule it draws
          moves to the side the links are on. */}
      <div
        data-slot="rail-footer"
        className={cn(
          "relative isolate items-center gap-2.5 border-white/10 px-3 pt-3 pb-2",
          "hidden peer-open:max-md:flex md:flex",
          "max-md:border-b md:mt-auto md:border-t md:px-0 md:pt-3.5 md:pb-0",
        )}
      >
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
