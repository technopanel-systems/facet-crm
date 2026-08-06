# 03. Technical Debt — FACET CRM

## Priority Classification

- 🔴 HIGH — Actively causes bugs or data quality issues
- 🟡 MEDIUM — Causes confusion or maintenance burden
- 🟢 LOW — Cosmetic or future-cleanup items

---

## Database Debt

### 🟡 `projects.company_name` — Legacy Text Cache
**What it is:** A text column storing the company name at the time of project creation.  
**Why it exists:** Was used before the `customer_id` FK was added. Now redundant.  
**Impact:** Can become stale if a company is renamed after project creation.  
**Fix:** Drop the column. Always derive company name via join on `customer_id → companies.company_name`.  
**Blocked by:** Need to audit all pages that read `projects.company_name` directly vs via join.

### 🟡 `activities.rep_name` — Legacy Text Cache
**What it is:** A text column storing the rep name at activity submission time.  
**Why it exists:** Old approach before `rep_id` FK was reliable.  
**Impact:** Manager activities page filters by `rep_id` UUID correctly. Some display code may still use `rep_name` text for display.  
**Fix:** Drop column. Always join `reps` on `rep_id` for name display.

### 🟡 `projects.assigned_rep_id` — Legacy Cache
**What it is:** A UUID column caching the primary rep, alongside the `project_reps` junction table.  
**Why it exists:** Kept as fallback for projects that may not have a `project_reps` row.  
**Impact:** RLS `projects_rep_read` checks BOTH `assigned_rep_id` AND `project_reps`. This is intentional.  
**Fix:** After confirming all projects have `project_reps` entries, drop `assigned_rep_id` from RLS and then from schema.

### 🟡 `projects.next_follow_up` — Unused Column
**What it is:** Original follow-up date column.  
**Replaced by:** `projects.project_date` (UI uses this).  
**Fix:** `ALTER TABLE projects DROP COLUMN next_follow_up;` after confirming no code reads it.

### 🟢 Duplicate RLS Policies on `project_history`
**What it is:** Two identical manager policies exist: `history_manager` AND `project_history_manager`.  
**Impact:** Harmless (PostgreSQL OR-logic on PERMISSIVE policies).  
**Fix:** `DROP POLICY "project_history_manager" ON project_history;`

### 🟢 `schema.sql` Not Authoritative
**What it is:** The `schema.sql` file in the GitHub repo does not reflect the current production database state.  
**Impact:** Can mislead developers who trust the file.  
**Fix:** Run `pg_dump --schema-only` against production, commit as `schema.production.sql`. Or formally adopt Supabase migrations.

### 🟡 No Migration Files
**What it is:** All schema changes are made ad-hoc in the Supabase SQL Editor. No migration history exists.  
**Impact:** Impossible to recreate the schema from scratch or set up a staging environment from code alone.  
**Fix:** Adopt Supabase CLI migrations: `supabase migration new <name>` → commit SQL → `supabase db push`.

---

## Code Debt

### 🟡 `as unknown as Type[]` Pattern Everywhere
**What it is:** Supabase nested selects return arrays but TypeScript expects objects. Every page that uses joins has `as unknown as Type[]` casts.  
**Why it exists:** Supabase JS client doesn't generate accurate types for nested selects without Supabase-generated TypeScript types.  
**Fix:** Run `supabase gen types typescript --project-id qndpfbmniqxkegzmzcmh > lib/database.types.ts` and use generated types. This eliminates all `any` type workarounds.

### 🟡 No Shared Type Definitions File
**What it is:** Type definitions (e.g., `type Company`, `type Project`) are redeclared in every page file.  
**Impact:** Changing a type requires updating multiple files.  
**Fix:** Create `lib/types.ts` with all shared types exported from one place.

### 🟡 No Shared Constants File
**What it is:** Dropdown arrays like `COMPANY_TYPES`, `REGIONS`, `STAGES` are copy-pasted into every page that uses them.  
**Impact:** Changing a dropdown value requires updating 5+ files. Inconsistencies have occurred.  
**Fix:** Create `lib/constants.ts` with all canonical dropdown arrays exported from one place.

### 🟢 `notify_duplicate_flag` Misses super_admin
**What it is:** The trigger that notifies managers of duplicate flags queries `WHERE role = 'manager'` — it doesn't include `super_admin`.  
**Impact:** Jerom (super_admin) doesn't receive duplicate alert notifications.  
**Fix:** Update the trigger: `WHERE role IN ('manager', 'super_admin')`.

### 🟢 `notify_pending_rep` May Never Fire
**What it is:** The trigger fires when `new.status = 'pending'`. The register API creates reps with `status = 'active'`.  
**Impact:** Managers may not get notified of new self-registrations via notification system.  
**Fix:** Either change register API to `status = 'pending'` OR remove the trigger and rely on the UI for notification flow.

---

## Infrastructure Debt

### 🔴 No Staging Environment
**What it is:** All code changes deploy directly to production.  
**Impact:** Any bug introduced goes live immediately. Database changes cannot be tested safely.  
**Fix:** Create a second Supabase project (staging). Create a Vercel preview branch. Use staging credentials for non-main branches.

### 🔴 No Error Monitoring
**What it is:** No Sentry, no error tracking, no alerting.  
**Impact:** Errors are invisible until users report them. Silent Supabase query failures (like the ambiguous FK join) go undetected.  
**Fix:** Install Sentry free tier: `npx @sentry/wizard@latest -i nextjs`

### 🟡 Single Branch Deployment
**What it is:** All work done directly on `main`. No feature branches or PRs.  
**Impact:** Unstable code deploys to production immediately.  
**Fix:** Use feature branches. Vercel creates preview URLs for non-main branches automatically.

### 🟡 No Local Development Environment
**What it is:** Development done exclusively via GitHub web editor + Vercel.  
**Impact:** Cannot test changes before deploying. TypeScript errors discovered only at build time.  
**Fix:** Set up local Node.js environment. Create `.env.local`. Run `npm run dev` locally before pushing.

---

## Quotation Data Model Debt

### 🟡 Single `sqm_invoiced` Field (No Invoice Table)
**What it is:** `quotations.sqm_invoiced` is a single numeric field. A second invoice on the same quotation overwrites the first.  
**Impact:** Cannot track multiple invoice milestones on one quotation. History is lost on update.  
**Fix:** Create an `invoices` table (see Roadmap). This is a medium-priority structural gap.

### 🟢 Legacy Single-Product Fields on Quotations
**What it is:** `quotations.product_type`, `quotations.finish`, `quotations.price_per_sqm` are single-product fields from the old quotation design. They are superseded by `quotation_items`.  
**Impact:** Confusion about which fields to use. Old fields may contain stale data.  
**Fix:** Stop populating these fields in new quotations. Eventually drop them after confirming `quotation_items` is the source of truth.
