import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";

import { PageHeader } from "@/components/page-header";
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
import { formatSqm } from "@/lib/decimal";
import { requireSession } from "@/lib/authz";
import { getCompany } from "@/lib/companies";
import { asDispatchStatus, listDispatches } from "@/lib/dispatches";

import {
  FilterNav,
  ListCard,
  ScopeChip,
  SearchForm,
} from "../_components/list-controls";
import {
  Turn,
  dispatchTurnKey,
  dispatchTurnNames,
} from "../_components/turn";

export const dynamic = "force-dynamic";

export default async function DispatchesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    page?: string;
    direct?: string;
    status?: string;
    userId?: string;
    companyId?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q, page, direct, status, userId, companyId } = await searchParams;

  const session = await requireSession();
  const t = await getTranslations();
  const format = await getFormatter();

  // **One query parameter, no second screen** `D28`. `S122` keeps a refused
  // request out of the working lists, so the default scope excludes it and the
  // archive is reached by asking for it — not by a second route with its own
  // filters to keep in step.
  const scope = asDispatchStatus(status);
  const currentPage = Number(page) || 1;
  const { rows, total } = await listDispatches(session, {
    q,
    page: currentPage,
    userId,
    companyId,
    status: scope,
    // `07 C6` — the direct route has to be countable, so it is filterable.
    direct: direct === "1" ? true : direct === "0" ? false : undefined,
  });

  const basePath = "/dispatches";
  const dash = t("common.none");

  // **The scope is named or it is not applied** `D59`. A company detail card
  // links here for the sixth dispatch onward `D70`, and a list that silently
  // returned a subset is the defect that broke three screens. `getCompany`
  // resolves the name through the reader's own filter, so a `?companyId=`
  // naming a company they may not open scopes the list and names nothing —
  // `visibleDispatchesFilter` had already decided which rows come back, and
  // company membership is not one of its terms `[18 §2]`.
  const scopedTo = companyId ? await getCompany(session, companyId) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("dispatches.title")}
        description={t("dispatches.detail.creditsTargets")}
        action={
          // **No `can_dispatch` here** `S72`. *A rep requests a dispatch* — the
          // button used to render only for the flag, which was the whole act
          // being behind it. What is behind the flag now is approving, which
          // lives on a request's own screen.
          <Button asChild size="sm">
            <Link href="/dispatches/new">{t("dispatches.request")}</Link>
          </Button>
        }
      />

      <SearchForm
        basePath={basePath}
        defaultValue={q}
        placeholder={t("dispatches.searchPlaceholder")}
        hidden={{ direct, status, userId, companyId }}
      />

      {scopedTo ? (
        <ScopeChip label={scopedTo.name} clearHref={basePath} />
      ) : null}

      {/* `S72`'s four states, and the archive among them `S122`. A chip that
          dropped the current search threw the query away, which broke three
          lists `D59` — so every chip set carries the others' values. */}
      <FilterNav
        basePath={basePath}
        name="status"
        active={scope}
        query={q}
        extra={{ direct, userId, companyId }}
        options={[
          { label: t("dispatches.status.open") },
          { value: "submitted", label: t("dispatches.status.submitted") },
          { value: "approved", label: t("dispatches.status.approved") },
          { value: "draft", label: t("dispatches.status.draft") },
          { value: "refused", label: t("dispatches.status.refused") },
        ]}
      />

      {/* `userId` is the attainment table's deep-link target and has no control
          of its own, so the chips carry it rather than dropping it. */}
      <FilterNav
        basePath={basePath}
        name="direct"
        active={direct === "0" || direct === "1" ? direct : undefined}
        query={q}
        extra={{ status, userId, companyId }}
        options={[
          { label: t("dispatches.fields.filterAll") },
          { value: "0", label: t("dispatches.fields.filterLinked") },
          { value: "1", label: t("dispatches.fields.filterDirect") },
        ]}
      />

      {rows.length === 0 ? (
        // `D52` `D60` — outside `ListCard`, where a pagination footer would
        // make an empty list read as broken, and a different key when a filter
        // is what emptied it.
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {q || scope || direct
            ? t("dispatches.emptyFiltered")
            : t("dispatches.empty")}
        </p>
      ) : (
        <ListCard
          basePath={basePath}
          page={currentPage}
          total={total}
          query={q}
          extra={{ direct, status, userId, companyId }}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">
                  {t("dispatches.fields.dispatchDate")}
                </TableHead>
                <TableHead className="text-start">
                  {t("dispatches.fields.company")}
                </TableHead>
                <TableHead className="text-start">
                  {t("dispatches.fields.rep")}
                </TableHead>
                <TableHead numeric>{t("dispatches.fields.sqm")}</TableHead>
                <TableHead className="text-start">
                  {t("dispatches.fields.source")}
                </TableHead>
                {/* `D2` — **a row says whose move it is, not what the status
                    is**, and since `S72` a dispatch row has a move to name: a
                    draft waits on the rep who raised it, a submitted request
                    on the coordinator `S88`. This replaces the *recorded by*
                    column rather than joining it — the raiser's name is what
                    the draft line already says, and a seventh column at 1366px
                    is what `S118` refused on `/quotations`. */}
                <TableHead className="text-start">
                  {t("dispatches.fields.turn")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="num text-start font-medium" dir="ltr">
                    <Link
                      href={`/dispatches/${row.id}`}
                      className="hover:underline"
                    >
                      {format.dateTime(
                        new Date(`${row.dispatchDate}T00:00:00Z`),
                        {
                          dateStyle: "medium",
                          timeZone: "UTC",
                        },
                      )}
                    </Link>
                  </TableCell>
                  {/* `18 §2` — the name always; the link only for someone who
                      may open the record. */}
                  <TableCell className="text-start">
                    {row.companyViewable ? (
                      <Link
                        href={`/companies/${row.companyId}`}
                        className="hover:underline"
                      >
                        {row.companyName}
                      </Link>
                    ) : (
                      row.companyName
                    )}
                  </TableCell>
                  <TableCell className="text-start">{row.userName}</TableCell>
                  <TableCell numeric dir="ltr">
                    {formatSqm(row.sqm)} {t("common.sqm")}
                  </TableCell>
                  <TableCell className="text-start">
                    {/* `S120` — the marker sits under the reference it is
                        about, so the cell reads "this quotation, and this
                        dispatch differs from it". This is the signal the
                        coordinator's queue had none of (`WORKFLOW §5`): at
                        12–15 requests a day she opened every screen to learn
                        which three needed reading.

                        **Plain outline, no tone** `D6`. Colour describes how
                        long something has waited, never how good the outcome
                        is, and a difference is a state of the record rather
                        than an elapsed time — a red or amber pill here would
                        also read as a verdict, which `S77` explicitly refuses:
                        *the gap is the point, not drift to be prevented*.

                        Rendered only on `true`. `null` is a free entry `S75`
                        with no quotation to differ from, and marking it either
                        way would say something the record cannot support. */}
                    <span className="flex flex-col items-start gap-1.5">
                      {row.isDirect ? (
                        <Badge variant="outline">
                          {t("dispatches.fields.direct")}
                        </Badge>
                      ) : row.threadViewable ? (
                        <Link
                          href={`/quotations/${row.quotationThreadId}`}
                          className="hover:underline"
                          dir="ltr"
                        >
                          {row.smacReference ?? t("common.none")}
                        </Link>
                      ) : (
                        <span dir="ltr">
                          {row.smacReference ?? t("common.none")}
                        </span>
                      )}
                      {row.differsFromQuotation === true ? (
                        <Badge variant="outline" data-differs="yes">
                          {t("dispatches.difference.flag")}
                        </Badge>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell className="text-start">
                    {/* Approved and refused owe nobody `D26`: one is an event
                        that happened, the other is archived `S122`. Both name
                        who ended it instead. */}
                    <Turn
                      line={t(
                        dispatchTurnKey(row.status),
                        dispatchTurnNames(row.status)
                          ? {
                              name:
                                (row.status === "approved"
                                  ? row.approvedByName
                                  : row.recordedByName) ?? dash,
                            }
                          : undefined,
                      )}
                    />
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
