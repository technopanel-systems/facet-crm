import type { ReactNode } from "react";
import { getFormatter, getTranslations } from "next-intl/server";

import { RecordRow } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { FollowUpAnchorType, FollowUpRow } from "@/lib/follow-ups";
import { today } from "@/lib/reports";

import { anchorHref } from "./anchors";
import { planFollowUpAction } from "./next-follow-up-actions";
import { toneClass, turnTone } from "./turn";

/**
 * `D34` — the waiting list, in **two sections**.
 *
 * *Today · you planned this* holds the `date_due` rows, and *Slipping* holds
 * the other five kinds. The split is the point of the rule: the planned
 * section is what the rep already chose, and Slipping is what he is choosing
 * between. **The list is worked down by ranking, never emptied**, so an empty
 * Slipping is not the goal and nothing here treats it as one.
 *
 * **This component derives no condition.** Every row arrives already decided
 * by `follow-ups.ts` — which kind, how old, whose company — and this arranges
 * them. A threshold computed in a screen is the defect `CLAUDE.md` records
 * shipping once already.
 *
 * **It takes the whole scope, never a page.** The planned rows sort *last* — a
 * planned date is days old where a quiet company is months old — so sectioning
 * page one would show an empty planned half while four dates were due.
 * `followUpScope` exists for that reason.
 */

/**
 * `D34`'s one-letter kind mark.
 *
 * **Three, not the four `D34` names.** The fourth is `D` for a dispatch
 * request, and `S86`'s dispatch anchor is not on the list yet — `D33` puts
 * that condition in `D65`'s Requests block rather than in a tile here. A
 * fourth entry would be a letter nothing can render, which is the unused
 * structure `CLAUDE.md` calls a defect. It arrives with its row.
 */
const MARK: Record<FollowUpAnchorType, string> = {
  company: "C",
  project: "P",
  quotation_thread: "Q",
};

/** `${type}:${id}` — never an anchor id alone, which collides across types. */
const rowKey = (row: FollowUpRow) => `${row.anchorType}:${row.anchorId}`;

/**
 * `D34` — *grouped by the anchor record, so a rep meets one customer once
 * rather than three times*.
 *
 * **The group is the COMPANY, not the anchor row.** One anchor carries one
 * `next_follow_up_at`, so grouping by anchor would give groups of one and the
 * rule's *"within a group the oldest date first"* would have nothing to order.
 * The rows this exists for are the three on شركة النهضة للمقاولات — its
 * company, its project and its quotation — which are one customer to call.
 *
 * A row with no live company link `[14 §4]` groups alone under its own anchor:
 * it has no customer to be met once.
 *
 * **Ordering is `D34`'s, and still oldest-first overall `S87`**: inside a group
 * the oldest date leads, and between groups the group's oldest date decides.
 * `rows` arrives sorted, so first-seen is already oldest and neither ordering
 * is re-derived here.
 */
function groupByCompany(rows: FollowUpRow[]): FollowUpRow[][] {
  const groups = new Map<string, FollowUpRow[]>();
  for (const row of rows) {
    const key = row.companyId ?? rowKey(row);
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.values()];
}

