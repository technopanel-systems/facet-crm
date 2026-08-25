import { useTranslations } from "next-intl";
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { notFound } from "next/navigation";

import { Fact, Facts, DetailHeader } from "@/components/page-header";
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
import { formatSqm } from "@/lib/decimal";
import { can, requireSession } from "@/lib/authz";
import { getDispatch } from "@/lib/dispatches";
import { lookupName } from "@/lib/lookups";
import { recordTimeline } from "@/lib/timeline";

import { lineParts } from "../../quotations/line-display";
import { CommentBox } from "../../_components/comment-box";
import { ListPagination } from "../../_components/list-controls";
import { TurnPanel } from "../../_components/turn";
import { RequestActions } from "./request-actions";

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

  const isRaiser = dispatch.recordedByUserId === session.user.id;
  const isCoordinator = can(session, "canDispatch");

  // `25 §9` — a dispatch takes a comment like any other record.
  //
  // **It now takes a turn too, and only sometimes** `[22 §4]`. `D26` says a
  // dispatch owes nobody, and for an APPROVED one that is still exactly right:
  // it is an event that already happened. A REQUEST is different — `S86` puts
  // it in one of three states and `S88` says a submitted one *waits on the
  // coordinator, not on a rep*. So the panel renders for a draft and for a
  // submitted request, and for nothing else: approved, refused and cancelled
  // are all finished, and a panel on any of them would claim somebody owed
  // something. A cancellation especially — *never revived* `S73`.
  const timeline = await recordTimeline(session, "dispatch", dispatch.id, {
    page: Number(page) || 1,
  });

  const dash = t("common.none");

  // `S120` — **who made the difference**, read off the two stored halves.
  //
  // Five real cases and the screen names each: matched throughout · the rep's
  // deviation · hers alone · both · the rep deviated and she brought it back.
  // Only the coordinator may edit a submitted request `S62` `S125`, so *after
  // submission* names her without asking a role.
  //
  // Null while it is a draft, where neither half is recorded yet. `differs`
  // with NEITHER half set is impossible on a submitted row — the lines cannot
  // have moved with nobody moving them — and `verify:slice3` asserts it rather
  // than this screen quietly rendering a badge with no sentence.
  const attribution =
    dispatch.differedAtSubmission && dispatch.linesChangedAfterSubmission
      ? "dispatches.difference.byBoth"
      : dispatch.differedAtSubmission
        ? "dispatches.difference.byRep"
        : dispatch.linesChangedAfterSubmission
          ? "dispatches.difference.byCoordinator"
          : null;

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
      {/* `S121` — **the dispatch's OWN SMAC number**, which is what a
          reference on this screen should be. It used to render the QUOTATION's
          `smac_reference`: a number belonging to a different record, absent
          entirely on a free entry `S75`, and shared by every dispatch raised
          against the same thread `S77`. The quotation's stays below, as the
          source card's link label, where it says what it means. Undefined
          until she types it, which is ordinary — the number is not a condition
          of approval. */}
      <DetailHeader
        name={dispatch.companyName}
        state={`${day(dispatch.dispatchDate)} · ${formatSqm(dispatch.sqm)} ${t("common.sqm")}`}
        reference={dispatch.smacDispatchNumber ?? undefined}
      />

      {/* `22 §4` — whose move it is, not what the status is. Two states own a
          turn and two do not; see the note above. */}
      {dispatch.status === "draft" ? (
        <TurnPanel
          line={
            isRaiser
              ? t("dispatches.turn.yours")
              : t("dispatches.turn.rep", { name: dispatch.recordedByName })
          }
          detail={t("dispatches.turn.draftDetail")}
        />
      ) : null}
      {dispatch.status === "submitted" ? (
        <TurnPanel
          line={
            isCoordinator
              ? t("dispatches.turn.coordinatorYours")
              : t("dispatches.turn.coordinator")
          }
          detail={
            dispatch.submittedAt
              ? t("dispatches.turn.submittedDetail", {
                  date: format.dateTime(dispatch.submittedAt, {
                    dateStyle: "medium",
                  }),
                })
              : undefined
          }
        />
      ) : null}

      {/* `S73` — **a cancelled dispatch stays visible on the record it belonged
          to and carries a reason.** Above the facts, because it is the first
          thing anyone opening this screen needs to know: nothing here counts
          any more `S31`.

          No colour, and no `destructive` anything `D6`: *colour describes how
          long something has waited, never how good the outcome is*, and a
          cancellation is a state of a record rather than a warning. The status
          badge below stays plain `outline` for the same reason. The button that
          performs the act is destructive; the record that resulted is not.

          `S128` also carries this reason to the rep and to anyone whose credit
          it took back — this card is where it lives for people who come back to
          the record, and it is the copy a co-credited rep can never reach. */}
      {dispatch.status === "cancelled" && dispatch.cancellationReason ? (
        <Card data-slot="cancellation">
          <CardHeader>
            <CardTitle className="text-start">
              {t("dispatches.detail.cancelled")}
            </CardTitle>
            <CardDescription className="text-start">
              {t("dispatches.detail.cancelledNotice")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p
              dir="auto"
              className="text-start text-sm whitespace-pre-wrap"
              data-cancellation-reason
            >
              {dispatch.cancellationReason}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* `S124` — a refusal carries a reason, and the reason is what the rep
          opens this screen to read. `S128` carries it to them at the moment of
          refusal now; this is where it lives for anyone coming back to it. */}
      {dispatch.status === "refused" && dispatch.refusalReason ? (
        <Card data-slot="refusal">
          <CardHeader>
            <CardTitle className="text-start">
              {t("dispatches.detail.refused")}
            </CardTitle>
            <CardDescription className="text-start">
              {t("dispatches.detail.refusedNotice")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p
              dir="auto"
              className="text-start text-sm whitespace-pre-wrap"
              data-refusal-reason
            >
              {dispatch.refusalReason}
            </p>
          </CardContent>
        </Card>
      ) : null}

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
            <Fact label={t("dispatches.fields.rep")}>{dispatch.userName}</Fact>
            {/* `S116` — the sum of the lines below, never a typed figure.
                A magnitude, so mono and end-aligned together `D11` `D24`. */}
            <Fact label={t("dispatches.fields.sqm")} name="sqm" numeric>
              <span dir="ltr">
                {formatSqm(dispatch.sqm)} {t("common.sqm")}
              </span>
            </Fact>
            <Fact label={t("dispatches.fields.dispatchDate")}>
              <span dir="ltr">{day(dispatch.dispatchDate)}</span>
            </Fact>
            {/* `S74` — the dispatch's own project, taken from the quotation
                or chosen when it had none. A direct sale still has none at all
                `[07 C6]`, `S75`, which is also why no credit split can apply
                to it. Otherwise: the name always, the link only for someone who
                may open it `[16 §8]`. */}
            <Fact label={t("dispatches.fields.project")} name="project">
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
            {/* `S72` — the state, named. The turn panel above says whose move
                it is `D2`; this says which of the four states it is in, which
                is what a rep checking back needs to read. */}
            <Fact label={t("dispatches.fields.status")} name="status">
              <Badge
                variant={dispatch.status === "approved" ? "default" : "outline"}
                data-status={dispatch.status}
              >
                {t(`dispatches.status.${dispatch.status}`)}
              </Badge>
            </Fact>
            <Fact label={t("dispatches.fields.raisedBy")}>
              {dispatch.recordedByName}
            </Fact>
            {/* `S130` — the dispatch's own stock, which may differ from its
                quotation's `S118`. Shown on every route, including a free
                entry, because every dispatch names one. */}
            <Fact label={t("dispatches.fields.stock")} name="stock">
              {t(`enums.stock.${dispatch.stock}`)}
            </Fact>
            {/* `S119` — CT, TT or Cargo, with Cargo's optional destination
                beside it rather than as a second row nobody would read. */}
            <Fact label={t("dispatches.fields.shipment")} name="shipment">
              <span data-shipment={dispatch.shipment}>
                {t(`enums.shipmentMethod.${dispatch.shipment}`)}
              </span>
              {dispatch.cargoDestination ? (
                <>
                  {" · "}
                  <span dir="auto">{dispatch.cargoDestination}</span>
                </>
              ) : null}
            </Fact>
            {/* `S70` `S71` — how the customer is paying, recorded by the
                coordinator at approval `S73`. Absent until then, which is what
                a request not yet approved means: nobody has answered it. */}
            <Fact label={t("dispatches.fields.paymentMethod")} name="payment">
              {dispatch.paymentMethod ? (
                <span data-payment={dispatch.paymentMethod}>
                  {t(`enums.paymentMethod.${dispatch.paymentMethod}`)}
                  {dispatch.paymentNote ? (
                    <>
                      {" · "}
                      <span dir="auto">{dispatch.paymentNote}</span>
                    </>
                  ) : null}
                </span>
              ) : (
                dash
              )}
            </Fact>
          </Facts>
        </CardContent>
      </Card>

      {/* `S116` — **what a dispatch carries**, and what the invoice is made
          from once it is approved. Editing them is `S125`'s act and lives on
          its own route; the control for it is in the panel below.

          Every figure is `num` and end-aligned `D11` `D24`. The money sits
          BELOW the square metres in prominence `S117` — smaller type, second
          row — because square metres are what a rep is measured on `S83`. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-start">
            {t("dispatches.detail.lines")}
          </CardTitle>
          <CardDescription className="text-start">
            {dispatch.isDirect
              ? t("dispatches.detail.linesTyped")
              : t("dispatches.detail.linesFromQuotation")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LineRows lines={dispatch.lines} slot="dispatch-lines" locale={locale} />
        </CardContent>
      </Card>

      {/* `S120` `S77` — **what was quoted, beside what is going out.** *The
          gap is the point, not drift to be prevented*, and a flag that says
          "something differs, go and look" would send the coordinator to the
          quotation to find out — the round trip putting approve on this screen
          rather than the row was meant to avoid.

          `D24`'s fourth element, *related records as cards*: the version is a
          related record, so this is a SIBLING card and never one nested inside
          the lines card `D21`. Stacked rather than set side by side — two
          six-field rows in parallel columns inside the 1320px cap `D23` is what
          `D22` refuses at 1366, where legibility beats fitting one more row.

          **Only when there is a gap**, and only for an identity that may open
          the quotation. `getDispatch` returns an empty array otherwise: a
          matching dispatch would print the same lines twice, which is a control
          that does nothing `D51`, and the contents may not go where the link
          does not `S109`. */}
      {dispatch.quotedLines.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-start">
              {t("dispatches.difference.quotedLines")}
            </CardTitle>
            <CardDescription className="text-start">
              {t("dispatches.difference.quotedLinesNotice")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LineRows
              lines={dispatch.quotedLines}
              slot="quoted-lines"
              locale={locale}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* `07 C6` — the free-entry route is visible as such, so it cannot
          quietly become a way to skip the chain. **Approval is no longer part
          of what distinguishes them** `S72`: it used to be stamped on the
          direct route alone, standing in for a payment gate that had no object
          there, and both routes now pass through the same act — so it is one
          fact below rather than a branch. */}
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
          <Facts>
            {dispatch.isDirect ? (
              <Fact label={t("dispatches.fields.source")}>
                <Badge variant="outline">{t("dispatches.fields.direct")}</Badge>
              </Fact>
            ) : (
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
            )}
            {/* `S72` — the approval, on whichever route. Absent until it
                happens, which is the whole of what the state means. */}
            <Fact label={t("dispatches.fields.approvedBy")} name="approvedBy">
              {dispatch.approvedByName ?? dash}
              {dispatch.approvedAt
                ? ` · ${format.dateTime(dispatch.approvedAt, { dateStyle: "medium" })}`
                : ""}
            </Fact>

            {/* `S120` — the flag and **who made the difference**, on the card
                that already says where this came from.

                Nothing renders on a free entry `S75`: `differsFromQuotation`
                is null there, and saying either "differs" or "matches" about a
                dispatch with no quotation would be a claim the record cannot
                support — the reason the column is nullable rather than
                defaulting to false.

                The sentence is `wide`, because it is a sentence rather than a
                datum. It is absent on a DRAFT, where both stored halves are
                still null: nothing has been handed over, so no attribution has
                been recorded, and the turn panel above already says whose it
                is. The badge still shows — a rep editing a draft can see they
                have moved away from the quotation. */}
            {dispatch.differsFromQuotation === null ? null : (
              <Fact
                label={t("dispatches.difference.title")}
                name="difference"
                wide
              >
                {dispatch.differsFromQuotation ? (
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Badge variant="outline" data-differs="yes">
                      {t("dispatches.difference.flag")}
                    </Badge>
                    {attribution ? <span>{t(attribution)}</span> : null}
                  </span>
                ) : (
                  <span data-differs="no">
                    {t("dispatches.difference.matches")}
                    {/* The fifth case: the rep deviated and the coordinator
                        brought it back. Nothing differs now, and the rep's own
                        half is kept — `S120`'s flag is permanent, and this is
                        the reading a later figure must not lose. */}
                    {dispatch.differedAtSubmission === true
                      ? ` ${t("dispatches.difference.correctedBack")}`
                      : ""}
                  </span>
                )}
              </Fact>
            )}

            {/* `S77` — **what was quoted against what was actually
                dispatched.** Three figures rather than two: *one quotation
                produces any number of dispatches*, so this dispatch's own
                square metres set against the version's total would read a
                lawful partial dispatch as a deviation nobody made. The middle
                figure is every APPROVED dispatch raised from the same version
                `S72`, which is what makes the pair mean something.

                Below square metres in prominence is `S117`'s rule for money;
                these ARE square metres, which is what a rep is measured on
                `S83`, so they are mono and end-aligned like every magnitude
                `D11` `D24`. */}
            {dispatch.quotedSqm === null ? null : (
              <>
                <Fact
                  label={t("dispatches.difference.quotedSqm")}
                  name="quotedSqm"
                  numeric
                >
                  <span dir="ltr">
                    {formatSqm(dispatch.quotedSqm)} {t("common.sqm")}
                  </span>
                </Fact>
                <Fact
                  label={t("dispatches.difference.dispatchedAgainstVersion")}
                  name="dispatchedAgainstVersion"
                  numeric
                >
                  <span dir="ltr">
                    {formatSqm(dispatch.dispatchedAgainstVersionSqm ?? "0")}{" "}
                    {t("common.sqm")}
                  </span>
                </Fact>
                <Fact
                  label={t("dispatches.difference.thisDispatch")}
                  name="thisDispatchSqm"
                  numeric
                >
                  <span dir="ltr">
                    {formatSqm(dispatch.sqm)} {t("common.sqm")}
                  </span>
                </Fact>
              </>
            )}
          </Facts>
        </CardContent>
      </Card>

      {/* The acts `S72` `S124` `S125` `S122` `S121`. `RequestActions` renders
          nothing at all when this identity has none available `D53`. An
          approved dispatch now carries one for the coordinator — the SMAC
          number `S121`, written after approval — and still none for anyone
          else, because approval is final `S73` and a number is not an edit. */}
      <RequestActions
        dispatchId={dispatch.id}
        status={dispatch.status}
        isRaiser={isRaiser}
        isCoordinator={isCoordinator}
        smacDispatchNumber={dispatch.smacDispatchNumber}
      />

      {/* Credit `[07 D3]`, `[18 §1]`, `[18 §5]`. The shares always add back to
          the dispatch's own square metres.

          **Rendered only once approved** `S72`. *An approved dispatch is the
          only event that credits a target — not the request.* A table of
          shares beside a request nobody has approved would state a slice of
          somebody's month that has not been given; `getDispatch` returns null
          rather than zeroes, so there is no empty table to explain. */}
      {dispatch.credit ? (
        <Card data-slot="credit">
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
      ) : null}

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

/**
 * The product lines of a dispatch, or of the quotation version it was raised
 * from `S116` `S120`.
 *
 * **One renderer for both**, because the two lists are compared by eye and a
 * second copy of this markup would let them drift into looking different for
 * reasons that are not differences. The shape is `S53`'s — supplier, class,
 * fire rating, thickness and colour as words, never a reassembled SMAC code —
 * and the money sits BELOW the square metres in prominence `S117`, because
 * square metres are what a rep is measured on `S83`.
 *
 * The money is nullable here and not on `DispatchLineRow`: a quotation line may
 * carry no price `S58`, and *a line with no price contributes nothing and the
 * screen says so* rather than showing a total quietly missing a line. On a
 * dispatch line the columns are NOT NULL `S116`, so that branch is unreachable
 * from the list above — it exists for the quoted one below it.
 */
function LineRows({
  lines,
  slot,
  locale,
}: {
  lines: {
    id: string;
    supplierNameEn: string;
    supplierNameAr: string;
    classNameEn: string;
    classNameAr: string;
    fireRatingNameEn: string;
    fireRatingNameAr: string;
    customColour: string | null;
    thicknessMm: string;
    widthM: string;
    lengthM: string;
    quantityPcs: string;
    sqm: string | null;
    unitPrice: string | null;
    lineTotal: string | null;
    vatAmount: string | null;
  }[];
  slot: string;
  locale: string;
}) {
  const t = useTranslations();
  return (
    <div className="flex flex-col" data-slot={slot}>
      {lines.map((line) => (
        <div
          key={line.id}
          data-line={line.id}
          className="flex flex-col gap-2 border-t py-4 first:border-t-0 first:pt-0"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            {/* Supplier, class, fire rating, thickness, colour — set out
                as words `S53`, never a reassembled SMAC code. */}
            <p className="flex flex-wrap items-baseline gap-x-2 text-start text-sm font-medium">
              {lineParts(line, locale).map((part, index) => (
                <span key={part + index} dir="auto">
                  {index > 0 ? (
                    <span aria-hidden className="text-faint me-2 font-normal">
                      ·
                    </span>
                  ) : null}
                  {part}
                </span>
              ))}
            </p>
            <p className="text-start text-sm" dir="ltr">
              <span className="num">{line.quantityPcs}</span> ×{" "}
              <span className="num">{line.widthM}</span> ×{" "}
              <span className="num">{line.lengthM}</span> ={" "}
              <span className="num font-medium">{line.sqm}</span>{" "}
              {t("common.sqm")}
            </p>
          </div>

          {/* No rate beside the amount: VAT is fixed at 15% and never
              editable `S57`, so only the figure varies. */}
          <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-start text-xs">
            {line.unitPrice === null ? (
              <span>{t("dispatches.difference.unpriced")}</span>
            ) : (
              <>
                <span dir="ltr">
                  {t("quotations.detail.unitPrice")}:{" "}
                  <span className="num">{line.unitPrice}</span>{" "}
                  {t("common.sar")}
                </span>
                <span dir="ltr">
                  {t("quotations.detail.lineTotal")}:{" "}
                  <span className="num">{line.lineTotal}</span>{" "}
                  {t("common.sar")}
                </span>
                <span dir="ltr">
                  {t("quotations.detail.vatAmount")}:{" "}
                  <span className="num">{line.vatAmount}</span>{" "}
                  {t("common.sar")}
                </span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
