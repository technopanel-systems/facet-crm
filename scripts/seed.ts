/**
 * Seed everything `12 §14` asks for after the migration: the seven roles
 * `[12 §2, §3]`, the company categories `[12 §4]` and the product lookups
 * `[08 B1]`. `npm run db:seed`.
 *
 * Safe to run on an existing database — every step is idempotent, and none of
 * them deletes.
 */

process.loadEnvFile(".env");

import { closeDatabase } from "@/db";

import { seedLookups } from "./seed-lookups";
import { seedRoles } from "./seed-roles";

async function main(): Promise<void> {
  console.log("Roles:");
  await seedRoles();
  console.log("Lookups:");
  await seedLookups();
}

main()
  .then(async () => {
    console.log("Seed complete.");
    await closeDatabase();
  })
  .catch(async (error) => {
    console.error(error);
    await closeDatabase();
    process.exit(1);
  });
