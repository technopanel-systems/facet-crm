# 05. Functions — FACET CRM
> Source: Live Supabase production database (verified export)

All functions are in the `public` schema unless noted.

---

## Helper / Identity Functions

### `current_user_role() → text`
Returns the role of the currently authenticated user.
```sql
SELECT lower(trim(role)) FROM reps WHERE auth_user_id = auth.uid() LIMIT 1;
```
- Language: sql, SECURITY DEFINER, STABLE
- Returns NULL when called from SQL Editor (no auth session) — expected
- Used by: all RLS policies

### `current_rep_id() → uuid`
Returns the rep id of the currently authenticated user.
```sql
SELECT id FROM reps WHERE auth_user_id = auth.uid() LIMIT 1;
```
- Language: sql, SECURITY DEFINER, STABLE
- Used by: RLS policies, trigger functions (log_project_changes)

### `current_rep_name() → text`
Returns the display name of the currently authenticated user.
```sql
SELECT name FROM reps WHERE auth_user_id = auth.uid() LIMIT 1;
```
- Language: sql, SECURITY DEFINER, STABLE
- Used by: legacy code (activities.rep_name population)

---

## Atomic Creation RPCs

### `create_company_with_rep(...) → uuid`
Creates a company and immediately assigns a rep. SECURITY DEFINER bypasses RLS for the junction table insert.

**Parameters:**
| Param | Type | Notes |
|---|---|---|
| p_company_name | text | Required |
| p_company_type | text | Empty string → stored as NULL |
| p_region | text | Empty string → stored as NULL |
| p_source | text | Empty string → stored as NULL |
| p_source_detail | text | Empty string → stored as NULL |
| p_notes | text | Empty string → stored as NULL |
| p_rep_id | uuid | If NULL, company created with no rep assignment |

**Returns:** The new company UUID

**Logic:**
1. INSERT into companies (using NULLIF to convert empty strings to NULL)
2. If p_rep_id IS NOT NULL: INSERT into company_reps with role='primary'
3. RETURN new company id

**Called from:**
- `app/rep/companies/page.tsx` — rep registers a company
- `app/dashboard/companies/page.tsx` — manager creates a company
- `app/dashboard/import/page.tsx` — bulk CSV import

---

### `create_project_with_rep(...) → uuid`
Creates a project and immediately assigns a rep. Prevents orphaned projects.

**Parameters:**
| Param | Type | Notes |
|---|---|---|
| p_customer_id | uuid | Required — company to link |
| p_project_name | text | |
| p_city | text | |
| p_stage | text | |
| p_quoted_sqm | numeric | |
| p_project_date | date | Follow-up date |
| p_notes | text | |
| p_contact_id | uuid | Nullable |
| p_rep_id | uuid | If NULL, project created unassigned |

**Returns:** The new project UUID

**Logic:**
1. SELECT company_name from companies (for legacy cache)
2. INSERT into projects
3. If p_rep_id IS NOT NULL: INSERT into project_reps with role='primary'
4. RETURN new project id

**Called from:**
- `app/rep/projects/page.tsx`
- `app/dashboard/projects/page.tsx`

---

## Detection & Analysis Functions

### `detect_duplicate_companies() → integer`
Scans all active companies for potential duplicates using pg_trgm and inserts flags for new matches.

**Returns:** Count of new duplicate_flags inserted

**Logic:**
```sql
INSERT INTO duplicate_flags (company_id_1, company_id_2, match_type, match_key, classification)
SELECT a.id, b.id, 'name', a.company_name, 'pending'
FROM companies a JOIN companies b ON b.id > a.id
WHERE a.status = 'active' AND b.status = 'active'
AND (
  a.company_name_normalized = b.company_name_normalized
  OR similarity(
    COALESCE(a.company_name_normalized, a.company_name),
    COALESCE(b.company_name_normalized, b.company_name)
  ) > 0.6
)
AND NOT EXISTS (existing flag check);
```
- Language: plpgsql, SECURITY DEFINER
- Threshold: 0.6 similarity score
- Called from: `app/dashboard/duplicates/page.tsx` "Scan for Duplicates" button

