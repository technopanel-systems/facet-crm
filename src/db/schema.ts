/**
 * FACET — Drizzle schema.
 *
 * Source of truth: `docs/09-schema-design.md` §2–13 for table shapes,
 * `docs/10-schema-decisions.md` where the two differ (10 wins).
 * Every table below cites the document that requires it. Nothing here is
 * invented; where a document leaves something open it is left out, not filled
 * in — see `docs/10 §13` for the list that is still open.
 *
 * Cross-cutting conventions from `09 §1`, applied to every table:
 *
 *  1. Soft state, never deletion of history. Business events are recorded as
 *     `deactivated_at`, `archived_at`, `removed_at`, `revoked_at`,
 *     `merged_into_id` or a superseding row — never by deleting.
 *  2. Bilingual names plus a normalised form. `name_en` / `name_ar` on the
 *     lookup tables and on projects; `name_normalized` additionally on
 *     companies, contacts and projects, which are what duplicate matching
 *     compares. Companies and contacts carry **one** `name`, written in
 *     English or Arabic `S12` `S19` — with a mandatory phone as the primary
 *     matching key `S23`, a second name column stopped earning its cost.
 *  3. ERP references carry a verification state. Every SMAC reference number
 *     is typed by a human, so it sits beside a verification status and can be
 *     corrected `[04 A2]`.
 *  4. One authorization layer, in application code. No RLS, no database
 *     policies. The visibility tables here are data the application reads;
 *     they are not enforcement `[03]`.
 *  5. Polymorphic record references use a `record_type` + `record_id` pair.
 *  6. Audit is written by the data layer, so no table carries its own
 *     change-history columns beyond `created_at` / `created_by` where a
 *     document requires knowing the creator. There is deliberately no
 *     `updated_at` anywhere.
 *
 * Auth.js session/account tables (`sessions`, `accounts`, plus
 * `users.email_verified` / `users.image`) carry the shape the library dictates
 * `[09 §2.2]`, `[03]` — added in phase 6 with the Drizzle adapter, not
 * designed here. `verification_tokens` was in that set until `SPEC §15`
 * dropped it; the note above `accounts` says which of them the adapter
 * actually requires, and why.
 */

import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ *
 * Column conventions
 * ------------------------------------------------------------------ */

const pk = () => uuid("id").primaryKey().defaultRandom();

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** Square metres, dimensions, percentages. */
const SQM = { precision: 14, scale: 4 } as const;
/** Money. FACET mirrors SMAC's figures; SMAC owns them `[08 D5]`. */
const MONEY = { precision: 14, scale: 2 } as const;

/* ------------------------------------------------------------------ *
 * Enums — closed value sets fixed by a document.
 * Anything a document says stays editable is a lookup table instead.
 * ------------------------------------------------------------------ */

/** `[07 A7]` — a label, never an access boundary `[04 Q4]`. */
export const regionEnum = pgEnum("region", [
  "center",
  "north",
  "south",
  "east",
  "west",
]);

/* `warmth` was an enum here until `25 §6`. `10 §1` proposed Cold / Warm / Hot /
 * Dormant, set by the rep; the founder does not recognise the term and cut it
 * entirely. Nothing had ever written a value — 0 of 177 companies — so the
 * columns and the type went with it. `10 §1`'s derived-qualification half
 * stands `[25 §16]`, and qualification is still a correlated EXISTS over
 * quotation threads, never a column. */

/**
 * `[09 §1]` — the polymorphic record reference used across the schema.
 *
 * **`quotation_version` was a sixth until `0027`.** It was the canonical dead
 * enum value — the shape `dispatchStatusEnum` cites below for why `cancelled`
 * waited for its writer. Nothing ever set it: `comments_record_type` excluded
 * it, `SHARED_RECORD_TYPES` and `ANCHOR_TYPES` exclude it, and 0 rows carried
 * it across all seven columns of this type. A version is reached through its
 * thread, which is the conversation; nothing hangs off one directly. The
 * `entityType: "quotation_version"` strings in `quotations.ts` are
 * `audit_log.entity_type`, which is free text and not this type.
 */
export const recordTypeEnum = pgEnum("record_type", [
  "company",
  "contact",
  "project",
  "quotation_thread",
  "dispatch",
]);

/** `[04 A2]` — a human typed the SMAC number, so it can be wrong. */
export const smacVerificationEnum = pgEnum("smac_reference_verification", [
  "unverified",
  "verified",
]);

/**
 * `[09 §3.2]` — how a rep's membership of a company arose. `'shared'` and
 * `'merge'` were dropped in feature slice 6 `[26 §2]`: application code has
 * never written either, only the two origins below.
 */
export const companyRepOriginEnum = pgEnum("company_rep_origin", [
  "self_registered",
  "assigned",
]);

/**
 * `[07 E6]`, `[21 §6]` — the three routes out of dormancy. A quiet company is
 * notified and then re-included with the same rep, reassigned, or archived as
 * out of scope. Nothing is ever deleted `[12 §7]`.
 */
export const dormancyOutcomeEnum = pgEnum("dormancy_outcome", [
  "reincluded",
  "reassigned",
  "archived",
]);

/**
 * `[07 C5]` — **one value, and it is the rep's judgement.**
 *
 * `won` came out with `S31`: a project is won when a dispatch against it is
 * approved, which is a real event this column could only ever have claimed by
 * hand. It is derived now — `projectIsWon` in `src/lib/projects.ts` — so no
 * value here may name it. `dormant` came out beside it because no rule ever
 * defined it and nothing had written one (`AUDIT 1`, `WORKFLOW §5`).
 *
 * What is left is `S29`'s fourth item, and only that: **lost, with a reason**,
 * which closes the project. The three CHECKs on `projects` below pair it with
 * its reason from both directions.
 */
export const projectEndStateEnum = pgEnum("project_end_state", ["lost"]);

/**
 * `[07 C5]`, `[07 C4]` — the three the coordinator may set `S62`.
 *
 * `expired` was a fourth until `S67`, which took the state. `0018` then took
 * the date it was computed from: FACET carries no validity and no expiry at
 * all. See `0014`'s header for why removing an enum value is not a drop.
 */
export const quotationThreadEndStateEnum = pgEnum(
  "quotation_thread_end_state",
  ["accepted", "rejected", "cancelled"],
);

/**
 * `[10 §4]` + `[07 C2]`. The rep's request is version 1 (`requested`); the
 * coordinator filling in the SMAC reference makes it `issued`; a later version
 * pushes it to `superseded`. Only one version per thread is live.
 */
export const quotationVersionStatusEnum = pgEnum("quotation_version_status", [
  "requested",
  "issued",
  "superseded",
]);

/**
 * `[07 C2]`, plus `initial_request` for version 1 `[10 §4]`.
 *
 * `expiry_revision` was a fourth until `S67`. It named a revision raised after
 * a quotation had passed its validity date, and the only thing that could set
 * it was a screen reading the computed `expired` fact. `S67` takes validity out
 * of FACET, so there is no fact to read and nothing can write the value. See
 * `0018`'s header for why removing an enum value is not a column drop.
 */
export const quotationVersionOriginEnum = pgEnum("quotation_version_origin", [
  "initial_request",
  "rep_change_request",
  "coordinator_direct_edit",
]);

/**
 * `S118` — the four stocks a quotation may be drawn from. FACET holds no
 * inventory; it holds the name SMAC's inventory needs.
 *
 * **An enum rather than a lookup table**, on the test at the head of this
 * block: a closed set fixed by a document is an enum, and anything a document
 * says stays editable is a table. `S118` says *fixed list*, and the four
 * neighbours that look similar are all editable by design — `cities` grows,
 * `lead_sources` expects marketing channels to multiply, `loss_reasons` and the
 * product lookups are seeded vocabularies someone may extend. A fifth stock is
 * a new warehouse, which earns a migration.
 *
 * The deciding argument is `S119`, which branches on identity: *a dispatch from
 * South or Dammam stock is CT*. A uuid into an editable table cannot carry that
 * safely — the row can be renamed or removed out from under the code — which is
 * why `loss_reasons` needed `OTHER_LOSS_REASON_CODE`. Here `enums.ts` mirrors
 * the type and `SameValues` makes drift a compile error.
 *
 * The display names live in `messages/*.json`, so rewording a label costs no
 * migration at all.
 *
 * **The dispatch half of `S118` is not built.** A dispatch drawing from a
 * different stock, the coordinator changing it until approval, and the freeze
 * after all need a dispatch request to hang on. This type is the one they will
 * use when they arrive — no module invents its own version of it `[CLAUDE.md]`.
 */
export const stockEnum = pgEnum("stock", [
  "riyadh",
  "malham",
  "south",
  "dammam",
]);

/**
 * `S71` — the six ways a customer pays, on the **dispatch** and not the
 * quotation `S70`. The coordinator records it, because she is the one who
 * confirms it with finance.
 *
 * **This is what replaced free text.** `quotation_versions.payment_method` was
 * nullable `text` with no vocabulary, and the values reps actually typed into
 * it — `'50% advance'` — are none of these six. A closed set fixed by a rule is
 * an enum, on the test at the head of this block; a seventh way to pay is a
 * new commercial arrangement and earns a migration.
 *
 * `handled_by_finance` is the escape hatch `S71` names — credit, تساهيل or a
 * company contract, settled in SMAC `S3`, where FACET carries the reference
 * only — and `payment_note` beside it carries anything the six do not.
 *
 * **Nullable on the column, and `S73` is why.** A request is raised, edited and
 * submitted with no payment method at all: it is not the rep's to answer. The
 * `dispatches_payment_method` CHECK is what makes it required, and only at the
 * moment it is required — approval.
 */
export const paymentMethodEnum = pgEnum("payment_method", [
  "on_delivery",
  "card_in_office",
  "cash_in_office",
  "bank_transfer_full",
  "bank_transfer_downpayment",
  "handled_by_finance",
]);

/**
 * `S119` — CT (the customer's own truck), TT (a Technopanel truck), Cargo (a
 * third party). The rep chooses when requesting.
 *
 * **An enum because the rule branches on identity**, exactly as `stockEnum`'s
 * header argues for the four stocks: *a dispatch from South or Dammam stock is
 * CT*. That is `dispatches_stock_shipment`, a row-local CHECK naming both
 * tokens outright, and a uuid into an editable table could not carry it.
 *
 * **That TT is discouraged at Malham is the coordinator's knowledge, not a rule
 * FACET enforces** `S119`. Nothing refuses it and nothing should — the rule
 * says so in its own last sentence, so an implementation that helpfully blocked
 * it would be breaking the rule rather than enforcing it.
 */
export const shipmentMethodEnum = pgEnum("shipment_method", [
  "ct",
  "tt",
  "cargo",
]);

/* `form_factor` was an enum here until `0027`. `[08 B2]` defined it and
 * `12 §11` immediately narrowed it — *quotation lines are sheets only; coils
 * belong to production* — so the application wrote `'sheet'` on every one of
 * 850 lines and nothing ever set `coil`. `quotation_lines.form_factor` was its
 * only column and read by nothing, so the column and the type went together.
 * `dispatch_lines` had already refused to copy it `S116`. */

/**
 * `S72` — the life of a dispatch, from the rep's request to the coordinator's
 * approval.
 *
 * **One row throughout, and that is the whole design decision.** `S72`'s own
 * sentence — *"an approved dispatch is the only event that credits a target —
 * not the request"* — describes one thing at two points of its life, not two
 * things in two tables. A second table would need a second set of lines and a
 * copy at approval, and `S120` then has to compare a dispatch's lines to its
 * version's **and record who made each difference, the rep before submitting or
 * the coordinator after**, which a copy boundary destroys.
 *
 * | | who holds it | what it is |
 * |---|---|---|
 * | `draft` | the rep | raised, still theirs to edit `S125` |
 * | `submitted` | the coordinator | waiting on her `S88`, and hers to edit `S62` |
 * | `approved` | nobody | the event that credits a target `S72` |
 * | `refused` | nobody | archived with a reason `S124`, revivable by her `S122` |
 * | `cancelled` | nobody | undone after approval `S73`, with a reason, never revived |
 *
 * **`cancelled` arrived with its writer, which is the whole rule about it.**
 * `S72`'s slice left it out deliberately — it would have been a dead enum
 * value, `record_type.quotation_version`'s shape (`WORKFLOW §5`) — and
 * `cancelDispatch` is what it was waiting for.
 *
 * It is **not** a way back to `submitted`. *Approval is final* `S73`: a
 * cancelled dispatch keeps its approval stamps, its payment method, its SMAC
 * number and its difference flag `S31`, and no act moves it anywhere. What
 * changes is that it stops counting — `approvedDispatches()` reads
 * `status = 'approved'`, so un-winning `S31` and de-crediting `S85` need no
 * second writer.
 */
