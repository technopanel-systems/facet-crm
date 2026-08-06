# 04. RLS Policies — FACET CRM
> Source: Live Supabase production database (verified export)

All tables have RLS enabled. Policies use two helper functions:
- `current_user_role()` → returns the role string for the authenticated user
- `current_rep_id()` → returns the uuid of the authenticated user's rep row

---

## Helper Functions

```sql
-- Returns role for logged-in user
CREATE FUNCTION current_user_role() RETURNS text
  LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT lower(trim(role)) FROM reps WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Returns rep id for logged-in user
CREATE FUNCTION current_rep_id() RETURNS uuid
  LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT id FROM reps WHERE auth_user_id = auth.uid() LIMIT 1;
$$;
```

**Critical:** Both return NULL when called from the Supabase SQL Editor (no auth session). This is expected and not a bug.

---

## `reps`

| Policy | Command | Using Expression |
|---|---|---|
| reps_read | SELECT | `auth.uid() IS NOT NULL` — all authenticated users can read all reps |
| reps_manager_write | ALL | `current_user_role() = ANY (ARRAY['manager', 'super_admin'])` |

---

## `companies`

| Policy | Command | Expression |
|---|---|---|
| companies_manager | ALL | `current_user_role() = ANY (ARRAY['manager', 'sales_coordinator', 'super_admin'])` |
| companies_coordinator_read | SELECT | `current_user_role() = 'sales_coordinator'` |
| companies_rep_read | SELECT | `current_user_role() = ANY (ARRAY['rep', 'marketing']) AND EXISTS (SELECT 1 FROM company_reps WHERE company_id = companies.id AND rep_id = current_rep_id())` |
| companies_rep_update | UPDATE | `current_user_role() = 'rep' AND EXISTS (company_reps check)` |
| companies_rep_insert | INSERT | WITH CHECK: `current_user_role() = ANY (ARRAY['rep', 'marketing', 'manager', 'super_admin'])` |

---

## `company_reps`

| Policy | Command | Expression |
|---|---|---|
| company_reps_manager | ALL | `current_user_role() = ANY (ARRAY['manager', 'super_admin'])` |
| company_reps_rep_read | SELECT | `rep_id = current_rep_id()` |
| company_reps_rep_insert | INSERT | WITH CHECK: `current_user_role() = ANY (ARRAY['rep', 'marketing', 'super_admin'])` |

---

## `contacts`

| Policy | Command | Expression |
|---|---|---|
| contacts_manager | ALL | `current_user_role() = ANY (ARRAY['manager', 'sales_coordinator', 'super_admin'])` |
| contacts_rep_access | SELECT | `current_user_role() = ANY (ARRAY['rep', 'marketing']) AND EXISTS (SELECT 1 FROM company_reps WHERE company_id = contacts.company_id AND rep_id = current_rep_id())` |
| contacts_rep_insert | INSERT | WITH CHECK: `current_user_role() = ANY (ARRAY['rep', 'marketing'])` |
| contacts_rep_update | UPDATE | `current_user_role() = 'rep' AND EXISTS (company_reps check on contacts.company_id)` |

---

## `projects`

| Policy | Command | Expression |
|---|---|---|
| projects_manager | ALL | `current_user_role() = ANY (ARRAY['manager', 'sales_coordinator', 'super_admin'])` |
| projects_coordinator_read | SELECT | `current_user_role() = 'sales_coordinator'` |
| projects_rep_read | SELECT | `current_user_role() = ANY (ARRAY['rep', 'marketing']) AND (assigned_rep_id = current_rep_id() OR EXISTS (SELECT 1 FROM project_reps WHERE project_id = projects.id AND rep_id = current_rep_id()))` |
| projects_rep_update | UPDATE | `current_user_role() = ANY (ARRAY['rep', 'marketing']) AND EXISTS (project_reps check)` |
| projects_rep_insert | INSERT | WITH CHECK: `current_user_role() = ANY (ARRAY['rep', 'marketing', 'manager'])` |

---

## `project_reps`

| Policy | Command | Expression |
|---|---|---|
| project_reps_manager | ALL | `current_user_role() = ANY (ARRAY['manager', 'super_admin'])` |
| project_reps_rep_read | SELECT | `rep_id = current_rep_id()` |

