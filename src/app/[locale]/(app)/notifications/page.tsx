import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import { listNotifications, type NotificationRow } from "@/lib/notifications";

import { anchorHref } from "../_components/anchors";
import { ListPagination } from "../_components/list-controls";
import { markAllReadAction, markReadAction } from "./actions";
import { MarkReadButton } from "./mark-read-button";

export const dynamic = "force-dynamic";

/**
 * The bell `S92` — **news only, never work**, in **one list**, newest first.
 *
 * **What `S91` took off this screen.** It was two cards side by side: *Waiting
 * on you* on the wide side and *Daily summary* on the narrow one, `07 E5`'s two
 * tiers shown apart. Both halves are gone — there is no digest to summarise and
 * no tier to sort by — and with them the *Waiting* and *Done* badges, which
 * read `resolved_at`, and the per-row line saying how a persistent entry would
 * clear, which read `RESOLUTION_RULES`. **Every one of the six types is
 * something that has already happened to the reader**, so *Unread* is the only
 * state a row can be in, and reading it is the only thing to do.
 *
 * **The screen no longer writes on a read.** `sweepNotifications()` ran here on
 * every request because FACET has no scheduler; it resolved conditions and
 * generated digests, and `S91` deletes both. Marking read is still a write and
 * still a POST — what changed is that opening the page is now only a read.
 *
 * **The work is not here and never was.** It is on `S87`'s list, on `/`, which
 * is the sentence `S91` is. `D64` says the same thing about this screen's old
 * block on the dashboard: twenty-five rows of news where work belonged.
 *
 * **Not gated.** A notification is addressed to one person, so the page needs
 * no permission and no visibility filter beyond that — the recipient term lives
 * in every statement's own `WHERE` `[00 §1.13]`.
 */
export default async function NotificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { page } = await searchParams;

  const session = await requireSession();
  const t = await getTranslations();
  const format = await getFormatter();

  const currentPage = Number(page) || 1;
  const { rows, total } = await listNotifications(session, {
    page: currentPage,
  });

  // The one state a row can be in, and the one the badge counts `unreadCount`.
  // There is deliberately no second partition here: the two this screen used to
  // make — waiting/done and act-now/digest — each read a column `S91` deletes,
  // and a screen re-deriving a division the data layer no longer makes is how
  // the badge and the list drifted apart the first time.
  const hasUnread = rows.some((row) => !row.readAt);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("notifications.title")}
        description={t("notifications.detail.hint")}
        action={
          hasUnread ? (
            <MarkReadButton action={markAllReadAction} label="markAllRead" />
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {t("notifications.empty")}
        </p>
      ) : (
        <>
          {/* **One card, one column.** It was `22 §3`'s two — act-now on the
              wide side, the digest on the narrow — and that split was the
              screen's whole shape. `S91` leaves one kind of thing, so a grid
              holding one child would be scaffolding for a second that cannot
              arrive. No card header either: a lone card headed *News* on a page
              titled *Notifications* says it twice `D21`. */}
          {/* `data-total` is the whole scope, not the page — `ListCard`
              carries one for the same reason and this screen uses a bare
              `ListPagination`, which does not. §29 prints what it read against
              it, so a negative cannot pass over a page that rendered nothing. */}
          <Card data-slot="notifications-news" data-total={String(total)}>
            <CardContent className="flex flex-col gap-4">
              {rows.map((row) => (
                <NotificationEntry
                  key={row.id}
                  row={row}
                  t={t}
                  format={format}
                />
              ))}
            </CardContent>
          </Card>

          <ListPagination
            basePath="/notifications"
            page={currentPage}
            total={total}
          />
        </>
      )}
    </div>
  );
}

type Translator = Awaited<ReturnType<typeof getTranslations>>;
type Formatter = Awaited<ReturnType<typeof getFormatter>>;

/**
 * The first line or so of a comment, for the notification only.
 *
 * A comment runs to `COMMENT_BODY_MAX`, and this list is a bell, not a reading
 * surface — the thread on the record is where the whole thing lives `[25 §9]`.
 * The ellipsis is a character rather than a translated string because it is
 * punctuation, not a message.
 */
