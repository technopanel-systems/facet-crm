-- 0025 — S73, S128: a decision that ends someone's work reaches them.
--
-- **`cancelled` arrives with its writer.** 0021 left it out of `dispatch_status`
-- deliberately — S73 named it and nothing wrote it, so it would have landed as
-- a dead enum value, `record_type.quotation_version`'s shape (WORKFLOW section
-- 5). `cancelDispatch` is what it was waiting for, and S128 is why: a rule that
-- requires a cancellation to reach the rep has nothing to tell them about until
-- a cancellation exists.
--
-- **This is a type REBUILD, not `ALTER TYPE ... ADD VALUE`, and the difference
-- is not stylistic.** drizzle-kit generated the ADD VALUE form followed by two
-- CHECKs naming 'cancelled'. Postgres refuses that: a value added by ALTER TYPE
-- cannot be USED in the same transaction, and a CHECK expression is a use. The
-- rebuild has no such restriction, and it is the shape 0018 and 0024 already
-- established here.
--
-- **Every CHECK that names `status` comes out before the cast and goes back
-- after it — all five, including the three that are recreated verbatim.** This
-- is 0024's trap: Postgres stores a constraint's literals already resolved to
-- the enum type, so casting the column to `text` leaves the constraint
-- comparing `text` to `dispatch_status` and the whole migration fails with
-- `operator does not exist`. Only `dispatches_quotation_pair`,
-- `dispatches_stock_shipment`, `dispatches_cargo_destination`,
-- `dispatches_payment_note` and `dispatches_difference_flag` name no status and
-- can stay.
--
-- **Two of the six are amended, and only two.**
--
--   * `dispatches_approval_stamps` gains 'cancelled' on the LEFT. Approval is
--     final (S73): a cancelled dispatch WAS approved and keeps both stamps, so
--     `(status = 'approved') = (approved_at is not null)` would refuse the row.
--     Widening it cannot make a cancelled dispatch count, because no figure
--     reads these columns — all eight compose `approvedDispatches()`, which is
--     `status = 'approved'`.
--   * `dispatches_smac_number_after_approval` gains it on the RIGHT. This is
--     the ONE of 0022's five one-directional CHECKs that the cancellation did
--     have to amend: approval requires no number, but a number still required
--     `status = 'approved'`, and a numbered dispatch is exactly the kind that
--     gets cancelled. `dispatches_payment_method` needed nothing — 0022 wrote
--     it against this rule before the rule existed, and the foresight held.
--
-- `dispatches_cancellation_reason` is new and uses the `=` form rather than its
-- neighbours' one-directional shape: this is not a value kept from an earlier
-- state, it is the record of the act. A reason on a live dispatch would
-- annotate a cancellation that never happened, and a cancellation with none is
-- the hole S128 exists to close.
--
-- **294 dispatch rows, and the sweep is a no-op — measured, not assumed.**
-- Before this file was written, every one of the six predicates was run as a
-- SELECT against the live database: 0 rows fail the cast to the new type, and 0
-- violate any of the five constraints being recreated. That query is the reason
-- the three verbatim recreations are safe — `ADD CONSTRAINT` re-validates every
-- existing row, and reading the two fixture sites would only have said what the
-- scripts write, not what is there. 0022's guard fired on 78 rows and 0021's on
-- a populated database; twice is enough.
--
-- Nothing is backfilled and nothing is preserved: no row can be 'cancelled'
-- before this runs, so `cancellation_reason` arrives all-null and the new CHECK
-- reads `false = false` everywhere (WORKFLOW section 7).

ALTER TABLE "dispatches" DROP CONSTRAINT "dispatches_approval_stamps";--> statement-breakpoint
ALTER TABLE "dispatches" DROP CONSTRAINT "dispatches_refusal_reason";--> statement-breakpoint
ALTER TABLE "dispatches" DROP CONSTRAINT "dispatches_submitted_at";--> statement-breakpoint
ALTER TABLE "dispatches" DROP CONSTRAINT "dispatches_payment_method";--> statement-breakpoint
ALTER TABLE "dispatches" DROP CONSTRAINT "dispatches_smac_number_after_approval";--> statement-breakpoint
ALTER TABLE "dispatches" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."dispatch_status";--> statement-breakpoint
CREATE TYPE "public"."dispatch_status" AS ENUM('draft', 'submitted', 'approved', 'refused', 'cancelled');--> statement-breakpoint
ALTER TABLE "dispatches" ALTER COLUMN "status" SET DATA TYPE "public"."dispatch_status" USING "status"::"public"."dispatch_status";--> statement-breakpoint
ALTER TABLE "dispatches" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_approval_stamps" CHECK ((status in ('approved', 'cancelled')) = (approved_at is not null)
          and (status in ('approved', 'cancelled')) = (approved_by_user_id is not null));--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_refusal_reason" CHECK ((status = 'refused') = (refusal_reason is not null));--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_cancellation_reason" CHECK ((status = 'cancelled') = (cancellation_reason is not null));--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_submitted_at" CHECK ((status = 'draft') = (submitted_at is null));--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_payment_method" CHECK (payment_method is not null or status <> 'approved');--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_smac_number_after_approval" CHECK (smac_dispatch_number is null or status in ('approved', 'cancelled'));
