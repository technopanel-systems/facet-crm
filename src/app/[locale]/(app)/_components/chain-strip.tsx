import { getTranslations } from "next-intl/server";

import { CHAIN_COLUMNS, chainOwner, type ChainState } from "@/lib/chain";
import { cn } from "@/lib/utils";

/**
 * `D26`'s chain strip — the concept's `.chain`, on the quotation thread and on
 * a project with exactly one live thread.
 *
 * `TurnPanel` says whose move it is. The strip says the two things a sentence
 * cannot: **how far the deal has travelled**, and **what happens next**. Six
 * nodes, one per `S132` position, done filled, current ringed, future hollow.
 *
 * **The strip keeps the per-step owner; the board's header does not.** `D29`
 * as amended takes the person off a column header because a pile's name already
 * answers `D2`. Here there is no pile — a strip is one thread's journey — so
 * naming whose move each step is remains the only way it is said.
 *
 * **It derives nothing.** Every position, every owner and the reached column
 * come from `src/lib/chain.ts`, which is the single definition `S132` — a
 * second derivation of the same six positions is the trap `21 §7` names, and
 * `D26` attached avoiding it as the condition on building this at all.
 */

type StepState = "done" | "now" | "todo";

/**
 * Where each node stands.
 *
 * **A node is ringed only while someone owes it**, which falls out of `owedBy`
 * rather than being a second rule: a won thread has nobody to wait for, so its
 * last node is done rather than current, and a closed thread rings nothing at
 * all — `reached` says where it stopped, and it never completed that step.
 */
function stepStates(chain: ChainState): StepState[] {
  const reached = CHAIN_COLUMNS.indexOf(chain.reached);
  const closed = chain.position === "closed";

  return CHAIN_COLUMNS.map((_, index) => {
    if (index < reached) return "done";
    if (index > reached || closed) return "todo";
    return chain.owedBy === null ? "done" : "now";
  });
}

export async function ChainStrip({
  chain,
  viewerIsCoordinator = false,
  explain = false,
}: {
  /** From `chainState()`. Never re-derived here. */
  chain: ChainState;
  /** `canApproveQuotation` — which half of the explanation is second person. */
  viewerIsCoordinator?: boolean;
  /** The plain-language paragraph. The quotation screen shows it. */
  explain?: boolean;
}) {
  const t = await getTranslations();
  const states = stepStates(chain);

  return (
    <div className="flex flex-col">
      {/* The rail is drawn by flex, not by an absolutely-positioned `::before`
          at `inset-inline-start:-50%`: the concept's version needs a
          `translateX` flip under RTL, and a flex row needs none. Each step is
          [half-rail][node][half-rail], and the outer halves of the first and
          last steps are invisible rather than absent, so all six stay the same
          width and the labels line up. */}
      <ol
        data-slot="chain-strip"
        data-position={chain.position}
        aria-label={t("chain.strip.label")}
        className="flex"
      >
        {CHAIN_COLUMNS.map((column, index) => {
          const state = states[index];
          const owner = chainOwner(column);
          // The concept's `.step.done::before`: the rail INTO a done node is
          // filled. Split across two halves, that is this step's leading half
          // and the previous step's trailing half.
          const railIn = state === "done";
          const railOut = states[index + 1] === "done";

          return (
            <li
              key={column}
              data-state={state}
              className="flex min-w-0 flex-1 flex-col items-center"
            >
              <span aria-hidden className="flex w-full items-center">
                <Rail filled={railIn} hidden={index === 0} />
                <Node state={state} />
                <Rail
                  filled={railOut}
                  hidden={index === CHAIN_COLUMNS.length - 1}
                />
              </span>
              <span
                className={cn(
                  "mt-2 max-w-full truncate px-1 text-center text-xs font-semibold",
                  state === "now" && "text-tone-amber-fg",
                  state === "todo" && "text-faint font-medium",
                )}
              >
                {t(`chain.step.${column}`)}
              </span>
              {/* `22 §4` at every step, not only the current one: whose move
                  each is. The terminal node owes nobody, so it says so. */}
              <span className="text-faint mt-0.5 max-w-full truncate px-1 text-center text-[11px]">
                {owner ? t(`chain.by.${owner}`) : t("common.none")}
              </span>
            </li>
          );
        })}
      </ol>

      {chain.position === "closed" ? (
        <p className="text-faint mt-3 text-start text-xs">
          {t("chain.strip.stopped")}
        </p>
      ) : null}

      {explain ? (
        <p className="border-line text-muted-foreground mt-4 border-t pt-3.5 text-start text-[12.5px] leading-relaxed">
          <b className="text-foreground font-semibold">
            {t("chain.explain.title")}
          </b>{" "}
          {/* `D2` puts the second person only where the reader IS that
              person, and the coordinator opens this screen more than anyone:
              she neither raises the request nor chases the customer. Same
              condition `chainTurnKey` already splits the turn line on.
              **Neither half mentions payment any more** `S133` — `S70` records
              it on the dispatch and `S73` makes it a condition of approving
              one, so the sentence says the coordinator approves what leaves
              and records how the customer is paying, in one breath. */}
          {t(
            `chain.explain.body.${viewerIsCoordinator ? "coordinator" : "rep"}`,
          )}{" "}
          <b className="text-foreground font-semibold">
            {/* `25 §21` — dispatched is the only real number, and the only one
                that touches a target. */}
            {t("chain.explain.target")}
          </b>
        </p>
      ) : null}
    </div>
  );
}

/** Half the rail between two nodes. `invisible` keeps the six steps equal. */
function Rail({ filled, hidden }: { filled: boolean; hidden: boolean }) {
  return (
    <span
      className={cn(
        "h-0.5 flex-1 rounded-sm",
        filled ? "bg-brand" : "bg-line",
        hidden && "invisible",
      )}
    />
  );
}

function Node({ state }: { state: StepState }) {
  return (
    <span
      className={cn(
        "grid size-4.5 flex-none place-items-center rounded-full border-2",
        state === "done" && "bg-brand border-brand",
        state === "now" && "bg-surface border-tone-amber-fg ring-tone-amber ring-4",
        state === "todo" && "bg-surface border-line-strong",
      )}
    >
      {state === "done" ? (
        <svg
          viewBox="0 0 24 24"
          className="text-brand-ink size-2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m4 12.5 5.5 5.5L20 6" />
        </svg>
      ) : null}
    </span>
  );
}
