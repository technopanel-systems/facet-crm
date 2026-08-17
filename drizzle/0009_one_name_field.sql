-- 0009 — S12, S19: one name field on companies and contacts.
--
-- Hand-merged after `drizzle-kit generate`, per drizzle.config.ts's
-- strict: true — migrations are reviewed, never left as drizzle-kit decided
-- them. Each table both gains `name` and loses `name_en`, which is the
-- created-or-renamed prompt drizzle-kit cannot ask without a TTY. Generated
-- as two passes (the drops, then the add) and merged here as a RENAME: the
-- generated `ADD COLUMN "name" text NOT NULL` would have discarded every
-- existing name, and would have failed outright against a non-empty table.
--
-- `name_ar` is dropped outright. At the time of writing 2 of 90 companies
-- and 0 of 10 contacts carried an Arabic name distinct from the English one,
-- both written by a verify script; no row typed by a person had one. S23
-- makes phone the primary matching key, so the second name column no longer
-- earns its cost.
--
-- `name_normalized` needs no backfill: it is already normalizeName(name_en)
-- for every row, and the rename leaves that value correct.
ALTER TABLE "companies" RENAME COLUMN "name_en" TO "name";--> statement-breakpoint
ALTER TABLE "companies" DROP COLUMN "name_ar";--> statement-breakpoint
ALTER TABLE "contacts" RENAME COLUMN "name_en" TO "name";--> statement-breakpoint
ALTER TABLE "contacts" DROP COLUMN "name_ar";
