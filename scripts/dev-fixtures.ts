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
 * Usage: `DEV_FIXTURE_PASSWORD=... npm run dev:fixtures`
 *
 * The password comes from the environment deliberately — a default baked into
 * the repository would be a known credential on every checkout, and these are
 * real, loginable accounts. Refuses to run against NODE_ENV=production.
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
] as const;

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    console.error("dev:fixtures refuses to run with NODE_ENV=production.");
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
      console.log(`  ${fixture.email} already exists`);
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