---

## `activities`

| Policy | Command | Expression |
|---|---|---|
| activities_manager | ALL | `current_user_role() = ANY (ARRAY['manager', 'super_admin'])` |
| activities_rep_read | SELECT | `current_user_role() = 'rep' AND rep_id = current_rep_id()` |
| activities_rep_insert | INSERT | WITH CHECK: `current_user_role() = 'rep' AND rep_id = current_rep_id()` |

**Note:** The `marketing` role is not in activities_rep_read or activities_rep_insert policies as of the last verified export. Marketing reps may be unable to submit or read their own activities. [Gap — verify in production and add marketing to both policies if needed]

---

## `quotations`

| Policy | Command | Expression |
|---|---|---|
| quotations_manager | ALL | `current_user_role() = ANY (ARRAY['manager', 'sales_coordinator', 'super_admin'])` |
| quotations_rep_read | SELECT | `current_user_role() = ANY (ARRAY['rep', 'marketing']) AND rep_id = current_rep_id()` |

**Note:** `quotations_rep_read` only checks `rep_id`, not `assigned_to_id`. A rep assigned via `assigned_to_id` but not `rep_id` will not see the quotation. The UI queries with `.or('rep_id.eq.{id},assigned_to_id.eq.{id}')` but RLS may block it. [Potential gap]

---

## `quotation_items`

| Policy | Command | Expression |
|---|---|---|
| items_manager | ALL | `current_user_role() = ANY (ARRAY['manager', 'sales_coordinator', 'super_admin'])` |
| items_rep_read | SELECT | `current_user_role() = ANY (ARRAY['rep', 'marketing']) AND EXISTS (SELECT 1 FROM quotations WHERE id = quotation_items.quotation_id AND (rep_id = current_rep_id() OR assigned_to_id = current_rep_id()))` |

---

## `quotation_services`

| Policy | Command | Expression |
|---|---|---|
| services_manager | ALL | `current_user_role() = ANY (ARRAY['manager', 'sales_coordinator', 'super_admin'])` |
| services_rep_read | SELECT | Same EXISTS pattern as quotation_items |

---

## `duplicate_flags`

| Policy | Command | Expression |
|---|---|---|
| duplicates_manager | ALL | `current_user_role() = ANY (ARRAY['manager', 'super_admin'])` |

Reps have no access to duplicate_flags.

---

## `notifications`

| Policy | Command | Expression |
|---|---|---|
| notifications_select | SELECT | `recipient_id = current_rep_id() OR current_user_role() = ANY (ARRAY['manager', 'super_admin'])` |
| notifications_insert | INSERT | WITH CHECK: `true` — open insert (triggers need this) |
| notifications_update | UPDATE | `recipient_id = current_rep_id() OR current_user_role() = ANY (ARRAY['manager', 'super_admin'])` |

---

## `project_history`

| Policy | Command | Expression |
|---|---|---|
| history_manager / project_history_manager | ALL | `current_user_role() = ANY (ARRAY['manager', 'super_admin'])` |
| history_rep_read / project_history_rep_read | SELECT | `current_user_role() = ANY (ARRAY['rep', 'marketing']) AND EXISTS (SELECT 1 FROM project_reps WHERE project_id = project_history.project_id AND rep_id = current_rep_id())` |
| history_insert / project_history_rep_insert | INSERT | WITH CHECK: `current_user_role() = ANY (ARRAY['rep', 'marketing', 'manager', 'super_admin'])` |

**Note:** There are duplicate policies on this table (history_manager AND project_history_manager both exist). This is harmless but should be cleaned up.

---

## `company_holidays`

| Policy | Command | Expression |
|---|---|---|
| holidays_manager | ALL | `current_user_role() = ANY (ARRAY['manager', 'super_admin'])` |
| holidays_read_all | SELECT | `auth.uid() IS NOT NULL` — all authenticated users can read |

---

## `rep_absences`

| Policy | Command | Expression |
|---|---|---|
| absences_manager | ALL | `current_user_role() = ANY (ARRAY['manager', 'super_admin'])` |
| absences_rep_read | SELECT | `current_user_role() = ANY (ARRAY['rep', 'marketing']) AND rep_id = current_rep_id()` |
