/**
 * Seed the `notification_types` lookup `21 §2` enumerates.
 * `npm run db:seed:notifications`, or `npm run db:seed` for these plus roles,
 * lookups and settings.
 *
 * **Insert if absent, and never overwrite.** Same rule as `seed-settings.ts`,
 * and it now guards only the two names: `10 §10` keeps the type a lookup so a
 * label can be corrected in the database, and a seed run that reset one would
 * undo that without saying so.
 *
 * **There is nothing else left to overwrite.** `tier` and `is_persistent` went
 * with `S91` in `0033`, and the channel went with `0027` — every row said
 * `in_app` and the column reading it existed only to stamp a second column
 * nothing read. Three settable values became none.
 *
 * **Nothing is deleted HERE, and `0033` is not a counter-example.** A type that
 * stops being produced keeps its row, because notifications already raised
 * point at it `[12 §7]` — that is why this loop has no delete branch. `S91`
 * removing `followup.digest` is a rule retiring a type, which is a migration's
 * business and takes the nine rows with it; a seed run must never make that
 * decision on its own.
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
