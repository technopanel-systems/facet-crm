import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

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
import { can, requireSession } from "@/lib/authz";
import { listDispatches } from "@/lib/dispatches";

import {
  FilterNav,
  ListCard,
  SearchForm,
} from "../_components/list-controls";

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
    userId?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q, page, direct, userId } = await searchParams;

  const session = await requireSession();
  const t = await getTranslations();
  const format = await getFormatter();

  const currentPage = Number(page) || 1;
  const { rows, total } = await listDispatches(session, {
    q,
    page: currentPage,
    userId,
    // `07 C6` — the direct route has to be countable, so it is filterable.
    direct: direct === "1" ? true : direct === "0" ? false : undefined,
  });

  const basePath = "/dispatches";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("dispatches.title")}
        description={t("dispatches.detail.creditsTargets")}
        action={
          can(session, "canDispatch") ? (
            <Button asChild size="sm">
              <Link href="/dispatches/new">{t("dispatches.new")}</Link>
            </Button>
          ) : undefined
        }
      />

      <SearchForm
        basePath={basePath}
        defaultValue={q}
        placeholder={t("dispatches.searchPlaceholder")}
        hidden={{ direct, userId }}
      />

      {/* `userId` is the attainment table's deep-link target and has no control
          of its own, so the chips carry it rather than dropping it. */}
      <FilterNav
        basePath={basePath}
        name="direct"
        active={direct === "0" || direct === "1" ? direct : undefined}
        query={q}
        extra={{ userId }}
        options={[
          { label: t("dispatches.fields.filterAll") },
          { value: "0", label: t("dispatches.fields.filterLinked") },
          { value: "1", label: t("dispatches.fields.filterDirect") },
        ]}
      />

      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {q ? t("dispatches.emptyFiltered") : t("dispatches.empty")}
        </p>
      ) : (
        <ListCard
          basePath={basePath}
          page={currentPage}
          total={total}
          query={q}
          extra={{ direct, userId }}
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
                <TableHead numeric>
                  {t("dispatches.fields.sqm")}
                </TableHead>
                <TableHead className="text-start">
                  {t("dispatches.fields.source")}
                </TableHead>
                <TableHead className="text-start">
                  {t("dispatches.fields.recordedBy")}
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
                      {format.dateTime(new Date(`${row.dispatchDate}T00:00:00Z`), {
                        dateStyle: "medium",
                        timeZone: "UTC",
                      })}
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
                    {row.recordedByName}
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