export async function WaitingList({
  rows,
  slippingLimit,
}: {
  /** The whole scope, oldest first — never a page. */
  rows: FollowUpRow[];
  /** How much of Slipping the dashboard shows before deferring to the list. */
  slippingLimit: number;
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  /** A `date` column is a calendar day in Riyadh, never an instant. */
  const day = (value: string) =>
    format.dateTime(new Date(`${value}T00:00:00Z`), {
      dateStyle: "medium",
      timeZone: "UTC",
    });

  const planned = groupByCompany(rows.filter((row) => row.kind === "date_due"));
  const slipping = rows.filter((row) => row.kind !== "date_due");

  // `setNextFollowUp` refuses a past date, so the control refuses one too
  // rather than offering an input whose value the server will reject.
  const earliest = today();

  /**
   * **Plan, with no client JavaScript** `D20`.
   *
   * A plain `<form>` in a server component, posting through the adapter over
   * the server action the detail panel already uses — no `useActionState`, no
   * client boundary and no second write path. The record is bound
   * **server-side**, so a tampered form cannot name a different one, and
   * `setNextFollowUp` re-checks visibility regardless.
   *
   * `revalidateFor` already revalidates `/`, so the row crosses into the
   * planned section on this same request — `D58`'s *the row changing is the
   * feedback*, and the reason there is no toast.
   *
   * **A refusal has nowhere to render here, and that is what `min` is for.**
   * The server still refuses a past date; the input stops one being offered.
   */
  const planForm = (entry: FollowUpRow) => (
    <form
      data-slot="today-plan-form"
      action={planFollowUpAction.bind(null, entry.anchorType, entry.anchorId)}
      className="flex items-center gap-1"
    >
      <input
        type="date"
        name="nextFollowUpAt"
        min={earliest}
        required
        aria-label={t("followUps.actions.planFor")}
        // `D74` on `D55`'s own phone-first screen — this was `h-7` at 11.5px,
        // a 28px target under the 16px iOS zooms below. The laptop keeps both.
        className="border-line bg-surface-2 num rounded-[10px] border px-2 max-md:min-h-11 max-md:text-base h-7 text-[12.5px]"
      />
      <Button type="submit" size="xs" variant="outline">
        {t("followUps.actions.plan")}
      </Button>
    </form>
  );

  const row = (entry: FollowUpRow, plannable: boolean) => {
    const href = anchorHref(entry.anchorType, entry.anchorId);
    return (
      <RecordRow
        key={rowKey(entry)}
        href={href}
        mark={
          <span
            data-slot="waiting-mark"
            data-mark={MARK[entry.anchorType]}
            aria-hidden
            className="border-line text-faint grid size-6 place-items-center rounded-md border text-[11px] font-semibold"
          >
            {MARK[entry.anchorType]}
          </span>
        }
        title={
          <span dir="auto">
            {entry.anchorName}
          </span>
        }
        // One line of **why**, in plain words `D34`. The kind name is gone —
        // it is the tile above — and so is the owner: "Company gone quiet ·
        // Faisal Al-Harbi" told a rep the two things he already knew.
        meta={
          entry.kind === "date_due"
            ? t("followUps.why.date_due", { date: day(entry.since) })
            : t(`followUps.why.${entry.kind}`)
        }
        // The number the colour was chosen from, so `D6` can be asserted
        // against the derivation rather than against the word "Due today".
        whenData={String(entry.ageDays)}
        whenClassName={toneClass(
          turnTone({
            overdue: entry.ageDays > 0,
            dueSoon: entry.ageDays === 0,
          }),
        )}
        // One unit for the whole list `D34` — calendar days, and its own
        // phrase at zero, which only a date arriving today reaches `[25 §18]`.
        when={
          entry.ageDays === 0
            ? t("followUps.fields.dueToday")
            : t("followUps.fields.days", { count: entry.ageDays })
        }
        action={
          // `D55` puts the waiting list phone-first, and a Slipping row's
          // cluster is three controls wide — Log, the date, Plan. It wraps
          // rather than overflowing; at 1366 and 1440 it is one line.
          <span className="flex flex-wrap items-center justify-end gap-1.5">
            {/* **The action follows the row** `D34`. Open on a quotation, Log
                on a company or a project — and Log needs the company, which a
                project with no live link has not got `[14 §4]`. */}
            {entry.anchorType === "quotation_thread" ? (
              <Button asChild size="xs" variant="outline">
                <Link href={href}>{t("followUps.actions.open")}</Link>
              </Button>
            ) : entry.companyId ? (
              <Button asChild size="xs" variant="outline">
                <Link href={`/reports/new?companyId=${entry.companyId}`}>
                  {t("reports.new")}
                </Link>
              </Button>
            ) : null}
            {plannable ? planForm(entry) : null}
          </span>
        }
      />
    );
  };

  return (
    <Card data-slot="today-waiting-list">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-start text-sm">
          {t("today.list.title")}
        </CardTitle>
        {slipping.length > slippingLimit ? (
          <Button asChild size="xs" variant="ghost">
            <Link href="/follow-ups">
              {t("today.list.seeAll", { count: rows.length })}
            </Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <section data-slot="today-planned">
          <SectionLabel>{t("today.list.planned")}</SectionLabel>
          {planned.length === 0 ? (
            // **The half that genuinely empties**, so the half that carries the
            // empty state `D52` — and its action is the one `D34` gives a
            // slipping row: Plan.
            <p
              data-slot="today-planned-empty"
              className="text-muted-foreground text-start text-[12.5px]"
            >
              {t("today.list.plannedEmpty")}
            </p>
          ) : (
            <ul className="flex flex-col">
              {planned.map((group) => (
                <li key={rowKey(group[0])} className="flex flex-col">
                  {/* A header only where there is something to group `D25`. A
                      lone row is its own customer, and a header repeating that
                      row's name is noise rather than structure.

                      **`dir="auto"` goes on the NAME, never on this block**
                      `D62`. On the block it flipped the whole header to RTL
                      for an Arabic customer — so on an English page it sat at
                      the far inline-end reading as a stray label, and `ms-1.5`
                      put the count's gap on the far side of the number, which
                      is how the count came to run into the name. Direction is
                      a property of the value; the header is not the value. */}
                  {group.length > 1 && group[0].companyName ? (
                    <p
                      data-slot="today-planned-group"
                      className="text-faint mt-3 mb-0.5 text-start text-[10.5px] font-semibold"
                    >
                      <span dir="auto">{group[0].companyName}</span>
                      {" · "}
                      <span className="num" dir="ltr">
                        {group.length}
                      </span>
                    </p>
                  ) : null}
                  <ul className="flex flex-col">
                    {group.map((entry) => row(entry, false))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section data-slot="today-slipping">
          <SectionLabel>{t("today.list.slipping")}</SectionLabel>
          {slipping.length === 0 ? (
            <p
              data-slot="today-slipping-empty"
              className="text-muted-foreground text-start text-[12.5px]"
            >
              {t("today.list.slippingEmpty")}
            </p>
          ) : (
            <ul className="flex flex-col">
              {slipping.slice(0, slippingLimit).map((entry) => row(entry, true))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

/** `D12`'s section label — what separates the two halves. */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-faint mb-1 text-[10.5px] font-semibold tracking-[.09em] uppercase">
      {children}
    </p>
  );
}
