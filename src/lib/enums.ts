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

/* `WARMTHS` was here until `25 §6` cut it. Do not reintroduce it: the founder
 * does not recognise the term. Qualification is the founder's own word and the
 * thing warmth was reaching for — see `25 §16`, and `companyIsQualified`. */

/** `[07 C5]` — loss belongs to the project, rejection to the quotation. */
export const PROJECT_END_STATES = ["won", "lost", "dormant"] as const;
export type ProjectEndState = (typeof PROJECT_END_STATES)[number];

/**
 * `[25 §5]` — the one `loss_reasons.code` the application branches on.
 *
 * `other` requires the free text in `projects.loss_reason`; every other code
 * forbids it. That rule cannot be a CHECK — a CHECK may not subquery
 * `loss_reasons` to read the code behind a uuid — so it is enforced in
 * `src/lib/projects.ts`, and this is how it finds the row.
 *
 * It lives here rather than in the seed file because `src/` must never import
 * from `scripts/`; the seed imports it back. Same split as
 * `NOTIFICATION_TYPES`.
 */
export const OTHER_LOSS_REASON_CODE = "other";

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

/** `[20 §2]` — an interaction has a company; a field note has nobody. */
export const REPORT_ENTRY_TYPES = ["interaction", "field_note"] as const;
export type ReportEntryType = (typeof REPORT_ENTRY_TYPES)[number];

/** `[20 §3]` — how the interaction happened. */
export const REPORT_CHANNELS = [
  "visit",
  "call",
  "whatsapp",
  "email",
  "meeting",
] as const;
export type ReportChannel = (typeof REPORT_CHANNELS)[number];

/**
 * `[20 §3]` — what happened in the funnel. Exactly one per interaction.
 *
 * **There is deliberately no "asked for a quotation".** Qualification is
 * derived from a real quotation thread `[10 §1]`; an outcome claiming it would
 * be a second, softer definition that no thread backs. The form offers a button
 * that raises the request instead. Do not add the value — add a link.
 *
 * `technical_submitting` is `25 §2`'s addition, and `25 §1` is why it belongs
 * here rather than in a stage field: activities are **unordered and
 * repeatable** — any order, any number of times — while the quotation chain is
 * strictly ordered. Legacy's single stage dropdown conflated the two, which is
 * exactly why it went stale.
 */
export const REPORT_OUTCOMES = [
  "introduced",
  "catalogue_sent",
  "samples_sent",
  "documents_sent",
  "technical_submitting",
  "discussed_pricing",
  "no_answer",
  "not_interested",
  "on_hold",
  "other",
] as const;
export type ReportOutcome = (typeof REPORT_OUTCOMES)[number];

/** `[20 §5]` — the one outcome that requires a date and suppresses follow-ups. */
export const ON_HOLD_OUTCOME = "on_hold" satisfies ReportOutcome;

/** `[20 §2]` — what a field note was for. */
export const FIELD_NOTE_CATEGORIES = [
  "market_research",
  "scouting",
  "exhibition",
  "training",
  "internal",
] as const;
export type FieldNoteCategory = (typeof FIELD_NOTE_CATEGORIES)[number];

/**
 * `[20 §4]` — what the customer said that the business needs to know. Distinct
 * from the outcome, optional, many per report, and allowed on **any** report
 * rather than only a loss: a customer can say a competitor is cheaper and still
 * buy.
 */
export const REPORT_SIGNALS = [
  "price_too_high",
  "competitor_cheaper",
  "colour_unavailable",
  "lead_time_too_long",
  "quality_concern",
  "payment_terms",
  "specification_unavailable",
  "project_delayed",
  "other",
] as const;
export type ReportSignal = (typeof REPORT_SIGNALS)[number];

/**
 * `[20 §4]` — the four signals that invite a reference, so they aggregate:
 * competitor cheaper → the competitor's name, colour not available → the colour
 * code, specification we do not offer → the class or fire rating, other → free
 * text.
 *
 * This is a **form** concern, not a constraint. Every signal may carry a
 * reference in the database; these are the ones whose input is rendered, and
 * each has its own placeholder key so the rep is asked for the right thing.
 */
export const SIGNALS_WITH_REFERENCE = [
  "competitor_cheaper",
  "colour_unavailable",
  "specification_unavailable",
  "other",
] as const satisfies readonly ReportSignal[];

export function signalTakesReference(signal: ReportSignal): boolean {
  return (SIGNALS_WITH_REFERENCE as readonly ReportSignal[]).includes(signal);
}

/** The longest a signal reference may be — a name or a code, not a narrative. */
export const SIGNAL_REFERENCE_MAX = 200;

/**
 * `[25 §9]` — the five kinds of record a comment may hang on.
 *
 * The database says the same thing in the `comments_record_type` CHECK, stated
 * positively there because `record_type` is shared with seven other tables and
 * will grow for reasons that have nothing to do with comments. This list is
 * that CHECK in TypeScript: keep the two in step, and `scripts/verify-comments`
 * asserts the database refuses a sixth by constraint name.
 *
 * `quotation_version` is excluded on purpose — a comment belongs to the thread,
 * which is the conversation, not to one superseded version of it.
 */
