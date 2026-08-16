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
 *      assertion about an assertion.
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

import { eq, sql } from "drizzle-orm";

import { closeDatabase, db } from "@/db";
import {
  commentMentions,
  comments,
  companyCategories,
  lossReasons,
  projects,
  roles,
  users,
} from "@/db/schema";
import type { AuthSession } from "@/lib/authz";
import { createCompany } from "@/lib/companies";
import { OTHER_LOSS_REASON_CODE, REPORT_OUTCOMES } from "@/lib/enums";
import { createProject, updateProject } from "@/lib/projects";

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
  { key: "companies.has_credit_terms", type: "boolean", nullable: false, defaultsFalse: true, cite: "25 §7" },
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
  { key: "rep_reports.reference", type: "text", nullable: true, cite: "25 §34" },
  { key: "quotation_threads.closed_at", type: "timestamp with time zone", nullable: true, cite: "25 §24" },
  { key: "quotation_threads.closed_by_user_id", type: "uuid", nullable: true, cite: "25 §24" },
];

/** The columns `25` withdraws. Present means the migration did not land. */
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
  { table: "companies", column: "has_credit_terms", boolean: true },
  { table: "quotation_threads", column: "closed_at" },
  { table: "quotation_threads", column: "closed_by_user_id" },
  { table: "rep_reports", column: "reference" },
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

  /* --- 2. Every withdrawn thing is gone [25 §6, §23, §35], [26 §2] --- */

  console.log("\n2. Warmth, tolerance, the sales desk, and feature slice 6's drops are absent");

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

  for (const table of SLICE6_DROPPED_TABLES) {
    const exists = (await db.execute(
      sql.raw(`select to_regclass('public.${table}') is not null as exists`),
    )) as unknown as { exists: boolean }[];
    check(`table ${table} is gone [26 §2, §6]`, exists[0]?.exists === false);
  }

  for (const typeName of SLICE6_DROPPED_TYPES) {
    const dropped = (await db.execute(
      sql.raw(`select typname from pg_type where typname = '${typeName}'`),
    )) as unknown as { typname: string }[];
    check(`type ${typeName} is gone [26 §6]`, dropped.length === 0);
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
  const company = await createCompany(rep, {
    nameEn: `${stamp} company`,
    nameAr: null,
    phone: null,
    categoryId: null,
    vatNumber: null,
    region: null,
    cityId: null,
    leadSourceId: null,
    notes: null,
  });
  const openProject = await createProject(
    rep,
    {
      nameEn: `${stamp} open project`,
      nameAr: null,
      sqmExpected: null,
      region: null,
      cityId: null,
      endState: null,
      lostReasonId: null,
      lossReason: null,
      inProduction: false,
    },
    [{ companyId: company.id, role: null, isBuyer: false }],
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
  await databaseRefuses(
    "a reason on a project that is not lost is refused",
    "projects_loss_state",
    `update projects
       set end_state = 'won',
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
  await databaseRefuses(
    "a comment on a quotation VERSION is refused [25 §9]",
    "comments_record_type",
    `insert into comments (record_type, record_id, author_user_id, body)
     values ('quotation_version', '${openProject.id}', '${rep.user.id}', 'no')`,
  );
  await databaseRefuses(
    "a reference on a field note is refused [25 §34]",
    "rep_reports_reference",
    `insert into rep_reports
       (user_id, entry_type, category, narrative, report_date, reference)
     values ('${rep.user.id}', 'field_note', 'scouting', 'n', current_date, '168')`,
  );

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
      nameEn: `${stamp} lost project`,
      nameAr: null,
      sqmExpected: null,
      region: null,
      cityId: null,
      endState: "lost",
      lostReasonId: otherReason.id,
      lossReason: "The customer chose a cheaper supplier.",
      inProduction: false,
    },
    [{ companyId: company.id, role: null, isBuyer: false }],
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
      nameEn: openProject.nameEn,
      nameAr: null,
      sqmExpected: null,
      region: null,
      cityId: null,
      endState: "lost",
      lostReasonId: otherReason.id,
      lossReason: "Delivery time was too long.",
      inProduction: false,
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
    nameEn: `${openProject.nameEn} (edited)`,
    nameAr: null,
    sqmExpected: null,
    region: null,
    cityId: null,
    endState: "lost",
    lostReasonId: otherReason.id,
    lossReason: "Delivery time was too long.",
    inProduction: false,
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
      nameEn: openProject.nameEn,
      nameAr: null,
      sqmExpected: null,
      region: null,
      cityId: null,
      endState: "lost",
      lostReasonId: nonOtherReason.id,
      lossReason: null,
      inProduction: false,
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
        nameEn: openProject.nameEn,
        nameAr: null,
        sqmExpected: null,
        region: null,
        cityId: null,
        endState: "lost",
        lostReasonId: otherReason.id,
        lossReason: null,
        inProduction: false,
      }),
  );

  await refuses(
    "a non-'other' reason with detail is refused [25 §5]",
    "projects.errors.lossReasonDetailForbidden",
    () =>
      updateProject(rep, openProject.id, {
        nameEn: openProject.nameEn,
        nameAr: null,
        sqmExpected: null,
        region: null,
        cityId: null,
        endState: "lost",
        lostReasonId: nonOtherReason.id,
        lossReason: "This should not be allowed.",
        inProduction: false,
      }),
  );

  await allows("a non-'other' reason with no detail is allowed [25 §5]", () =>
    updateProject(rep, openProject.id, {
      nameEn: openProject.nameEn,
      nameAr: null,
      sqmExpected: null,
      region: null,
      cityId: null,
      endState: "lost",
      lostReasonId: nonOtherReason.id,
      lossReason: null,
      inProduction: false,
    }),
  );

  await refuses(
    "a lost project with no reason picked is refused [25 §5]",
    "projects.errors.lossReasonRequired",
    () =>
      updateProject(rep, openProject.id, {
        nameEn: openProject.nameEn,
        nameAr: null,
        sqmExpected: null,
        region: null,
        cityId: null,
        endState: "lost",
        lostReasonId: null,
        lossReason: null,
        inProduction: false,
      }),
  );

  // And moving off `lost` must clear all three, or projects_loss_state refuses
  // the row — the case a screen will hit the first time a rep changes his mind.
  await allows("moving a lost project to won clears the loss [25 §5]", async () => {
    const won = await updateProject(rep, openProject.id, {
      nameEn: openProject.nameEn,
      nameAr: null,
      sqmExpected: null,
      region: null,
      cityId: null,
      endState: "won",
      lostReasonId: null,
      lossReason: null,
      inProduction: false,
    });
    if (won.lostReasonId !== null || won.lostAt !== null || won.lossReason !== null) {
      throw new Error(
        `left lost_reason_id=${won.lostReasonId} lost_at=${won.lostAt} loss_reason=${won.lossReason}`,
      );
    }
  });

  // `25 §4` — a plain label, no invariant to prove beyond a round-trip: this
  // is the whole of what "deliberately unverified" leaves to check.
  await allows("in_production round-trips through updateProject [25 §4]", async () => {
    const updated = await updateProject(rep, openProject.id, {
      nameEn: openProject.nameEn,
      nameAr: null,
      sqmExpected: null,
      region: null,
      cityId: null,
      endState: "won",
      lostReasonId: null,
      lossReason: null,
      inProduction: true,
    });
    if (updated.inProduction !== true) {
      throw new Error(`got inProduction=${updated.inProduction}`);
    }
  });
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
