-- 0033 — S91, S92, AUDIT 1 E2: the list is the notification.
--
-- **S91 deletes four things and this is the schema half of it.** *"There are no
-- notification tiers, no persistence flags, no per-anchor resolution conditions
-- and no daily digest."* The code half — `sweepNotifications`, its two resolve
-- steps, `generateDigests` and `RESOLUTION_RULES` — comes out in the same slice
-- (WORKFLOW §7: when a rule replaces an old mechanism, the old mechanism leaves
-- with it). S92 keeps a bell carrying news only, and **its six types survive
-- untouched**; only `followup.digest` goes, which is the one that ever carried
-- work rather than news.
--
-- Counted before generating, on the development database, 29 Aug 2026:
--
--   select nt.key, count(*) from notifications n
--     join notification_types nt on nt.id = n.notification_type_id group by 1;
--   -- credit.granted 2 | decision.ended_work 61 | followup.digest 9
--   -- mention.received 3 | share.granted 14
--
--   select count(*) from notifications where resolved_at is not null;   -- 7
--   select count(*) from notifications where digest_date  is not null;  -- 9
--
-- The nine doomed rows are exactly the nine carrying `digest_date`, which is
-- what a digest row is. §7 settles them: there is no production data, so a
-- migration clears rather than preserves. Nothing is backfilled or merged.
--
-- **`resolved_at` goes because nothing would write it.** The sweep was its only
-- writer. Left in place, `resolved_at is null` would be true of every row for
-- ever, and the badge query reading it could never reach zero — the
-- undismissable badge `07 G1` invented persistence to avoid, arrived at by
-- deleting the machinery meant to prevent it. The badge now counts UNREAD, and
-- `read_at` stays: reading is the only disposal a bell has.
--
-- **Both partial unique indexes go with the columns their predicates read.**
-- `notifications_digest_key` was one digest per recipient per day;
-- `notifications_live_key` was one live persistent row per anchor, which was
-- what made re-deriving on every sweep idempotent. There is no sweep, and news
-- does not deduplicate — a second refusal is a second thing that happened. They
-- are dropped explicitly rather than left to fall out of DROP COLUMN, so the
-- statement list says what is going.
--
-- **AUDIT 1 E2 rides along, in the one migration that touches this table.**
-- `record_type`/`record_id` is the only nullable pair in the schema with no
-- pairing CHECK where three identically-shaped pairs each have one, and
-- `notifications/page.tsx` reached for `?? "company"` and `?? ""` to render
-- around a row the database allowed to be half-filled. Gated before generating,
-- not assumed:
--
--   select count(*) from notifications
--    where (record_type is null) <> (record_id is null);   -- 0
--
-- **0024's enum-rebuild trap does not apply.** `record_type` is untouched and
-- keeps all five values; nothing here casts a column to text. `notification_tier`
-- IS dropped, but it is dropped whole after its one column goes, not rebuilt,
-- so no CHECK anywhere holds a literal already resolved to it.
--
-- **The order is load-bearing.** Notifications before their type row, for the
-- foreign key. Indexes before the columns their predicates read. The type after
-- its last column. The CHECK last, against a table that has stopped changing.
DELETE FROM "notifications"
 WHERE "notification_type_id" IN (
   SELECT "id" FROM "notification_types" WHERE "key" = 'followup.digest'
 );
--> statement-breakpoint
DELETE FROM "notification_types" WHERE "key" = 'followup.digest';
--> statement-breakpoint
DROP INDEX "notifications_digest_key";
--> statement-breakpoint
DROP INDEX "notifications_live_key";
--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "digest_date";
--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "resolved_at";
--> statement-breakpoint
ALTER TABLE "notification_types" DROP COLUMN "tier";
--> statement-breakpoint
ALTER TABLE "notification_types" DROP COLUMN "is_persistent";
--> statement-breakpoint
DROP TYPE "public"."notification_tier";
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_record_pair"
  CHECK ((record_type is null) = (record_id is null));
