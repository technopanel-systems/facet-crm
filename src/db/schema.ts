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
 * Auth.js session/account tables (`sessions`, `accounts`,
 * `verification_tokens`, plus `users.email_verified` / `users.image`) carry
 * the shape the library dictates `[09 §2.2]`, `[03]` — added in phase 6 with
 * the Drizzle adapter, not designed here.
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

/** `[09 §1]` — the polymorphic record reference used across the schema. */
export const recordTypeEnum = pgEnum("record_type", [
  "company",
  "contact",
  "project",
  "quotation_thread",
  "quotation_version",
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

/** `[07 C5]` */
export const projectEndStateEnum = pgEnum("project_end_state", [
  "won",
  "lost",
  "dormant",
]);

/** `[04 Q8]` — deletion is a request to the manager. */
export const deleteRequestStatusEnum = pgEnum("delete_request_status", [
  "pending",
  "granted",
  "denied",
]);

/** `[07 C5]`, `[07 C4]`, `[07 C7]` */
export const quotationThreadEndStateEnum = pgEnum(
  "quotation_thread_end_state",
  ["accepted", "rejected", "cancelled", "expired"],
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

/** `[07 C2]`, `[07 C7]`, plus `initial_request` for version 1 `[10 §4]`. */
export const quotationVersionOriginEnum = pgEnum("quotation_version_origin", [
  "initial_request",
  "rep_change_request",
  "coordinator_direct_edit",
  "expiry_revision",
]);

/** `[08 B2]` */
export const formFactorEnum = pgEnum("form_factor", ["sheet", "coil"]);

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

/** `[07 E5]`, `[07 G1]` */
export const notificationTierEnum = pgEnum("notification_tier", [
  "act_now",
  "digest",
]);

/**
 * `[04 Q17, C3]` — in-app only today, but the column exists from day one so
 * adding a channel is a migration, not a rewrite of every call site.
 */
export const notificationChannelEnum = pgEnum("notification_channel", [
  "in_app",
]);

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
 * Region and city per `[10 §7]`: the rep's base, which makes "sales by rep's
 * region" and "sales by site region" two separately answerable questions.
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
    cityId: uuid("city_id").references(() => cities.id),
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
 * `[09 §2.2]`, `[03]`. Only `sessions` is used under credentials-only
 * auth; `accounts` and `verification_tokens` exist because the adapter
 * requires them and stay empty.
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

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
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
    /** The customer's VAT number `[08 D7]`. */
    vatNumber: text("vat_number"),
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
    /**
     * `[25 §7]` — the exception to `07 C3`'s payment gate. Some customers buy
     * on credit, so a dispatch against them is allowed and **flagged as such**,
     * the way a direct dispatch already is. Set by the manager.
     *
     * A property of the **company**, deliberately, not a per-dispatch override
     * tick: an override would let anyone bypass the gate case by case, whereas
     * this says some customers simply have different terms. Nobody skips a
     * gate.
     */
    hasCreditTerms: boolean("has_credit_terms").notNull().default(false),
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
    /** The registering rep automatically becomes primary `[04 Q11]`. */
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
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar"),
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
 * `09 §3.5` — the join that makes a company's involvement meaningful
 * `[04 Q2]`.
 *
 * `12 §5`, `12 §6` correct this table twice. The role is a **free text label**
 * describing what that company is on that project, not a foreign key into a
 * vocabulary — competing contractors must both be describable `[12 §5]`. And
 * the buyer is **zero or one**, never exactly one: while two companies compete
 * there is no buyer, and there may never be one `[12 §6]`. The partial unique
 * index below is what "at most one" means in SQL, and it says nothing when no
 * row is flagged.
 *
 * `14 §4` adds removal: links are meant to be flexible and changeable, so a
 * company can be taken off a project. Soft, like every other state change in
 * FACET `[09 §1]` — the row is kept and hidden. Both unique indexes are
 * therefore partial on `removed_at is null` `[14 §5]`: without that, a removed
 * company could never be re-linked and a removed buyer would permanently block
 * naming a new one. A project still requires one live link `[07 A9]`, which is
 * an application-layer rule because SQL cannot express "at least one" here.
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
    /** Free text `[12 §5]`. */
    role: text("role"),
    isBuyer: boolean("is_buyer").notNull().default(false),
    /** `[14 §4]` — the link was taken off the project. Never a deleted row. */
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("project_companies_key")
      .on(t.projectId, t.companyId)
      .where(sql`removed_at is null`),
    uniqueIndex("project_companies_one_buyer_key")
      .on(t.projectId)
      .where(sql`is_buyer and removed_at is null`),
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
 * `09 §4.3` — deleting requires a stated reason and goes to the manager
 * `[04 Q8]`. On a shared company, granting removes only the requester's
 * membership row.
 */
export const deleteRequests = pgTable(
  "delete_requests",
  {
    id: pk(),
    recordType: recordTypeEnum("record_type").notNull(),
    recordId: uuid("record_id").notNull(),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id),
    reason: text("reason").notNull(),
    status: deleteRequestStatusEnum("status").notNull().default("pending"),
    decidedByUserId: uuid("decided_by_user_id").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("delete_requests_record_idx").on(t.recordType, t.recordId)],
);

/* ------------------------------------------------------------------ *
 * 5. Quotations — `09 §5`
 * ------------------------------------------------------------------ */

/**
 * `09 §5.2` — one thread, many versions. The project link is required even
 * though SMAC does not require one, so it cannot be validated against SMAC
 * `[08 C3]`.
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
    cancelledByUserId: uuid("cancelled_by_user_id").references(() => users.id),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    paymentConfirmedByUserId: uuid("payment_confirmed_by_user_id").references(
      () => users.id,
    ),
    paymentConfirmedAt: timestamp("payment_confirmed_at", {
      withTimezone: true,
    }),
    /** The rep's mark, which comes after payment `[04 flow 13]`. */
    acceptedForProcessingAt: timestamp("accepted_for_processing_at", {
      withTimezone: true,
    }),
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
    /** Per quotation, set at creation, varies case by case `[07 C7]`, `[08 D9]`. */
    validUntil: date("valid_until"),
    /** Terms default from settings `[08 D9]` and are then per-version fields. */
    deliveryPeriod: text("delivery_period"),
    paymentMethod: text("payment_method"),
    shipmentTerms: text("shipment_terms"),
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
 * combinations and go stale `[08 D1]`. `code` is the token that appears in the
 * generated product name; the name itself is derived output, never a stored
 * free-text column `[08 B1, D1]`.
 * ------------------------------------------------------------------ */

/** N, K, D, C, G, G1, Y `[08 B1]`. */
export const productSuppliers = pgTable("product_suppliers", {
  id: pk(),
  code: text("code").notNull(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  createdAt: createdAt(),
});

/** A, B, A2G1, A2G2 `[08 B1]`. */
export const productClasses = pgTable("product_classes", {
  id: pk(),
  code: text("code").notNull(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  createdAt: createdAt(),
});

/** B1, A2, Normal `[08 B1]`. */
export const productFireRatings = pgTable("product_fire_ratings", {
  id: pk(),
  code: text("code").notNull(),
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
    /**
     * `12 §11` — quotation lines are sheets only; coils belong to production.
     * The column is left as `08 B2` defined it and the application writes
     * `sheet`; nothing in `12 §14` asks for it to change.
     */
    formFactor: formFactorEnum("form_factor").notNull(),
    widthM: numeric("width_m", SQM).notNull(),
    lengthM: numeric("length_m", SQM).notNull(),
    /** Coil quantity unit is still open `[08 E5]`, `[10 §13 item 10]`. */
    quantityPcs: numeric("quantity_pcs", SQM).notNull(),
    sqm: numeric("sqm", SQM).generatedAlwaysAs(
      sql`quantity_pcs * width_m * length_m`,
    ),
    unitPrice: numeric("unit_price", MONEY),
    lineTotal: numeric("line_total", MONEY),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 }),
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
 * `09 §6.1` — what the coordinator records as actually having gone out. The
 * one event that credits targets `[04 flow 16]`, `[04 C1]`. One quotation can
 * produce several partial dispatches; quotation quantity ≠ paid quantity ≠
 * dispatched quantity `[04 quantities]`.
 *
 * The quotation link is optional, because customers sometimes buy directly
 * `[07 C6]` — a null thread is exactly what makes a direct dispatch visible as
 * such in reporting, so the route cannot quietly bypass the chain.
 *
 * Achieved SQM and pipeline metrics derive from these rows and nowhere else.
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
    sqm: numeric("sqm", SQM).notNull(),
    quotationThreadId: uuid("quotation_thread_id").references(
      () => quotationThreads.id,
    ),
    dispatchDate: date("dispatch_date").notNull(),
    recordedByUserId: uuid("recorded_by_user_id")
      .notNull()
      .references(() => users.id),
    /** The coordinator's approval, for direct dispatches `[07 C6]`. */
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("dispatches_user_date_idx").on(t.userId, t.dispatchDate),
    index("dispatches_company_idx").on(t.companyId),
    index("dispatches_thread_idx").on(t.quotationThreadId),
  ],
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
    /**
     * `[25 §34]` — a small reference beside the outcome: a sample number, a
     * colour code, a document name, so *"Sample #2 → 168"* is a value rather
     * than a sentence and "how many samples of 168 went out this quarter" is a
     * query. Same reasoning as `20 §4`'s signal references, and free text for
     * the same reason.
     */
    reference: text("reference"),
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
    /**
     * `25 §34` puts the reference **beside the outcome**, and a field note has
     * no outcome — it is anchored to nobody and touches no customer timeline
     * `[20 §2]`. The narrow reading on purpose: relaxing a constraint later is
     * a one-line migration, and a column that quietly accepts anything is not.
     */
    check(
      "rep_reports_reference",
      sql`reference is null or entry_type = 'interaction'`,
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
    /** So `20 §4`'s aggregation needs no migration when Phase 12 asks. */
    index("rep_report_signals_signal_idx").on(t.signal),
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
 * `25 §9` — comments belong on **every** record: projects, companies,
 * quotations, contacts, dispatches, for all roles. The founder called it
 * structural rather than a feature, and it is.
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
    index("comments_record_idx").on(t.recordType, t.recordId, t.createdAt),
    index("comments_author_idx").on(t.authorUserId, t.createdAt),
    /**
     * `13 §1`, `25 §9` — the five kinds §9 names, stated **positively**.
     *
     * `record_type` is shared with `record_shares`, `delete_requests`,
     * `duplicate_flags`, `attachments` and `pipeline_snapshots` (`tasks` and
     * `activities` shared it too, until feature slice 6 dropped both
     * `[26 §2, §6]`), so it will grow for reasons that have nothing to do
     * with comments. A negative CHECK would silently admit every value added
     * later; this one refuses until somebody decides. Today that excludes
     * `quotation_version` — a comment belongs to the thread, which is the
     * conversation, not to one superseded version of it.
     */
    check(
      "comments_record_type",
      sql`record_type in ('company', 'contact', 'project', 'quotation_thread', 'dispatch')`,
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
    index("comment_mentions_user_idx").on(t.mentionedUserId, t.createdAt),
  ],
);

/* ------------------------------------------------------------------ *
 * 9. Notifications — `09 §9`
 * ------------------------------------------------------------------ */

/**
 * `10 §10` — type is a lookup, not an enum in code: the full trigger list
 * stays open, and adding a type must be data, not a migration. Each type
 * carries its tier, default channel and whether it is persistent.
 */
export const notificationTypes = pgTable(
  "notification_types",
  {
    id: pk(),
    /** Stable identifier the raising code refers to. */
    key: text("key").notNull(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    tier: notificationTierEnum("tier").notNull(),
    defaultChannel: notificationChannelEnum("default_channel")
      .notNull()
      .default("in_app"),
    /** Act-now notifications stay until the action is resolved `[07 G1]`. */
    isPersistent: boolean("is_persistent").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("notification_types_key").on(t.key)],
);

/**
 * `09 §9.1` — in-app only for now, but every notification carries a channel
 * from day one `[04 Q17, C3]`. Resolution is by condition, not by click
 * `[10 §10]`: `resolved_at` is written by the completing action, which is what
 * makes persistence safe rather than maddening `[07 G1]`.
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
    channel: notificationChannelEnum("channel").notNull().default("in_app"),
    recordType: recordTypeEnum("record_type"),
    recordId: uuid("record_id"),
    /**
     * `[21 §5, §10]` — the ICU variables a summary message needs. Used by
     * exactly one type: `record.handed_over` carries the departing rep and the
     * four bucket counts, because a handover raises one notification rather
     * than one per record and this table has no title or body column by design.
     */
    payload: jsonb("payload"),
    /**
     * `[21 §10]` — the calendar day a digest summarises, and the key that makes
     * generation idempotent under sweep-on-read. A stored column rather than an
     * expression index because `(created_at AT TIME ZONE 'Asia/Riyadh')::date`
     * is STABLE, not IMMUTABLE, and Postgres will not index it.
     */
    digestDate: date("digest_date"),
    readAt: timestamp("read_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("notifications_recipient_idx").on(t.recipientUserId, t.createdAt),
    /** One digest per recipient per day, however many times the sweep runs. */
    uniqueIndex("notifications_digest_key")
      .on(t.recipientUserId, t.notificationTypeId, t.digestDate)
      .where(sql`${t.digestDate} is not null`),
    /**
     * A persistent notification is raised at most once while unresolved
     * `[07 G1]`. This is what makes re-deriving on every sweep safe rather than
     * duplicating: the raise is an `on conflict do nothing`.
     */
    uniqueIndex("notifications_live_key")
      .on(t.recipientUserId, t.notificationTypeId, t.recordType, t.recordId)
      .where(sql`${t.resolvedAt} is null and ${t.recordId} is not null`),
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
    index("audit_log_actor_idx").on(t.actorUserId, t.createdAt),
  ],
);

/* ------------------------------------------------------------------ *
 * 12. Snapshots — `09 §12`, columns per `10 §11`
 * ------------------------------------------------------------------ */

/**
 * `10 §11` — period, company or project, derived stage, owning rep, expected
 * sqm, value. Written by a scheduled job, never edited afterwards `[07 E2]`.
 * `derived_stage` is text because the funnel is computed, not stored
 * `[10 §1]`, and a snapshot captures whatever the computation said at the
 * time.
 *
 * `10 §11` also listed warmth. `25 §6` cut it, and this table has never been
 * written, so the column went with the rest.
 */
export const pipelineSnapshots = pgTable(
  "pipeline_snapshots",
  {
    id: pk(),
    period: date("period").notNull(),
    recordType: recordTypeEnum("record_type").notNull(),
    recordId: uuid("record_id").notNull(),
    derivedStage: text("derived_stage"),
    ownerUserId: uuid("owner_user_id").references(() => users.id),
    sqmExpected: numeric("sqm_expected", SQM),
    value: numeric("value", MONEY),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("pipeline_snapshots_key").on(
      t.period,
      t.recordType,
      t.recordId,
    ),
  ],
);

/**
 * `10 §11` — period, person, target sqm, achieved sqm, quotations raised,
 * quotations accepted, dispatches, activity count, reports submitted.
 *
 * Target progress and activity level sit side by side and are never combined
 * into one score `[07 D2]` — which is why there is no combined-score column
 * here or anywhere else.
 */
export const personSnapshots = pgTable(
  "person_snapshots",
  {
    id: pk(),
    period: date("period").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    targetSqm: numeric("target_sqm", SQM),
    achievedSqm: numeric("achieved_sqm", SQM),
    quotationsRaised: integer("quotations_raised").notNull().default(0),
    quotationsAccepted: integer("quotations_accepted").notNull().default(0),
    dispatchCount: integer("dispatch_count").notNull().default(0),
    activityCount: integer("activity_count").notNull().default(0),
    reportsSubmitted: integer("reports_submitted").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("person_snapshots_key").on(t.period, t.userId)],
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
