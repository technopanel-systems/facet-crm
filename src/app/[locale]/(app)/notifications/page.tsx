import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import {
  listNotifications,
  sweepNotifications,
  RESOLUTION_RULES,
  type NotificationRow,
} from "@/lib/notifications";

import { anchorHref } from "../_components/anchors";
import { ListPagination } from "../_components/list-controls";
import { markAllReadAction, markReadAction } from "./actions";
import { MarkReadButton } from "./mark-read-button";

export const dynamic = "force-dynamic";

/**
 * Notifications `[07 E5]`, `[07 G1]`, `[21 §2]`.
 *
 * **Two tiers, shown apart.** Act-now is what is waiting on you and sits above;
 * the daily digest of what went stale sits below and does not interrupt.
 * Without the split reps mute everything and miss what mattered.
 *
 * **The sweep runs on read** `[16 §3]`, exactly as quotation expiry does on a
 * quotation list: FACET has no scheduler, this is the commonest read, and it is
 * the same function a scheduled job will call. It writes nothing when nothing
 * is due.
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

  await sweepNotifications();

  const currentPage = Number(page) || 1;
  const { rows, total } = await listNotifications(session, {
    page: currentPage,
  });

  // `row.waiting` is the one definition `[21 §4]`, in `src/lib/notifications.ts`
  // beside the badge's own query. The rule used to be spelled out here and on
  // the Today screen, which is two places for it to drift from the badge — and
  // it had: both counted a non-persistent act-now entry forever, because
  // nothing resolves one and reading it changed nothing.
  const waiting = rows.filter((row) => row.waiting);
  const rest = rows.filter((row) => !row.waiting);
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
          {/* The concept's two columns `[22 §3]`, and the split is already the
              right one: act-now is what the reader owes, the digest is what
              merely happened `[07 G1]`. Act-now takes the wide side. */}
          <div className="grid items-start gap-4 lg:grid-cols-[1.25fr_1fr]">
            {waiting.length > 0 ? (
              <Card data-slot="notifications-act-now">
                <CardHeader>
                  <CardTitle>{t("notifications.detail.actNow")}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {waiting.map((row) => (
                    <NotificationEntry
                      key={row.id}
                      row={row}
                      t={t}
                      format={format}
                    />
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {rest.length > 0 ? (
              <Card data-slot="notifications-digest">
                <CardHeader>
                  <CardTitle>{t("notifications.detail.digest")}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {rest.map((row) => (
                    <NotificationEntry
                      key={row.id}
                      row={row}
                      t={t}
                      format={format}
                    />
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>

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

  // `21 §3` — every persistent type states how it clears, for every anchor it
  // can carry. A badge with no stated way out is the failure `21 §4` forbids.
  const rule = RESOLUTION_RULES.find(
    (candidate) =>
      candidate.typeKey === row.typeKey &&
      candidate.anchorType === row.anchorType,
  );

  return (
    <div className="flex flex-col gap-1 border-s-2 ps-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-start text-sm font-medium">{title}</span>
        {row.resolvedAt ? (
          <Badge variant="secondary">{t("notifications.fields.done")}</Badge>
        ) : row.waiting ? (
          <Badge variant="destructive">
            {t("notifications.fields.waiting")}
          </Badge>
        ) : null}
        {!row.readAt ? (
          <Badge variant="outline">{t("notifications.fields.unread")}</Badge>
        ) : null}
      </div>

      {/* The anchor is a link only while the viewer may still open it
          `[20 §8.2]`: a share can be revoked and a company can be handed on,
          and the notification row outlives either. */}
      {row.anchorId ? (
        row.anchorViewable ? (
          <Link
            href={anchorHref(row.anchorType ?? "company", row.anchorId ?? "")}
            className="text-start text-sm hover:underline"
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
                  {excerpt(row.payload.body)}
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

      {row.digestDate ? (
        <p className="text-muted-foreground text-start text-sm">
          {t("notifications.detail.digestSummary", {
            total: Object.values(row.digestCounts ?? {}).reduce(
              (sum, n) => sum + n,
              0,
            ),
            date: row.digestDate,
          })}{" "}
          <Link href="/follow-ups" className="hover:underline">
            {t("notifications.detail.digestLink")}
          </Link>
        </p>
      ) : null}

      {row.isPersistent && !row.resolvedAt ? (
        <p className="text-muted-foreground text-start text-xs">
          {t("notifications.detail.persistent")}
          {rule
            ? ` ${
                rule.rule === "thread_no_longer_expired"
                  ? t("notifications.detail.clearsThreadNoLongerExpired")
                  : t("notifications.detail.clearsInteractionAgainstCompany")
              }`
            : ""}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-muted-foreground text-start text-xs" dir="ltr">
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
