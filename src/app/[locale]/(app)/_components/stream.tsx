import { getFormatter, getTranslations } from "next-intl/server";

import { TimelineRow } from "@/components/timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { REPORT_OUTCOMES, REPORT_SIGNALS } from "@/lib/enums";
import type { TimelineEvent } from "@/lib/timeline";

/**
 * The stream `D45` — *"what happened" is one stream, not five screens*.
 *
 * Two pieces: the filters that go **down the side**, which is `D45`'s own
 * word and the only reason this screen is not the plain full-width list every
 * other `D24` List is; and the events themselves, **grouped by day**.
 *
 * `D24` asks a list to be grouped and never flat, with headers naming the
 * group and its count. `D25` decides the group for the four record lists it
 * names and decides nothing here, because a stream is a list of **events**
 * rather than of records: an event is a thing that already happened, so it
 * owes nobody a move and `D2` has nothing to ask of it. What a reader of this
 * screen is doing is reading a day — `S42` makes it what a manager reads as
 * the daily report — so the day is the group.
 */

export type StreamQuery = {
  view?: string;
  kind?: string;
  who?: string;
  outcome?: string;
  signal?: string;
  from?: string;
  to?: string;
  q?: string;
};

/**
 * Every filter a link must carry, minus the one the control is about to set.
 *
 * `q` is always removed because `FilterNav` and `ListCard` take the search as
 * their own argument; handing it twice would put `?q=` in the URL twice.
 * `D59` is why this exists at all: a chip linking to a bare `?kind=` throws
 * the rest of the narrowing away, and the list silently returns other rows.
 */
export function withoutKey(
  query: StreamQuery,
  drop?: keyof StreamQuery,
): Record<string, string | undefined> {
  const rest: Record<string, string | undefined> = { ...query };
  if (drop) delete rest[drop];
  delete rest.q;
  return rest;
}

/**
 * The filter column `D45`.
 *
 * **One GET form, native controls, no JavaScript** `D20`: every field is a
 * `<select>`, a `<input type="date">` or a search box, and the whole thing
 * submits to the same route. Turn scripts off and a person can still narrow
 * the stream, which is the sentence `D20` asks.
 *
 * `view` rides along as a hidden input so narrowing the stream does not drop
 * you back to the other arrangement — the same reason `SearchForm` carries its
 * filters `D59`.
 */
