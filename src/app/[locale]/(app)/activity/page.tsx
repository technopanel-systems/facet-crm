import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { Timeline } from "@/components/timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import {
  dailyActivity,
  dailyActivityEntries,
  defaultRange,
} from "@/lib/daily-activity";

export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The daily activity view `[20 §8]`.
 *
 * **Logged reports beside what FACET recorded on its own.** A view showing only
 * logged reports becomes the attendance check `07 D6` was overruled to avoid,
 * and reps would write filler to fill it.
 *
 * **Scoped, not gated:** `sees_all_reps` sees every rep, everybody else sees
 * exactly their own row. Expanding a rep is `?rep=` in the URL rather than
 * client state — shareable, reload-proof, and it needs no JavaScript.
 *
 * Nothing here is combined with target progress into a single score `[07 D2]`.
 */
export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string; to?: string; rep?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { from, to, rep } = await searchParams;

  const session = await requireSession();
  const t = await getTranslations();

  const fallback = defaultRange();
  const range = {
    from: DATE.test(from ?? "") ? from! : fallback.from,
    to: DATE.test(to ?? "") ? to! : fallback.to,
  };

  const { rows, total } = await dailyActivity(session, { range });
  const expanded = rep ? rows.find((row) => row.userId === rep) : undefined;
  const entries = expanded
    ? await dailyActivityEntries(session, expanded.userId, range)
    : [];

  const withRep = (userId: string | null) => {
    const search = new URLSearchParams({ from: range.from, to: range.to });
    if (userId) search.set("rep", userId);
    return `/activity?${search.toString()}`;
  };

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <PageHeader
        title={t("activity.title")}
        description={t("activity.detail.hint")}
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="from" className="text-start">
            {t("activity.fields.from")}
          </Label>
          <Input
            id="from"
            name="from"
            type="date"
            dir="ltr"
            className="text-start"
            defaultValue={range.from}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="to" className="text-start">
            {t("activity.fields.to")}
          </Label>
          <Input
            id="to"
            name="to"
            type="date"
            dir="ltr"
            className="text-start"
            defaultValue={range.to}
          />
        </div>
        <Button type="submit" size="sm" variant="secondary">
          {t("common.apply")}
        </Button>
      </form>

      <p className="text-muted-foreground text-start text-sm">
        {t("activity.detail.attribution")}
      </p>

      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {t("activity.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">
                  {t("activity.fields.person")}
                </TableHead>
                <TableHead className="text-start">
                  {t("activity.fields.reportsLogged")}
                </TableHead>
                <TableHead className="text-start">
                  {t("activity.fields.companiesTouched")}
                </TableHead>
                <TableHead className="text-start">
                  {t("activity.fields.systemEvents")}
                </TableHead>
                <TableHead className="text-start">
                  {t("activity.fields.signalsRaised")}
                </TableHead>
                <TableHead className="text-start">
                  {t("common.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.userId}>
                  <TableCell className="text-start font-medium">
                    {row.userName}
                  </TableCell>
                  <TableCell className="text-start" dir="ltr">
                    {row.reportsLogged}
                  </TableCell>
                  <TableCell className="text-start" dir="ltr">
                    {row.companiesTouched}
                  </TableCell>
                  <TableCell className="text-start" dir="ltr">
                    {row.systemEvents}
                  </TableCell>
                  <TableCell className="text-start" dir="ltr">
                    {row.signalsRaised}
                  </TableCell>
                  <TableCell className="text-start">
                    <Button asChild size="xs" variant="outline">
                      <Link
                        href={
                          expanded?.userId === row.userId
                            ? withRep(null)
                            : withRep(row.userId)
                        }
                      >
                        {expanded?.userId === row.userId
                          ? t("activity.detail.collapse")
                          : t("activity.detail.expand")}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="text-start font-medium">
                  {t("activity.detail.teamTotal")}
                </TableCell>
                <TableCell className="text-start" dir="ltr">
                  {total.reportsLogged}
                </TableCell>
                <TableCell className="text-start" dir="ltr">
                  {total.companiesTouched}
                </TableCell>
                <TableCell className="text-start" dir="ltr">
                  {total.systemEvents}
                </TableCell>
                <TableCell className="text-start" dir="ltr">
                  {total.signalsRaised}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      {expanded ? (
        <Timeline
          events={entries}
          total={entries.length}
          title={t("activity.detail.entriesFor", { name: expanded.userName })}
        />
      ) : null}

      <p className="text-muted-foreground text-start text-xs">
        {t("activity.detail.notACombinedScore")}
      </p>
    </main>
  );
}
