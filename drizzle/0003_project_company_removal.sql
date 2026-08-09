-- 0003 — project–company links can be removed `docs/14-slice1-decisions.md` §4.
--
-- Removal is soft, like every other state change in FACET `[09 §1]`: the row
-- is kept and hidden. Both unique indexes become partial on `removed_at is
-- null` `[14 §5]` — otherwise a removed company could never be re-linked, and
-- a removed buyer row would permanently block naming a new buyer.
--
-- Statement order matters: the indexes are dropped before the column is added
-- so nothing recreates an index over a column that does not exist yet.

DROP INDEX "project_companies_key";--> statement-breakpoint
DROP INDEX "project_companies_one_buyer_key";--> statement-breakpoint
ALTER TABLE "project_companies" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "project_companies_key" ON "project_companies" USING btree ("project_id","company_id") WHERE removed_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "project_companies_one_buyer_key" ON "project_companies" USING btree ("project_id") WHERE is_buyer and removed_at is null;