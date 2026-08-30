/**
 * Deactivate every account a verify script has ever left behind — `S111`.
 *
 * **`S111` forbids deleting a person and names deactivation as the end state
 * instead.** *Accounts deactivate, never delete. History must keep pointing at
 * a real person.* So this script never removes a row: it sets `is_active` to
 * false and stamps `deactivated_at`, which is exactly what `deactivateUser`
 * writes and exactly what `listActiveUsers` filters on.
 *
 * **Why it exists.** The kept verify scripts create their own accounts and used
 * to leave every one of them active. Each of the seven that creates users now
 * ends its own in a `finally`, but that only stops the next run adding more;
 * the accounts already in a development database need a repeatable way out.
 * They were reachable from every mention picker on every comment box, from the
 * share recipient picker, from the dispatch rep picker, and from every
 * achievement roster — 196 invented colleagues offered beside nine real ones.
 *
 * **What it matches, and what it cannot touch.** Every verify account is
 * `<prefix>-<epoch-ms>-<slug>@example.test`, so the pattern is anchored on both
 * halves of that stamp. The nine real accounts — the four `dev:fixtures` reps,
 * the manager, the coordinator, the executive, the demo admin and the founder's
 * own — match none of it. Verified against the live database before this was
 * written: the pattern selected 231 rows and every one of them was a verify
 * account.
 *
 * **A direct `update`, not `deactivateUser`.** The data-layer writer would
 * write an audit row per account `S112`. This is maintenance on a development
 * database's own scaffolding, not a mutation of a record anybody keeps, and
 * 231 audit rows to clean up residue would be the same defect in a second
 * table.
 *
 * **It does not clear sessions either, and the reason has narrowed.** It used
 * to be that no verify account had one: they all build an `AuthSession` in
 * process and never sign in. **One now does** — `verify:routes` §30 creates a
 * subject, signs it in over HTTP and reads the `sessions` row that login
 * wrote, because that row is the auth bridge `CLAUDE.md` warns fails silently.
 * That section deactivates its own subject before it ends, and deactivation
 * deletes the row in the same transaction `S101`, so there is still nothing
 * here to clear — and a writer with nothing to write is unused structure. If
 * §30 ever dies between the login and the deactivation, the row it leaves
 * belongs to an account this script switches off, and a session on an
 * inactive account is refused on its next request anyway.
 *
 * Idempotent. A second run reports the same figures and updates nothing.
 *
 * Usage: `npm run cleanup:verify`.
 */

process.loadEnvFile(".env");

import { and, eq, sql } from "drizzle-orm";

import { closeDatabase, db } from "@/db";
import { users } from "@/db/schema";

/**
 * `<prefix>-<epoch-ms>-` — the stamp every verify script builds its emails
 * from. Both halves are anchored deliberately: `verify%` alone would also
 * match a real person whose address happened to start with the word.
 *
 * One table, no join, so the Drizzle column renders bare and resolves against
 * `users` — the qualifier trap `CLAUDE.md` records needs a correlated subquery
 * to bite. Named outright anyway, because that is the convention.
 */
const VERIFY_ACCOUNT = sql`${users.email} ~ '^verify[0-9a-z]*-[0-9]{10,13}-'`;

async function census(): Promise<{
  total: number;
  active: number;
  verify: number;
  verifyActive: number;
}> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${users.isActive})::int`,
      verify: sql<number>`count(*) filter (where ${VERIFY_ACCOUNT})::int`,
      verifyActive: sql<number>`count(*) filter (where ${VERIFY_ACCOUNT} and ${users.isActive})::int`,
    })
    .from(users);
  return row;
}

function report(label: string, counted: Awaited<ReturnType<typeof census>>) {
  console.log(
    `  ${label.padEnd(7)} ${counted.total} accounts · ${counted.active} active` +
      ` · ${counted.verify} verify · ${counted.verifyActive} verify AND active`,
  );
}

async function main(): Promise<void> {
  // It writes to the `users` table. It must never be runnable anywhere but a
  // developer's machine `[15 §7]` — the same guard, and the same reasoning, as
  // `dev:fixtures` and every verify script.
  if (process.env.NODE_ENV !== "development") {
    console.error(
      "cleanup:verify refuses to run outside development.\n" +
        `  NODE_ENV is ${process.env.NODE_ENV ?? "unset"}, and must be "development".`,
    );
    process.exit(1);
  }

  const before = await census();
  report("before", before);

  const ended = await db
    .update(users)
    .set({ isActive: false, deactivatedAt: new Date() })
    .where(and(VERIFY_ACCOUNT, eq(users.isActive, true)))
    .returning({ id: users.id });

  const after = await census();
  report("after", after);
  console.log(`\n  ${ended.length} account(s) deactivated [S111]`);

  // The assertion, not a log line: what this script is for is that no verify
  // account is left offerable, and that it took none of the nine real ones
  // with it.
  if (after.verifyActive !== 0) {
    throw new Error(
      `${after.verifyActive} verify account(s) are still active — the pattern missed them.`,
    );
  }
  if (after.active !== before.active - ended.length) {
    throw new Error(
      `the active count moved by ${before.active - after.active}, not ${ended.length}.`,
    );
  }
  console.log(
    `  ${after.active} account(s) still active — every one of them real.`,
  );
}

main()
  .then(async () => {
    await closeDatabase();
  })
  .catch(async (error) => {
    console.error(error);
    await closeDatabase();
    process.exit(1);
  });
