-- 0008 — the deletion pass. docs/26-deletion-pass.md.
--
-- Hand-reviewed after `drizzle-kit generate`: the generated statement order
-- dropped `product_colours` (CASCADE) before the explicit
-- `quotation_lines_colour_id_product_colours_id_fk` DROP CONSTRAINT, which
-- the cascade had already removed — the explicit drop would have failed
-- against a constraint that no longer existed. Reordered so `colour_id`
-- (and the FK constraint that lives on it) is gone before anything tries to
-- drop the table it pointed to, per `drizzle.config.ts`'s `strict: true` —
-- migrations are reviewed, never left as drizzle-kit decided them.
ALTER TABLE "quotation_lines" DROP CONSTRAINT "quotation_lines_colour_choice";--> statement-breakpoint
ALTER TABLE "quotation_lines" DROP COLUMN "colour_id";--> statement-breakpoint
ALTER TABLE "quotation_lines" ALTER COLUMN "custom_colour" SET NOT NULL;--> statement-breakpoint
DROP TABLE "product_colours";--> statement-breakpoint
DROP TABLE "activities";--> statement-breakpoint
DROP TABLE "tasks";--> statement-breakpoint
DROP TYPE "public"."task_origin";--> statement-breakpoint
DROP TYPE "public"."task_status";--> statement-breakpoint
ALTER TABLE "roles" DROP COLUMN "sees_all_records_readonly";--> statement-breakpoint
ALTER TABLE "company_reps" ALTER COLUMN "origin" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."company_rep_origin";--> statement-breakpoint
CREATE TYPE "public"."company_rep_origin" AS ENUM('self_registered', 'assigned');--> statement-breakpoint
ALTER TABLE "company_reps" ALTER COLUMN "origin" SET DATA TYPE "public"."company_rep_origin" USING "origin"::"public"."company_rep_origin";
