/**
 * Seed the `settings` rows `20 §11` asks for — the two quiet thresholds the
 * coverage screen reads, with `07 D5`'s published defaults.
 * `npm run db:seed:settings`, or `npm run db:seed` for these plus roles and
 * lookups.
 *
 * **Insert if absent, and never overwrite.** Every other seeder corrects a
 * value that has drifted from the seed file; this one must not. The whole
 * reason `07 D5` makes these data rather than code is that a manager changes
 * them, and a seed run that quietly reset the number to 30 would undo that
 * without saying so.
 *
 * Only two of `07 D5`'s five thresholds are here. The other three chase
 * quotations, catalogues and stalled projects — Phase 10's work `[20 §11]`.
 * Seeding them now would leave three rows nothing reads, which is the shape of
 * v1's dead approval gate.
 */

process.loadEnvFile(".env");

import { eq } from "drizzle-orm";

import { closeDatabase, db } from "@/db";
import { settings } from "@/db/schema";
import {
  QUIET_DAYS_QUALIFIED_DEFAULT,
  QUIET_DAYS_QUALIFIED_KEY,
  QUIET_DAYS_UNQUALIFIED_DEFAULT,
  QUIET_DAYS_UNQUALIFIED_KEY,
} from "@/lib/settings";

const SETTING_SEED: { key: string; value: unknown }[] = [
  { key: QUIET_DAYS_QUALIFIED_KEY, value: QUIET_DAYS_QUALIFIED_DEFAULT },
  { key: QUIET_DAYS_UNQUALIFIED_KEY, value: QUIET_DAYS_UNQUALIFIED_DEFAULT },
];

export async function seedSettings(): Promise<void> {
  let inserted = 0;
  let kept = 0;

  for (const row of SETTING_SEED) {
    const [existing] = await db
      .select({ key: settings.key })
      .from(settings)
      .where(eq(settings.key, row.key))
      .limit(1);

    if (existing) {
      kept += 1;
      continue;
    }
    await db.insert(settings).values(row);
    inserted += 1;
  }

  console.log(`  settings: ${inserted} inserted, ${kept} left as they are`);
}

// Run directly (tsx scripts/seed-settings.ts) — also imported by scripts/seed.ts.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("seed-settings.ts")) {
  seedSettings()
    .then(async () => {
      await closeDatabase();
    })
    .catch(async (error) => {
      console.error(error);
      await closeDatabase();
      process.exit(1);
    });
}
