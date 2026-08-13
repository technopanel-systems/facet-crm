-- 0007 — the redesign's schema `docs/25-redesign-decisions.md` Part G.
--
-- Twelve additions and one removal, each traceable to one section of `25`.
-- Nothing here is written by a screen yet: the columns land, and the slices
-- that fill them come after. The exception is the loss writer — see below.
--
--  1. `companies.has_credit_terms` `[25 §7]` — the exception to `07 C3`'s
--     payment gate, a property of the COMPANY rather than a per-dispatch
--     override tick, which would let anyone bypass the gate case by case.
--  2. `loss_reasons` `[25 §5]` — a lookup, not an enum, because the founder
--     will collect real "other" entries and promote or prune the list, which
--     has to be a row and never a migration. Seeded with §5's nine values.
--  3. `projects.lost_reason_id` + `lost_at` + `in_production` `[25 §4, §5]`.
--     `in_production` is DELIBERATELY UNVERIFIED and not connected to the
--     production module: production changes and stock sometimes covers an
--     order, so FACET must not check it.
--  4. `next_follow_up_at` on projects, quotation threads and companies
--     `[25 §18]` — the rep's date outranks the automatic clock. An INPUT to
--     the derivation, not a stored timer, so `20 §9`'s "computed on read,
--     never stored" is intact and `21`'s refusal to write `tasks` stands.
--  5. `comments` + `comment_mentions` `[25 §9, §11]` — what colleagues say to
--     each other about a record, as distinct from a report, which is what
--     happened with the customer. People-tagging only; record-tagging is its
--     own piece of work `[25 H2]`.
--  6. `rep_reports.reference` `[25 §34]` — a sample number or colour code
--     beside the outcome, so "Sample #2 → 168" is a value, not a sentence.
--  7. `roles.sees_all_records_readonly` `[25 §28]` — a THIRD visibility tier,
--     which FACET has never had. Deliberately NOT folded into `sees_all_reps`.
--  8. `quotation_threads.closed_at` + `closed_by_user_id` `[25 §24]`.
--  9. `rep_report_outcome` gains `technical_submitting` `[25 §2]` — an
--     activity like the others, not a stage `[25 §1]`.
--
-- **`tasks` gains nothing, and that is a finding rather than an omission**
-- `[25 §20]`. Manual tasks are built for the two human origins only; `21`
-- overruled `10 §9`'s self-closing system task and `25 §19` confirms it, so
-- `origin: 'system'` and `system_trigger` stay unwritten the way `13 §2` keeps
-- `form_factor`. The 33 rows in the database are all `assigned`.
--
-- **Warmth is dropped** `[25 §6]`. `10 §1` proposed Cold / Warm / Hot /
-- Dormant; the founder does not recognise the term and cut it entirely.
-- 0 of 177 companies carried a value and `pipeline_snapshots` is empty, so
-- nothing moves and nothing is lost. `10 §1`'s derived-qualification half
-- stands `[25 §16]`.
--
-- Withdrawn rather than added: any tolerance setting `[25 §23]` and any
-- sales-desk structure `[25 §35]`.
--
-- Five CHECKs, per `13 §1`: what a row may contain in isolation belongs in the
-- database, while who may act stays in one application layer. One rule cannot
-- come here — *`other` requires `loss_reason`, every other code forbids it* —
-- because a CHECK may not subquery to read the code behind a uuid; it lives in
-- `src/lib/projects.ts`, and `verify:schema25` records that as a stated gap.
--
-- `projects_loss_detail` is why this migration ships with a code change.
-- `src/lib/projects.ts` wrote `loss_reason` as free text with no id, which the
-- CHECK refuses; zero rows meant the migration applied cleanly while the first
-- rep to mark a project lost found a 500, and no kept script drives that path.
-- The writer now writes the three loss columns together.
--
-- Statement order is hand-checked, not as generated. `ALTER TYPE … ADD VALUE`
-- is legal inside a transaction on PG12+ so long as nothing USES the value in
-- the same transaction, which nothing here does. The CHECKs come last, because
-- they constrain the finished shape.
--
-- Generated in two passes and merged into one file, for the reason `0005`
-- records: `companies` both gains and loses columns, drizzle-kit prompts
-- "created or renamed?" for exactly that, and it cannot prompt without a TTY.
-- Pass 2's snapshot is the one committed, with its `prevId` repointed at
-- 0006's, and `npx drizzle-kit generate` reports no schema changes after.

ALTER TYPE "public"."rep_report_outcome" ADD VALUE 'technical_submitting' BEFORE 'discussed_pricing';--> statement-breakpoint
CREATE TABLE "comment_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"mentioned_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_type" "record_type" NOT NULL,
	"record_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comments_record_type" CHECK (record_type in ('company', 'contact', 'project', 'quotation_thread', 'dispatch'))
);
--> statement-breakpoint
CREATE TABLE "loss_reasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" DROP CONSTRAINT "companies_warmth_set_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "has_credit_terms" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "next_follow_up_at" date;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "lost_reason_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "lost_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "in_production" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "next_follow_up_at" date;--> statement-breakpoint
ALTER TABLE "quotation_threads" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotation_threads" ADD COLUMN "closed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "quotation_threads" ADD COLUMN "next_follow_up_at" date;--> statement-breakpoint
ALTER TABLE "rep_reports" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "sees_all_records_readonly" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_mentioned_user_id_users_id_fk" FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "comment_mentions_key" ON "comment_mentions" USING btree ("comment_id","mentioned_user_id");--> statement-breakpoint
CREATE INDEX "comment_mentions_user_idx" ON "comment_mentions" USING btree ("mentioned_user_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_record_idx" ON "comments" USING btree ("record_type","record_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_author_idx" ON "comments" USING btree ("author_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "loss_reasons_code_key" ON "loss_reasons" USING btree ("code");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_lost_reason_id_loss_reasons_id_fk" FOREIGN KEY ("lost_reason_id") REFERENCES "public"."loss_reasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_threads" ADD CONSTRAINT "quotation_threads_closed_by_user_id_users_id_fk" FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" DROP COLUMN "warmth";--> statement-breakpoint
ALTER TABLE "companies" DROP COLUMN "warmth_set_by";--> statement-breakpoint
ALTER TABLE "companies" DROP COLUMN "warmth_set_at";--> statement-breakpoint
ALTER TABLE "pipeline_snapshots" DROP COLUMN "warmth";--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_loss_pair" CHECK ((lost_reason_id is null) = (lost_at is null));--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_loss_detail" CHECK (loss_reason is null or lost_reason_id is not null);--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_loss_state" CHECK (lost_reason_id is null or end_state is not distinct from 'lost');--> statement-breakpoint
ALTER TABLE "quotation_threads" ADD CONSTRAINT "quotation_threads_closed" CHECK ((closed_at is null) = (closed_by_user_id is null));--> statement-breakpoint
ALTER TABLE "rep_reports" ADD CONSTRAINT "rep_reports_reference" CHECK (reference is null or entry_type = 'interaction');--> statement-breakpoint
DROP TYPE "public"."warmth";
