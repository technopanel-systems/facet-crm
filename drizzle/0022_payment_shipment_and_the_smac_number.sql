-- 0022 - S70, S71, S73, S119, S121, S130: payment, shipment and the SMAC number.
--
-- S72 moved the old payment gate to the approval without replacing it. S73
-- replaces the CONDITION: approval needs a payment METHOD, not a confirmed
-- payment. Three things change rather than one.
--
--   * The old gate asked *has money arrived?*. `on_delivery` (S71) answers
--     "no" and is still a legitimate way to buy. S70 asks *how is the customer
--     paying?* instead, which is the question the coordinator can answer at
--     the moment she approves.
--   * It read `quotation_threads.payment_confirmed_at` - a state on ANOTHER
--     table - so it could never be a CHECK. A method on this row is row-local,
--     and the database holds it (CLAUDE.md).
--   * It sat inside the thread branch, so a FREE ENTRY (S75), having no
--     thread, passed no payment gate at all. The new one applies to all three
--     routes of S75.
--
-- `payment_confirmed_at` STAYS and is not touched here. It is the chain's
-- `paid` rung (D29), `markAcceptedForProcessing`'s own gate, two follow-up
-- suppressors and a timeline kind. What it stopped being is a condition of
-- dispatch.
--
-- **S130 arrives with S119, and that is the load-bearing decision.** S119's
-- rule branches on the stock - *a dispatch from South or Dammam stock is CT* -
-- and until now the stock was only on `quotation_versions` (0019, S118). Read
-- from there the rule spans two rows: application code only, unreachable for a
-- free entry, and readable through a value a revision (S66) can move
-- underneath it. On `dispatches` it is `dispatches_stock_shipment`, one
-- row-local CHECK in 0021's shape, and *a free-entry dispatch names a stock
-- too* (S130) is what makes it total.
--
-- **Five CHECKs, and every one is one-directional.** 0021's three are written
-- `(status = X) = (column is not null)`, which is exact for a stamp nothing
-- else may set. These are not:
--
--   * `dispatches_payment_method` - `payment_method is not null or status <>
--     'approved'`. The `=` form would also forbid a method on an unapproved
--     row, which no rule says: S76 names *payment* among the fields the
--     coordinator's edit right reaches on a submitted request. And S73's own
--     second half - *approval is final; anything wrong afterwards is a
--     cancellation* - arrives with a `cancelled` state that still carries the
--     method it was approved with. Written this way that slice adds an enum
--     value and amends nothing here.
--   * `dispatches_smac_number_after_approval` - the same, plus S121's own
--     words: *it is not a condition of approval; a dispatch is approved, then
--     numbered*. The `=` form would make S121 gate the act it says it does not.
--   * `dispatches_cargo_destination` and `dispatches_payment_note` - both
--     notes are OPTIONAL, so only the pairing is refused, never the absence.
--
-- **`dispatches_stock_shipment` names the two stocks negatively, matching the
-- rule's own words.** `stock in ('riyadh','malham') or shipment = 'ct'` is
-- equivalent across today's four values and would silently constrain a FIFTH
-- stock to CT the moment a warehouse is added. This form names exactly the two
-- S119 names. Malham is deliberately absent: *TT is discouraged there, never
-- refused... the coordinator's knowledge, not a rule FACET enforces*.
--
-- **Three columns are dropped, and none of them is a loss.**
--
--   * `quotation_versions.payment_method` and `.shipment_terms` - nullable
--     `text` since 0000, no enum, no CHECK, no default. One writer (the
--     quotation form), one reader (two Facts on the quotation detail), no
--     derivation, no filter, no figure. What reps typed into them - "50%
--     advance", "EX-F" - is in neither S71's six nor S119's three, which is
--     the point: nothing on a quotation ever agreed with the vocabulary the
--     rules now name. Both are `dispatches` columns from here, and typed.
--   * `companies.has_credit_terms` - a NOT NULL boolean no code path ever set
--     to true. SPEC section 15 lists it under *Dropped outright*: S70 and S73
--     were its only citations and both were rewritten. It named an exception
--     to the payment gate for customers who buy on credit; S73 asks for a
--     METHOD, and `handled_by_finance` (S71) is the answer a credit customer
--     gives. The exception became one value in a list rather than a flag
--     beside a gate, so it comes out in the slice that rewrote its rules
--     (CLAUDE.md: when a rule replaces an old mechanism, the old mechanism
--     comes out in the same slice).
--
-- **Statement 1 refuses a database that holds a dispatch.** `stock` and
-- `shipment` are NOT NULL with no default - a default is a place for a writer
-- to forget, and both writers in `dispatches.ts` set them outright - so an
-- existing row has no value this file could give it without inventing one.
-- There is nothing to infer either: a dispatch raised before today carries no
-- stock anywhere it could be read from on the free route, and on the linked
-- route its quotation stock is a DIFFERENT column that S130 exists precisely
-- to say may differ. Choosing one would be writing a fact nobody recorded.
--
-- WORKFLOW section 7's escape clause does not apply: it is for where clearing
-- is NOT available, and here it is. `npm run db:reset` recreates every row,
-- because there is no production data - every dispatch in every database is a
-- fixture or verify residue.
--
-- It **refuses rather than deleting**, for 0020's and 0021's reason and
-- unchanged: comments hang on a dispatch id through `comments.record_id`,
-- which is polymorphic and carries no foreign key, so a DELETE would orphan
-- them silently.
--
-- The message is **one ordinary quoted literal with real newlines**. Postgres
-- concatenates adjacent string constants only when they are plain, and an
-- E-prefixed continuation is a syntax error - that cost 0020 an hour and 0021
-- records it.
--
-- Driven, verbatim, against a populated database holding 325 dispatches, 338
-- dispatch lines and 22 migrations recorded, inside a transaction that was
-- then rolled back:
--
--     populated: 325 dispatches, 338 dispatch lines, 22 migrations recorded
--     --- the guard fired, verbatim ---
--     0022 refuses: dispatches is not empty (325 row(s)).
--     A dispatch now carries a stock and a shipment method (S130, S119), both
--     NOT NULL with no default. An existing row has no value this migration
--     could give either without inventing one: on the free route no stock was
--     ever recorded anywhere, and on the linked route the quotation stock is a
--     different column that S130 exists precisely to say may differ.
--     Run: npm run db:reset   then migrate again.
--     ...
--     rolled back clean: 0 new dispatch columns (want 0), has_credit_terms
--     present 1 (want 1), payment_method type 0 (want 0)
--
-- **Every statement rolls back together**, both CREATE TYPEs and all three
-- DROP COLUMNs included, so a database that refused this file is left exactly
-- as it was - 22 migrations recorded, no `payment_method` type, no new
-- columns, and `has_credit_terms` still standing - and the file re-runs
-- cleanly once the table is empty. Confirmed both ways.
--
-- What holds the rules from here is not this file. It is `verify:schema25`
-- section 16 - no approved dispatch without a method, no South or Dammam
-- dispatch that is not CT, no destination without Cargo, no number before
-- approval, no duplicate number - asserted over every row ever written rather
-- than over the rows a script just made; `verify:slice3`, which drives the
-- refusals through the data layer; and `verify:routes`, which posts the whole
-- chain through the real forms in both locales.
--
-- **Statement 1 is hand-written**; 0017, 0020 and 0021 are the precedents. The
-- rest are drizzle's own, reviewed as generated and left in its order.
-- `drizzle-kit generate` reports "No schema changes" with this file in place.
DO $$
DECLARE existing bigint;
BEGIN
  SELECT count(*) INTO existing FROM "dispatches";
  IF existing > 0 THEN
    RAISE EXCEPTION '0022 refuses: dispatches is not empty (% row(s)).
