import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { can, listActiveUsers, requireSession } from "@/lib/authz";
import { listNonWorkingDays } from "@/lib/calendar";
import { riyadhDayOf } from "@/lib/working-days";

import { addNonWorkingDaysAction, removeNonWorkingDaysAction } from "./actions";
import { HolidayForm, LeaveForm, RemoveButton } from "./calendar-forms";

export const dynamic = "force-dynamic";

/**
 * The calendar of non-working time — `S94`, session 55.
 *
 * **Not a rail item** `D49`: seven items, and this is a screen a person opens
 * a few times a year. The ways in are where the calendar is felt — the pace
 * line on Today for a book-holder, the Team tab for an overseer, and a
 * person's own page for whoever keeps the accounts.
 *
 * **One list, two forms.** The list is every public holiday, the reader's own
 * leave, and — for the holder of `can_manage_users` — everyone's leave, from
 * the start of this month onwards, soonest first; what has already passed is
 * history and stays in the table without cluttering the screen. The holiday
 * form renders for the account-keeper alone; the leave form renders for
 * everyone, with a person picker only where the reader may enter somebody
 * else's `D53`. The data layer re-checks both `S109`.
 *
 * A row's remove control renders for whoever could have entered it — the
 * same test, asked of the row.
 */
export default async function CalendarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await requireSession();
  const t = await getTranslations();
  const format = await getFormatter();

  const keeper = can(session, "canManageUsers");
  const today = riyadhDayOf(new Date());
  const from = `${today.slice(0, 7)}-01`;

  const [rows, people] = await Promise.all([
    listNonWorkingDays(session, from),
    keeper ? listActiveUsers() : Promise.resolve([]),
  ]);

  const day = (value: string) =>
    format.dateTime(new Date(`${value}T00:00:00Z`), {
      dateStyle: "medium",
      timeZone: "UTC",
    });
  const mayRemove = (row: { kind: string; userId: string | null }) =>
    keeper || (row.kind === "leave" && row.userId === session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-start">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("calendar.title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("calendar.hint")}
          </p>
        </div>
      </div>

      {/* `D52` — the empty state says what would make it non-empty, and the
          forms beneath are the action; outside the card `D60`. */}
      {rows.length === 0 ? (
        <p
          data-slot="calendar-empty"
          className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm"
        >
          {t("calendar.empty")}
        </p>
      ) : (
        <Card data-slot="calendar-list" data-total={String(rows.length)}>
          <CardContent className="p-0">
            <Table phoneRows>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("calendar.fields.what")}</TableHead>
                  <TableHead>{t("calendar.fields.who")}</TableHead>
                  <TableHead>{t("calendar.fields.from")}</TableHead>
                  <TableHead>{t("calendar.fields.to")}</TableHead>
                  <TableHead>{t("calendar.fields.enteredBy")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-slot="calendar-row"
                    data-kind={row.kind}
                    data-user={row.userId ?? undefined}
                    data-from={row.startsOn}
                    data-to={row.endsOn}
                  >
                    <TableCell phone="lead" className="font-medium">
                      <span dir="auto">{row.label}</span>
                    </TableCell>
                    <TableCell phone="name">
                      {row.kind === "public_holiday" ? (
                        <Badge variant="secondary">
                          {t("calendar.kind.public_holiday")}
                        </Badge>
                      ) : (
                        <span dir="auto">{row.userName}</span>
                      )}
                    </TableCell>
                    {/* `D73` — a formatted date carries no `dir`. */}
                    <TableCell phone="keep" className="num">
                      {day(row.startsOn)}
                    </TableCell>
                    <TableCell className="num">{day(row.endsOn)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <span dir="auto">{row.createdByName}</span>
                    </TableCell>
                    <TableCell phone="action" className="text-end">
                      {mayRemove(row) ? (
                        <RemoveButton
                          action={removeNonWorkingDaysAction.bind(null, row.id)}
                        />
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card data-slot="calendar-leave">
          <CardHeader>
            <CardTitle className="text-start text-sm">
              {t("calendar.leave.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-3 text-start text-[12.5px]">
              {t("calendar.leave.hint")}
            </p>
            <LeaveForm
              action={addNonWorkingDaysAction}
              people={keeper ? people : []}
              selfId={session.user.id}
            />
          </CardContent>
        </Card>

        {keeper ? (
          <Card data-slot="calendar-holiday">
            <CardHeader>
              <CardTitle className="text-start text-sm">
                {t("calendar.holiday.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-3 text-start text-[12.5px]">
                {t("calendar.holiday.hint")}
              </p>
              <HolidayForm action={addNonWorkingDaysAction} />
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div>
        <Button asChild size="sm" variant="ghost">
          <Link href="/">{t("calendar.back")}</Link>
        </Button>
      </div>
    </div>
  );
}
