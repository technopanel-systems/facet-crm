import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSqm, percentOf, SQM_SCALE } from "@/lib/decimal";
import type { CompanyAttainment } from "@/lib/targets";

import { setCompanyTargetAction } from "./actions";
import { TargetRow } from "./target-row";

/**
 * `S136`'s company target, and what was dispatched against it — **above the
 * table, never a row in it.**
 *
 * `D49` says *one table, one row per rep*, and its first column is **Person**. A
 * company is not a person: as a row it would make that column a lie and leave the
 * row nothing to key on. So it sits above, and carries `D49`'s actual principle —
 * **the goal and the attainment together** — for the one figure that is not
 * anybody's.
 *
 * **The control is the rep rows' control, reused rather than copied** `D58`
 * `D49`: the same `TargetRow` disclosure, out of any cell, with its own handles so
 * `verify:routes` §17 can tell the two forms apart. Two gates, and they are
 * different questions — `sees_all_reps` decides whether a company-scope figure may
 * be READ at all `D37` `D38`, and `can_set_company_target` decides whether it may
 * be set `S136`.
 *
 * **No pace bar here.** That is `D32`'s signature panel and it lives on the
 * dashboard; drawing a second one on this screen would be two derivations of one
 * tick, which `D32` is explicit about.
 */
export async function CompanyTarget({
  attainment,
  period,
  maySet,
}: {
  attainment: CompanyAttainment;
  period: string;
  maySet: boolean;
}) {
  const t = await getTranslations();
  const pct =
    attainment.targetSqm === null
      ? null
      : percentOf(attainment.achievedSqm, attainment.targetSqm, SQM_SCALE);

  return (
    <Card data-slot="company-target">
      <CardHeader>
        <CardTitle className="text-start text-sm">
          {t("targets.company.label")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <p className="num text-start text-2xl font-semibold tracking-tight">
            {/* A sum, so whole metres `D32`. */}
            <span
              data-slot="company-achieved"
              data-sqm={formatSqm(attainment.achievedSqm)}
              dir="ltr"
            >
              {formatSqm(attainment.achievedSqm)}
            </span>
            <span className="text-muted-foreground ms-1.5 font-sans text-sm font-medium">
              {t("common.sqm")}
            </span>
          </p>
          {/* Null is NOT zero `S136`, `D32`: nobody has set one, which a `0`
              would misreport as a company measured at nothing. */}
          {attainment.targetSqm === null ? (
            <p
              data-slot="company-target-sqm"
              className="text-muted-foreground text-start text-sm"
              dir="auto"
            >
              {t("targets.fields.notMeasured")}
            </p>
          ) : (
            <p
              data-slot="company-target-sqm"
              data-sqm={formatSqm(attainment.targetSqm)}
              data-pct={pct}
              className="num text-muted-foreground text-start text-sm"
            >
              {/* `D73` — a translated word and a figure in one run, so it
                  resolves off the word rather than off the digits. */}
              <span dir="auto">
                {t("today.target.of", {
                  target: formatSqm(attainment.targetSqm),
                })}
              </span>
              {" · "}
              <span dir="ltr">{pct}%</span>
            </p>
          )}
        </div>

        {/* The rule's load-bearing sentence, on the screen where somebody is
            about to type the figure — this is where the two numbers would
            otherwise be read as one `S136`. */}
        <p className="text-muted-foreground text-start text-[12.5px]">
          {t("targets.company.detail")}
        </p>

        {maySet ? (
          <div className="text-start">
            <TargetRow
              action={setCompanyTargetAction}
              period={period}
              currentSqm={attainment.targetSqm}
              label="targets.actions.openCompanyTarget"
              act="company-target-edit"
              handle="set-company-target"
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
