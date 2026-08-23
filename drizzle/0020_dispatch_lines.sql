-- 0020 — S116, S75, S126: a dispatch carries its own lines.
--
-- The dispatch was one typed number. It now carries the lines that actually
-- went out — the same shape as a quotation's product lines, but never service
-- lines (S59's fabrication is not cladding) — and every line carries a price,
-- because the invoice is made from them (S116).
--
-- **`dispatches.sqm` goes, and is derived instead.** A dispatch's square metres
-- are `sum(dispatch_lines.sqm)`, resolved in SQL at every reader, and
-- `dispatch_lines.sqm` is itself GENERATED ALWAYS AS
-- `quantity_pcs * width_m * length_m` — the same expression `quotation_lines`
-- has used since `0000`. So the figure exists exactly once and is computed by
-- the database: there is nothing for it to disagree with. The alternative was a
-- stored total in `quotation_versions.total_sqm`'s shape, recomputed after every
-- line change; that would oblige every writer still to come — S72's request,
-- S125's coordinator edit, S130's stock change — to remember to recompute it,
-- and the first one that forgot would be silently wrong.
--
-- **`quotation_version_id`, beside the thread.** S126 is a rule about a
-- VERSION — the coordinator issues a version, not a thread — and the column is
-- what keeps it assertable. A revision supersedes the issued version (S66), so
-- a thread that was lawfully dispatched against can end up carrying no issued
-- version at all; an invariant checked through the thread would then start
-- reporting a lawful historical dispatch as a violation, an invariant that
-- decays with time. Through this column the claim is permanent: the version's
-- status is `issued`, or later `superseded`, and never `requested`. S120 will
-- need the same column for its own reason — the comparison is against the
-- version the dispatch was raised from, never the latest one — but that is a
-- later slice, and this one already reads it three ways: the form's prefill,
-- the SMAC reference shown on a dispatch, and the invariant above.
--
-- **The CHECK is row-local, so the database holds it.** A free-entry dispatch
-- (S75) names no version and one raised from a quotation cannot lack it. Which
-- THREAD that version belongs to spans two rows and no CHECK can reach it, so
-- it stays in `recordDispatch`, beside the company and project pairs it already
-- enforces, and is asserted over every row by `verify:schema25`.
--
-- **Statement 1 refuses a database that holds a dispatch, and says how to get
-- past it.** Every existing dispatch row would survive this file as a LINELESS
-- dispatch: the lines table is new and empty, so a derived sum reads 0 m², and
-- S26's per-participant figure, S85's achievement and every credit split would
-- quietly go to zero rather than fail. There is no production data
-- (WORKFLOW §7) — every dispatch in every database is a fixture or verify
-- residue — so there is nothing here to preserve and nothing to infer.
--
-- It **refuses rather than deleting**: comments hang on a dispatch id through
-- `comments.record_id`, which is polymorphic and carries no foreign key, so a
-- `DELETE FROM dispatches` would leave orphaned conversations behind with
-- nothing to point them out. `npm run db:reset` clears the whole database
-- consistently, and the exception says so — whoever meets this months from now
-- sees the message and nothing else, not this header and not WORKFLOW §7.
--
-- The CHECK in statement 10 is a second, narrower refusal of the same
-- databases, and would fire on any linked dispatch that reached it. Statement 1
-- exists because it would NOT fire on a database holding only direct
-- dispatches, whose two quotation columns are already null together.
--
-- **Measured against `facet` before this file landed**: 23 dispatches. Every
-- one is a fixture or verify residue — WORKFLOW §7 — and none of them carries a
-- line, because until this migration there were none to carry. So there is no
-- fact here to preserve and none to infer, and the refusal below is what a
-- database in that state actually gets. Driven, verbatim:
--
--     0020 refuses: dispatches is not empty (23 row(s)).
--     A dispatch now carries its own lines (S116) and its sqm is derived
--     from them, so an existing row would survive as a lineless dispatch
--     reading as 0 m2.
--     Run: npm run db:reset   then migrate again.
--     ...
--
-- **Every statement rolls back together**, `CREATE TABLE` included, so a
-- database that refused this file is left exactly as it was — 20 migrations
-- recorded, no `dispatch_lines`, `sqm` intact — and the file re-runs cleanly
-- once the table is empty. Confirmed both ways: applied to an empty scratch
-- database (`drizzle-kit migrate`, "migrations applied successfully!", 21
-- recorded, `dispatches.sqm` gone and `dispatch_lines.sqm` generated), and
-- driven against `facet` inside a transaction that was rolled back.
--
-- **The message is one ordinary quoted literal with real newlines in it**, not
-- a run of escaped constants. Postgres concatenates adjacent string
-- constants only when they are plain: an E-prefixed continuation is a syntax
-- error, and it is the error this file was written with the first time.
--
-- What holds the rules from here is not this file. It is `verify:schema25` §14
-- — no linked dispatch's version is `requested`, no dispatch has zero lines,
-- and every dispatch line's VAT is 15% of its total (S57) — asserted over every
-- row ever written rather than over the rows a script just made; `verify:slice3`
-- §17 and §18, which drive the three routes of S75 and the S126 refusal through
-- the data layer; and `verify:routes` §14, which posts the lines through the
-- real form in both locales.
--
-- **Statement 1 is hand-written; `0017` is the precedent for a hand-added
-- statement in a generated file.** The rest are drizzle's own, reviewed as
-- generated, and merged from two passes because a table that both gains and
-- loses a column in one diff makes `drizzle-kit generate` prompt for a rename
-- it cannot ask for without a TTY. `drizzle-kit generate` reports "No schema
-- changes" with this file in place.
DO $$
DECLARE existing bigint;
BEGIN
  SELECT count(*) INTO existing FROM "dispatches";
  IF existing > 0 THEN
    RAISE EXCEPTION '0020 refuses: dispatches is not empty (% row(s)).
A dispatch now carries its own lines (S116) and its sqm is derived from them,
so an existing row would survive as a lineless dispatch reading as 0 m2.
Run: npm run db:reset   then migrate again.
This migration refuses rather than deleting the rows: comments hang on dispatch
ids with no foreign key, so a DELETE would orphan them. There is no production
data (WORKFLOW section 7) - every dispatch is a fixture or verify residue.',
      existing;
  END IF;
END $$;--> statement-breakpoint
CREATE TABLE "dispatch_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispatch_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"fire_rating_id" uuid NOT NULL,
	"custom_colour" text NOT NULL,
	"thickness_id" uuid NOT NULL,
	"width_m" numeric(14, 4) NOT NULL,
	"length_m" numeric(14, 4) NOT NULL,
	"quantity_pcs" numeric(14, 4) NOT NULL,
	"sqm" numeric(14, 4) GENERATED ALWAYS AS (quantity_pcs * width_m * length_m) STORED,
	"unit_price" numeric(14, 2) NOT NULL,
	"line_total" numeric(14, 2) NOT NULL,
	"vat_amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dispatches" ADD COLUMN "quotation_version_id" uuid;--> statement-breakpoint
ALTER TABLE "dispatch_lines" ADD CONSTRAINT "dispatch_lines_dispatch_id_dispatches_id_fk" FOREIGN KEY ("dispatch_id") REFERENCES "public"."dispatches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_lines" ADD CONSTRAINT "dispatch_lines_supplier_id_product_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."product_suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_lines" ADD CONSTRAINT "dispatch_lines_class_id_product_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."product_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_lines" ADD CONSTRAINT "dispatch_lines_fire_rating_id_product_fire_ratings_id_fk" FOREIGN KEY ("fire_rating_id") REFERENCES "public"."product_fire_ratings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_lines" ADD CONSTRAINT "dispatch_lines_thickness_id_product_thicknesses_id_fk" FOREIGN KEY ("thickness_id") REFERENCES "public"."product_thicknesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dispatch_lines_dispatch_idx" ON "dispatch_lines" USING btree ("dispatch_id");--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_quotation_version_id_quotation_versions_id_fk" FOREIGN KEY ("quotation_version_id") REFERENCES "public"."quotation_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_quotation_pair" CHECK ((quotation_thread_id is null) = (quotation_version_id is null));--> statement-breakpoint
ALTER TABLE "dispatches" DROP COLUMN "sqm";