const MENTION_EXCERPT = 140;

function excerpt(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > MENTION_EXCERPT
    ? `${flat.slice(0, MENTION_EXCERPT)}…`
    : flat;
}

function NotificationEntry({
  row,
  t,
  format,
}: {
  row: NotificationRow;
  t: Translator;
  format: Formatter;
}) {
  const title = row.typeName
    ? t(`enums.notificationType.${row.typeName}`)
    : row.typeKey;

  return (
    // The handle `verify:routes` §29 counts, so its negatives — no digest card,
    // no act-now card, no link into the working list — guard on a non-empty
    // read rather than passing on a page that rendered nothing `CLAUDE.md`.
    <div
      data-slot="notification-entry"
      className="flex flex-col gap-1 border-s-2 ps-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-start text-sm font-medium">{title}</span>
        {/* The only badge left. *Done* read `resolved_at` and *Waiting* read
            the tier and the persistence flag; `S91` deletes all three. */}
        {!row.readAt ? (
          <Badge variant="outline">{t("notifications.fields.unread")}</Badge>
        ) : null}
      </div>

      {/* The anchor is a link only while the viewer may still open it
          `[20 §8.2]`: a share can be revoked and a company can be handed on,
          and the notification row outlives either. */}
      {row.anchorType && row.anchorId ? (
        row.anchorViewable ? (
          <Link
            // **No `??` fallbacks.** `anchorType` was defaulted to `"company"`
            // and `anchorId` to `""` because the database allowed a half-filled
            // pair; `0033`'s `notifications_record_pair` CHECK makes that row
            // impossible, so the guard above narrows both and a screen no
            // longer guesses at a record type `AUDIT 1 E2`.
            href={anchorHref(row.anchorType, row.anchorId)}
            className="text-start text-sm hover:underline"
            dir="auto"
          >
            {row.anchorLabel ?? t("common.view")}
          </Link>
        ) : (
          <span className="text-muted-foreground text-start text-sm">
            {t("notifications.detail.anchorHidden")}
          </span>
        )
      ) : null}

      {row.payload?.kind === "handover" ? (
        <p className="text-muted-foreground text-start text-sm">
          {row.payload.fromUserName
            ? t("notifications.detail.handover", {
                name: row.payload.fromUserName,
                companies: row.payload.counts.companies,
                projects: row.payload.counts.projects,
                threads: row.payload.counts.quotationThreads,
              })
            : t("notifications.detail.handoverUnknown")}
        </p>
      ) : null}

      {/* `25 §11` — a mention carries no anchor, so the record and the link
          come out of the payload. The record is re-checked on read, and when
          it fails the entry still shows: what happened is not a secret from
          the person it happened to, it simply carries no body and no link. */}
      {row.payload?.kind === "mention" ? (
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-start text-sm">
            {row.payload.authorName
              ? t("notifications.detail.mention", {
                  name: row.payload.authorName,
                })
              : t("notifications.detail.mentionUnknown")}
          </p>
          {row.payload.recordViewable && row.payload.href ? (
            <>
              {row.payload.body ? (
                <p className="text-start text-sm">
                  {/* `<bdi>`, not `dir` on the `p`: the block keeps the
                      page's direction and alignment while the free-text run
                      isolates its own `D62`. */}
                  <bdi>{excerpt(row.payload.body)}</bdi>
                </p>
              ) : null}
              <Link
                href={row.payload.href}
                className="text-start text-sm hover:underline"
              >
                {t("notifications.detail.mentionLink")}
              </Link>
            </>
          ) : (
            <span className="text-muted-foreground text-start text-sm">
              {t("notifications.detail.anchorHidden")}
            </span>
          )}
        </div>
      ) : null}

      {/* `S128` — **the reason is rendered whichever way the record came out.**
          *Where the person told cannot see the record, the message carries the
          reason and stands alone. It is not a link into something they cannot
          open.* That is the rule's own named exception to `S112`, and it is why
          this branch differs from the mention above: a mention withholds its
          body when the record is closed, because a comment is the record's
          content. A reason for ending somebody's work is theirs. */}
      {row.payload?.kind === "decision" ? (
        <div className="flex flex-col gap-1" data-decision={row.payload.decision}>
          {/* `S128`, session 55 — the five company decisions name the company
              (and a merge's other side) whether or not the record is
              viewable; the names are the reader's own former customers'. Each
              is a stored value in either script, so it is isolated in a
              `<bdi>` `D62` rather than the sentence taking a `dir`. */}
          <p className="text-muted-foreground text-start text-sm">
            {t.rich(
              row.payload.decidedByName
                ? `notifications.detail.decision.${row.payload.decision}`
                : `notifications.detail.decisionUnknown.${row.payload.decision}`,
              {
                name: row.payload.decidedByName ?? "",
                company: () => (
                  <bdi data-decision-company>
                    {row.payload?.kind === "decision"
                      ? (row.payload.companyName ?? t("common.unknownRecord"))
                      : ""}
                  </bdi>
                ),
                other: () => (
                  <bdi data-decision-other>
                    {row.payload?.kind === "decision"
                      ? (row.payload.otherCompanyName ?? t("common.unknownRecord"))
                      : ""}
                  </bdi>
                ),
              },
            )}
          </p>
          {/* `dir="auto"` came OFF this block — `A2-14`'s sighting: the
              attribute resolved the paragraph's direction from the VALUE, and
              `text-start` followed it, so a Latin reason slammed to the far
              edge of the RTL card, a column from its sentence. The `<bdi>`
              isolates the run; the block keeps the page's direction. */}
          {/* An act with no written reason — a reassignment, a merge, a keep
              with no note — prints no empty line `D70`. */}
          {row.payload.reason ? (
            <p
              className="text-start text-sm whitespace-pre-wrap"
              data-decision-reason
            >
              <bdi>{row.payload.reason}</bdi>
            </p>
          ) : null}
          {row.payload.recordViewable && row.payload.href ? (
            <Link
              href={row.payload.href}
              className="text-start text-sm hover:underline"
            >
              {t("notifications.detail.decisionLink")}
            </Link>
          ) : (
            <span className="text-muted-foreground text-start text-sm">
              {t("notifications.detail.decisionStandsAlone")}
            </span>
          )}
        </div>
      ) : null}

      {/* `S129` — a share of someone else's credit. The **ordinary** `S112`
          rule here, not `S128`'s exception: that one is written for credit
          taken back, and this is credit given. A rep given a share need not
          hold the project `S30`, so the name and the link are present only
          while `canOpenRecord` passes — the mention branch's shape exactly.
          The percentage and the date are the rep's own credit rather than the
          project's data, so they are shown either way. */}
      {row.payload?.kind === "credit" ? (
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-start text-sm">
            {row.payload.setByName
              ? t("notifications.detail.credit", {
                  name: row.payload.setByName,
                  percentage: row.payload.percentage,
                })
              : t("notifications.detail.creditUnknown", {
                  percentage: row.payload.percentage,
                })}
          </p>
          <p className="text-muted-foreground text-start text-sm">
            {/* A raw `yyyy-mm-dd` is a reference and keeps `ltr` `D73` — on
                the run, never the block, which would drag its alignment. */}
            <span className="num" dir="ltr">
              {row.payload.effectiveFrom}
            </span>
          </p>
          {row.payload.recordViewable && row.payload.href ? (
            <Link
              href={row.payload.href}
              className="text-start text-sm hover:underline"
              dir="auto"
            >
              {row.payload.projectName}
            </Link>
          ) : (
            <span className="text-muted-foreground text-start text-sm">
              {t("notifications.detail.anchorHidden")}
            </span>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {/* No `dir` — the ar date+time carries U+200F marks that place its
            own segments, and `dir="ltr"` scrambled them (A2-1, `98f1e2e`). */}
        <span className="text-muted-foreground text-start text-xs">
          {format.dateTime(row.createdAt, {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Riyadh",
          })}
        </span>
        {!row.readAt ? (
          <MarkReadButton
            action={markReadAction}
            label="markRead"
            notificationId={row.id}
          />
        ) : null}
      </div>
    </div>
  );
}
