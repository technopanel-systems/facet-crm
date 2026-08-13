/**
 * Verification scaffolding for `docs/25` Part G — NOT a feature.
 *
 * The other five suites drive behaviour. This one has almost none to drive:
 * Part G lands twelve schema changes and the slices that fill them come after,
 * so what needs proving is that **the shape is right and nothing writes it
 * yet**. It reads `information_schema` and `pg_catalog` rather than a data
 * module, which no script here has done before.
 *
 * The exception is section 10, and it is the reason this file exists at all.
 * `projects_loss_detail` refuses the free-text loss reason `src/lib/projects.ts`
 * used to write; zero lost projects meant the migration applied cleanly while
 * the first rep to mark one lost would have found a 500, and **none of the five
 * suites drives that path** — `verify:routes` replays only the theme toggle and
 * mark-read. A CHECK is only as good as the writer beside it, so the writer
 * changed in the same pass and section 10 proves the two agree.
 *
 *   1. Every column landed, with the right type and nullability `[25 G]`.
 *   2. Every withdrawn thing is gone — warmth, tolerance, sales desk
 *      `[25 §6, §23, §35]`.
 *   3. `tasks` is unchanged, and `origin: 'system'` is still unwritten
 *      `[25 §19, §20]`.
 *   4. Every CHECK refuses **at the database** `[13 §1]`.
 *   5. The seeds: ten categories, nine loss reasons, and the read-only flag on
 *      exactly two roles `[25 §5, §28, §33]`.
 *   6. The seeds are idempotent.
 *   7. The outcome enum agrees with `enums.ts` at runtime `[25 §2]`.
 *   8. *** Nothing writes the new columns yet *** — plus what this pass
 *      deliberately does NOT enforce.
 *   9. The foreign keys point where they should.
 *  10. *** The writer and the CHECK agree *** `[25 §5]`.
 *
 * Usage: `npm run verify:schema25`
 *
 * That needs `NODE_ENV=development` in `.env`. `--env-file` is not optional and
 * cannot be replaced by the `process.loadEnvFile` call below: section 10
 * reaches `@/lib/authz`, and `src/auth/index.ts` reads `AUTH_SECRET` at module
 * scope — before any statement in this file runs.
 *
 * **It refuses to run outside development** `[15 §7]`: it writes real rows.
 *
 * It needs a seeded database — `npm run db:seed` — and the fixture accounts:
 * `DEV_FIXTURE_PASSWORD=… npm run dev:fixtures`.
 *
 * **Nothing is cleaned up** `[12 §7]`. Section 10's company and project carry
 * the run stamp in their names, which is also how section 8 tells this
 * script's own rows from everything else: without that, the second run would
 * find the first run's lost project and report that something writes
 * `lost_reason_id`.
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
  tasks,
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
import { ROLE_SEED } from "./seed/roles";

let failures = 0;

function check(label: string, condition: boolean, detail = ""): void {
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Assert that `fn` is allowed — the positive half section 10 turns on. */
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
  { key: "roles.sees_all_records_readonly", type: "boolean", nullable: false, defaultsFalse: true, cite: "25 §28" },
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

/** `tasks` gains nothing `[25 §20]` — the exact shape it already had. */
const TASK_COLUMNS = [
  "id",
  "title",
  "description",
  "origin",
  "assigned_to_user_id",
  "created_by_user_id",
  "record_type",
  "record_id",
  "due_date",
  "status",
  "completed_at",
  "system_trigger",
  "created_at",
];

/**
 * Every column this pass added, by the table it sits on, and what "unwritten"
 * means for it: null for a nullable column, `false` for a boolean that has a
 * default and therefore can never be null. Section 8.
 */
