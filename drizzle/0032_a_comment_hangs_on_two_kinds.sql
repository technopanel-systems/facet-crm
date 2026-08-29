-- 0032 — S114, D48, S131: a comment hangs on two kinds, not five.
--
-- **S114 has always said two and the code has always admitted five.** *"Comments
-- exist on quotation threads and projects only. Not on companies, contacts or
-- dispatches."* The CHECK below admitted all five, `COMMENT_RECORD_TYPES` listed
-- five, `visibleCommentsFilter` composed five branches and `CommentBox` rendered
-- on five screens. Every one of those narrows in the same slice — WORKFLOW §7:
-- when a rule replaces an old mechanism, the old mechanism comes out with it.
--
-- **It is a disclosure question, not tidying.** A comment follows its anchor
-- (S131), so a comment on a company reached everyone holding a share of that
-- company. S38 gives a report's private note a narrower audience than that, and
-- a comment has no equivalent half to withhold.
--
-- Counted before generating, on the development database, 29 Aug 2026:
--
--   select record_type::text, count(*) from comments group by 1 order by 1;
--   -- company 3 | project 3 | quotation_thread 15
--   -- contact 0 | dispatch 0
--
-- **All three doomed rows are verify residue, and they say so in their bodies:**
-- `verify-routes en comment`, `verify-routes ar comment` (§9) and
-- `verify-routes turn-panel probe` (§21). `seed:demo` writes none — its
-- `COMMENTS` dataset is `project | quotation_thread` by its own TypeScript type
-- and has been since it was written. WORKFLOW §5 carried `9 company` from
-- 27 Aug and told the next session to re-measure; this is that measurement, and
-- §7 settles what happens to them: there is no production data, so a migration
-- clears rather than preserves. No backfill, no merge, nothing moved.
--
-- Two more counts, both gates rather than statistics:
--
--   -- comment_mentions on the three doomed kinds: 0
--   -- notifications whose payload->>'commentId' names a doomed comment: 0
--
-- The mention DELETE below is written anyway. It clears nothing today; it is
-- the foreign key, not an optimisation, and the next database this runs against
-- will not have been measured. The notification count is 0 because a
-- `mention.received` row is deliberately ANCHORLESS — the record travels in the
-- payload — and all three such rows name quotation-thread comments. (Ten
-- notifications carry `payload->>'recordType'` in the three kinds; every one is
-- `decision.ended_work` on a dispatch, nothing to do with comments. They stay.)
--
-- **The three audit_log rows for the deleted comments stay**, by founder
-- decision. S112 never shows an audit row without joining back to the real
-- record, so an orphan renders nowhere. §7's *a migration clears* is about data;
-- the audit log is history, and S111/S112 treat history as a different thing.
--
-- **0024's enum-rebuild trap does NOT apply here, and that is worth stating so
-- the next reader does not copy a cast that would break this.** 0024 had to drop
-- and recreate `projects_loss_state` because it rebuilt the TYPE: Postgres had
-- stored the CHECK's literal already resolved to `project_end_state`, so casting
-- the column to text left the constraint comparing `text = project_end_state`.
-- Nothing here rebuilds a type. `record_type` is untouched and keeps all five
-- values — `record_shares`, `delete_requests`, `duplicate_flags` and
-- `attachments` all still need them — so `'project'::record_type` resolves
-- exactly as before and no cast is involved at any point.
--
-- **The order of the four statements is load-bearing.** The DELETEs sit between
-- the DROP and the ADD: recreate the constraint first and it fails on its own
-- rows; delete before dropping and the mention delete is fine but the comment
-- delete has nothing to gain from it. Mentions before comments, for the FK.
ALTER TABLE "comments" DROP CONSTRAINT "comments_record_type";
--> statement-breakpoint
DELETE FROM "comment_mentions"
 WHERE "comment_id" IN (
   SELECT "id" FROM "comments"
    WHERE "record_type" IN ('company', 'contact', 'dispatch')
 );
--> statement-breakpoint
DELETE FROM "comments"
 WHERE "record_type" IN ('company', 'contact', 'dispatch');
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_record_type"
  CHECK (record_type in ('project', 'quotation_thread'));
