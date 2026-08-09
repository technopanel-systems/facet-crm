/**
 * Seed the seven roles `[12 §2]`. Idempotent: upserts on `roles_name_en_key`,
 * so a re-run corrects flag values and never duplicates.
 * `npm run db:seed:roles`, or `npm run db:seed` for roles plus lookups.
 */

process.loadEnvFile(".env");

import { closeDatabase, db } from "@/db";
import { roles } from "@/db/schema";

import { ROLE_SEED } from "./seed/roles";

export async function seedRoles(): Promise<void> {
  for (const role of ROLE_SEED) {
    const { nameEn, ...rest } = role;
    await db
      .insert(roles)
      .values(role)
      .onConflictDoUpdate({ target: roles.nameEn, set: rest });
    console.log(`  upserted role: ${nameEn}`);
  }
}

// Run directly (tsx scripts/seed-roles.ts) — also imported by bootstrap.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("seed-roles.ts")) {
  seedRoles()
    .then(async () => {
      console.log(`Seeded ${ROLE_SEED.length} roles.`);
      await closeDatabase();
    })
    .catch(async (error) => {
      console.error(error);
      await closeDatabase();
      process.exit(1);
    });
}
