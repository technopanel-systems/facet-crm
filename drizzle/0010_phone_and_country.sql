-- 0010 — S13, S14: phone is mandatory, and a company carries a country.
--
-- Hand-merged after `drizzle-kit generate`, per drizzle.config.ts's
-- strict: true — migrations are reviewed, never left as drizzle-kit decided
-- them. Two of its statements would have failed outright:
--
--   ALTER TABLE "companies" ADD COLUMN "country_id" uuid NOT NULL;
--
-- has no default and no backfill, so Postgres refuses it on any table with a
-- row in it. The order below is the working one: add the column nullable,
-- point every existing row at Saudi Arabia, and only then make it NOT NULL.
--
-- Saudi Arabia is INSERTed here rather than left to `db:seed:lookups`, because
-- the backfill needs a row to point at and a migration cannot call a seed
-- script. `seedCountries` keys on `code`, finds this row and leaves it alone;
-- the other eight arrive with the seed.
--
-- **S13's null phones were cleared, not backfilled.** At the time of writing
-- 135 of 135 companies had a null phone, and all 135 were written by verify
-- scripts that did not set one — no row typed by a person existed. The scripts
-- were fixed first and the database rebuilt from `db:reset`, so this migration
-- ran against a table that already satisfied the constraint. A placeholder
-- number was deliberately NOT written: S23 makes phone the primary matching
-- key, so one fake value repeated across rows would make unrelated companies
-- duplicates of each other — worse than the null it replaced.
--
-- That means the ALTER below **refuses to run against any database still
-- holding a null phone**, loudly and before anything else changes. That is the
-- intended behaviour. Clear or fill those rows first; do not add a default.
--
-- S15 is unchanged and stays Saudi-only: `city_id` and `region` are still
-- nullable, and are null for every company whose country is not Saudi Arabia.
-- The application layer enforces that (`placeForCountry`), because it is a
-- rule about which of two rows is chosen, not an invariant a CHECK can state
-- without subquerying `countries` for a code.
CREATE TABLE "countries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "countries_code_key" ON "countries" USING btree ("code");--> statement-breakpoint
INSERT INTO "countries" ("code", "name_en", "name_ar") VALUES ('SA', 'Saudi Arabia', 'السعودية');--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "country_id" uuid;--> statement-breakpoint
UPDATE "companies" SET "country_id" = (SELECT "id" FROM "countries" WHERE "code" = 'SA');--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "country_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "phone" SET NOT NULL;
