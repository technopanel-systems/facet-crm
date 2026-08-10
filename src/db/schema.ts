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
 *  2. Bilingual names plus a normalised form. `name_en` / `name_ar` on
 *     everything user-facing; `name_normalized` additionally on companies,
 *     contacts and projects, which are what duplicate matching compares.
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

/** `[10 §1]` — the rep's judgement. A short list, deliberately not a percentage. */
export const warmthEnum = pgEnum("warmth", ["cold", "warm", "hot", "dormant"]);

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

/** `[09 §3.2]` — how a rep's membership of a company arose. */
export const companyRepOriginEnum = pgEnum("company_rep_origin", [
  "self_registered",
  "assigned",
  "shared",
  "merge",
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

/** `[07 A1]`, `[10 §9]` */
export const taskOriginEnum = pgEnum("task_origin", [
  "self",
  "assigned",
  "system",
]);

/** `[10 §9]` */
export const taskStatusEnum = pgEnum("task_status", [
  "open",
  "done",
  "cancelled",
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

/** `[04 B3 confirmed]` */
export const repReportKindEnum = pgEnum("rep_report_kind", ["visit", "call"]);

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
 * `09 §3.6` — "city, with a Saudi city lookup" `[07 A7]`.
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
 * filter, not a second table. That is why almost everything here is nullable —
 * unqualified entry requires only name, phone, source and what they asked
 * about; fields become required progressively in the application layer.
 *
 * Warmth `[10 §1]` is the rep's judgement, stored alongside the derived stage
 * and never merged with it. Changes go to the audit log, which is what makes
 * warmth history visible.
 */
export const companies = pgTable(
  "companies",
  {
    id: pk(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar"),
    nameNormalized: text("name_normalized").notNull(),
    /** The strongest duplicate-matching key `[07 B6]`. */
    phone: text("phone"),
    categoryId: uuid("category_id").references(() => companyCategories.id),
    /** The customer's VAT number `[08 D7]`. */
    vatNumber: text("vat_number"),
    region: regionEnum("region"),
    cityId: uuid("city_id").references(() => cities.id),
    leadSourceId: uuid("lead_source_id").references(() => leadSources.id),
    /** What the customer needs, entered at registration `[04 Q19]`, `[07 B4]`. */
    notes: text("notes"),
    warmth: warmthEnum("warmth"),
    warmthSetBy: uuid("warmth_set_by").references(() => users.id),
    warmthSetAt: timestamp("warmth_set_at", { withTimezone: true }),
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
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar"),
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
    /** Required when the project is marked lost `[04 Q18]`, `[07 C5]`. */
    lossReason: text("loss_reason"),
    region: regionEnum("region"),
    cityId: uuid("city_id").references(() => cities.id),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("projects_owner_idx").on(t.ownerUserId),
    index("projects_name_normalized_idx").on(t.nameNormalized),
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
 * field `[07 D3]`. A single-owner project has no rows and credits 100% to the
 * owner. A null percentage is a contributor — visible, not credited.
 * Recording a dispatch never sets a split.
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
    /** Null = contributor row. */
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
    createdAt: createdAt(),
  },
  (t) => [
    index("quotation_threads_project_idx").on(t.projectId),
    index("quotation_threads_company_idx").on(t.companyId),
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

/**
 * **Unused since `17 §2`** — the colour is typed on the quotation line, not
 * picked, so this stays empty and no screen reads it. Kept because no document
 * asks for it to be dropped, and `quotation_lines.colour_id` still points here.
 */
export const productColours = pgTable("product_colours", {
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
 * Colour is one of two things, never both and never neither `[12 §12]`. Since
 * `17 §2` it is always the second: **`custom_colour` carries every line** — an
 * ordinary code like `168` as readily as a RAL or Pantone special — and
 * `colour_id` stays null. The CHECK is unchanged and still requires exactly
 * one.
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
    /** Always null since `17 §2` — the lookup is no longer offered. */
    colourId: uuid("colour_id").references(() => productColours.id),
    /** The colour, typed `[17 §2]`: a code, or a RAL/Pantone special. */
    customColour: text("custom_colour"),
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
  (t) => [
    index("quotation_lines_version_idx").on(t.versionId),
    // "A line uses one or the other" `[12 §12]` — a data-integrity rule, not
    // an authorization one, so the database is the right place for it.
    check(
      "quotation_lines_colour_choice",
      sql`num_nonnulls(colour_id, custom_colour) = 1`,
    ),
  ],
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
 * 8. Activity, reports, tasks — `09 §8`
 * ------------------------------------------------------------------ */

/**
 * `09 §8.1` — silent system-recorded events, written by the system and typed
 * by no one `[04 B3 confirmed]`. Private to the rep, without exception
 * `[04 Q6]`. Qualification is detected from these events, never set by a human
 * `[04 qualification]`, `[10 §1]`.
 *
 * `activity_type` is free text: the documents give examples (lead added,
 * catalogue sent, dispatch) but never a closed list, and no document makes it
 * a lookup — unlike notification type `[10 §10]`.
 */
export const activities = pgTable(
  "activities",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    activityType: text("activity_type").notNull(),
    recordType: recordTypeEnum("record_type").notNull(),
    recordId: uuid("record_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("activities_user_idx").on(t.userId, t.createdAt),
    index("activities_record_idx").on(t.recordType, t.recordId),
  ],
);

/**
 * `09 §8.2` — the second reporting layer, never merged with the first
 * `[04 B3 confirmed]`. Required only for what the system cannot see — a visit,
 * a call outcome, something said `[07 D6]`. Compliance is a diagnostic with a
 * two-day grace and no automatic penalty: a reporting rule, not a column.
 */
export const repReports = pgTable(
  "rep_reports",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    recordType: recordTypeEnum("record_type").notNull(),
    recordId: uuid("record_id").notNull(),
    kind: repReportKindEnum("kind").notNull(),
    narrative: text("narrative").notNull(),
    reportDate: date("report_date").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("rep_reports_user_date_idx").on(t.userId, t.reportDate),
    index("rep_reports_record_idx").on(t.recordType, t.recordId),
  ],
);

/**
 * `09 §8.3` + `10 §9` — one entity for all three kinds, distinguished by
 * origin `[07 A1]`. System follow-ups are generated from the threshold
 * settings `[07 D5]` and carry the trigger that created them, so a follow-up
 * can close itself when the underlying condition clears `[10 §9]`.
 */
export const tasks = pgTable(
  "tasks",
  {
    id: pk(),
    title: text("title").notNull(),
    description: text("description"),
    origin: taskOriginEnum("origin").notNull(),
    assignedToUserId: uuid("assigned_to_user_id")
      .notNull()
      .references(() => users.id),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    recordType: recordTypeEnum("record_type"),
    recordId: uuid("record_id"),
    dueDate: date("due_date"),
    status: taskStatusEnum("status").notNull().default("open"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** Set on system tasks: the condition that raised it `[10 §9]`. */
    systemTrigger: text("system_trigger"),
    createdAt: createdAt(),
  },
  (t) => [
    index("tasks_assignee_status_idx").on(t.assignedToUserId, t.status),
    index("tasks_record_idx").on(t.recordType, t.recordId),
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
    readAt: timestamp("read_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("notifications_recipient_idx").on(t.recipientUserId, t.createdAt),
  ],
);

/* ------------------------------------------------------------------ *
 * 10. Settings — `09 §10`
 * ------------------------------------------------------------------ */

/**
 * `09 §10.2` — keyed configuration, manager-editable rather than in code.
 * Three separate decisions put values here: the five follow-up thresholds
 * `[07 D5]`, the quotation term defaults, and print-time boilerplate such as
 * bank account details `[08 D9]`. Changes are visible through the audit log,
 * so there is no `updated_at` here either.
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
 * `10 §11` — period, company or project, derived stage, warmth, owning rep,
 * expected sqm, value. Written by a scheduled job, never edited afterwards
 * `[07 E2]`. `derived_stage` is text because the funnel is computed, not
 * stored `[10 §1]`, and a snapshot captures whatever the computation said at
 * the time.
 */
export const pipelineSnapshots = pgTable(
  "pipeline_snapshots",
  {
    id: pk(),
    period: date("period").notNull(),
    recordType: recordTypeEnum("record_type").notNull(),
    recordId: uuid("record_id").notNull(),
    derivedStage: text("derived_stage"),
    warmth: warmthEnum("warmth"),
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
