import type {
  QuotationThreadEndState,
  QuotationVersionStatus,
} from "@/lib/enums";

/**
 * **The one definition of chain position** `S132`.
 *
 * The quotation chain is the strictly-ordered half of `25 §1` — no price yet →
 * requested → quoted → with the customer → ready to ship → won — as against the
 * activities, which are unordered and repeatable `S135`. `S132` names the six
 * positions and says every one is *derived from a real event*: always accurate,
 * never stale, nothing to maintain, and **no act moves a card** `S134`.
 *
 * **Anything that needs a chain position calls this.** The turn column on
 * `/quotations`, the turn panel on a quotation, `D26`'s **chain strip** on the
 * quotation and project detail screens, and `D29`'s board — which draws
 * `CHAIN_COLUMNS` and labels each step from `chainOwner`, rather than
 * re-deriving the same six positions from the same fields.
 *
 * Two derivations of one rule is how the quiet-threshold trap `21 §7` names
 * came about: `follow-ups.ts` owns "quiet", and `companySilence` in
 * `coverage.ts` is the one shape every screen composes so a second one cannot
 * invent a second answer. The chain is the next-largest candidate for the same
 * mistake, so it gets the same treatment before there is a second caller rather
 * than after.
 *
 * **This module imports nothing but types**, like `enums.ts` beside it, so a
 * `"use client"` component may import it without pulling the Postgres driver
 * into the browser bundle. Keep it that way: no query, no session, no `db`.
 */

/**
 * `S132`'s six positions, **in order**.
 *
 * `new` is *No price yet* — a **project** with no quotation thread at all. A
 * thread can never be in it, since raising one creates version 1. It is named
 * here because the board's first column is this position and the board must not
 * define its own. `D29` carries the second reading — at project level it is a
 * project with no LIVE thread — and says so out loud rather than letting a
 * definition shift by level in silence.
 *
 * **`paid` is not among them** `S133`. `S70` records payment on the dispatch
 * and `S73` makes a method a condition of approving one, so no interval exists
 * between paid and dispatched for a position to occupy. The rung, the two acts
 * behind it and the three columns they wrote left together.
 *
 * The order is the chain's own, and two callers depend on it: the strip walks
 * it forwards to draw six nodes, and `chainReached` tests it backwards because
 * furthest-along wins.
 */
export const CHAIN_COLUMNS = [
  "new",
  "requested",
  "quoted",
  "withCustomer",
  "readyToShip",
  "won",
] as const;

/**
 * The six columns, plus the terminal case.
 *
 * `closed` is not an `S132` position: `D29` keeps a lost project off the board
 * and `S62` ends a thread at rejected or cancelled. Nobody owes the next action
 * on one, which is the only thing `D2` asks. So the board and the strip take
 * `CHAIN_COLUMNS`, and only a *position* can be `closed` — derived from the one
 * list above rather than restating six names beside it.
 */
export const CHAIN_POSITIONS = [...CHAIN_COLUMNS, "closed"] as const;
export type ChainPosition = (typeof CHAIN_POSITIONS)[number];

/** A column, never the terminal case — what `reached` and the strip index. */
export type ChainColumn = (typeof CHAIN_COLUMNS)[number];

/**
 * Who owes the next action at a position — `D2`'s question, not a permission.
 * `null` means nobody does, because the chain has ended.
 */
export type ChainOwner = "rep" | "coordinator" | null;

const OWNERS: Record<ChainPosition, ChainOwner> = {
  // No price yet: a project with no live quotation is the rep's to quote `S132`.
  new: "rep",
  // Raised; the coordinator builds the real quotation in SMAC `S63`.
  requested: "coordinator",
  // The price exists. `S65` makes the signature INTERNAL and effectively
  // instant, so what is owed here is her accept, not the customer signing.
  quoted: "coordinator",
  // Internal approval is in and the customer is deciding — the long wait,
  // days to months. `S132` answers this one outright: **the rep**, because
  // chasing the customer is his job. It is not a fourth `S86` state.
  withCustomer: "rep",
  // A dispatch request is submitted and the coordinator is checking it
  // `S72`. `S88`: a dispatch request waits on her, never on a rep.
  readyToShip: "coordinator",
  won: null,
  closed: null,
};

/**
 * Who owes the next action at **any** position, not only the current one.
 *
 * `chainState().owedBy` answers for the position a thread is actually in, and
 * the chain strip labels all six steps with whose move each is `D2`. Both read
 * this map rather than writing a second one — which is the whole reason this
 * module exists.
 *
 * **The board does not call this.** `D29` as amended puts the pile's name and
 * its count on a column header and never a person: a header describing a person
 * makes the person the subject, and the subject is the project.
 */
export function chainOwner(position: ChainPosition): ChainOwner {
  return OWNERS[position];
}

