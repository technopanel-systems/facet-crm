/**
 * Empty every RECORD table and leave the system usable — `npm run db:clear`.
 * Session 55, for the founder's first-day pass: FACET with no data, every
 * record created by hand, met the way a customer meets it.
 *
 * ── WHAT SURVIVES ──────────────────────────────────────────────────────────
 *
 * Roles (and the permission flags they carry), the lookups (countries,
 * cities, categories, lead sources, loss reasons, the product and service
 * lookups, the notification types), the settings rows, the migration ledger,
 * and **one account** — the one named by `--keep <email>` or, failing that,
 * by `BOOTSTRAP_ADMIN_EMAIL`. Every other user goes, with their sessions,
 * and so does every role nobody is left holding that the seed did not name
 * (`verify:sharing` makes one per run). The kept account keeps its sessions,
 * so the browser that ran this is still signed in.
 *
 * ── WHAT GOES ──────────────────────────────────────────────────────────────
 *
 * Every table a person's work lands in — the same list `seed:demo` clears,
 * plus the calendar (`S94`) — in one `TRUNCATE`, so a table with a foreign
 * key into a listed one that is NOT itself listed refuses the whole
 * statement rather than losing rows in silence. The audit log goes too: it
 * is the record of work that no longer exists, and a first day has no
 * history.
 *
 * ── WHAT IT REFUSES ────────────────────────────────────────────────────────
 *
 * `db-reset.ts`'s guard shape, and one more. `NODE_ENV` must be exactly
 * `development` `[15 §7]`. The database's own name must be typed back on a
 * terminal, or `--yes` passed where there is none. **And the name must be
 * given explicitly** — `--database <name>` must equal `current_database()`
 * — so the command cannot be pointed at a database by a stale `.env` and
 * run against the wrong one: a production name never matches the flag a
 * developer typed for a scratch database, and a scratch flag never matches
 * production. Everything is checked before anything is touched.
 *
 * ── THE SUITE AFTER THIS ───────────────────────────────────────────────────
 *
 * **Most of the verify suite goes red on an empty database, and that is
 * expected.** Nearly every check asserts against seeded records and the
 * fixture accounts; `README` § *Day one* says how many survive. `npm run
 * seed:demo` restores the world and the suite goes green again.
 */

process.loadEnvFile(".env");

import { createInterface } from "node:readline/promises";

import { sql } from "drizzle-orm";

import { closeDatabase, db } from "@/db";

/** `seed:demo`'s record tables, plus the calendar `S94`. Order does not
 *  matter inside one TRUNCATE; the list is what matters. */
const RECORD_TABLES = [
  "audit_log",
  "notifications",
  "comment_mentions",
  "comments",
  "rep_report_signals",
  "rep_reports",
  "dispatch_lines",
  "dispatches",
  "quotation_service_lines",
  "quotation_lines",
  "quotation_versions",
  "quotation_threads",
  "company_removal_requests",
  "project_credit_splits",
  "record_shares",
  "project_companies",
  "projects",
  "contacts",
  "company_dormancy_reviews",
  "company_reps",
  "companies",
  "duplicate_flags",
  "non_duplicates",
  "targets",
  "company_targets",
  "attachments",
  "non_working_days",
] as const;

/** The seven roles `db:seed` names; any other role nobody holds is residue. */
const SEEDED_ROLES = [
  "Super Admin",
  "Executive",
  "Sales Manager",
  "Sales Coordinator",
  "Marketing",
  "Desk Rep",
  "Sales Rep",
];

function argValue(flag: string): string | null {
  const at = process.argv.indexOf(flag);
  if (at < 0) return null;
  const value = process.argv[at + 1];
  return value && !value.startsWith("--") ? value : null;
}

function rows<T>(result: unknown): T[] {
  // drizzle's `execute` returns the driver's row array for postgres-js.
  return result as T[];
}

