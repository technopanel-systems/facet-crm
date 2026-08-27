/**
 * Verification scaffolding for `docs/25` Part G — NOT a feature.
 *
 * The other five suites drive behaviour. This one has almost none to drive:
 * Part G lands twelve schema changes and the slices that fill them come after,
 * so what needs proving is that **the shape is right and nothing writes it
 * yet**. It reads `information_schema` and `pg_catalog` rather than a data
 * module, which no script here has done before.
 *
 * The exception is section 9, and it is the reason this file exists at all.
 * `projects_loss_detail` refuses the free-text loss reason `src/lib/projects.ts`
 * used to write; zero lost projects meant the migration applied cleanly while
 * the first rep to mark one lost would have found a 500, and **none of the five
 * suites drives that path** — `verify:routes` replays only the theme toggle and
 * mark-read. A CHECK is only as good as the writer beside it, so the writer
 * changed in the same pass and section 9 proves the two agree. Feature slice
 * 5 later gave section 9 a second job: `assertLossReasonDetail`, the rule
 * `25 §5` owed since that same migration because a CHECK cannot subquery
 * `loss_reasons` to read the code behind a uuid.
 *
 *   1. Every column landed, with the right type and nullability `[25 G]`.
 *   2. Every withdrawn thing is gone — warmth, tolerance, sales desk
 *      `[25 §6, §23, §35]` — plus everything feature slice 6 deleted:
 *      `product_colours`, `activities`, `tasks`, `task_origin`, `task_status`,
 *      `quotation_lines.colour_id`, `roles.sees_all_records_readonly`, and
 *      `company_rep_origin`'s `'shared'`/`'merge'` values `[26 §2, §6]`. This
 *      is where `25 §20`'s withdrawal (`tasks`) is confirmed — folded into
 *      this section rather than kept as its own, since a separate section
 *      making the same kind of claim ("this thing is gone") would be an
 *      assertion about an assertion. Two spec rules land here too:
 *      `project_companies.role` `S25`, and `project_companies.is_buyer` with
 *      the `project_companies_one_buyer_key` index `S26` — the index asserted
 *      in its own right, since "at most one buyer" is what S26 forbids and a
 *      dropped column takes its index silently. **The `0027` sweep lands here
 *      too**, and with it the half that would otherwise go quiet: the five
 *      tables, six indexes and three role flags the sweep examined and LEFT,
 *      each asserted present with the rule that keeps it. Unused was never the
 *      test — unwanted was, and only a positive check records the difference.
 *   3. Every CHECK refuses **at the database** `[13 §1]`.
 *   4. The seeds: ten categories and nine loss reasons `[25 §5, §33]`. The
 *      read-only flag `25 §28` seeded is gone with the column `[26 §2]`.
 *   5. The seeds are idempotent.
 *   6. The outcome enum agrees with `enums.ts` at runtime `[25 §2]`.
 *   7. *** Nothing writes the remaining new columns yet *** — plus what this
 *      pass deliberately does NOT enforce.
 *   8. The foreign keys point where they should.
 *   9. *** The writer and the CHECK agree *** `[25 §5]` — and, since feature
 *      slice 5, so does the `RuleError` a CHECK could never be.
 *  10. *** The writer and the constraint agree, again *** `S13`, `S14` — the
 *      two new NOT NULLs, and the rule no CHECK can hold beside them: a
 *      company outside Saudi Arabia keeps no city and no region `S15`, which
 *      would need a subquery into `countries` to state in SQL. Since AUDIT 1
 *      F3, also both refusals `S15` makes of a Saudi company with no city.
 *  10b. *** No company carries a region its city does not imply *** `S15` —
 *      the same claim as 10, made over every row ever written instead of over
 *      the rows this script just created.
 *  12. *** Every priced line's VAT is 15% of its total *** `S57`.
 *  11. *** A dispatch's project IS its quotation's *** `S74` — the third rule
 *      of that kind, and the first to span two rows, so not even a CHECK could
 *      hold it. Asserted over every row in the table rather than over rows
 *      this script wrote.
 *  14. *** A dispatch's lines and its figure cannot disagree *** `S116`
 *      `S126` — no dispatch has zero lines, none was raised from a version
 *      still `requested`, every dispatch line's VAT and total are the same
 *      arithmetic §12 asserts of a quotation line, and there is no `sqm`
 *      column left on `dispatches` for a second answer to live in. Over every
 *      row ever written.
 *  20. *** Every company with a rep on it has exactly ONE primary rep ***
 *      `S18` — AUDIT 1 F5. The rule's other half, and the one no constraint
 *      can hold: a partial unique index could refuse a second primary, but
 *      "at least one" is not row-local and that is the half that was broken.
 *      Over every row ever written, and it was false when it was written.
 *  21. *** No live company membership belongs to somebody who could not now
 *      receive one *** `S9` — AUDIT 1 F8. The rule names four recipients and
 *      no flag says "holds a company book", so the test stands `sees_all_reps`
 *      in for the three elevated roles. That makes the seed load-bearing: the
 *      partition is asserted by role name against the live table first, then
 *      every live membership is counted against it.
 *  13. *** The repository and the database agree *** — CHECK constraints, enum
 *      types and their values, and indexes, as set differences both ways. This
 *      is the one claim `drizzle-kit generate` structurally cannot make: it
 *      compares `schema.ts` to the snapshot, so what both get wrong together
 *      is invisible to it (AUDIT 1 F19).
 *
 * Usage: `npm run verify:schema25`
 *
 * That needs `NODE_ENV=development` in `.env`. `--env-file` is not optional and
 * cannot be replaced by the `process.loadEnvFile` call below: section 9
 * reaches `@/lib/authz`, and `src/auth/index.ts` reads `AUTH_SECRET` at module
 * scope — before any statement in this file runs.
 *
 * **It refuses to run outside development** `[15 §7]`: it writes real rows.
 *
 * It needs a seeded database — `npm run db:seed` — and the fixture accounts:
 * `DEV_FIXTURE_PASSWORD=… npm run dev:fixtures`.
 *
 * **Nothing is cleaned up** `[12 §7]`. Section 9's company and project carry
 * the run stamp in their names, which is also how section 7 tells this
 * script's own rows from everything else on the `projects` table: without
 * that, a second run would find the first run's own leftover rows and report
 * that something writes a column this section still claims is untouched.
 */

process.loadEnvFile(".env");

import { eq, is, sql } from "drizzle-orm";
import { getTableConfig, isPgEnum, PgTable } from "drizzle-orm/pg-core";

import { closeDatabase, db } from "@/db";
import * as schema from "@/db/schema";
import {
  cities,
  commentMentions,
  comments,
  companies,
  companyCategories,
  contacts,
  lossReasons,
  projects,
  roles,
  users,
} from "@/db/schema";
import type { AuthSession } from "@/lib/authz";
import { createCompany, updateCompany } from "@/lib/companies";
import { dispatchDiffers, dispatchesInPeriod } from "@/lib/dispatches";
import {
  OTHER_LOSS_REASON_CODE,
  REPORT_OUTCOMES,
  SAUDI_CODE,
} from "@/lib/enums";
import { listCountries } from "@/lib/lookups";
import { normalizeName } from "@/lib/normalize";
import { createProject, listProjects, updateProject } from "@/lib/projects";

import { seedLookups } from "./seed-lookups";
import { seedRoles } from "./seed-roles";
import { COMPANY_CATEGORY_SEED } from "./seed/company-categories";
import { LOSS_REASON_SEED } from "./seed/loss-reasons";

let failures = 0;

function check(label: string, condition: boolean, detail = ""): void {
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Assert that `fn` is allowed — the positive half section 9 turns on. */
async function allows(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    check(label, true);
  } catch (error) {
    failures += 1;
    console.error(`  FAIL  ${label} — it refused with ${causeChain(error)}`);
  }
}

/**
 * Assert that the APPLICATION LAYER refuses, by `RuleError` key.
 *
 * Copied from `verify-phase10a.ts`/`verify-slice3.ts`, same reason as
 * `databaseRefuses` above: the negative half of a rule needs its own proof,
 * not just that the positive half was allowed.
 */
async function refuses(
  label: string,
  expectedKey: string,
  fn: () => Promise<unknown>,
): Promise<void> {
  try {
    await fn();
    failures += 1;
    console.error(`  FAIL  ${label} — it was allowed`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    check(`${label} (${expectedKey})`, message === expectedKey, `threw ${message}`);
  }
}

/**
 * Assert that the DATABASE refuses, by constraint name `[13 §1]`.
 *
 * Copied from `verify-phase10a.ts` along with `causeChain`, and for the reason
 * recorded there: Drizzle wraps a driver error in one whose message is only
 * "Failed query: …", and postgres.js puts the constraint name on the `cause`.
 * Reading just `error.message` passes on nothing and fails on everything.
 */
async function databaseRefuses(
  label: string,
  constraintName: string,
  statement: string,
): Promise<void> {
  try {
    await db.execute(sql.raw(statement));
    failures += 1;
    console.error(`  FAIL  ${label} — the database allowed it`);
  } catch (error) {
    check(
      `${label} (${constraintName})`,
      causeChain(error).includes(constraintName),
      `threw ${causeChain(error).slice(0, 160)}`,
    );
  }
}

/** Every message in the `cause` chain, plus a driver's `constraint_name`. */
function causeChain(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (current instanceof Error) {
      parts.push(current.message);
      const named = (current as { constraint_name?: string }).constraint_name;
      if (named) parts.push(named);
      current = current.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return parts.join(" | ");
}

/** A session for a fixture user, assembled the way `getSession` would. */
async function sessionFor(email: string): Promise<AuthSession> {
  const [row] = await db
    .select({ user: users, role: roles })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.email, email))
    .limit(1);
  if (!row) throw new Error(`No user ${email} — run npm run dev:fixtures`);
  const user = { ...row.user, role: row.role };
  return {
    user,
    realUser: user,
    isImpersonating: false,
    actor: { actorUserId: user.id, actingAsUserId: null },
  };
}

type ColumnRow = {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
};

async function readColumns(): Promise<Map<string, ColumnRow>> {
  const rows = (await db.execute(sql`
    select table_name, column_name, data_type, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public'
  `)) as unknown as ColumnRow[];
  return new Map(rows.map((row) => [`${row.table_name}.${row.column_name}`, row]));
}

/** One row of Part G, as a claim about a column. */
type ColumnSpec = {
  key: string;
  type: string;
  nullable: boolean;
  /** `false` for a boolean that must default false; omitted otherwise. */
  defaultsFalse?: boolean;
  cite: string;
};

const LANDED: ColumnSpec[] = [
  { key: "companies.next_follow_up_at", type: "date", nullable: true, cite: "25 §18" },
  { key: "projects.next_follow_up_at", type: "date", nullable: true, cite: "25 §18" },
  { key: "quotation_threads.next_follow_up_at", type: "date", nullable: true, cite: "25 §18" },
  { key: "projects.in_production", type: "boolean", nullable: false, defaultsFalse: true, cite: "25 §4" },
  { key: "projects.lost_reason_id", type: "uuid", nullable: true, cite: "25 §5" },
  { key: "projects.lost_at", type: "timestamp with time zone", nullable: true, cite: "25 §5" },
  { key: "projects.loss_reason", type: "text", nullable: true, cite: "25 §5" },
  { key: "loss_reasons.code", type: "text", nullable: false, cite: "25 §5" },
  { key: "loss_reasons.name_en", type: "text", nullable: false, cite: "25 §5" },
  { key: "loss_reasons.name_ar", type: "text", nullable: false, cite: "25 §5" },
  { key: "comments.record_type", type: "USER-DEFINED", nullable: false, cite: "25 §9" },
  { key: "comments.record_id", type: "uuid", nullable: false, cite: "25 §9" },
  { key: "comments.author_user_id", type: "uuid", nullable: false, cite: "25 §9" },
  { key: "comments.body", type: "text", nullable: false, cite: "25 §9" },
  { key: "comments.edited_at", type: "timestamp with time zone", nullable: true, cite: "25 §12" },
  { key: "comment_mentions.comment_id", type: "uuid", nullable: false, cite: "25 §11" },
  { key: "comment_mentions.mentioned_user_id", type: "uuid", nullable: false, cite: "25 §11" },
  { key: "quotation_threads.closed_at", type: "timestamp with time zone", nullable: true, cite: "25 §24" },
  { key: "quotation_threads.closed_by_user_id", type: "uuid", nullable: true, cite: "25 §24" },
  // `S72` — the request. `status` is NOT NULL with no default on purpose: a
  // default is a place for a writer to forget, and each of the six writers in
  // `dispatches.ts` sets it outright.
  { key: "dispatches.status", type: "USER-DEFINED", nullable: false, cite: "S72" },
  // `S130` `S119` — NOT NULL, and on the DISPATCH. Every dispatch names a
  // stock, including a free entry, which is what makes `S119`'s CT rule total.
  { key: "dispatches.stock", type: "USER-DEFINED", nullable: false, cite: "S130" },
  { key: "dispatches.shipment", type: "USER-DEFINED", nullable: false, cite: "S119" },
  { key: "dispatches.cargo_destination", type: "text", nullable: true, cite: "S119" },
  // `S70` `S71` — nullable, because a request is raised, edited and submitted
  // with none. `dispatches_payment_method` is what makes it required, and only
  // where `S73` requires it.
  { key: "dispatches.payment_method", type: "USER-DEFINED", nullable: true, cite: "S71" },
  { key: "dispatches.payment_note", type: "text", nullable: true, cite: "S71" },
  // `S121` — nullable for a reason the rule states: *it is not a condition of
  // approval*, so an approved dispatch reading null is ordinary.
  { key: "dispatches.smac_dispatch_number", type: "text", nullable: true, cite: "S121" },
  { key: "dispatches.submitted_at", type: "timestamp with time zone", nullable: true, cite: "S72" },
  { key: "dispatches.refusal_reason", type: "text", nullable: true, cite: "S124" },
];

/**
 * The columns `25` withdraws. Present means the migration did not land.
 *
 * `pipeline_snapshots.warmth` now passes because the whole table is gone
 * (`SPEC §15`, migration `0015`). Kept rather than moved: what it asserts —
 * no column of that name exists — is still exactly true, and a reader looking
 * for where warmth went should find all four of them in one list.
 */
const WITHDRAWN = [
  "companies.warmth",
  "companies.warmth_set_by",
  "companies.warmth_set_at",
  "pipeline_snapshots.warmth",
];

/**
 * Columns feature slice 6 dropped `[26 §2]`. Same shape as `WITHDRAWN` —
 * present means the migration did not apply — kept as a separate list
 * because the two batches were withdrawn for different reasons three
 * documents apart, and a future reader should be able to tell which is
 * which without diffing git blame.
 */
