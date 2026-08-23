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
import { requireSession } from "@/lib/authz";
import { asDispatchStatus, listDispatches } from "@/lib/dispatches";

import { FilterNav, ListCard, SearchForm } from "../_components/list-controls";
import { Turn } from "../_components/turn";

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
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q, page, direct, status, userId } = await searchParams;

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
    status: scope,
    // `07 C6` — the direct route has to be countable, so it is filterable.
    direct: direct === "1" ? true : direct === "0" ? false : undefined,
  });

  const basePath = "/dispatches";
  const dash = t("common.none");

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
        hidden={{ direct, status, userId }}
      />

      {/* `S72`'s four states, and the archive among them `S122`. A chip that
          dropped the current search threw the query away, which broke three
          lists `D59` — so every chip set carries the others' values. */}
      <FilterNav
        basePath={basePath}
        name="status"
        active={scope}
        query={q}
        extra={{ direct, userId }}
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
        extra={{ status, userId }}
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
          extra={{ direct, status, userId }}
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
                    {row.sqm} {t("common.sqm")}
                  </TableCell>
                  <TableCell className="text-start">
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
                  </TableCell>
                  <TableCell className="text-start">
                    {/* Approved and refused owe nobody `D26`: one is an event
                        that happened, the other is archived `S122`. Both name
                        who ended it instead. */}
                    <Turn
                      line={
                        row.status === "draft"
                          ? t("dispatches.turn.rep", {
                              name: row.recordedByName,
                            })
                          : row.status === "submitted"
                            ? t("dispatches.turn.coordinator")
                            : row.status === "approved"
                              ? t("dispatches.turn.approved", {
                                  name: row.approvedByName ?? dash,
                                })
                              : t("dispatches.turn.refused")
                      }
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