export const COMMENT_RECORD_TYPES = [
  "company",
  "contact",
  "project",
  "quotation_thread",
  "dispatch",
] as const;
export type CommentRecordType = (typeof COMMENT_RECORD_TYPES)[number];

/**
 * `[25 §9]` — the longest a comment may be, matching a report's narrative.
 *
 * A comment is what colleagues say to each other about a record; there is no
 * reason a colleague note needs to run longer than the account of the visit it
 * is about. The cap is also what keeps the timeline legible: an uncapped body
 * breaks the layout on every screen that renders one, and comments render on
 * six of them.
 *
 * `25 §13`'s return-for-edit reason is a comment, so it takes this number
 * rather than a second one.
 */
export const COMMENT_BODY_MAX = 5000;

/**
 * `[07 B2]`, `[25 §30]` — the three kinds of record a **share** may be granted
 * on, which is half of what `record_type` carries.
 *
 * The other three are refused on the same evidence `21 §3` gives for not
 * notifying about them: no filter reads a share term for them, so a row there
 * would grant nothing. `visibleContactsFilter`, `visibleDispatchesFilter` and
 * `visibleRepReportsFilter` each say so in place in `src/lib/authz.ts`, and
 * `quotation_version` has no filter of its own at all — a version is reached
 * through its thread, so a share on one is a share on nothing.
 *
 * **This array is the source of truth and `SharedRecordType` derives from it**,
 * never the other way round. That is the correction `ANCHOR_TYPES` in
 * `notifications.ts` already carries: a hand-written list typed as the union
 * goes on compiling after the union grows, and the mismatch surfaces as a
 * feature that silently does nothing.
 *
 * There is no database CHECK to keep in step, unlike `COMMENT_RECORD_TYPES`:
 * `record_shares.record_type` deliberately carries the whole enum, because a
 * fourth shareable kind is a filter away rather than a migration away.
 */
export const SHARED_RECORD_TYPES = [
  "company",
  "project",
  "quotation_thread",
] as const;

/** `[07 E6]`, `[21 §6]` — the three routes out of dormancy. */
export const DORMANCY_OUTCOMES = [
  "reincluded",
  "reassigned",
  "archived",
] as const;
export type DormancyOutcome = (typeof DORMANCY_OUTCOMES)[number];

/**
 * The seeded notification types. The type is a lookup row `[10 §10]`, so these
 * are the **keys** of rows in `notification_types`, not an enum in the database.
 * They live here because the seed, the raising code and the screen all need the
 * same list, and this module imports nothing.
 *
 * The database key is dotted; the property name is what the message catalogue
 * keys off (`notifications.types.<name>`), because a dotted message id would
 * nest into an accidental object tree.
 *
 * **`21 §2` seeded five and was headed "no sixth"; `mention.received` is the
 * sixth, and that is not a reversal.** The rule `21 §2` states is a test rather
 * than a cap: *"Each type below is named in a user-truth document **and** has a
 * real event in the code that can raise it. Nothing else is seeded: a type
 * nothing produces is the shape of v1's dead approval gate."* A mention passes
 * both limbs — `25 §11` names it (*"Tagging a person raises a notification"*)
 * and `src/lib/comments.ts` raises it, in the change that added it. `21 §11`
 * kept the door open in the same words, recording `share.granted` as the one
 * seeded type whose *"raise call sits behind that path the day it exists"*.
 * `25` is also the later user-truth document, so it wins on its own.
 *
 * **It is act-now and NOT persistent** `[21 §4]`: persistence belongs only to a
 * type whose condition can clear, and being mentioned has none. Opening the
 * record is a click by another name, which `07 G1` rejects, and a reply is not
 * owed. So it is `record.handed_over`'s shape `[21 §5]` — news, dismissible —
 * and if a mention implies work, that work raises its own notification through
 * the normal path.
 */
export const NOTIFICATION_TYPES = {
  quotationExpired: "quotation.expired",
  recordAssigned: "record.assigned",
  recordHandedOver: "record.handed_over",
  shareGranted: "share.granted",
  followUpDigest: "followup.digest",
  mentionReceived: "mention.received",
} as const;

export type NotificationTypeName = keyof typeof NOTIFICATION_TYPES;
export type NotificationTypeKey =
  (typeof NOTIFICATION_TYPES)[NotificationTypeName];

export const NOTIFICATION_TYPE_NAMES = Object.keys(
  NOTIFICATION_TYPES,
) as NotificationTypeName[];

/** Database key back to the message-catalogue name, for rendering a row. */
export function notificationTypeName(
  key: string,
): NotificationTypeName | undefined {
  return NOTIFICATION_TYPE_NAMES.find(
    (name) => NOTIFICATION_TYPES[name] === key,
  );
}

/**
 * `[07 D5]` — the four follow-up conditions `src/lib/follow-ups.ts` derives.
 * `07 D5` lists five thresholds; the last two — qualified and unqualified —
 * are the same condition read at two different numbers, so they are one kind.
 */
export const FOLLOW_UP_KINDS = [
  "quotation_no_response",
  "catalogue_no_response",
  "project_stage_unchanged",
  "company_quiet",
] as const;
export type FollowUpKind = (typeof FOLLOW_UP_KINDS)[number];

/** `[20 §12]` — a lobby, not a desk. Applied only to the log form. */
export const TOUCH_INPUT_CLASS = "h-11 text-base";

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
