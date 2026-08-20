-- 0018 — S67: validity and delivery period are SMAC's, not FACET's.
--
-- FACET carries no validity date, computes no expiry and shows no delivery
-- period. `0014` took the *state* — `end_state = 'expired'`, the read-path
-- sweep that wrote it, and the notification it raised. It kept the *fact*:
-- `valid_until` on the version, `versionIsExpired()` computing
-- `valid_until < current_date` in SQL, an "Expired" badge on three screens and
-- an Extend panel. S67 as rewritten takes the fact too, so both columns go.
--
-- **Measured against `facet` before this file was written**, as `0014` was:
-- 437 of 511 versions carry a `valid_until`, 310 carry a `delivery_period`.
-- Neither is preserved and neither is backfilled anywhere — WORKFLOW §7, there
-- is no production data. SMAC holds both figures and always did; that is the
-- whole of the rule. The 8 `quotation_version.validity_extended` rows in
-- `audit_log` stay: FACET deletes nothing, and the log records what happened
-- even after the column it happened to is gone.
--
-- **Statement 1 must precede the enum swap.** `expiry_revision` named a
-- revision raised after a validity date had passed, and the only thing that
-- could set it was `thread-actions.tsx` reading the computed `expired` fact.
-- With no `valid_until` there is no such fact, so nothing in the repository can
-- write the value — a dead enum value, which `CLAUDE.md` calls a defect rather
-- than neutral. `ALTER TYPE ... DROP VALUE` does not exist in Postgres, so the
-- type is rebuilt exactly as `0014` rebuilt `quotation_thread_end_state`, and
-- the generated `USING "origin"::"quotation_version_origin"` cast cannot
-- represent a value the new type lacks — it would abort the migration. That is
-- the safe failure, but it cannot run until the value is gone.
--
-- **8 versions carry `origin = 'expiry_revision'` and become
-- `rep_change_request`.** Checked before generating, exactly as `0014` was.
-- All 8 belong to companies whose names carry a verify-script run stamp
-- (`verify-<stamp> Co`), all 8 are version 3 with status `requested` and no
-- SMAC reference, and all 8 were created by the fixture rep through the rep's
-- own Revise panel. That panel is `rep_change_request` on any date; the screen
-- substituted `expiry_revision` only because a clock said the version was
-- stale. So this is not a backfill inventing a fact — it is the same act,
-- named by the vocabulary that survives. Deleting the rows instead would leave
-- each thread with a superseded version 2 and no live version at all, which
-- `getQuotationThread` throws on.
--
-- The six DDL statements are drizzle's own, reviewed as generated and left
-- alone.
UPDATE "quotation_versions"
   SET "origin" = 'rep_change_request'
 WHERE "origin" = 'expiry_revision';--> statement-breakpoint
ALTER TABLE "quotation_versions" ALTER COLUMN "origin" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."quotation_version_origin";--> statement-breakpoint
CREATE TYPE "public"."quotation_version_origin" AS ENUM('initial_request', 'rep_change_request', 'coordinator_direct_edit');--> statement-breakpoint
ALTER TABLE "quotation_versions" ALTER COLUMN "origin" SET DATA TYPE "public"."quotation_version_origin" USING "origin"::"public"."quotation_version_origin";--> statement-breakpoint
ALTER TABLE "quotation_versions" DROP COLUMN "valid_until";--> statement-breakpoint
ALTER TABLE "quotation_versions" DROP COLUMN "delivery_period";
