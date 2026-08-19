-- 0014 — S57: VAT is fixed at 15% and is never editable.
--         S67: validity is a note, not a gate.
--
-- S53 ships in the same slice and needs no migration: the product line already
-- carries supplier, class, fire rating, colour, thickness, width, length and
-- pieces as columns. What went was `productDisplayName`, which reassembled
-- SMAC's own code out of them for display. No column changes for that.
--
-- **Two data statements run before any DDL, and they are the ones that
-- matter.** Both were measured against `facet` before this file was written.
--
-- **S57 — the rate goes, the amount stays.** `vat_amount`, `total_vat` and
-- `grand_total` are SMAC's figures mirrored into FACET, and the schema keeps
-- recording them. Only the per-line *rate* is dropped: it was nullable with no
-- default and an editable input behind it, so a line could carry 12, or none
-- at all and a price with no tax on it.
--
-- Statement 1 normalises history to the fixed rate. On this database it
-- changes nothing — all 162 priced lines already hold exactly
-- `round(line_total * 0.15, 2)`, and none holds a null amount against a price
-- — and statement 2 likewise leaves all 195 versions untouched. They are here
-- because they are the rule rather than a repair: after this file, "no VAT
-- rate is stored" has to be true of the data and not only of the schema, on
-- any database this replays against. `verify:schema25` §12 asserts the same
-- identity permanently, so a future write that breaks it fails there rather
-- than in a total nobody recomputes.
--
-- Postgres `round(numeric, 2)` rounds half away from zero, which is what
-- `divideRounded` in `src/lib/decimal.ts` does on a magnitude; every figure
-- here is non-negative, so the two agree exactly. The service half rounds
-- twice — amount, then tax on it — because `recomputeVersionTotals` does.
--
-- **S67 — expiry was a state and is now a fact.** `expireOverdueThreads` ran
-- on *every* quotation list and detail read and wrote `end_state = 'expired'`
-- on any thread past its validity date. That single write then froze the
-- thread's lines, closed its chain so it named nobody's move, dropped it out
-- of the follow-up queues, and raised a persistent act-now notification. One
-- date, four gates, under a rule that says it stops nothing. Expiry is now
-- `valid_until < current_date`, computed in SQL when a screen is read.
--
-- **32 threads carry `end_state = 'expired'` and are cleared to null.**
-- Checked before generating, exactly as 0013 was: all 32 belong to companies
-- whose names carry a verify-script run stamp, and all 48 `audit_log` rows for
-- `quotation_thread.expired` were written under a **null actor** — the system
-- sweep — with zero written by a person. Nobody ever chose this value; a clock
-- inferred it, and S67 says the inference was wrong. There is no human
-- judgement here to preserve, and no archive to take.
--
-- **The 32 live expiry notifications are resolved in the same statement
-- block.** Their resolution condition was "the thread is no longer expired",
-- and `resolveExpiredQuotations` is deleted in this slice — so without
-- statement 3 they would sit unresolved in a rep's list forever, persistent
-- and act-now, with nothing left that could ever clear them. The
-- `notification_types` row itself stays: 40 notifications point at it, FACET
-- deletes nothing, and it is no longer seeded, so nothing will make more.
--
-- **It is also marked non-persistent**, which is not tidying. `21 §4` gives
-- persistence only to a type whose condition can clear, and this one's
-- condition — "the thread is no longer expired" — cannot be evaluated any
-- more, let alone become true. A row left `is_persistent = true` with no
-- resolution rule is precisely the badge a rep can never clear that `21 §4`
-- exists to forbid, and `verify:phase10a` §11 asserts that pairing over every
-- type in the table rather than over the seed. It caught this.
--
-- **Order is chosen, not accepted.** Statement 4 must precede the enum swap:
-- the generated `USING "end_state"::"quotation_thread_end_state"` cast at the
-- end cannot represent `'expired'` and would abort the migration. That is the
-- safe failure — it cannot corrupt anything, but it also cannot run until the
-- value is gone.
--
-- The five DDL statements are drizzle's own, reviewed as generated and left
-- alone. Casting the column to `text`, dropping the type and recreating it is
-- shorter than renaming the old type and dropping it afterwards, and has the
-- same effect: `ALTER TYPE ... DROP VALUE` does not exist in Postgres, so a
-- value can only be removed by rebuilding the type.
UPDATE "quotation_lines"
   SET "vat_amount" = round("line_total" * 0.15, 2)
 WHERE "line_total" IS NOT NULL
   AND "vat_amount" IS DISTINCT FROM round("line_total" * 0.15, 2);--> statement-breakpoint
UPDATE "quotation_versions" AS v
   SET "total_vat" = t."total_vat",
       "grand_total" = v."total_excl_vat" + t."total_vat"
  FROM (
    SELECT ver."id",
           coalesce(
             (SELECT sum(l."vat_amount") FROM "quotation_lines" l
               WHERE l."version_id" = ver."id"), 0)
           + coalesce(
             (SELECT sum(round(round(s."unit_price" * s."quantity", 2) * 0.15, 2))
                FROM "quotation_service_lines" s
               WHERE s."version_id" = ver."id"
                 AND s."unit_price" IS NOT NULL), 0) AS "total_vat"
      FROM "quotation_versions" ver
  ) AS t
 WHERE t."id" = v."id"
   AND v."total_excl_vat" IS NOT NULL
   AND (v."total_vat" IS DISTINCT FROM t."total_vat"
     OR v."grand_total" IS DISTINCT FROM v."total_excl_vat" + t."total_vat");--> statement-breakpoint
UPDATE "notifications"
   SET "resolved_at" = now()
 WHERE "resolved_at" IS NULL
   AND "notification_type_id" IN (
     SELECT "id" FROM "notification_types" WHERE "key" = 'quotation.expired'
   );--> statement-breakpoint
UPDATE "notification_types"
   SET "is_persistent" = false
 WHERE "key" = 'quotation.expired';--> statement-breakpoint
UPDATE "quotation_threads" SET "end_state" = NULL WHERE "end_state" = 'expired';--> statement-breakpoint
ALTER TABLE "quotation_threads" ALTER COLUMN "end_state" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."quotation_thread_end_state";--> statement-breakpoint
CREATE TYPE "public"."quotation_thread_end_state" AS ENUM('accepted', 'rejected', 'cancelled');--> statement-breakpoint
ALTER TABLE "quotation_threads" ALTER COLUMN "end_state" SET DATA TYPE "public"."quotation_thread_end_state" USING "end_state"::"public"."quotation_thread_end_state";--> statement-breakpoint
ALTER TABLE "quotation_lines" DROP COLUMN "vat_rate";
