/**
 * Verification scaffolding — NOT a feature.
 *
 * Slice 1 has no user-management screen (Phase 11) and no sharing screen
 * (`07 B1`), but its central rule — a shared company does not expose its
 * projects `[04 Q7]` — cannot be checked with one account. This script creates
 * the accounts that checking it requires, and nothing else.
 *
 * Creates two Sales Reps and one Sales Manager, all idempotent by email:
 *
 *   rep-a@example.test    Sales Rep       (sees_all_reps = false)
 *   rep-b@example.test    Sales Rep       (sees_all_reps = false)
 *   manager@example.test  Sales Manager   (sees_all_reps = true)
 *
 * Usage: `npm run dev:fixtures`, with `DEV_FIXTURE_PASSWORD` in `.env`.
 *
 * The password comes from the environment deliberately — a default baked into
 * the repository would be a known credential on every checkout, and these are
 * real, loginable accounts.
 *
 * **Idempotent by email, but the password is re-applied every run** — this
 * script is the one way to set it. It used to skip an existing account
 * entirely, which meant that once the four fixtures were created their
 * password could never be changed by re-running it; stage 2 lost the original
 * and had to reset the hashes with a throwaway script `[23]`. Nothing else is
 * touched: name, email and role are left exactly as they are, because a rep
 * whose role was changed by hand for a test should stay changed.
 *
 * **It refuses to run unless NODE_ENV is exactly "development"** `[15 §7]`.
 * Refusing only when NODE_ENV=production is set is the weaker half of the
 * rule: it passes whenever the variable is simply absent, which is every
 * shell that has not been told otherwise. Requiring the positive value is safe
 * because the two environments genuinely differ —
 *
 *   - `.dockerignore` excludes `.env*`, so `NODE_ENV=development` in a
 *     developer's `.env` never reaches the image;
 *   - `docker-compose.yml` sets `NODE_ENV: production` on the app container as
 *     a real environment variable, and `process.loadEnvFile` cannot override
 *     one that is already set.
 *
 * So the guard passes on a developer's host and fails in the container.
 */

process.loadEnvFile(".env");

import { eq } from "drizzle-orm";

import { closeDatabase, db } from "@/db";
import { roles, users } from "@/db/schema";
import { withAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/passwords";

const FIXTURES = [
  { name: "Rep A", email: "rep-a@example.test", role: "Sales Rep" },
  { name: "Rep B", email: "rep-b@example.test", role: "Sales Rep" },
  { name: "Manager", email: "manager@example.test", role: "Sales Manager" },
  // Slice 2: the quotation chain hands off between a rep and the coordinator
  // `[04 flow 6–11]`, and `can_approve_quotation` cannot be exercised without
  // an account that holds it.
  {
    name: "Coordinator",
    email: "coordinator@example.test",
    role: "Sales Coordinator",
  },
] as const;

async function main(): Promise<void> {
  // This script creates real, loginable accounts. It must never be runnable
  // anywhere but a developer's machine `[15 §7]`.
  if (process.env.NODE_ENV !== "development") {
    console.error(
      "dev:fixtures refuses to run outside development.\n" +
        `  NODE_ENV is ${process.env.NODE_ENV ?? "unset"}, and must be "development".\n` +
        "  Add NODE_ENV=development to .env (it is excluded from the Docker image).",
    );
    process.exit(1);
  }

  const password = process.env.DEV_FIXTURE_PASSWORD;
  if (!password || password.length < 8) {
    console.error(
      "Set DEV_FIXTURE_PASSWORD (8+ characters) in the environment, e.g.\n" +
        '  DEV_FIXTURE_PASSWORD="…" npm run dev:fixtures',
    );
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  for (const fixture of FIXTURES) {
    const [role] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.nameEn, fixture.role))
      .limit(1);
    if (!role) {
      throw new Error(`Role "${fixture.role}" missing — run npm run db:seed`);
    }

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, fixture.email))
      .limit(1);
    if (existing) {
      // Re-apply the password and nothing else. Audited like every other
      // system-run mutation, with the hash itself never written to the log.
      await withAudit({ actorUserId: null, actingAsUserId: null }, async (tx, log) => {
        await tx
          .update(users)
          .set({ passwordHash })
          .where(eq(users.id, existing.id));
        log({
          action: "user.password_reset",
          entityType: "user",
          entityId: existing.id,
          after: { email: fixture.email },
        });
      });
      console.log(`  ${fixture.email} exists — password re-applied`);
      continue;
    }

    // Audited with a null actor, like every other system-run mutation.
    await withAudit({ actorUserId: null, actingAsUserId: null }, async (tx, log) => {
      const [user] = await tx
        .insert(users)
        .values({
          name: fixture.name,
          email: fixture.email,
          roleId: role.id,
          passwordHash,
        })
        .returning();
      log({
        action: "user.created",
        entityType: "user",
        entityId: user.id,
        after: { name: user.name, email: user.email, roleId: user.roleId },
      });
    });
    console.log(`  created ${fixture.email} (${fixture.role})`);
  }
}

main()
  .then(async () => {
    console.log("Fixtures ready.");
    await closeDatabase();
  })
  .catch(async (error) => {
    console.error(error);
    await closeDatabase();
    process.exit(1);
  });
