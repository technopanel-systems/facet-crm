/**
 * Seed the `notification_types` lookup `21 §2` enumerates.
 * `npm run db:seed:notifications`, or `npm run db:seed` for these plus roles,
 * lookups and settings.
 *
 * **Insert if absent, and never overwrite.** Same rule as `seed-settings.ts`,
 * for the same reason: `10 §10` makes the tier, channel and persistence data
 * precisely so they can be changed, and a seed run that quietly reset
 * `is_persistent` would undo that without saying so.
 *
 * Nothing is deleted either — a type that stops being produced keeps its row,
 * because notifications already raised point at it `[12 §7]`.
 */

process.loadEnvFile(".env");

import { eq } from "drizzle-orm";

import { closeDatabase, db } from "@/db";
import { notificationTypes } from "@/db/schema";

import { NOTIFICATION_TYPE_SEED } from "./seed/notification-types";

export async function seedNotificationTypes(): Promise<void> {
  let inserted = 0;
  let kept = 0;

  for (const row of NOTIFICATION_TYPE_SEED) {
    const [existing] = await db
      .select({ id: notificationTypes.id })
      .from(notificationTypes)
      .where(eq(notificationTypes.key, row.key))
      .limit(1);

    if (existing) {
      kept += 1;
      continue;
    }

    await db.insert(notificationTypes).values({
      key: row.key,
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      tier: row.tier,
      // `04 Q17, C3` — in-app is still the only working channel.
      defaultChannel: "in_app",
      isPersistent: row.isPersistent,
    });
    inserted += 1;
  }

  console.log(
    `  notification types: ${inserted} inserted, ${kept} left as they are`,
  );
}

// Run directly — also imported by scripts/seed.ts.
if (
  process.argv[1]?.replace(/\\/g, "/").endsWith("seed-notification-types.ts")
) {
  seedNotificationTypes()
    .then(async () => {
      await closeDatabase();
    })
    .catch(async (error) => {
      console.error(error);
      await closeDatabase();
      process.exit(1);
    });
}
