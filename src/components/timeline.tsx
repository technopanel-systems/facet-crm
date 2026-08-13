import { getFormatter, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { TimelineEvent, TimelineLink } from "@/lib/timeline";

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
    <Card>
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

async function TimelineRow({ event }: { event: TimelineEvent }) {
  const t = await getTranslations();
  const format = await getFormatter();

  // A `date` column is a calendar day in Riyadh, not an instant.
  const day = format.dateTime(new Date(`${event.day}T00:00:00Z`), {
    dateStyle: "medium",
    timeZone: "UTC",
  });

  if (event.kind === "comment") {
    return <CommentRow event={event} day={day} t={t} />;
  }

  const label = t(`enums.timelineEvent.${event.kind}`);
  const href = hrefFor(event.link);

  // `RecordRow`'s shape, hand-written: a timeline entry leads with its badge,
  // which the shared row has no slot for. Everything else matches — the same
  // border, the same padding, the same end-aligned mono date — so the two read
  // as one component in a card that holds both.
  return (
    <li className="border-line flex items-center gap-3 border-b py-2.5 last:border-b-0">
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1 text-start">
        <Badge variant={event.kind === "report" ? "secondary" : "outline"}>
          {label}
        </Badge>
        {href ? (
          <Link href={href} className="text-sm hover:underline">
            {detailText(event, t)}
          </Link>
        ) : (
          <span className="text-sm">{detailText(event, t)}</span>
        )}
      </span>
      <span className="text-faint flex-none text-[11.5px]">
        <span className="num" dir="ltr">
          {day}
        </span>
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
  t,
}: {
  event: TimelineEvent & { kind: "comment" };
  day: string;
  t: Translate;
}) {
  const { comment } = event;

  return (
    <li
      id={`comment-${comment.id}`}
      data-slot="comment"
      className="border-line flex flex-col gap-1 border-b py-2.5 last:border-b-0"
    >
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-start">
        <Badge variant="outline">{t("enums.timelineEvent.comment")}</Badge>
        <span className="text-faint text-[11.5px]">
          <span className="num" dir="ltr">
            {day}
          </span>
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
  if (event.kind === "dispatched") return `${event.detail} ${t("common.sqm")}`;
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
