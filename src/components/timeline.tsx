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
  fullHistoryHref,
}: {
  events: TimelineEvent[];
  total: number;
  /** Already translated; the full-history page passes its own. */
  title?: string;
  /** The Log button, when there is a company to log against. */
  action?: React.ReactNode;
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
      <CardContent>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-start text-sm">
            {t("timeline.empty")}
          </p>
        ) : (
          <>
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
          </>
        )}
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

  const label = t(`enums.timelineEvent.${event.kind}`);
  const href = hrefFor(event.link);

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b py-2.5 last:border-b-0">
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
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
      <span className="text-muted-foreground text-xs">
        <span dir="ltr">{day}</span>
        {event.actorName ? (
          <span className="ms-2">
            {t("timeline.byWhom", { name: event.actorName })}
          </span>
        ) : null}
      </span>
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
    case "quotation":
      return `/quotations/${link.id}`;
    case "dispatch":
      return `/dispatches/${link.id}`;
  }
}