export const dispatchStatusEnum = pgEnum("dispatch_status", [
  "draft",
  "submitted",
  "approved",
  "refused",
  "cancelled",
]);

/** `[07 B6]` — entry-time matching is the norm, the manager's queue the exception. */
export const duplicateFlagSourceEnum = pgEnum("duplicate_flag_source", [
  "entry_match",
  "manual",
]);

export const duplicateFlagStatusEnum = pgEnum("duplicate_flag_status", [
  "open",
  "resolved",
]);

/** `[04 B3]`, `[07 B5]` */
export const duplicateResolutionEnum = pgEnum("duplicate_resolution", [
  "who_continues",
  "shared",
  "false_flag",
]);

/* `notification_tier` was an enum here until `0033`. `07 E5` split delivery
 * into act-now and digest; `S91` deletes the split outright — *the list IS the
 * notification* — and `S92` leaves a bell carrying news only, which is one
 * kind. Its one column, `notification_types.tier`, went with it.
 *
 * `notification_channel` was an enum here until `0027`. `[04 Q17, C3]` argued
 * the column should exist from day one "so adding a channel is a migration,
 * not a rewrite of every call site" — speculative generality, and no rule in
 * `SPEC.md` ever asked for a second channel. Both its columns went with it:
 * `notifications.channel` was written and read by nothing, and
 * `notification_types.default_channel`'s only reader existed to write it. */

/**
 * `[20 §2]` — the two things a rep writes. An interaction is anchored to a
 * company; a field note is anchored to nobody and touches no customer timeline.
 *
 * This replaces `09 §8.2`'s `rep_report_kind` (visit / call), which `20 §13`
 * drops: two values were the channel, not the entry type.
 */
export const repReportEntryTypeEnum = pgEnum("rep_report_entry_type", [
  "interaction",
  "field_note",
]);

/** `[20 §3]` — how the interaction happened. */
export const repReportChannelEnum = pgEnum("rep_report_channel", [
  "visit",
  "call",
  "whatsapp",
  "email",
  "meeting",
]);

/**
 * `[20 §3]` — what happened in the funnel. Exactly one per interaction.
 *
 * There is deliberately no "asked for a quotation" value: qualification is
 * derived from a real quotation thread `[10 §1]` and an outcome saying
 * otherwise would be a second, softer definition of qualified that no thread
 * backs. The form offers a button that raises the request instead.
 *
 * `technical_submitting` is `25 §2`'s addition — an activity like the others,
 * **not a stage**: `25 §1` corrects the single stage dropdown that conflated
 * unordered, repeatable activities with the strictly ordered quotation chain.
 * Its position here must match the `ALTER TYPE … ADD VALUE … AFTER` in
 * migration 0007, or the next generate wants to recreate the type.
 */
export const repReportOutcomeEnum = pgEnum("rep_report_outcome", [
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
]);

/** `[20 §2]` — what a field note was for. */
export const fieldNoteCategoryEnum = pgEnum("field_note_category", [
  "market_research",
  "scouting",
  "exhibition",
  "training",
  "internal",
]);

/**
 * `[20 §4]` — what the customer told us that the business needs to know.
 * Distinct from the outcome, optional, many per report, and allowed on any
 * report rather than only on a loss.
 */
export const reportSignalEnum = pgEnum("report_signal", [
  "price_too_high",
  "competitor_cheaper",
  "colour_unavailable",
  "lead_time_too_long",
  "quality_concern",
  "payment_terms",
  "specification_unavailable",
  "project_delayed",
  "other",
]);

/* ------------------------------------------------------------------ *
 * 2. Identity and authorization — `09 §2`
 * ------------------------------------------------------------------ */

/**
 * `09 §2.1` — roles are data, not code. Adding a role is configuration.
 * The eight flags named in `[07 A5 C1]`, plus `can_manage_users` — added by
 * founder instruction in phase 6 (`11 §1`) — plus three added in phase 7 to
 * make `12 §3`'s executive flag list expressible as data:
 * `can_set_credit_split` `[12 §1, §14.6]`, `can_approve_delete` and
 * `can_resolve_duplicate` `[12 §3]`, the last two being the acts `07 A5`
 * gives the sales manager ("approves shares, assignments, deletes, duplicate
 * resolution"). The rest of the list stays open `[09 §15.1]`.
 * The unique name key exists so the role seed is a true upsert.
 */
