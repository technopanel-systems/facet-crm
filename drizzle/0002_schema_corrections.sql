-- 0002 — the schema changes required by `docs/12-closing-open-items.md` §14.
--
-- Statement order is hand-checked, not as generated: the project–company role
-- FK and column are dropped BEFORE `project_company_roles` itself, so the
-- table drop needs no CASCADE and no statement depends on an object a
-- previous one already removed.

--> §14.1, §14.5 — the role vocabulary is dropped; the label becomes free text.
ALTER TABLE "project_companies" DROP CONSTRAINT "project_companies_role_id_project_company_roles_id_fk";--> statement-breakpoint
ALTER TABLE "project_companies" DROP COLUMN "role_id";--> statement-breakpoint
ALTER TABLE "project_companies" ADD COLUMN "role" text;--> statement-breakpoint
DROP TABLE "project_company_roles";--> statement-breakpoint

--> §14.3 — specifications key on supplier too.
ALTER TABLE "product_specifications" ADD COLUMN "supplier_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "product_specifications" ADD CONSTRAINT "product_specifications_supplier_id_product_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."product_suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DROP INDEX "product_specifications_key";--> statement-breakpoint
CREATE UNIQUE INDEX "product_specifications_key" ON "product_specifications" USING btree ("supplier_id","class_id","fire_rating_id","thickness_id");--> statement-breakpoint

--> §14.4 / §12 — a line carries a lookup colour or a custom one, never both.
ALTER TABLE "quotation_lines" ALTER COLUMN "colour_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD COLUMN "custom_colour" text;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_colour_choice" CHECK (num_nonnulls(colour_id, custom_colour) = 1);--> statement-breakpoint

--> §14.6 / §1 / §3 — three permission flags, granted by the role seed.
ALTER TABLE "roles" ADD COLUMN "can_set_credit_split" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "can_approve_delete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "can_resolve_duplicate" boolean DEFAULT false NOT NULL;

-- §14.2 needs no statement. "At most one buyer" is exactly what the existing
-- partial unique index `project_companies_one_buyer_key` says — it constrains
-- rows where `is_buyer` is true and says nothing when none is. The "exactly
-- one" of `09 §3.5` was never expressed in the database; `12 §6` withdraws it.
