/**
 * Working-day arithmetic — `07 D5`, `21 §8`.
 *
 * Two of `07 D5`'s five follow-up thresholds are stated in **working days**:
 * a quotation with no response after 5, a catalogue after 10. The other three
 * are calendar days and never come through here.
 *
 * **Friday and Saturday are the weekend, for everyone.** `04 C4` made working
 * days a property of the rep; `07 D6` superseded that and `20 §7` restated it —
 * Friday and Saturday are off for everyone including outside Riyadh, and
 * Saturday work is recorded but never required. So this is a global rule with
 * no per-rep branch, which is the whole reason `07 D6` made the change.
 *
 * **The holiday calendar is `S94`'s, since session 55**, and it is not read
 * here: this module stays pure. Every function below takes an optional `off`
 * set — `YYYY-MM-DD` days that are not working days for the person in
 * question, which `src/lib/calendar.ts` builds from the public holidays and
 * that person's leave — and treats a day in it exactly as it treats a Friday.
 * With no set passed, only the weekend is skipped, which is what the
 * table-driven checks in `verify:phase10a` §4 hold.
 *
 * This module imports **nothing**. Dates are `YYYY-MM-DD` calendar days in
 * Riyadh — the same strings `reports.today()` produces and `report_date` holds
 * — parsed as UTC midnight so the arithmetic never crosses a zone boundary.
 * It is a pure function, and `scripts/verify-phase10a.ts` §4 drives it as one,
 * table-driven, with no database.
 */

/**
 * The Riyadh calendar day a timestamp falls on, as `YYYY-MM-DD`.
 *
 * The TypeScript half of `(x at time zone 'Asia/Riyadh')::date`, and the reason
 * it is needed: Drizzle renders a column interpolated into a `sql` template
 * **in the SELECT list** without its table qualifier — `"created_at"`, not
 * `"companies"."created_at"` — which is ambiguous the moment the query has a
 * join. The WHERE clause renders correctly. So a joined query keeps its date
 * arithmetic in the WHERE and converts the selected timestamp here instead.
 *
 * This is the same family as the bug `verify:phase9` caught in `coverage.ts`,
 * where a correlated subquery inside a `sql` template silently returned the
 * empty answer for every row.
 */
export function riyadhDayOf(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    dateStyle: "short",
  }).format(at);
}

/** Friday and Saturday. `Date#getUTCDay()`: 0 = Sunday … 5 = Friday, 6 = Saturday. */
const WEEKEND_DAYS = new Set([5, 6]);

/**
 * The working days in one week — derived from `S93`'s weekend, never typed:
 * seven days less the two that are off. `D32`'s opening week reads it.
 */
export const WORKING_DAYS_PER_WEEK = 7 - WEEKEND_DAYS.size;

/**
 * `D32` — **the month has just started.** While the working days done this
 * month (today counted) are no more than one working week, the pace line and
 * `D79`'s *behind pace* condition say so instead of *ahead* or *behind*. The
 * figure is untouched — the tick, the percentages and the gap attribute all
 * stay — only the words change, and only for these days. The line sits at one
 * working week because that is the unit the calendar already answers with
 * (`S93`) and the shortest interval the pipeline itself measures in: a
 * quotation is not even chased before five working days `S87`. No stored
 * setting, no invented threshold.
 */