const SLICE6_DROPPED_COLUMNS = [
  "quotation_lines.colour_id",
  "roles.sees_all_records_readonly",
];

/**
 * The column `S25` drops: a company linked to a project is simply a
 * participant, so there is no role label to hold. Same shape as the two lists
 * above and kept separate for the same reason — this one answers to a numbered
 * spec rule rather than to a document, and it is the kind of claim that
 * silently regresses when a migration is regenerated from an older schema.
 */
const S25_DROPPED_COLUMNS = ["project_companies.role"];

/**
 * The column `S26` drops: who bought is derived from dispatches, never
 * flagged, so there is no flag to hold. Separate from the S25 list beside it
 * for the reason that one is separate from the two above — one rule, one
 * migration, one claim, legible without git blame.
 *
 * The **index** matters at least as much as the column and is checked below
 * rather than here: `is_buyer` going takes `project_companies_one_buyer_key`
 * with it automatically, so a passing column check proves the index is gone
 * only by implication, and "at most one buyer" is the thing `S26` actually
 * forbids.
 */
const S26_DROPPED_COLUMNS = ["project_companies.is_buyer"];

/** The index `S26` drops with it — see the note above. */
const S26_DROPPED_INDEXES = ["project_companies_one_buyer_key"];

/**
 * The column `S57` drops: VAT is fixed at 15% and never editable, so there is
 * no per-line rate to hold. Separate list, same reason the four above it are
 * separate — one rule, one migration, one claim, legible without git blame.
 *
 * The *amount* is not dropped and must not be: `vat_amount`, `total_vat` and
 * `grand_total` are SMAC's figures mirrored into FACET `S3`. What the rate
 * bought was a place for a line to disagree with the country.
 */
const S57_DROPPED_COLUMNS = ["quotation_lines.vat_rate"];

/**
 * The columns `S67` drops: validity and the delivery period are SMAC's, so
 * FACET carries neither. Separate list, same reason as the five above it — one
 * rule, one migration, one claim, legible without git blame.
 *
 * `0014` had already taken the *state* these fed. What `0018` takes is the
 * date itself, and with it `versionIsExpired()`, the "Expired" badge on three
 * screens and the Extend panel.
 */
const S67_DROPPED_COLUMNS = [
  "quotation_versions.valid_until",
  "quotation_versions.delivery_period",
];

/**
 * The two columns `S70` and `S119` take off the quotation and onto the
 * dispatch, in `0022`.
 *
 * **This list is the inverse of a claim that used to live here.** Until this
 * slice the assertion was that both were *still* present — `S70` and `S119`
 * are later, so a sweep that took them early would be building ahead of the
 * rule. That was the right check while they waited, and it is the wrong one
 * now: the rules landed, so the claim flips rather than disappearing.
 *
 * Neither was ever constrained. Nullable `text` since `0000`, no enum, no
 * CHECK, no default, one writer and one reader. What reps typed into them —
 * *"50% advance"*, *"EX-F"* — is in neither `S71`'s six nor `S119`'s three.
 * On the dispatch both are pg enums, which is the substance of the move.
 */
const S70_S119_MOVED_COLUMNS = [
  "quotation_versions.payment_method",
  "quotation_versions.shipment_terms",
];

/**
 * `SPEC §15` "Dropped outright", taken in `0022`: a NOT NULL boolean no code
 * path ever set to true.
 *
 * It named an exception to `07 C3`'s payment gate for customers who buy on
 * credit. `S70` and `S73` were its only citations and both were rewritten:
 * `S73` asks for a payment METHOD, and `handled_by_finance` `S71` is the
 * answer a credit customer gives. The exception became one value in a list
 * rather than a flag beside a gate, so it comes out in the slice that rewrote
 * its rules — `CLAUDE.md`: when a rule replaces an old mechanism, the old
 * mechanism comes out in the same slice.
 */
const S70_S73_DROPPED_COLUMNS = ["companies.has_credit_terms"];

/**
 * `S133` — **payment is not a position on the chain, and not a column on a
 * quotation.** `S70` records it on the dispatch and `S73` makes a method a
 * condition of approving one, so no interval exists between paid and dispatched
 * for either a rung or a stamp to occupy.
 *
 * `0022` moved the dispatch gate off `payment_confirmed_at` and said in its own
 * comment that the column STAYS, because it was still the chain's `paid` rung
 * `D29`. `S132` removed that rung, which was its last reader, and `0029` took
 * all three columns with `confirmPayment` and `markAcceptedForProcessing` —
 * `CLAUDE.md`: the old mechanism leaves in the slice that replaces it.
 *
 * Measured before `0029`, on a clean `seed:demo`: 60 threads, 15 carrying a
 * payment, 3 accepted for processing. None was migrated anywhere — a payment on
 * a quotation meant *the customer has committed*, and a payment on a dispatch
 * means *how they are paying* `S70`, so copying one into the other would invent
 * a fact. The audit log keeps its own copy of every write that ever set them
 * `S112`.
 */
const S133_DROPPED_COLUMNS = [
  "quotation_threads.payment_confirmed_at",
  "quotation_threads.payment_confirmed_by_user_id",
  "quotation_threads.accepted_for_processing_at",
];

/**
 * What `SPEC §15` "Dropped outright" removes: structure no rule asks for.
 * Same shape as the four lists above, separate for the same reason — one
 * decision, one migration, one claim, legible without git blame. These answer
 * to a section of the spec rather than to a numbered rule, which is why they
 * are cited `SPEC §15` and not `S`-anything.
 *
 * All four were measured empty before `0015` was written: 0 rows in each
 * table, and `rep_reports.reference` null on all 555 reports.
 */
const SPEC15_DROPPED_TABLES = [
  "verification_tokens",
  "pipeline_snapshots",
  "person_snapshots",
];

/** The column `SPEC §15` drops — no writer, no reader. Its CHECK goes with it. */
const SPEC15_DROPPED_COLUMNS = ["rep_reports.reference"];

/**
 * **The counterpart claim, and it is the one that needs asserting.**
 * `accounts` is the Auth.js table that STAYS: `accountsTable` is a
 * non-optional member of `@auth/drizzle-adapter`'s `DefaultPostgresSchema`,
 * so the table exists because the library will not compile without it, not
 * because anything writes a row. `verification_tokens` sat under the same
 * stated reason and did not earn it — its member is optional — which is why
 * one is above and the other is here.
 *
 * Worth a check of its own because the failure is quiet in the wrong
 * direction: a migration regenerated from an older schema would drop
 * `accounts`, login would carry on working, and the only complaint would be a
 * typecheck nobody connects to a database.
 */
const ADAPTER_REQUIRED_TABLES = ["accounts"];

/**
 * **The dead-structure sweep, `0027`.** Everything here had no rule behind it:
 * a column with no reader, a value nothing set, an index no query could use.
 * Same shape as the six lists above and separate for their reason — one
 * decision, one migration, one claim, legible without git blame.
 *
 * Every one of them predates `SPEC.md`. Ten trace to `0000` and the rest to
 * `0002`, `0005` and `0007`, all generated from `docs/09-schema-design.md`, so
 * this list is the original schema being finished rather than recent drift.
 *
 * **What is deliberately NOT here**, because a rule still asks for it:
 * `attachments` `S115`; `delete_requests` `S105`–`S107`; `duplicate_flags`,
 * `non_duplicates` and `companies.merged_into_id` `S21`–`S23`;
 * `quotation_threads.closed_at` and `closed_by_user_id` `S47`;
 * `roles.can_export`, `can_approve_delete` and `can_resolve_duplicate` `S8`.
 * `product_specifications` is `SPEC §16`'s open question. Unused is not the
 * test — unwanted is.
 */
const SWEEP_DROPPED_COLUMNS = [
  "users.city_id",
  "quotation_threads.cancelled_at",
  "quotation_lines.form_factor",
  "notifications.channel",
  "notification_types.default_channel",
  "product_suppliers.code",
  "product_classes.code",
  "product_fire_ratings.code",
];

/**
 * Both types the sweep emptied. Neither had a column left, so both are a
 * `DROP TYPE` rather than the rebuild `record_type` needed — the distinction
 * `0014`, `0018` and `0024`'s headers all turn on.
 */
const SWEEP_DROPPED_TYPES = ["form_factor", "notification_channel"];

/**
 * Four indexes no query could use. Three are `AUDIT 1 F15`'s live ones; the
 * fourth, `audit_log_actor_idx`, is the eleventh of the ten it counted — every
 * reader asks for `coalesce(acting_as_user_id, actor_user_id)` `[07 A6]`, and
 * a btree on one column cannot serve a coalesce over two.
 *
 * `F14`'s six sit on tables a rule still wants and stay with them.
 */
const SWEEP_DROPPED_INDEXES = [
  "comments_author_idx",
  "comment_mentions_user_idx",
  "rep_report_signals_signal_idx",
  "audit_log_actor_idx",
];

/** Whole tables feature slice 6 dropped `[26 §2, §6]`. */
const SLICE6_DROPPED_TABLES = ["product_colours", "activities", "tasks"];

/** Enum types feature slice 6 dropped along with the `tasks` table. */
const SLICE6_DROPPED_TYPES = ["task_origin", "task_status"];

/**
 * Every column this pass added **that nothing writes yet**, by the table it
 * sits on, and what "unwritten" means for it: null for a nullable column,
 * `false` for a boolean that has a default and therefore can never be null.
 * Section 7.
 *
 * **The three `next_follow_up_at` columns have left this list.** Feature slice
 * 4 built `25 §18`, so they are written now — `setNextFollowUp` in
 * `src/lib/follow-ups.ts`, proved by `npm run verify:followups`. The same
 * inversion `comments` and `comment_mentions` got in slice 2. They stay in
 * `LANDED` above: that they exist with the right type is still true.
 *
 * **The three loss columns, and `in_production`, have left too.** Feature
 * slice 5 built the nine-reason picker and the production checkbox —
 * `createProject`/`updateProject` write all four for real now, proved by
 * section 9 below (loss) and the round-trip check beside it
 * (`in_production`). The three loss columns move together as one unit
 * (`lossFieldsFor`'s own framing) and leave together: before this slice
 * `lost_at` was already stamped, but on a reason the screen could not yet
 * let a rep actually choose, so the feature `25 §5` describes was not done
 * merely because one of its three columns had a writer.
 */
