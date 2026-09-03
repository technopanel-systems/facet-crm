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

/**
 * `S14` `S15` — the ISO 3166-1 alpha-2 code of the one country the application
 * knows by name. Saudi companies are asked for a city and get a derived region;
 * everyone else has neither.
 *
 * Not a pg enum like the rest of this file — `countries` is a lookup table, so
 * this is a row's `code`, not a type. It lives here anyway for the reason the
 * file exists: the company form branches on it to decide whether to render the
 * city field at all, and `lib/lookups.ts` branches on it to decide what is
 * written. Two copies of a load-bearing string is how they drift apart.
 */
export const SAUDI_CODE = "SA";

/* `WARMTHS` was here until `25 §6` cut it. Do not reintroduce it: the founder
 * does not recognise the term. Qualification is the founder's own word and the
 * thing warmth was reaching for — see `25 §16`, and `companyIsQualified`. */

/**
 * `[07 C5]` — loss belongs to the project, rejection to the quotation.
 *
 * **One value on purpose.** `S31` derives `won` from an approved dispatch, so
 * nothing may set it here, and `dormant` had no rule behind it. This is the
 * list the project form offers, so it is also the reason that select now reads
 * *Open · Lost* and nothing else.
 */
export const PROJECT_END_STATES = ["lost"] as const;

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
 * `[07 C5]`, `[07 C4]` — the three states the **coordinator** may set `S62`.
 *
 * **`expired` is not among them, and is not a state at all** `S67`. It was one
 * until `0014`, which made it a fact computed from `valid_until` at read time;
 * `0018` then took the date too, because validity is SMAC's. A terminal state
 * said the thread was over, which is the opposite of what the rule says.
 *
 * **`accepted` is internal approval, never a won deal** `S65`: it means the
 * coordinator has the signatures. The customer is then deciding, which `S132`
 * names *with the customer* — the longest wait in the business, and the rep's
 * to chase. Nothing that counts, ranks or forecasts may read this value as
 * "bought": winning is an approved dispatch `S31`.
 */
