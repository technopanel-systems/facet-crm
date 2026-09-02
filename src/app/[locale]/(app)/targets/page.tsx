import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireSession } from "@/lib/authz";
import {
  achievementForPeriod,
  currentPeriod,
  periodStart,
} from "@/lib/targets";

import { ListCard } from "../_components/list-controls";

import { AttainmentTable } from "./attainment-table";

export const dynamic = "force-dynamic";

/** `YYYY-MM-01` → `YYYY-MM`, which is what `<input type="month">` wants. */
function asMonth(period: string): string {
  return period.slice(0, 7);
}

/**
 * Targets `D49` — **the book-holder's own screen**: their goal and their
 * attainment together, by month.
 *
 * **An overseer is sent to the Team tab** (session 53). `D49` moved the
 * overseer's Targets there — `D39`'s table with every person's goal and
 * attainment, the company target above it `S136`, the per-row control, and
 * one person's history behind a click — so for `sees_all_reps` this route is
 * a deep link to that tab, not a second screen with the same figures. The
 * redirect is on the flag `D64` reads, never a role name (`CLAUDE.md`).
 *
 * **Why the screen stays for a book-holder rather than going with the rail
 * item.** The one real cost the Team-tab proposal named was a rep losing
 * sight of their own target history — this screen, with its month picker,
 * is where they had it. The alternatives were a history block on the rep's
 * Today (a second derivation of past months on the commonest read in the
 * product) or keeping this screen and its rail item for book-holders alone.
 * The second is the smaller change and loses nothing: the rail is
 * conditional on the same partition the dashboard already draws `D64`, so a
 * rep keeps *Targets* and an overseer has *Team*.
 *
 * **This screen absorbed `/performance` in session `28b`**; `S123`'s two
 * figures live on `/users/[id]` and coverage is `/companies` `S88`. The
 * company block `S136` left for the Team band in session 53 — for a rep it
 * never rendered `D37`, and the one holder who could set it now does so
 * where the team is.
 *
 * **Scoped, never gated** `S83`: a rep reads their own row and no permission
 * flag guards the screen. No control renders here — `can_set_targets` is
 * never a book-holder's, and the overseers who hold it set targets on the
 * Team tab.
 */
export default async function TargetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { period: requested } = await searchParams;

  const session = await requireSession();

  // The overseer's Targets is the Team tab `D49` `D76`.
  if (session.user.role.seesAllReps) {
    redirect({
      href: { pathname: "/", query: { tab: "team" } },
      locale: locale as Locale,
    });
  }

  const t = await getTranslations();

  const period = /^\d{4}-\d{2}/.test(requested ?? "")
    ? periodStart(requested as string)
    : currentPeriod();

  const rows = await achievementForPeriod(session, period);

  return (
    <div data-slot="attainment" className="flex flex-col gap-6">
      <PageHeader
        title={t("targets.title")}
        description={t("targets.detail.derivedNotice")}
      />

      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="period" className="text-start text-sm font-medium">
            {t("targets.fields.period")}
          </label>
          <Input
            id="period"
            name="period"
            type="month"
            defaultValue={asMonth(period)}
            dir="ltr"
            className="w-44 text-start"
          />
        </div>
        <Button type="submit" variant="outline">
          {t("common.apply")}
        </Button>
      </form>

      {/* No pager: `achievementForPeriod` returns the whole measured set for
          the month, so the footer is a count and nothing else. */}
      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {t("targets.empty")}
        </p>
      ) : (
        // A month's measured set is never paged, so the footer is the count.
        <ListCard basePath="/targets" page={1} total={rows.length}>
          <AttainmentTable rows={rows} />
        </ListCard>
      )}

      {/* `07 D2` — target progress and activity side by side, NEVER combined
          into one score. Since Phase 9 activity is real and derived `[20 §8]`,
          so this is a link rather than an apology — and it stays a link,
          because folding a number in here is the thing `07 D2` forbids. */}
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-muted-foreground text-start text-sm">
          {t("targets.detail.activityElsewhere")}
        </p>
        <Button asChild size="xs" variant="outline">
          <Link href="/activity">{t("targets.detail.viewActivity")}</Link>
        </Button>
      </div>
    </div>
  );
}