const NEW_COLUMNS: { table: string; column: string; boolean?: true }[] = [
  { table: "quotation_threads", column: "closed_at" },
  { table: "quotation_threads", column: "closed_by_user_id" },
];

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== "development") {
    console.error(
      "verify-schema25 refuses to run outside development.\n" +
        `  NODE_ENV is ${process.env.NODE_ENV ?? "unset"}, and must be "development".`,
    );
    process.exit(1);
  }

  const stamp = `schema25-${Date.now()}`;

  const seededRoles = await db.select().from(roles);
  const seededReasons = await db.select().from(lossReasons);
  if (seededRoles.length < 7 || seededReasons.length === 0) {
    console.error("The seed is not present. Run: npm run db:seed");
    process.exit(1);
  }

  /* --- 1. Every column landed [25 Part G] ---------------------------- */

  console.log("\n1. Every column landed, with the right type and nullability");

  const columns = await readColumns();

  for (const spec of LANDED) {
    const row = columns.get(spec.key);
    // A missing column and a wrong type fail differently, so they are two
    // checks rather than one conjunction that says nothing about which.
    check(`${spec.key} exists [${spec.cite}]`, row !== undefined);
    if (!row) continue;
    check(
      `${spec.key} is ${spec.type}, ${spec.nullable ? "nullable" : "not null"}`,
      row.data_type === spec.type &&
        row.is_nullable === (spec.nullable ? "YES" : "NO"),
      `got ${row.data_type}, is_nullable=${row.is_nullable}`,
    );
    if (spec.defaultsFalse) {
      check(
        `${spec.key} defaults to false`,
        row.column_default === "false",
        `got ${row.column_default}`,
      );
    }
  }

  /* --- 2. Every withdrawn thing is gone [25 §6, §23, §35], [26 §2], S25, S26 - */

  console.log(
    "\n2. Warmth, tolerance, the sales desk, slice 6's drops, the participant\n   role, the buyer flag, SPEC §15's dead structure and the 0027 sweep are\n   absent — and the Auth.js table the adapter requires, the five tables whose\n   rules are unbuilt and S8's three flags are not",
  );

  for (const key of WITHDRAWN) {
    check(`${key} is gone [25 §6]`, !columns.has(key));
  }

  const warmthType = (await db.execute(
    sql`select typname from pg_type where typname = 'warmth'`,
  )) as unknown as { typname: string }[];
  check(
    "the warmth TYPE is dropped too, not merely unreferenced [25 §6]",
    warmthType.length === 0,
  );

  for (const key of SLICE6_DROPPED_COLUMNS) {
    check(`${key} is gone [26 §2]`, !columns.has(key));
  }

  for (const key of S25_DROPPED_COLUMNS) {
    check(`${key} is gone [S25]`, !columns.has(key));
  }

  for (const key of S26_DROPPED_COLUMNS) {
    check(`${key} is gone [S26]`, !columns.has(key));
  }

  for (const key of S57_DROPPED_COLUMNS) {
    check(`${key} is gone [S57]`, !columns.has(key));
  }

  for (const key of S67_DROPPED_COLUMNS) {
    check(`${key} is gone [S67]`, !columns.has(key));
  }

  // **The claim that used to be here has flipped.** It asserted that both
  // columns were STILL present, because `S70` and `S119` were later and a
  // sweep that took them early would have been building ahead of the rule.
  // The rules landed in `0022`, so the assertion inverts rather than going
  // away — that is what stops a column being dropped in one place and
  // remembered in another.
  for (const key of S70_S119_MOVED_COLUMNS) {
    check(`${key} moved to the dispatch [S70], [S119]`, !columns.has(key));
  }
  for (const key of ["dispatches.payment_method", "dispatches.shipment"]) {
    check(`…and landed there [S70], [S119]`, columns.has(key), key);
  }

  // `SPEC §15` — and the flag that stood beside the gate `S70` and `S73`
  // rewrote goes with them.
  for (const key of S70_S73_DROPPED_COLUMNS) {
    check(`${key} is gone [SPEC §15], [S70], [S73]`, !columns.has(key));
  }

  // `S133` — the three the `paid` rung was the last reader of.
  for (const key of S133_DROPPED_COLUMNS) {
    check(`${key} is gone [S133], [S132]`, !columns.has(key));
  }

  // `S67` — expiry is not a terminal state, and since `0018` not a fact
  // either. A value cannot be dropped from a Postgres enum in place, so `0014`
  // rebuilds this type and `0018` rebuilds `quotation_version_origin` the same
  // way; this asserts the rebuild landed with exactly the three the coordinator
  // may set `S62`, and not, say, the old type left behind under its rename.
  // §13 below makes the same claim about the origin enum, against schema.ts.
  const endStates = (await db.execute(
    sql`select unnest(enum_range(null::quotation_thread_end_state))::text as value`,
  )) as unknown as { value: string }[];
  const endStateValues = endStates.map((row) => row.value).sort();
  check(
    "quotation_thread_end_state holds accepted/rejected/cancelled only [S67]",
    endStateValues.join(",") === "accepted,cancelled,rejected",
    endStateValues.join(",") || "(empty)",
  );
  check(
    "no quotation thread still carries an expiry end state [S67]",
    (
      (await db.execute(
        sql`select count(*)::int as n from quotation_threads
             where end_state::text = 'expired'`,
      )) as unknown as { n: number }[]
    )[0].n === 0,
  );

  // The rule S26 states is "no participant is marked as the buyer by hand" —
  // which in SQL was the partial unique index, not the column. Asserted in its
  // own right, because a column check passes on it only by implication.
  const liveIndexes = new Set(
    (
      (await db.execute(
        sql`select indexname from pg_indexes where schemaname = 'public'`,
      )) as unknown as { indexname: string }[]
    ).map((row) => row.indexname),
  );
  for (const name of S26_DROPPED_INDEXES) {
    check(`index ${name} is gone [S26]`, !liveIndexes.has(name));
  }
  // The sweep's four, for the same reason: an index is not implied by any
  // column check, because every column it sat on is still here.
  for (const name of SWEEP_DROPPED_INDEXES) {
    check(`index ${name} is gone [0027]`, !liveIndexes.has(name));
  }
  // The six on the tables a rule still wants are NOT dropped, and this is the
  // half that would go quiet if a later sweep took them by mistake.
  for (const name of [
    "attachments_record_idx",
    "delete_requests_record_idx",
    "duplicate_flags_a_idx",
    "duplicate_flags_b_idx",
    "non_duplicates_pair_key",
    "companies_merged_into_idx",
  ]) {
    check(
      `index ${name} SURVIVES — its rule is unbuilt, not absent [S115], [S105], [S21]`,
      liveIndexes.has(name),
    );
  }
  // Its sibling stays: removal is still soft and re-linkable `S27`, which is
  // unchanged by this slice and is exactly the thing a regenerated migration
  // would quietly take out alongside the buyer index.
  check(
    "index project_companies_key survives — S27 is unchanged",
    liveIndexes.has("project_companies_key"),
  );

  for (const table of SLICE6_DROPPED_TABLES) {
    const exists = (await db.execute(
      sql.raw(`select to_regclass('public.${table}') is not null as exists`),
    )) as unknown as { exists: boolean }[];
    check(`table ${table} is gone [26 §2, §6]`, exists[0]?.exists === false);
  }

  for (const table of SPEC15_DROPPED_TABLES) {
    const exists = (await db.execute(
      sql.raw(`select to_regclass('public.${table}') is not null as exists`),
    )) as unknown as { exists: boolean }[];
    check(`table ${table} is gone [SPEC §15]`, exists[0]?.exists === false);
  }

  for (const key of SPEC15_DROPPED_COLUMNS) {
    check(`${key} is gone [SPEC §15]`, !columns.has(key));
  }

  // Dropping a column takes its CHECK with it: Postgres removed
  // `rep_reports_reference` along with `rep_reports.reference` in `0015`, and
  // no statement said so. It WAS declared in `schema.ts`, and stayed declared
  // there and in `meta/0015_snapshot.json` until `0016` deleted it — the drift
  // section 13 now guards against. Named on its own line here so the next
  // reader learns this constraint is absent deliberately; section 13 proves
  // the same thing anonymously, as a diff rather than a story.
  const orphanChecks = (await db.execute(
    sql`select conname from pg_constraint where conname = 'rep_reports_reference'`,
  )) as unknown as { conname: string }[];
  check(
    "the CHECK rep_reports_reference went with its column [SPEC §15]",
    orphanChecks.length === 0,
  );

  for (const table of ADAPTER_REQUIRED_TABLES) {
    const exists = (await db.execute(
      sql.raw(`select to_regclass('public.${table}') is not null as exists`),
    )) as unknown as { exists: boolean }[];
    check(
      `table ${table} SURVIVES — @auth/drizzle-adapter's type requires it`,
      exists[0]?.exists === true,
    );
  }

  for (const typeName of SLICE6_DROPPED_TYPES) {
    const dropped = (await db.execute(
      sql.raw(`select typname from pg_type where typname = '${typeName}'`),
    )) as unknown as { typname: string }[];
    check(`type ${typeName} is gone [26 §6]`, dropped.length === 0);
  }

  /* --- the dead-structure sweep, 0027 -------------------------------- */

  for (const key of SWEEP_DROPPED_COLUMNS) {
    check(`${key} is gone [0027]`, !columns.has(key));
  }
  for (const typeName of SWEEP_DROPPED_TYPES) {
    const dropped = (await db.execute(
      sql.raw(`select typname from pg_type where typname = '${typeName}'`),
    )) as unknown as { typname: string }[];
    check(`type ${typeName} is gone [0027]`, dropped.length === 0);
  }

  // `record_type` is the one the sweep rebuilt rather than dropped: six other
  // columns still carry it. `quotation_version` was the canonical dead value —
  // 0 rows across all seven, no rule, and the value `dispatchStatusEnum`'s
  // header cites for why `cancelled` waited for a writer.
  const recordTypes = (await db.execute(
    sql`select unnest(enum_range(null::record_type))::text as value`,
  )) as unknown as { value: string }[];
  const recordTypeValues = recordTypes.map((row) => row.value).sort();
  check(
    "record_type lost quotation_version and kept the other five [0027]",
    recordTypeValues.join(",") ===
      "company,contact,dispatch,project,quotation_thread",
    recordTypeValues.join(",") || "(empty)",
  );

  // The counterpart, and the one that matters: the five tables the sweep
  // examined and LEFT, each because a rule still names it. A later sweep
  // reading "0 rows, no reference" and taking them would pass every check
  // above and break `S115`, `S105`–`S107` and `S21`–`S23` silently.
  for (const [table, rule] of [
    ["attachments", "S115"],
    ["delete_requests", "S105-S107"],
    ["duplicate_flags", "S21-S23"],
    ["non_duplicates", "S21-S23"],
    ["product_specifications", "SPEC §16"],
  ] as const) {
    const exists = (await db.execute(
      sql.raw(`select to_regclass('public.${table}') is not null as exists`),
    )) as unknown as { exists: boolean }[];
    check(
      `table ${table} SURVIVES the sweep — unbuilt, not unwanted [${rule}]`,
      exists[0]?.exists === true,
    );
  }
  // And the three flags `S8` names outright: *all three must be read by the
  // code; today none are*. Unread is why they were candidates; `S8` is why
  // they stayed.
  for (const flag of [
    "roles.can_export",
    "roles.can_approve_delete",
    "roles.can_resolve_duplicate",
  ]) {
    check(`${flag} SURVIVES the sweep — S8 names it [S8]`, columns.has(flag));
  }

  const repOrigins = (await db.execute(
    sql`select unnest(enum_range(null::company_rep_origin))::text as value`,
  )) as unknown as { value: string }[];
  const repOriginValues = repOrigins.map((row) => row.value).sort();
  check(
    "company_rep_origin carries exactly the two written origins, 'shared' and 'merge' gone [26 §2]",
    repOriginValues.join(",") === "assigned,self_registered",
    `got ${repOriginValues.join(", ")}`,
  );

  // `25 §23` chose no tolerance and `25 §35` models no sales desk. Both are
  // easy to add by accident later, and both are wrong until a document says
  // otherwise — `OPEN — not chosen` is the recorded state, for ~3 months.
  const tolerance = (await db.execute(
    sql`select key from settings where key like '%toleran%'`,
  )) as unknown as { key: string }[];
  check(
    "no tolerance setting exists [25 §23]",
    tolerance.length === 0,
    `got ${tolerance.map((row) => row.key).join(", ")}`,
  );

  const deskTables = (await db.execute(sql`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_name like '%desk%'
  `)) as unknown as { table_name: string }[];
  check(
    "no sales-desk table exists [25 §35]",
    deskTables.length === 0,
    `got ${deskTables.map((row) => row.table_name).join(", ")}`,
  );

  /* --- 3. Every CHECK refuses at the database [13 §1] ---------------- */

  console.log("\n3. Every CHECK refuses at the database");

  const rep = await sessionFor("rep-a@example.test");
  // A phone `S13` and a country `S14` are the two the data layer will not
  // accept as null. The phone is derived from the run stamp because `S23`
  // matches on it and this script keeps its rows `[12 §7]`.
  const saudiId = (await listCountries()).find(
    (row) => row.code === SAUDI_CODE,
  )!.id;
  // Saudi, so `S15` requires a city. Any seeded row will do — what is being
  // exercised here is the loss vocabulary, not the place.
  const [fixtureCity] = await db.select({ id: cities.id }).from(cities).limit(1);
  const company = await createCompany(rep, {
    name: `${stamp} company`,
    phone: `+9665${stamp.slice(-7)}1`,
    countryId: saudiId,
    categoryId: null,
    cityId: fixtureCity.id,
    leadSourceId: null,
    notes: null,
  });
  const openProject = await createProject(
    rep,
    {
      name: `${stamp} open project`,
      sqmExpected: null,
      cityId: null,
      endState: null,
      lostReasonId: null,
      lossReason: null,
      inProduction: false,
      committed: false,
    },
    [{ companyId: company.id }],
  );

  const otherReason = seededReasons.find(
    (row) => row.code === OTHER_LOSS_REASON_CODE,
  );
  check(
    `loss_reasons carries the '${OTHER_LOSS_REASON_CODE}' code the writer branches on [25 §5]`,
    otherReason !== undefined,
  );
  if (!otherReason) {
    console.error("Cannot continue without the 'other' loss reason.");
    process.exit(1);
  }

  // Any seeded reason that is not 'other' — section 9 needs one to prove the
  // forbidding half of assertLossReasonDetail, and which of the eight it is
  // does not matter.
  const nonOtherReason = seededReasons.find(
    (row) => row.code !== OTHER_LOSS_REASON_CODE,
  );
  check(
    "loss_reasons carries a non-'other' code to test the forbidding half against [25 §5]",
    nonOtherReason !== undefined,
  );
  if (!nonOtherReason) {
    console.error("Cannot continue without a non-'other' loss reason.");
    process.exit(1);
  }

  await databaseRefuses(
    "a loss reason with no date is refused",
    "projects_loss_pair",
    `update projects set lost_reason_id = '${otherReason.id}'
     where id = '${openProject.id}'`,
  );
  await databaseRefuses(
    "a loss date with no reason is refused",
    "projects_loss_pair",
    `update projects set lost_at = now() where id = '${openProject.id}'`,
  );
  await databaseRefuses(
    "detail with no reason is refused",
    "projects_loss_detail",
    `update projects set loss_reason = 'why' where id = '${openProject.id}'`,
  );
  // `end_state = 'won'` was the not-lost state this used until `S31` took the
  // value out of the vocabulary. `null` is the stronger case anyway, and the
  // one `schema.ts` wrote `is not distinct from` for: a plain
  // `end_state = 'lost'` would evaluate to null here and the constraint would
  // pass on anything.
  await databaseRefuses(
    "a reason on a project that is not lost is refused",
    "projects_loss_state",
    `update projects
       set end_state = null,
           lost_reason_id = '${otherReason.id}',
           lost_at = now()
     where id = '${openProject.id}'`,
  );

  await databaseRefuses(
    "a close date with no closer is refused",
    "quotation_threads_closed",
    `insert into quotation_threads
       (project_id, company_id, raised_by_user_id, closed_at)
     values ('${openProject.id}', '${company.id}', '${rep.user.id}', now())`,
  );
  // The refusal that stood here fed `record_type = 'quotation_version'` to
  // `comments_record_type`. `0027` dropped the value from the enum, so the
  // insert now fails on the TYPE rather than on the constraint and would
  // report the wrong constraint name. §13's enum-value comparison is what
  // holds the claim now, and it holds it for all seven tables at once rather
  // than for comments alone.
  // The invariant that stood here — a `reference` only on an interaction —
  // went with the column it guarded. `SPEC §15` dropped
  // `rep_reports.reference`; section 2 asserts the column and its CHECK are
  // both gone. Signal references are untouched and live on
  // `rep_report_signals.reference`, which `S45` requires.

  /* --- 4. The seeds [25 §5, §33] --------------------------------------- */

  console.log("\n4. The seeds");

  const categories = await db.select().from(companyCategories);
  const categoryNames = new Set(categories.map((row) => row.nameEn));
  check(
    "Personal is seeded as a tenth company category [25 §33]",
    categoryNames.has("Personal"),
  );
  check(
    "ten categories and no eleventh [12 §4], [25 §33]",
    categories.length === COMPANY_CATEGORY_SEED.length &&
      categories.length === 10,
    `got ${categories.length}`,
  );

  const reasonCodes = seededReasons.map((row) => row.code).sort();
  const wantedCodes = LOSS_REASON_SEED.map((row) => row.code as string).sort();
  check(
    "the nine loss reasons match 25 §5 exactly, and there is no tenth [25 §5]",
    reasonCodes.join(",") === wantedCodes.join(",") && reasonCodes.length === 9,
    `got ${reasonCodes.join(", ")}`,
  );
  check(
    "every loss reason carries both names, so a form can render either locale",
    seededReasons.every((row) => row.nameEn !== "" && row.nameAr !== ""),
  );

  // `25 §28`'s read-only flag and its seed assertion were removed in feature
  // slice 6 along with the column [26 §2] — section 2 now asserts the flag
  // is gone rather than asserting what it was seeded to.

  /* --- 5. The seeds are idempotent ----------------------------------- */

  console.log("\n5. A second seed run inserts nothing");

  await seedRoles();
  await seedLookups();

  const [reasonsAfter] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(lossReasons);
  const [categoriesAfter] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(companyCategories);
  const [rolesAfter] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(roles);
  check(
    "loss reasons unchanged by a re-run",
    reasonsAfter?.n === seededReasons.length,
    `${seededReasons.length} → ${reasonsAfter?.n}`,
  );
  check(
    "company categories unchanged by a re-run",
    categoriesAfter?.n === categories.length,
    `${categories.length} → ${categoriesAfter?.n}`,
  );
  check(
    "roles unchanged by a re-run",
    rolesAfter?.n === seededRoles.length,
    `${seededRoles.length} → ${rolesAfter?.n}`,
  );

  const duplicateCodes = (await db.execute(sql`
    select code from loss_reasons group by code having count(*) > 1
  `)) as unknown as { code: string }[];
  check(
    "no duplicate loss-reason code — the unique index is what makes the seed an upsert",
    duplicateCodes.length === 0,
    `got ${duplicateCodes.map((row) => row.code).join(", ")}`,
  );

  /* --- 6. The enum agrees with the code at runtime [25 §2] ----------- */

  console.log("\n6. rep_report_outcome and enums.ts agree");

  const outcomes = (await db.execute(
    sql`select unnest(enum_range(null::rep_report_outcome))::text as value`,
  )) as unknown as { value: string }[];
  const dbOutcomes = outcomes.map((row) => row.value).sort();
  const codeOutcomes = [...REPORT_OUTCOMES].sort();
  check(
    "technical_submitting is in the database enum [25 §2]",
    dbOutcomes.includes("technical_submitting"),
    `got ${dbOutcomes.join(", ")}`,
  );
  // `OutcomeMatchesSchema` proves this at compile time. It cannot see a
  // database that drifted after the build, which is the case that bites.
  check(
    "the database enum and REPORT_OUTCOMES agree, both directions",
    dbOutcomes.join(",") === codeOutcomes.join(","),
    `db ${dbOutcomes.join(", ")} vs code ${codeOutcomes.join(", ")}`,
  );
  // `25 §2` calls it an outcome, `25 §1` says why: activities are unordered
  // and repeatable, and the chain is the ordered thing. A stage column would
  // be the legacy dropdown returning.
  check(
    "no stage column appeared on projects alongside it [25 §1]",
    !columns.has("projects.stage"),
  );

  /* --- 7. Nothing writes the new columns yet ------------------------- */

  console.log("\n7. *** Nothing writes the new columns yet ***");

  // This script's own rows are excluded by name. Without that, the second run
  // finds the first run's lost project and reports a writer that is this
  // script — which is how a whole-database assertion goes wrong when nothing
  // is cleaned up `[12 §7]`.
  for (const { table, column, boolean } of NEW_COLUMNS) {
    const written = (await db.execute(
      sql.raw(
        `select count(*)::int as n from ${table}
         where ${boolean ? `${column} is distinct from false` : `${column} is not null`}
           ${table === "projects" ? `and name_en not like 'schema25-%'` : ""}`,
      ),
    )) as unknown as { n: number }[];
    check(
      `${table}.${column} is unwritten`,
      written[0]?.n === 0,
      `got ${written[0]?.n} row(s)`,
    );
  }

  /**
   * **`comments` and `comment_mentions` are written now — feature slice 2.**
   *
   * This asserted both were EMPTY, which was the right assertion for stage 3:
   * the migration landed the columns and nothing filled them, and a table that
   * had quietly acquired rows would have meant something was writing them by a
   * path no document described.
   *
   * `25 §9`–`§15` is that path, and it is built, so the assertion inverts. What
   * it guards now is the structure, not the emptiness: every comment hangs on
   * one of the five kinds the CHECK admits, and every mention hangs on a
   * comment. `scripts/verify-comments.ts` owns the behaviour.
   */
  const [strayAnchor] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(comments)
    .where(
      sql`record_type not in ('company', 'contact', 'project', 'quotation_thread', 'dispatch')`,
    );
  check(
    "every comment hangs on one of 25 §9's five record kinds",
    strayAnchor?.n === 0,
    `got ${strayAnchor?.n} on another kind`,
  );

  const [orphanMention] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(commentMentions)
    .where(
      sql`not exists (select 1 from comments c where c.id = ${commentMentions.commentId})`,
    );
  check(
    "no mention outlives its comment",
    orphanMention?.n === 0,
    `got ${orphanMention?.n} orphaned`,
  );

  // Nothing is deleted `[25 §12]`, `[12 §7]`, so there is no `deleted_at` to
  // check — the absence of the column IS the guarantee, asserted above.

  // A gap recorded in a script that runs is a gap that gets closed.
  //
  // 'other' requires loss_reason and every other code forbids it [25 §5]
  // LANDED in feature slice 5 — src/lib/projects.ts's assertLossReasonDetail,
  // proved in section 9 below, four ways. This is why that bullet is gone.
  console.log(
    "\n  NOT ASSERTED, on purpose — still owed:\n" +
      "    · 'lost requires a reason' at the DATABASE. assertLossReason holds\n" +
      "      it in the application layer today; projects_loss_state is\n" +
      "      deliberately one-way — the converse would need more than a\n" +
      "      CHECK, and the screen offering the nine was never what stood\n" +
      "      in its way.\n" +
      "    · 25 §28's third tier is not owed, it is closed: the flag it asked\n" +
      "      for was seeded and read by nothing, so feature slice 6 dropped\n" +
      "      it rather than build a tier nobody ended up needing [26 §3].\n" +
      "      A coordinator still reads every quotation conversation and no\n" +
      "      company one, through the existing two tiers — that stays true,\n" +
      "      it was just never 25 §28's doing.",
  );

  /* --- 8. The foreign keys ------------------------------------------ */

  console.log("\n8. The foreign keys point where they should");

  const foreignKeys = (await db.execute(sql`
    select
      tc.table_name as from_table,
      kcu.column_name as from_column,
      ccu.table_name as to_table
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
    where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
  `)) as unknown as {
    from_table: string;
    from_column: string;
    to_table: string;
  }[];

  const wantedKeys: [string, string, string][] = [
    ["projects", "lost_reason_id", "loss_reasons"],
    ["quotation_threads", "closed_by_user_id", "users"],
    ["comments", "author_user_id", "users"],
    ["comment_mentions", "comment_id", "comments"],
    ["comment_mentions", "mentioned_user_id", "users"],
  ];
  for (const [from, column, to] of wantedKeys) {
    check(
      `${from}.${column} → ${to}`,
      foreignKeys.some(
        (row) =>
          row.from_table === from &&
          row.from_column === column &&
          row.to_table === to,
      ),
    );
  }

  /* --- 9. The writer and the CHECK agree [25 §5] ---------------------- */

  console.log("\n9. *** The writer and the CHECK agree ***");

  const lostProject = await createProject(
    rep,
    {
      name: `${stamp} lost project`,
      sqmExpected: null,
      cityId: null,
      endState: "lost",
      lostReasonId: otherReason.id,
      lossReason: "The customer chose a cheaper supplier.",
      inProduction: false,
      committed: false,
    },
    [{ companyId: company.id }],
  );
  check(
    "*** creating a LOST project through src/lib/projects.ts succeeds *** [25 §5]",
    lostProject.endState === "lost",
  );
  check(
    "it carries the reason it was given, not a default [25 §5]",
    lostProject.lostReasonId === otherReason.id,
    `got ${lostProject.lostReasonId}`,
  );
  check(
    "it carries a loss date, so projects_loss_pair is satisfied",
    lostProject.lostAt !== null,
  );
  check(
    "the free text survives as the detail behind the reason",
    lostProject.lossReason === "The customer chose a cheaper supplier.",
    `got ${lostProject.lossReason}`,
  );

  // Marking an OPEN project lost is the path a rep actually takes, and it is a
  // different code path from creation — `updateProject` diffs against the row.
  await allows("marking an open project lost is allowed [25 §5]", async () => {
    const updated = await updateProject(rep, openProject.id, {
      name: openProject.name,
      sqmExpected: null,
      cityId: null,
      endState: "lost",
      lostReasonId: otherReason.id,
      lossReason: "Delivery time was too long.",
      inProduction: false,
      committed: false,
    });
    if (updated.lostReasonId !== otherReason.id || updated.lostAt === null) {
      throw new Error(
        `wrote lost_reason_id=${updated.lostReasonId} lost_at=${updated.lostAt}`,
      );
    }
  });

  // Re-saving must not restamp the date: an unrelated edit cannot rewrite when
  // the loss happened. The same reasoning the deleted warmth stamp used.
  const [beforeResave] = await db
    .select({ lostAt: projects.lostAt })
    .from(projects)
    .where(eq(projects.id, openProject.id))
    .limit(1);
  const resaved = await updateProject(rep, openProject.id, {
    name: `${openProject.name} (edited)`,
    sqmExpected: null,
    cityId: null,
    endState: "lost",
    lostReasonId: otherReason.id,
    lossReason: "Delivery time was too long.",
    inProduction: false,
    committed: false,
  });
  check(
    "re-saving a lost project does not restamp lost_at [25 §5]",
    resaved.lostAt?.getTime() === beforeResave?.lostAt?.getTime(),
    `${beforeResave?.lostAt?.toISOString()} → ${resaved.lostAt?.toISOString()}`,
  );

  // The rep is free to correct the reason on a later edit — the pick is no
  // longer sticky the way the pre-screen default was `[23]`.
  await allows("re-editing a lost project to a different reason is allowed [25 §5]", async () => {
    const corrected = await updateProject(rep, openProject.id, {
      name: openProject.name,
      sqmExpected: null,
      cityId: null,
      endState: "lost",
      lostReasonId: nonOtherReason.id,
      lossReason: null,
      inProduction: false,
      committed: false,
    });
    if (corrected.lostReasonId !== nonOtherReason.id) {
      throw new Error(`still carries ${corrected.lostReasonId}`);
    }
  });

  /**
   * `25 §5`'s remaining half, owed since migration 0007 `[23]`: `other`
   * requires the free-text detail, and every other code forbids it. A CHECK
   * cannot subquery `loss_reasons` to read the code behind a uuid, so
   * `src/lib/projects.ts`'s `assertLossReasonDetail` holds it instead —
   * proven the four ways below, replacing what section 7 used to print as a
   * stated non-assertion.
   */
  await refuses(
    "'other' with no detail is refused [25 §5]",
    "projects.errors.lossReasonDetailRequired",
    () =>
      updateProject(rep, openProject.id, {
        name: openProject.name,
        sqmExpected: null,
        cityId: null,
        endState: "lost",
        lostReasonId: otherReason.id,
        lossReason: null,
        inProduction: false,
        committed: false,
      }),
  );

  await refuses(
    "a non-'other' reason with detail is refused [25 §5]",
    "projects.errors.lossReasonDetailForbidden",
    () =>
      updateProject(rep, openProject.id, {
        name: openProject.name,
        sqmExpected: null,
        cityId: null,
        endState: "lost",
        lostReasonId: nonOtherReason.id,
        lossReason: "This should not be allowed.",
        inProduction: false,
        committed: false,
      }),
  );

  await allows("a non-'other' reason with no detail is allowed [25 §5]", () =>
    updateProject(rep, openProject.id, {
      name: openProject.name,
      sqmExpected: null,
      cityId: null,
      endState: "lost",
      lostReasonId: nonOtherReason.id,
      lossReason: null,
      inProduction: false,
      committed: false,
    }),
  );

  await refuses(
    "a lost project with no reason picked is refused [25 §5]",
    "projects.errors.lossReasonRequired",
    () =>
      updateProject(rep, openProject.id, {
        name: openProject.name,
        sqmExpected: null,
        cityId: null,
        endState: "lost",
        lostReasonId: null,
        lossReason: null,
        inProduction: false,
        committed: false,
      }),
  );

  // And moving off `lost` must clear all three, or projects_loss_state refuses
  // the row — the case a screen will hit the first time a rep changes his mind.
  //
  // **Re-opening, not winning.** This case moved to `won` until `S31` took
  // that value out of the vocabulary: a project is won when a dispatch against
  // it is approved, which no call to `updateProject` can manufacture. `null`
  // is the only place left to move to, and it exercises the same clause.
  await allows("re-opening a lost project clears the loss [25 §5]", async () => {
    const reopened = await updateProject(rep, openProject.id, {
      name: openProject.name,
      sqmExpected: null,
      cityId: null,
      endState: null,
      lostReasonId: null,
      lossReason: null,
      inProduction: false,
      committed: false,
    });
    if (
      reopened.lostReasonId !== null ||
      reopened.lostAt !== null ||
      reopened.lossReason !== null
    ) {
      throw new Error(
        `left lost_reason_id=${reopened.lostReasonId} lost_at=${reopened.lostAt} loss_reason=${reopened.lossReason}`,
      );
    }
  });

  // `25 §4` — a plain label, no invariant to prove beyond a round-trip: this
  // is the whole of what "deliberately unverified" leaves to check.
  await allows("in_production round-trips through updateProject [25 §4]", async () => {
    const updated = await updateProject(rep, openProject.id, {
      name: openProject.name,
      sqmExpected: null,
      cityId: null,
      endState: null,
      lostReasonId: null,
      lossReason: null,
      inProduction: true,
      committed: false,

    });
    if (updated.inProduction !== true) {
      throw new Error(`got inProduction=${updated.inProduction}`);
    }
  });

  /* --- 10. Phone, country, and the Saudi-only place [S13], [S14], [S15] -- */

  console.log(
    "\n10. *** The writer and the constraint agree, again *** [S13], [S14]",
  );

  // The same argument section 9 makes, one migration later. `S13` and `S14`
  // land two NOT NULLs, and a constraint is only as good as the writer beside
  // it: `companies.phone` and `companies.country_id` refuse null at the
  // database, `CompanyInput` refuses it at compile time, and the action refuses
  // it as a message. What no CHECK can state is `S15` — that a company outside
  // Saudi Arabia has no city and no region — because a CHECK would have to
  // subquery `countries` to read the code behind a uuid. That is
  // `placeForCountry`, and this is where it is proved.
  //
  // `verify:routes` §13 drives the same rule over HTTP, and stops at the
  // region: the city is a `Combobox` in a portal, so no city id reaches the
  // server HTML. Here one is a query away, which is the half that belongs
  // in process.

  const nullable = (key: string) => columns.get(key)?.is_nullable;
  check(
    "companies.phone is NOT NULL [S13]",
    nullable("companies.phone") === "NO",
    `got ${nullable("companies.phone")}`,
  );
  check(
    "companies.country_id is NOT NULL [S14]",
    nullable("companies.country_id") === "NO",
    `got ${nullable("companies.country_id")}`,
  );
  check(
    "…and city_id and region stay nullable, because S15 is Saudi-only",
    nullable("companies.city_id") === "YES" &&
      nullable("companies.region") === "YES",
  );

  const [aCity] = await db
    .select({ id: cities.id, region: cities.region })
    .from(cities)
    .limit(1);
  const allCountries = await listCountries();
  const saudi = allCountries.find((row) => row.code === SAUDI_CODE);
  const abroad = allCountries.find((row) => row.code !== SAUDI_CODE);
  check(
    "the countries lookup is seeded, Saudi Arabia included [S14]",
    Boolean(saudi) && Boolean(abroad),
    `${allCountries.length} rows`,
  );

  if (aCity && saudi && abroad) {
    // Saudi: the city stands and the region comes from it `S15`. There is no
    // longer a wrong region to post alongside it — `CompanyInput` has no
    // `region` field and `regionForCity` has no fallback `[AUDIT 1 F3]` — so
    // the old "it kept what I sent" failure is now a compile error rather than
    // a runtime one. The refusals below are what replace that proof.
    const saudiCompany = await createCompany(rep, {
      name: `${stamp} saudi company`,
      phone: `+9665${stamp.slice(-7)}2`,
      countryId: saudi.id,
      categoryId: null,
      cityId: aCity.id,
      leadSourceId: null,
      notes: null,
    });
    check(
      "*** a Saudi company keeps its city *** [S15]",
      saudiCompany.cityId === aCity.id,
      `got ${saudiCompany.cityId}`,
    );
    check(
      "…and takes the region from that city [S15]",
      saudiCompany.region === aCity.region,
      `got ${saudiCompany.region}, city says ${aCity.region}`,
    );

    /* --- S15: a Saudi company cannot be written without a city ---------- */

    // One refusal per writer, because there are exactly two. Keyed to
    // `cityId`, so the form renders it under the control rather than as a
    // form-wide message.
    await refuses(
      "*** registering a Saudi company with NO city is refused *** [S15]",
      "validation.required",
      () =>
        createCompany(rep, {
          name: `${stamp} cityless`,
          phone: `+9665${stamp.slice(-7)}5`,
          countryId: saudi.id,
          categoryId: null,
          cityId: null,
          leadSourceId: null,
          notes: null,
        }),
    );
    await refuses(
      "*** …and an edit cannot clear the city of a Saudi company *** [S15]",
      "validation.required",
      () =>
        updateCompany(rep, saudiCompany.id, {
          name: saudiCompany.name,
          phone: saudiCompany.phone,
          countryId: saudi.id,
          categoryId: null,
          cityId: null,
          leadSourceId: null,
          notes: null,
        }),
    );

    // Abroad: the SAME input, one field different, and both must go.
    const abroadCompany = await createCompany(rep, {
      name: `${stamp} abroad company`,
      phone: `+9665${stamp.slice(-7)}3`,
      countryId: abroad.id,
      categoryId: null,
      cityId: aCity.id,
      leadSourceId: null,
      notes: null,
    });
    check(
      "*** a company outside Saudi Arabia stores NO city, though one was sent *** [S15]",
      abroadCompany.cityId === null,
      `got ${abroadCompany.cityId}`,
    );
    check(
      "*** …and NO region *** [S15]",
      abroadCompany.region === null,
      `got ${abroadCompany.region}`,
    );

    // And an edit cannot smuggle either back on while the country stays abroad.
    await allows("editing a company abroad still refuses a city [S15]", async () => {
      const edited = await updateCompany(rep, abroadCompany.id, {
        name: abroadCompany.name,
        phone: abroadCompany.phone,
        countryId: abroad.id,
        categoryId: null,
        cityId: aCity.id,
        leadSourceId: null,
        notes: `${stamp} edited`,
      });
      if (edited.cityId !== null || edited.region !== null) {
        throw new Error(`kept city=${edited.cityId} region=${edited.region}`);
      }
    });

    // Moving a Saudi company abroad drops what S15 gave it — the case a rep
    // hits the first time a customer turns out to be Egyptian.
    await allows("moving a company abroad clears its city and region [S15]", async () => {
      const moved = await updateCompany(rep, saudiCompany.id, {
        name: saudiCompany.name,
        phone: saudiCompany.phone,
        countryId: abroad.id,
        categoryId: null,
        cityId: aCity.id,
        leadSourceId: null,
        notes: null,
      });
      if (moved.cityId !== null || moved.region !== null) {
        throw new Error(`kept city=${moved.cityId} region=${moved.region}`);
      }
    });

    await refuses(
      "a country id that resolves to nothing is refused, not a 500 [S14]",
      "validation.invalid",
      () =>
        createCompany(rep, {
          name: `${stamp} nowhere`,
          phone: `+9665${stamp.slice(-7)}4`,
          countryId: "00000000-0000-0000-0000-000000000000",
          categoryId: null,
          cityId: null,
          leadSourceId: null,
          notes: null,
        }),
    );
  }

  /* --- 11. A dispatch's project is its quotation's [S74] ---------------- */

  await regionIsAlwaysDerived();
  await projectMatchesThread();
  await vatIsFixed();
  await dispatchLinesHold();
  await requestStatesHold();
  await paymentAndShipmentHold();
  await repositoryMatchesDatabase();
}