export const QUOTATION_THREAD_END_STATES = [
  "accepted",
  "rejected",
  "cancelled",
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

/**
 * `[07 C2]`, plus `initial_request` for version 1 `[10 §4]`.
 *
 * **`expiry_revision` is gone** `S67`. It named a revision raised after a
 * validity date had passed, and only a screen reading the computed `expired`
 * fact could set it. FACET carries no validity date, so nothing can.
 */
export const QUOTATION_VERSION_ORIGINS = [
  "initial_request",
  "rep_change_request",
  "coordinator_direct_edit",
] as const;
export type QuotationVersionOrigin =
  (typeof QUOTATION_VERSION_ORIGINS)[number];

/** `[04 A2]` — a human typed the SMAC number, so it can be wrong. */
export const SMAC_VERIFICATIONS = ["unverified", "verified"] as const;
export type SmacVerification = (typeof SMAC_VERIFICATIONS)[number];

/**
 * `S118` — the four stocks a quotation may be drawn from. FACET holds no
 * inventory, only the name SMAC needs.
 *
 * A pg enum rather than a lookup table, for the reasons `stockEnum` carries in
 * `src/db/schema.ts`. What matters here is the consequence: this list is the
 * one a `"use client"` form renders its four options from, and `SameValues` in
 * `src/lib/quotations.ts` proves at compile time that it still agrees with the
 * database.
 *
 * The English names are SMAC's own. The Arabic labels are in `messages/*.json`
 * and carry `مخزن`, because in Arabic the classifier is what makes each read
 * as a stock rather than as a city.
 */
export const STOCKS = ["riyadh", "malham", "south", "dammam"] as const;
export type Stock = (typeof STOCKS)[number];

/**
 * `S71` — the six ways a customer pays, recorded on the **dispatch** `S70`,
 * because the coordinator is the one who confirms it with finance.
 *
 * A pg enum rather than free text, and that is the whole change `S70` makes.
 * `quotation_versions.payment_method` was nullable `text` with no vocabulary at
 * all, and what reps typed into it — *"50% advance"* — is not one of these six.
 * A closed set fixed by a rule is an enum `[schema.ts]`; a seventh way to pay
 * earns a migration.
 *
 * **`handled_by_finance` is the escape hatch the rule names**, not a gap in the
 * list: credit, تساهيل, or a company contract, all settled in SMAC `S3`, where
 * FACET carries the reference only. `payment_note` carries anything the six do
 * not `S71`, and it is optional.
 *
 * The display names live in `messages/*.json`, so rewording one costs no
 * migration.
 */
export const PAYMENT_METHODS = [
  "on_delivery",
  "card_in_office",
  "cash_in_office",
  "bank_transfer_full",
  "bank_transfer_downpayment",
  "handled_by_finance",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * `S119` — CT (the customer's own truck), TT (a Technopanel truck), Cargo (a
 * third party). The rep chooses when requesting.
 *
 * **This list branches on identity, which is why it is an enum**: *a dispatch
 * from South or Dammam stock is CT*, and that is a row-local CHECK naming the
 * token `'ct'` outright. `stockEnum` carries the same argument for the same
 * reason `S118`.
 *
 * **`Cargo` alone carries a destination note**, and it is optional `S119`. The
 * database refuses one on a CT or TT dispatch rather than discarding it — a
 * silently dropped input is the defect `AUDIT 1 F3` recorded.
 *
 * That TT is discouraged at Malham is **the coordinator's knowledge, not a rule
 * FACET enforces** `S119`. Nothing here refuses it, and nothing should.
 */
export const SHIPMENT_METHODS = ["ct", "tt", "cargo"] as const;
export type ShipmentMethod = (typeof SHIPMENT_METHODS)[number];

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
 * `S114` — the **two** kinds of record a comment may hang on.
 *
 * The database says the same thing in the `comments_record_type` CHECK, stated
 * positively there because `record_type` is shared with four other tables and
 * will grow for reasons that have nothing to do with comments. This list is
 * that CHECK in TypeScript: keep the two in step, and `scripts/verify-comments`
 * §1 asserts the database refuses a company, a contact and a dispatch by
 * constraint name.
 *
 * **It admitted five until session `27b`.** A company, a contact and a dispatch
 * each took one, which `S114` forbids in its own words. The reason is
 * disclosure rather than tidiness: a comment follows its anchor `S131`, so one
 * on a company reached everyone holding a share of that company — wider than
 * `S38` gives a report's private note, which has no equivalent here to
 * withhold.
 *
 * `quotation_version` was never admitted, and for a different reason: a comment
 * belongs to the thread, which is the conversation, not to one superseded
 * version of it. `0027` dropped the value from `record_type` entirely.
 *
 * **This union is narrower than `record_type`**, which still carries all five
 * for `record_shares`, `duplicate_flags` and `attachments`.
 * A raw `comments.record_type` column therefore no longer assigns to
 * `CommentRecordType` — narrow it at the read site, as `listComments` and
 * `timeline.ts` do.
 */
export const COMMENT_RECORD_TYPES = ["project", "quotation_thread"] as const;
export type CommentRecordType = (typeof COMMENT_RECORD_TYPES)[number];

/**
 * `[25 §9]` — the longest a comment may be, matching a report's narrative.
 *
 * A comment is what colleagues say to each other about a record; there is no
 * reason a colleague note needs to run longer than the account of the visit it
 * is about. The cap is also what keeps the timeline legible: an uncapped body
 * breaks the layout on every screen that renders one, and since `27b` comments
 * render on two of them `S114`.
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
 *
 * **`S92`'s two added items are the fifth and sixth, and both are news.**
 * *A bell carries news only, never work* — *the news also carries credit
 * granted to you (`S129`), and a decision that ended your work (`S128`)*.
 * Nothing is waiting on the person told by either, which is the same sentence
 * `S92` uses to say why neither belongs on `S87`'s list. Both pass `21 §2`'s
 * two-limb test: named in `SPEC.md` and raised by real code in the slice that
 * added them — `cancelDispatch`, `refuseDispatchRequest`, `rejectThread` and
 * `cancelThread` for the first, `setCreditSplit` for the second.
 *
 * **Both are act-now and NOT persistent**, `mention.received`'s shape and for
 * its reason: `21 §4` gives persistence only to a type whose condition can
 * clear, and neither of these has one. A refusal has already happened; a share
 * of credit has already been given. There is nothing to do but read it. That is
 * also what keeps them clear of the persistence machinery `S91` deletes — see
 * the note above `DecisionPayload` in `src/lib/notifications.ts`.
 *
 * **`followup.digest` is gone `S91`.** It was the seventh, and the only one
 * that carried WORK rather than news: one daily summary of what had gone stale,
 * which is `S87`'s list said a second time and a day late. `S92` names six and
 * this is the six. Nothing else left with it — the digest was the only type
 * standing on a tier, a `digest_date` or a resolution condition.
 */
export const NOTIFICATION_TYPES = {
  recordAssigned: "record.assigned",
  recordHandedOver: "record.handed_over",
  shareGranted: "share.granted",
  mentionReceived: "mention.received",
  decisionEndedWork: "decision.ended_work",
  creditGranted: "credit.granted",
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
 * The six follow-up conditions `src/lib/follow-ups.ts` derives.
 *
 * Four are `07 D5`'s: it lists five thresholds, and the last two — qualified
 * and unqualified — are the same condition read at two different numbers, so
 * they are one kind.
 *
 * Two are newer, and neither is a notification type — `21 §2`'s "five types
 * and no sixth" is about deliveries, and **a follow-up is not a delivery**: all
 * six reach the rep by being ON the list `S91`, which is the whole of that
 * rule. They used to reach him through one `followup.digest` as well, and that
 * type is deleted:
 *
 *  - `quotation_returned` — returned for edits and not yet resubmitted, the
 *    gap `22 §6.11` recorded and held back until the slice-2 tag had been
 *    seen working. Its threshold is a sixth `settings` row, `07 D5`'s shape.
 *  - `date_due` — the rep's own `next_follow_up_at` has arrived `[25 §18]`.
 *    It has no threshold: the date IS the condition.
 */
export const FOLLOW_UP_KINDS = [
  "quotation_no_response",
  "quotation_returned",
  "catalogue_no_response",
  "project_stage_unchanged",
  "company_quiet",
  "date_due",
] as const;
export type FollowUpKind = (typeof FOLLOW_UP_KINDS)[number];

/**
 * `D33` — the four tiles the counts strip shows over those six conditions.
 *
 * **No condition is dropped; they are grouped.** Six equal-weight tiles where
 * four would do is the thing `D21` names outright, and the two pairs below are
 * the two places a rep reads one question rather than two: a quotation that has
 * gone unanswered and one sent back for edits are both *the quotation is
 * stuck*, and a company that has gone quiet and a catalogue that drew no reply
 * are both *nobody is talking to this customer*.
 *
 * **It is a grouping, never a second definition.** `FOLLOW_UP_KINDS` stays the
 * one list `follow-ups.ts` derives; this maps four names onto it and the
 * `satisfies` below makes a kind added to that list without a home here a
 * type error rather than a tile that silently under-counts.
 */
export const FOLLOW_UP_GROUPS = {
  quotations: ["quotation_no_response", "quotation_returned"],
  quiet: ["company_quiet", "catalogue_no_response"],
  notMoved: ["project_stage_unchanged"],
  yourDates: ["date_due"],
} as const satisfies Record<string, readonly FollowUpKind[]>;

/**
 * The four names, **derived from the map above rather than restated** — the
 * shape `chain.ts` uses for `CHAIN_POSITIONS`. A second literal list is a
 * second definition, and the one that drifts is always the copy.
 */
export type FollowUpGroup = keyof typeof FOLLOW_UP_GROUPS;
export const FOLLOW_UP_GROUP_NAMES = Object.keys(
  FOLLOW_UP_GROUPS,
) as FollowUpGroup[];

/** Narrowed against the list, never cast — a URL is user input. */
export function asFollowUpGroup(
  value: string | undefined,
): FollowUpGroup | undefined {
  return FOLLOW_UP_GROUP_NAMES.find((name) => name === value);
}

/** `D74` — the 44px floor a thumb needs, `[20 §12]`'s lobby-not-a-desk.
 *  Applied only to the log form, `D55`'s phone-first screen. */
export const TOUCH_INPUT_CLASS = "h-11 text-base";

/**
 * **VAT is fixed at 15% and is never editable** `S57`. The Saudi rate, as a
 * constant and not a default: no column stores it, no form offers it, and this
 * is the only place it is written down.
 *
 * FACET still does not do tax — SMAC does `S3`. What FACET keeps is the
 * *amount*, mirrored into `vat_amount`, `total_vat` and `grand_total`, because
 * those are figures SMAC owns and FACET shows. The rate that produced them is
 * not a fact about a line; it is a fact about the country.
 */
export const VAT_RATE = "15.00";

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
