import type {
  QuotationThreadEndState,
  QuotationVersionStatus,
} from "@/lib/enums";

/**
 * **The one definition of chain position.** `25 §3`.
 *
 * The quotation chain is the strictly-ordered half of `25 §1` — no quotation →
 * requested → issued → accepted → paid → dispatched — as against the activities,
 * which are unordered and repeatable. `25 §3` names the six positions and says
 * they are *computed from real events*: always accurate, never stale, nothing to
 * maintain, and they answer whose move it is, which is `22 §4`'s rule.
 *
 * **Anything that needs a chain position calls this.** The turn column on
 * `/quotations`, the turn panel on a quotation, and `22 §6.6`'s **chain strip**
 * on the quotation and project detail screens — which draws `CHAIN_COLUMNS`
 * and labels each step from `chainOwner`, rather than re-deriving the same six
 * positions from the same three fields. The board of `25 §3` is next, and its
 * columns *are* these positions.
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
 * `25 §3`'s six columns, **in order**.
 *
 * `new` is a **project** with no quotation thread at all — a thread can never
 * be in it, since raising one creates version 1. It is named here because the
 * board's first column is this position and the board must not define its own.
 *
 * The order is the chain's own, and two callers depend on it: the strip walks
 * it forwards to draw six nodes, and `chainReached` tests it backwards because
 * furthest-along wins.
 */
export const CHAIN_COLUMNS = [
  "new",
  "requested",
  "waitingSignature",
  "waitingPayment",
  "paid",
  "dispatched",
] as const;

/**
 * The six columns, plus the terminal case.
 *
 * `closed` is not a `25 §3` column: `25 §5` keeps a lost project off the board
 * and `16 §5` ends a thread at rejected, cancelled or expired. Nobody owes the
 * next action on one, which is the only thing `22 §4` asks. So the board and
 * the strip take `CHAIN_COLUMNS`, and only a *position* can be `closed` —
 * derived from the one list above rather than restating six names beside it.
 */
export const CHAIN_POSITIONS = [...CHAIN_COLUMNS, "closed"] as const;
export type ChainPosition = (typeof CHAIN_POSITIONS)[number];

/** A column, never the terminal case — what `reached` and the strip index. */
export type ChainColumn = (typeof CHAIN_COLUMNS)[number];

/**
 * Who owes the next action at a position — `22 §4`'s question, not a
 * permission. `null` means nobody does, because the chain has ended.
 */
export type ChainOwner = "rep" | "coordinator" | null;

const OWNERS: Record<ChainPosition, ChainOwner> = {
  // A project with no quotation is the rep's to quote.
  new: "rep",
  // Raised; the coordinator builds the real quotation in SMAC `[07 C2]`.
  requested: "coordinator",
  // Issued; the coordinator is getting it signed and will accept it here.
  waitingSignature: "coordinator",
  // Internal approval is in. The customer commits by paying, and the rep is
  // the one who confirms that `[16 §5]` — `accepted` is never a won deal.
  waitingPayment: "rep",
  // Paid; the rep raises the dispatch request and the coordinator checks and
  // approves it `S72`. The first move is the rep's — the coordinator owes
  // nothing until a request exists, so the rung cannot be hers.
  paid: "rep",
  dispatched: null,
  closed: null,
};

/**
 * Who owes the next action at **any** position, not only the current one.
 *
 * `chainState().owedBy` answers for the position a thread is actually in; the
 * chain strip labels all six steps with whose move each is `[22 §4]`, and the
 * board's column headers will want the same. Both read this map rather than
 * writing a second one — which is the whole reason this module exists.
 */
export function chainOwner(position: ChainPosition): ChainOwner {
  return OWNERS[position];
}

export type ChainInput = {
  /** The live version's status — never `superseded`, by definition. */
  versionStatus: QuotationVersionStatus;
  endState: QuotationThreadEndState | null;
  paymentConfirmedAt: Date | null;
  /**
   * Whether anything has actually left the warehouse against this thread.
   *
   * Optional because **a quotation thread row cannot answer it** — dispatch
   * lives in its own table — so a caller that has not loaded dispatches omits
   * it and the chain stops at `paid` rather than claiming a position it cannot
   * see. `24 §"partial dispatches are the expected case"` is why this is a
   * boolean and not a quantity: the position is *has any gone out*, and the
   * unfulfilled remainder is deliberately never shown as a number `[25 §26]`.
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
   * The strip needs it: a rejected thread that had been issued has two done
   * nodes and a chain that goes no further, and `closed` alone cannot draw
   * that. It is not a second derivation — `chainPosition` calls the same
   * function, so there is one ladder read twice rather than two ladders.
   */
  reached: ChainColumn;
};

/**
 * Furthest-along wins, so the order of these tests is the chain's own order
 * read backwards. A thread that is accepted *and* paid is at `paid`.
 */
export function chainState(input: ChainInput): ChainState {
  const position = chainPosition(input);
  return { position, owedBy: OWNERS[position], reached: chainReached(input) };
}

function chainPosition(input: ChainInput): ChainPosition {
  // Rejected, cancelled and expired end the thread. `accepted` does NOT — it
  // is internal approval `[16 §5]`, and the chain carries on to payment.
  if (input.endState && input.endState !== "accepted") return "closed";
  return chainReached(input);
}

/**
 * How far the chain travelled, ignoring whether it then ended.
 *
 * `new` is never returned: this takes a thread, and a thread that exists is
 * past it by definition. The board reaches `new` by having no thread to ask
 * about at all.
 */
function chainReached(input: ChainInput): ChainColumn {
  const { versionStatus, endState, paymentConfirmedAt, hasDispatch } = input;

  if (hasDispatch) return "dispatched";
  if (paymentConfirmedAt) return "paid";
  if (endState === "accepted") return "waitingPayment";
  if (versionStatus === "issued") return "waitingSignature";
  return "requested";
}
