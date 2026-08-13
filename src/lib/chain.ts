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
 * **Anything that needs a chain position calls this.** Today that is the turn
 * column on `/quotations` and the turn panel on a quotation. When `22 §6.6`'s
 * deferred **chain strip** is built, it consumes this helper verbatim rather
 * than re-deriving the same six positions from the same three fields — and so
 * does the board of `25 §3`, whose columns *are* these positions.
 *
 * Two derivations of one rule is how the quiet-threshold trap `21 §7` names
 * came about: `follow-ups.ts` owns "quiet", and `isCompanyQuiet` exists so that
 * a second screen cannot invent a second answer. The chain is the next-largest
 * candidate for the same mistake, so it gets the same treatment before there is
 * a second caller rather than after.
 *
 * **This module imports nothing but types**, like `enums.ts` beside it, so a
 * `"use client"` component may import it without pulling the Postgres driver
 * into the browser bundle. Keep it that way: no query, no session, no `db`.
 */

/**
 * `25 §3`'s six columns, plus the terminal case.
 *
 * `new` is a **project** with no quotation thread at all — a thread can never
 * be in it, since raising one creates version 1. It is named here because the
 * board's first column is this position and the board must not define its own.
 *
 * `closed` is not a `25 §3` column: `25 §5` keeps a lost project off the board
 * and `16 §5` ends a thread at rejected, cancelled or expired. Nobody owes the
 * next action on one, which is the only thing `22 §4` asks.
 */
export const CHAIN_POSITIONS = [
  "new",
  "requested",
  "waitingSignature",
  "waitingPayment",
  "paid",
  "dispatched",
  "closed",
] as const;
export type ChainPosition = (typeof CHAIN_POSITIONS)[number];

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
  // Paid unlocks dispatch `[07 C3]`, which the coordinator records.
  paid: "coordinator",
  dispatched: null,
  closed: null,
};

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
};

/**
 * Furthest-along wins, so the order of these tests is the chain's own order
 * read backwards. A thread that is accepted *and* paid is at `paid`.
 */
export function chainState(input: ChainInput): ChainState {
  const position = chainPosition(input);
  return { position, owedBy: OWNERS[position] };
}

function chainPosition(input: ChainInput): ChainPosition {
  const { versionStatus, endState, paymentConfirmedAt, hasDispatch } = input;

  // Rejected, cancelled and expired end the thread. `accepted` does NOT — it
  // is internal approval `[16 §5]`, and the chain carries on to payment.
  if (endState && endState !== "accepted") return "closed";

  if (hasDispatch) return "dispatched";
  if (paymentConfirmedAt) return "paid";
  if (endState === "accepted") return "waitingPayment";
  if (versionStatus === "issued") return "waitingSignature";
  return "requested";
}
