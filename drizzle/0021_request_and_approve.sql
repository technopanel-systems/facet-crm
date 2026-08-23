-- 0021 — S72, S124, S125, S122, S62: a rep requests, the coordinator approves.
--
-- `can_dispatch` gated the whole dispatch act. S72 splits it: a rep requests
-- with no flag at all, and the coordinator checks the request and approves it.
-- **An approved dispatch is the only event that credits a target — not the
-- request**, so the row's existence stops being the figure and `status` becomes
-- what every reader asks.
--
-- **The request and the dispatch are the same row.** S72's own sentence
-- describes one thing at two points of its life, not two things in two tables.
-- A `dispatch_requests` table would need a second set of lines and a copy at
-- approval, and S120 then has to compare a dispatch's lines to its version's
-- AND record who made each difference — the rep before submitting, or the
-- coordinator after — which a copy boundary destroys. S125's coordinator edit
-- and S122's revive are transitions on rows that already exist; S73's
-- cancellation continues the same row later.
--
-- **Four values, and `cancelled` is deliberately not among them.** S73 names it
-- and nothing in this slice would write it, so it would land as a dead enum
-- value. `record_type.quotation_version` and `project_end_state.dormant` are
-- what that already looks like (WORKFLOW section 5). It arrives with its writer.
--
-- **`submitted_at` is not `created_at`.** A revived request (S122) is submitted
-- again, later. It has two readers, so it is not a column waiting for one: the
-- coordinator's oldest-first queue on /dispatches today, and S89's age on the
-- waiting list when that is built.
--
-- **The three CHECKs are row-local, so the database holds them.**
--   * `dispatches_approval_stamps` — the status and the approval stamps cannot
--     disagree, in either direction. This is what makes "ask the stamp" and
--     "ask the status" the same question, and every figure asks the stamp
--     through one predicate in `dispatches.ts` rather than seven hand-written
--     terms. A missed one silently counts an unapproved request toward
--     somebody's target.
--   * `dispatches_refusal_reason` — refused, and only refused, carries a reason
--     (S124). Revival clears it, because a revived request is out of the
--     archive and treated as new (S122); the audit row keeps it permanently,
--     which is what S107 means by nothing being deleted.
--   * `dispatches_submitted_at` — written as (status = 'draft') = (submitted_at
--     is null) rather than listing the three non-draft states, because a
--     **refused** request was submitted and clearing its `submitted_at` would
--     lose when. Only revival clears it, and revival is what returns the row to
--     `draft`.
--
-- **Statement 1 refuses a database that holds a dispatch, and says how to get
-- past it.** `status` is NOT NULL with no default — a default is a place for a
-- writer to forget, and each of the six writers sets it outright — so an
-- existing row has no value this file could give it without inventing one.
-- There is nothing to infer: today `approved_at` is stamped only on the direct
-- route (`07 C6`), so a linked dispatch that credits a target right now carries
-- no approver and no approval time, and mapping it onto `approved` would mean
-- writing an approval nobody performed and dating it from `created_at`. That is
-- not the mapping WORKFLOW section 7 permits — that exception is for where
-- clearing is NOT available, and here it is. There is no production data: every
-- dispatch in every database is a fixture or verify residue.
--
-- It **refuses rather than deleting**, for 0020's reason and unchanged: comments
-- hang on a dispatch id through `comments.record_id`, which is polymorphic and
-- carries no foreign key, so a DELETE would leave orphaned conversations with
-- nothing to point them out. `npm run db:reset` clears the whole database
-- consistently, and the message says so — whoever meets this months from now
-- sees the message and nothing else, not this header and not WORKFLOW section 7.
--
-- The message is **one ordinary quoted literal with real newlines in it**, not a
-- run of escaped constants: Postgres concatenates adjacent string constants only
-- when they are plain, and an E-prefixed continuation is a syntax error. That
-- cost 0020 an hour.
--
-- **Measured against `facet` before this file landed**: 25 dispatches, 26
-- dispatch lines, 21 migrations recorded. Driven, verbatim:
--
--     0021 refuses: dispatches is not empty (25 row(s)).
--     A dispatch now carries a status (S72) and an approved dispatch is the
--     only thing that credits a target. An existing row has no status this
--     migration could give it without inventing an approval nobody performed.
--     Run: npm run db:reset   then migrate again.
--     ...
--
-- **Every statement rolls back together**, CREATE TYPE included, so a database
-- that refused this file is left exactly as it was — 21 migrations recorded, no
-- `dispatch_status` type, no new columns — and the file re-runs cleanly once the
-- table is empty. Confirmed both ways: applied to an empty scratch database, and
-- driven against a populated one inside a transaction that was rolled back.
--
-- What holds the rules from here is not this file. It is `verify:schema25` §15 —
-- the three CHECKs refuse at the database, no row disagrees between its status
-- and its stamps, and no unapproved row is counted by any figure — asserted over
-- every row ever written rather than over the rows a script just made;
-- `verify:slice3`, which drives request, submit, approve, refuse, revive and
-- S127 through the data layer; and `verify:routes`, which posts the whole chain
-- through the real forms in both locales.
--
-- **Statement 1 is hand-written**; `0017` and `0020` are the precedents. The
-- rest are drizzle's own, reviewed as generated. `drizzle-kit generate` reports
-- "No schema changes" with this file in place.
DO $$
DECLARE existing bigint;
BEGIN
  SELECT count(*) INTO existing FROM "dispatches";
  IF existing > 0 THEN
    RAISE EXCEPTION '0021 refuses: dispatches is not empty (% row(s)).
A dispatch now carries a status (S72) and an approved dispatch is the only thing
that credits a target. An existing row has no status this migration could give
it without inventing an approval nobody performed: today approved_at is stamped
only on the direct route, so a linked dispatch that credits a target right now
carries no approver at all.
Run: npm run db:reset   then migrate again.
This migration refuses rather than deleting the rows: comments hang on dispatch
ids with no foreign key, so a DELETE would orphan them. There is no production
data (WORKFLOW section 7) - every dispatch is a fixture or verify residue.',
      existing;
  END IF;
END $$;--> statement-breakpoint
CREATE TYPE "public"."dispatch_status" AS ENUM('draft', 'submitted', 'approved', 'refused');--> statement-breakpoint
ALTER TABLE "dispatches" ADD COLUMN "status" "dispatch_status" NOT NULL;--> statement-breakpoint
ALTER TABLE "dispatches" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dispatches" ADD COLUMN "refusal_reason" text;--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_approval_stamps" CHECK ((status = 'approved') = (approved_at is not null)
          and (status = 'approved') = (approved_by_user_id is not null));--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_refusal_reason" CHECK ((status = 'refused') = (refusal_reason is not null));--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_submitted_at" CHECK ((status = 'draft') = (submitted_at is null));
