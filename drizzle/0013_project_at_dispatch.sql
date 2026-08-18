-- 0013 — S50: a quotation may exist with or without a project.
--         S74: the project is recorded on the dispatch itself.
--
-- The two are one migration because neither works alone. S74's second branch
-- — the coordinator choosing a project for a quotation that has none — has
-- nothing to act on while `quotation_threads.project_id` is `not null`, and a
-- project-less quotation with nowhere to gain a project would be a dead end.
--
-- **`dispatches.project_id` is nullable and stays that way.** S75's direct
-- route may still name no project, and its stated-purpose half is not built.
-- Where there IS a quotation the column always equals that quotation's project
-- — a pair spanning two rows, which no CHECK can express, so `recordDispatch`
-- enforces it exactly as it already enforces the company, and
-- `verify:schema25` §11 asserts it for every dispatch ever written.
--
-- **The backfill is the statement that matters here.** `dispatchedSqmByCompany`
-- stops joining through `quotation_threads` in this slice and reads
-- `dispatches.project_id` instead, so without it every dispatch recorded
-- before today would reach no project at all: no error, no failed constraint,
-- just every historical figure on every project screen quietly gone. It is
-- also the only step in this file that can be wrong without failing, which is
-- why §11 asserts the invariant rather than the backfill — the backfill
-- landing is a consequence of the invariant holding.
--
-- **Nothing was lost.** Checked before generating: 40 `dispatches` rows, 26 of
-- them against a quotation and 14 direct, reaching 13 distinct projects. All
-- 40 name a company whose name carries a verify-script run stamp, and every
-- `dispatch.recorded` entry in `audit_log` was written either by
-- `coordinator@example.test` — the dev-fixtures account — or by a null actor.
-- No value typed by a person exists anywhere, and no thread carried a null
-- project before this migration, so there is nothing to archive and the
-- backfill is complete by construction: 26 rows gain a project, 14 keep null.
--
-- Reviewed as generated, with one statement added by hand. Order matters and
-- was set here rather than accepted: the column and its foreign key first, the
-- backfill next — a fresh database runs it against no rows — and the index
-- last, so it is built once over the final values rather than maintained
-- through the update.
ALTER TABLE "quotation_threads" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "dispatches" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE "dispatches" AS d
   SET "project_id" = t."project_id"
  FROM "quotation_threads" AS t
 WHERE t."id" = d."quotation_thread_id";--> statement-breakpoint
CREATE INDEX "dispatches_project_idx" ON "dispatches" USING btree ("project_id");
