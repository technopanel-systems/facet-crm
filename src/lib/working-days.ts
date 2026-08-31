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
 * **No holiday calendar** `[21 §8]`. Eid and national holidays are not skipped.
 * No document asks for one, and a table somebody has to keep fed is a table
 * that silently rots. Recorded in `21 §11` as `OPEN — not chosen` rather than
 * guessed at here.
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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parse(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

/** True unless the date falls on a Friday or a Saturday. */
export function isWorkingDay(day: string): boolean {
  const time = parse(day);
  if (Number.isNaN(time)) return false;
  return !WEEKEND_DAYS.has(new Date(time).getUTCDay());
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
export function workingDaysBetween(from: string, to: string): number {
  const start = parse(from);
  const end = parse(to);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;

  let elapsed = 0;
  for (let time = start + MS_PER_DAY; time <= end; time += MS_PER_DAY) {
    if (!WEEKEND_DAYS.has(new Date(time).getUTCDay())) elapsed += 1;
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
export function shiftWorkingDays(day: string, workingDays: number): string {
  const start = parse(day);
  if (Number.isNaN(start) || workingDays <= 0) return day;

  let time = start;
  let remaining = workingDays;
  while (remaining > 0) {
    time -= MS_PER_DAY;
    if (!WEEKEND_DAYS.has(new Date(time).getUTCDay())) remaining -= 1;
  }
  return new Date(time).toISOString().slice(0, 10);
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