A dispatch now carries a stock and a shipment method (S130, S119), both NOT
NULL with no default. An existing row has no value this migration could give
either without inventing one: on the free route no stock was ever recorded
anywhere, and on the linked route the quotation stock is a different column
that S130 exists precisely to say may differ.
Run: npm run db:reset   then migrate again.
This migration refuses rather than deleting the rows: comments hang on dispatch
ids with no foreign key, so a DELETE would orphan them. There is no production
data (WORKFLOW section 7) - every dispatch is a fixture or verify residue.',
      existing;
  END IF;
END $$;--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('on_delivery', 'card_in_office', 'cash_in_office', 'bank_transfer_full', 'bank_transfer_downpayment', 'handled_by_finance');--> statement-breakpoint
CREATE TYPE "public"."shipment_method" AS ENUM('ct', 'tt', 'cargo');--> statement-breakpoint
ALTER TABLE "dispatches" ADD COLUMN "stock" "stock" NOT NULL;--> statement-breakpoint
ALTER TABLE "dispatches" ADD COLUMN "shipment" "shipment_method" NOT NULL;--> statement-breakpoint
ALTER TABLE "dispatches" ADD COLUMN "cargo_destination" text;--> statement-breakpoint
ALTER TABLE "dispatches" ADD COLUMN "payment_method" "payment_method";--> statement-breakpoint
ALTER TABLE "dispatches" ADD COLUMN "payment_note" text;--> statement-breakpoint
ALTER TABLE "dispatches" ADD COLUMN "smac_dispatch_number" text;--> statement-breakpoint
CREATE UNIQUE INDEX "dispatches_smac_number_key" ON "dispatches" USING btree ("smac_dispatch_number");--> statement-breakpoint
ALTER TABLE "companies" DROP COLUMN "has_credit_terms";--> statement-breakpoint
ALTER TABLE "quotation_versions" DROP COLUMN "payment_method";--> statement-breakpoint
ALTER TABLE "quotation_versions" DROP COLUMN "shipment_terms";--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_stock_shipment" CHECK (stock not in ('south', 'dammam') or shipment = 'ct');--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_cargo_destination" CHECK (cargo_destination is null or shipment = 'cargo');--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_payment_method" CHECK (payment_method is not null or status <> 'approved');--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_payment_note" CHECK (payment_note is null or payment_method is not null);--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_smac_number_after_approval" CHECK (smac_dispatch_number is null or status = 'approved');
