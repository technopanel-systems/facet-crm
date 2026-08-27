import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
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
import { requireSession, can } from "@/lib/authz";
import { chainOwner } from "@/lib/chain";
import { formatSqm } from "@/lib/decimal";
import { hasUsableCompany } from "@/lib/companies";
import { listProjectBoard, listProjects } from "@/lib/projects";

import { FilterNav, ListCard, SearchForm } from "../_components/list-controls";
import { ProjectStateBadge } from "../_components/project-state";
import { Turn, chainTurnKey, turnTone } from "../_components/turn";
import { ProjectBoardView } from "./project-board";

export const dynamic = "force-dynamic";

/**
 * `D28`'s two views of one query — same filters, same URL, same data.
 *
 * **The board is the default**, which is `D28` verbatim, and `D31`'s build
 * order is satisfied: the table shipped first and this is the board second.
 * `?view=cards` is `D31`'s *only if someone asks twice* and is not built.
 * `WORKFLOW §5 AD17` recorded the gap this closes — until now the projects list
 * had a default `D28` does not name.
 *
 * **The switch is links, not JavaScript.** `D20` names a view-mode switch among
 * its three exceptions; that is a licence, not a requirement, and `FilterNav`
 * already puts the value in the URL and **carries the current search** — the
 * failure `D59` records breaking three lists.
 */