---

### `check_missing_submissions() → void`
Checks if any active reps missed their daily submission for the previous working day and inserts notifications.

**Logic:**
1. Calculate yesterday's date
2. If yesterday was DOW 5 or 6 (Fri/Sat) → RETURN (do nothing)
3. If yesterday was a company holiday → RETURN
4. For each active rep (role IN 'rep', 'marketing'):
   - If rep has an approved absence for yesterday → CONTINUE
   - If rep submitted any activity for yesterday → CONTINUE
   - If not already notified today for this date → INSERT notification to rep + all managers/super_admins

- Language: plpgsql, SECURITY DEFINER
- Called from: `app/dashboard/page.tsx` on every dashboard load
- Idempotent: checks `created_at::date = CURRENT_DATE` before inserting

---

## Text Processing Functions

### `normalize_arabic(input text) → text`
Normalizes Arabic text for duplicate detection comparison.

**Transformations (in order):**
1. Lowercase the entire string
2. Strip Arabic diacritics (harakat): U+064B–U+065F, U+0670
3. Unify Alef variants: أ إ آ ٱ → ا
4. Convert ة → ه
5. Convert ى → ي
6. Remove definite article prefix: ال
7. Trim and collapse multiple spaces

**Example:** `"الشركة المتحدة"` → ``"شركه متحده"`

- Called by: `auto_normalize_customer()` trigger function
- Also available as standalone function for manual queries

---

## Trigger Handler Functions

These are functions called by triggers (not directly by application code):

### `set_customer_code() → trigger`
Sets `customer_code = 'CUST-' || lpad(nextval('customer_code_seq'), 5, '0')` on INSERT if null.

### `set_project_code() → trigger`
Sets `project_code = 'PROJ-' || ...` on INSERT if null.

### `set_activity_code() → trigger`
Most complex trigger. On INSERT to activities:
1. Sets activity_code from sequence
2. Sets month from activity_date
3. Calculates submission_status:
   - activity_date is Fri/Sat → on_time
   - activity_date is company holiday → on_time
   - activity_date is rep absence → on_time
   - submitted_at (Asia/Riyadh) = activity_date → on_time
   - submitted_at ≤ next working day after activity_date → on_time
   - submitted_at > next working day → late

### `set_quotation_code() → trigger`
Sets `quotation_code = 'QUO-' || ...` on INSERT if null.

### `set_contact_code() → trigger`
Sets `contact_code = 'CON-' || ...` on INSERT if null.

### `set_updated_at() → trigger`
Sets `updated_at = now()` on any UPDATE. Used by companies, contacts, projects, quotations.

### `auto_normalize_customer() → trigger`
Sets `company_name_normalized = normalize_arabic(company_name)` on INSERT or UPDATE to companies.

### `log_project_changes() → trigger`
On UPDATE to projects, inserts a row to project_history for each changed field among: stage, quoted_sqm, loss_reason.

### `notify_pending_rep() → trigger`
On INSERT to reps where status='pending': inserts notification to all active managers.

### `notify_company_assignment() → trigger`
On INSERT to company_reps: inserts assignment notification to the assigned rep.

### `notify_duplicate_flag() → trigger`
On INSERT to duplicate_flags where classification='pending': inserts duplicate_alert to all active managers (role='manager' only — does not include super_admin).

### `update_quotation_sqm() → trigger`
On INSERT/UPDATE/DELETE to quotation_items: recalculates and updates `quotations.sqm_quoted` for the parent quotation as SUM(total_sqm).

### `sync_project_sqm() → trigger`
On INSERT/UPDATE/DELETE to quotations: recalculates and updates parent project:
- `quoted_sqm` = SUM(sqm_quoted) from non-cancelled quotations
- `won_sqm` = SUM(sqm_invoiced) from won quotations
