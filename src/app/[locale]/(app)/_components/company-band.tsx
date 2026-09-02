import { getTranslations } from "next-intl/server";

import { Card, CardContent } from "@/components/ui/card";
import type { AuthSession } from "@/lib/authz";
import { quotedCount } from "@/lib/quotations";
import {
  companyAchievementForPeriod,
  previousPeriodStart,
} from "@/lib/targets";

import { setCompanyTargetAction } from "../targets/actions";

import { YesterdayPanel } from "./overseer";
import { TargetBody } from "./target-panel";
import { TargetRow } from "./target-row";

/**
 * `D77` — **one band: the company target at the inline start, Yesterday at
 * the inline end; with no company target, Yesterday alone.** `D38`'s figure
 * is `S136`'s, read at company scope for `sees_all_reps` and null for anybody
 * else.
 *
 * **One component for the Today tab and the Team tab** (session 53): the
 * Team tab's *company target above the table* is the SAME band — one
 * derivation, one frame, nothing to drift — which is what the approved
 * drawings show on both tabs. What differs is one prop: on the Team tab the
 * holder of `can_set_company_target` is offered the control `/targets` used
 * to carry `D49` `S136`, and with no target yet the band still renders the
 * target half for that holder so the first figure has somewhere to be typed.
 * Read and write stay different questions — the manager reads the figure
 * and is offered nothing `D53`.
 */
export async function CompanyBand({
  session,
  period,
  month,
  pacePct,
  daysWorked,
  daysInMonth,
  maySetCompanyTarget,
}: {
  session: AuthSession;
  /** `YYYY-MM-01`. */
  period: string;
  /** The month's name in the reader's locale, for the label. */
  month: string;
  pacePct: number;
  daysWorked: number;
  daysInMonth: number;
  /** `can_set_company_target`, asked by the caller — `false` on Today. */
  maySetCompanyTarget: boolean;
}) {
  const t = await getTranslations();

  // `D38` — null target means the band's target half is absent and Yesterday
  // takes the row alone `D77` `D53`, unless the reader may set the first one.
  const company = await companyAchievementForPeriod(session, period);
  const measured = company?.targetSqm == null ? undefined : company;

  const previous = previousPeriodStart(period);
  const [lastMonth, quoted] = measured
    ? await Promise.all([
        companyAchievementForPeriod(session, previous).then(
          (row) => row ?? undefined,
        ),
        quotedCount(session),
      ])
    : [undefined, 0];

  const targetHalf = measured !== undefined || maySetCompanyTarget;

  return (
    <Card data-slot="today-band">
      <CardContent>
        {targetHalf ? (
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_19rem]">
            <div
              data-slot={measured ? "today-target" : "company-target-unset"}
              data-scope={measured ? "company" : undefined}
              className="text-start"
            >
              <p className="text-faint mb-2 text-[10.5px] font-semibold tracking-[.09em] uppercase">
                {t("today.target.labelCompany", { month })}
              </p>
              {measured ? (
                <TargetBody
                  measured={measured}
                  lastMonth={lastMonth}
                  quoted={quoted}
                  pacePct={pacePct}
                  daysWorked={daysWorked}
                  daysInMonth={daysInMonth}
                />
              ) : (
                // Null is NOT zero `S136` `D32`: nobody has set one, which a
                // `0` would misreport as a company measured at nothing.
                <p className="text-muted-foreground text-sm">
                  {t("today.team.companyUnset")}
                </p>
              )}
              {maySetCompanyTarget ? (
                <div className="border-line mt-3 border-t pt-3">
                  {/* The rule's load-bearing sentence, on the screen where
                      somebody is about to type the figure — this is where
                      the two numbers would otherwise be read as one `S136`. */}
                  <p className="text-muted-foreground mb-2 text-[12.5px]">
                    {t("targets.company.detail")}
                  </p>
                  <TargetRow
                    action={setCompanyTargetAction}
                    period={period}
                    currentSqm={measured?.targetSqm ?? null}
                    label="targets.actions.openCompanyTarget"
                    act="company-target-edit"
                    handle="set-company-target"
                  />
                </div>
              ) : null}
            </div>
            <div className="border-line border-t pt-4 md:border-s md:border-t-0 md:ps-6 md:pt-0">
              <YesterdayPanel solo={false} />
            </div>
          </div>
        ) : (
          <YesterdayPanel solo />
        )}
      </CardContent>
    </Card>
  );
}
