/**
 * The closed value sets that both a form and the data layer need.
 *
 * This module imports **nothing**, on purpose. A `"use client"` form has to
 * render the options, and if it reached into a data module for them it would
 * pull the Postgres driver into the browser bundle — which is exactly the
 * failure `npm run build` catches and `next dev` does not.
 *
 * Each tuple mirrors a pg enum in `src/db/schema.ts`. `assertSameValues` in
 * the data modules proves at compile time that the two agree, so adding a
 * value to the database and forgetting it here is a type error, not a
 * silently missing option in a dropdown.
 */

/** `[07 A7]` — a label, never an access boundary `[04 Q4]`. */
export const REGIONS = ["center", "north", "south", "east", "west"] as const;
export type Region = (typeof REGIONS)[number];

/** `[10 §1]` — the rep's judgement, deliberately not a percentage. */
export const WARMTHS = ["cold", "warm", "hot", "dormant"] as const;
export type Warmth = (typeof WARMTHS)[number];

/** `[07 C5]` — loss belongs to the project, rejection to the quotation. */
export const PROJECT_END_STATES = ["won", "lost", "dormant"] as const;
export type ProjectEndState = (typeof PROJECT_END_STATES)[number];

/**
 * `[07 C5]`, `[07 C4]`, `[07 C7]`.
 *
 * **`accepted` is internal approval, never a won deal** `[16 §5]`: it means
 * the coordinator has the signatures. The customer commits later, at
 * `payment_confirmed_at` and then `accepted_for_processing_at`. Nothing that
 * counts, ranks or forecasts may read this value as "bought".
 */
export const QUOTATION_THREAD_END_STATES = [
  "accepted",
  "rejected",
  "cancelled",
  "expired",
] as const;
export type QuotationThreadEndState =
  (typeof QUOTATION_THREAD_END_STATES)[number];

/** `[10 §4]` + `[07 C2]` — the request is version 1; only one version is live. */
export const QUOTATION_VERSION_STATUSES = [
  "requested",
  "issued",
  "superseded",
] as const;
export type QuotationVersionStatus =
  (typeof QUOTATION_VERSION_STATUSES)[number];

/** `[07 C2]`, `[07 C7]`, plus `initial_request` for version 1 `[10 §4]`. */
export const QUOTATION_VERSION_ORIGINS = [
  "initial_request",
  "rep_change_request",
  "coordinator_direct_edit",
  "expiry_revision",
] as const;
export type QuotationVersionOrigin =
  (typeof QUOTATION_VERSION_ORIGINS)[number];

/** `[04 A2]` — a human typed the SMAC number, so it can be wrong. */
export const SMAC_VERIFICATIONS = ["unverified", "verified"] as const;
export type SmacVerification = (typeof SMAC_VERIFICATIONS)[number];

/**
 * `[16 §2]` — the Saudi rate, as a **default** and nothing more. FACET does
 * not do tax; SMAC does `[04 A1]`. The value lives here so a client form and
 * the data layer prefill the same number.
 */
export const DEFAULT_VAT_RATE = "15.00";

/** `[08 D3]` — offered as defaults, both editable; constraining them would
 *  block real orders. Sheets only `[12 §11]`. */
export const DEFAULT_SHEET_WIDTH_M = "1.2400";
export const DEFAULT_SHEET_LENGTH_M = "5.8000";

/**
 * Both directions of assignability, so neither tuple may drift from its
 * database enum. Used as a type-level assertion in the data modules.
 */
export type SameValues<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : never
  : never;