export const roles = pgTable(
  "roles",
  {
    id: pk(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    canAssign: boolean("can_assign").notNull().default(false),
    canShare: boolean("can_share").notNull().default(false),
    canExport: boolean("can_export").notNull().default(false),
    canSetTargets: boolean("can_set_targets").notNull().default(false),
    /**
     * `S136` — **narrower than `can_set_targets`, deliberately.** That flag sets
     * a PERSON's figure and the Sales Manager holds it; this one sets the figure
     * the whole company — the holder included — is measured against, which is
     * `S82`'s principle one register up. Super Admin alone today, and who holds
     * it is configuration `S7`, not code.
     */
    canSetCompanyTarget: boolean("can_set_company_target")
      .notNull()
      .default(false),
    seesAllReps: boolean("sees_all_reps").notNull().default(false),
    canDispatch: boolean("can_dispatch").notNull().default(false),
    canApproveQuotation: boolean("can_approve_quotation")
      .notNull()
      .default(false),
    canImpersonate: boolean("can_impersonate").notNull().default(false),
    canManageUsers: boolean("can_manage_users").notNull().default(false),
    /** `[12 §1]` — deliberate act, never a side effect of a dispatch `[07 D3]`. */
    canSetCreditSplit: boolean("can_set_credit_split").notNull().default(false),
    /** `[04 Q8]`, `[07 A5]`, `[12 §3]` — decides a rep's delete request. */
    canApproveDelete: boolean("can_approve_delete").notNull().default(false),
    /** `[07 B5]`, `[12 §3]` — works the duplicate queue. */
    canResolveDuplicate: boolean("can_resolve_duplicate")
      .notNull()
      .default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("roles_name_en_key").on(t.nameEn)],
);

/**
 * `S14` — a company carries a country. Most are Saudi; some are not.
 *
 * A lookup table, the shape `cities` and `company_categories` already use, so
 * the founder adds a country by editing a seed file rather than a migration.
 *
 * `code` is the ISO 3166-1 alpha-2 token, and it is here for the reason
 * `loss_reasons.code` and `notification_types.key` are: exactly one row —
 * Saudi Arabia — changes what the form asks for, because `S15` derives a
 * region from a city only for a Saudi company. Matching that on `name_en`
 * would break the first time somebody edits the English text, and it would
 * break **silently**: every Saudi company would stop being offered a city,
 * with no error anywhere.
 */
export const countries = pgTable(
  "countries",
  {
    id: pk(),
    code: text("code").notNull(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("countries_code_key").on(t.code)],
);

/**
 * `09 §3.6` — "city, with a Saudi city lookup" `[07 A7]`.
 *
 * Saudi cities only, and `S15` keeps it that way: a company outside Saudi
 * Arabia has no city and no region. There are no foreign cities here to
 * invent.
 *
 * `region` is `NOT NULL` because `15 §3` maps every city: the grouping is
 * stated per administrative region, never per city, so a row with no region
 * would be one `15 §4` cannot derive a record's region from.
 */
export const cities = pgTable("cities", {
  id: pk(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  region: regionEnum("region").notNull(),
  createdAt: createdAt(),
});

/**
 * `09 §2.2` — the person. Deactivates, never deletes `[04 C2]`, `[07 B7]`.
 * Region per `[10 §7]`: the rep's base, which makes "sales by rep's region"
 * and "sales by site region" two separately answerable questions.
 *
 * **`city_id` was beside it until `0027`.** `10 §7` asked for both, but only
 * `region` ever gained a writer: `createUser` took a `cityId` no form, action
 * or select ever supplied, `UserUpdateInput` omitted it and `ManagedUserRow`
 * never read it. 0 of 401 users carried one — a live foreign key to `cities`
 * that nothing filled. `region` is what serves `10 §7` today, and a rep's city
 * is a rule away rather than a column away.
 *
 * Deliberately absent: per-rep working days. `04 Q16 / C4` required them;
 * `07 D6` supersedes that with a global weekend and a grace for everyone.
 */
export const users = pgTable(
  "users",
  {
    id: pk(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    region: regionEnum("region"),
    isActive: boolean("is_active").notNull().default(true),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    /** Adapter-dictated `[09 §2.2]` — unused under credentials-only auth. */
    emailVerified: timestamp("email_verified", { withTimezone: true }),
    /** Adapter-dictated `[09 §2.2]` — unused under credentials-only auth. */
    image: text("image"),
    /** Null = cannot log in. Set by bootstrap or user management, never signup. */
    passwordHash: text("password_hash"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_key").on(t.email)],
);

/* ------------------------------------------------------------------ *
 * Auth.js library tables — shape dictated by @auth/drizzle-adapter
 * `[09 §2.2]`, `[03]`. Only `sessions` is used under credentials-only auth.
 *
 * **`accounts` stays because the library's TYPE requires it, not its
 * behaviour.** `accountsTable` is a non-optional member of the adapter's
 * `DefaultPostgresSchema`, so omitting it fails `npm run typecheck`. At
 * runtime nothing reaches it: the four methods that read it — `linkAccount`,
 * `getUserByAccount`, `unlinkAccount`, `getAccount` — are called only on an
 * OAuth or WebAuthn sign-in, and the only provider is `Credentials`. The
 * table stays empty forever and that is correct.
 *
 * `verification_tokens` sat here for the same stated reason and did not earn
 * it: its member is optional (`verificationTokensTable?`) and its two methods
 * belong to the Email provider. `SPEC §15` drops it — migration `0015`.
 * `users.email_verified` and `users.image` stay on the same test as
 * `accounts`: `DefaultPostgresUsersTable` names both columns.
 * ------------------------------------------------------------------ */

export const sessions = pgTable(
  "sessions",
  {
    sessionToken: text("session_token").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
    /**
     * Impersonation `[07 A6]`: non-null while the session holder acts as
     * someone else. Session-scoped by nature — it survives requests and dies
     * with logout, which is what the persistent banner needs.
     */
    actingAsUserId: uuid("acting_as_user_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

/**
 * `09 §2.3` — targets are historical rows, never a mutable field `[07 D1]`.
 * SQM only, monthly. A person with no row for a month is not measured that
 * month. `[10 §6]`: same-month corrections are superseding rows too —
 * `effective_from` decides which row applies.
 */
export const targets = pgTable(
  "targets",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    /** First day of the month the target is for. */
    period: date("period").notNull(),
    sqm: numeric("sqm", SQM).notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .notNull()
      .defaultNow(),
    setBy: uuid("set_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("targets_user_period_idx").on(t.userId, t.period)],
);

/**
 * `S136` — the company's own target for a month.
 *
 * **A separate table rather than a nullable `user_id` on `targets`, and the
 * reason is the rule.** A company target and a rep target are two independent
 * decisions — *neither derives from the other* — so they are two independent row
 * sets, and the schema says so rather than a convention saying it. A nullable FK
 * meaning *this row is the company* would make `targets.user_id` mean two things,
 * leave every present and future reader to remember the null, and drop the
 * company row **silently** from any `innerJoin` onto `users`.
 *
 * Otherwise it is `targets` exactly, minus the person: same columns, same absence
 * of a unique key — a same-month correction is a **superseding insert** `S84`
 * `S110`, and `effective_from` then `created_at` decides which row applies, which
 * is the one ordering `lib/targets.ts` owns for both tables.
 */
export const companyTargets = pgTable(
  "company_targets",
  {
    id: pk(),
    /** First day of the month the target is for. */
    period: date("period").notNull(),
    sqm: numeric("sqm", SQM).notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .notNull()
      .defaultNow(),
    setBy: uuid("set_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("company_targets_period_idx").on(t.period)],
);

/* ------------------------------------------------------------------ *
 * 3. Companies, contacts, projects — `09 §3`
 * ------------------------------------------------------------------ */

/** `09 §3.6` — the list is accepted for now and revised later, so it is data. */
export const companyCategories = pgTable("company_categories", {
  id: pk(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  createdAt: createdAt(),
});

/**
 * `10 §12` — accepted. Marketing channels will multiply. Values seeded by
 * `15 §1`.
 *
 * `rep_selectable` restricts a value to holders of `can_assign` `[15 §2]`.
 * "Marketing" means the lead arrived from the marketing team, so a rep picking
 * it by hand would record something that did not happen. It is a flag on the
 * row rather than a special case in code: a second restricted source must be
 * configuration, not a deploy. Default `true` — a source added later is
 * selectable unless someone says otherwise.
 */
export const leadSources = pgTable("lead_sources", {
  id: pk(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  repSelectable: boolean("rep_selectable").notNull().default(true),
  createdAt: createdAt(),
});

/* `project_company_roles` was dropped in migration 0002. `12 §5` corrects
 * `07 A3` and `09 §3.6`: there is no role vocabulary at all — two contractors
 * may compete on one project, and a lookup would force a false choice between
 * them. The label is free text on the link row instead. */

/**
 * `09 §3.1` — the customer is the company `[04 Q1]`.
 *
 * One table for qualified and unqualified alike `[10 §2]`: qualification is
 * derived from events `[04 qualification]`, and the unqualified pipeline is a
 * filter, not a second table. That is why most of this is nullable — the rest
 * becomes required progressively in the application layer.
 *
 * The exceptions are the four a company cannot exist without: its `name`
 * `S12`, its `phone` `S13`, its `country_id` `S14`, and the `name_normalized`
 * the first of those derives. Those are invariants about what a row may
 * contain, so they are held by the database `[CLAUDE.md]`.
 *
 * Warmth `[10 §1]` was here until `25 §6` cut it. Nothing had written a value,
 * so the three columns went with the enum.
 */
export const companies = pgTable(
  "companies",
  {
    id: pk(),
    /** One field, English or Arabic `S12`. */
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull(),
    /**
     * The strongest duplicate-matching key `[07 B6]`, and the primary one
     * `S23` — which is exactly why `S13` makes it `NOT NULL`. A placeholder
     * would be worse than the null it replaced, because `S23` matches on it:
     * one fake number typed twice makes two unrelated companies duplicates of
     * each other. Migration 0010 therefore cleared the rows rather than
     * backfilling them, and refuses to run against a table still holding one.
     */
    phone: text("phone").notNull(),
    categoryId: uuid("category_id").references(() => companyCategories.id),
    /**
     * `S14` — every company has one. `NOT NULL` because every company today is
     * Saudi in practice, so there is no such thing as a company whose country
     * is unknown; migration 0010 defaults the existing rows to Saudi Arabia.
     */
    countryId: uuid("country_id")
      .notNull()
      .references(() => countries.id),
    /** `S15` — Saudi only. Both stay null when the country is not Saudi
     *  Arabia, and the data layer, not the form, is what enforces that. */
    region: regionEnum("region"),
    cityId: uuid("city_id").references(() => cities.id),
    leadSourceId: uuid("lead_source_id").references(() => leadSources.id),
    /** What the customer needs, entered at registration `[04 Q19]`, `[07 B4]`. */
    notes: text("notes"),
    /*
     * `has_credit_terms` was here until `0022`. It named an exception to `07
     * C3`'s payment gate — some customers buy on credit, so a dispatch against
     * them is allowed — and `SPEC §15` lists it under *Dropped outright*: `S70`
     * and `S73` were its only citations and both were rewritten. `S73` now
     * asks for a payment **method**, and `handled_by_finance` is the answer a
     * credit customer gives `S71`, so the exception has become one value in a
     * list rather than a flag beside a gate. No writer ever set it true.
     */
    /**
     * `[25 §18]` — the rep's own date, which **outranks the automatic clock**:
     * it suppresses `07 D5`'s chase until it arrives, and then becomes the
     * follow-up. With no date set the thresholds apply as they do now.
     *
     * This is an **input to** the derivation, not a stored timer, so `20 §9`'s
     * "computed on read, never stored" is intact — `21`'s refusal to write
     * `tasks` for follow-ups stands `[25 §19]`. A `date`, like
     * `rep_reports.on_hold_until`, because `25 §18` generalises `20 §5`'s
     * on-hold mechanism from the company to the record.
     */
    nextFollowUpAt: date("next_follow_up_at"),
    /** The dormancy lifecycle keeps the record `[07 E6]`. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    /** Tombstone: this record lost a duplicate resolution `[07 B5]`. */
    mergedIntoId: uuid("merged_into_id").references(
      (): AnyPgColumn => companies.id,
    ),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("companies_name_normalized_idx").on(t.nameNormalized),
    index("companies_phone_idx").on(t.phone),
    index("companies_merged_into_idx").on(t.mergedIntoId),
  ],
);

/**
 * `09 §3.2` — membership of reps on a company. Visibility is per record
 * `[04 Q7]`, several reps may share one company `[04 Q3]`, and a granted
 * delete request removes the company from the requesting rep's side only
 * `[04 Q8]` — which is only expressible as per-rep rows.
 */
export const companyReps = pgTable(
  "company_reps",
  {
    id: pk(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    /**
     * The registering rep automatically becomes primary `S18`, and primacy
     * then follows the company: handover and dormancy reassignment both move
     * it to whoever holds it now. A company with a live membership carries
     * exactly one — no index holds that, because "at least one" is not
     * row-local; `verify:schema25` §20 asserts it over every row.
     */
    isPrimary: boolean("is_primary").notNull().default(false),
    origin: companyRepOriginEnum("origin").notNull(),
    /** The delete-request outcome `[04 Q8]`. Never a deleted row. */
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("company_reps_active_key")
      .on(t.companyId, t.userId)
      .where(sql`removed_at is null`),
    index("company_reps_user_idx").on(t.userId),
  ],
);

/**
 * `07 E6` + `21 §7` — the dormancy lifecycle. A company past its quiet
 * threshold is notified and then takes one of three routes; this records which,
 * who decided, and when.
 *
 * **Dated rows, never a mutable field on the company.** The same shape targets
 * `[07 D1]` and credit splits `[18 §4]` already use, and for the same reason:
 * changing one must not rewrite history. A `suppressed_until` column would also
 * lose who re-included what, which is the whole content of `07 E6`'s "with a
 * warning" — the warning IS the record, and a company re-included three times
 * running is visible as such.
 *
 * The latest row wins on read, and a `reincluded` row suppresses that company's
 * quiet follow-up for one further threshold period. Nothing here is ever
 * deleted `[12 §7]`; `archived` additionally sets `companies.archived_at`.
 */
export const companyDormancyReviews = pgTable(
  "company_dormancy_reviews",
  {
    id: pk(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    outcome: dormancyOutcomeEnum("outcome").notNull(),
    decidedByUserId: uuid("decided_by_user_id")
      .notNull()
      .references(() => users.id),
    /** The receiving rep. Present only on a reassignment `[21 §6]`. */
    toUserId: uuid("to_user_id").references(() => users.id),
    note: text("note"),
    /** A calendar day in Riyadh, like `rep_reports.report_date` `[20 §9]`. */
    decidedAt: date("decided_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("company_dormancy_reviews_company_idx").on(t.companyId, t.decidedAt),
    /**
     * `13 §1` — what a row may contain in isolation belongs in the database.
     * That the recipient can actually hold the company is a cross-table rule
     * and stays in `src/lib/dormancy.ts` as a `RuleError`.
     */
    check(
      "company_dormancy_reviews_recipient",
      sql`(outcome = 'reassigned') = (to_user_id is not null)`,
    ),
  ],
);

/**
 * `09 §3.3` — a person at a company. One contact belongs to exactly one
 * company; a person who moves gets a new record and the old one stays
 * `[07 A2]`. Email, position and notes per `[10 §3]` — marketing will use
 * them, and completeness is a derived dashboard diagnostic, never a target.
 */
export const contacts = pgTable(
  "contacts",
  {
    id: pk(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    /** One field, English or Arabic `S19`. */
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull(),
    phone: text("phone"),
    email: text("email"),
    position: text("position"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("contacts_company_idx").on(t.companyId),
    index("contacts_name_normalized_idx").on(t.nameNormalized),
  ],
);

/**
 * `25 §5` — why a project was lost. A lookup rather than an enum because the
 * founder will **collect real "other" entries and promote or prune the list**,
 * which has to be a row, never a migration.
 *
 * Seeded with `25 §5`'s nine values and nothing else. The same shape as
 * `20 §4`'s signals, so the reasons aggregate the same way and `25 §27`'s
 * monthly rollup can group the gap by reason, sliced by rep.
 *
 * `code` is the stable identifier the application refers to — the shape
 * `notification_types.key` uses, and for the same reason: exactly one row,
 * `other`, changes what the form asks for, and matching that on a display name
 * would break the first time someone edits the English text.
 *
 * `25 §25` adds that the reason belongs to the **project**: quotations inherit
 * it, so a project lost for one reason does not make the rep write that reason
 * again on each quotation under it.
 */
export const lossReasons = pgTable(
  "loss_reasons",
  {
    id: pk(),
    code: text("code").notNull(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("loss_reasons_code_key").on(t.code)],
);

/**
 * `09 §3.4` — first-class, not a child of company `[04 Q2]`. Requires at least
 * one linked company `[07 A9]`, enforced in the application layer per `09 §1`.
 *
 * Achieved SQM is never a column here — it is derived from dispatches
 * `[04 C1]`. `sqm_expected` is the human forecast; the pipeline total is the
 * sum of these.
 */
export const projects = pgTable(
  "projects",
  {
    id: pk(),
    /** One field, English or Arabic `S26`, the shape `S12` gives a company. */
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id),
    sqmExpected: numeric("sqm_expected", SQM),
    endState: projectEndStateEnum("end_state"),
    /**
     * `[25 §5]` — which of the nine reasons, required when the project is
     * marked lost `[04 Q18]`, `[07 C5]`. Takes the card off the board
     * `[25 §4]`; lost is not a board column, or the board becomes a graveyard
     * nobody clears `[25 §5]`.
     */
    lostReasonId: uuid("lost_reason_id").references(() => lossReasons.id),
    /**
     * The detail behind the reason, and **the `other` intake** `[25 §5]` — it
     * is how the founder collects real entries and finds reasons ten and
     * eleven, so it is load-bearing rather than a spare notes field. Paired
     * with `lost_reason_id`, never a rival column: two answers to "why was
     * this lost" would be two sources of truth.
     *
     * **`other` requires `loss_reason`; every other code forbids it.** That
     * rule is enforced in `src/lib/projects.ts`, not here, because a CHECK
     * cannot subquery to read the code behind a uuid. The three halves that
     * *are* intra-row are the CHECKs below.
     */
    lossReason: text("loss_reason"),
    /** When the loss was recorded `[25 §5]`. */
    lostAt: timestamp("lost_at", { withTimezone: true }),
    /**
     * `[25 §4]` — one of the three things the system cannot know, set by the
     * rep. **Deliberately unverified**, and *not* connected to the production
     * module: production sometimes changes and stock sometimes covers an
     * order, so FACET must not check it. Recorded here so nobody later builds
     * a check.
     *
     * A plain label, so a boolean; the audit log carries who turned it on and
     * when, as it does for every other field.
     */
    inProduction: boolean("in_production").notNull().default(false),
    /**
     * `S29`'s fifth item — **the customer has agreed, ahead of any dispatch**
     * `S31`. The rep's own judgement, set and cleared by them.
     *
     * **Not an end state, which is why it is not in `end_state`**: a committed
     * project is still moving. And never a conversion figure — `S31` says so
     * outright, and `S65` says the same of an accepted quotation. What *is*
     * won is derived from an approved dispatch and never stored.
     *
     * A boolean rather than a stamp: the audit log already carries who set it
     * and when, exactly as it does for `in_production` above.
     *
     * Nothing clears it when the project closes, and no CHECK forbids the
     * pair. `projectState` in `src/lib/projects.ts` ranks won and lost above
     * it, so a closed project never reads as committed — one precedence
     * instead of a constraint plus a writer that has to honour it.
     */
    committed: boolean("committed").notNull().default(false),

    /** `[25 §18]` — the rep's date, outranking the automatic clock. See
     *  `companies.next_follow_up_at`. */
    nextFollowUpAt: date("next_follow_up_at"),
    region: regionEnum("region"),
    cityId: uuid("city_id").references(() => cities.id),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("projects_owner_idx").on(t.ownerUserId),
    index("projects_name_normalized_idx").on(t.nameNormalized),
    /**
     * `13 §1` — what a row may contain, which belongs in the database, as
     * distinct from who may write it. A loss records both when and why, or
     * neither.
     */
    check(
      "projects_loss_pair",
      sql`(lost_reason_id is null) = (lost_at is null)`,
    ),
    /** Detail never without a reason `[25 §5]`. */
    check(
      "projects_loss_detail",
      sql`loss_reason is null or lost_reason_id is not null`,
    ),
    /**
     * A project that is not lost may not carry a reason. `is not distinct
     * from` never returns null, so a project with no end state at all still
     * refuses one — a plain `end_state = 'lost'` would evaluate to null there
     * and the constraint would pass on anything, the trap
     * `rep_reports_on_hold` already documents.
     *
     * The converse — *lost requires a reason* — is refused by
     * `assertLossReason` in `src/lib/projects.ts` and belongs at the database
     * with the screen that lets a rep pick one of the nine.
     */
    check(
      "projects_loss_state",
      sql`lost_reason_id is null or end_state is not distinct from 'lost'`,
    ),
  ],
);

/**
 * The join that makes a company's involvement meaningful: one project can
 * involve several companies `S24`.
 *
 * **A linked company is simply a participant** `S25`. There is no role label —
 * the free-text `role` column this table used to carry was dropped, because a
 * participant is described by being on the project, not by a word someone typed
 * about it.
 *
 * **And no buyer flag** `S26`. Who bought is derived from dispatches, never
 * flagged: a dispatch names its company, so a project's buyers are the
 * companies that have dispatched against it, and two participants may both
 * have bought. The `is_buyer` column and the partial unique index that made it
 * "at most one" are both gone — a hand-ticked flag beside a derivable fact is
 * what `S28` already forbids for project state. The derivation lives in
 * `dispatchedSqmByCompany` in `src/lib/projects.ts` and nowhere else, which
 * reads `dispatches.project_id` since `S74`.
 *
 * So the one thing this row still says about a company is whether it is still
 * involved. Removal is soft and re-linkable `S27` — the row is kept and
 * hidden, like every other state change in FACET. The unique index is
 * therefore partial on `removed_at is null`: without that, a removed company
 * could never be re-linked. A project still keeps at least one participant
 * `S27`, which is an application-layer rule because SQL cannot express "at
 * least one" here.
 */
export const projectCompanies = pgTable(
  "project_companies",
  {
    id: pk(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    /** `S27` — the link was taken off the project. Never a deleted row. */
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("project_companies_key")
      .on(t.projectId, t.companyId)
      .where(sql`removed_at is null`),
  ],
);

/* ------------------------------------------------------------------ *
 * 4. Visibility, sharing, credit, deletion — `09 §4`
 * ------------------------------------------------------------------ */

/**
 * `09 §4.1` — per-record sharing. Records stay private to each rep unless the
 * manager explicitly shares them `[04 Q7]`; sharing is per record, never
 * everything at once `[07 B2]`, and can be revoked `[07 B1]`.
 */
export const recordShares = pgTable(
  "record_shares",
  {
    id: pk(),
    recordType: recordTypeEnum("record_type").notNull(),
    recordId: uuid("record_id").notNull(),
    sharedWithUserId: uuid("shared_with_user_id")
      .notNull()
      .references(() => users.id),
    sharedByUserId: uuid("shared_by_user_id")
      .notNull()
      .references(() => users.id),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByUserId: uuid("revoked_by_user_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("record_shares_record_idx").on(t.recordType, t.recordId),
    index("record_shares_user_idx").on(t.sharedWithUserId),
  ],
);

/**
 * `09 §4.2` — the split is set when sharing is approved, and each dispatch
 * uses whatever split is in force on its date, so these are dated rows, not a
 * field `[07 D3]`. Recording a dispatch never sets a split `[12 §1]`.
 *
 * **A project with no rows is the normal case** `[18 §1]`, `[18 §3]`: splits
 * are rare, and the dispatch's own rep takes 100%. `07 D3`'s "credits 100% to
 * the owner" resolves to `dispatches.user_id`, not `projects.owner_user_id`,
 * because the owner is a mutable undated field and crediting it would let a
 * reassignment rewrite past months.
 *
 * **`percentage` is computed and always non-null** `[18 §3]`, `[18 §5]`. The
 * manager or coordinator sets the split's MEMBERSHIP; FACET divides equally,
 * leftover units to the earliest rows, so a generation sums to exactly 100.00.
 * `18 §6` **withdraws `07 D3`'s contributor** — the null-percentage row is
 * never written, and the column stays nullable only because no document asks
 * for a migration.
 */
export const projectCreditSplits = pgTable(
  "project_credit_splits",
  {
    id: pk(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    /** Computed equal share, never typed. Nullable in the column, unreachable
     *  in practice — `18 §6` withdrew the contributor row that used null. */
    percentage: numeric("percentage", { precision: 5, scale: 2 }),
    effectiveFrom: date("effective_from").notNull(),
    setBy: uuid("set_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("project_credit_splits_project_idx").on(
      t.projectId,
      t.effectiveFrom,
    ),
  ],
);

/**
 * `S105` — a rep who judges a customer has no potential **requests its
 * removal, with a reason**. The press is a request, never an action: nothing
 * leaves the rep's list until the manager rules, and the reason is required
 * — *"the reason is the point"*.
 *
 * **Replaced `delete_requests` in `0035`**, and the vocabulary conflict that
 * table carried (`pending/granted/denied` against `S105`'s archive · keep ·
 * reassign) is resolved by the request never naming an outcome: it records
 * who asked, why and when, and is **answered by the review row that decided
 * it** — `review_id`, null while the manager has not ruled. `S106`'s one
 * record stays `company_dormancy_reviews`, whichever way in raised it; the
 * next decision on the company closes the open request. One open request
 * per company, held by the partial unique index. Nothing here is ever
 * deleted `S107`: a decided request keeps its reason beside the review.
 */
export const companyRemovalRequests = pgTable(
  "company_removal_requests",
  {
    id: pk(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id),
    reason: text("reason").notNull(),
    /** The decision that answered it `S106`. Null = with the manager. */
    reviewId: uuid("review_id").references(() => companyDormancyReviews.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("company_removal_requests_open_key")
      .on(t.companyId)
      .where(sql`review_id is null`),
    index("company_removal_requests_requester_idx").on(t.requestedByUserId),
  ],
);

/* ------------------------------------------------------------------ *
 * 5. Quotations — `09 §5`
 * ------------------------------------------------------------------ */

/**
 * `09 §5.2` — one thread, many versions.
 *
 * **The project is required** `S50`. It was optional until `0031`, on the
 * reasoning that a rep sometimes needs to quote before a project exists; the
 * gap was then refused one step later at dispatch, and S50 now closes it at
 * the moment it is cheap to close instead. Raising asks for the company, then
 * for one of its projects or a new one named from what the rep already typed.
 * The write-back at dispatch went with the null case `S74`.
 *
 * Payment confirmation is one tick by the rep with a date, because the rep
 * receives the payment — not an amounts ledger `[07 C3]`. Two application
 * rules read from here: dispatch is blocked until payment is confirmed
 * `[07 C3]`, and acceptance is performed by the coordinator `[04 flow 10]`.
 * Cancellation is coordinator-only `[07 C4]` and its reason is required
 * `[10 §8]`.
 */
export const quotationThreads = pgTable(
  "quotation_threads",
  {
    id: pk(),
    /** Always set `S50`; a dispatch takes it rather than writing it `S74`. */
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    contactId: uuid("contact_id").references(() => contacts.id),
    raisedByUserId: uuid("raised_by_user_id")
      .notNull()
      .references(() => users.id),
    endState: quotationThreadEndStateEnum("end_state"),
    /**
     * Who cancelled and why. **There is no `cancelled_at`** since `0027`: it
     * was written by `cancelThread` and read by nothing through nine
     * cancellations, and the `quotation_thread.cancelled` audit row already
     * carries the moment `S112`. `dispatches.cancellation_reason` cited it as
     * the counter-example for having no stamp of its own, and it now matches.
     */
    cancelledByUserId: uuid("cancelled_by_user_id").references(() => users.id),
    cancellationReason: text("cancellation_reason"),
    /**
     * **There is no payment on a quotation** `S133`, since `0029`.
     * `payment_confirmed_at`, `payment_confirmed_by_user_id` and
     * `accepted_for_processing_at` were the gate `S72` replaced: `S70` records
     * payment on the DISPATCH and `S73` makes a method a condition of approving
     * one, so no interval exists between paid and dispatched for a column — or
     * a chain position `S132` — to occupy. The three left with `confirmPayment`
     * and `markAcceptedForProcessing` in the same slice, which is `CLAUDE.md`'s
     * rule about a replaced mechanism.
     */
    /**
     * `[25 §24]` — a quotation closes when the rep knows nothing more is
     * coming, or when the project is won or lost. Separate from `end_state`,
     * which records how the quotation itself ended: a thread can be closed
     * while still `accepted`, because **taking a project in batches is
     * normal** and partial dispatches are the expected case, not an
     * exception. Management views filter on this so the numbers are not
     * misread.
     */
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedByUserId: uuid("closed_by_user_id").references(() => users.id),
    /** `[25 §18]` — the rep's date, outranking the automatic clock. See
     *  `companies.next_follow_up_at`. */
    nextFollowUpAt: date("next_follow_up_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("quotation_threads_project_idx").on(t.projectId),
    index("quotation_threads_company_idx").on(t.companyId),
    /** `13 §1` — someone closed it, or nobody did. */
    check(
      "quotation_threads_closed",
      sql`(closed_at is null) = (closed_by_user_id is null)`,
    ),
  ],
);

/**
 * `09 §5.3` — the version. `[10 §4]`: the rep's request *is* version 1, with
 * no SMAC reference yet; the coordinator filling the reference in makes it
 * issued; a revision creates version 2 carrying the `RE` number `[07 C2]`.
 * Earlier versions stay read-only.
 *
 * No discount column — `Disc` is unused on the SMAC form and an unused field
 * invites inconsistent use `[08 B3, D8]`. Bank details are not stored per
 * quotation; they are print-time boilerplate from settings `[08 D9]`.
 */
export const quotationVersions = pgTable(
  "quotation_versions",
  {
    id: pk(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => quotationThreads.id),
    versionNumber: integer("version_number").notNull(),
    /** `9592`, then the `RE` form. Null until the coordinator issues it. */
    smacReference: text("smac_reference"),
    smacReferenceVerification: smacVerificationEnum(
      "smac_reference_verification",
    )
      .notNull()
      .default("unverified"),
    origin: quotationVersionOriginEnum("origin").notNull(),
    status: quotationVersionStatusEnum("status").notNull().default("requested"),
    /** The coordinator's return-for-edit round `[04 flow 10]`. */
    returnForEditRound: integer("return_for_edit_round").notNull().default(0),
    /**
     * `S118` — the one stock this quotation is drawn from, chosen by the rep
     * when raising.
     *
     * **On the version, not the thread**, and `S120` is why: a dispatch is
     * compared against *the version it was raised from*, never the latest one.
     * A thread-level column would answer with today's value and manufacture a
     * gap on a dispatch that never moved — silently, which is the failure
     * `S120` is written to prevent. It also inherits the freeze `S61` and `S66`
     * put on a version: once issued, a change is a new version rather than an
     * edit.
     *
     * **NOT NULL**: "a quotation is drawn from *one* stock", chosen at raise,
     * so there is no legitimate moment with none. That is an invariant about
     * what a row may contain, which the database holds `[CLAUDE.md]`.
     */
    stock: stockEnum("stock").notNull(),
    /*
     * `payment_method` and `shipment_terms` were here until `0022`. `S70` moves
     * payment onto the dispatch and `S119` makes shipment a dispatch property,
     * so both are `dispatches` columns now — and typed, where these were
     * nullable `text` with no vocabulary at all. `S67` had already taken
     * `valid_until` and `delivery_period` in `0018`, for the neighbouring
     * reason: validity and the delivery period are SMAC's.
     */
    /** Totals mirror SMAC. Where they disagree, SMAC is correct `[08 D5]`. */
    totalSqm: numeric("total_sqm", SQM),
    totalExclVat: numeric("total_excl_vat", MONEY),
    totalVat: numeric("total_vat", MONEY),
    grandTotal: numeric("grand_total", MONEY),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("quotation_versions_thread_number_key").on(
      t.threadId,
      t.versionNumber,
    ),
  ],
);

/* --- Product attribute lookups — `09 §5.6` ------------------------- *
 * Five lookups replace a SKU catalogue that would run to thousands of
 * combinations and go stale `[08 D1]`.
 *
 * **`code` was on the three below until `0027`.** It was the token that
 * appeared in the generated product name, and `S53` says FACET does not
 * produce that name: *a product line carries supplier, class, fire rating,
 * colour, thickness, width, length and number of pieces, displayed as ordinary
 * readable fields*. No screen ever rendered a code; all three survived only as
 * the `ORDER BY` of three dropdowns, and an `ORDER BY` is not a reader. The
 * code was also literally the name in every seeded row — `08 B1` says an
 * invented longer form would be fiction — so `name_en` carries exactly what
 * was dropped, and the three lists order by it like every other lookup.
 * ------------------------------------------------------------------ */

/** N, K, D, C `[08 B1]`, `[17 §1]`. */
export const productSuppliers = pgTable("product_suppliers", {
  id: pk(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  createdAt: createdAt(),
});

/** A, B, A2G1, A2G2 `[08 B1]`. */
export const productClasses = pgTable("product_classes", {
  id: pk(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  createdAt: createdAt(),
});

/** B1, A2, Normal `[08 B1]`. */
export const productFireRatings = pgTable("product_fire_ratings", {
  id: pk(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  createdAt: createdAt(),
});

/** 4 mm is standard and omitted from the generated name `[08 B1, D1]`. */
export const productThicknesses = pgTable("product_thicknesses", {
  id: pk(),
  thicknessMm: numeric("thickness_mm", { precision: 5, scale: 2 }).notNull(),
  isStandard: boolean("is_standard").notNull().default(false),
  createdAt: createdAt(),
});

/**
 * `12 §9` — corrects `10 §5`, which corrected `08 D6`. The key is
 * **supplier + class + fire rating + thickness**: specifications vary by
 * factory `[12 §8]`, so construction alone does not determine the text.
 * Colour is still excluded — it changes the code and the price, not the
 * technical description. Rendered onto the quotation at print time, in English
 * and Arabic.
 *
 * Which class/fire-rating combinations are real is not a database constraint
 * `[12 §8]` — it is whichever rows exist here.
 */
export const productSpecifications = pgTable(
  "product_specifications",
  {
    id: pk(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => productSuppliers.id),
    classId: uuid("class_id")
      .notNull()
      .references(() => productClasses.id),
    fireRatingId: uuid("fire_rating_id")
      .notNull()
      .references(() => productFireRatings.id),
    thicknessId: uuid("thickness_id")
      .notNull()
      .references(() => productThicknesses.id),
    descriptionEn: text("description_en"),
    descriptionAr: text("description_ar"),
    manufacturingStandardsEn: text("manufacturing_standards_en"),
    manufacturingStandardsAr: text("manufacturing_standards_ar"),
    alloyEn: text("alloy_en"),
    alloyAr: text("alloy_ar"),
    layersEn: text("layers_en"),
    layersAr: text("layers_ar"),
    coreEn: text("core_en"),
    coreAr: text("core_ar"),
    protectiveFilmEn: text("protective_film_en"),
    protectiveFilmAr: text("protective_film_ar"),
    colourAvailabilityEn: text("colour_availability_en"),
    colourAvailabilityAr: text("colour_availability_ar"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("product_specifications_key").on(
      t.supplierId,
      t.classId,
      t.fireRatingId,
      t.thicknessId,
    ),
  ],
);

/**
 * `09 §5.4` — product lines, per version. Products are attribute
 * combinations, not a fixed SKU list `[08 D1]`.
 *
 * Width and length are editable: standard values are offered as defaults, but
 * constraining them would block real orders `[08 D3]`. Square metres are a
 * generated column, verified against quotation 9592, never hand-entered
 * `[08 D2]` — the same rule the project README states. `12 §11` confirms this
 * column unchanged and cancels the proposed `entered_sqm` / `COALESCE` change.
 *
 * Colour is one required typed value, not a choice between two `[12 §12]`.
 * `17 §2` made the lookup half dead — every line always carried
 * `custom_colour` — and feature slice 6 `[26 §2]` removed the dead half
 * entirely: `colour_id` and its CHECK are gone, and `custom_colour` is
 * `NOT NULL` because that is now the only thing the CHECK ever said.
 */
export const quotationLines = pgTable(
  "quotation_lines",
  {
    id: pk(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => quotationVersions.id),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => productSuppliers.id),
    classId: uuid("class_id")
      .notNull()
      .references(() => productClasses.id),
    fireRatingId: uuid("fire_rating_id")
      .notNull()
      .references(() => productFireRatings.id),
    /** The colour, typed `[17 §2]`: a code, or a RAL/Pantone special. */
    customColour: text("custom_colour").notNull(),
    thicknessId: uuid("thickness_id")
      .notNull()
      .references(() => productThicknesses.id),
    /*
     * `form_factor` was here until `0027`. `12 §11` — quotation lines are
     * sheets only; coils belong to production — so the application wrote
     * `'sheet'` on all 850 of them and no rule ever read the column. It went
     * with its enum type, which had no other column. `dispatch_lines` never
     * copied it, and its header says why.
     */
    widthM: numeric("width_m", SQM).notNull(),
    lengthM: numeric("length_m", SQM).notNull(),
    /** Coil quantity unit is still open `[08 E5]`, `[10 §13 item 10]`. */
    quantityPcs: numeric("quantity_pcs", SQM).notNull(),
    sqm: numeric("sqm", SQM).generatedAlwaysAs(
      sql`quantity_pcs * width_m * length_m`,
    ),
    unitPrice: numeric("unit_price", MONEY),
    lineTotal: numeric("line_total", MONEY),
    /**
     * **No `vat_rate` column** `S57`. The rate is fixed at 15% and never
     * editable, so it is `VAT_RATE` in `enums.ts` and nowhere else — a column
     * would be a place for it to disagree with itself.
     *
     * The *amount* stays stored, with `total_vat` and `grand_total`: those are
     * SMAC's figures `S3`, and the schema records that FACET mirrors them.
     */
    vatAmount: numeric("vat_amount", MONEY),
    createdAt: createdAt(),
  },
  (t) => [index("quotation_lines_version_idx").on(t.versionId)],
);

/** `10 §12` — accepted. CNC, cutting, bending, notching will change `[08 B4]`. */
export const serviceTypes = pgTable("service_types", {
  id: pk(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  createdAt: createdAt(),
});

/**
 * `09 §5.5` — services are their own line type, each with a variable price and
 * a variable quantity; not every product line receives one `[08 B4]`. v1
 * stored price per metre and never quantity, which made totals impossible.
 *
 * Service square metres are tracked separately and do not count toward SQM
 * targets `[08 D4]`. Whether the unit is always square metres is still open
 * `[08 E2]`, `[10 §13 item 8]`, so `unit` is free text for now.
 */
export const quotationServiceLines = pgTable(
  "quotation_service_lines",
  {
    id: pk(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => quotationVersions.id),
    serviceTypeId: uuid("service_type_id")
      .notNull()
      .references(() => serviceTypes.id),
    quantity: numeric("quantity", SQM).notNull(),
    unit: text("unit").notNull(),
    unitPrice: numeric("unit_price", MONEY),
    /** Optional: the product line this service applies to `[08 D4]`. */
    quotationLineId: uuid("quotation_line_id").references(
      () => quotationLines.id,
    ),
    createdAt: createdAt(),
  },
  (t) => [index("quotation_service_lines_version_idx").on(t.versionId)],
);

/* ------------------------------------------------------------------ *
 * 6. Dispatch — `09 §6`
 * ------------------------------------------------------------------ */

/**
 * `S72` — **a rep requests a dispatch; the coordinator checks it and approves
 * it**, and the approval is the one event that credits a target. One quotation
 * can produce several partial dispatches; quotation quantity ≠ paid quantity ≠
 * dispatched quantity `[04 quantities]`.
 *
 * **The request and the dispatch are the same row** — see `dispatchStatusEnum`
 * for why. `status` is what every figure now reads through, never the row's
 * existence: a submitted request credits nothing, wins nothing and moves no
 * chain until it is approved.
 *
 * The quotation link is optional, because customers sometimes buy directly
 * `[07 C6]` — a null thread is exactly what makes a direct dispatch visible as
 * such in reporting, so the route cannot quietly bypass the chain.
 *
 * **The project is recorded here, on the dispatch itself** `S74`. Square metres
 * per project are analysed from dispatch data and this row is the record of
 * what actually shipped, so it carries its own project rather than borrowing
 * its thread's. Where there IS a thread the two are never different — a rule
 * `recordDispatch` enforces the way it already enforces the company, because
 * this pair spans two rows and no CHECK can reach across one.
 *
 * It stays nullable for the direct route: a dispatch with no quotation may
 * still name no project `S75`.
 *
 * Achieved SQM and pipeline metrics derive from these rows and nowhere else.
 *
 * **There is no `sqm` column** since `0020`. A dispatch carries its own lines
 * `S116` and its square metres are the sum of `dispatch_lines.sqm`, which is
 * itself generated — so the figure exists once and cannot disagree with the
 * lines it is made of. Every reader sums it in SQL.
 */
export const dispatches = pgTable(
  "dispatches",
  {
    id: pk(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    quotationThreadId: uuid("quotation_thread_id").references(
      () => quotationThreads.id,
    ),
    /**
     * `S126` — the version this dispatch was raised from, which is the thing
     * the rule is about: the coordinator issues a *version*, not a thread.
     *
     * It is also what keeps the rule assertable. A revision supersedes the
     * issued version `S66`, so a thread that was legitimately dispatched
     * against can end up with no issued version at all — and an invariant
     * checked through the thread would start reporting a lawful historical
     * dispatch as a violation. Through this column the claim is permanent:
     * the status is `issued` or, later, `superseded`, and never `requested`.
     *
     * `S120` needs the same column for the opposite reason — its comparison is
     * against *the version the dispatch was raised from*, never the latest one
     * — but that is a later slice, and this one already reads it three ways:
     * the prefill, the SMAC reference shown on the dispatch, and the invariant.
     */
    quotationVersionId: uuid("quotation_version_id").references(
      () => quotationVersions.id,
    ),
    /** `S74` — the thread's project whenever there is a thread, never another. */
    projectId: uuid("project_id").references(() => projects.id),
    dispatchDate: date("dispatch_date").notNull(),
    recordedByUserId: uuid("recorded_by_user_id")
      .notNull()
      .references(() => users.id),
    /**
     * `S72` — where this row is in its life, and the column every figure now
     * reads through.
     *
     * **NOT NULL with no default.** A default is a place for a writer to
     * forget, and each of the six writers in `dispatches.ts` sets it outright.
     */
    status: dispatchStatusEnum("status").notNull(),
    /**
     * `S72` — when the rep handed it over, which is **not** when the row was
     * created: a revived request `S122` is submitted again, later.
     *
     * Two readers, so it is not a column waiting for one: the coordinator's
     * oldest-first queue on `/dispatches` today, and `S89`'s age on the waiting
     * list when that arrives.
     */
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    /**
     * The coordinator's approval `S72`, on **both** routes.
     *
     * It used to be stamped only on the direct one `[07 C6]`, where it stood in
     * for the payment gate that had no object there. Now there is a real
     * approval act and both routes pass through it, so the special case is gone
     * and this pair means one thing.
     */
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    /**
     * `S124` — a refusal carries a reason, and `S122` is what archives the
     * request with it.
     *
     * **Cleared on revival**, because a revived request is out of the archive
     * and *"treated as new"* `S122`. The reason is not lost: the audit row that
     * recorded the refusal keeps it, which is what `S107` means by nothing
     * being deleted, and `S128` reads it at refusal time to tell the rep.
     */
    refusalReason: text("refusal_reason"),
    /**
     * `S73` — **why an approved dispatch was undone**, and the only column
     * this rule needs.
     *
     * *A cancelled dispatch stays visible on the record it belonged to,
     * carries a reason, and is never revived.* So it is written once and never
     * cleared — the opposite of `refusal_reason` beside it, which revival
     * clears because a revived request is out of the archive `S122`. Nothing
     * revives a cancellation, so nothing clears this.
     *
     * **No `cancelled_at` and no `cancelled_by_user_id`**, deliberately.
     * `refusal_reason` has neither either, and the `dispatch.cancelled` audit
     * row carries the actor and the moment `S112` — which is what `S107` means
     * by nothing being deleted. `quotation_threads.cancelled_at` used to be
     * the counter-example — written by `cancelThread` and read by nothing —
     * and `0027` dropped it, so the two tables now say the same thing. The
     * thread keeps `cancelled_by_user_id`, which a screen does read.
     *
     * `S128` carries this to the rep rather than leaving it here to be found:
     * *a record that vanishes with its reason in a column nobody reads is the
     * same as no reason at all.* The notification stores its own copy, because
     * a co-credited rep cannot open the record this column sits on.
     */
    cancellationReason: text("cancellation_reason"),
    /**
     * `S130` — **the dispatch's own stock**, which may differ from its
     * quotation's `S118`. The rep chooses it when requesting, as they choose
     * the shipment method `S119`; the coordinator may change it until approval,
     * after which nothing edits a dispatch at all `S73`. The quotation is not
     * rewritten — that is the point of the column existing.
     *
     * **NOT NULL, including on a free entry**: *a free-entry dispatch names a
     * stock too* `S130` `S75`. There is no legitimate moment with none, so the
     * database holds it `[CLAUDE.md]`.
     *
     * It is also what makes `S119`'s rule enforceable. Reading the stock off
     * `quotation_versions` would put the CT rule across two rows — application
     * code only, unreachable for a free entry, and readable through a value a
     * revision `S66` can move underneath it. Here it is row-local.
     */
    stock: stockEnum("stock").notNull(),
    /**
     * `S119` — CT, TT or Cargo, chosen by the rep when requesting. NOT NULL for
     * `stock`'s reason: a dispatch always goes out somehow.
     *
     * There is no default. No rule picks one, and the two stocks that force a
     * value are handled by the CHECK rather than by a prefill nobody reads.
     */
    shipment: shipmentMethodEnum("shipment").notNull(),
    /**
     * `S119` — *Cargo carries a destination note*, and it is **optional**.
     *
     * The `dispatches_cargo_destination` CHECK refuses one on a CT or TT
     * dispatch rather than the writer quietly dropping it. A discarded input is
     * the defect `AUDIT 1 F3` records against the project form's region select,
     * where what a rep typed vanished with no error at all.
     */
    cargoDestination: text("cargo_destination"),
    /**
     * `S70` `S71` — **how the customer is paying**, recorded here rather than on
     * the quotation, because the coordinator confirms it with finance.
     *
     * **Nullable, and written at approval.** A rep raises, edits and submits a
     * request with none: `S70` puts this in her head, not theirs. What makes it
     * required is `dispatches_payment_method`, and only where `S73` requires it.
     *
     * It replaced the gate that read `quotation_threads.payment_confirmed_at`,
     * which asked *has money arrived?* — a question `on_delivery` answers "no"
     * to and is still legitimate — and which a free entry, having no thread,
     * never faced at all. **That column is now gone** `S133` `0029`: with the
     * gate moved here there was no interval left for it to describe, and `S132`
     * dropped the chain rung that was its last reader.
     */
    paymentMethod: paymentMethodEnum("payment_method"),
    /** `S71` — *an optional note carries anything the list does not*. Guarded
     *  by `dispatches_payment_note`: a note with no method annotates nothing. */
    paymentNote: text("payment_note"),
    /**
     * `S121` — **the SMAC dispatch number, which is unique**. The coordinator
     * writes it when SMAC issues it, usually at once.
     *
     * **It is not a condition of approval** — *a dispatch is approved, then
     * numbered* — so the CHECK beside it is one-directional: a number implies
     * approval, approval implies nothing. An approved dispatch with no number
     * yet is the ordinary state of one for as long as it takes her to type it.
     *
     * `text`, not a number: it is SMAC's format, and `S5` says a human retypes
     * every such reference, so FACET must assume it can be wrong. Unique is the
     * one thing `S121` does claim, and `dispatches_smac_number_key` holds it —
     * a plain unique index, since Postgres treats nulls as distinct and every
     * unapproved dispatch carries one.
     */
    smacDispatchNumber: text("smac_dispatch_number"),
    /**
     * `S120` — **the rep's half of the difference flag**, and the only half no
     * later reading can recover.
     *
     * *The flag records who made each difference — the rep before submitting,
     * or the coordinator after.* Whether the dispatch differs from its version
     * **now** is derived in SQL at every reader (`dispatchDiffers`) and needs no
     * column: `S126` names an issued version, `S61` will not let its lines be
     * edited and `S66` supersedes it rather than rewriting it, so the left-hand
     * side is frozen — and after approval nothing edits the right-hand side
     * either `S73`. The comparison is therefore permanent without being stored.
     *
     * What is **not** recoverable is the state of the lines at the moment the
     * rep handed them over. `updateDispatchRequest` deletes every line and
     * re-inserts the set, so `dispatch_lines.created_at` is rewritten by the
     * rep's own edits as much as by the coordinator's: no timestamp anywhere
     * separates them, and a figure reading one would attribute the rep's whole
     * dispatch to her. So this is computed once, at submission, with the same
     * SQL expression the readers use, and never moves again.
     *
     * **Nullable, and null is not false.** A free entry `S75` has no quotation
     * to differ from, and `false` there would let a later compliance figure
     * count every direct sale as a dispatch that matched its quotation. Null
     * until submission for the same reason: nothing has been handed over yet.
     */
    differedAtSubmission: boolean("differed_at_submission"),
    /**
     * `S120` — **the coordinator's half**, and named for the act rather than
     * the actor for two reasons.
     *
     * Only she may edit a submitted request `S62` `S125`, so *after submission*
     * names her without a role column. And it records that the lines **moved**,
     * not that a gap was created, because after her first edit the submitted set
     * is gone: the honest claim is that what is going out is no longer purely
     * what the rep handed over. Sticky for the same reason.
     *
     * Read with `differedAtSubmission` and the derived comparison it gives all
     * five real cases — matched throughout · the rep's deviation · hers alone ·
     * both · the rep deviated and she brought it back to the quotation.
     *
     * **This is not `S123`'s figure.** That counts *a request the coordinator
     * had to edit before approving* — any edit, from the audit row that already
     * names her. This records only that the LINES changed, which is what stops
     * a gap she introduced being read as the rep's.
     */
    linesChangedAfterSubmission: boolean("lines_changed_after_submission"),
    createdAt: createdAt(),
  },
  (t) => [
    index("dispatches_user_date_idx").on(t.userId, t.dispatchDate),
    index("dispatches_company_idx").on(t.companyId),
    index("dispatches_thread_idx").on(t.quotationThreadId),
    /** `S26` groups by it, per project, on every project detail screen. */
    index("dispatches_project_idx").on(t.projectId),
    /**
     * `S126` — the two quotation columns are null together or set together. A
     * free-entry dispatch `S75` names no version, and one raised from a
     * quotation cannot lack it. Row-local, so the database holds it; which
     * THREAD the version belongs to spans two rows and stays in
     * `recordDispatch`, beside the company and project pairs it already holds.
     */
    check(
      "dispatches_quotation_pair",
      sql`(quotation_thread_id is null) = (quotation_version_id is null)`,
    ),
    /**
     * `S72` — the status and the approval stamps cannot disagree.
     *
     * Row-local, so the database holds it, and it is what stops `approved_at`
     * becoming a second answer to *is this approved?*. Every figure asks the
     * stamp `[dispatches.ts approvedDispatches]`; this is what makes asking the
     * stamp the same as asking the status.
     *
     * **`cancelled` is on the left-hand side because approval is final** `S73`.
     * A cancelled dispatch *was* approved — it is undone, never un-approved —
     * so it keeps both stamps, and `= (approved_at is not null)` would refuse
     * the row outright. What stops the widening from making a cancelled
     * dispatch count is that no figure reads these columns: they all compose
     * `approvedDispatches()`, which is `status = 'approved'`.
     */
    check(
      "dispatches_approval_stamps",
      sql`(status in ('approved', 'cancelled')) = (approved_at is not null)
          and (status in ('approved', 'cancelled')) = (approved_by_user_id is not null)`,
    ),
    /** `S124` — refused, and only refused, carries a reason. */
    check(
      "dispatches_refusal_reason",
      sql`(status = 'refused') = (refusal_reason is not null)`,
    ),
    /**
     * `S73` — **cancelled, and only cancelled, carries a cancellation reason.**
     *
     * The `=` form rather than the one-directional shape its two neighbours
     * below use, and for `dispatches_refusal_reason`'s reason: this is not a
     * value the row keeps from an earlier state, it is the record of the act
     * itself. A reason on a live dispatch would annotate a cancellation that
     * never happened, and a cancellation with none is the hole `S128` exists to
     * close.
     */
    check(
      "dispatches_cancellation_reason",
      sql`(status = 'cancelled') = (cancellation_reason is not null)`,
    ),
    /**
     * `S72` — a draft has not been handed over and everything else has.
     *
     * Written round this way rather than as `status in ('submitted','approved',
     * 'refused')`: a **refused** request was submitted, and clearing its
     * `submitted_at` would lose when. Only revival clears it `S122`, and
     * revival is what puts the row back to `draft`.
     */
    check(
      "dispatches_submitted_at",
      sql`(status = 'draft') = (submitted_at is null)`,
    ),
    /**
     * `S119` — *only Riyadh and Malham stock have trucks, so a dispatch from
     * South or Dammam stock is CT*. Row-local since `S130` put the stock on
     * this table, so the database holds it.
     *
     * **Named negatively, matching the rule's own words.** `stock in
     * ('riyadh','malham') or shipment = 'ct'` is equivalent across today's four
     * values, but it would silently constrain a fifth stock to CT the moment
     * one is added. This form names exactly the two stocks `S119` names, so a
     * reader matches the constraint to the sentence, and a new warehouse
     * arrives unconstrained until a rule says otherwise.
     *
     * **Malham is deliberately absent.** *TT is discouraged there, never
     * refused* — *the coordinator's knowledge, not a rule FACET enforces*.
     */
    check(
      "dispatches_stock_shipment",
      sql`stock not in ('south', 'dammam') or shipment = 'ct'`,
    ),
    /**
     * `S119` — a destination note belongs to Cargo and to nothing else.
     *
     * One-directional: Cargo's note is **optional**, so a cargo dispatch with
     * none is legal. What this refuses is a note that would annotate a truck
     * that has no third-party destination — refuses it, rather than the writer
     * discarding it, which is the `AUDIT 1 F3` failure.
     */
    check(
      "dispatches_cargo_destination",
      sql`cargo_destination is null or shipment = 'cargo'`,
    ),
    /**
     * `S73` — **a dispatch cannot be approved without a payment method.**
     *
     * **One-directional, and that is deliberate.** The `= ` form used by
     * `dispatches_approval_stamps` and `dispatches_refusal_reason` would also
     * forbid a method on an unapproved row, which reads tighter but claims
     * something no rule says: `S76` puts *payment* among the fields the
     * coordinator's edit right reaches on a submitted request. More
     * importantly, `S73`'s own second half — *approval is final; anything wrong
     * afterwards is a cancellation* — arrived with a `cancelled` state that
     * still carries the method it was approved with, and this constraint was
     * the one written to need no amendment for it. It did not: the foresight
     * held, and a cancelled row keeps its method untouched.
     */
    check(
      "dispatches_payment_method",
      sql`payment_method is not null or status <> 'approved'`,
    ),
    /** `S71` — *an optional note carries anything the list does not*, so it
     *  needs a list entry to carry anything for. */
    check(
      "dispatches_payment_note",
      sql`payment_note is null or payment_method is not null`,
    ),
    /**
     * `S121` — *a dispatch is approved, then numbered*.
     *
     * One-directional for `dispatches_payment_method`'s second reason and one
     * of its own: **the number is not a condition of approval**, so an approved
     * dispatch with none is the ordinary state of one, and the `=` form would
     * make `S121` gate the very act the rule says it does not.
     *
     * **`cancelled` joins `approved` on the right-hand side** `S73`. This is
     * the one of `0022`'s five that the cancellation slice did have to amend:
     * one-directional in the sense that approval requires no number, it still
     * required `status = 'approved'` for a number to exist, and a numbered
     * dispatch is exactly the kind that gets cancelled. Nothing is cleared —
     * `S107`, and SMAC's number is what a person would search for afterwards.
     */
    check(
      "dispatches_smac_number_after_approval",
      sql`smac_dispatch_number is null or status in ('approved', 'cancelled')`,
    ),
    /**
     * `S121` — *which is unique*. Nulls are distinct in Postgres, so every
     * dispatch still waiting for its number shares the gap without colliding.
     * `setDispatchSmacNumber` checks first to turn a collision into a field
     * message; this is what holds when two coordinators race.
     */
    uniqueIndex("dispatches_smac_number_key").on(t.smacDispatchNumber),
    /**
     * `S120` — the two halves of the flag exist exactly when there is something
     * for them to be about.
     *
     * Both are written at submission and both clear on revival `S122`, so they
     * are null together; and neither means anything without a version to differ
     * from `S126` or a submission to have differed at. Row-local, so the
     * database holds it `CLAUDE.md`, and it is what stops a free entry `S75`
     * ever carrying a `false` a compliance figure would count as compliant.
     */
    check(
      "dispatches_difference_flag",
      sql`(differed_at_submission is null) = (lines_changed_after_submission is null)
          and (differed_at_submission is not null)
              = (submitted_at is not null and quotation_version_id is not null)`,
    ),
  ],
);

/**
 * `S116` — **a dispatch carries its own lines**, the same shape as a
 * quotation's product lines, but never service lines: `S59`'s fabrication is
 * excluded from square metres, and what is dispatched is cladding.
 *
 * Any line may differ from the quotation's, including price, and a dispatch may
 * add a product the quotation never had — which is why these are **copied
 * rows, never a reference** to `quotation_lines`. The invoice is made from
 * them. It also means a dispatch that matched its quotation and one that was
 * never edited are the same row, deliberately: `S120` flags a difference in
 * *values*, not an editing act, so there is no mode column and no edited flag.
 *
 * **`sqm` is generated here and stored nowhere else.** `dispatches` has no
 * `sqm` column since `0020`: a dispatch's square metres are the sum of these,
 * resolved in SQL at every reader. One number, computed by the database, so
 * the total cannot disagree with the lines it is made of — the alternative,
 * a stored total in `quotation_versions.total_sqm`'s shape, would oblige every
 * future writer to remember to recompute it.
 *
 * **The three money columns are NOT NULL** `S116`: *every line carries a
 * price; nothing is dispatched free*. That is the database half of the rule,
 * and it is the one difference in nullability from `quotation_lines`, where an
 * unpriced line is legal `S58`. The rate behind `vat_amount` is `VAT_RATE`
 * and no column holds it `S57`.
 *
 * **No `form_factor`**, and `quotation_lines` has none either since `0027`:
 * that column was always written `'sheet'`, nothing read it and nothing ever
 * set `coil`, so refusing to copy it here was right and the original has now
 * followed. **No `quotation_line_id`** either — the line-to-line comparison is
 * `S120`'s, and a column with a writer and no reader is a defect.
 */
export const dispatchLines = pgTable(
  "dispatch_lines",
  {
    id: pk(),
    dispatchId: uuid("dispatch_id")
      .notNull()
      .references(() => dispatches.id),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => productSuppliers.id),
    classId: uuid("class_id")
      .notNull()
      .references(() => productClasses.id),
    fireRatingId: uuid("fire_rating_id")
      .notNull()
      .references(() => productFireRatings.id),
    /** Typed, a code or a RAL/Pantone special, and required `S54`. */
    customColour: text("custom_colour").notNull(),
    thicknessId: uuid("thickness_id")
      .notNull()
      .references(() => productThicknesses.id),
    widthM: numeric("width_m", SQM).notNull(),
    lengthM: numeric("length_m", SQM).notNull(),
    quantityPcs: numeric("quantity_pcs", SQM).notNull(),
    /** Never hand-entered `S55` — the same expression `quotation_lines` uses. */
    sqm: numeric("sqm", SQM).generatedAlwaysAs(
      sql`quantity_pcs * width_m * length_m`,
    ),
    unitPrice: numeric("unit_price", MONEY).notNull(),
    lineTotal: numeric("line_total", MONEY).notNull(),
    vatAmount: numeric("vat_amount", MONEY).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("dispatch_lines_dispatch_idx").on(t.dispatchId)],
);

/* ------------------------------------------------------------------ *
 * 7. Duplicates and merge — `09 §7`
 * ------------------------------------------------------------------ */

/**
 * `09 §7.1` — duplicate companies and projects, including Arabic-vs-English
 * spelling variants `[04 B3 confirmed]`. Checking happens at entry, with the
 * phone number as the strongest key; the manager's queue is the exception path
 * `[07 B6]`.
 *
 * There is no `merge_events` table — rejected in `[10 §12]`. The tombstone
 * (`companies.merged_into_id`) plus the audit log already covers it `09 §7.3`.
 */
export const duplicateFlags = pgTable(
  "duplicate_flags",
  {
    id: pk(),
    recordType: recordTypeEnum("record_type").notNull(),
    recordAId: uuid("record_a_id").notNull(),
    recordBId: uuid("record_b_id").notNull(),
    source: duplicateFlagSourceEnum("source").notNull(),
    status: duplicateFlagStatusEnum("status").notNull().default("open"),
    resolution: duplicateResolutionEnum("resolution"),
    decidedByUserId: uuid("decided_by_user_id").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("duplicate_flags_a_idx").on(t.recordType, t.recordAId),
    index("duplicate_flags_b_idx").on(t.recordType, t.recordBId),
  ],
);

/**
 * `09 §7.2` — "false flag" is remembered permanently, otherwise the detector
 * re-flags the pair on every edit and the manager stops trusting the queue
 * `[07 B5]`.
 */
export const nonDuplicates = pgTable(
  "non_duplicates",
  {
    id: pk(),
    recordType: recordTypeEnum("record_type").notNull(),
    recordAId: uuid("record_a_id").notNull(),
    recordBId: uuid("record_b_id").notNull(),
    decidedByUserId: uuid("decided_by_user_id")
      .notNull()
      .references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("non_duplicates_pair_key").on(
      t.recordType,
      t.recordAId,
      t.recordBId,
    ),
  ],
);

/* ------------------------------------------------------------------ *
 * 8. Reports and tasks — `09 §8`
 *
 * `activities` — `09 §8.1`'s silent system-recorded events table — was
 * dropped in feature slice 6 `[26 §2]`. It was never written: `20 §6`
 * derives the timeline on read instead, the way this section's own comment
 * once explained. See `docs/26-deletion-pass.md` §2 for why removing it,
 * rather than leaving it empty, is now correct.
 * ------------------------------------------------------------------ */

/**
 * `09 §8.2`, reshaped by `20 §2` and `20 §13` — the second reporting layer,
 * never merged with the first `[04 B3 confirmed]`. Required only for what the
 * system cannot see — a visit, a call outcome, something said `[07 D6]`.
 *
 * **Not a polymorphic record reference, unlike every other pointer in this
 * schema `[09 §1.5]`.** One interaction anchors to a company AND optionally a
 * contact AND optionally a project at the same time `[20 §2]`, and a
 * `record_type` / `record_id` pair can only name one of them. The three columns
 * are explicit for that reason, and they are what `visibleRepReportsFilter`
 * reads: a report follows its anchor `[20 §10]`.
 *
 * **A report is one row `[20 §9]`.** Editing is an UPDATE, never a second row,
 * because counts read the current outcome and a correction must not
 * double-count. Only the author may edit, and the audit log carries the change.
 *
 * `on_hold_until` is the date the rep sets when the outcome is `on_hold`
 * `[20 §5]`. Nothing is stored on the company: suppression is derived on read
 * as the greatest such date that is not in the past, so correcting the report
 * corrects the suppression with nothing to keep in step.
 *
 * Compliance is coverage rather than submission `[20 §7]`, which supersedes
 * `07 D6`'s two-day grace: there is nothing to hand in and so nothing to miss,
 * and no working-day column exists or is needed.
 */
export const repReports = pgTable(
  "rep_reports",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    entryType: repReportEntryTypeEnum("entry_type").notNull(),
    /** Interaction only, and then required `[20 §2]`. */
    companyId: uuid("company_id").references(() => companies.id),
    /** Optional, and must belong to `company_id` — checked in the data layer. */
    contactId: uuid("contact_id").references(() => contacts.id),
    /** Optional, never required, and must be linked to `company_id` `[20 §2]`. */
    projectId: uuid("project_id").references(() => projects.id),
    channel: repReportChannelEnum("channel"),
    outcome: repReportOutcomeEnum("outcome"),
    /** Field note only, and then required `[20 §2]`. */
    category: fieldNoteCategoryEnum("category"),
    /** Field note only, optional. */
    cityId: uuid("city_id").references(() => cities.id),
    narrative: text("narrative").notNull(),
    /** Set exactly when the outcome is `on_hold` `[20 §5]`. */
    onHoldUntil: date("on_hold_until"),
    reportDate: date("report_date").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("rep_reports_user_date_idx").on(t.userId, t.reportDate),
    index("rep_reports_company_idx").on(t.companyId, t.reportDate),
    index("rep_reports_project_idx").on(t.projectId, t.reportDate),
    /**
     * `13 §1` — what a row may contain, which belongs in the database, as
     * distinct from who may write it, which stays in one application layer.
     * That the contact and project belong to the company is a cross-table rule
     * and stays in `src/lib/reports.ts` as a `RuleError`, exactly as
     * `dispatches.ts` handles a company not on a thread.
     */
    check(
      "rep_reports_shape",
      sql`(
        entry_type = 'interaction'
        and company_id is not null
        and channel is not null
        and outcome is not null
        and category is null
        and city_id is null
      ) or (
        entry_type = 'field_note'
        and company_id is null
        and contact_id is null
        and project_id is null
        and channel is null
        and outcome is null
        and category is not null
      )`,
    ),
    /**
     * `20 §5` — the date is required for `on_hold` and forbidden otherwise.
     * `is distinct from` never returns null, so this also holds for a field
     * note, whose outcome is null. A plain `outcome = 'on_hold'` would evaluate
     * to null there and the constraint would pass on anything.
     */
    check(
      "rep_reports_on_hold",
      sql`(outcome is distinct from 'on_hold') = (on_hold_until is null)`,
    ),
  ],
);

/**
 * `20 §4` — the signals raised on a report. Separate from the outcome because
 * they answer a different question: the outcome is what happened in the funnel,
 * a signal is what the customer said that the business needs to know.
 *
 * `reference` is what makes them aggregate — a competitor's name, a colour
 * code, a class or fire rating. It is optional and free text; only four of the
 * nine values invite one, and which four is a form concern, not a constraint.
 *
 * Editing a report replaces its signal set rather than appending to it
 * `[20 §9]`, which is the one place this phase deletes a row. It is a component
 * of its parent, not history: the same reading under which `quotations.ts`
 * deletes a line off an unissued version.
 */
export const repReportSignals = pgTable(
  "rep_report_signals",
  {
    id: pk(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => repReports.id),
    signal: reportSignalEnum("signal").notNull(),
    reference: text("reference"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("rep_report_signals_key").on(t.reportId, t.signal),
    /* `rep_report_signals_signal_idx` on `(signal)` was here until `0027`. It
     * was landed in `0005` "so `20 §4`'s aggregation needs no migration when
     * Phase 12 asks" — an index built for `S49`, which is still `[BUILD]`.
     * Every query on this table leads with `report_id`, which the unique key
     * above serves. `S49` adds the index it needs with the query that needs
     * it; that is the same rule `CLAUDE.md` states for a column and its
     * writer. */
  ],
);

/**
 * `tasks` — `09 §8.3` + `10 §9`'s manual-task table — was dropped in feature
 * slice 6 `[26 §6]`. `25 §20` ("manual tasks are built, small") was withdrawn
 * the same slice, founder-decided, "not needed for now": nothing ever wrote
 * a row, `task_origin` and `task_status` went with it, and `19 §7`'s
 * handover reassignment (which moved open tasks between reps) went too —
 * see `docs/26-deletion-pass.md` §6 for what this supersedes without
 * editing `07 A1`, `21 §1` or `19 §7` in place.
 */

/* ------------------------------------------------------------------ *
 * 8A. Comments — `25 §9`–`§15`
 * ------------------------------------------------------------------ */

/**
 * `S114` — comments belong on a **project and a quotation thread**, for all
 * roles. The founder called it structural rather than a feature, and it is.
 *
 * `25 §9` put them on every record and the CHECK below admitted five until
 * session `27b`. `S114` supersedes it: the timeline already carries a company,
 * and a comment follows its anchor `S131`, so one on a company reached every
 * holder of a share of it.
 *
 * **The distinction that makes it work** `[25 §9]`: a *report* is what happened
 * with the customer — visit, call, outcome, signals — and it feeds metrics. A
 * *comment* is what colleagues say to each other about a record. Both land on
 * the same timeline; one thread per record carrying reports, system events and
 * conversation.
 *
 * What it replaces is WhatsApp `[25 §9]`: the rep and coordinator currently
 * coordinate a quotation somewhere the negotiation vanishes. `22 §4`'s chain
 * shows whose move it is; comments let them discuss it in place. That is
 * `07 G3`'s "one place" criterion, directly. It does not try to become the
 * conversation `[25 §15]` — it is where a decision gets written down, not
 * where it has to be made.
 *
 * **Counted, never summed with reports** `[25 §14]`. The daily view shows
 * `reports: 4 · comments: 7` as separate columns: merging them would let a rep
 * raise his activity count by talking to colleagues. Same principle as
 * `07 D2`, shown side by side and never combined.
 *
 * **Editable by the author, never deleted** `[25 §12]`, consistent with
 * `12 §7`. So there is no `deleted_at`; `edited_at` is stamped on an edit and
 * the audit log holds the before and after. Visibility follows the record
 * `[25 §10]` — manager, coordinator, the owning rep and any shared rep — the
 * same rule reports follow `[20 §10]`, so no new predicate is needed.
 *
 * `25 §13` folds the coordinator's "returned for edits" reason in here: it is
 * the same act, so no separate field.
 */
export const comments = pgTable(
  "comments",
  {
    id: pk(),
    recordType: recordTypeEnum("record_type").notNull(),
    recordId: uuid("record_id").notNull(),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    /** Null until the author edits it `[25 §12]`. */
    editedAt: timestamp("edited_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    /* `comments_author_idx` on `(author_user_id, created_at)` was here until
     * `0027`. No query has ever filtered or ordered by the author: every
     * reader reaches `users` through `eq(users.id, comments.authorUserId)`,
     * which uses the users primary key, and the one authorship test is a
     * row-local `!==` on a comment already fetched by id. */
    index("comments_record_idx").on(t.recordType, t.recordId, t.createdAt),
    /**
     * `13 §1`, `S114` — the **two** kinds that rule names, stated
     * **positively**.
     *
     * `record_type` is shared with `record_shares`,
     * `duplicate_flags` and `attachments` (`tasks` and `activities` shared it
     * too, until feature slice 6 dropped both `[26 §2, §6]`; so did
     * `pipeline_snapshots`, until `SPEC §15` did), so it will grow for reasons
     * that have nothing to do with comments. A negative CHECK would silently
     * admit every value added later; this one refuses until somebody decides.
     * That excludes `company`, `contact` and `dispatch`, which `S114` forbids
     * and `0032` narrowed this to; and `quotation_version`, which `0027`
     * removed from `record_type` altogether.
     *
     * **The type is untouched by that narrowing** — the four tables above still
     * need all five values, so `0032` rebuilt this CHECK and nothing else. That
     * is also why `0024`'s enum-rebuild trap does not apply to it: nothing
     * casts this column to `text`, so the literals below never have to be
     * re-resolved.
     */
    check(
      "comments_record_type",
      sql`record_type in ('project', 'quotation_thread')`,
    ),
  ],
);

/**
 * `25 §11` — tagging a person raises a notification, which is the difference
 * between a comment box people ignore and one that replaces WhatsApp.
 *
 * **People only, deliberately.** `25 §11` wants `@Rawan`, `@9592` and
 * `@مؤسسة فاينال فير` all to become links, but ships people first: tagging a
 * record means an autocomplete across four entity types that respects
 * visibility — its own piece of work, and not to be bundled in as "comments,
 * plus mentions". Record-tagging is `25 H2`, still open. When it lands it is a
 * sibling table or two more columns here, not a reinterpretation of this one.
 *
 * One row per mentioned person per comment; re-editing a comment rewrites the
 * set, the way `20 §9` rewrites a report's signals.
 */
export const commentMentions = pgTable(
  "comment_mentions",
  {
    id: pk(),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id),
    mentionedUserId: uuid("mentioned_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("comment_mentions_key").on(t.commentId, t.mentionedUserId),
    /* `comment_mentions_user_idx` on `(mentioned_user_id, created_at)` was
     * here until `0027`. The one predicate on the column is an `inArray`
     * inside a delete already scoped by `comment_id`, which the unique key
     * above serves; everything else joins `users` on its primary key. */
  ],
);

/* ------------------------------------------------------------------ *
 * 9. Notifications — `09 §9`
 * ------------------------------------------------------------------ */

/**
 * `10 §10` — type is a lookup, not an enum in code: the full trigger list
 * stays open, and adding a type must be data, not a migration.
 *
 * **`tier` and `is_persistent` were columns here until `0033`** `S91`, which
 * deletes the two tiers and the persistence flag together. A row is now a key
 * and its two names. `07 G1`'s undismissable act-now badge has no tier to sit
 * in and no flag to set, and `21 §3`'s per-anchor resolution rules — the thing
 * `is_persistent` existed to make safe — are gone with it.
 *
 * **`default_channel` was a third until `0027`**, and it is the clearest case
 * in the sweep of a column whose reader was itself dead: the one query that
 * read it (`notifications.ts`) read it only to stamp `notifications.channel`,
 * which nothing read at all. Delivery is in-app and no rule names a second
 * channel, so both columns and the `notification_channel` type went together.
 */
export const notificationTypes = pgTable(
  "notification_types",
  {
    id: pk(),
    /** Stable identifier the raising code refers to. */
    key: text("key").notNull(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("notification_types_key").on(t.key)],
);

/**
 * `09 §9.1` — in-app only, and since `S91` a **bell carrying news** `S92`:
 * something that has already happened to the recipient, disposed of by being
 * read and by nothing else.
 *
 * **`resolved_at` and `digest_date` were columns here until `0033`.**
 * Resolution was by condition rather than by click `[10 §10]` and the sweep in
 * `notifications.ts` wrote it; `S91` deletes the sweep, so nothing would have
 * written the column and `resolved_at is null` would have been true of every
 * row for ever — the badge that can never clear, arrived at by deleting the
 * machinery meant to prevent it. `digest_date` keyed the one daily
 * `followup.digest`, which is the type `S91` removes. **Both partial unique
 * indexes went with them**: `notifications_digest_key` was one digest per
 * recipient per day, and `notifications_live_key` was one live persistent row
 * per anchor. News does not deduplicate — a second refusal is a second thing
 * that happened.
 *
 * **There is no `channel` column** since `0027`. `[04 Q17, C3]` wanted one on
 * every row "from day one" so a second channel would be a migration rather
 * than a rewrite; six hundred and twenty rows later every one said `in_app`
 * and no query, screen or filter had ever asked. A channel arrives with its
 * reader or not at all — see `notification_types` above.
 *
 * **Recipient filtering is in the application layer**, in every query's own
 * `WHERE` — `src/lib/notifications.ts`. v1's bug was selecting and bulk-updating
 * this table with no recipient filter and relying on RLS `[00 §1.13]`, and
 * FACET has no RLS `[03]`, so a missing filter here is no defence at all.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: pk(),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => users.id),
    notificationTypeId: uuid("notification_type_id")
      .notNull()
      .references(() => notificationTypes.id),
    /**
     * The anchor, **both halves or neither** — the CHECK below, `AUDIT 1 E2`.
     * A mention carries no anchor and a handover carries none either; what
     * cannot happen is a type carrying one and not the other.
     */
    recordType: recordTypeEnum("record_type"),
    recordId: uuid("record_id"),
    /**
     * `[21 §5, §10]` — the ICU variables a summary message needs. Used by
     * exactly one type: `record.handed_over` carries the departing rep and the
     * four bucket counts, because a handover raises one notification rather
     * than one per record and this table has no title or body column by design.
     */
    payload: jsonb("payload"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("notifications_recipient_idx").on(t.recipientUserId, t.createdAt),
    /**
     * The nullable pair is filled together or not at all `AUDIT 1 E2`.
     *
     * Three identically-shaped pairs elsewhere in this file each carry one of
     * these and this pair did not, so the database allowed a half-filled row
     * and `notifications/page.tsx` invented `?? "company"` and `?? ""` to
     * render around it — a screen guessing at a record type. The guess is gone
     * and this is what makes it unnecessary.
     */
    check(
      "notifications_record_pair",
      sql`(${t.recordType} is null) = (${t.recordId} is null)`,
    ),
  ],
);

/* ------------------------------------------------------------------ *
 * 10. Settings — `09 §10`
 * ------------------------------------------------------------------ */

/**
 * `09 §10.2` — keyed configuration, intended to be manager-editable rather
 * than in code. Three separate decisions put values here: the five
 * follow-up thresholds `[07 D5]`, the quotation term defaults, and
 * print-time boilerplate such as bank account details `[08 D9]`. Changes
 * are visible through the audit log, so there is no `updated_at` here
 * either.
 *
 * **No screen edits it yet** `[26 §4]` — today a row only ever changes by a
 * direct database edit. `09 §10.2`'s manager-editable screen does not exist.
 */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ *
 * 11. Audit log — `09 §11`
 * ------------------------------------------------------------------ */

/**
 * `09 §11.1` — append-only, written by the data layer, not per feature
 * `[07 E1]`.
 *
 * Impersonation is first-class: every impersonated action records both
 * identities — "Jerom acting as Sara" — so the real actor and the impersonated
 * identity are separate references `[07 A6]`. Bulk exports are written here
 * `[07 B8]`, `[07 E1]`, and payment confirmation records who and when
 * `[07 C3]`.
 *
 * `entity_type` is free text, not the `record_type` enum: the data layer
 * writes an entry for every table, not only the polymorphic-reference targets.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: pk(),
    /** The real actor. */
    actorUserId: uuid("actor_user_id").references(() => users.id),
    /** The impersonated identity, when the actor is acting as someone else. */
    actingAsUserId: uuid("acting_as_user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_log_entity_idx").on(t.entityType, t.entityId),
    /* `audit_log_actor_idx` on `(actor_user_id, created_at)` was here until
     * `0027`, and it is the eleventh of the ten `AUDIT 1` counted. Every
     * reader that cares who acted asks for the EFFECTIVE actor —
     * `coalesce(acting_as_user_id, actor_user_id)` `[07 A6]` — and a btree on
     * one of the two columns cannot serve a coalesce over both. `S123`'s
     * measure adds an index with its query if it needs one. */
  ],
);

/* ------------------------------------------------------------------ *
 * 13. Attachments — `09 §13`
 * ------------------------------------------------------------------ */

/**
 * `09 §13.1` — included from the start even though nothing writes to it in
 * v1. Files live on the PC disk with the path stored here `[03]`.
 */
export const attachments = pgTable(
  "attachments",
  {
    id: pk(),
    recordType: recordTypeEnum("record_type").notNull(),
    recordId: uuid("record_id").notNull(),
    path: text("path").notNull(),
    uploadedByUserId: uuid("uploaded_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("attachments_record_idx").on(t.recordType, t.recordId)],
);
