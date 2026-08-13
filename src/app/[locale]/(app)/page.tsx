import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { FOLLOW_UP_KINDS } from "@/lib/enums";
import { bilingualName } from "@/lib/lookups";
import { listNotifications } from "@/lib/notifications";
import { achievementForPeriod, currentPeriod } from "@/lib/targets";

import { anchorHref } from "./_components/anchors";
import { shellCounts } from "./_components/shell-counts";

export const dynamic = "force-dynamic";

/** How much of the queue the dashboard shows before deferring to `/follow-ups`. */
const QUEUE_ROWS = 6;

/**
 * Today `[22 §3]` — the dashboard archetype, and the screen that replaced the
 * system-status page at `/`.
 *
 * **It composes existing modules and writes no query and no predicate of its
 * own.** `followUps()`, `unresolvedCount()`, `listNotifications()` and
 * `achievementForPeriod()` are each called exactly as their own screens call
 * them; the follow-ups derivation is shared with the rail through
 * `shellCounts()` so `/` computes it once.
 *
 * **It does not call `sweepNotifications()`.** That is a write path and it stays
 * on `/notifications`, where it already lives. The home page is the commonest
 * read in the application and must not change how often the sweep runs.
 *
 * **It shows no coverage region** `[22 §6.5]`. `coverage()` filters `quietOnly`
 * after paginating, so it returns the quiet companies among the alphabetically
 * first 25 rather than the first 25 quiet companies — a rep whose quiet
 * companies sort late would see an empty panel while nine were genuinely quiet.
 * The `company_quiet` tile below is safe and does render: that number comes from
 * `followUps().counts`, computed over the whole scope rather than over a page.
 *
 * **Scoped, never gated** — like `/follow-ups` and `/coverage`, every identity
 * gets the same screen and the visibility filters decide the rows.
 */
