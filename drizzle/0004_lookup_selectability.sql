-- 0004 — lookup values gain the two columns `docs/15-lookup-decisions.md` §6
-- needs before cities and lead sources can be seeded at all.
--
-- `cities.region` is NOT NULL with no default `[15 §3]`: every city is mapped,
-- the grouping is stated per administrative region rather than per city, and a
-- region-less row would be one `15 §4` cannot derive a record's region from.
-- Safe without a backfill only because `cities` has never been seeded — it
-- shipped empty in Slice 1 because no document listed a city `[14]`. This
-- statement fails loudly on any database where someone has since added one,
-- which is the correct outcome: that row needs a region before it can proceed.
--
-- `lead_sources.rep_selectable` defaults true `[15 §2]` so the column describes
-- the ordinary case and "marketing" is the single exception. Restricting a
-- source is configuration, never a code path.

ALTER TABLE "cities" ADD COLUMN "region" "region" NOT NULL;--> statement-breakpoint
ALTER TABLE "lead_sources" ADD COLUMN "rep_selectable" boolean DEFAULT true NOT NULL;
