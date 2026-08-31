import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatSqm } from "@/lib/decimal";
import { streamKindOf, type TimelineEvent, type TimelineLink } from "@/lib/timeline";

/**
 * The customer timeline `[20 §6]` — the rep's payoff for logging.
 *
 * A server component: it renders what `timeline.ts` already resolved and asks
 * no permission question of its own. Every event in `events` has already passed
 * its own source's filter.
 *
 * **The cap is stated, never silent.** When `total` exceeds what is shown the
 * card says so and links to the full history. A card capped at twenty with
 * nothing behind it would break the one case this phase exists for — a rep
 * inheriting a company with years of history.
 */
export async function Timeline({
  events,
  total,
  title,
  action,
  composer,
  fullHistoryHref,
}: {
  events: TimelineEvent[];
  total: number;
  /** Already translated; the full-history page passes its own. */
  title?: string;
  /** The Log button, when there is a company to log against. */
  action?: React.ReactNode;
  /**
   * The comment box `[25 §9]`. It sits inside the card rather than beside it
   * because there is **one thread per record**: a separate Comments card would
   * be a second place to look for the same conversation.
   */
  composer?: React.ReactNode;
  fullHistoryHref?: string;
}) {
  const t = await getTranslations();

  return (
    // `data-total` is `D70`'s *states its total* made assertable: the card says
    // it in a translated sentence, which a black-box script may not read, and
    // counting the rendered rows cannot tell a capped card from a short one.
    <Card data-slot="timeline-card" data-total={String(total)}>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-start text-sm">
          {title ?? t("timeline.title")}
        </CardTitle>
        <div className="flex items-center gap-2">
          {fullHistoryHref && total > events.length ? (
            <Button asChild size="xs" variant="ghost">
              <Link href={fullHistoryHref}>{t("timeline.viewAll")}</Link>
            </Button>
          ) : null}
          {action}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {events.length === 0 ? (
          <p className="text-muted-foreground text-start text-sm">
            {t("timeline.empty")}
          </p>
        ) : (
          <div>
            <ul className="flex flex-col">
              {events.map((event) => (
                <TimelineRow key={event.key} event={event} />
              ))}
            </ul>
            {total > events.length ? (
              <p className="text-muted-foreground mt-3 text-start text-xs">
                {t("timeline.showingRecent", {
                  shown: events.length,
                  total,
                })}
              </p>
            ) : null}
          </div>
        )}
        {composer}
      </CardContent>
    </Card>
  );
}

/**
 * One event, wherever it is read.
 *
 * **Exported since session 27** `D45`: *a record's timeline is the same
 * stream, scoped to that record*, so the stream and the two `[id]/timeline`
 * routes render the same row and there is no second one to keep in step.
 *
 * `subject` is the only thing that differs. A timeline is already inside its
 * record and names it in the page title; the stream is inside nothing, so it
 * passes what the event is about and this renders it. Absent, the row is
 * exactly what it was.
 */