/**
 * `S15` — **no company carries a region its city does not imply.**
 *
 * Asserted by identity, not as a check that `0017`'s backfill ran. There is no
 * CHECK that could say this: the region lives on `companies` and the fact that
 * decides it lives on `cities`, and Postgres cannot express "equal to a column
 * on another table" without a trigger or a composite key nobody asked for. So
 * the claim is made here, over every company ever written, and it fails the day
 * a write path stops deriving.
 *
 * **One `LEFT JOIN` states both halves.** A region with no city fails, because
 * the join produces a null city region and a region is not null; a region that
 * disagrees with its city fails directly. Two defects, one predicate.
 *
 * **`is distinct from`, never `<>`.** `<>` returns null on the null side and
 * the row passes silently — the same trap `rep_reports_on_hold` documents, and
 * the reason `projects_loss_state` is written the way it is. A `<>` here would
 * be green against exactly the 50 rows this slice exists to remove.
 *
 * It is also the only thing that proves `0017`. That `UPDATE` is the kind that
 * can be **wrong without failing**: a missed row keeps a plausible-looking
 * region that no city implies, and no screen would ever say so. On the database
 * it was written against it cleared 50 of 979 — a fact about that data, not
 * about the rule.
 *
 * **Counted in SQL and asserted `=== 0`**, never `!count`: `count(*)` comes
 * back as a string and a truthiness test on `"0"` would pass for the wrong
 * reason and keep passing on `"1"`.
 */
