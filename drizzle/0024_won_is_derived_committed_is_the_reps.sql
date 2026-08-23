-- 0024 — S28, S29, S31: won is derived, committed is the rep's.
--
-- **`won` cannot be a column.** S31 says a project is won when a dispatch
-- against it is approved — a real event, which this enum could only ever have
-- claimed by hand. It is derived now, from the same `status = 'approved'`
-- predicate that credits a target (S72), so cancelling an approved dispatch
-- un-wins the project and takes back the credit as one act rather than two.
-- That is why this is a drop and not a rename: a stored `won` would need a
-- second writer at cancellation, and could disagree with the dispatches it
-- claims to summarise.
--
-- **`dormant` comes out beside it.** No rule ever defined a dormant project
-- and nothing had written one — AUDIT 1's dead-enum finding, WORKFLOW section
-- 5. The type is being rebuilt anyway, so it costs one word. What survives is
-- S29's fourth item and only that: lost, with a reason, which closes the
-- project. `end_state` now means exactly one thing.
--
-- **Statement 1 must precede the enum swap**, exactly as 0018 records: the
-- generated `USING "end_state"::"project_end_state"` cast cannot represent a
-- value the new type lacks and would abort the migration. That is the safe
-- failure, but it cannot run until the value is gone.
--
-- **`projects_loss_state` has to come out and go back, and drizzle-kit does
-- not know it.** 0014 and 0018 rebuilt a type with nothing but the column to
-- worry about. This one is different: the CHECK reads `end_state is not
-- distinct from 'lost'`, and Postgres stored that literal already resolved to
-- `project_end_state`. Casting the column to `text` then leaves the constraint
-- comparing `text` to `project_end_state` and the whole migration fails with
-- `operator does not exist: text = project_end_state`. So the constraint is
-- dropped before the swap and recreated after it, with the expression
-- `schema.ts` declares — unchanged in meaning, re-parsed against the new type.
-- It goes back while the column is an enum again, so `'lost'` resolves to the
-- one value that survives.
--
-- Worth knowing for the next type rebuild: **drizzle-kit generated the five
-- DDL statements and swallowed the failure.** `drizzle-kit migrate` exits 1
-- and prints nothing but its spinner, so the error above was only visible by
-- running the statements by hand. WORKFLOW section 5 records the silence; this
-- records what it hides.

--
-- **2 of 27 projects carry `won` and 0 carry `dormant`**, counted before
-- generating. Both `won` rows are verify residue, and neither was ever a real
-- event — that is S31's whole point, and it is why this is not a backfill.
-- Nothing is being preserved that `db:reset` would not recreate (WORKFLOW
-- section 7). They become NULL, which is what the surviving vocabulary already
-- calls an open project, and their real won-ness is now whatever their
-- dispatches say it is. `projects_loss_state` is unaffected: it constrains
-- `lost_reason_id`, which a won project never carried.
--
-- **`committed` is not an end state**, which is why it is a new column and not
-- a new value here. S29's fifth item: the customer has agreed, ahead of any
-- dispatch (S31). A committed project is still moving. Nothing clears it when
-- the project closes and no CHECK forbids the pair — `projectState` ranks won
-- and lost above it, so a closed project never reads as committed.
--
-- Drizzle's five DDL statements are reviewed as generated and otherwise left
-- alone; the UPDATE and the constraint pair around them are hand-written.
UPDATE "projects"
   SET "end_state" = NULL
 WHERE "end_state" IN ('won', 'dormant');--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_loss_state";--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "end_state" SET DATA TYPE text;--> statement-breakpoint

DROP TYPE "public"."project_end_state";--> statement-breakpoint
CREATE TYPE "public"."project_end_state" AS ENUM('lost');--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "end_state" SET DATA TYPE "public"."project_end_state" USING "end_state"::"public"."project_end_state";--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_loss_state" CHECK (lost_reason_id is null or end_state is not distinct from 'lost');--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "committed" boolean DEFAULT false NOT NULL;

