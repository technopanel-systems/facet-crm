-- 0005 — activity reporting `docs/20-phase9-decisions.md` §13.
--
-- The first migration since 0004, and the first document since 16 to force one
-- at all. `rep_reports` exists from 0000 but cannot hold what `20 §2` asks: an
-- interaction anchors to a company AND optionally a contact AND optionally a
-- project at the same time, and `09 §1.5`'s polymorphic `record_type` /
-- `record_id` pair can only name one of them. The three columns become
-- explicit, which is what `visibleRepReportsFilter` reads `[20 §10]`.
--
-- **Nothing has ever written this table**, so no data moves and no backfill is
-- needed. `20 §6` records that its sibling `activities` stays empty
-- permanently — the timeline derives its system half on read.
--
-- Two CHECK constraints, per `13 §1`: rules about what a row may contain in
-- isolation belong in the database. That the contact and project belong to the
-- company is a cross-table rule and stays in `src/lib/reports.ts`.
--
-- Statement order is hand-checked, not as generated. The old polymorphic shape
-- is dropped before the new columns are added, so the table is never carrying
-- two contradictory answers to "what is this report about"; the CHECKs come
-- last, because they constrain the finished shape and nothing before them
-- would satisfy `rep_reports_shape`.
--
-- Generated in two passes and merged into one file: drizzle-kit prompts for a
-- rename decision whenever a diff both creates and drops an enum or a column,
-- and it cannot prompt without a TTY. The snapshot committed alongside is the
-- second pass's, which is the true post-state.

CREATE TYPE "public"."rep_report_entry_type" AS ENUM('interaction', 'field_note');--> statement-breakpoint
CREATE TYPE "public"."rep_report_channel" AS ENUM('visit', 'call', 'whatsapp', 'email', 'meeting');--> statement-breakpoint
CREATE TYPE "public"."rep_report_outcome" AS ENUM('introduced', 'catalogue_sent', 'samples_sent', 'documents_sent', 'discussed_pricing', 'no_answer', 'not_interested', 'on_hold', 'other');--> statement-breakpoint
CREATE TYPE "public"."field_note_category" AS ENUM('market_research', 'scouting', 'exhibition', 'training', 'internal');--> statement-breakpoint
CREATE TYPE "public"."report_signal" AS ENUM('price_too_high', 'competitor_cheaper', 'colour_unavailable', 'lead_time_too_long', 'quality_concern', 'payment_terms', 'specification_unavailable', 'project_delayed', 'other');--> statement-breakpoint

DROP INDEX "rep_reports_record_idx";--> statement-breakpoint
ALTER TABLE "rep_reports" DROP COLUMN "record_type";--> statement-breakpoint
ALTER TABLE "rep_reports" DROP COLUMN "record_id";--> statement-breakpoint
ALTER TABLE "rep_reports" DROP COLUMN "kind";--> statement-breakpoint
DROP TYPE "public"."rep_report_kind";--> statement-breakpoint

ALTER TABLE "rep_reports" ADD COLUMN "entry_type" "rep_report_entry_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "rep_reports" ADD COLUMN "company_id" uuid;--> statement-breakpoint
ALTER TABLE "rep_reports" ADD COLUMN "contact_id" uuid;--> statement-breakpoint
ALTER TABLE "rep_reports" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "rep_reports" ADD COLUMN "channel" "rep_report_channel";--> statement-breakpoint
ALTER TABLE "rep_reports" ADD COLUMN "outcome" "rep_report_outcome";--> statement-breakpoint
ALTER TABLE "rep_reports" ADD COLUMN "category" "field_note_category";--> statement-breakpoint
ALTER TABLE "rep_reports" ADD COLUMN "city_id" uuid;--> statement-breakpoint
ALTER TABLE "rep_reports" ADD COLUMN "on_hold_until" date;--> statement-breakpoint
ALTER TABLE "rep_reports" ADD CONSTRAINT "rep_reports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rep_reports" ADD CONSTRAINT "rep_reports_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rep_reports" ADD CONSTRAINT "rep_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rep_reports" ADD CONSTRAINT "rep_reports_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rep_reports_company_idx" ON "rep_reports" USING btree ("company_id","report_date");--> statement-breakpoint
CREATE INDEX "rep_reports_project_idx" ON "rep_reports" USING btree ("project_id","report_date");--> statement-breakpoint

CREATE TABLE "rep_report_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"signal" "report_signal" NOT NULL,
	"reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rep_report_signals" ADD CONSTRAINT "rep_report_signals_report_id_rep_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."rep_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rep_report_signals_key" ON "rep_report_signals" USING btree ("report_id","signal");--> statement-breakpoint
CREATE INDEX "rep_report_signals_signal_idx" ON "rep_report_signals" USING btree ("signal");--> statement-breakpoint

ALTER TABLE "rep_reports" ADD CONSTRAINT "rep_reports_shape" CHECK ((
        entry_type = 'interaction'
        and company_id is not null
        and channel is not null
        and outcome is not null
        and category is null
        and city_id is null
      ) or (
        entry_type = 'field_note'
        and company_id is null
        and contact_id is null
        and project_id is null
        and channel is null
        and outcome is null
        and category is not null
      ));--> statement-breakpoint
ALTER TABLE "rep_reports" ADD CONSTRAINT "rep_reports_on_hold" CHECK ((outcome is distinct from 'on_hold') = (on_hold_until is null));