async function regionIsAlwaysDerived(): Promise<void> {
  console.log(
    "\n10b. *** No company carries a region its city does not imply *** [S15]",
  );

  const [row] = (await db.execute(sql`
    select
      count(*)::int as companies,
      count(*) filter (where c.region is not null)::int as with_region,
      count(*) filter (
        where c.region is distinct from ci.region
      )::int as wrong
    from companies c
    left join cities ci on ci.id = c.city_id
  `)) as unknown as {
    companies: number;
    with_region: number;
    wrong: number;
  }[];

  console.log(
    `  --    ${row.companies} company(ies), ${row.with_region} carrying a region`,
  );
  check(
    "*** no company's region disagrees with its city — or stands without one *** [S15]",
    row.wrong === 0,
    `${row.wrong} disagree`,
  );
}

/**
 * `S74` — **a dispatch's project is never different from its quotation's.**
 *
 * This is not a claim about today's data. It is the invariant `recordDispatch`
 * enforces, it must hold for every dispatch ever written, and it is stated
 * here because no CHECK can state it: the pair spans two rows, and Postgres
 * cannot express "equal to a column on another table" without a trigger or a
 * composite key nobody asked for.
 *
 * It is also the only thing that proves migration `0031`'s backfill — as it
 * proved `0013`'s before it. That `UPDATE` is the one statement in either
 * migration that can be **wrong without failing**: `dispatchedSqmByCompany`
 * reads `dispatches.project_id`, so a backfill that missed rows would show up
 * as figures that look plausible and are quietly short, never as an error.
 * Two counts, both zero.
 *
 * **Counted in SQL, and asserted `=== 0`.** Not `!count`: the query returns a
 * string from `count(*)`, and a truthiness test on `"0"` passes for the wrong
 * reason and would keep passing on `"1"`.
 */
async function projectMatchesThread(): Promise<void> {
  console.log(
    "\n11. *** An APPROVED dispatch's project IS its quotation's *** [S74], [S72]",
  );

  /*
   * **The claim stays narrowed to the approved even though `S50` closed the
   * gap that narrowed it.** `S72` narrowed it because a request could name a
   * project its quotation had not gained yet — the state the write-back
   * existed to resolve. There is no such state now: `projectForThread` takes
   * the thread's project and refuses a disagreeing one, so a request agrees
   * from the moment it is raised. Asserting only over the approved is
   * therefore weaker than it needs to be, and it stays that way deliberately:
   * `S72` is what decides which dispatches this rule is about, and widening it
   * here would be this script inventing a rule rather than reading one.
   *
   * `pending_writeback` is gone with the write-back. It counted requests
   * disagreeing with their quotation, which is now a refusal rather than a
   * state, and a count of a thing that cannot happen reads as tolerance for
   * it.
   */
  const [row] = (await db.execute(sql`
    select
      count(*) filter (
        where d.status = 'approved' and d.project_id is distinct from t.project_id
      )::int as disagreeing,
      count(*) filter (
        where d.status = 'approved' and d.project_id is null
      )::int as unfilled,
      count(*) filter (where d.status = 'approved')::int as approved,
      count(*)::int as linked,
      (select count(*)::int from dispatches
        where quotation_thread_id is null and project_id is not null) as direct_with_project
    from dispatches d
    join quotation_threads t on t.id = d.quotation_thread_id
  `)) as unknown as {
    disagreeing: number;
    unfilled: number;
    approved: number;
    linked: number;
    direct_with_project: number;
  }[];

  console.log(
    `  --    ${row.linked} dispatch(es) against a quotation, ${row.approved} of them approved`,
  );
  check(
    "*** no APPROVED dispatch carries a project different from its quotation's *** [S74]",
    row.disagreeing === 0,
    `${row.disagreeing} disagree`,
  );
  check(
    "*** none is null, since its quotation never is — the 0031 backfill *** [S74], [S50]",
    row.unfilled === 0,
    `${row.unfilled} unfilled`,
  );

  /*
   * **The column itself, asserted twice, because either alone passes for the
   * wrong reason.** A row count of zero orphans passes on an empty table; an
   * `information_schema` answer passes on a column nothing has ever filled.
   * Together they say what `S50` says: there is no project-less quotation, and
   * there is no way to write one.
   *
   * This is what replaces the audit half that stood here. That half read
   * `quotation_thread.project_set` — an action `S74`'s write-back was the only
   * writer of — and it went with the writer.
   */
  const [column] = (await db.execute(sql`
    select
      (select count(*)::int from quotation_threads where project_id is null) as orphans,
      (select is_nullable from information_schema.columns
        where table_schema = 'public' and table_name = 'quotation_threads'
          and column_name = 'project_id') as is_nullable
  `)) as unknown as { orphans: number; is_nullable: string }[];
  check(
    "*** no quotation thread has a null project *** [S50]",
    column.orphans === 0,
    `${column.orphans} orphan(s)`,
  );
  check(
    "*** …and the column refuses one — 0031 put the NOT NULL back *** [S50]",
    column.is_nullable === "NO",
    `is_nullable = ${column.is_nullable}`,
  );

  // `S75`'s stated-purpose half is session 6b. Until it lands, a dispatch with
  // no quotation reaches no project, and this is what says so — the assertion
  // that fails the day someone routes a direct dispatch to a project without
  // the rule that decides which one.
  check(
    "a dispatch with no quotation still names no project [S75]",
    row.direct_with_project === 0,
    `${row.direct_with_project} do`,
  );
}

/**
 * `S57` - **VAT is fixed at 15% and is never editable.**
 *
 * Asserted by identity, not as a check that `0014`'s backfill ran. There is no
 * `vat_rate` column left to compare against and no CHECK that could say this:
 * `vat_amount` is written by `lineMoney` in TypeScript, and a CHECK would have
 * to restate the rounding rule in SQL as a second definition of the same
 * arithmetic. So the claim is made here, over every line ever written, and it
 * fails the day a write path stops applying the constant.
 *
 * It is also the only thing that proves `0014`'s first statement. That
 * `UPDATE` is the one in the migration that could be **wrong without
 * failing**: a missed row keeps a plausible-looking amount that is simply not
 * 15% of its total, and no screen would ever say so. On the database it was
 * written against it changed nothing - all 162 priced lines already held the
 * right figure - which is a fact about today's data, not about the rule.
 *
 * **The version totals are asserted in the same breath**, because a line whose
 * VAT is right inside a version whose `total_vat` disagrees is the same defect
 * one level up. Services carry no VAT column and are taxed at the same
 * constant `[09 §5.5]`, so the expected total rounds twice - amount, then
 * tax on it - exactly as `recomputeVersionTotals` does.
 *
 * **Counted in SQL and asserted `=== 0`**, never `!count`: `count(*)` comes
 * back as a string and a truthiness test on `"0"` would pass for the wrong
 * reason and keep passing on `"1"`.
 */
/**
 * `S116` `S126` — **what a dispatch may contain**, over every row ever written.
 *
 * Three claims no CHECK can make, for three different reasons.
 *
 * **No dispatch has zero lines.** A dispatch's square metres are the sum of
 * its lines, so a lineless row does not fail — it reads as 0 m², and `S26`'s
 * per-participant figure, `S85`'s achievement and every credit split quietly
 * shrink by exactly that dispatch. That is the silent failure this section
 * exists for. It spans two tables, so `recordDispatch` is the only writer that
 * can hold it and this is the only thing that can say it held.
 *
 * **No linked dispatch was raised from a version that is still `requested`**
 * `S126`. Asserted through `quotation_version_id` rather than through the
 * thread, and that is the whole reason the column exists: a revision
 * supersedes the issued version `S66`, so a thread that was lawfully
 * dispatched against can end up with no issued version at all, and the same
 * claim made through the thread would start failing on a lawful historical
 * row. Through the version it is permanent — `issued`, later `superseded`,
 * never `requested`.
 *
 * **Every dispatch line's VAT is 15% of its total** `S57`, which is §12's
 * claim about quotation lines made about the table that now shares their
 * arithmetic. Both are written by `productLineMoney`; a second copy appearing
 * anywhere would show up here first.
 *
 * **There is no `sqm` column on `dispatches`** — the structural half. §2 makes
 * the same kind of claim about everything else that has been withdrawn: a
 * derived figure with a column still beside it is a place for a second answer
 * to live, and the invariant above would be a comparison rather than an
 * identity.
 *
 * **Counted in SQL and asserted `=== 0`**, never `!count`: `count(*)` comes
 * back as a string and a truthiness test on `"0"` passes for the wrong reason.
 */
