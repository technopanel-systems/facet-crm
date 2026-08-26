-- 0029 - payment is not a position on the chain.
--
-- S133. S70 records payment on the DISPATCH and S73 makes a method a condition
-- of approving one, so no interval exists between paid and dispatched for a
-- position to occupy. The `paid` rung left CHAIN_COLUMNS in this slice, and
-- CLAUDE.md's rule is that the mechanism behind a replaced gate leaves with it:
-- confirmPayment, markAcceptedForProcessing, their two server actions, the
-- PaymentForm on the quotation screen, the payment_confirmed timeline event,
-- and these three columns.
--
-- None of them is cited by a rule still standing. 0022 moved the dispatch gate
-- off payment_confirmed_at and said in its own comment that the column STAYS
-- because it was the chain's paid rung (D29); S132 removes that rung, which was
-- its last reader.
--
-- Pre-migration gate, run against the development database on 26 Aug 2026,
-- after a clean `npm run seed:demo`:
--
--   select count(*), count(payment_confirmed_at), count(payment_confirmed_by_user_id),
--          count(accepted_for_processing_at)
--     from quotation_threads;
--   -- 60 threads | 15 paid | 15 paid_by | 3 processed
--
-- The three columns carry data, and it is deliberately not migrated anywhere:
-- what a payment on a quotation meant - the customer has committed - is not
-- what a payment on a dispatch means (S70: HOW the customer is paying, decided
-- at approval), so copying one into the other would be inventing a fact. The
-- audit log keeps its own JSONB before/after copy of every confirmPayment and
-- markAcceptedForProcessing that ever ran, permanently (S112), so the history
-- of these fields survives the fields.
--
-- The foreign key quotation_threads_payment_confirmed_by_user_id_users_id_fk
-- goes with its column; Postgres drops a single-column FK when the column is
-- dropped, so it is not named separately here. No index and no CHECK referenced
-- any of the three - quotation_threads_closed guards closed_at/closed_by only.

ALTER TABLE "quotation_threads" DROP COLUMN "payment_confirmed_at";--> statement-breakpoint
ALTER TABLE "quotation_threads" DROP COLUMN "payment_confirmed_by_user_id";--> statement-breakpoint
ALTER TABLE "quotation_threads" DROP COLUMN "accepted_for_processing_at";
