/**
 * One-off bootstrap: create the first super admin. `npm run bootstrap:admin`.
 *
 * Reads BOOTSTRAP_ADMIN_NAME / _EMAIL / _PASSWORD from the environment
 * (documented in .env.example; env vars rather than CLI args so the password
 * never lands in shell history). Idempotent: seeds the roles, then creates
 * the admin only if that email does not exist — it never overwrites an
 * existing user or password. The creation is audited with a null actor
 * (system), like any other data-layer mutation.
 */

process.loadEnvFile(".env");

import { eq } from "drizzle-orm";

import { closeDatabase, db } from "@/db";
import { roles, users } from "@/db/schema";
import { withAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/passwords";

import { seedRoles } from "./seed-roles";
import { SUPER_ADMIN_NAME_EN } from "./seed/roles";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(
      `Missing ${name}. Set BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL and ` +
        `BOOTSTRAP_ADMIN_PASSWORD in .env (see .env.example), run this once, ` +
        `then remove them.`,
    );
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const name = requiredEnv("BOOTSTRAP_ADMIN_NAME");
  const email = requiredEnv("BOOTSTRAP_ADMIN_EMAIL").trim().toLowerCase();
  const password = requiredEnv("BOOTSTRAP_ADMIN_PASSWORD");
  if (password.length < 8) {
    console.error("BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  console.log("Seeding roles…");
  await seedRoles();

  const [superAdminRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.nameEn, SUPER_ADMIN_NAME_EN))
    .limit(1);
  if (!superAdminRole) {
    throw new Error(`Role "${SUPER_ADMIN_NAME_EN}" missing after seed`);
  }

  const [existing] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) {
    console.log(`User ${email} already exists — nothing to do.`);
    return;
  }

  const passwordHash = await hashPassword(password);
  const created = await withAudit(
    { actorUserId: null, actingAsUserId: null },
    async (tx, log) => {
      const [user] = await tx
        .insert(users)
        .values({ name, email, roleId: superAdminRole.id, passwordHash })
        .returning();
      log({
        action: "user.created",
        entityType: "user",
        entityId: user.id,
        after: { name: user.name, email: user.email, roleId: user.roleId },
      });
      return user;
    },
  );
  console.log(`Created super admin ${created.email} (${created.id}).`);
  console.log("Remove the BOOTSTRAP_ADMIN_* lines from .env now.");
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