async function dispatchLinesHold(): Promise<void> {
  console.log(
    "\n14. *** A dispatch's lines and its figure cannot disagree *** [S116], [S126]",
  );

  const [rows] = (await db.execute(sql`
    select
      count(*)::int as dispatches,
      count(*) filter (
        where not exists (
          select 1 from dispatch_lines l where l.dispatch_id = d.id
        )
      )::int as lineless,
      count(*) filter (where d.quotation_version_id is not null)::int as linked,
      count(*) filter (
        where v.status = 'requested'
      )::int as unissued
    from dispatches d
    left join quotation_versions v on v.id = d.quotation_version_id
  `)) as unknown as {
    dispatches: number;
    lineless: number;
    linked: number;
    unissued: number;
  }[];

  console.log(
    `  --    ${rows.dispatches} dispatch(es), ${rows.linked} raised from a quotation`,
  );
  check(
    "*** no dispatch has zero lines — one would read as 0 m2 *** [S116]",
    rows.lineless === 0,
    `${rows.lineless} carry none`,
  );
  check(
    "*** no dispatch was raised from a version still being edited *** [S126]",
    rows.unissued === 0,
    `${rows.unissued} name a requested version`,
  );

  const [lines] = (await db.execute(sql`
    select
      count(*)::int as total,
      count(*) filter (
        where vat_amount is distinct from round(line_total * 0.15, 2)
      )::int as wrong_vat,
      count(*) filter (
        where line_total is distinct from round(unit_price * sqm, 2)
      )::int as wrong_total
    from dispatch_lines
  `)) as unknown as { total: number; wrong_vat: number; wrong_total: number }[];

  console.log(`  --    ${lines.total} dispatch line(s)`);
  check(
    "no dispatch line's VAT differs from 15% of its total [S57]",
    lines.wrong_vat === 0,
    `${lines.wrong_vat} disagree`,
  );
  check(
    "no dispatch line's total differs from its price times its square metres [S56]",
    lines.wrong_total === 0,
    `${lines.wrong_total} disagree`,
  );

  const [column] = (await db.execute(sql`
    select count(*)::int as present
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'dispatches'
      and column_name = 'sqm'
  `)) as unknown as { present: number }[];
  check(
    "*** and there is no sqm column left for a second answer to live in *** [S116]",
    column.present === 0,
    "dispatches.sqm is still there",
  );
}

async function vatIsFixed(): Promise<void> {
  console.log("\n12. *** Every priced line's VAT is 15% of its total *** [S57]");

  const [lines] = (await db.execute(sql`
    select
      count(*)::int as priced,
      count(*) filter (
        where vat_amount is distinct from round(line_total * 0.15, 2)
      )::int as wrong
    from quotation_lines
    where line_total is not null
  `)) as unknown as { priced: number; wrong: number }[];

  console.log(`  --    ${lines.priced} priced line(s)`);
  check(
    "*** no priced line's VAT differs from 15% of its total *** [S57]",
    lines.wrong === 0,
    `${lines.wrong} disagree`,
  );

  const [totals] = (await db.execute(sql`
    select
      count(*)::int as versions,
      count(*) filter (where v.total_vat is distinct from e.expected)::int as wrong_vat,
      count(*) filter (
        where v.grand_total is distinct from v.total_excl_vat + e.expected
      )::int as wrong_grand
    from quotation_versions v
    cross join lateral (
      select
        coalesce((select sum(l.vat_amount) from quotation_lines l
                   where l.version_id = v.id), 0)
      + coalesce((select sum(round(round(s.unit_price * s.quantity, 2) * 0.15, 2))
                    from quotation_service_lines s
                   where s.version_id = v.id
                     and s.unit_price is not null), 0) as expected
    ) e
    where v.total_excl_vat is not null
  `)) as unknown as {
    versions: number;
    wrong_vat: number;
    wrong_grand: number;
  }[];

  console.log(`  --    ${totals.versions} version(s) with totals`);
  check(
    "every version total_vat equals the sum of its taxed parts [S57]",
    totals.wrong_vat === 0,
    `${totals.wrong_vat} disagree`,
  );
  check(
    "and grand_total is total_excl_vat plus it [S57]",
    totals.wrong_grand === 0,
    `${totals.wrong_grand} disagree`,
  );
}

/**
 * Both directions of one surface, as two checks that print the diff.
 *
 * A set difference each way, never a count: two drifts that cancel out — one
 * thing declared and missing, another present and undeclared — must not pass.
 */
function assertSetsMatch(
  surface: string,
  declared: Set<string>,
  live: Set<string>,
): void {
  const onlyLive = [...live].filter((name) => !declared.has(name)).sort();
  const onlyDeclared = [...declared].filter((name) => !live.has(name)).sort();
  check(
    `every ${surface} in the database is declared in schema.ts`,
    onlyLive.length === 0,
    `only in the database: ${onlyLive.join(", ")}`,
  );
  check(
    `every ${surface} schema.ts declares exists in the database`,
    onlyDeclared.length === 0,
    `only in schema.ts: ${onlyDeclared.join(", ")}`,
  );
}

/**
 * `S72` — **an unapproved request counts for nothing**, made as a claim about
 * every row rather than about the rows a script just wrote.
 *
 * Three claims, and they are three because each fails differently:
 *
 *  1. **The status and its stamps cannot disagree.** `approved_at`,
 *     `approved_by_user_id`, `refusal_reason` and `submitted_at` each belong to
 *     exactly one state, and the three CHECKs hold that row-locally. Asserted
 *     here over every row too, because a CHECK proves what the database will
 *     refuse *from now on* — it says nothing about a row that predates it or
 *     one written while it was `NOT VALID`.
 *
 *  2. **Every CHECK actually refuses**, driven rather than read out of
 *     `pg_constraint`. A constraint that exists and a constraint that fires are
 *     different claims, and §3 makes the same distinction for every other one.
 *
 *  3. **No figure reads an unapproved row.** The structural half of `S72`: the
 *     one predicate is `dispatches.ts`'s `approvedDispatches()`, and this asks
 *     the database directly whether any square metre reachable through the
 *     credit path belongs to a row that is not approved. `verify:slice3` §18
 *     and §22 make the behavioural half at each reader; this one cannot be
 *     satisfied by a reader that happens to be filtered correctly today.
 *
 * **Counted in SQL and asserted `=== 0`**, never `!count`: `count(*)` comes
 * back as a string and a truthiness test on `"0"` passes for the wrong reason.
 */
async function requestStatesHold(): Promise<void> {
  console.log(
    "\n15. *** A request's state and its stamps cannot disagree *** [S72], [S124], [S122]",
  );

  const [rows] = (await db.execute(sql`
    select
      count(*)::int as total,
      count(*) filter (where status = 'approved')::int as approved,
      count(*) filter (where status = 'submitted')::int as submitted,
      count(*) filter (where status = 'draft')::int as draft,
      count(*) filter (where status = 'refused')::int as refused,
      count(*) filter (where status = 'cancelled')::int as cancelled,
      count(*) filter (
        where (status in ('approved', 'cancelled')) is distinct from (approved_at is not null)
           or (status in ('approved', 'cancelled')) is distinct from (approved_by_user_id is not null)
      )::int as bad_approval,
      count(*) filter (
        where (status = 'refused') is distinct from (refusal_reason is not null)
      )::int as bad_reason,
      count(*) filter (
        where (status = 'cancelled') is distinct from (cancellation_reason is not null)
      )::int as bad_cancellation,
      count(*) filter (
        where (status = 'draft') is distinct from (submitted_at is null)
      )::int as bad_submitted
    from dispatches
  `)) as unknown as {
    total: number;
    approved: number;
    submitted: number;
    draft: number;
    refused: number;
    cancelled: number;
    bad_approval: number;
    bad_reason: number;
    bad_cancellation: number;
    bad_submitted: number;
  }[];

  console.log(
    `  --    ${rows.total} dispatch(es): ${rows.approved} approved, ` +
      `${rows.submitted} submitted, ${rows.draft} draft, ` +
      `${rows.refused} refused, ${rows.cancelled} cancelled`,
  );
  // `S73` — **a cancelled dispatch keeps its approval stamps**, because
  // approval is final and a cancellation is not an un-approve. That is why the
  // predicate names both states rather than `approved` alone, and why the
  // widening cannot make a cancelled dispatch count: no figure reads these
  // columns, they all compose `approvedDispatches()`.
  check(
    "no row's approval stamps disagree with its status [S72], [S73]",
    rows.bad_approval === 0,
    `${rows.bad_approval} disagree`,
  );
  check(
    "refused, and only refused, carries a reason [S124]",
    rows.bad_reason === 0,
    `${rows.bad_reason} disagree`,
  );
  check(
    "cancelled, and only cancelled, carries a cancellation reason [S73], [S128]",
    rows.bad_cancellation === 0,
    `${rows.bad_cancellation} disagree`,
  );
  check(
    "a draft has not been submitted, and everything else has [S72]",
    rows.bad_submitted === 0,
    `${rows.bad_submitted} disagree`,
  );

  // The three CHECKs, driven. `is distinct from` above says what the data
  // looks like; this says what the database will do about it tomorrow.
  const [any] = (await db.execute(sql`
    select id, company_id, user_id, recorded_by_user_id, dispatch_date
    from dispatches limit 1
  `)) as unknown as {
    id: string;
    company_id: string;
    user_id: string;
    recorded_by_user_id: string;
    dispatch_date: string;
  }[];
  if (!any) {
    console.error("  --    no dispatch to shape a refusal from; skipping");
    return;
  }
  // `stock` and `shipment` are NOT NULL since `0022` `S130` `S119`, so every
  // shape below carries them. Without them each insert refuses for a NOT NULL
  // violation rather than the constraint under test, and `databaseRefuses`
  // catches that by name — which is exactly what it is for.
  const columns =
    "(company_id, user_id, recorded_by_user_id, dispatch_date, stock, shipment, status";
  const values = `('${any.company_id}', '${any.user_id}', '${any.recorded_by_user_id}', '${any.dispatch_date}', 'riyadh', 'ct'`;

  await databaseRefuses(
    "approved with no approval time is refused [S72]",
    "dispatches_approval_stamps",
    // A payment method too `S73`, or `dispatches_payment_method` refuses this
    // row first and the assertion would be testing that constraint instead.
    `insert into dispatches ${columns}, submitted_at, payment_method) values ${values}, 'approved', now(), 'on_delivery')`,
  );
  await databaseRefuses(
    "an approval time on a draft is refused [S72]",
    "dispatches_approval_stamps",
    `insert into dispatches ${columns}, approved_at, approved_by_user_id) values ${values}, 'draft', now(), '${any.recorded_by_user_id}')`,
  );
  await databaseRefuses(
    "refused with no reason is refused [S124]",
    "dispatches_refusal_reason",
    `insert into dispatches ${columns}, submitted_at) values ${values}, 'refused', now())`,
  );
  await databaseRefuses(
    "a reason on anything but a refusal is refused [S124]",
    "dispatches_refusal_reason",
    `insert into dispatches ${columns}, refusal_reason) values ${values}, 'draft', 'no')`,
  );
  await databaseRefuses(
    "submitted with no submission time is refused [S72]",
    "dispatches_submitted_at",
    `insert into dispatches ${columns}) values ${values}, 'submitted')`,
  );
  await databaseRefuses(
    "a draft carrying a submission time is refused [S122]",
    "dispatches_submitted_at",
    `insert into dispatches ${columns}, submitted_at) values ${values}, 'draft', now())`,
  );

  /*
   * **The claim the whole slice exists to make.** Every square metre that can
   * reach a target passes through `dispatch_lines` joined to `dispatches`, so
   * this asks the database how many of those belong to a row that is not
   * approved, and how many square metres that is. Both must be visible: a
   * count alone would not say whether the leak was one line or a month.
   */
  const [unapproved] = (await db.execute(sql`
    select
      count(*)::int as lines,
      coalesce(sum(l.sqm), 0)::numeric(14, 4) as sqm
    from dispatch_lines l
    join dispatches d on d.id = l.dispatch_id
    where d.status <> 'approved'
  `)) as unknown as { lines: number; sqm: string }[];
  console.log(
    `  --    ${unapproved.lines} line(s) on unapproved requests, ${unapproved.sqm} m2 that must count nowhere`,
  );

  // `dispatchesInPeriod` is `S85`'s reader and the one every target figure
  // passes through. Asked over all time, it must return exactly the approved.
  const counted = await dispatchesInPeriod("2000-01-01", "2100-01-01");
  const [approvedRows] = (await db.execute(sql`
    select count(*)::int as n from dispatches where status = 'approved'
  `)) as unknown as { n: number }[];
  check(
    "*** the credit reader returns exactly the approved dispatches, no more *** [S72], [S85]",
    counted.length === approvedRows.n,
    `${counted.length} counted against ${approvedRows.n} approved`,
  );

  const approvedIds = new Set(
    (
      (await db.execute(sql`
        select id from dispatches where status = 'approved'
      `)) as unknown as { id: string }[]
    ).map((row) => row.id),
  );
  check(
    "*** and not one of them is a request nobody approved *** [S72]",
    counted.every((row) => approvedIds.has(row.id)),
    `${counted.filter((row) => !approvedIds.has(row.id)).length} leaked`,
  );

  /**
   * `S31` `S73` — **a cancelled dispatch credits nothing and wins nothing**,
   * over every row ever written rather than the one `verify:slice3` §29 makes.
   *
   * The two assertions above are already true of it by construction, since
   * `approvedDispatches()` is `status = 'approved'` — so this is the assertion
   * that would fail if anybody ever widened that predicate to read
   * `approved_at is not null`, which a cancelled dispatch still carries. It is
   * cheap and it guards the exact mistake the widened
   * `dispatches_approval_stamps` CHECK makes possible.
   */
  const [cancelledRows] = (await db.execute(sql`
    select
      count(*)::int as n,
      coalesce(sum(l.sqm), 0)::numeric(14, 4) as sqm
    from dispatches d
    left join dispatch_lines l on l.dispatch_id = d.id
    where d.status = 'cancelled'
  `)) as unknown as { n: number; sqm: string }[];
  console.log(
    `  --    ${cancelledRows.n} cancelled dispatch(es), ${cancelledRows.sqm} m2 that must count nowhere`,
  );
  const cancelledIds = new Set(
    (
      (await db.execute(sql`
        select id from dispatches where status = 'cancelled'
      `)) as unknown as { id: string }[]
    ).map((row) => row.id),
  );
  check(
    "*** no cancelled dispatch reaches the credit reader, on any row *** [S31], [S73]",
    counted.every((row) => !cancelledIds.has(row.id)),
    `${counted.filter((row) => cancelledIds.has(row.id)).length} leaked`,
  );
  // The win half is `verify:slice3`'s: §29 drives the un-winning and its
  // closing block re-derives every project's `won` against a hand-written
  // `status = 'approved'` truth, which is the same claim asked of the reader
  // rather than of the data. Asserting it twice here would prove arithmetic.
}