export default async function TodayPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const format = await getFormatter();

  const { session, follow } = await shellCounts();
  const period = currentPeriod();
  const [attainment, notifications] = await Promise.all([
    achievementForPeriod(session, period),
    listNotifications(session, { page: 1 }),
  ]);

  // `sees_all_reps` gets every measured rep back; everyone else gets exactly
  // their own row. Either way the panel is about the person reading it.
  const mine = attainment.find((row) => row.userId === session.user.id);
  // `targetSqm` is null when this identity is not measured this month — never
  // "0" — so the panel is absent rather than showing a target of nothing.
  const measured = mine && mine.targetSqm !== null ? mine : undefined;

  const waiting = notifications.rows.filter(
    (row) => row.tier === "act_now" && !row.resolvedAt,
  );

  const queue = follow.rows.slice(0, QUEUE_ROWS);

  return (
    <div className="flex flex-col gap-6">
      <div className="text-start">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("today.greeting", { name: session.user.name })}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          <span dir="ltr">
            {format.dateTime(new Date(), {
              dateStyle: "full",
              timeZone: "Asia/Riyadh",
            })}
          </span>
          {" · "}
          {/* The zero case is its own key, not an ICU `=0` branch:
              `check:messages` reads `{word` as a placeholder name, so a
              literal branch starting with a letter fails parity against an
              Arabic branch starting with an Arabic letter. */}
          {follow.total === 0
            ? t("today.needsYouZero")
            : t("today.needsYou", { count: follow.total })}
        </p>
      </div>

      {measured ? (
        <Card data-slot="today-target">
          <CardHeader>
            <CardTitle className="text-start text-sm">
              {t("today.target.label", {
                month: format.dateTime(new Date(`${period}T00:00:00Z`), {
                  month: "long",
                  timeZone: "UTC",
                }),
              })}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <p className="num text-start text-3xl font-semibold tracking-tight">
                <span dir="ltr">{measured.achievedSqm}</span>
                <span className="text-muted-foreground ms-1.5 font-sans text-sm font-medium">
                  {t("common.sqm")}
                </span>
              </p>
              <p className="num text-muted-foreground text-end text-sm">
                <span dir="ltr">
                  {t("today.target.of", { target: measured.targetSqm ?? "" })}
                </span>
              </p>
            </div>
            <Progress achieved={measured.achievedSqm} target={measured.targetSqm} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FOLLOW_UP_KINDS.map((kind) => (
          <Link
            key={kind}
            href={`/follow-ups?kind=${kind}`}
            className="bg-card border-line hover:border-line-strong rounded-xl border p-4 text-start shadow-(--shadow) transition-colors"
          >
            <Badge variant="outline">{t(`enums.followUpKind.${kind}`)}</Badge>
            <p className="num mt-2 text-2xl font-semibold tracking-tight">
              <span dir="ltr">{follow.counts[kind]}</span>
            </p>
          </Link>
        ))}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3" data-slot="today-queue">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-start text-sm">
              {t("today.queue.title")}
            </CardTitle>
            {follow.total > queue.length ? (
              <Button asChild size="xs" variant="ghost">
                <Link href="/follow-ups">
                  {t("today.queue.seeAll", { count: follow.total })}
                </Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {queue.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
                {t("today.queue.empty")}
              </p>
            ) : (
              <ul className="flex flex-col">
                {queue.map((row) => (
                  <li
                    key={`${row.kind}:${row.anchorId}`}
                    className="border-line flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b py-2.5 last:border-b-0"
                  >
                    <span className="flex min-w-0 flex-col text-start">
                      <Link
                        href={anchorHref(row.anchorType, row.anchorId)}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {bilingualName(
                          {
                            nameEn: row.anchorNameEn,
                            nameAr: row.anchorNameAr,
                          },
                          locale,
                        )}
                      </Link>
                      <span className="text-muted-foreground truncate text-xs">
                        {t(`enums.followUpKind.${row.kind}`)}
                        {row.ownerNames.length > 0
                          ? ` · ${row.ownerNames.join(", ")}`
                          : ""}
                      </span>
                    </span>
                    {/* Elapsed time, coloured by lateness `[22 §4]`. Working
                        days for the two thresholds `07 D5` states that way,
                        calendar days for the rest `[21 §8]`. */}
                    <span
                      className="num text-tone-red-fg text-xs font-semibold"
                      dir="ltr"
                    >
                      {row.inWorkingDays
                        ? t("followUps.fields.workingDays", {
                            count: row.ageDays,
                          })
                        : t("followUps.fields.days", { count: row.ageDays })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2" data-slot="today-waiting">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-start text-sm">
              {t("today.waiting.title")}
            </CardTitle>
            <Button asChild size="xs" variant="ghost">
              <Link href="/notifications">{t("today.waiting.seeAll")}</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {waiting.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
                {t("today.waiting.empty")}
              </p>
            ) : (
              <ul className="flex flex-col">
                {waiting.map((row) => (
                  <li
                    key={row.id}
                    className="border-line flex flex-col gap-0.5 border-b py-2.5 text-start last:border-b-0"
                  >
                    <span className="text-sm font-medium">
                      {row.typeName
                        ? t(`enums.notificationType.${row.typeName}`)
                        : row.typeKey}
                    </span>
                    {/* A link only while the viewer may still open it
                        `[20 §8.2]`: a share can be revoked and a company handed
                        on, and the row outlives either. */}
                    {row.anchorId && row.anchorType && row.anchorLabel ? (
                      row.anchorViewable ? (
                        <Link
                          href={anchorHref(row.anchorType, row.anchorId)}
                          className="text-muted-foreground truncate text-xs hover:underline"
                        >
                          {row.anchorLabel}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground truncate text-xs">
                          {row.anchorLabel}
                        </span>
                      )
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * The attainment bar. The percentage is the only place a square-metre decimal
 * becomes a number, and it is display-only — the same arithmetic `/targets`
 * already does for its own column.
 */
function Progress({
  achieved,
  target,
}: {
  achieved: string;
  target: string | null;
}) {
  const targetValue = Number(target ?? "0");
  const pct =
    targetValue > 0
      ? Math.min(100, Math.round((Number(achieved) / targetValue) * 100))
      : 0;

  return (
    <div
      className="bg-surface-2 border-line h-3 overflow-hidden rounded-md border"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="bg-brand h-full rounded-md"
        style={{ inlineSize: `${pct}%` }}
      />
    </div>
  );
}
