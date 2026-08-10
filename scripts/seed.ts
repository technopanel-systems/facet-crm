/**
 * Seed everything `12 §14` asks for after the migration: the seven roles
 * `[12 §2, §3]`, the company categories `[12 §4]` and the product lookups
 * `[08 B1]` — plus, since `20 §11`, the two follow-up thresholds coverage
 * reads. `npm run db:seed`.
 *
 * Safe to run on an existing database — every step is idempotent, and none of
 * them deletes. The settings step additionally never overwrites: those values
 * are data precisely so a manager can change them.
 */

process.loadEnvFile(".env");

import { closeDatabase } from "@/db";

import { seedLookups } from "./seed-lookups";
import { seedRoles } from "./seed-roles";
import { seedSettings } from "./seed-settings";

async function main(): Promise<void> {
  console.log("Roles:");
  await seedRoles();
  console.log("Lookups:");
  await seedLookups();
  console.log("Settings:");
  await seedSettings();
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