/**
 * *** Payment, shipment and the number *** `S73` `S119` `S121` `S130` `S71`.
 *
 * `requestStatesHold` above is the model and this is its sibling: **asserted
 * over every row ever written**, not over the rows a script has just made.
 * `verify:slice3` §3, §3b, §24, §25 and §26 make the behavioural half through
 * the data layer; this one cannot be satisfied by a writer that happens to be
 * correct today.
 *
 * Five claims, one per CHECK, and each is stated twice — once as a count over
 * the table, once as a refusal driven at the database. The count says what the
 * data looks like; the refusal says what the database will do about it
 * tomorrow, when a new writer forgets.
 *
 * **`(status = 'approved') and payment_method is null`, not `is distinct
 * from`.** These five CHECKs are one-directional by design (see `0022`'s
 * header), so the two-way form the three above use would report lawful rows as
 * violations: an unapproved request carrying a method is legal, and so is an
 * approved dispatch with no number.
 *
 * **Counted in SQL and asserted `=== 0`**, never `!count`: `count(*)` comes
 * back as a string and a truthiness test on `"0"` passes for the wrong reason.
 */
async function paymentAndShipmentHold(): Promise<void> {
  console.log(
    "\n16. *** Approval carries a payment method, South and Dammam are CT, the number is unique *** [S73], [S119], [S121]",
  );

  const [rows] = (await db.execute(sql`
    select
      count(*)::int as total,
      count(*) filter (where payment_method is not null)::int as with_method,
      count(*) filter (where smac_dispatch_number is not null)::int as numbered,
      count(*) filter (where shipment = 'ct')::int as ct,
      count(*) filter (where stock in ('south', 'dammam'))::int as far_stock,
      count(*) filter (
        where status = 'approved' and payment_method is null
      )::int as bad_method,
      count(*) filter (
        where payment_note is not null and payment_method is null
      )::int as bad_note,
      count(*) filter (
        where stock in ('south', 'dammam') and shipment <> 'ct'
      )::int as bad_shipment,
      count(*) filter (
        where cargo_destination is not null and shipment <> 'cargo'
      )::int as bad_destination,
      -- approved_by_user_id is null, NOT status <> 'approved'. The check's
      -- own name is "nobody approved", and the two are not the same question:
      -- S73's cancellation moves an approved dispatch out of the approved
      -- status, and S31 keeps it visible as history carrying everything it
      -- had, its SMAC number included. The old predicate therefore failed on
      -- every cancelled-after-approval row -- two in the demo base -- because
      -- it read a status where it meant an act. The same conflation the
      -- dispatch turn line carried until dispatchTurnKey gave cancelled a line
      -- of its own.
      count(*) filter (
        where smac_dispatch_number is not null and approved_by_user_id is null
      )::int as bad_number
    from dispatches
  `)) as unknown as {
    total: number;
    with_method: number;
    numbered: number;
    ct: number;
    far_stock: number;
    bad_method: number;
    bad_note: number;
    bad_shipment: number;
    bad_destination: number;
    bad_number: number;
  }[];

  console.log(
    `  --    ${rows.total} dispatch(es): ${rows.with_method} carry a payment method, ` +
      `${rows.numbered} a SMAC number, ${rows.ct} ship CT, ${rows.far_stock} draw from South or Dammam`,
  );
  check(
    "*** no approved dispatch carries no payment method *** [S73]",
    rows.bad_method === 0,
    `${rows.bad_method} approved with none`,
  );
  check(
    "no payment note annotates a method that is not there [S71]",
    rows.bad_note === 0,
    `${rows.bad_note} disagree`,
  );
  check(
    "*** no South or Dammam dispatch ships anything but CT *** [S119], [S130]",
    rows.bad_shipment === 0,
    `${rows.bad_shipment} disagree`,
  );
  check(
    "no destination sits on a dispatch that is not Cargo [S119]",
    rows.bad_destination === 0,
    `${rows.bad_destination} disagree`,
  );
  check(
    "no SMAC number sits on a dispatch nobody approved [S121]",
    rows.bad_number === 0,
    `${rows.bad_number} disagree`,
  );

  // `S121` — *which is unique*. Asserted as data as well as by the index,
  // because a unique index created on the wrong column would still be unique.
  const [dupes] = (await db.execute(sql`
    select count(*)::int as n from (
      select smac_dispatch_number
      from dispatches
      where smac_dispatch_number is not null
      group by smac_dispatch_number
      having count(*) > 1
    ) t
  `)) as unknown as { n: number }[];
  check(
    "*** no SMAC dispatch number is carried by two dispatches *** [S121]",
    dupes.n === 0,
    `${dupes.n} duplicated`,
  );

  // **The `S73` inversion, read from the database.** The old gate refused an
  // approval whose thread had no `payment_confirmed_at`. That column is gone
  // `S133` `0029`, so the join it needed cannot be written any more - and the
  // claim it was making narrows to the half that survives: **every approved
  // dispatch carries a payment method**, which is what replaced the gate. It
  // is asserted over every row rather than over the linked ones alone,
  // because `S73` binds the free-entry route too (`verify:slice3` 3b).
  const [approvedMethod] = (await db.execute(sql`
    select
      count(*)::int as n,
      count(*) filter (where d.payment_method is null)::int as no_method
    from dispatches d
    where d.status = 'approved'
  `)) as unknown as { n: number; no_method: number }[];
  console.log(
    `  --    ${approvedMethod.n} approved dispatch(es), on every S75 route`,
  );
  check(
    "*** every approved dispatch carries a payment method *** [S73]",
    approvedMethod.no_method === 0,
    `${approvedMethod.no_method} carry none`,
  );

  // The five CHECKs, driven. Shaped from a real row so only the column under
  // test is wrong, as `requestStatesHold` does.
  const [any] = (await db.execute(sql`
    select id, company_id, user_id, recorded_by_user_id, dispatch_date
    from dispatches limit 1
  `)) as unknown as {
    id: string;
    company_id: string;
    user_id: string;
    recorded_by_user_id: string;
    dispatch_date: string;
  }[];
  if (!any) {
    console.error("  --    no dispatch to shape a refusal from; skipping");
    return;
  }
  const columns =
    "(company_id, user_id, recorded_by_user_id, dispatch_date, stock, shipment, status";
  const values = `('${any.company_id}', '${any.user_id}', '${any.recorded_by_user_id}', '${any.dispatch_date}'`;

  await databaseRefuses(
    "*** approved with no payment method is refused *** [S73]",
    "dispatches_payment_method",
    `insert into dispatches ${columns}, submitted_at, approved_at, approved_by_user_id)
     values ${values}, 'riyadh', 'ct', 'approved', now(), now(), '${any.recorded_by_user_id}')`,
  );
  await databaseRefuses(
    "a payment note with no method is refused [S71]",
    "dispatches_payment_note",
    `insert into dispatches ${columns}, payment_note) values ${values}, 'riyadh', 'ct', 'draft', 'x')`,
  );
  for (const stockName of ["south", "dammam"]) {
    for (const wrong of ["tt", "cargo"]) {
      await databaseRefuses(
        `*** ${stockName} stock as ${wrong.toUpperCase()} is refused *** [S119]`,
        "dispatches_stock_shipment",
        `insert into dispatches ${columns}) values ${values}, '${stockName}', '${wrong}', 'draft')`,
      );
    }
  }
  await databaseRefuses(
    "a destination on a CT dispatch is refused [S119]",
    "dispatches_cargo_destination",
    `insert into dispatches ${columns}, cargo_destination) values ${values}, 'riyadh', 'ct', 'draft', 'Jeddah')`,
  );
  await databaseRefuses(
    "*** a SMAC number before approval is refused *** [S121]",
    "dispatches_smac_number_after_approval",
    `insert into dispatches ${columns}, smac_dispatch_number) values ${values}, 'riyadh', 'ct', 'draft', 'DN-schema25')`,
  );

  // `S119` — **Malham takes TT**, and the ABSENCE of a refusal is the claim:
  // *TT is discouraged there, never refused... the coordinator's knowledge,
  // not a rule FACET enforces.* A CHECK that helpfully included Malham would
  // be breaking the rule rather than enforcing it, so it is driven rather than
  // assumed — the other five refusals above would all still pass with Malham
  // wrongly named in `dispatches_stock_shipment`.
  //
  // **Rolled back through a transaction that throws**, because this script
  // asserts and never writes. `begin; …; rollback;` in one `execute` is not
  // available: postgres.js sends it as a prepared statement and Postgres
  // refuses multiple commands in one.
  let malhamTook = false;
  try {
    await db.transaction(async (tx) => {
      await tx.execute(
        sql.raw(
          `insert into dispatches ${columns}) values ${values}, 'malham', 'tt', 'draft')`,
        ),
      );
      malhamTook = true;
      throw new Error("ROLLBACK-ON-PURPOSE");
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message !== "ROLLBACK-ON-PURPOSE") {
      malhamTook = false;
      console.error(`  --    malham/TT insert threw: ${message}`);
    }
  }
  check(
    "*** Malham takes TT — the database does not refuse it *** [S119]",
    malhamTook,
    "the CHECK named Malham, which S119 says it must not",
  );
}

/**
 * *** The repository and the database agree *** — the drift nothing could see.
 *
 * `drizzle-kit generate` compares `schema.ts` to `meta/*_snapshot.json`, so
 * anything those two get wrong **together** is invisible to it forever. That
 * is not hypothetical: `0015` dropped `rep_reports.reference` and Postgres
 * dropped the CHECK `rep_reports_reference` with it, while both files went on
 * declaring a ninth constraint through six migrations of "No schema changes"
 * (AUDIT 1 F19, corrected by `0016`). Only something that reads `pg_catalog`
 * can answer it, and nothing did.
 *
 * One blind spot, three surfaces — CHECK constraints, enum types and their
 * values, indexes. Closing one of the three would read as complete and would
 * not be.
 *
 * The declared side is Drizzle's own runtime config, never a grep over the
 * file: `getTableConfig` is what drizzle-kit itself reads, so a constraint
 * declared through a helper or spread from a shared list still counts.
 */
async function repositoryMatchesDatabase(): Promise<void> {
  /* --- 17. The difference flag, over every row [S120] -------------- */

  console.log(
    "\n17. *** The difference flag, and what no CHECK can hold *** [S120]",
  );

  // **The comparison is the module's own**, imported rather than rewritten.
  // A second copy of the canonicalisation here would make this script prove
  // its own arithmetic instead of `dispatches.ts`'s — the failure `S116`'s
  // `sqm` sweep was written to avoid, one level up.
  const [flags] = (await db.execute(sql`
    select
      count(*)::int as total,
      count(*) filter (where ${dispatchDiffers})::int as differing,
      count(*) filter (where differed_at_submission)::int as by_rep,
      count(*) filter (where lines_changed_after_submission)::int as touched,
      count(*) filter (where quotation_version_id is null)::int as free_entries,
      -- The CHECK's own claim, asserted as DATA as well: a constraint written
      -- against the wrong column would still be satisfied.
      count(*) filter (
        where (differed_at_submission is null)
           <> (lines_changed_after_submission is null)
      )::int as unpaired,
      count(*) filter (
        where (differed_at_submission is not null)
           <> (submitted_at is not null and quotation_version_id is not null)
      )::int as misplaced,
      -- **What no CHECK can hold**, because it spans two tables and a derived
      -- comparison: a dispatch that differs from its version, submitted, with
      -- NEITHER half set. The lines cannot have moved with nobody moving them,
      -- and the detail screen's attribution reads exactly this as impossible.
      count(*) filter (
        where ${dispatchDiffers}
          and submitted_at is not null
          and differed_at_submission is not true
          and lines_changed_after_submission is not true
      )::int as unattributed
    from dispatches
  `)) as unknown as {
    total: number;
    differing: number;
    by_rep: number;
    touched: number;
    free_entries: number;
    unpaired: number;
    misplaced: number;
    unattributed: number;
  }[];

  console.log(
    `  --    ${flags.total} dispatch(es): ${flags.differing} differ from their version, ` +
      `${flags.by_rep} deviated at submission, ${flags.touched} had their lines changed after it, ` +
      `${flags.free_entries} are free entries with no version to differ from`,
  );
  check(
    "the two halves are null together, or set together [S120]",
    flags.unpaired === 0,
    `${flags.unpaired} disagree`,
  );
  check(
    "…and they exist exactly where there is a submission and a version [S120], [S75]",
    flags.misplaced === 0,
    `${flags.misplaced} disagree`,
  );
  check(
    "*** no submitted dispatch differs with nobody named for it *** [S120]",
    flags.unattributed === 0,
    `${flags.unattributed} unattributed`,
  );

  /* --- 18. At least one product line, over every row [S60] --------- */

  console.log(
    "\n18. *** No quotation version carries zero product lines *** [S60]",
  );

  // **The invariant, not the fixture** — and the one shape of rule this
  // project's database genuinely cannot hold. *At least one child row* is not
  // row-local, so no CHECK can express it, and `CLAUDE.md` puts in the database
  // only what a row may contain. What holds `S60` is three refusals in
  // `quotations.ts` — raising, removing the last line, issuing — and this,
  // asserted over every row ever written rather than over the rows a script
  // just made. It is the exact twin of §14's claim for `S116`.
  //
  // It has teeth: it was **false** when it was written. Thirteen versions
  // carried no lines, six of them `issued`, every one inserted directly by
  // `verify-phase9` or `verify-phase10a` — the two scripts that reach a
  // quotation state without going through the gates. Both now give their
  // versions a line through `scripts/quotation-fixture.ts`.
  const [empties] = (await db.execute(sql`
    select
      count(*)::int as versions,
      count(*) filter (
        where not exists (
          select 1 from quotation_lines l where l.version_id = v.id
        )
      )::int as lineless,
      count(*) filter (
        where v.status <> 'requested'
          and not exists (
            select 1 from quotation_lines l where l.version_id = v.id
          )
      )::int as frozen_lineless
    from quotation_versions v
  `)) as unknown as {
    versions: number;
    lineless: number;
    frozen_lineless: number;
  }[];

  console.log(`  --    ${empties.versions} quotation version(s)`);
  check(
    "*** no quotation version carries zero product lines *** [S60]",
    empties.lineless === 0,
    `${empties.lineless} carry none`,
  );
  // Named separately because it is the unrepairable half: past `requested`,
  // `S61` will not let a line be added, so one of these could never be fixed
  // in the application at all — and `S126` makes it dispatchable, `S116`
  // prefills nothing from it, and `S77` reads its total as what was quoted.
  check(
    "*** and none that is issued or superseded, where no line could be added *** [S60], [S61]",
    empties.frozen_lineless === 0,
    `${empties.frozen_lineless} frozen with none`,
  );

  /* --- 19. Won is derived, over every row [S31], [S28] ------------- */

  console.log(
    "\n19. *** No project claims a win its dispatches do not *** [S31], [S28]",
  );

  // **The module's derivation against a hand-written truth, over every
  // project.** `projectIsWon` is a correlated subquery, and `CLAUDE.md` names
  // that shape as the one that fails silently: a Drizzle column that loses its
  // table qualifier renders bare, resolves inside the inner table, and the
  // subquery returns nothing for every row without raising anything. A slice
  // that asserted only the project it had just won would have passed on that.
  //
  // So this asks the question twice in two languages — the module's, through
  // `listProjects`, and raw SQL naming both tables outright — and compares.
  // Same reasoning as §14's for `S116`, and the same reason: it has already
  // shipped wrong numbers once.
  //
  // Read as the manager, who sees every rep `S30`: a per-rep session would
  // make an invisible project look un-won rather than unseen.
  const everyProjectRow = (await db.execute(sql`
    select
      p.id::text as id,
      exists (
        select 1 from dispatches d
        where d.project_id = p.id and d.status = 'approved'
      ) as truly_won
    from projects p
  `)) as unknown as { id: string; truly_won: boolean }[];
  const truth = new Map(everyProjectRow.map((row) => [row.id, row.truly_won]));

  const manager = await sessionFor("manager@example.test");
  const derived = new Map<string, boolean>();

  for (let page = 1; ; page += 1) {
    const { rows, total } = await listProjects(manager, { page });
    for (const row of rows) derived.set(row.id, row.won);
    if (rows.length === 0 || derived.size >= total) break;
  }

  const unseen = [...truth.keys()].filter((id) => !derived.has(id)).length;
  const disagreeingWins = [...derived].filter(
    ([id, won]) => won !== truth.get(id),
  ).length;
  const wonCount = [...truth.values()].filter(Boolean).length;

  console.log(
    `  --    ${truth.size} project(s), ${wonCount} won by an approved dispatch`,
  );
  check(
    "the manager's list reaches every project, so the claim below is whole [S30]",
    unseen === 0,
    `${unseen} project(s) never appeared on any page`,
  );
  check(
    "*** no project's derived win disagrees with its dispatches, on any row *** [S31]",
    disagreeingWins === 0,
    `${disagreeingWins} of ${derived.size} disagree`,
  );
  // The negative half, and the one a broken correlation would pass: if the
  // subquery returned false for everything, the check above would still hold
  // on a database where nothing is won. It must find some.
  check(
    "…and something IS won, so a subquery returning false for everything fails here [S31]",
    wonCount > 0,
    `${wonCount} won`,
  );

  /* --- 20. One primary rep per company, over every row [S18] ------- */

  console.log(
    "\n20. *** Every company with a rep on it has exactly ONE primary rep *** [S18]",
  );

  // **The invariant, not the fixture** — and the second of §18's shape: not
  // row-local, so no CHECK can hold it, and only half of it is even an index.
  // Postgres could refuse a SECOND primary with a partial unique index on
  // `(company_id) WHERE removed_at IS NULL AND is_primary` — the shape
  // `project_companies_one_buyer_key` already has for `S26` — but "at least
  // one" has no such form, and that is the half that was actually broken. So
  // what holds `S18` is its three writers, and this count over every row ever
  // written.
  //
  // It has teeth: it was **false** when it was written. Twelve of 393
  // companies with a live membership carried no primary rep at all — six from
  // `verify-phase11` §11, which drives handover's already-a-member branch
  // where primacy used to move nowhere, and six from `verify-phase9` §16,
  // which stamps `removed_at` on the primary directly. `team.ts` now promotes
  // the row that stays, §16 promotes what is left of its company, and `0026`
  // repaired the twelve. **None ever carried two** — no writer has ever made
  // a second primary — so only the missing half needed repairing.
  //
  // Both tables are named outright in the aggregate below — `CLAUDE.md`'s
  // rule, and the reason it exists: a correlation that resolves inside the
  // inner table returns nothing for every row and reports a clean database.
  const [primacy] = (await db.execute(sql`
    select
      count(*)::int as held_companies,
      count(*) filter (where g.primaries = 0)::int as none,
      count(*) filter (where g.primaries > 1)::int as many,
      coalesce(sum(g.primaries), 0)::int as primary_rows
    from (
      select cr.company_id,
             count(*) filter (where cr.is_primary)::int as primaries
      from company_reps cr
      where cr.removed_at is null
      group by cr.company_id
    ) g
  `)) as unknown as {
    held_companies: number;
    none: number;
    many: number;
    primary_rows: number;
  }[];

  console.log(
    `  --    ${primacy.held_companies} company(s) with at least one live membership`,
  );
  check(
    "*** none of them carries NO primary rep *** [S18]",
    primacy.none === 0,
    `${primacy.none} of ${primacy.held_companies} carry no primary rep`,
  );
  check(
    "*** and none of them carries more than one *** [S18]",
    primacy.many === 0,
    `${primacy.many} of ${primacy.held_companies} carry more than one`,
  );
  // The negative half, and the one an empty read would pass: on a database
  // where the grouping found nothing, both counts above are zero and both
  // checks go green. The rows have to be there to have been counted, and
  // exactly one per company is the whole rule stated a third way.
  check(
    "…and the primary rows counted equal the companies, so an empty read fails here [S18]",
    primacy.held_companies > 0 &&
      primacy.primary_rows === primacy.held_companies,
    `${primacy.primary_rows} primary row(s) across ${primacy.held_companies} company(s)`,
  );

  /* --- 21. Every live company book is held by an S9 recipient ------- */

  console.log(
    "\n21. *** No live company membership belongs to somebody who could not now receive one *** [S9]",
  );

  // **The invariant behind AUDIT 1 F8.** `S9` names four recipients — a rep, a
  // desk rep, marketing, the coordinator — and no flag says "holds a company
  // book", so `companyBookHolderFilter` stands in `sees_all_reps` for the three
  // elevated roles the rule leaves out. That makes the seed load-bearing in a
  // way a CHECK cannot hold: the test is a join to `roles`, so a seed edit that
  // granted `sees_all_reps` to a rep would silently empty every picker, and one
  // that dropped it from the manager would silently widen both writers.
  //
  // So the partition is asserted first, by name, against the LIVE table — the
  // only place in `src/` or `scripts/` a role name may decide anything is the
  // seed `[07 A5 C1]`, and this is asserting the seed, not authorizing by it.
  const seededRoles = (await db.execute(sql`
    select name_en, sees_all_reps
    from roles
    where name_en in (
      'Sales Rep', 'Desk Rep', 'Marketing', 'Sales Coordinator',
      'Sales Manager', 'Executive', 'Super Admin'
    )
  `)) as unknown as { name_en: string; sees_all_reps: boolean }[];

  const holders = new Set(
    seededRoles.filter((row) => !row.sees_all_reps).map((row) => row.name_en),
  );
  check(
    "all seven seeded roles are present, so the partition below is over all of them [S7]",
    seededRoles.length === 7,
    `${seededRoles.length} of 7 found`,
  );
  for (const name of [
    "Sales Rep",
    "Desk Rep",
    "Marketing",
    "Sales Coordinator",
  ]) {
    check(`${name} may hold a company book [S9]`, holders.has(name));
  }
  for (const name of ["Sales Manager", "Executive", "Super Admin"]) {
    check(
      `${name} may NOT — above the book, not a place to put one [S9]`,
      !holders.has(name),
    );
  }

  // Then every row. `company_reps` and `users` and `roles` are all named
  // outright — `CLAUDE.md`'s rule, and the failure it names is exactly this
  // shape: a correlation resolving inside the inner table counts nothing and
  // reports a clean database.
  const [book] = (await db.execute(sql`
    select
      count(*)::int as live_memberships,
      count(*) filter (where r.sees_all_reps)::int as elevated
    from company_reps cr
    join users u on u.id = cr.user_id
    join roles r on r.id = u.role_id
    where cr.removed_at is null
  `)) as unknown as { live_memberships: number; elevated: number }[];

  console.log(`  --    ${book.live_memberships} live company membership(s)`);
  check(
    "*** none of them is held by a role that may not now receive one *** [S9]",
    book.elevated === 0,
    `${book.elevated} of ${book.live_memberships} held by an elevated role`,
  );
  // The negative half, and the one an empty read passes: on a database with no
  // memberships the count above is zero and the check goes green regardless.
  check(
    "…and there were memberships to check, so an empty read fails here [S9]",
    book.live_memberships > 0,
    `${book.live_memberships} live membership(s)`,
  );

  /* --- 22. The normalized name key, over every row [S12], [S19], [S26] - */

  console.log(
    "\n22. *** Every normalized name key equals normalizeName(name) *** [S12], [S19], [S26]",
  );

  // **What this guards is a migration, not a form.** `0030` collapsed the
  // project's two name columns into one and moved 49 of 50 rows onto their
  // Arabic name — and `name_normalized` had to move with each of them, because
  // it was only ever `normalizeName(name_en)`. That fold was written in SQL,
  // since `normalizeName` cannot run inside a migration, and SQL agreeing with
  // TypeScript is exactly the kind of claim that is true on the day it is
  // measured and quietly false later.
  //
  // So it is asserted from the function itself rather than from a second copy
  // of the algorithm: every row is read, folded here, and compared. A drift
  // between the two is a record a rep can see and cannot find by name — the
  // silent half, because search returns an empty list rather than an error.
  //
  // All three tables that carry the key, not projects alone. The invariant is
  // `normalizeName`'s and the writers are three create/update pairs, so one
  // loop covers what three would.
  for (const [label, rows] of [
    [
      "company",
      await db
        .select({ name: companies.name, key: companies.nameNormalized })
        .from(companies),
    ],
    [
      "contact",
      await db
        .select({ name: contacts.name, key: contacts.nameNormalized })
        .from(contacts),
    ],
    [
      "project",
      await db
        .select({ name: projects.name, key: projects.nameNormalized })
        .from(projects),
    ],
  ] as const) {
    const drifted = rows.filter((row) => normalizeName(row.name) !== row.key);
    console.log(`  --    ${rows.length} ${label}(s) folded`);
    check(
      `*** every ${label}'s name_normalized equals normalizeName(name) *** [S12], [S19], [S26]`,
      drifted.length === 0,
      drifted
        .slice(0, 3)
        .map((row) => `${row.name} -> ${row.key}`)
        .join(" | "),
    );
    // The negative half: with no rows the filter is empty and the check above
    // goes green having compared nothing.
    check(
      `…and there were ${label} rows to fold, so an empty read fails here`,
      rows.length > 0,
      `${rows.length} row(s)`,
    );
  }

  console.log("\n13. *** The repository and the database agree ***");

  // `Object.values` types each export as its own concrete table or enum type,
  // and neither `PgTable` nor `PgEnum` is assignable back to that union — so
  // the narrowing has to start from `unknown`, exactly as `is()` reads it.
  const exported: unknown[] = Object.values(schema);
  const tables = exported.filter((value): value is PgTable =>
    is(value, PgTable),
  );

  // `contype = 'c'` is CHECK alone on Postgres 17 (`docker-compose.yml`) — a
  // NOT NULL is not a row in `pg_constraint` there. `conrelid <> 0` drops a
  // domain's check, which belongs to no table and is not schema.ts's to hold.
  const declaredChecks = new Set(
    tables.flatMap((table) =>
      getTableConfig(table).checks.map((constraint) => constraint.name),
    ),
  );
  const liveChecks = new Set(
    (
      (await db.execute(sql`
        select conname from pg_constraint
        where contype = 'c'
          and connamespace = 'public'::regnamespace
          and conrelid <> 0
      `)) as unknown as { conname: string }[]
    ).map((row) => row.conname),
  );
  console.log(`  --    ${liveChecks.size} CHECK constraint(s) in the database`);
  assertSetsMatch("CHECK", declaredChecks, liveChecks);

  const declaredEnums = new Map(
    exported
      .filter(isPgEnum)
      .map((pgEnum) => [pgEnum.enumName, [...pgEnum.enumValues].sort()]),
  );
  const liveEnumRows = (await db.execute(sql`
    select t.typname, e.enumlabel
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typnamespace = 'public'::regnamespace
    order by t.typname, e.enumsortorder
  `)) as unknown as { typname: string; enumlabel: string }[];
  const liveEnums = new Map<string, string[]>();
  for (const row of liveEnumRows) {
    liveEnums.set(row.typname, [
      ...(liveEnums.get(row.typname) ?? []),
      row.enumlabel,
    ]);
  }
  for (const values of liveEnums.values()) values.sort();
  console.log(`  --    ${liveEnums.size} enum type(s) in the database`);
  assertSetsMatch(
    "enum type",
    new Set(declaredEnums.keys()),
    new Set(liveEnums.keys()),
  );

  // Names alone would pass a type whose value list has drifted, and that is
  // the same failure: AUDIT 1 found value-level gaps (`report_signal` against
  // `S43`) that a name comparison cannot see. Only the types both sides have
  // — a missing type is already a failure above, and would report twice.
  const valueDrift = [...declaredEnums.entries()]
    .map(([name, declared]) => {
      const live = liveEnums.get(name);
      if (!live) return null;
      return {
        name,
        onlyLive: live.filter((value) => !declared.includes(value)),
        onlyDeclared: declared.filter((value) => !live.includes(value)),
      };
    })
    .filter((drift) => drift !== null)
    .filter(
      (drift) => drift.onlyLive.length > 0 || drift.onlyDeclared.length > 0,
    );
  check(
    "every enum type's value list matches schema.ts",
    valueDrift.length === 0,
    valueDrift
      .map(
        (drift) =>
          `${drift.name} — only in the database: [${drift.onlyLive.join(", ")}], only in schema.ts: [${drift.onlyDeclared.join(", ")}]`,
      )
      .join(" | "),
  );

  // An index declared without a name would vanish from the set in silence —
  // exactly the hole this section exists to close — so it lands in the diff.
  const declaredIndexes = new Set(
    tables.flatMap((table) =>
      getTableConfig(table).indexes.map(
        (index) =>
          index.config.name ?? `«unnamed on ${getTableConfig(table).name}»`,
      ),
    ),
  );
  // `not exists (… conindid = c.oid)` is load-bearing, not noise: Postgres
  // lists the index behind every primary key and `unique()` constraint in
  // `pg_class` too, and `schema.ts` declares those as constraints, never as
  // indexes. Without the predicate this fails on nearly every table.
  const liveIndexNames = new Set(
    (
      (await db.execute(sql`
        select c.relname as indexname
        from pg_class c
        join pg_index i on i.indexrelid = c.oid
        where c.relkind = 'i'
          and c.relnamespace = 'public'::regnamespace
          and not exists (
            select 1 from pg_constraint con where con.conindid = c.oid
          )
      `)) as unknown as { indexname: string }[]
    ).map((row) => row.indexname),
  );
  console.log(
    `  --    ${liveIndexNames.size} index(es) in the database, constraint-owned excluded`,
  );
  assertSetsMatch("index", declaredIndexes, liveIndexNames);
}

main()
  .then(async () => {
    console.log(
      failures === 0
        ? "\nAll checks passed."
        : `\n${failures} CHECK(S) FAILED.`,
    );
    await closeDatabase();
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch(async (error) => {
    console.error(error);
    await closeDatabase();
    process.exit(1);
  });