async function confirm(databaseName: string): Promise<boolean> {
  if (process.argv.includes("--yes")) return true;
  if (!process.stdin.isTTY) {
    console.error(
      "db:clear empties every record table and needs confirmation.\n" +
        "  There is no terminal to ask on — pass --yes to confirm:\n" +
        `    npm run db:clear -- --database ${databaseName} --yes`,
    );
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(
      `This EMPTIES every record table in ${databaseName} — companies, projects,\n` +
        `quotations, dispatches, reports, the audit log — and deletes every account\n` +
        `but the one kept. It cannot be undone; \`npm run seed:demo\` rebuilds the\n` +
        `demo world afterwards.\n` +
        `Type the database name (${databaseName}) to continue: `,
    );
    return answer.trim() === databaseName;
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== "development") {
    console.error(
      "db:clear refuses to run outside development.\n" +
        `  NODE_ENV is ${process.env.NODE_ENV ?? "unset"}, and must be "development".`,
    );
    process.exit(1);
  }

  const [{ name: connected }] = rows<{ name: string }>(
    await db.execute(sql`select current_database() as name`),
  );
  const named = argValue("--database");
  if (!named) {
    console.error(
      "Name the database explicitly — the flag is the guard:\n" +
        `    npm run db:clear -- --database ${connected}`,
    );
    process.exit(1);
  }
  if (named !== connected) {
    console.error(
      `Refusing: --database ${named} but DATABASE_URL connects to ${connected}.\n` +
        "  Nothing was touched.",
    );
    process.exit(1);
  }

  const keepEmail = (argValue("--keep") ?? process.env.BOOTSTRAP_ADMIN_EMAIL ?? "")
    .trim()
    .toLowerCase();
  if (!keepEmail) {
    console.error(
      "Say which account survives — `--keep <email>`, or BOOTSTRAP_ADMIN_EMAIL in .env.\n" +
        "  Nothing was touched.",
    );
    process.exit(1);
  }
  const kept = rows<{ id: string; is_active: boolean; can_manage_users: boolean }>(
    await db.execute(sql`
      select u.id::text as id, u.is_active, r.can_manage_users
      from users u join roles r on r.id = u.role_id
      where lower(u.email) = ${keepEmail}
    `),
  );
  if (kept.length !== 1 || !kept[0].is_active) {
    console.error(
      `Refusing: ${keepEmail} is not an active account here. Nothing was touched.`,
    );
    process.exit(1);
  }
  if (!kept[0].can_manage_users) {
    // A first day with no way to create the second person is not usable `S10`.
    console.error(
      `Refusing: ${keepEmail} cannot manage users, so nobody could add the next account. Nothing was touched.`,
    );
    process.exit(1);
  }

  if (!(await confirm(connected))) {
    console.error("Cancelled — nothing was touched.");
    process.exit(1);
  }

  const countOf = async (table: string): Promise<number> =>
    Number(
      rows<{ n: string }>(
        await db.execute(sql`select count(*)::text as n from ${sql.identifier(table)}`),
      )[0]?.n ?? 0,
    );

  console.log(`\nClearing ${connected}, keeping ${keepEmail}`);
  const before = new Map<string, number>();
  for (const table of RECORD_TABLES) before.set(table, await countOf(table));
  const usersBefore = await countOf("users");
  const rolesBefore = await countOf("roles");

  await db.execute(
    sql`truncate table ${sql.join(
      RECORD_TABLES.map((t) => sql.identifier(t)),
      sql`, `,
    )} restart identity`,
  );

  const doomed = sql`select id from users where id <> ${kept[0].id}::uuid`;
  await db.execute(sql`delete from sessions where user_id in (${doomed})`);
  await db.execute(sql`delete from accounts where user_id in (${doomed})`);
  await db.execute(sql`delete from users where id in (${doomed})`);
  const seeded = sql.join(SEEDED_ROLES.map((name) => sql`${name}`), sql`, `);
  await db.execute(sql`
    delete from roles r
    where r.name_en not in (${seeded})
      and not exists (select 1 from users u where u.role_id = r.id)
  `);

  let cleared = 0;
  for (const table of RECORD_TABLES) {
    const after = await countOf(table);
    cleared += before.get(table) ?? 0;
    console.log(`  ${table.padEnd(26)} ${String(before.get(table)).padStart(6)} -> ${after}`);
  }
  console.log(`  ${"users".padEnd(26)} ${String(usersBefore).padStart(6)} -> ${await countOf("users")}`);
  console.log(`  ${"roles".padEnd(26)} ${String(rolesBefore).padStart(6)} -> ${await countOf("roles")}`);
  console.log(
    `\nCleared ${cleared} record rows. Roles, lookups, settings and ${keepEmail} remain.\n` +
      "Most of the verify suite is now RED by design — every check asserts against\n" +
      "seeded records. `npm run seed:demo` rebuilds the demo world and the suite\n" +
      "goes green again (README § Day one).",
  );
}

main()
  .then(async () => {
    await closeDatabase();
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await closeDatabase();
    process.exit(1);
  });
