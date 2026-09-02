import { getFormatter, getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { AuthSession } from "@/lib/authz";
import { CHAIN_COLUMNS, type ChainPosition } from "@/lib/chain";
import { companiesHeldBySilence } from "@/lib/coverage";
import { formatSqm, percentOf, SQM_SCALE } from "@/lib/decimal";
import { listDispatches } from "@/lib/dispatches";
import { lookupName } from "@/lib/lookups";
import {
  listQuotationThreads,
  type QuotationThreadListRow,
} from "@/lib/quotations";
import { today } from "@/lib/reports";
import { achievementHistoryFor, type AchievementRow } from "@/lib/targets";
import { cn } from "@/lib/utils";
import { calendarDaysBetween, riyadhDayOf } from "@/lib/working-days";

import { setTargetAction } from "../targets/actions";

import { TargetBody } from "./target-panel";
import { TargetRow } from "./target-row";

/** `D70` — a long list caps and states its total. */
const COMPANY_ROWS = 10;
const THREAD_ROWS = 8;
const DISPATCH_ROWS = 8;
const TARGET_PERIODS = 12;

/**
 * **One person's world** — the rep drill-in behind `?tab=team&rep=` (`D39`,
 * session 53): their pace, their companies by silence, their threads by
 * position, their dispatch history and their target history. Clicking a row
 * of the team table opens it.
 *
 * **Gated on `sees_all_reps` and nothing narrower** — the page reaches this
 * only from the overseer branch, so the executive keeps it; `/users/[id]` is
 * `can_manage_users`' door and an executive does not hold it (`D79`'s
 * reasoning, applied to the one door every overseer may open). The subject
 * is `teamPerson`, which composes `visibleMeasuredUsersFilter`, so a rep
 * typing the URL by hand never gets here and an overseer cannot open a
 * stranger.
 *
 * **Every figure is a reader of a derivation another screen already owns**:
 * `achievementForPeriod` for the pace (the band's own, passed in),
 * `companySilence` for the companies (`/companies`' meter), `chainState`
 * for the positions (`D27`'s one ladder, carried on `listQuotationThreads`'
 * rows), `listDispatches` for the history (`/dispatches?userId=`'s own
 * list) and `achievementHistoryFor` for the targets, which folds the same
 * apportionment by month. Nothing here derives a number of its own, and
 * nothing combines two of them `S142`.
 *
 * **Not a route** — `D76` says a tab is URL state on the one dashboard, and
 * a person inside the tab is a narrowing of it, `D28`'s instinct: the strip
 * stays, the Team pill stays lit, and the back link is a plain GET.
 */
export async function RepWorld({
  session,
  person,
  attainment,
  pacePct,
  daysWorked,
  daysInMonth,
  period,
  maySetTargets,
  locale,
}: {
  session: AuthSession;
  person: { id: string; name: string; role: { nameEn: string; nameAr: string | null } };
  /** `achievementForPeriod`, already fetched by the page. */
  attainment: AchievementRow[];
  pacePct: number;
  daysWorked: number;
  daysInMonth: number;
  period: string;
  maySetTargets: boolean;
  locale: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  const measured = attainment.find((row) => row.userId === person.id);
  const now = today();

  const [companies, threads, dispatches, history] = await Promise.all([
    companiesHeldBySilence(person.id, COMPANY_ROWS),
    allThreadsRaisedBy(session, person.id),
    listDispatches(session, { userId: person.id }),
    achievementHistoryFor(session, person.id),
  ]);

  // The one ladder, read once per row where the flags were in scope `D27`;
  // this only counts what it carried.
  const byPosition = new Map<ChainPosition, number>();
  for (const thread of threads.rows) {
    byPosition.set(thread.position, (byPosition.get(thread.position) ?? 0) + 1);
  }
  const open = threads.rows.filter(
    (thread) => thread.position !== "closed" && thread.position !== "won",
  );

  const monthOf = (day: string) =>
    format.dateTime(new Date(`${day}T00:00:00Z`), {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  const dayOf = (day: string) =>
    format.dateTime(new Date(`${day}T00:00:00Z`), {
      dateStyle: "medium",
      timeZone: "UTC",
    });

  return (
    <div data-slot="rep-world" data-user={person.id} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 text-start">
        <div className="min-w-0">
          <Link
            href="/?tab=team"
            data-slot="rep-back"
            className="text-muted-foreground text-[12.5px] hover:underline"
          >
            {t("today.rep.back")}
          </Link>
          {/* One name field, either script `D62`. */}
          <h2 className="mt-1 text-2xl font-semibold tracking-tight wrap-break-word">
            <span dir="auto">{person.name}</span>
          </h2>
          <p className="text-muted-foreground text-sm">
            {lookupName(person.role, locale)}
          </p>
        </div>
        {/* The person's own stream — the one door every `sees_all_reps`
            holder may open `D79`. */}
        <Button asChild variant="outline">
          <Link href={`/activity?who=${person.id}`}>{t("today.rep.stream")}</Link>
        </Button>
      </div>

      {/* `D32`'s panel at the person's own scope — the same body the band
          draws, the same tick, with no side figures: `quotedCount` answers
          for a scope and not a person, and a wrong figure is worse than none. */}
      <Card data-slot="rep-pace" data-measured={measured?.targetSqm != null ? "" : undefined}>
        <CardHeader>
          <CardTitle className="text-start text-sm">{t("today.rep.pace")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-start">
          {measured?.targetSqm != null ? (
            <TargetBody
              measured={measured}
              lastMonth={undefined}
              quoted={0}
              pacePct={pacePct}
              daysWorked={daysWorked}
              daysInMonth={daysInMonth}
              sides={false}
            />
          ) : (
            <p className="text-muted-foreground text-sm">{t("today.rep.noTarget")}</p>
          )}
          {maySetTargets ? (
            <TargetRow
              action={setTargetAction.bind(null, person.id)}
              period={period}
              currentSqm={measured?.targetSqm ?? null}
              label="targets.actions.openTarget"
              act="target-edit"
              handle="set-target"
            />
          ) : null}
        </CardContent>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Companies, quietest first — `companySilence`'s figure, the meter
            `/companies` draws, as a number and a word. */}
        <Card
          data-slot="rep-companies"
          data-total={companies.total}
          data-shown={companies.rows.length}
        >
          <CardHeader>
            <CardTitle className="flex flex-wrap items-baseline justify-between gap-x-4 text-start text-sm">
              <span>{t("today.rep.companies")}</span>
              {companies.total > companies.rows.length ? (
                <span className="text-faint text-[11.5px] font-normal">
                  <span dir="auto">
                    {t("today.rep.companiesOf", {
                      shown: companies.rows.length,
                      total: companies.total,
                    })}
                  </span>
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col text-start">
            {companies.rows.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {t("today.rep.companiesNone")}
              </p>
            ) : (
              companies.rows.map((company, index) => (
                <div
                  key={company.id}
                  data-slot="rep-company"
                  data-id={company.id}
                  data-days={company.silentDays}
                  data-quiet={company.isQuiet ? "" : undefined}
                  className={cn(
                    "flex items-baseline justify-between gap-3 py-2",
                    index > 0 && "border-line border-t",
                  )}
                >
                  <p className="min-w-0 flex-1 text-sm font-medium wrap-break-word">
                    <Link href={`/companies/${company.id}`} className="hover:underline">
                      <span dir="auto">{company.name}</span>
                    </Link>
                  </p>
                  <p className="text-muted-foreground flex flex-none items-center gap-2 text-[12.5px] whitespace-nowrap">
                    {/* Overdue red is `D6`'s own — how long it has waited. */}
                    {company.isQuiet ? (
                      <span className="bg-tone-red text-tone-red-fg border-tone-red-fg/30 rounded-[5px] border px-1.5 py-px text-[11px] font-semibold">
                        {t("today.rep.quiet")}
                      </span>
                    ) : company.onHoldUntil ? (
                      <span className="bg-surface-2 border-line-strong rounded-[5px] border px-1.5 py-px text-[11px] font-semibold">
                        {t("today.rep.onHold")}
                      </span>
                    ) : null}
                    <span dir="auto">
                      {company.lastInteractionAt === null
                        ? t("today.rep.never")
                        : t("today.rep.silent", { count: company.silentDays })}
                    </span>
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Threads by position — `S132`'s six as plain pills with a count,
            `D6`: no colour, and the open ones beneath with how old each deal
            is (`listQuotationThreads`' own clock, stated as such). */}
        <Card
          data-slot="rep-threads"
          data-total={threads.total}
          data-open={open.length}
        >
          <CardHeader>
            <CardTitle className="flex flex-wrap items-baseline justify-between gap-x-4 text-start text-sm">
              <span>{t("today.rep.threads")}</span>
              {open.length > THREAD_ROWS ? (
                <span className="text-faint text-[11.5px] font-normal">
                  <span dir="auto">
                    {t("today.rep.threadsOf", {
                      shown: THREAD_ROWS,
                      total: open.length,
                    })}
                  </span>
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-start">
            {threads.total === 0 ? (
              <p className="text-muted-foreground text-sm">
                {t("today.rep.threadsNone")}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {[...CHAIN_COLUMNS, "closed" as const].map((position) => {
                    const count = byPosition.get(position) ?? 0;
                    if (count === 0) return null;
                    return (
                      <span
                        key={position}
                        data-slot="rep-position"
                        data-position={position}
                        data-count={count}
                        className="bg-surface-2 text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12.5px] whitespace-nowrap"
                      >
                        <span className="num text-foreground font-semibold" dir="ltr">
                          {count}
                        </span>
                        <span>
                          {position === "closed"
                            ? t("today.rep.closed")
                            : t(`chain.step.${position}`)}
                        </span>
                      </span>
                    );
                  })}
                </div>
                <div className="flex flex-col">
                  {open.slice(0, THREAD_ROWS).map((thread, index) => (
                    <ThreadLine
                      key={thread.id}
                      thread={thread}
                      days={calendarDaysBetween(riyadhDayOf(thread.createdAt), now)}
                      first={index === 0}
                    />
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Dispatch history — `/dispatches?userId=`'s own list, its first
            rows; the way to the rest is that list. */}
        <Card
          data-slot="rep-dispatches"
          data-total={dispatches.total}
          data-shown={Math.min(dispatches.rows.length, DISPATCH_ROWS)}
        >
          <CardHeader>
            <CardTitle className="text-start text-sm">
              {t("today.rep.dispatches")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col text-start">
            {dispatches.rows.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {t("today.rep.dispatchesNone")}
              </p>
            ) : (
              <>
                {dispatches.rows.slice(0, DISPATCH_ROWS).map((dispatch, index) => (
                  <div
                    key={dispatch.id}
                    data-slot="rep-dispatch"
                    data-id={dispatch.id}
                    data-status={dispatch.status}
                    className={cn(
                      "grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-3 py-2",
                      index > 0 && "border-line border-t",
                    )}
                  >
                    {/* A locale-formatted date carries no `dir` `D73`. */}
                    <span className="text-muted-foreground text-[12.5px] whitespace-nowrap">
                      {dayOf(dispatch.dispatchDate)}
                    </span>
                    <p className="min-w-0 text-sm font-medium wrap-break-word">
                      <Link href={`/dispatches/${dispatch.id}`} className="hover:underline">
                        <span dir="auto">{dispatch.companyName}</span>
                      </Link>
                      <span className="text-muted-foreground ms-2 text-[12.5px] font-normal">
                        {t(`dispatches.status.${dispatch.status}`)}
                      </span>
                    </p>
                    {/* A sum, so whole metres `D32`; a bare figure, so LTR. */}
                    <span className="num text-sm whitespace-nowrap" dir="ltr">
                      {formatSqm(dispatch.sqm)}{" "}
                      <span className="text-muted-foreground font-sans text-[12.5px]">
                        {t("common.sqm")}
                      </span>
                    </span>
                  </div>
                ))}
                {dispatches.total > DISPATCH_ROWS ? (
                  <p className="border-line border-t pt-2.5">
                    <Button asChild size="xs" variant="outline">
                      <Link href={`/dispatches?userId=${person.id}`}>
                        {t("today.rep.seeAll", { count: dispatches.total })}
                      </Link>
                    </Button>
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        {/* Target history — every row ever, with what was dispatched against
            each month `S84` `S85`. The superseded rows stay: they are the
            history, and the first of each month is the one that applied. */}
        <Card data-slot="rep-targets" data-periods={history.length}>
          <CardHeader>
            <CardTitle className="text-start text-sm">
              {t("today.rep.targets")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col text-start">
            {history.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {t("today.rep.targetsNone")}
              </p>
            ) : (
              history.slice(0, TARGET_PERIODS).map((month, index) => (
                <div
                  key={month.period}
                  data-slot="rep-target-period"
                  data-period={month.period}
                  data-target={formatSqm(month.targetSqm)}
                  data-sqm={formatSqm(month.achievedSqm)}
                  data-rows={month.rows.length}
                  className={cn("py-2", index > 0 && "border-line border-t")}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <p className="text-sm font-medium">{monthOf(month.period)}</p>
                    {/* Two figures and a word — one run, `dir="auto"` `D73`;
                        the percentage is `percentOf`, the panel's own. */}
                    <p className="num text-muted-foreground text-[12.5px]">
                      <span dir="auto">
                        {t("today.rep.achievedOf", {
                          achieved: formatSqm(month.achievedSqm),
                          target: formatSqm(month.targetSqm),
                          pct: String(
                            percentOf(month.achievedSqm, month.targetSqm, SQM_SCALE),
                          ),
                        })}
                      </span>
                    </p>
                  </div>
                  <ul className="text-faint mt-0.5 flex flex-col gap-0.5 text-[11.5px]">
                    {month.rows.map((row, at) => (
                      <li key={row.id} data-slot="rep-target-row" data-in-force={at === 0 ? "" : undefined}>
                        <span dir="auto">
                          {t("today.rep.setBy", {
                            sqm: formatSqm(row.sqm),
                            name: row.setByName,
                          })}
                        </span>
                        {" · "}
                        <span>
                          {format.dateTime(row.createdAt, {
                            dateStyle: "medium",
                            timeZone: "Asia/Riyadh",
                          })}
                        </span>
                        {" · "}
                        <span>
                          {at === 0 ? t("today.rep.inForce") : t("today.rep.superseded")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Every thread one person raised, across `listQuotationThreads`' pages — the
 * fold by position needs the whole set, and the list's own page size is what
 * bounds each call. The page's own `total` bounds the walk.
 */
async function allThreadsRaisedBy(
  session: AuthSession,
  userId: string,
): Promise<{ rows: QuotationThreadListRow[]; total: number }> {
  const first = await listQuotationThreads(session, {
    raisedByUserId: userId,
    page: 1,
  });
  const rows = [...first.rows];
  let page = 1;
  while (rows.length < first.total && first.rows.length > 0) {
    page += 1;
    const next = await listQuotationThreads(session, {
      raisedByUserId: userId,
      page,
    });
    if (next.rows.length === 0) break;
    rows.push(...next.rows);
  }
  return { rows, total: first.total };
}

async function ThreadLine({
  thread,
  days,
  first,
}: {
  thread: QuotationThreadListRow;
  days: number;
  first: boolean;
}) {
  const t = await getTranslations();
  return (
    <div
      data-slot="rep-thread"
      data-id={thread.id}
      data-position={thread.position}
      data-days={days}
      className={cn(
        "flex items-baseline justify-between gap-3 py-2",
        !first && "border-line border-t",
      )}
    >
      <p className="min-w-0 flex-1 text-sm wrap-break-word">
        <Link href={`/quotations/${thread.id}`} className="font-medium hover:underline">
          <span dir="auto">{thread.projectName}</span>
        </Link>
        <span className="text-muted-foreground ms-2 text-[12.5px]">
          <span dir="auto">{thread.companyName}</span>
        </span>
      </p>
      <p className="text-muted-foreground flex flex-none items-center gap-2 text-[12.5px] whitespace-nowrap">
        <span className="bg-surface-2 rounded-full px-2 py-0.5 text-[11.5px]">
          {t(`chain.step.${thread.position as Exclude<ChainPosition, "closed">}`)}
        </span>
        <span dir="auto">{t("today.rep.sitting", { count: days })}</span>
      </p>
    </div>
  );
}
