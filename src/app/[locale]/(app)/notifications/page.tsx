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

  const waiting = rows.filter(
    (row) => row.tier === "act_now" && !row.resolvedAt,
  );
  const rest = rows.filter((row) => !waiting.includes(row));
  const hasUnread = rows.some((row) => !row.readAt);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
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
          {waiting.length > 0 ? (
            <Card>
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
            <Card>
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

          <ListPagination
            basePath="/notifications"
            page={currentPage}
            total={total}
          />
        </>
      )}
    </main>
  );
}

type Translator = Awaited<ReturnType<typeof getTranslations>>;
type Formatter = Awaited<ReturnType<typeof getFormatter>>;

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
        ) : row.tier === "act_now" ? (
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
            href={anchorHref(row)}
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

      {row.payload ? (
        <p className="text-muted-foreground text-start text-sm">
          {row.payload.fromUserName
            ? t("notifications.detail.handover", {
                name: row.payload.fromUserName,
                companies: row.payload.counts.companies,
                projects: row.payload.counts.projects,
                threads: row.payload.counts.quotationThreads,
                tasks: row.payload.counts.tasks,
              })
            : t("notifications.detail.handoverUnknown")}
        </p>
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

function anchorHref(row: NotificationRow): string {
  if (row.anchorType === "quotation_thread") {
    return `/quotations/${row.anchorId}`;
  }
  if (row.anchorType === "project") return `/projects/${row.anchorId}`;
  if (row.anchorType === "contact") return `/contacts/${row.anchorId}`;
  return `/companies/${row.anchorId}`;
}
