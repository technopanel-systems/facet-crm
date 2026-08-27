-- 0031 — S50, S74: a quotation always names a project.
--
-- **This reverses 0013.** 0013 is the only migration that has ever touched this
-- column, and it dropped the constraint for one reason: S74's second branch,
-- the coordinator choosing a project for a quotation that had none, needed
-- something to act on. S50 was amended in the board-rules slice to read "a
-- quotation ALWAYS names a project", which deletes that branch, so the reason
-- is gone and the constraint comes back. S74 says the same in its own words —
-- "the write-back is gone, and it goes with S50's null case in the same
-- slice".
--
-- 0013's OTHER half is untouched: dispatches.project_id, its foreign key, its
-- index and its backfill are S74's and S75's, and a free entry still names no
-- project. Only the first of 0013's five statements is undone.
--
-- Pre-flight, run against the development database on 27 Aug 2026:
--
--   select count(*), count(project_id), count(*) - count(project_id)
--     from quotation_threads;
--   -- 106 threads | 98 with a project | 8 orphans
--
--   select count(*) from quotation_threads t
--    where t.project_id is null
--      and exists (select 1 from dispatches d
--                   where d.quotation_thread_id = t.id);
--   -- 0
--
-- **The second query is a gate, not a statistic.** A dispatch against an
-- orphan thread would come out of this migration still carrying a null
-- project_id while its thread carries one, which is exactly the disagreement
-- verify:schema25 §11 exists to refuse. It is 0, so nothing propagates to
-- dispatches here and no statement below touches that table. If it is ever
-- non-zero, stop: this migration is wrong for that database.
--
-- Eight orphans, and the audit log agrees with the count: 12
-- quotation_thread.project_set rows, all of them threads that gained a project
-- through the write-back and so are not orphans now. The eight that remain
-- never reached a dispatch.
--
-- **Three of the eight orphan companies already hold a live project.** A
-- project is created for them anyway. That is S50's own reasoning applied
-- rather than an oversight: "two projects that should have been one can be
-- merged; one project holding four unrelated jobs cannot be pulled apart."
-- Merging does not exist yet (S21–S23 are unbuilt), so the choice is between a
-- duplicate that a later merge can fix and a wrong grouping that nothing can.
--
-- Four decisions, stated rather than left to be read out of the SQL:
--
--   1. NAMED FROM THE COMPANY, which is the same suggestion the raise form now
--      offers, so a backfilled project and one created tomorrow read alike.
--   2. OWNED BY THE THREAD'S RAISER (S30). A project is visible only to its
--      owner, and the rep must be able to see the project his own quotation
--      now names.
--   3. created_at IS THE THREAD'S, not now(). The project represents work that
--      already existed; stamping eight rows today would put them at the top of
--      /projects and move D25's ordering for an event that never happened.
--   4. A project_companies ROW PER PROJECT (S27), written by the same
--      statement, so no project lands violating an invariant that has no CHECK
--      behind it — S27's "at least one participant" is application-layer
--      because SQL cannot express it here.
--
-- name_normalized is folded by the expression 0030 introduced and proved: the
-- SQL translation of normalizeName (src/lib/normalize.ts), NFKC through the
-- whitespace collapse, with the same CASE for the fallback the function has.
-- It is applied here to a COMPANY name, and 0030's proof covered all 126 of
-- them — 0 mismatches — so no new equivalence is being asserted. The durable
-- guard is verify:schema25 §22, which folds every project row at every run.
--
-- Order: one statement does the inserts and the update together, because the
-- project id has to be known to three tables at once and a data-modifying CTE
-- is the only way to say that without a temporary mapping table. Data-modifying
-- CTEs are executed exactly once and to completion, so `made` and `linked` run
-- whether or not the outer query reads them, and the foreign keys are checked
-- at end of statement, by which time the projects exist. SET NOT NULL comes
-- last, so it validates against final values. A fresh database runs both
-- against zero rows.
WITH orphan AS (
  SELECT t."id"                 AS thread_id,
         t."company_id"         AS company_id,
         t."raised_by_user_id"  AS owner_id,
         t."created_at"         AS created_at,
         c."name"               AS company_name,
         gen_random_uuid()      AS project_id
    FROM "quotation_threads" AS t
    JOIN "companies" AS c ON c."id" = t."company_id"
   WHERE t."project_id" IS NULL
),
made AS (
  INSERT INTO "projects" ("id", "name", "name_normalized", "owner_user_id",
                          "created_by", "created_at")
  SELECT o.project_id, o.company_name,
         case
           when btrim(regexp_replace(regexp_replace(regexp_replace(
                  normalize(translate(lower(normalize(o.company_name, NFKC)),
                                      'آأإٱةىؤئ٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹ًٌٍَُِّْٰـ', 'ااااهيوي01234567890123456789'), NFD),
                  '[\u0300-\u036F]', '', 'g'),
                  '[^a-z0-9؀-ۿ ]+', ' ', 'g'),
                  '\s+', ' ', 'g')) = ''
           then lower(btrim(o.company_name))
           else btrim(regexp_replace(regexp_replace(regexp_replace(
                  normalize(translate(lower(normalize(o.company_name, NFKC)),
                                      'آأإٱةىؤئ٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹ًٌٍَُِّْٰـ', 'ااااهيوي01234567890123456789'), NFD),
                  '[\u0300-\u036F]', '', 'g'),
                  '[^a-z0-9؀-ۿ ]+', ' ', 'g'),
                  '\s+', ' ', 'g'))
         end,
         o.owner_id, o.owner_id, o.created_at
    FROM orphan AS o
  RETURNING "id"
),
linked AS (
  INSERT INTO "project_companies" ("project_id", "company_id", "created_at")
  SELECT o.project_id, o.company_id, o.created_at FROM orphan AS o
  RETURNING "id"
)
UPDATE "quotation_threads" AS t
   SET "project_id" = o.project_id
  FROM orphan AS o
 WHERE t."id" = o.thread_id;--> statement-breakpoint
ALTER TABLE "quotation_threads" ALTER COLUMN "project_id" SET NOT NULL;
