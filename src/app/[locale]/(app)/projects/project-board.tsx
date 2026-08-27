import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { formatSqm } from "@/lib/decimal";
import { projectState, type ProjectBoard } from "@/lib/projects";

/**
 * `D29`'s board — `S132`'s six positions, side by side.
 *
 * **Six columns, always, empty ones included.** `D29` says the board's columns
 * *are* the six positions; a column that disappeared when nothing was in it
 * would be a different board on every screen, and the point of this one is
 * seeing the whole pipeline at once. The count says the column is empty.
 *
 * **The header carries the pile's name and its count, and never a person**
 * `D29` `D24`. It named one until `S132` — `chainOwner` under the title — and
 * the rule now says why that was wrong: *a header describing a person makes the
 * person the subject, and the subject is the project.* The coordinator
 * processes paperwork inside three of the six positions and owns none of them.
 *
 * **`D2` is answered by the pile's own definition**, which is why removing the
 * name costs nothing. *With the customer* says whose move it is as clearly as
 * a name would and better — it names nobody who is not a user of FACET. A pile
 * is not a status, so the grouping still carries the answer `D2` asks for; what
 * changed is that the answer is the pile.
 *
 * **No m² in the header** `S68`. Quotations are never summed, and the only
 * figure that *could* be summed down a column without double counting is
 * `sqm_expected` — one row per project. It is a sum of forecasts, it reads as a
 * pipeline value, and that is exactly what `S68` exists to stop being invented.
 *
 * **Nothing here can be dragged, and nothing suggests it could** `D29` `D58`.
 * The affordance is removed rather than suppressed: **the column is the card**
 * — one `card-face glass` surface `D14` — and the items inside it are rows,
 * because `D21` forbids a nested card and a card that cannot be picked up is
 * worse than no card. So no item carries a shadow to lift, no transform, no
 * grab cursor. Hover is the underline every table row already uses, which is
 * also `D21`'s *a hover state that changes nothing*. `D17`'s motion list is
 * closed and a lifting card is not on it.
 *
 * **No JavaScript** `D20`. A flex row, a percentage of nothing, and links.
 * `D20` licenses the board a horizontal scroll; it does not require one, and
 * `overflow-x-auto` is CSS.
 *
 * RTL needs no override `D57`: a flex row lays out from the inline start, so
 * New is on the right in Arabic and the columns mirror as a group. `dir="auto"`
 * goes on the project's name and on the company's `D62` — never on the item,
 * which also holds a figure and would drag it to the far inline end.
 */
export async function ProjectBoardView({
  board,
  /** The table view of the same query — `D59`, so it carries the search. */
  tableHref,
}: {
  board: ProjectBoard;
  tableHref: string;
}) {
  const t = await getTranslations();
  // The owner's name earns its place only where the reader sees more than one
  // person's work — `listProjects` counts them over the whole visible scope.
  const showOwner = board.ownerCount > 1;

  return (
    <div className="flex flex-col gap-3">
      <div
        data-slot="project-board"
        data-total={String(board.total)}
        // A fixed height so every column is the same height whatever it holds:
        // one with forty cards beside one with two is the defect. Each column
        // scrolls inside it and its header carries the true count, so nothing
        // hides its own size. `D70`'s cap-and-state pattern is the other answer
        // and is deliberately not taken here — see `WORKFLOW §5`.
        className="flex h-128 items-stretch gap-3 overflow-x-auto pb-1"
      >
        {board.columns.map(({ column, cards }) => {
          return (
            <section
              key={column}
              data-slot="board-column"
              data-column={column}
              data-count={String(cards.length)}
              className="card-face glass flex min-w-42 flex-1 flex-col"
            >
              <header className="border-line flex-none border-b px-3.5 py-2.5 text-start">
                <p className="text-faint flex items-baseline gap-1.5 text-[10.5px] font-semibold tracking-[.09em] uppercase">
                  <span className="min-w-0">{t(`chain.step.${column}`)}</span>
                  <span className="num ms-auto flex-none" dir="ltr">
                    {cards.length}
                  </span>
                </p>
              </header>

              <ol className="min-h-0 flex-1 overflow-y-auto">
                {cards.map((card) => {
                  const state = projectState({
                    won: card.won,
                    endState: null,
                    committed: card.committed,
                  });
                  return (
                    <li
                      key={card.id}
                      data-slot="board-card"
                      className="border-line border-t px-3.5 py-2.5 text-start first:border-t-0"
                    >
                      <Link
                        href={`/projects/${card.id}`}
                        className="text-[13px] font-semibold hover:underline"
                      >
                        <span dir="auto">{card.name}</span>
                      </Link>

                      {/* **One line, truncated.** `D70` — what leads is chosen
                          by what the reader is doing, and on a board they are
                          scanning for the project. A column is 168px at 1366,
                          and an Arabic company name at that width wraps to
                          three lines and out-shouts the name above it. The
                          full value is on the project. */}
                      {card.companyName ? (
                        <p
                          title={card.companyName}
                          className="text-muted-foreground mt-0.5 truncate text-[11.5px]"
                          dir="auto"
                        >
                          {card.companyName}
                        </p>
                      ) : null}

                      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        {/* `S29`'s anchor number — the rep's own estimate, and
                            absent rather than zero when there is none `D70`. */}
                        {card.sqmExpected ? (
                          <span
                            className="num text-[11.5px] font-semibold"
                            dir="ltr"
                          >
                            {formatSqm(card.sqmExpected)} {t("common.sqm")}
                          </span>
                        ) : null}

                        {/* Furthest along decides the column, so a second live
                            thread would otherwise be invisible behind the one
                            that got furthest. `25 §22` is the same warning on
                            the project itself. */}
                        {card.liveThreads > 1 ? (
                          <span
                            data-slot="board-threads"
                            className="text-tone-amber-fg text-[11px] font-semibold"
                          >
                            {t("projects.board.threads", {
                              count: card.liveThreads,
                            })}
                          </span>
                        ) : null}

                        {/* `D2` — a status pill may sit beside the line that
                            says whose move it is. Open is every other card and
                            says nothing, so it renders nothing; lost never
                            reaches the board at all `D29`. No colour on it
                            `D6`. */}
                        {state !== "open" ? (
                          <Badge variant="secondary">
                            {t(`projects.state.${state}`)}
                          </Badge>
                        ) : null}
                      </p>

                      {showOwner ? (
                        <p className="text-faint mt-1 text-[11px]" dir="auto">
                          {card.ownerName}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>

      {/* `D29` — lost projects leave the board *"or the board becomes a
          graveyard nobody clears"*. They are stated and linked, never silently
          subtracted: `D70` states the total, `D59` offers the way out and the
          link carries the current search. */}
      {board.lost > 0 ? (
        <p
          data-slot="board-off"
          data-lost={String(board.lost)}
          className="text-faint text-start text-xs"
        >
          {t("projects.board.lost", { count: board.lost })}{" "}
          <Link href={tableHref} className="font-semibold underline">
            {t("projects.board.seeTable")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