const NEW_COLUMNS: { table: string; column: string; boolean?: true }[] = [
  { table: "companies", column: "has_credit_terms", boolean: true },
  { table: "companies", column: "next_follow_up_at" },
  { table: "projects", column: "lost_reason_id" },
  { table: "projects", column: "lost_at" },
  { table: "projects", column: "loss_reason" },
  { table: "projects", column: "in_production", boolean: true },
  { table: "projects", column: "next_follow_up_at" },
  { table: "quotation_threads", column: "closed_at" },
  { table: "quotation_threads", column: "closed_by_user_id" },
  { table: "quotation_threads", column: "next_follow_up_at" },
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

  /* --- 2. Every withdrawn thing is gone [25 §6, §23, §35] ------------ */

  console.log("\n2. Warmth, tolerance and the sales desk are absent");

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

  /* --- 3. tasks is unchanged [25 §19, §20] --------------------------- */

  console.log("\n3. tasks gains nothing, and 'system' stays unwritten");

  const taskColumns = [...columns.keys()]
    .filter((key) => key.startsWith("tasks."))
    .map((key) => key.slice("tasks.".length))
    .sort();
  check(
    "tasks carries exactly the columns it already had [25 §20]",
    taskColumns.join(",") === [...TASK_COLUMNS].sort().join(","),
    `got ${taskColumns.join(", ")}`,
  );

  // The enum keeps `system` — `13 §2` keeps `form_factor` the same way — but
  // `21` and `25 §19` mean nothing may ever write it.
  const origins = (await db.execute(
    sql`select unnest(enum_range(null::task_origin))::text as value`,
  )) as unknown as { value: string }[];
  check(
    "task_origin still carries 'system', kept rather than dropped [13 §2]",
    origins.some((row) => row.value === "system"),
    `got ${origins.map((row) => row.value).join(", ")}`,
  );
  const [systemTasks] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(tasks)
    .where(eq(tasks.origin, "system"));
  check(
    "*** no task has origin 'system' *** [21], [25 §19]",
    systemTasks?.n === 0,
    `got ${systemTasks?.n}`,
  );

  /* --- 4. Every CHECK refuses at the database [13 §1] ---------------- */

  console.log("\n4. Every CHECK refuses at the database");

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
      lossReason: null,
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

  /* --- 5. The seeds [25 §5, §28, §33] -------------------------------- */

  console.log("\n5. The seeds");

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

  // The negative half is the point of `25 §28`: a third tier that four roles
  // already outrank would be a top-up, which is exactly what it is not.
  const wantsReadOnly = new Set(
    ROLE_SEED.filter((row) => row.seesAllRecordsReadonly).map(
      (row) => row.nameEn as string,
    ),
  );
  check(
    "the seed grants the read-only flag to exactly Super Admin and Sales Coordinator [25 §28]",
    wantsReadOnly.size === 2 &&
      wantsReadOnly.has("Super Admin") &&
      wantsReadOnly.has("Sales Coordinator"),
    `got ${[...wantsReadOnly].join(", ")}`,
  );
  for (const role of seededRoles) {
    check(
      `${role.nameEn}: sees_all_records_readonly = ${wantsReadOnly.has(role.nameEn)} [25 §28]`,
      role.seesAllRecordsReadonly === wantsReadOnly.has(role.nameEn),
      `got ${role.seesAllRecordsReadonly}`,
    );
  }
  check(
    "Sales Manager and Executive do NOT hold it — it is a tier, not a top-up [25 §28]",
    seededRoles
      .filter((row) => row.nameEn === "Sales Manager" || row.nameEn === "Executive")
      .every((row) => row.seesAllRecordsReadonly === false),
  );

  /* --- 6. The seeds are idempotent ----------------------------------- */

  console.log("\n6. A second seed run inserts nothing");

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

  /* --- 7. The enum agrees with the code at runtime [25 §2] ----------- */

  console.log("\n7. rep_report_outcome and enums.ts agree");

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

  /* --- 8. Nothing writes the new columns yet ------------------------- */

  console.log("\n8. *** Nothing writes the new columns yet ***");

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

  const [commentCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(comments);
  const [mentionCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(commentMentions);
  check("comments is empty", commentCount?.n === 0, `got ${commentCount?.n}`);
  check(
    "comment_mentions is empty",
    mentionCount?.n === 0,
    `got ${mentionCount?.n}`,
  );

  // A gap recorded in a script that runs is a gap that gets closed.
  console.log(
    "\n  NOT ASSERTED, on purpose — the screen slice owes these:\n" +
      "    · 'other' requires loss_reason and every other code forbids it\n" +
      "      [25 §5]. A CHECK cannot subquery loss_reasons to read the code\n" +
      "      behind a uuid, so it belongs in src/lib/projects.ts as a\n" +
      "      RuleError — with its own assertion here. Until then every loss\n" +
      "      carries 'other', so the rule is trivially true and untested.\n" +
      "    · 'lost requires a reason' at the DATABASE. assertLossReason holds\n" +
      "      it in the application layer today; projects_loss_state is\n" +
      "      deliberately one-way until the screen offers the nine.\n" +
      "    · Nothing READS the new columns either: authz.ts does not consult\n" +
      "      sees_all_records_readonly, so 25 §28's third tier is not live.",
  );

  /* --- 9. The foreign keys ------------------------------------------ */

  console.log("\n9. The foreign keys point where they should");

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

  /* --- 10. The writer and the CHECK agree [25 §5] -------------------- */

  console.log("\n10. *** The writer and the CHECK agree ***");

  const lostProject = await createProject(
    rep,
    {
      nameEn: `${stamp} lost project`,
      nameAr: null,
      sqmExpected: null,
      region: null,
      cityId: null,
      endState: "lost",
      lossReason: "The customer chose a cheaper supplier.",
    },
    [{ companyId: company.id, role: null, isBuyer: false }],
  );
  check(
    "*** creating a LOST project through src/lib/projects.ts succeeds *** [25 §5]",
    lostProject.endState === "lost",
  );
  check(
    "it carries the 'other' reason, because a typed reason IS an other reason [25 §5]",
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
      lossReason: "Delivery time was too long.",
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
    lossReason: "Delivery time was too long.",
  });
  check(
    "re-saving a lost project does not restamp lost_at [25 §5]",
    resaved.lostAt?.getTime() === beforeResave?.lostAt?.getTime(),
    `${beforeResave?.lostAt?.toISOString()} → ${resaved.lostAt?.toISOString()}`,
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
      lossReason: null,
    });
    if (won.lostReasonId !== null || won.lostAt !== null || won.lossReason !== null) {
      throw new Error(
        `left lost_reason_id=${won.lostReasonId} lost_at=${won.lostAt} loss_reason=${won.lossReason}`,
      );
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