export type ChainInput = {
  /** The live version's status — never `superseded`, by definition. */
  versionStatus: QuotationVersionStatus;
  endState: QuotationThreadEndState | null;
  /**
   * Whether a dispatch request against this thread is sitting at `submitted`
   * — `S132`'s fifth position, where the coordinator is checking it `S72`.
   *
   * **A `draft` does not qualify.** `S132` says so outright: a draft is still
   * the rep's own to edit `S125` and can sit indefinitely, so it is not a place
   * the deal has reached.
   */
  hasSubmittedDispatch?: boolean;
  /**
   * Whether anything has actually been approved to leave the warehouse against
   * this thread — `S132`'s sixth position, which is `S31`'s own won predicate
   * read at the same place rather than a second one beside it.
   *
   * Optional, like the flag above, because **a quotation thread row cannot
   * answer either** — dispatch lives in its own table — so a caller that has
   * not loaded dispatches omits both and the chain stops at `withCustomer`
   * rather than claiming a position it cannot see. `24 §"partial dispatches are
   * the expected case"` is why this is a boolean and not a quantity: the
   * position is *has any gone out*, and the unfulfilled remainder is
   * deliberately never shown as a number `D42`.
   */
  hasDispatch?: boolean;
};

export type ChainState = {
  position: ChainPosition;
  owedBy: ChainOwner;
  /**
   * The furthest column the thread actually **reached** — the same thing as
   * `position`, except on a closed one, where `position` is `closed` and this
   * still says where it stopped.
   *
   * The strip needs it: a rejected thread that had been quoted has two done
   * nodes and a chain that goes no further, and `closed` alone cannot draw
   * that. It is not a second derivation — `chainPosition` calls the same
   * function, so there is one ladder read twice rather than two ladders.
   */
  reached: ChainColumn;
};

/**
 * Furthest-along wins `S132`, so the order of these tests is the chain's own
 * order read backwards. A thread that is accepted *and* has an approved
 * dispatch is at `won`.
 */
export function chainState(input: ChainInput): ChainState {
  const position = chainPosition(input);
  return { position, owedBy: OWNERS[position], reached: chainReached(input) };
}

function chainPosition(input: ChainInput): ChainPosition {
  // Rejected and cancelled end the thread `S62`. `accepted` does NOT — it is
  // internal approval `S65`, and the chain carries on to the customer.
  if (input.endState && input.endState !== "accepted") return "closed";
  return chainReached(input);
}

/**
 * How far the chain travelled, ignoring whether it then ended.
 *
 * `new` is never returned: this takes a thread, and a thread that exists is
 * past it by definition. The board reaches `new` by having no live thread to
 * ask about at all `D29`.
 */
function chainReached(input: ChainInput): ChainColumn {
  const { versionStatus, endState, hasSubmittedDispatch, hasDispatch } = input;

  if (hasDispatch) return "won";
  if (hasSubmittedDispatch) return "readyToShip";
  if (endState === "accepted") return "withCustomer";
  if (versionStatus === "issued") return "quoted";
  return "requested";
}

/**
 * `D25`'s groups for a **quotation thread list** — a fold of `chainOwner`, not
 * a second ladder beside it.
 *
 * `D25` names three: *your move · waiting on the coordinator · waiting on the
 * customer*. Only two of them survive `S133`. At thread level the positions are
 * `requested` `quoted` `readyToShip` (hers), `withCustomer` (his) and
 * `won` `closed` (nobody's) — `new` is never a thread `[chainReached]` — so
 * once the `paid` rung left, **`withCustomer` is the only rep-owed position**
 * and *your move* and *waiting on the customer* select the same rows. `D25`
 * names one pile twice; the founder's call is two honest groups rather than
 * three invented ones, and the third name is superseded rather than preserved
 * by splitting something no rule splits (`WORKFLOW §5 AD16`).
 *
 * **`none` is not in `D25` at all.** A won or closed thread owes nobody, and a
 * list must still show every row it returns — so it is a third group at the
 * bottom rather than a default scope that hides last month's win behind a chip.
 * `D29`'s graveyard argument is about a board where columns compete for width;
 * a list only gets longer.
 *
 * **The reader's own name for their group is not here.** Where the reader IS
 * the coordinator the header reads *your move*, exactly the condition
 * `chainTurnKey` already splits the turn line on; that is a message key, and
 * the group is the same group either way.
 */
export const CHAIN_GROUPS = ["coordinator", "customer", "none"] as const;
export type ChainGroup = (typeof CHAIN_GROUPS)[number];

/**
 * Which of the three a position belongs to.
 *
 * Read off `chainOwner` and nothing else, so a change to `OWNERS` moves the
 * groups with it and the two cannot drift — the whole reason this module
 * exists `D27`.
 */
export function chainGroup(position: ChainPosition): ChainGroup {
  const owner = chainOwner(position);
  if (owner === "coordinator") return "coordinator";
  if (owner === "rep") return "customer";
  return "none";
}
