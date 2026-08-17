import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import {
  Fact,
  Facts,
  DetailHeader,
} from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Timeline } from "@/components/timeline";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import { getDispatch } from "@/lib/dispatches";
import { lookupName } from "@/lib/lookups";
import { recordTimeline } from "@/lib/timeline";

import { CommentBox } from "../../_components/comment-box";
import { ListPagination } from "../../_components/list-controls";

export const dynamic = "force-dynamic";

export default async function DispatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, id } = await params;
  const { page } = await searchParams;
  setRequestLocale(locale);

  const session = await requireSession();
  const t = await getTranslations();
  const format = await getFormatter();

  const dispatch = await getDispatch(session, id);
  // A record hidden by visibility and one that never existed look identical.
  if (!dispatch) notFound();

  // `25 §9` — a dispatch takes a comment like any other record. Note what it
  // still does not take: a turn `[22 §4]`. A dispatch owes nobody the next
  // action; it is an event that already happened, and colleagues talking about
  // it does not make it somebody's move.
  const timeline = await recordTimeline(session, "dispatch", dispatch.id, {
    page: Number(page) || 1,
  });

  const dash = t("common.none");
  const day = (value: string) =>
    format.dateTime(new Date(`${value}T00:00:00Z`), {
      dateStyle: "medium",
      timeZone: "UTC",
    });

  return (
    <div className="flex flex-col gap-6">
      {/* The COMPANY is the record's name `[22 §3]`. A quantity as a
          title told a rep nothing about which dispatch they had opened; the
          square metres are a fact below, where a quantity belongs. */}
      <DetailHeader
        name={dispatch.companyName}
        state={`${day(dispatch.dispatchDate)} · ${dispatch.sqm} ${t("common.sqm")}`}
        reference={dispatch.smacReference ?? undefined}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-start">
            {t("dispatches.detail.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Facts>
            <Fact label={t("dispatches.fields.company")}>
              {dispatch.companyViewable ? (
                <Link
                  href={`/companies/${dispatch.companyId}`}
                  className="hover:underline"
                >
                  {dispatch.companyName}
                </Link>
              ) : (
                dispatch.companyName
              )}
            </Fact>
            <Fact label={t("dispatches.fields.rep")}>
              {dispatch.userName}
            </Fact>
            <Fact label={t("dispatches.fields.sqm")}>
              <span dir="ltr">
                {dispatch.sqm} {t("common.sqm")}
              </span>
            </Fact>
            <Fact label={t("dispatches.fields.dispatchDate")}>
              <span dir="ltr">{day(dispatch.dispatchDate)}</span>
            </Fact>
            {/* A direct sale has no project at all `[07 C6]`, which is also
                why no credit split can apply to it. Otherwise: the name
                always, the link only for someone who may open it `[16 §8]`. */}
            <Fact label={t("dispatches.fields.project")}>
              {dispatch.projectId === null ? (
                dash
              ) : dispatch.projectViewable ? (
                <Link
                  href={`/projects/${dispatch.projectId}`}
                  className="hover:underline"
                >
                  {lookupName(
                    {
                      nameEn: dispatch.projectNameEn ?? "",
                      nameAr: dispatch.projectNameAr,
                    },
                    locale,
                  )}
                </Link>
              ) : (
                lookupName(
                  {
                    nameEn: dispatch.projectNameEn ?? "",
                    nameAr: dispatch.projectNameAr,
                  },
                  locale,
                )
              )}
            </Fact>
            <Fact label={t("dispatches.fields.recordedBy")}>
              {dispatch.recordedByName}
            </Fact>
          </Facts>
        </CardContent>
      </Card>

      {/* `07 C6` — the direct route is visible as such, so it cannot quietly
          become a way to skip the chain. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-start">
            {t("dispatches.fields.source")}
          </CardTitle>
          <CardDescription className="text-start">
            {dispatch.isDirect
              ? t("dispatches.detail.directNotice")
              : t("dispatches.detail.linkedNotice")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dispatch.isDirect ? (
            <Facts>
              <Fact label={t("dispatches.fields.source")}>
                <Badge variant="outline">
                  {t("dispatches.fields.direct")}
                </Badge>
              </Fact>
              <Fact label={t("dispatches.fields.approvedBy")}>
                {dispatch.approvedByName ?? dash}
                {dispatch.approvedAt
                  ? ` · ${format.dateTime(dispatch.approvedAt, { dateStyle: "medium" })}`
                  : ""}
              </Fact>
            </Facts>
          ) : (
            <Facts>
              <Fact label={t("dispatches.fields.quotation")}>
                {dispatch.threadViewable ? (
                  <Link
                    href={`/quotations/${dispatch.quotationThreadId}`}
                    className="hover:underline"
                    dir="ltr"
                  >
                    {dispatch.smacReference ?? dash}
                  </Link>
                ) : (
                  <span dir="ltr">{dispatch.smacReference ?? dash}</span>
                )}
              </Fact>
              <Fact label={t("dispatches.fields.paymentGate")}>
                {t("dispatches.detail.paymentConfirmed")}
              </Fact>
            </Facts>
          )}
        </CardContent>
      </Card>

      {/* Credit `[07 D3]`, `[18 §1]`, `[18 §5]`. The shares always add back to
          the dispatch's own square metres. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-start">
            {t("dispatches.detail.credit")}
          </CardTitle>
          <CardDescription className="text-start">
            {dispatch.credit.basis === "split"
              ? t("dispatches.detail.creditBySplit", {
                  date: dispatch.credit.generationEffectiveFrom ?? "",
                })
              : t("dispatches.detail.creditByRep")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">
                    {t("dispatches.fields.rep")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("credit.fields.share")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("dispatches.fields.sqm")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dispatch.credit.shares.map((share) => (
                  <TableRow key={share.userId}>
                    <TableCell className="text-start">
                      {share.userName}
                    </TableCell>
                    <TableCell className="text-start" dir="ltr">
                      {share.percentage}%
                    </TableCell>
                    <TableCell className="text-start" dir="ltr">
                      {share.sqm}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Timeline
        events={timeline.events}
        total={timeline.total}
        composer={
          <CommentBox
            session={session}
            recordType="dispatch"
            recordId={dispatch.id}
          />
        }
      />
      <ListPagination
        basePath={`/dispatches/${dispatch.id}`}
        page={timeline.page}
        total={timeline.total}
      />
    </div>
  );
}