export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string; view?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q, page, view } = await searchParams;

  const session = await requireSession();
  const t = await getTranslations();

  // An unknown `?view=` falls back to the default rather than 404ing: it is a
  // display preference in a URL people edit and share, not a record — the same
  // call `/companies` makes about `?sort=`.
  const asTable = view === "table";
  const currentPage = Number(page) || 1;

  // `22 §4` speaks in the second person to the identity that owes the move, and
  // the coordinator is the one FACET can name exactly — the same split
  // `/quotations` makes.
  const viewerIsCoordinator = can(session, "canApproveQuotation");

  // A project needs a company `S27`, so an identity with none may read this
  // list and start nothing from it — the `S76` reader exactly. `D51`: the
  // button is not rendered rather than rendered and refused, and
  // `/projects/new` answers `notFound()` for the same identity.
  const [list, board, mayCreate] = await Promise.all([
    asTable
      ? listProjects(session, { q, page: currentPage, withChain: true })
      : null,
    asTable ? null : listProjectBoard(session, { q }),
    hasUsableCompany(session),
  ]);

  // Filters the search, the pager and the view chips must all carry, so none
  // throws another away `D59`. Only a non-default view is worth a URL.
  const extra = { view: asTable ? "table" : undefined };
  const tableHref = q
    ? `/projects?q=${encodeURIComponent(q)}&view=table`
    : "/projects?view=table";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("projects.title")}
        action={
          mayCreate ? (
            <Button asChild size="sm">
              <Link href="/projects/new">{t("projects.new")}</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3">
        <SearchForm basePath="/projects" defaultValue={q} hidden={extra} />
        <FilterNav
          basePath="/projects"
          name="view"
          active={asTable ? "table" : undefined}
          query={q}
          options={[
            { label: t("projects.view.board") },
            { value: "table", label: t("projects.view.table") },
          ]}
        />
      </div>

      {board ? (
        board.total === 0 && board.lost === 0 ? (
          // Outside any card `D60`, and it says what would make it non-empty
          // `D52`. Emptiness is judged on `q` alone — a view never removes a
          // row, so asking about it here would show the filtered message on a
          // full list.
          <div
            data-slot="projects-empty"
            data-filtered={q ? "true" : "false"}
            className="border-line flex flex-col items-center gap-3 rounded-[14px] border border-dashed p-8 text-center"
          >
            <p className="text-muted-foreground text-sm">
              {q ? t("projects.emptyFiltered") : t("projects.empty")}
            </p>
            {q ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/projects">{t("common.clear")}</Link>
              </Button>
            ) : mayCreate ? (
              <Button asChild size="sm">
                <Link href="/projects/new">{t("projects.new")}</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <ProjectBoardView
            board={board}
            tableHref={tableHref}
            viewerUserId={session.user.id}
          />
        )
      ) : null}

      {list ? (
        list.rows.length === 0 ? (
          <div
            data-slot="projects-empty"
            data-filtered={q ? "true" : "false"}
            className="border-line flex flex-col items-center gap-3 rounded-[14px] border border-dashed p-8 text-center"
          >
            <p className="text-muted-foreground text-sm">
              {q ? t("projects.emptyFiltered") : t("projects.empty")}
            </p>
            {q ? (
              <Button asChild size="sm" variant="outline">
                <Link href={tableHref.split("&")[0]}>{t("common.clear")}</Link>
              </Button>
            ) : mayCreate ? (
              <Button asChild size="sm">
                <Link href="/projects/new">{t("projects.new")}</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <ListCard
            basePath="/projects"
            page={currentPage}
            total={list.total}
            query={q}
            extra={extra}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  {/* `D25` — the list is ordered by attention, and this is the
                      figure the order is built on. The same header idiom
                      `/companies` uses for its silence meter. */}
                  <TableHead className="text-start">
                    {t("projects.fields.lastMoved")}
                  </TableHead>
                  {/* One name field `S26`, so there is nothing here to pick
                      between. The header lost `common.nameEn` in the board
                      slice, and the schema question behind it is now answered
                      rather than deferred. */}
                  <TableHead className="text-start">
                    {t("common.name")}
                  </TableHead>
                  {/* `D2` — the one thing the table could not say before: a
                      project is Open *and* sitting in Waiting payment. The
                      state column beside it is the other axis. */}
                  <TableHead className="text-start">
                    {t("common.whoseMove")}
                  </TableHead>
                  <TableHead numeric>
                    {t("projects.fields.sqmExpected")}
                  </TableHead>
                  <TableHead className="text-start">
                    {t("projects.fields.state")}
                  </TableHead>
                  {/* The reader's own name on every row says nothing `D2`, so
                      the column earns its place only where the list holds
                      somebody ELSE's work — counted over the whole visible
                      scope, so it cannot appear on one page and vanish on the
                      next.
                      **Not `ownerCount > 1`**, which was the old test: one
                      project reaching a rep through a share is a second owner,
                      and the column then printed his own name down the whole
                      page. `listProjects` carries the measurement. */}
                  {list.foreignOwnerCount > 0 ? (
                    <TableHead data-slot="project-owner" className="text-start">
                      {t("projects.fields.owner")}
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-start">
                      {row.chain ? (
                        <span
                          data-slot="project-moved"
                          data-stale={row.chain.stale ? "true" : "false"}
                          className={`num text-[11.5px] font-semibold ${
                            row.chain.stale ? "text-tone-red-fg" : "text-faint"
                          }`}
                          dir="ltr"
                        >
                          {t("followUps.fields.days", {
                            count: row.chain.ageDays,
                          })}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-start font-medium">
                      <Link
                        href={`/projects/${row.id}`}
                        className="hover:underline"
                      >
                        {/* `dir="auto"` on the NAME, never on the cell `D62`. */}
                        <span dir="auto">{row.name}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-start">
                      {row.chain ? (
                        <Turn
                          line={t(
                            chainTurnKey(
                              {
                                position: row.chain.position,
                                owedBy: chainOwner(row.chain.position),
                              },
                              viewerIsCoordinator,
                            ),
                            { name: row.ownerName },
                          )}
                          // Uncoloured on purpose — the lateness is in the
                          // last-moved column, said once. `turnTone` is fed
                          // the data layer's own boolean, never a threshold
                          // derived here.
                          tone={turnTone({})}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell numeric dir="ltr">
                      {row.sqmExpected
                        ? formatSqm(row.sqmExpected)
                        : t("common.none")}
                    </TableCell>
                    {/* Won is derived from an approved dispatch `S31` and
                        resolved in SQL by `listProjects`, so this column costs
                        no query of its own and cannot disagree with the
                        dispatches behind it. */}
                    <TableCell className="text-start">
                      <ProjectStateBadge row={row} />
                    </TableCell>
                    {list.foreignOwnerCount > 0 ? (
                      // **Blank where the reader owns it**, and blank means
                      // *mine*. The cell still renders so the row keeps its
                      // column count. `dir="auto"` stays on the name `D62`.
                      // `data-owner`, not `data-slot`: `TableCell` spreads
                      // props over its own marker `WORKFLOW §5`. This is what
                      // `verify:routes` §22 asserts the blank half against —
                      // presence alone passes for the rule this replaced.
                      <TableCell
                        className="text-start"
                        data-owner={
                          row.ownerUserId === session.user.id ? "self" : "other"
                        }
                      >
                        {row.ownerUserId === session.user.id ? null : (
                          <span dir="auto">{row.ownerName}</span>
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ListCard>
        )
      ) : null}
    </div>
  );
}
