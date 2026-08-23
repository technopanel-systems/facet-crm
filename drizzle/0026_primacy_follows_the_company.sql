-- 0026 — S18: primacy follows the company. AUDIT 1 F5.
--
-- `S18` used to say the primary rep was "always the first rep who had the
-- company". It was never true of the code: handover carries the flag to the
-- recipient and dormancy reassignment writes it on the new holder. The rule
-- now says what the code does — primacy moves with the company, and a company
-- with a rep on it has exactly one primary rep.
--
-- **The other half of `S18` was not true of the code either**, and this
-- statement is the debris. Handover had a third branch: when the recipient
-- ALREADY held the company there was no row to insert, so the departing rep's
-- flag was stamped `removed_at` and moved nowhere. The company kept its reps
-- and lost its primary. `team.ts` carried that case as `OPEN [19 §8]` — an
-- archive question, never authority — and the founder's decision closes it in
-- the only direction `S18` allows: the row that stays takes primacy.
--
-- **12 of 393 companies with a live membership carried no primary rep** when
-- this was written, and every one is a verify-script fixture: six named
-- `verify11-<stamp> Company Shared`, which is `verify-phase11` §11 driving
-- exactly the branch above through `reassignHandover`, and six named
-- `verify9-<stamp> Company A`, which is `verify-phase9` §16 stamping
-- `removed_at` on the primary rep directly, a shape the application has no
-- route to. Both are fixed in this slice: `team.ts` promotes, and §16 promotes
-- what is left of the company. **No company carried two** — nothing has ever
-- written a second primary, which is why only the missing half is repaired.
--
-- **Promoted, not cleared**, and the reverse of `0017`'s choice for a reason:
-- there the column held a value no person ever typed, so there was nothing to
-- preserve. Here the company genuinely has a rep — `S18` says one of them is
-- primary, and the earliest live membership is the only non-arbitrary pick
-- the rows themselves support. Clearing is not available: the rule forbids
-- none as squarely as two.
--
-- **Idempotent, and a no-op on a clean database.** The `NOT EXISTS` is the
-- whole guard: a company that already has a primary rep is never touched, so
-- a replay changes nothing and a database that never ran the old branch has
-- no such row to begin with.
--
-- No schema change, and no index. "At most one primary" is a partial unique
-- index Postgres could hold — `project_companies_one_buyer_key` is that shape
-- for `S26` — but it cannot hold "at least one", which is the half that was
-- actually broken, and an index nothing queries is the defect `WORKFLOW §5`
-- already lists ten of. What holds `S18` from here is the three writers and
-- `verify:schema25` §20, which counts both halves over every row.
--
-- `S18` loses its `[CHANGE]` marker: it was always the rule, restated to
-- match the code, and now the code matches it back.

UPDATE "company_reps" SET "is_primary" = true
WHERE "removed_at" IS NULL
  AND "id" = (
    SELECT "first_live"."id" FROM "company_reps" AS "first_live"
    WHERE "first_live"."company_id" = "company_reps"."company_id"
      AND "first_live"."removed_at" IS NULL
    ORDER BY "first_live"."created_at", "first_live"."id"
    LIMIT 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM "company_reps" AS "held"
    WHERE "held"."company_id" = "company_reps"."company_id"
      AND "held"."removed_at" IS NULL
      AND "held"."is_primary"
  );
