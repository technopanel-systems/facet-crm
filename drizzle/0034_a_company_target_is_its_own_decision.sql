-- 0034 — S136: a company target is its own decision.
--
-- **Two structures, and the rule needs both.** S136 says a company target is one
-- figure for one month, set independently of the reps' targets, by a holder of a
-- flag narrower than `can_set_targets`.
--
-- **`company_targets` is a table rather than a nullable `user_id` on `targets`.**
-- The rule's load-bearing sentence is that neither figure derives from the other,
-- so they are two independent row sets and the schema says so. A nullable FK
-- meaning *this row is the company* would make `targets.user_id` mean two things
-- and drop the company row silently from any INNER JOIN onto `users` — the same
-- failure class CLAUDE.md records for `audit_log.entity_id`. Otherwise it is
-- `targets` exactly minus the person: no unique key, because a same-month
-- correction is a superseding INSERT (S84, S110).
--
-- **`can_set_company_target` is a NEW flag and S136 says so on its face.** No
-- existing flag draws this line: `can_set_targets` is held by the Sales Manager,
-- and `can_export` / `can_impersonate` exclude the right people while meaning
-- other acts. Seeded true for Super Admin alone by `scripts/seed/roles.ts`, which
-- is idempotent — this migration only adds the column, defaulting false, so no
-- role gains a permission until the seed runs.
--
-- **Nothing is preserved or backfilled** (WORKFLOW §7). There is no production
-- data. The manager's own 400 m² target is fixture noise and is NOT migrated into
-- the company figure — S136 makes them independent decisions, so converting one
-- into the other would assert the very derivation the rule forbids. It leaves
-- when `seed:demo` truncates `targets` and the fixture stops writing it.

CREATE TABLE "company_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period" date NOT NULL,
	"sqm" numeric(14, 4) NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"set_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_targets" ADD CONSTRAINT "company_targets_set_by_users_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_targets_period_idx" ON "company_targets" USING btree ("period");--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "can_set_company_target" boolean DEFAULT false NOT NULL;
