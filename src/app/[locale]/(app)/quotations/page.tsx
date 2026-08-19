import { getTranslations, setRequestLocale } from "next-intl/server";

import { Absent, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { can, requireSession } from "@/lib/authz";
import { chainState } from "@/lib/chain";
import { lookupName } from "@/lib/lookups";
import { listQuotationThreads } from "@/lib/quotations";

import { ListCard, SearchForm } from "../_components/list-controls";
import { Turn, chainTurnKey, daysSince } from "../_components/turn";

export const dynamic = "force-dynamic";

/**
 * The bad terminal states get the destructive badge; `accepted` gets the plain
 * one, deliberately. It is internal approval, not a won deal `[16 §5]` — a
 * success-coloured pill would be the first place that distinction is lost.
 */
function endStateVariant(state: string): "secondary" | "destructive" {
  return state === "rejected" || state === "cancelled" ? "destructive" : "secondary";
}

export default async function QuotationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q, page } = await searchParams;

  const session = await requireSession();
  const t = await getTranslations();
  // `22 §4` speaks in the second person to the identity that owes the move.
  // The coordinator is the one FACET can name exactly.
  const viewerIsCoordinator = can(session, "canApproveQuotation");

  const currentPage = Number(page) || 1;
  const { rows, total } = await listQuotationThreads(session, {
    q,
    page: currentPage,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("quotations.title")}
        action={
          <Button asChild size="sm">
            <Link href="/quotations/new">{t("quotations.new")}</Link>
          </Button>
        }
      />

      <SearchForm
        basePath="/quotations"
        defaultValue={q}
        placeholder={t("quotations.searchPlaceholder")}
      />

      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {q ? t("quotations.emptyFiltered") : t("quotations.empty")}
        </p>
      ) : (
        <ListCard
          basePath="/quotations"
          page={currentPage}
          total={total}
          query={q}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">
                  {t("quotations.fields.reference")}
                </TableHead>
                <TableHead className="text-start">
                  {t("quotations.fields.project")}
                </TableHead>
                <TableHead className="text-start">
                  {t("quotations.fields.company")}
                </TableHead>
                {/* `22 §4` — whose move it is. The status pill still renders
                    beside it; it is simply never the only thing a row says. */}
                <TableHead className="text-start">
                  {t("common.whoseMove")}
                </TableHead>
                <TableHead className="text-start">
                  {t("quotations.fields.versionStatus")}
                </TableHead>
                <TableHead numeric>
                  {t("quotations.fields.validUntil")}
                </TableHead>
                <TableHead numeric>
                  {t("quotations.fields.grandTotal")}
                </TableHead>
                <TableHead className="text-start">
                  {t("quotations.fields.endState")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="num text-start font-medium" dir="ltr">
                    <Link
                      href={`/quotations/${row.id}`}
                      className="hover:underline"
                    >
                      {row.smacReference ?? t("common.none")}
                    </Link>
                  </TableCell>
                  <TableCell className="text-start">
                    {/* `S50` — no project is a state, not a blank cell. */}
                    {row.projectNameEn === null ? (
                      <Absent>{t("quotations.detail.noProject")}</Absent>
                    ) : (
                      lookupName(
                        {
                          nameEn: row.projectNameEn,
                          nameAr: row.projectNameAr,
                        },
                        locale,
                      )
                    )}
                  </TableCell>
                  <TableCell className="text-start">
                    {row.companyName}
                  </TableCell>
                  <TableCell className="text-start">
                    <Turn
                      line={t(
                        chainTurnKey(
                          chainState({
                            versionStatus: row.versionStatus,
                            endState: row.endState,
                            paymentConfirmedAt: row.paymentConfirmedAt,
                          }),
                          viewerIsCoordinator,
                        ),
                        { name: row.raisedByName },
                      )}
                      // Uncoloured on purpose. No document sets a lateness
                      // threshold for a quotation thread. A live thread CAN now
                      // be past its own date — `S67` made validity a note, so
                      // nothing closes on it — and that is shown in the
                      // validity column rather than coloured in here.
                      elapsed={t("followUps.fields.days", {
                        count: daysSince(
                          row.paymentConfirmedAt ?? row.createdAt,
                        ),
                      })}
                    />
                  </TableCell>
                  <TableCell className="text-start">
                    <Badge variant="outline">
                      {t(`enums.quotationVersionStatus.${row.versionStatus}`)}
                      {` · ${row.versionNumber}`}
                    </Badge>
                  </TableCell>
                  {/* Expired is a fact about the date, shown beside it and
                      never a state `S67`. Uncoloured: `D6` makes colour mean
                      how long something has waited on somebody, and an expired
                      quotation waits on nobody in particular — it stops
                      nothing, so a red pill would be asking for an action the
                      rule does not want. */}
                  <TableCell numeric dir="ltr">
                    {row.validUntil ? (
                      <span className="inline-flex items-baseline gap-1.5">
                        {row.validUntil}
                        {row.expired ? (
                          <span className="text-faint text-xs">
                            {t("quotations.fields.expired")}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      t("common.none")
                    )}
                  </TableCell>
                  <TableCell numeric dir="ltr">
                    {row.grandTotal
                      ? `${row.grandTotal} ${t("common.sar")}`
                      : t("common.none")}
                  </TableCell>
                  <TableCell className="text-start">
                    {row.endState ? (
                      <Badge variant={endStateVariant(row.endState)}>
                        {t(`enums.quotationThreadEndState.${row.endState}`)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">
                        {t("quotations.fields.endStateOpen")}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ListCard>
      )}
    </div>
  );
}
