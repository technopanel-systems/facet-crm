CREATE TYPE "public"."company_rep_origin" AS ENUM('self_registered', 'assigned', 'shared', 'merge');--> statement-breakpoint
CREATE TYPE "public"."delete_request_status" AS ENUM('pending', 'granted', 'denied');--> statement-breakpoint
CREATE TYPE "public"."duplicate_flag_source" AS ENUM('entry_match', 'manual');--> statement-breakpoint
CREATE TYPE "public"."duplicate_flag_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."duplicate_resolution" AS ENUM('who_continues', 'shared', 'false_flag');--> statement-breakpoint
CREATE TYPE "public"."form_factor" AS ENUM('sheet', 'coil');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app');--> statement-breakpoint
CREATE TYPE "public"."notification_tier" AS ENUM('act_now', 'digest');--> statement-breakpoint
CREATE TYPE "public"."project_end_state" AS ENUM('won', 'lost', 'dormant');--> statement-breakpoint
CREATE TYPE "public"."quotation_thread_end_state" AS ENUM('accepted', 'rejected', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."quotation_version_origin" AS ENUM('initial_request', 'rep_change_request', 'coordinator_direct_edit', 'expiry_revision');--> statement-breakpoint
CREATE TYPE "public"."quotation_version_status" AS ENUM('requested', 'issued', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."record_type" AS ENUM('company', 'contact', 'project', 'quotation_thread', 'quotation_version', 'dispatch');--> statement-breakpoint
CREATE TYPE "public"."region" AS ENUM('center', 'north', 'south', 'east', 'west');--> statement-breakpoint
CREATE TYPE "public"."rep_report_kind" AS ENUM('visit', 'call');--> statement-breakpoint
CREATE TYPE "public"."smac_reference_verification" AS ENUM('unverified', 'verified');--> statement-breakpoint
CREATE TYPE "public"."task_origin" AS ENUM('self', 'assigned', 'system');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."warmth" AS ENUM('cold', 'warm', 'hot', 'dormant');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"activity_type" text NOT NULL,
	"record_type" "record_type" NOT NULL,
	"record_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_type" "record_type" NOT NULL,
	"record_id" uuid NOT NULL,
	"path" text NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"acting_as_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text,
	"name_normalized" text NOT NULL,
	"phone" text,
	"category_id" uuid,
	"vat_number" text,
	"region" "region",
	"city_id" uuid,
	"lead_source_id" uuid,
	"notes" text,
	"warmth" "warmth",
	"warmth_set_by" uuid,
	"warmth_set_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"merged_into_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_reps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"origin" "company_rep_origin" NOT NULL,
	"removed_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text,
	"name_normalized" text NOT NULL,
	"phone" text,
	"email" text,
	"position" text,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delete_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_type" "record_type" NOT NULL,
	"record_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" "delete_request_status" DEFAULT 'pending' NOT NULL,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispatches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"sqm" numeric(14, 4) NOT NULL,
	"quotation_thread_id" uuid,
	"dispatch_date" date NOT NULL,
	"recorded_by_user_id" uuid NOT NULL,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "duplicate_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_type" "record_type" NOT NULL,
	"record_a_id" uuid NOT NULL,
	"record_b_id" uuid NOT NULL,
	"source" "duplicate_flag_source" NOT NULL,
	"status" "duplicate_flag_status" DEFAULT 'open' NOT NULL,
	"resolution" "duplicate_resolution",
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "non_duplicates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_type" "record_type" NOT NULL,
	"record_a_id" uuid NOT NULL,
	"record_b_id" uuid NOT NULL,
	"decided_by_user_id" uuid NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"tier" "notification_tier" NOT NULL,
	"default_channel" "notification_channel" DEFAULT 'in_app' NOT NULL,
	"is_persistent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"notification_type_id" uuid NOT NULL,
	"channel" "notification_channel" DEFAULT 'in_app' NOT NULL,
	"record_type" "record_type",
	"record_id" uuid,
	"read_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period" date NOT NULL,
	"user_id" uuid NOT NULL,
	"target_sqm" numeric(14, 4),
	"achieved_sqm" numeric(14, 4),
	"quotations_raised" integer DEFAULT 0 NOT NULL,
	"quotations_accepted" integer DEFAULT 0 NOT NULL,
	"dispatch_count" integer DEFAULT 0 NOT NULL,
	"activity_count" integer DEFAULT 0 NOT NULL,
	"reports_submitted" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period" date NOT NULL,
	"record_type" "record_type" NOT NULL,
	"record_id" uuid NOT NULL,
	"derived_stage" text,
	"warmth" "warmth",
	"owner_user_id" uuid,
	"sqm_expected" numeric(14, 4),
	"value" numeric(14, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_colours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_fire_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_specifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"fire_rating_id" uuid NOT NULL,
	"thickness_id" uuid NOT NULL,
	"description_en" text,
	"description_ar" text,
	"manufacturing_standards_en" text,
	"manufacturing_standards_ar" text,
	"alloy_en" text,
	"alloy_ar" text,
	"layers_en" text,
	"layers_ar" text,
	"core_en" text,
	"core_ar" text,
	"protective_film_en" text,
	"protective_film_ar" text,
	"colour_availability_en" text,
	"colour_availability_ar" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_thicknesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thickness_mm" numeric(5, 2) NOT NULL,
	"is_standard" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"role_id" uuid,
	"is_buyer" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_company_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_credit_splits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"percentage" numeric(5, 2),
	"effective_from" date NOT NULL,
	"set_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text,
	"name_normalized" text NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"sqm_expected" numeric(14, 4),
	"end_state" "project_end_state",
	"loss_reason" text,
	"region" "region",
	"city_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotation_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"fire_rating_id" uuid NOT NULL,
	"colour_id" uuid NOT NULL,
	"thickness_id" uuid NOT NULL,
	"form_factor" "form_factor" NOT NULL,
	"width_m" numeric(14, 4) NOT NULL,
	"length_m" numeric(14, 4) NOT NULL,
	"quantity_pcs" numeric(14, 4) NOT NULL,
	"sqm" numeric(14, 4) GENERATED ALWAYS AS (quantity_pcs * width_m * length_m) STORED,
	"unit_price" numeric(14, 2),
	"line_total" numeric(14, 2),
	"vat_rate" numeric(5, 2),
	"vat_amount" numeric(14, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotation_service_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"service_type_id" uuid NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"unit" text NOT NULL,
	"unit_price" numeric(14, 2),
	"quotation_line_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotation_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"contact_id" uuid,
	"raised_by_user_id" uuid NOT NULL,
	"end_state" "quotation_thread_end_state",
	"cancelled_by_user_id" uuid,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"payment_confirmed_by_user_id" uuid,
	"payment_confirmed_at" timestamp with time zone,
	"accepted_for_processing_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotation_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"smac_reference" text,
	"smac_reference_verification" "smac_reference_verification" DEFAULT 'unverified' NOT NULL,
	"origin" "quotation_version_origin" NOT NULL,
	"status" "quotation_version_status" DEFAULT 'requested' NOT NULL,
	"return_for_edit_round" integer DEFAULT 0 NOT NULL,
	"valid_until" date,
	"delivery_period" text,
	"payment_method" text,
	"shipment_terms" text,
	"total_sqm" numeric(14, 4),
	"total_excl_vat" numeric(14, 2),
	"total_vat" numeric(14, 2),
	"grand_total" numeric(14, 2),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_type" "record_type" NOT NULL,
	"record_id" uuid NOT NULL,
	"shared_with_user_id" uuid NOT NULL,
	"shared_by_user_id" uuid NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rep_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"record_type" "record_type" NOT NULL,
	"record_id" uuid NOT NULL,
	"kind" "rep_report_kind" NOT NULL,
	"narrative" text NOT NULL,
	"report_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"can_assign" boolean DEFAULT false NOT NULL,
	"can_share" boolean DEFAULT false NOT NULL,
	"can_export" boolean DEFAULT false NOT NULL,
	"can_set_targets" boolean DEFAULT false NOT NULL,
	"sees_all_reps" boolean DEFAULT false NOT NULL,
	"can_dispatch" boolean DEFAULT false NOT NULL,
	"can_approve_quotation" boolean DEFAULT false NOT NULL,
	"can_impersonate" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period" date NOT NULL,
	"sqm" numeric(14, 4) NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"set_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"origin" "task_origin" NOT NULL,
	"assigned_to_user_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"record_type" "record_type",
	"record_id" uuid,
	"due_date" date,
	"status" "task_status" DEFAULT 'open' NOT NULL,
	"completed_at" timestamp with time zone,
	"system_trigger" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role_id" uuid NOT NULL,
	"region" "region",
	"city_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_acting_as_user_id_users_id_fk" FOREIGN KEY ("acting_as_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_category_id_company_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."company_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_lead_source_id_lead_sources_id_fk" FOREIGN KEY ("lead_source_id") REFERENCES "public"."lead_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_warmth_set_by_users_id_fk" FOREIGN KEY ("warmth_set_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_merged_into_id_companies_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_reps" ADD CONSTRAINT "company_reps_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_reps" ADD CONSTRAINT "company_reps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_reps" ADD CONSTRAINT "company_reps_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delete_requests" ADD CONSTRAINT "delete_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delete_requests" ADD CONSTRAINT "delete_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_quotation_thread_id_quotation_threads_id_fk" FOREIGN KEY ("quotation_thread_id") REFERENCES "public"."quotation_threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_flags" ADD CONSTRAINT "duplicate_flags_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "non_duplicates" ADD CONSTRAINT "non_duplicates_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_notification_type_id_notification_types_id_fk" FOREIGN KEY ("notification_type_id") REFERENCES "public"."notification_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_snapshots" ADD CONSTRAINT "person_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_snapshots" ADD CONSTRAINT "pipeline_snapshots_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_specifications" ADD CONSTRAINT "product_specifications_class_id_product_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."product_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_specifications" ADD CONSTRAINT "product_specifications_fire_rating_id_product_fire_ratings_id_fk" FOREIGN KEY ("fire_rating_id") REFERENCES "public"."product_fire_ratings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_specifications" ADD CONSTRAINT "product_specifications_thickness_id_product_thicknesses_id_fk" FOREIGN KEY ("thickness_id") REFERENCES "public"."product_thicknesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_companies" ADD CONSTRAINT "project_companies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_companies" ADD CONSTRAINT "project_companies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_companies" ADD CONSTRAINT "project_companies_role_id_project_company_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."project_company_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_credit_splits" ADD CONSTRAINT "project_credit_splits_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_credit_splits" ADD CONSTRAINT "project_credit_splits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_credit_splits" ADD CONSTRAINT "project_credit_splits_set_by_users_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_version_id_quotation_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."quotation_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_supplier_id_product_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."product_suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_class_id_product_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."product_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_fire_rating_id_product_fire_ratings_id_fk" FOREIGN KEY ("fire_rating_id") REFERENCES "public"."product_fire_ratings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_colour_id_product_colours_id_fk" FOREIGN KEY ("colour_id") REFERENCES "public"."product_colours"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_thickness_id_product_thicknesses_id_fk" FOREIGN KEY ("thickness_id") REFERENCES "public"."product_thicknesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_service_lines" ADD CONSTRAINT "quotation_service_lines_version_id_quotation_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."quotation_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_service_lines" ADD CONSTRAINT "quotation_service_lines_service_type_id_service_types_id_fk" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_service_lines" ADD CONSTRAINT "quotation_service_lines_quotation_line_id_quotation_lines_id_fk" FOREIGN KEY ("quotation_line_id") REFERENCES "public"."quotation_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_threads" ADD CONSTRAINT "quotation_threads_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_threads" ADD CONSTRAINT "quotation_threads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_threads" ADD CONSTRAINT "quotation_threads_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_threads" ADD CONSTRAINT "quotation_threads_raised_by_user_id_users_id_fk" FOREIGN KEY ("raised_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_threads" ADD CONSTRAINT "quotation_threads_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_threads" ADD CONSTRAINT "quotation_threads_payment_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("payment_confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_versions" ADD CONSTRAINT "quotation_versions_thread_id_quotation_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."quotation_threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_versions" ADD CONSTRAINT "quotation_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_shares" ADD CONSTRAINT "record_shares_shared_with_user_id_users_id_fk" FOREIGN KEY ("shared_with_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_shares" ADD CONSTRAINT "record_shares_shared_by_user_id_users_id_fk" FOREIGN KEY ("shared_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_shares" ADD CONSTRAINT "record_shares_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rep_reports" ADD CONSTRAINT "rep_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_set_by_users_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_user_idx" ON "activities" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "activities_record_idx" ON "activities" USING btree ("record_type","record_id");--> statement-breakpoint
CREATE INDEX "attachments_record_idx" ON "attachments" USING btree ("record_type","record_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "companies_name_normalized_idx" ON "companies" USING btree ("name_normalized");--> statement-breakpoint
CREATE INDEX "companies_phone_idx" ON "companies" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "companies_merged_into_idx" ON "companies" USING btree ("merged_into_id");--> statement-breakpoint
CREATE UNIQUE INDEX "company_reps_active_key" ON "company_reps" USING btree ("company_id","user_id") WHERE removed_at is null;--> statement-breakpoint
CREATE INDEX "company_reps_user_idx" ON "company_reps" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "contacts_company_idx" ON "contacts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "contacts_name_normalized_idx" ON "contacts" USING btree ("name_normalized");--> statement-breakpoint
CREATE INDEX "delete_requests_record_idx" ON "delete_requests" USING btree ("record_type","record_id");--> statement-breakpoint
CREATE INDEX "dispatches_user_date_idx" ON "dispatches" USING btree ("user_id","dispatch_date");--> statement-breakpoint
CREATE INDEX "dispatches_company_idx" ON "dispatches" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "dispatches_thread_idx" ON "dispatches" USING btree ("quotation_thread_id");--> statement-breakpoint
CREATE INDEX "duplicate_flags_a_idx" ON "duplicate_flags" USING btree ("record_type","record_a_id");--> statement-breakpoint
CREATE INDEX "duplicate_flags_b_idx" ON "duplicate_flags" USING btree ("record_type","record_b_id");--> statement-breakpoint
CREATE UNIQUE INDEX "non_duplicates_pair_key" ON "non_duplicates" USING btree ("record_type","record_a_id","record_b_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_types_key" ON "notification_types" USING btree ("key");--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("recipient_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "person_snapshots_key" ON "person_snapshots" USING btree ("period","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pipeline_snapshots_key" ON "pipeline_snapshots" USING btree ("period","record_type","record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_specifications_key" ON "product_specifications" USING btree ("class_id","fire_rating_id","thickness_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_companies_key" ON "project_companies" USING btree ("project_id","company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_companies_one_buyer_key" ON "project_companies" USING btree ("project_id") WHERE is_buyer;--> statement-breakpoint
CREATE INDEX "project_credit_splits_project_idx" ON "project_credit_splits" USING btree ("project_id","effective_from");--> statement-breakpoint
CREATE INDEX "projects_owner_idx" ON "projects" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "projects_name_normalized_idx" ON "projects" USING btree ("name_normalized");--> statement-breakpoint
CREATE INDEX "quotation_lines_version_idx" ON "quotation_lines" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "quotation_service_lines_version_idx" ON "quotation_service_lines" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "quotation_threads_project_idx" ON "quotation_threads" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "quotation_threads_company_idx" ON "quotation_threads" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotation_versions_thread_number_key" ON "quotation_versions" USING btree ("thread_id","version_number");--> statement-breakpoint
CREATE INDEX "record_shares_record_idx" ON "record_shares" USING btree ("record_type","record_id");--> statement-breakpoint
CREATE INDEX "record_shares_user_idx" ON "record_shares" USING btree ("shared_with_user_id");--> statement-breakpoint
CREATE INDEX "rep_reports_user_date_idx" ON "rep_reports" USING btree ("user_id","report_date");--> statement-breakpoint
CREATE INDEX "rep_reports_record_idx" ON "rep_reports" USING btree ("record_type","record_id");--> statement-breakpoint
CREATE INDEX "targets_user_period_idx" ON "targets" USING btree ("user_id","period");--> statement-breakpoint
CREATE INDEX "tasks_assignee_status_idx" ON "tasks" USING btree ("assigned_to_user_id","status");--> statement-breakpoint
CREATE INDEX "tasks_record_idx" ON "tasks" USING btree ("record_type","record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");