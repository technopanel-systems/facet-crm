-- 0035 — S105, S106, S107: the rep's request joins the dormancy review.
--
-- **The vocabulary conflict, resolved by not having two vocabularies.**
-- `delete_requests.status` was `pending / granted / denied` while S105's
-- outcomes are archive · keep · reassign, and `company_dormancy_reviews.outcome`
-- is NOT NULL so it cannot hold an undecided row (WORKFLOW §5, since the schema
-- audit). The request never names an outcome: it records WHO asked, WHY and
-- WHEN, and it is answered by pointing at the review row that decided it —
-- `review_id`, null while the manager has not ruled. The review keeps S106's
-- one record and its three outcomes; the request keeps S105's reason. One
-- table for the decision, one row for the asking, no second status enum.
--
-- **`delete_requests` comes out in the same slice** (CLAUDE.md: when a rule
-- replaces a mechanism, the old one goes). It carried a generic `record_type`
-- for a deletion S107 forbids — "removed" means archived, and only a company
-- is ever removed this way — so a per-company table replaces it and the
-- `delete_request_status` enum goes with it. Nothing is preserved: the table
-- had 0 rows since 0000, and there is no production data (WORKFLOW §7).
--
-- **One open request per company** — the partial unique index. A second press
-- while the first is with the manager is refused in `dormancy.ts` with its own
-- key, and the index is what makes a race refuse rather than double up.

DROP TABLE "delete_requests";--> statement-breakpoint
DROP TYPE "public"."delete_request_status";--> statement-breakpoint
CREATE TABLE "company_removal_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"review_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_removal_requests" ADD CONSTRAINT "company_removal_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_removal_requests" ADD CONSTRAINT "company_removal_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_removal_requests" ADD CONSTRAINT "company_removal_requests_review_id_company_dormancy_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."company_dormancy_reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_removal_requests_open_key" ON "company_removal_requests" USING btree ("company_id") WHERE review_id is null;--> statement-breakpoint
CREATE INDEX "company_removal_requests_requester_idx" ON "company_removal_requests" USING btree ("requested_by_user_id");