export async function TimelineRow({
  event,
  subject,
}: {
  event: TimelineEvent;
  /** What the event is about — already resolved. Stream only. */
  subject?: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();
  const locale = await getLocale();

  // A `date` column is a calendar day in Riyadh, not an instant.
  const day = format.dateTime(new Date(`${event.day}T00:00:00Z`), {
    dateStyle: "medium",
    timeZone: "UTC",
  });

  if (event.kind === "comment") {
    return <CommentRow event={event} day={day} subject={subject} t={t} />;
  }

  const label = t(`enums.timelineEvent.${event.kind}`);
  const href = hrefFor(event.link);

  /**
   * A field note names no customer `S33`, so where every other event puts its
   * company this puts the city the work happened in — the one thing `S33`
   * gives it besides the category, which is already the `detail` beside the
   * badge. Without it the row reads *Report · Market research* and says
   * nothing about where anybody went.
   */
  const fieldNoteCity =
    event.kind === "report" && event.report.entryType === "field_note"
      ? (locale === "ar" ? event.report.cityNameAr : event.report.cityNameEn)
      : null;
  const named = subject ?? fieldNoteCity ?? null;

  /**
   * `S38` puts signals in the SHARED half — *whoever can see the record*, the
   * same audience as the outcome beside them — so they render wherever the
   * event does. They are also what makes `D45`'s *signals raised* filter
   * legible: filtering to one and seeing which row carries it.
   */
  const signals = event.kind === "report" ? event.report.signals : [];

  // `RecordRow`'s shape, hand-written: a timeline entry leads with its badge,
  // which the shared row has no slot for. Everything else matches — the same
  // border, the same padding, the same end-aligned mono date — so the two read
  // as one component in a card that holds both.
  return (
    <li
      // `D70` — the card caps at `TIMELINE_CARD_LIMIT` and states its total,
      // and `verify:routes` §21 counts these to prove it. A black-box script
      // may not read a translated badge, so the countable thing is a marker.
      //
      // **Its own attribute, not a second `data-slot` value.** `data-slot` is
      // one name per element everywhere in this codebase, and the comment row
      // below already owns one that two sections assert on exactly.
      data-timeline-event=""
      // `D45`'s three kinds, and the entry type under `typed`, as markers.
      // `verify:routes` §25 counts them: a translated badge is unreadable to a
      // black-box script, and `D3` — *a field note reaches no timeline* — can
      // only be shown closed by finding one in the stream.
      data-stream-kind={streamKindOf(event.kind)}
      // **The SIX kinds beside `D45`'s three.** `streamKindOf` folds five of
      // them into `observed`, so the three cannot tell that a whole source has
      // stopped arriving — which is how `company_added` was missing from the
      // default stream unnoticed `S45-7`.
      data-event-kind={event.kind}
      data-entry-type={
        event.kind === "report" ? event.report.entryType : undefined
      }
      className="border-line flex items-center gap-3 border-b py-2.5 last:border-b-0"
    >
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1 text-start">
        <Badge variant={event.kind === "report" ? "secondary" : "outline"}>
          {label}
        </Badge>
        {/* `dir="auto"` on the NAME `D62` — never on the row, which also
            holds a badge, a date and a count. */}
        {named ? (
          <span className="text-sm font-medium" dir="auto">
            {named}
          </span>
        ) : null}
        {href ? (
          <Link href={href} className="text-sm hover:underline">
            {detailText(event, t)}
          </Link>
        ) : (
          <span className="text-sm">{detailText(event, t)}</span>
        )}
        {signals.map((signal) => (
          <Badge key={signal.signal} variant="outline">
            {t(`enums.reportSignal.${signal.signal}`)}
          </Badge>
        ))}
      </span>
      <span className="text-faint flex-none text-[11.5px]">
        {/* No `dir` on the date: the ar formatter embeds U+200F marks that
            place its segments, and `dir="ltr"` fights them — the scramble
            `98f1e2e` measured on the dispatch date. Bare is the fix `D73`. */}
        <span className="num">{day}</span>
        {event.actorName ? (
          <span className="ms-2">
            {t("timeline.byWhom", { name: event.actorName })}
          </span>
        ) : null}
      </span>
    </li>
  );
}

/**
 * A comment on the thread `[25 §9]`.
 *
 * It is the one kind whose content is the event rather than a detail of it, so
 * it gets the body on its own line instead of a label beside a badge. Everything
 * else is the row above — same border, same padding, same end-aligned date — so
 * the conversation reads as part of the timeline rather than as a second widget
 * inside it.
 *
 * The `id` is what a mention notification's link lands on `[25 §11]`.
 */
async function CommentRow({
  event,
  day,
  subject,
  t,
}: {
  event: TimelineEvent & { kind: "comment" };
  day: string;
  subject?: string;
  t: Translate;
}) {
  const { comment } = event;

  return (
    <li
      id={`comment-${comment.id}`}
      // A comment IS a timeline entry and counts toward `D70`'s cap, so it
      // carries the same marker as every other row — and keeps its own
      // `data-slot`, which sections 9 and 14 assert on.
      data-timeline-event=""
      data-stream-kind="said"
      data-event-kind="comment"
      data-slot="comment"
      className="border-line flex flex-col gap-1 border-b py-2.5 last:border-b-0"
    >
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-start">
        <Badge variant="outline">{t("enums.timelineEvent.comment")}</Badge>
        {subject ? (
          <span className="text-sm font-medium" dir="auto">
            {subject}
          </span>
        ) : null}
        <span className="text-faint text-[11.5px]">
          {/* Bare like the row above — `dir="ltr"` scrambles the ar date. */}
          <span className="num">{day}</span>
          {event.actorName ? (
            <span className="ms-2">
              {t("timeline.byWhom", { name: event.actorName })}
            </span>
          ) : null}
          {comment.editedAt ? (
            <span className="ms-2">{t("comments.edited")}</span>
          ) : null}
        </span>
      </span>

      {/* The author's own words. `whitespace-pre-wrap` because a colleague
          writing two paragraphs meant two paragraphs, and `break-words` because
          nothing stops them pasting a SMAC reference with no spaces in it. */}
      <p className="text-start text-sm whitespace-pre-wrap wrap-break-word">
        {comment.body}
      </p>

      {comment.mentions.length > 0 ? (
        <p className="text-faint text-start text-[11.5px]">
          {t("comments.taggedPeople", {
            names: comment.mentions.map((person) => person.name).join(", "),
          })}
        </p>
      ) : null}

      {/* Editable by the author, never deleted `[25 §12]`. Nobody else is
          offered the link, and the server refuses it besides. */}
      {comment.canEdit ? (
        <span className="text-start">
          <Link
            href={`/comments/${comment.id}/edit`}
            className="text-faint text-[11.5px] hover:underline"
          >
            {t("common.edit")}
          </Link>
        </span>
      ) : null}
    </li>
  );
}

type Translate = Awaited<ReturnType<typeof getTranslations>>;

/**
 * What the row says beside its badge.
 *
 * A report shows its outcome or its category; the derived events show whatever
 * the source row carries — a SMAC reference, square metres — and an em dash
 * where it carries nothing, rather than collapsing to an empty link.
 */
function detailText(event: TimelineEvent, t: Translate): string {
  if (!event.detail) return t("common.none");
  if (event.kind === "report") {
    // One of the two is always set `[rep_reports_shape]`; try both.
    const outcome = `enums.reportOutcome.${event.detail}`;
    const category = `enums.fieldNoteCategory.${event.detail}`;
    return t.has(outcome)
      ? t(outcome)
      : t.has(category)
        ? t(category)
        : event.detail;
  }
  if (event.kind === "dispatched") return `${formatSqm(event.detail)} ${t("common.sqm")}`;
  return event.detail;
}

function hrefFor(link: TimelineLink | null): string | null {
  if (!link) return null;
  switch (link.type) {
    case "report":
      return `/reports/${link.id}`;
    case "company":
      return `/companies/${link.id}`;
    case "contact":
      return `/contacts/${link.id}`;
    case "quotation":
      return `/quotations/${link.id}`;
    case "dispatch":
      return `/dispatches/${link.id}`;
    // A comment has no page of its own — the thread on the record is where it
    // lives `[25 §9]` — so its only route is the author's own edit screen,
    // which `CommentRow` renders behind `canEdit` `[25 §12]`.
    case "comment":
      return `/comments/${link.id}/edit`;
  }
}