export function isOpeningWeek(daysWorked: number): boolean {
  return daysWorked <= WORKING_DAYS_PER_WEEK;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parse(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

/**
 * A set of calendar days that are not working days for one person — public
 * holidays plus that person's leave `S94`. `calendar.ts` builds it; every
 * function here accepts it. An empty set means the weekend alone.
 */
export type OffDays = ReadonlySet<string>;

const NO_OFF_DAYS: OffDays = new Set();

/** True unless the date falls on a Friday, a Saturday, or a day in `off`. */
export function isWorkingDay(day: string, off: OffDays = NO_OFF_DAYS): boolean {
  const time = parse(day);
  if (Number.isNaN(time)) return false;
  return !WEEKEND_DAYS.has(new Date(time).getUTCDay()) && !off.has(day);
}

function offAt(time: number, off: OffDays): boolean {
  return (
    WEEKEND_DAYS.has(new Date(time).getUTCDay()) ||
    (off.size > 0 && off.has(new Date(time).toISOString().slice(0, 10)))
  );
}

/**
 * Working days elapsed **from** `from` **to** `to`, counting neither endpoint's
 * own day as elapsed until it is behind us: `workingDaysBetween(d, d)` is 0, and
 * a Thursday to the following Sunday is 1, because Friday and Saturday are not
 * working days.
 *
 * Returns 0 rather than a negative number when `to` precedes `from` — a
 * follow-up asks how long something has been waiting, and nothing has been
 * waiting for a negative number of days. A caller that needs direction should
 * compare the dates itself.
 */
export function workingDaysBetween(
  from: string,
  to: string,
  off: OffDays = NO_OFF_DAYS,
): number {
  const start = parse(from);
  const end = parse(to);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;

  let elapsed = 0;
  for (let time = start + MS_PER_DAY; time <= end; time += MS_PER_DAY) {
    if (!offAt(time, off)) elapsed += 1;
  }
  return elapsed;
}

/** Plain calendar days elapsed, for `07 D5`'s three unqualified thresholds. */
export function calendarDaysBetween(from: string, to: string): number {
  const start = parse(from);
  const end = parse(to);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Math.round((end - start) / MS_PER_DAY);
}

/**
 * The calendar day `days` before `day` — how a query turns a threshold into a
 * cut-off it can compare a stored `date` column against.
 */
export function shiftDays(day: string, days: number): string {
  const time = parse(day);
  if (Number.isNaN(time)) return day;
  return new Date(time + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * The calendar day that is `workingDays` working days before `day` — the
 * cut-off form of a working-day threshold.
 *
 * Walked backwards a day at a time rather than computed from whole weeks: the
 * arithmetic shortcut is where an off-by-one lives, and this runs once per
 * query, not once per row.
 */
export function shiftWorkingDays(
  day: string,
  workingDays: number,
  off: OffDays = NO_OFF_DAYS,
): string {
  const start = parse(day);
  if (Number.isNaN(start) || workingDays <= 0) return day;

  let time = start;
  let remaining = workingDays;
  while (remaining > 0) {
    time -= MS_PER_DAY;
    if (!offAt(time, off)) remaining -= 1;
  }
  return new Date(time).toISOString().slice(0, 10);
}

/**
 * The working day before `day` — `D77`'s *yesterday*.
 *
 * On a Sunday that is Thursday, never the literal weekend: `S93` makes Friday
 * and Saturday the weekend for everyone, and *previous working day* is the
 * question the Yesterday band asks. Walked backwards like `shiftWorkingDays`
 * above, and for the same reason: the shortcut is where an off-by-one lives.
 */
export function previousWorkingDay(day: string, off: OffDays = NO_OFF_DAYS): string {
  let cursor = shiftDays(day, -1);
  while (!isWorkingDay(cursor, off)) cursor = shiftDays(cursor, -1);
  return cursor;
}

/**
 * How much of the month `today` falls in has been **worked**, and how much of
 * it there is — `D32`'s expected-to-date, moved here from the Today page in
 * session 55 so the per-person answer `S94` needs has one home.
 *
 * **Working days, not calendar days.** A rep dispatches Sunday to Thursday, so
 * a calendar denominator would show them slipping every weekend and catching
 * up every Monday for no real reason. **Today counts**, which is what makes
 * the fraction reach 100% on the last working day, and it holds at 100%
 * through any trailing weekend. **A day in `off` is not in either figure**:
 * a public holiday shortens everyone's month and a fortnight's leave shortens
 * one person's, so the tick and the expectation move together and a rep back
 * from leave is not behind for days he could not have worked.
 */
export function monthWorked(
  today: string,
  off: OffDays = NO_OFF_DAYS,
): { worked: number; total: number } {
  const [year, month, dayOfMonth] = today.split("-").map(Number);
  // Day 0 of the next month is the last day of this one.
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();

  let worked = 0;
  let total = 0;
  for (let day = 1; day <= days; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!isWorkingDay(date, off)) continue;
    total += 1;
    if (day <= dayOfMonth) worked += 1;
  }
  // A month with no working day cannot exist. The floor is here so a division
  // can never be by zero, not because the case is reachable.
  return { worked, total: Math.max(1, total) };
}

/**
 * The Sunday of the week `day` falls in — the start of *this week*.
 *
 * **Derived, not chosen.** `S93` makes Friday and Saturday the weekend for
 * everyone and `WEEKEND_DAYS` above is that rule in code; a week whose weekend
 * is Friday and Saturday begins on Sunday. So this is arithmetic over a rule
 * that already exists rather than a boundary somebody picked, which matters —
 * a week nobody chose becomes the number everyone believes in six months later.
 *
 * `D39`'s *logged this week* is the one reader. A Sunday returns itself, and a
 * Friday or Saturday returns the Sunday that opened the week they close — the
 * weekend belongs to the week it ends, not the one it precedes, or a Saturday
 * log would land in a week that has not started.
 */
export function weekStart(day: string): string {
  const time = parse(day);
  if (Number.isNaN(time)) return day;
  // `getUTCDay()` is already 0 for Sunday, so the day number IS the offset.
  return new Date(time - new Date(time).getUTCDay() * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}
