# 06. Triggers — FACET CRM
> Source: Live Supabase production database (verified export)

---

## All Active Triggers

| Trigger Name | Table | Timing | Event | Function Called |
|---|---|---|---|---|
| trg_activity_code | activities | BEFORE | INSERT | set_activity_code() |
| trg_customer_code | companies | BEFORE | INSERT | set_customer_code() |
| trg_customers_updated | companies | BEFORE | UPDATE | set_updated_at() |
| trg_normalize_customer | companies | BEFORE | INSERT OR UPDATE | auto_normalize_customer() |
| trg_notify_company_assignment | company_reps | AFTER | INSERT | notify_company_assignment() |
| trg_contact_code | contacts | BEFORE | INSERT | set_contact_code() |
| trg_contacts_updated | contacts | BEFORE | UPDATE | set_updated_at() |
| trg_notify_duplicate | duplicate_flags | AFTER | INSERT | notify_duplicate_flag() |
| trg_project_code | projects | BEFORE | INSERT | set_project_code() |
| trg_project_history | projects | AFTER | UPDATE | log_project_changes() |
| trg_projects_updated | projects | BEFORE | UPDATE | set_updated_at() |
| trg_update_quotation_sqm | quotation_items | AFTER | INSERT OR UPDATE OR DELETE | update_quotation_sqm() |
| trg_quotation_code | quotations | BEFORE | INSERT | set_quotation_code() |
| trg_quotations_updated | quotations | BEFORE | UPDATE | set_updated_at() |
| trg_sync_project_sqm | quotations | AFTER | INSERT OR UPDATE OR DELETE | sync_project_sqm() |
| trg_notify_pending_rep | reps | AFTER | INSERT | notify_pending_rep() |

---

## Trigger Execution Order (Key Chains)

### When a rep submits an activity:
1. `trg_activity_code` (BEFORE INSERT) → sets code, month, submission_status

### When a new company is registered:
1. `trg_customer_code` (BEFORE INSERT) → sets customer_code
2. `trg_normalize_customer` (BEFORE INSERT) → sets company_name_normalized

### When a company is updated:
1. `trg_normalize_customer` (BEFORE UPDATE) → updates company_name_normalized
2. `trg_customers_updated` (BEFORE UPDATE) → sets updated_at

### When a company is assigned to a rep (company_reps INSERT):
1. `trg_notify_company_assignment` (AFTER INSERT) → sends notification to rep

### When a project stage changes:
1. `trg_projects_updated` (BEFORE UPDATE) → sets updated_at
2. `trg_project_history` (AFTER UPDATE) → logs change if stage/sqm/loss_reason changed

### When a quotation item is added/changed:
1. `trg_update_quotation_sqm` (AFTER INSERT/UPDATE/DELETE) → recalculates quotation.sqm_quoted

### When a quotation status/sqm changes:
1. `trg_quotations_updated` (BEFORE UPDATE) → sets updated_at
2. `trg_sync_project_sqm` (AFTER INSERT/UPDATE/DELETE) → recalculates project.quoted_sqm and won_sqm

### When a new rep registers:
1. `trg_notify_pending_rep` (AFTER INSERT) → if status='pending', notifies managers

---

## Missing Triggers (Known Gaps)

The following triggers are described in context documents but **do not appear in the verified trigger export**. Their existence in production is unconfirmed:

| Described Trigger | Status | Impact |
|---|---|---|
| `trg_companies_updated` | May exist as `trg_customers_updated` (same function) | Low — updated_at works |
| Auto-notify on project stale | Does not exist | Low — no auto stale notifications |
| Auto-notify on quotation expiry | Does not exist | Low — no auto expiry notifications |

---

## Notes on trg_notify_pending_rep

This trigger fires when any new row is inserted into `reps`. It checks `new.status = 'pending'`.

The `/api/auth/register` route currently inserts reps with `status = 'active'` (not pending). This means the trigger may never fire in the current self-registration flow. Managers are notified via the registration confirmation screen, not via this trigger.

[Assumption: notification trigger is intended for future use or legacy pending flow]
