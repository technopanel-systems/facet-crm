-- 0006 — follow-ups and notifications `docs/21-phase10a-decisions.md` §10.
--
-- Almost nothing, deliberately. `09 §9` reserved `notifications` and
-- `notification_types` in migration 0000 with the tier, channel and
-- `is_persistent` columns `10 §10` and `07 G1` specified, and nothing has ever
-- written either table. What Phase 10a was missing was the data and the code,
-- not the schema. Four additions, each traceable to one statement in `21`:
--
--  1. `notifications.payload` — the ICU variables a summary message needs
--     `[21 §5]`. Used by exactly one type: a handover raises ONE notification
--     naming the departing rep and the counts rather than one per record, and
--     this table has no title or body column by design.
--  2. `notifications.digest_date` + `notifications_digest_key` — one digest per
--     recipient per day however many times the sweep runs. A stored column
--     rather than an expression index because
--     `(created_at AT TIME ZONE 'Asia/Riyadh')::date` is STABLE, not IMMUTABLE,
--     and Postgres will not index it.
--  3. `notifications_live_key` — a persistent notification is raised at most
--     once while unresolved `[07 G1]`. This is what lets the sweep re-derive on
--     every read without duplicating: the raise is `on conflict do nothing`.
--  4. `company_dormancy_reviews` — `07 E6`'s three routes as dated rows
--     `[21 §7]`, not a mutable `suppressed_until` column on the company. One
--     CHECK, per `13 §1`: the recipient is present exactly when the outcome is
--     `reassigned`.
--
-- **`record_type` is not widened.** The handover summary anchors to nothing and
-- carries the departing rep in `payload`, so a shared enum used by
-- `record_shares`, `tasks` and `activities` is not extended for one row type —
-- and `ALTER TYPE ... ADD VALUE` inside a migration transaction is avoided.
--
-- No new permission flag: `can_assign` covers dormancy `[21 §6]` and the two
-- new screens are scoped rather than gated `[21 §9]`.
--
-- `companies.archived_at` is untouched. It has existed since 0000, is read in
-- three places, and has never been written by anything; `archiveCompany` is its
-- first writer.

CREATE TYPE "public"."dormancy_outcome" AS ENUM('reincluded', 'reassigned', 'archived');--> statement-breakpoint
CREATE TABLE "company_dormancy_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"outcome" "dormancy_outcome" NOT NULL,
	"decided_by_user_id" uuid NOT NULL,
	"to_user_id" uuid,
	"note" text,
	"decided_at" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_dormancy_reviews_recipient" CHECK ((outcome = 'reassigned') = (to_user_id is not null))
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "payload" jsonb;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "digest_date" date;--> statement-breakpoint
ALTER TABLE "company_dormancy_reviews" ADD CONSTRAINT "company_dormancy_reviews_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_dormancy_reviews" ADD CONSTRAINT "company_dormancy_reviews_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_dormancy_reviews" ADD CONSTRAINT "company_dormancy_reviews_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_dormancy_reviews_company_idx" ON "company_dormancy_reviews" USING btree ("company_id","decided_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_digest_key" ON "notifications" USING btree ("recipient_user_id","notification_type_id","digest_date") WHERE "notifications"."digest_date" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_live_key" ON "notifications" USING btree ("recipient_user_id","notification_type_id","record_type","record_id") WHERE "notifications"."resolved_at" is null and "notifications"."record_id" is not null;