export async function StreamFilters({
  query,
  people,
  selfId,
}: {
  query: StreamQuery;
  /** Whoever this identity may read `visibleMeasuredUsersFilter`. */
  people: { id: string; name: string }[];
  selfId: string;
}) {
  const t = await getTranslations();

  const justMe = new URLSearchParams();
  for (const [key, value] of Object.entries(withoutKey(query, "who"))) {
    if (value) justMe.set(key, value);
  }
  if (query.q) justMe.set("q", query.q);
  justMe.set("who", selfId);

  return (
    <form
      method="get"
      data-slot="stream-filters"
      className="card-face glass flex flex-col gap-4 p-4"
    >
      {query.view ? (
        <input type="hidden" name="view" value={query.view} />
      ) : null}

      <p className="text-faint text-start text-[10.5px] font-semibold tracking-wider uppercase">
        {t("activity.filters.title")}
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="q" className="text-start">
          {t("common.search")}
        </Label>
        <Input
          id="q"
          type="search"
          name="q"
          defaultValue={query.q ?? ""}
          placeholder={t("activity.searchPlaceholder")}
          className="text-start"
        />
      </div>

      {/* `D45`'s *who*. One person is no choice, so the control is absent
          rather than a select with a single option `D51`. */}
      {people.length > 1 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="who" className="text-start">
            {t("activity.filters.who")}
          </Label>
          <SelectField
            id="who"
            name="who"
            value={query.who}
            placeholder={t("activity.filters.anyone")}
            options={people.map((person) => ({
              value: person.id,
              label: person.name,
            }))}
          />
        </div>
      ) : null}

      {/* `D30` — *"Just me" is a filter chip on the stream, not a separate
          screen.* It carries every other filter and the search `D59`. */}
      <Button asChild size="xs" variant={query.who === selfId ? "secondary" : "ghost"}>
        <Link
          href={`/activity?${justMe.toString()}`}
          aria-current={query.who === selfId ? "true" : undefined}
        >
          {t("activity.filters.justMe")}
        </Link>
      </Button>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="outcome" className="text-start">
          {t("activity.filters.outcome")}
        </Label>
        <SelectField
          id="outcome"
          name="outcome"
          value={query.outcome}
          placeholder={t("activity.filters.anyOutcome")}
          options={REPORT_OUTCOMES.map((outcome) => ({
            value: outcome,
            label: t(`enums.reportOutcome.${outcome}`),
          }))}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signal" className="text-start">
          {t("activity.filters.signal")}
        </Label>
        <SelectField
          id="signal"
          name="signal"
          value={query.signal}
          placeholder={t("activity.filters.anySignal")}
          options={REPORT_SIGNALS.map((signal) => ({
            value: signal,
            label: t(`enums.reportSignal.${signal}`),
          }))}
        />
      </div>

      {/* Both or neither: `streamFor` treats a half-given range as no range,
          so offering one alone would be a control that silently does nothing
          — which is what `D51` refuses. Said here rather than discovered. */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="from" className="text-start">
          {t("activity.fields.from")}
        </Label>
        <Input
          id="from"
          name="from"
          type="date"
          dir="ltr"
          className="num text-start"
          defaultValue={query.from ?? ""}
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
          className="num text-start"
          defaultValue={query.to ?? ""}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" variant="secondary">
          {t("common.apply")}
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link href={query.view ? `/activity?view=${query.view}` : "/activity"}>
            {t("common.clear")}
          </Link>
        </Button>
      </div>
    </form>
  );
}

/**
 * A native `<select>` with a blank first option `D20`.
 *
 * Its own small component rather than the shared `SelectField` from
 * `form-field.tsx`: that one belongs to `FormShell` and carries a field label,
 * an error slot and a required marker, none of which a filter has.
 */
async function SelectField({
  id,
  name,
  value,
  placeholder,
  options,
}: {
  id: string;
  name: string;
  value?: string;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={value ?? ""}
      className="border-line bg-surface-2 h-9 rounded-[10px] border px-2 text-start text-[13px]"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** One day's events, and how many of them there were. */
function groupByDay(events: TimelineEvent[]): [string, TimelineEvent[]][] {
  const days = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const bucket = days.get(event.day);
    if (bucket) bucket.push(event);
    else days.set(event.day, [event]);
  }
  // `gather` already sorted newest first, so insertion order is the order.
  return [...days.entries()];
}

/**
 * The events, grouped by day `D24`.
 *
 * The header is a **baseline flex row with a `gap`**, never a margin on the
 * count: `margin-inline-*` resolves against the element's own direction, and
 * the count carries `dir="ltr"` `D62`, so `ms-*` puts its gap on the count's
 * outer edge and the number touches the date in Arabic. Three lists were fixed
 * of exactly this in session 28.
 */
export async function StreamList({
  events,
  subjects,
}: {
  events: TimelineEvent[];
  subjects: Map<string, string>;
}) {
  const format = await getFormatter();

  return (
    <ul className="flex flex-col px-4 pt-1 pb-2">
      {groupByDay(events).map(([day, entries]) => (
        <li key={day} data-slot="stream-day" className="flex flex-col">
          <p className="text-faint mt-3 mb-0.5 flex items-baseline gap-1.5 text-start text-[10.5px] font-semibold">
            {/* A calendar day in Riyadh, not an instant. */}
            <span className="num" dir="ltr">
              {format.dateTime(new Date(`${day}T00:00:00Z`), {
                dateStyle: "medium",
                timeZone: "UTC",
              })}
            </span>
            <span aria-hidden="true">·</span>
            <span className="num" dir="ltr">
              {entries.length}
            </span>
          </p>
          <ul className="flex flex-col">
            {entries.map((event) => (
              <TimelineRow
                key={event.key}
                event={event}
                subject={subjects.get(event.key)}
              />
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
