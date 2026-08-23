-- 0023 - S120, S77: the difference flag, and the gap it measures.
--
-- S120: **a dispatch that differs from its quotation is flagged**, ANY
-- difference counts, the flag is permanent, and it records WHO made each
-- difference - the rep before submitting, or the coordinator after. S77: what
-- was quoted and what was actually dispatched are deliberately compared.
--
-- **Most of S120 needs no column at all, and that is the load-bearing point.**
-- Whether a dispatch differs from its version is derived in SQL at every reader
-- (`dispatchDiffers`), multiset-compared over the nine fields `prefillByVersion`
-- copies. It is permanent without being stored because both sides are frozen:
-- 0021 put `quotation_version_id` on the row, S126 makes it an ISSUED version,
-- S61 will not let an issued version's lines be edited and S66 supersedes it
-- rather than rewriting it - so a later revision cannot retroactively create a
-- gap on a dispatch that never moved. After approval nothing edits the dispatch
-- either (S73). A stored `differs` boolean would be a second answer to a
-- question the rows already answer, and a place for the two to disagree.
--
-- **What cannot be derived is attribution, and these two columns are it.**
-- `updateDispatchRequest` DELETES every line and re-inserts the set, so
-- `dispatch_lines.created_at` is rewritten by the rep's own edits exactly as by
-- the coordinator's. No timestamp anywhere separates them, and a figure reading
-- `created_at` against `submitted_at` would attribute the rep's whole dispatch
-- to her. So the rep's half is computed once, at submission, with the same SQL
-- expression the readers use, and never moves again.
--
--   * `differed_at_submission` - the rep's deviation. Permanent.
--   * `lines_changed_after_submission` - named for the ACT, not the actor. Only
--     the coordinator may edit a submitted request (S62, S125), so *after
--     submission* names her without a role column; and it records that the
--     lines MOVED rather than that a gap was created, because after her first
--     edit the submitted set is gone. Sticky, for that reason.
--
-- Read with the derived comparison the two give all five real cases: matched
-- throughout, the rep's deviation, hers alone, both, and the rep deviated while
-- she brought it back to the quotation. **Neither is S123's figure** - that
-- counts any edit she had to make, from the audit row that already names her.
--
-- **Both are NULLABLE, and null is not false.** A free-entry dispatch (S75) has
-- no quotation to differ from: S120's comparison has no left-hand side there.
-- `false` would let a later compliance figure count every direct sale as a
-- dispatch that matched its quotation - the quietest possible way to make a
-- number wrong. Null until submission for the same reason: nothing has been
-- handed over yet.
--
-- `dispatches_difference_flag` is one CHECK holding both halves: the pair is
-- null together, and non-null exactly when the row has both a submission and a
-- version. Row-local, so the database holds it (CLAUDE.md).
--
-- **Statement 1 refuses the rows the CHECK could not admit**, and only those. A
-- dispatch that is a draft, or a free entry, is legal carrying nulls and is left
-- alone. What it refuses is a SUBMITTED-or-later dispatch raised from a
-- quotation: that row needs a value for the rep's half, and there is none to
-- give it. Computing one from the lines as they stand today would read the
-- coordinator's edits as the rep's - the exact confusion S120 forbids and this
-- migration exists to prevent - and a blanket `false` would claim every
-- historical dispatch matched its quotation. Both are inventing a fact nobody
-- recorded, which is what 0022's statement 1 refused for `stock`.
--
-- WORKFLOW section 7's escape clause does not apply: it is for where clearing is
-- NOT available, and here it is. `npm run db:reset` recreates every row, because
-- there is no production data - every dispatch in every database is a fixture or
-- verify residue.
--
-- It **refuses rather than deleting**, unchanged from 0020, 0021 and 0022:
-- comments hang on a dispatch id through `comments.record_id`, which is
-- polymorphic and carries no foreign key, so a DELETE would orphan them
-- silently.
--
-- The message is **one ordinary quoted literal with real newlines** - adjacent
-- string constants concatenate only when plain, and an E-prefixed continuation
-- is a syntax error. That cost 0020 an hour, and 0021 and 0022 both record it.
--
-- Every statement rolls back together, so a database that refused this file is
-- left exactly as it was - 23 migrations unrecorded, no new columns, no CHECK -
-- and the file re-runs cleanly once the offending rows are gone.
--
-- What holds the rules from here is not this file. It is `verify:slice3`
-- section 24, which drives every case of the comparison and both halves of the
-- attribution through the data layer, asserting the derived flag at BOTH
-- readers rather than the one easiest to reach; `verify:schema25`, which asserts
-- the invariant over every row ever written; and `verify:routes` section 16,
-- which posts a real edit through the real forms in both locales.
--
-- Driven, verbatim, against a populated database holding 174 dispatches, of
-- which 78 were submitted against a quotation, inside a transaction that was
-- then rolled back:
--
--     populated: 174 dispatches, 78 submitted against a quotation
--     --- the guard fired, verbatim ---
--     0023 refuses: 78 dispatch(es) were submitted against a quotation.
--     S120 records whether the lines the REP handed over differed from the
--     version they were raised from. That is fixed at submission and cannot be
--     recovered afterwards: every edit deletes and re-inserts the lines, so
--     nothing on an existing row says which of them the rep typed and which the
--     coordinator did.
--     ...
--     rolled back clean: 0 new dispatch columns (want 0)
--
-- **Statement 1 is hand-written**; 0017, 0020, 0021 and 0022 are the precedents.
-- The rest are drizzle's own, reviewed as generated and left in its order.
-- `drizzle-kit generate` reports "No schema changes" with this file in place.
DO $$
DECLARE existing bigint;
BEGIN
  SELECT count(*) INTO existing FROM "dispatches"
   WHERE "submitted_at" IS NOT NULL AND "quotation_version_id" IS NOT NULL;
  IF existing > 0 THEN
    RAISE EXCEPTION '0023 refuses: % dispatch(es) were submitted against a quotation.
S120 records whether the lines the REP handed over differed from the version
they were raised from. That is fixed at submission and cannot be recovered
afterwards: every edit deletes and re-inserts the lines, so nothing on an
existing row says which of them the rep typed and which the coordinator did.
Computing it from the lines as they stand today would read her edits as the
rep''s deviation, which is the confusion S120 exists to prevent; writing false
would claim every historical dispatch matched its quotation.
Run: npm run db:reset   then migrate again.
A draft, and a free-entry dispatch, are legal carrying nulls and are not the
rows this refuses. This migration refuses rather than deleting: comments hang on
dispatch ids with no foreign key, so a DELETE would orphan them. There is no
production data (WORKFLOW section 7) - every dispatch is a fixture or verify
residue.',
      existing;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "dispatches" ADD COLUMN "differed_at_submission" boolean;--> statement-breakpoint
ALTER TABLE "dispatches" ADD COLUMN "lines_changed_after_submission" boolean;--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_difference_flag" CHECK ((differed_at_submission is null) = (lines_changed_after_submission is null)
          and (differed_at_submission is not null)
              = (submitted_at is not null and quotation_version_id is not null));
