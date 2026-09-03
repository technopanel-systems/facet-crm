-- 0036 — S94: the calendar of non-working time, in two kinds.
--
-- **Public holidays** — Eid, national days — a date range with no person,
-- affecting everyone. **Personal leave** — annual leave, sick leave, any
-- absence — a range for one person. Both are skipped by the pace bar (D32,
-- D39, D79) and by the working-day reminders (S87's two working-day
-- thresholds), the founder's words: "if a rep is off for two weeks, his pace
-- bar and his reminders should know it, otherwise he comes back to a screen
-- telling him he's behind and neglecting customers he couldn't have called."
--
-- One table, one row per range, and the CHECK holds the kind to the person:
-- a holiday never belongs to somebody, leave never belongs to nobody. Soft
-- removal (`removed_at`) because nothing is deleted (S107) and a holiday typed
-- on the wrong week has to stop counting without leaving the audit trail.
--
-- The readers are `src/lib/calendar.ts` and nothing else (CLAUDE.md, one
-- definition): `working-days.ts` stays pure and takes the set this table
-- builds. Written by hand like 0032–0035 — the snapshots stop at 0031.

CREATE TYPE "public"."non_working_kind" AS ENUM('public_holiday', 'leave');--> statement-breakpoint
CREATE TABLE "non_working_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "non_working_kind" NOT NULL,
	"user_id" uuid,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"label" text NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by_user_id" uuid,
	CONSTRAINT "non_working_days_kind_person" CHECK ((kind = 'public_holiday') = (user_id is null)),
	CONSTRAINT "non_working_days_range" CHECK (ends_on >= starts_on)
);
--> statement-breakpoint
ALTER TABLE "non_working_days" ADD CONSTRAINT "non_working_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "non_working_days" ADD CONSTRAINT "non_working_days_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "non_working_days" ADD CONSTRAINT "non_working_days_removed_by_user_id_users_id_fk" FOREIGN KEY ("removed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "non_working_days_range_idx" ON "non_working_days" USING btree ("user_id","starts_on","ends_on");
