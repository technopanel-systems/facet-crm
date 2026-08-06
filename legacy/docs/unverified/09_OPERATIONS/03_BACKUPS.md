# 03. Backups — FACET CRM

## Current Backup Status

Backups are handled entirely by Supabase's built-in backup infrastructure.

**Automatic Supabase Backups:**
- Supabase Pro plan includes daily backups with 7-day retention (verify current plan)
- Point-in-time recovery available on Pro plan
- Supabase manages backup storage — no action required from the team

---

## Manual Backup Procedure

For critical data before schema changes or bulk operations:

### Export via Supabase Dashboard
1. Go to Supabase Dashboard → Database → Backups
2. Download the latest backup or trigger a manual backup

### Export Specific Tables via SQL Editor
```sql
-- Example: export all companies to CSV
COPY (SELECT * FROM companies) TO STDOUT WITH CSV HEADER;
```
(Execute in SQL Editor, then download the result)

### Schema Backup
```sql
-- Check current schema state
SELECT table_name, column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
```

---

## Code Backup

The GitHub repository (`github.com/technopanel-systems/facet-crm`) serves as the code backup. All commits are preserved.

**Note:** The `schema.sql` file in the repo is NOT guaranteed to reflect production state. Production database is the source of truth.

---

## Recovery Procedures

### Accidental Data Deletion
1. Contact Supabase support for point-in-time recovery (Pro plan)
2. Or restore from daily backup (7-day window on Pro plan)

### Bad Code Deployment
1. Roll back via Vercel deployment history (instant — no data impact)

### Bad Schema Migration
1. No automated rollback exists
2. Manually reverse the SQL change in Supabase SQL Editor
3. Example: If a column was dropped accidentally, re-add it (data may be lost)

---

## Recommendations

1. **Before any bulk SQL operation** (ALTER TABLE, mass UPDATE, DELETE): manually export the affected table via CSV from Supabase dashboard
2. **Before CSV import** of companies: note the current company count so you can verify the import was clean
3. **Consider enabling** Supabase Pro point-in-time recovery for finer granularity than daily backups
