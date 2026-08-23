-- 0027 - the dead-structure sweep. AUDIT 1 F9-F18 and WORKFLOW section 5.
--
-- Ten columns, one enum value, two whole enum types and four indexes, none of
-- which any rule in SPEC.md asks for. Counted live on 24 Aug 2026, after 26
-- migrations, before this was generated.
--
-- **None of it is recent drift, and that is the finding.** Ten of the fifteen
-- trace to 0000 and the rest to 0002, 0005 and 0007 - all generated from
-- docs/09-schema-design.md before SPEC.md existed. has_credit_terms landing a
-- whole slice ahead of both its rules was not an anomaly; it is what the
-- original schema did throughout, and the eighteen sessions since have been
-- removing it. Nothing shipped in that window added dead structure.
--
-- WHAT GOES, and why each is dead rather than merely unused:
--
--   users.city_id - 0 of 401. createUser took a cityId parameter and wrote the
--     column; no form, action or select ever supplied or read one, so the
--     parameter was the only thing making it look alive. 10 section 7 asked
--     for region AND city; only region ever gained a reader, and it stays.
--
--   quotation_threads.cancelled_at - 9 of 636 written by cancelThread, read by
--     nothing. cancelled_by_user_id beside it IS read and stays.
--     dispatches.cancellation_reason's header cited this column as the
--     counter-example for having no stamp of its own; the two now agree.
--
--   quotation_lines.form_factor - 850 of 850 'sheet'. 12 section 11 said
--     quotation lines are sheets only, so the application wrote the constant
--     and nothing ever read it back or set 'coil'. dispatch_lines refused to
--     copy it when S116 landed, on exactly this reasoning.
--
--   notifications.channel - 620 rows, every one in_app, and no query, screen
--     or filter anywhere.
--
--   notification_types.default_channel - 7 of 7 in_app. The clearest case in
--     the sweep of a column whose reader was itself dead: the one query that
--     read it read it only to stamp notifications.channel, which nothing read.
--     04 Q17/C3 wanted the column "from day one so adding a channel is a
--     migration, not a rewrite of every call site" - speculative generality,
--     and no rule ever asked for a second channel.
--
--   product_suppliers.code, product_classes.code, product_fire_ratings.code -
--     never rendered on any screen. They were the token of a generated product
--     name S53 says FACET does not produce, and survived only as the ORDER BY
--     of three dropdowns. An ORDER BY is not a reader. **No data is lost**:
--     08 B1 says an invented longer form would be fiction, so the code and
--     name_en were the same string in every seeded row, and the three seeds
--     and five verify scripts now key on name_en instead.
--
--   record_type.quotation_version - 0 rows across ALL SEVEN columns of the
--     type. comments_record_type excluded it, SHARED_RECORD_TYPES and
--     ANCHOR_TYPES exclude it, and a version is reached through its thread, so
--     nothing hangs off one directly. It is the canonical dead value:
--     dispatchStatusEnum's header cites it by name for why 'cancelled' waited
--     for cancelDispatch rather than landing early. The
--     entityType: "quotation_version" strings in quotations.ts are
--     audit_log.entity_type, which is free text and not this type.
--
--   form_factor, notification_channel - both types lose their last column
--     above, so both are a plain DROP TYPE. record_type is the one that needs
--     the rebuild, because six other columns still carry it.
--
--   comments_author_idx, comment_mentions_user_idx,
--   rep_report_signals_signal_idx - AUDIT 1 F15's three live ones. No query
--     filters or orders by any of them: comment readers reach users through
--     its primary key, the one mention predicate sits inside a delete already
--     scoped by comment_id, and every signal query leads with report_id, which
--     rep_report_signals_key already serves. The last was landed in 0005 for
--     S49, which is still [BUILD] - an index built ahead of its query, the
--     same defect CLAUDE.md names for a column built ahead of its writer.
--
--   audit_log_actor_idx - **the eleventh of AUDIT 1's ten.** Every reader that
--     cares who acted asks for the effective actor,
--     coalesce(acting_as_user_id, actor_user_id) (07 A6), and a btree on one
--     of the two columns cannot serve a coalesce over both.
--
-- WHAT STAYS, examined and deliberately left, because a rule still asks:
-- attachments (S115); delete_requests (S105-S107); duplicate_flags and
-- non_duplicates (S21-S23); companies.merged_into_id and its index (S21-S23);
-- quotation_threads.closed_at, closed_by_user_id and the
-- quotation_threads_closed CHECK that guards them (S47 - losing a project
-- closes every open quotation under it); roles.can_export, can_approve_delete
-- and can_resolve_duplicate (S8 - "all three flags must be read by the code;
-- today none are"); product_specifications (SPEC section 16, still open).
-- F14's six indexes go with their tables, not before them. Unused was never
-- the test - unwanted was.
--
-- **The CHECK has to come out and go back, and drizzle-kit does not know it.**
-- 0024 recorded this trap for projects_loss_state and it applies here
-- unchanged: comments_record_type is stored as
--   record_type = ANY (ARRAY['company'::record_type, ...])
-- with every literal already resolved to the type. Casting the column to text
-- leaves the constraint comparing text to record_type and the migration aborts
-- with "operator does not exist: text = record_type". So it is dropped before
-- the swap and recreated after, while the column is an enum again, with the
-- expression schema.ts declares - unchanged in meaning, re-parsed against the
-- new type. The other six record_type columns carry no CHECK.
--
-- **No UPDATE before the swap**, unlike 0024. 0 rows carry quotation_version,
-- so the generated USING cast has nothing it cannot represent. There is
-- nothing to preserve here that db:reset would not recreate (WORKFLOW 7).
--
-- Drizzle's DDL is reviewed as generated and otherwise left alone; the
-- constraint pair around the type swap is hand-written, and the FK drop is
-- moved to sit beside the column it belongs to.
ALTER TABLE "comments" DROP CONSTRAINT "comments_record_type";
--> statement-breakpoint
ALTER TABLE "attachments" ALTER COLUMN "record_type" SET DATA TYPE text;
--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "record_type" SET DATA TYPE text;
--> statement-breakpoint
ALTER TABLE "delete_requests" ALTER COLUMN "record_type" SET DATA TYPE text;
--> statement-breakpoint
ALTER TABLE "duplicate_flags" ALTER COLUMN "record_type" SET DATA TYPE text;
--> statement-breakpoint
ALTER TABLE "non_duplicates" ALTER COLUMN "record_type" SET DATA TYPE text;
--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "record_type" SET DATA TYPE text;
--> statement-breakpoint
ALTER TABLE "record_shares" ALTER COLUMN "record_type" SET DATA TYPE text;
--> statement-breakpoint
DROP TYPE "public"."record_type";
--> statement-breakpoint
CREATE TYPE "public"."record_type" AS ENUM('company', 'contact', 'project', 'quotation_thread', 'dispatch');
--> statement-breakpoint
ALTER TABLE "attachments" ALTER COLUMN "record_type" SET DATA TYPE "public"."record_type" USING "record_type"::"public"."record_type";
--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "record_type" SET DATA TYPE "public"."record_type" USING "record_type"::"public"."record_type";
--> statement-breakpoint
ALTER TABLE "delete_requests" ALTER COLUMN "record_type" SET DATA TYPE "public"."record_type" USING "record_type"::"public"."record_type";
--> statement-breakpoint
ALTER TABLE "duplicate_flags" ALTER COLUMN "record_type" SET DATA TYPE "public"."record_type" USING "record_type"::"public"."record_type";
--> statement-breakpoint
ALTER TABLE "non_duplicates" ALTER COLUMN "record_type" SET DATA TYPE "public"."record_type" USING "record_type"::"public"."record_type";
--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "record_type" SET DATA TYPE "public"."record_type" USING "record_type"::"public"."record_type";
--> statement-breakpoint
ALTER TABLE "record_shares" ALTER COLUMN "record_type" SET DATA TYPE "public"."record_type" USING "record_type"::"public"."record_type";
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_record_type" CHECK (record_type in ('company', 'contact', 'project', 'quotation_thread', 'dispatch'));
--> statement-breakpoint
DROP INDEX "audit_log_actor_idx";
--> statement-breakpoint
DROP INDEX "comment_mentions_user_idx";
--> statement-breakpoint
DROP INDEX "comments_author_idx";
--> statement-breakpoint
DROP INDEX "rep_report_signals_signal_idx";
--> statement-breakpoint
ALTER TABLE "notification_types" DROP COLUMN "default_channel";
--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "channel";
--> statement-breakpoint
ALTER TABLE "product_classes" DROP COLUMN "code";
--> statement-breakpoint
ALTER TABLE "product_fire_ratings" DROP COLUMN "code";
--> statement-breakpoint
ALTER TABLE "product_suppliers" DROP COLUMN "code";
--> statement-breakpoint
ALTER TABLE "quotation_lines" DROP COLUMN "form_factor";
--> statement-breakpoint
ALTER TABLE "quotation_threads" DROP COLUMN "cancelled_at";
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_city_id_cities_id_fk";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "city_id";
--> statement-breakpoint
DROP TYPE "public"."form_factor";
--> statement-breakpoint
DROP TYPE "public"."notification_channel";
