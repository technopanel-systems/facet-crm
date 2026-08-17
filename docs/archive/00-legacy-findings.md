# FACET CRM — Legacy Findings

Scope: every file under `legacy/`. Statements of fact only.

## Sources read

| Source | Files |
|---|---|
| Application code | 37 files: `legacy/app/**`, `legacy/components/Sidebar.tsx`, `legacy/lib/supabase/*`, `legacy/middleware.ts`, `legacy/package.json`, `legacy/tailwind.config.ts`, `legacy/next.config.mjs`, `legacy/postcss.config.mjs`, `legacy/tsconfig.json`, `legacy/app/globals.css` |
| Repo schema | `legacy/schema.sql` (819 lines) |
| Production DB exports | `legacy/docs/truth/production/*.csv` (8 files) |
| Founder docs | `legacy/docs/truth/founder/*.md` (3 files) |
| Reference docs | `legacy/docs/unverified/**` (30 files) |
| Root context doc | `legacy/FACET_CRM_CONTEXT.md` |
| History | `legacy/docs/history/*.md` (3 files, read in full); `legacy/docs/history/*.json` (3 Claude chat-export transcripts: `Claude-audit 1.json` 4 messages, `Claude-development 1.json` 50 messages, `Claude-development 2.json` 208 messages — inspected structurally and searched for the SQL definitions cited below) |

### What the production CSV exports do and do not establish

- `tables_columns.csv` (100 data rows) and `constraints.csv` (100 data rows) are **truncated**. `tables_columns.csv` ends mid-table at `project_reps.id`; it contains no rows for `projects`, `quotations`, `quotation_items`, `quotation_services`, `reps`, `rep_absences`, or the remaining views. `constraints.csv` ends mid-table at `projects`.
- `production_schema.sql.csv` lists column names, types and `NOT NULL` only. It carries **no** `DEFAULT` clauses (e.g. `activities.id uuid NOT NULL` although `tables_columns.csv` records the default `uuid_generate_v4()`), **no** CHECK constraint bodies, and **no** `GENERATED ALWAYS AS` clauses. Absence of a clause in this file is not evidence that the clause is absent in production.
- `functions.csv` contains routine bodies only. It carries no `SECURITY DEFINER` / `SECURITY INVOKER` attribute, no argument list, and no return type.
- `foreign_keys.csv` lists columns and referenced columns only — no `ON DELETE` / `ON UPDATE` action.
- `triggers.csv` and `rls_policies.csv` appear complete and are internally consistent with `functions.csv`.

Where sources disagree, this document reports the disagreement rather than resolving it, except where one source is demonstrably a superset (e.g. the production exports list tables that `schema.sql` omits entirely).

---

## 1. Entities and fields actually used in code

"Used" means the column name appears in a Supabase `.select()`, `.insert()`, `.update()`, `.eq()`/`.or()` filter, or an RPC argument in `legacy/app/**`, `legacy/components/**`, or `legacy/lib/**`.

### 1.1 `reps`

| Column | Used in code | Where |
|---|---|---|
| `id` | read, filter | all pages resolving the current user; dropdown values |
| `name` | read | Sidebar, dashboards, activity insert (`rep_name`) |
| `email` | read, insert | [team/page.tsx](../legacy/app/dashboard/team/page.tsx), [register/route.ts](../legacy/app/api/auth/register/route.ts) |
| `role` | read, update, filter | layouts, `page.tsx`, `team/page.tsx`, `.in('role',['rep','marketing'])` filters |
| `status` | read, update, filter | layouts, `team/page.tsx`, `.eq('status','active')` filters |
| `monthly_target_sqm` | read, update, insert | dashboard, performance, stats, team |
| `auth_user_id` | filter, insert | every page that resolves the session to a rep row |
| `branch_id` | **filter only** | [dashboard/page.tsx:20](../legacy/app/dashboard/page.tsx#L20) |
| `created_at` | not used | — |
| `language_pref` | **not used anywhere** | — |

No code path writes `reps.branch_id`. The Team page ([team/page.tsx](../legacy/app/dashboard/team/page.tsx)) edits `status`, `role` and `monthly_target_sqm` only. The dashboard branch filter therefore reads a column no UI populates.

### 1.2 `branches`

| Column | Used in code | Where |
|---|---|---|
| `id`, `name`, `is_active` | read | [dashboard/page.tsx:32](../legacy/app/dashboard/page.tsx#L32) (`.eq('is_active', true)`) |
| `region`, `created_at` | not used | — |

No code path inserts, updates, or deletes a `branches` row.

### 1.3 `companies`

| Column | Used in code | Where |
|---|---|---|
| `id` | read, filter | throughout |
| `customer_code` | read | company lists and detail pages |
| `company_name` | read, insert (via RPC), update | throughout |
| `company_type` | read, insert (via RPC), update | company pages, import, daily report |
| `region` | read, insert (via RPC), update | company pages, import, daily report |
| `source` | read, insert (via RPC), update | manager + rep company pages, import |
| `source_detail` | insert (via RPC), update | [dashboard/companies/[id]/page.tsx:81](../legacy/app/dashboard/companies/[id]/page.tsx#L81) |
| `status` | read, update, filter | company list filters, detail edit |
| `notes` | read, insert (via RPC), update | company pages, import |
| `primary_rep_id` | read, update | [dashboard/companies/[id]/page.tsx:119](../legacy/app/dashboard/companies/[id]/page.tsx#L119) |
| `created_at` | read | list sorting, duplicates page display |
| `company_name_normalized` | **not used in code** — written by `trg_normalize_customer` | — |
| `branch_id` | **not used anywhere** | — |
| `contact1_name`, `contact1_phone`, `contact2_name`, `contact2_phone` | **not used anywhere** | — |
| `updated_at` | **not used in code** — written by `trg_customers_updated` | — |

`contact1_*` / `contact2_*` exist in `production_schema.sql.csv` and `tables_columns.csv`. They do not appear in `legacy/schema.sql`, in any application file, or in any RPC body in `functions.csv`.

### 1.4 `company_reps`

| Column | Used in code | Where |
|---|---|---|
| `company_id`, `rep_id`, `role` | read, upsert, delete | [dashboard/companies/[id]/page.tsx:117](../legacy/app/dashboard/companies/[id]/page.tsx#L117), [rep/page.tsx:107](../legacy/app/rep/page.tsx#L107) |
| `assigned_by` | written by `create_company_with_rep` only | `functions.csv` |
| `id`, `assigned_at` | not used | — |

The client-side upsert at `dashboard/companies/[id]/page.tsx:117` writes `company_id`, `rep_id`, `role` and omits `assigned_by`.

### 1.5 `contacts`

| Column | Used in code | Where |
|---|---|---|
| `id`, `company_id`, `full_name` | read, insert, filter | company detail pages, daily report |
| `full_name_ar`, `title`, `phone`, `whatsapp`, `email`, `is_primary` | read, insert | manager + rep company detail |
| `notes` | read, insert | manager company detail only ([dashboard/companies/[id]/page.tsx:101](../legacy/app/dashboard/companies/[id]/page.tsx#L101)) — the rep Add Contact form has no notes field |
| `created_by` | insert | rep page only ([rep/companies/[id]/page.tsx:59](../legacy/app/rep/companies/[id]/page.tsx#L59)); the manager insert omits it |
| `contact_code` | read | detail page type only |
| `created_at`, `updated_at` | not used | — |

No code path updates an existing contact; contacts can be created and deleted only.

### 1.6 `projects`

| Column | Used in code | Where |
|---|---|---|
| `id`, `project_code`, `project_name`, `city`, `stage` | read, insert (via RPC), update | project pages |
| `customer_id` | read, insert (via RPC), filter | project pages, company detail |
| `quoted_sqm` | read, insert (via RPC) | project pages, dashboards |
| `won_sqm` | **read only** | project lists and detail |
| `project_date` | read, insert (via RPC), filter | project pages, [followups/page.tsx:51](../legacy/app/dashboard/followups/page.tsx#L51) |
| `contact_id` | insert (via RPC) | project add forms |
| `notes` | read, insert (via RPC) | project pages |
| `stage_changed_at` | **update only** | [dashboard/projects/page.tsx:124](../legacy/app/dashboard/projects/page.tsx#L124), [rep/projects/page.tsx:117](../legacy/app/rep/projects/page.tsx#L117) |
| `loss_reason`, `loss_notes` | read, update | loss modals |
| `assigned_rep_id` | read, filter | project lists, followups, performance |
| `company_name` | **not used in code** — written by `create_project_with_rep` | — |
| `next_follow_up` | **read, never written** | [rep/companies/[id]/page.tsx:47](../legacy/app/rep/companies/[id]/page.tsx#L47); also selected from the `stale_projects` view at [dashboard/page.tsx:29](../legacy/app/dashboard/page.tsx#L29) |
| `quote_date` | **not used anywhere** | — |
| `expected_close` | **not used anywhere** | — |
| `created_at`, `updated_at` | `created_at` used for ordering | — |

`won_sqm` is never written by application code. The manager Add Project form collects a "Won SQM" value into `form.won_sqm` ([dashboard/projects/page.tsx:337](../legacy/app/dashboard/projects/page.tsx#L337)) and the RPC call at [line 90](../legacy/app/dashboard/projects/page.tsx#L90) does not pass it.

`stage_changed_at` is written only on stage change. `create_project_with_rep` (`functions.csv`) does not set it, so a newly created project has `stage_changed_at IS NULL`.

### 1.7 `project_reps`

| Column | Used in code | Where |
|---|---|---|
| all columns | **no direct code reference** | rows are created only inside `create_project_with_rep` |
| `sqm_split` | **not used anywhere** — not written by the RPC either | — |

### 1.8 `activities`

| Column | Used in code | Where |
|---|---|---|
| `activity_date`, `rep_id`, `rep_name`, `company_id`, `company_name`, `company_type`, `contact_id`, `contact_person`, `phone`, `interaction_type`, `project_id`, `project_name`, `notes`, `region`, `sqm_done`, `sqm_expected` | insert | [rep/page.tsx:281-298](../legacy/app/rep/page.tsx#L281-L298) |
| same set plus `submission_status`, `submitted_at`, `activity_code`, `id` | read, filter | [dashboard/activities](../legacy/app/dashboard/activities/page.tsx), [rep/history](../legacy/app/rep/history/page.tsx), [rep/stats](../legacy/app/rep/stats/page.tsx), [performance](../legacy/app/dashboard/performance/page.tsx), [dashboard/page.tsx](../legacy/app/dashboard/page.tsx) |
| `month` | **not used in code** — written by `set_activity_code` | — |
| `created_at` | not used | — |

Activities are insert-only in code. No page updates or deletes an activity.

### 1.9 `quotations`

| Column | Used in code | Where |
|---|---|---|
| `company_id`, `project_id`, `rep_id`, `assigned_to_id`, `coordinator_id`, `erp_quotation_id`, `quote_date`, `valid_until`, `notes`, `status`, `sqm_quoted` | insert | [dashboard/quotations/page.tsx:182-194](../legacy/app/dashboard/quotations/page.tsx#L182-L194) |
| `status`, `sqm_invoiced`, `sqm_delivered`, `last_revised_at`, `cancellation_reason` | update | [dashboard/quotations/page.tsx:236-245](../legacy/app/dashboard/quotations/page.tsx#L236-L245) |
| `quotation_code`, `revision_number` | read | quotation lists |
| `product_type` | **not used anywhere** | — |
| `finish` | **not used anywhere** | — |
| `price_per_sqm` | **not used anywhere** (the per-item `quotation_items.price_per_sqm` is used) | — |
| `created_at`, `updated_at` | `created_at` used for ordering | — |

The insert writes `sqm_quoted: 0` and the same rep id into both `rep_id` and `assigned_to_id` ([lines 185-186](../legacy/app/dashboard/quotations/page.tsx#L185-L186)). `revision_number` is never incremented by code.

### 1.10 `quotation_items`

| Column | Used in code | Where |
|---|---|---|
| `quotation_id`, `class`, `fr_rating`, `color_code`, `supplier_code`, `width_m`, `width_is_custom`, `length_m`, `num_sheets`, `thickness_mm`, `price_per_sqm` | insert | [dashboard/quotations/page.tsx:199-213](../legacy/app/dashboard/quotations/page.tsx#L199-L213) |
| `total_sqm` | **read only** | [rep/quotations/page.tsx:233](../legacy/app/rep/quotations/page.tsx#L233) |
| `id`, `created_at` | read | rep detail table |

No code path updates or deletes a `quotation_items` row after creation.

### 1.11 `quotation_services`

`quotation_id`, `service_type`, `price_per_sqm` are inserted at [dashboard/quotations/page.tsx:216-224](../legacy/app/dashboard/quotations/page.tsx#L216-L224) and read at [rep/quotations/page.tsx:93](../legacy/app/rep/quotations/page.tsx#L93). No update or delete path.

### 1.12 `duplicate_flags`

| Column | Used in code | Where |
|---|---|---|
| `id`, `company_id_1`, `company_id_2`, `match_type`, `match_key`, `classification`, `created_at` | read | [duplicates/page.tsx:39](../legacy/app/dashboard/duplicates/page.tsx#L39) |
| `classification`, `resolved_at` | update | [duplicates/page.tsx:65](../legacy/app/dashboard/duplicates/page.tsx#L65), [line 75](../legacy/app/dashboard/duplicates/page.tsx#L75) |
| `resolved_by` | **not used anywhere** | — |

Rows are created only by `detect_duplicate_companies()`, which always writes `match_type = 'name'`. No producer writes `match_type = 'phone'`, the other value permitted by the CHECK constraint in `schema.sql`.

### 1.13 `notifications`

| Column | Used in code | Where |
|---|---|---|
| `id`, `type`, `title`, `body`, `is_read`, `created_at` | read | [dashboard/notifications](../legacy/app/dashboard/notifications/page.tsx), [rep/notifications](../legacy/app/rep/notifications/page.tsx) |
| `is_read` | update | same two pages |
| `recipient_id` | filter | [Sidebar.tsx:110](../legacy/components/Sidebar.tsx#L110) only |
| `entity_type`, `entity_id` | **not read by any page** — written by trigger functions | — |

Neither notifications page filters by `recipient_id`; both select `*` and rely on RLS.

### 1.14 `company_holidays`, `rep_absences`

Both are fully exercised by [team/page.tsx](../legacy/app/dashboard/team/page.tsx) (insert with `created_by`, read, delete) and read for the yesterday-window at [dashboard/page.tsx:33-36](../legacy/app/dashboard/page.tsx#L33-L36). `rep_absences` is also read by RLS-scoped queries nowhere else. No update path for either.

### 1.15 `project_history`

Read at [dashboard/projects/[id]/page.tsx:64](../legacy/app/dashboard/projects/[id]/page.tsx#L64) and [rep/projects/page.tsx:101](../legacy/app/rep/projects/page.tsx#L101), selecting `id, field_name, old_value, new_value, changed_at, reps(name)`. Rows are written only by the `log_project_changes()` trigger function. Both pages carry a `FIELD_LABEL` map including `assigned_rep`, a `field_name` value the trigger never produces (it emits `stage`, `quoted_sqm`, `loss_reason` only).

### 1.16 Views

| View | Used in code |
|---|---|
| `pipeline_summary` | [dashboard/page.tsx:30](../legacy/app/dashboard/page.tsx#L30) |
| `stale_projects` | [dashboard/page.tsx:29](../legacy/app/dashboard/page.tsx#L29) |
| `rep_monthly_sqm` | **not referenced by any code** |
| `rep_branch_summary` | **not referenced by any code**; also absent from `schema.sql` |

### 1.17 Database functions called from code

| Function | Called from |
|---|---|
| `check_missing_submissions` | [dashboard/page.tsx:7](../legacy/app/dashboard/page.tsx#L7) |
| `create_company_with_rep` | [dashboard/companies/page.tsx:66](../legacy/app/dashboard/companies/page.tsx#L66), [rep/companies/page.tsx:58](../legacy/app/rep/companies/page.tsx#L58), [import/page.tsx:116](../legacy/app/dashboard/import/page.tsx#L116) |
| `create_project_with_rep` | [dashboard/projects/page.tsx:90](../legacy/app/dashboard/projects/page.tsx#L90), [rep/projects/page.tsx:80](../legacy/app/rep/projects/page.tsx#L80) |
| `detect_duplicate_companies` | [duplicates/page.tsx:81](../legacy/app/dashboard/duplicates/page.tsx#L81) |
| `current_user_role`, `current_rep_id` | RLS policies only |
| `current_rep_name` | **not called from code and not referenced by any RLS policy in `rls_policies.csv`** |
| `normalize_arabic` | called by `auto_normalize_customer` only |

---

## 2. Workflows implemented vs stubbed

| Workflow | State | Evidence |
|---|---|---|
| Email/password login | Implemented | [login/page.tsx](../legacy/app/login/page.tsx), [middleware.ts](../legacy/middleware.ts) |
| Role-based routing | Implemented | [page.tsx](../legacy/app/page.tsx), [dashboard/layout.tsx](../legacy/app/dashboard/layout.tsx), [rep/layout.tsx](../legacy/app/rep/layout.tsx) |
| Self-registration | Implemented | [register/page.tsx](../legacy/app/register/page.tsx) → [api/auth/register/route.ts](../legacy/app/api/auth/register/route.ts) |
| Pending-approval gate | **Present but unreachable** | The API writes `status: "active"` ([route.ts:30](../legacy/app/api/auth/register/route.ts#L30)). `/pending` exists, both layouts redirect on `status === 'pending'`, and `notify_pending_rep` fires only `IF new.status = 'pending'`. Nothing in the codebase creates a rep with `status = 'pending'`; a manager can set it after the fact from the Team page. |
| OAuth / PKCE callback | **Present, no caller** | [api/auth/callback/route.ts](../legacy/app/api/auth/callback/route.ts) handles a `code` exchange. No OAuth provider is configured or invoked anywhere in the code. Middleware treats `/auth/*` as public, but the route is mounted at `/api/auth/callback`. |
| Sign-out | Implemented (Sidebar) / **broken form** | [Sidebar.tsx:128](../legacy/components/Sidebar.tsx#L128) works. [pending/page.tsx:48](../legacy/app/pending/page.tsx#L48) posts a form to `/auth/signout`, a route that does not exist. |
| Daily activity report | Implemented | [rep/page.tsx](../legacy/app/rep/page.tsx) — company/contact/project dropdowns, Arabic-normalised search, multi-row insert |
| Submission status (on_time/late) | Implemented in DB | `set_activity_code()` in `functions.csv`; weekend, holiday and absence aware |
| Missing-submission notification | Implemented, manually triggered | `check_missing_submissions()` runs only when the manager dashboard loads ([dashboard/page.tsx:7](../legacy/app/dashboard/page.tsx#L7)) |
| Company create (manager, rep, bulk) | Implemented | via `create_company_with_rep` from three pages |
| Company edit | **Manager only** | [dashboard/companies/[id]/page.tsx:74](../legacy/app/dashboard/companies/[id]/page.tsx#L74). [rep/companies/[id]/page.tsx](../legacy/app/rep/companies/[id]/page.tsx) has no edit control. |
| Company delete | Implemented | manager list page and duplicates page |
| Rep assignment to company | Implemented | [dashboard/companies/[id]/page.tsx:115](../legacy/app/dashboard/companies/[id]/page.tsx#L115) |
| Contact create / delete | Implemented (create both roles, delete manager only) | company detail pages |
| Contact edit | **No code path** | — |
| Bulk CSV import | Implemented | [import/page.tsx](../legacy/app/dashboard/import/page.tsx). The parser splits on the delimiter with no quote handling ([line 64](../legacy/app/dashboard/import/page.tsx#L64)), so a quoted field containing the delimiter shifts all following columns. |
| Project create | Implemented | via `create_project_with_rep` |
| Project stage change + loss reason | Implemented | modal blocks confirm until a reason is chosen, both roles |
| Project edit (fields other than stage/loss) | **No code path** | neither project page offers editing of name, city, SQM, date or notes after creation |
| Project delete | Manager only | [dashboard/projects/page.tsx:110](../legacy/app/dashboard/projects/page.tsx#L110) |
| Project history timeline | Implemented (read) | trigger-written; two read surfaces |
| Follow-ups due | Implemented on `project_date` | [followups/page.tsx:51](../legacy/app/dashboard/followups/page.tsx#L51) |
| Quotation create with items + services | Implemented | [dashboard/quotations/page.tsx](../legacy/app/dashboard/quotations/page.tsx) |
| Quotation status / invoiced / delivered update | Implemented | inline edit row |
| Quotation revision | **Partial** | `last_revised_at` is set on every save; `revision_number` is displayed but never incremented by any code or trigger |
| Quotation delete | Implemented | manager/coordinator page |
| Duplicate scan | Implemented | `detect_duplicate_companies()` on button press |
| Duplicate classification | **Partial** | classification is stored; `resolved_by` is never written; no code, trigger, function, view or RLS policy anywhere reads `classification` other than the duplicates page's own filter tabs. Classifying as `shared` or `conflict` has no downstream effect. |
| Duplicate merge | **Not implemented** | the only remediation is deleting one company record |
| In-app notifications | Implemented | 4 producers (`notify_pending_rep`, `notify_company_assignment`, `notify_duplicate_flag`, `check_missing_submissions`) |
| Notification types with no producer | **Stubbed** | `project_stale`, `quotation_expiry`, `follow_up_due`, `lead_submitted`, `system` appear in the `notifications_type_check` constraint; nothing writes them |
| Notification realtime badge | Implemented | [Sidebar.tsx:116](../legacy/components/Sidebar.tsx#L116), subscribed to all INSERTs, count re-fetched filtered by `recipient_id` |
| Team: status / role / target editing | Implemented | [team/page.tsx:151](../legacy/app/dashboard/team/page.tsx#L151) |
| Team: create user | Implemented | posts to the same public register endpoint |
| Team: delete user | **Not implemented** | no delete control |
| Company holidays / rep absences | Implemented (create, read, delete) | [team/page.tsx](../legacy/app/dashboard/team/page.tsx) |
| Branch assignment | **Present in DB, no code path** | `branches` has no create/edit UI; nothing writes `reps.branch_id` or `companies.branch_id`; the dashboard branch filter reads `reps.branch_id` |
| Rep performance reporting | Implemented | [performance/page.tsx](../legacy/app/dashboard/performance/page.tsx), [rep/stats/page.tsx](../legacy/app/rep/stats/page.tsx) |
| Activity CSV export | Implemented | [activities/page.tsx:77](../legacy/app/dashboard/activities/page.tsx#L77) |
| SQM split attribution across reps | **Present in DB, no code path** | `project_reps.sqm_split` is never read or written |
| Invoice records | **Not present** | no invoice table in any export; `quotations.sqm_invoiced` is a single numeric field |
| File/document storage | **Not present** | no Supabase Storage usage in code |
| Automated tests | **None** | no test framework in `package.json`; no test files |

Dead form fields (collected in state, never submitted):
- "Won SQM" on the manager Add Project form — [dashboard/projects/page.tsx:337](../legacy/app/dashboard/projects/page.tsx#L337); `handleAdd` at [line 90](../legacy/app/dashboard/projects/page.tsx#L90) passes no `won_sqm`.
- "Status" on the manager Add Company form — [dashboard/companies/page.tsx:289](../legacy/app/dashboard/companies/page.tsx#L289); `create_company_with_rep` hardcodes `'active'` (`functions.csv`).

---

## 3. Contradictions between code, docs and CSVs

### 3.1 `schema.sql` vs the production exports

Tables in production that `schema.sql` does not define at all:

- `quotation_items`
- `quotation_services`
- `project_history`

Views in production that `schema.sql` does not define: `rep_branch_summary`.

Columns present in production, absent from `schema.sql`:

| Table | Columns |
|---|---|
| `companies` | `contact1_name`, `contact1_phone`, `contact2_name`, `contact2_phone`, `source_detail` |
| `projects` | `project_date` (NOT NULL), `loss_notes`, `quote_date`, `expected_close` |
| `quotations` | `erp_quotation_id`, `cancellation_reason`, `assigned_to_id` |

Columns present in `schema.sql`, absent from the production `projects` DDL: `next_follow_up` is in both, but `schema.sql` has no `project_date`; the production DDL has both.

Nullability differences:

| Column | `schema.sql` | production |
|---|---|---|
| `branches.region` | nullable | NOT NULL |
| `projects.company_name` | nullable | NOT NULL |
| `projects.project_date` | absent | NOT NULL |
| `quotations.project_id` | nullable | NOT NULL |
| `quotations.company_id` | nullable | NOT NULL |
| `quotations.quote_date` | nullable | NOT NULL |
| `company_reps.role` | no default | default `'primary'` (`tables_columns.csv`) |

Role enumeration: `schema.sql:33` allows `('rep','manager','sales_coordinator','marketing')`. `rls_policies.csv` references `'super_admin'` in 14 policies, `functions.csv` references it in `check_missing_submissions`, and [Sidebar.tsx:64](../legacy/components/Sidebar.tsx#L64) and both layouts handle it. `super_admin` is not in the `schema.sql` CHECK list.

Triggers in `triggers.csv` that `schema.sql` does not create: `trg_notify_company_assignment`, `trg_notify_duplicate`, `trg_project_history`, `trg_update_quotation_sqm`, `trg_sync_project_sqm`, `trg_notify_pending_rep`. The companies `updated_at` trigger is named `trg_companies_updated` in `schema.sql:578` and `trg_customers_updated` in `triggers.csv`.

Functions in `functions.csv` that `schema.sql` does not define: `current_rep_name`, `notify_pending_rep`, `notify_company_assignment`, `notify_duplicate_flag`, `update_quotation_sqm`, `sync_project_sqm`, `log_project_changes`, `create_company_with_rep`.

`create_project_with_rep` signature and body differ:

- `schema.sql:531-563` — parameter `p_next_follow_up date`, inserts into `next_follow_up`.
- `functions.csv` (production) — parameter `p_project_date`, inserts into `project_date`.
- Both application call sites pass `p_project_date` ([dashboard/projects/page.tsx:96](../legacy/app/dashboard/projects/page.tsx#L96), [rep/projects/page.tsx:86](../legacy/app/rep/projects/page.tsx#L86)). Calling the `schema.sql` version from the current code would fail on an unknown parameter.

`check_missing_submissions` differs: `schema.sql:471` notifies `role = 'manager'`; the production body notifies `role IN ('manager','super_admin')`. `schema.sql`'s version also walks backwards to the previous working day; the production version returns early if yesterday was a weekend or holiday.

`schema.sql:812-815` ends with a seed `INSERT` that has a trailing comma after the last row and no closing value list before `ON CONFLICT` — the statement as written is not valid SQL. It also lists `Jerom Youssef` with role `'manager'`.

### 3.2 Application code vs database constraints

**Company `source` values.** `schema.sql:57-59` constrains `companies.source` to `('Form','Marketing','Management','Referral','Direct','Exhibition')`. Every UI that writes `source` offers a different list:

| Surface | Options |
|---|---|
| [dashboard/companies/page.tsx:238](../legacy/app/dashboard/companies/page.tsx#L238) | Field Visit, Direct Contact, Referral, Exhibition, Marketing, Other |
| [dashboard/companies/[id]/page.tsx:299](../legacy/app/dashboard/companies/[id]/page.tsx#L299) | same six |
| [rep/companies/page.tsx:168](../legacy/app/rep/companies/page.tsx#L168) | Field Visit, Direct Contact, Referral, Exhibition, Other — **no "Marketing"** |
| [import/page.tsx:7](../legacy/app/dashboard/import/page.tsx#L7) | Field Visit, Direct Contact, Referral, Exhibition, Marketing, Other |

Only `Marketing`, `Referral` and `Exhibition` are common to both lists. `constraints.csv` confirms a `companies_source_check` exists in production but does not include its body, so the production-accepted list cannot be read from the exports.

The rep Add Company form also contains an unreachable branch: at [rep/companies/page.tsx:190-197](../legacy/app/rep/companies/page.tsx#L190-L197) a "Specify Contact Method" input renders when `source_detail === 'Other'` and binds `value={form.source_detail === 'Other' ? '' : form.source_detail}`, so the field always renders empty and the first keystroke closes the branch.

**`projects.project_date`.** NOT NULL in `production_schema.sql.csv`. Both Add Project forms send `form.project_date || null` ([dashboard/projects/page.tsx:96](../legacy/app/dashboard/projects/page.tsx#L96), [rep/projects/page.tsx:86](../legacy/app/rep/projects/page.tsx#L86)) and the production `create_project_with_rep` inserts the parameter unchanged. `Claude-development 2.json` contains a revision of this function using `COALESCE(p_project_date, CURRENT_DATE)`; the body in `functions.csv` does not.

**`companies.company_type` / `region`.** The UI lists in every page match the `schema.sql` CHECK lists exactly.

**Interaction types, stages, loss reasons, quotation statuses, absence types.** UI lists match the `schema.sql` CHECK lists exactly.

**Quotation product fields.** `schema.sql` constrains `quotations.product_type` to `('Normal ACP','FR B1 ACP','FR A2 ACP','A2G2 ACP','Other')` and `finish` to `('Solid Color','Wood Finish','Custom')`. The quotation UI uses `class` values `Class A / Class B / Class A2G2 / Class A2G1` and `fr_rating` values `A2 / B1 / Normal` on `quotation_items` instead, and never writes `product_type` or `finish`.

### 3.3 Application code vs production RLS

**Quotation visibility.** `rls_policies.csv` defines `quotations_rep_read` as `current_user_role() IN ('rep','marketing') AND rep_id = current_rep_id()`. Both rep-facing queries filter `.or('rep_id.eq.<id>,assigned_to_id.eq.<id>')` ([rep/quotations/page.tsx:78](../legacy/app/rep/quotations/page.tsx#L78), [rep/stats/page.tsx:62](../legacy/app/rep/stats/page.tsx#L62)). The `quotation_items` and `quotation_services` read policies *do* check both `rep_id` and `assigned_to_id`; the parent `quotations` policy does not.

**Marketing and activities.** `activities_rep_read` and `activities_rep_insert` in `rls_policies.csv` both require `current_user_role() = 'rep'`. `marketing` is excluded. The marketing sidebar's first entry is "Daily Report" → `/rep` ([Sidebar.tsx:57](../legacy/components/Sidebar.tsx#L57)), and `check_missing_submissions` includes `marketing` reps when checking for missing submissions. `schema.sql:702-707` grants both policies to `('rep','marketing')`; production does not.

**Marketing and quotations.** The marketing nav includes "Quotations" pointing at `/dashboard/quotations` ([Sidebar.tsx:60](../legacy/components/Sidebar.tsx#L60)). [dashboard/layout.tsx:19](../legacy/app/dashboard/layout.tsx#L19) redirects any role other than manager / sales_coordinator / super_admin to `/rep`. The link cannot resolve for a marketing user.

**Notifications scope.** `notifications_select` and `notifications_update` grant `manager` and `super_admin` access to every row. Both notification pages select `*` with no `recipient_id` filter and "Mark all as read" issues `.update({is_read:true}).eq('is_read', false)` with no recipient predicate ([dashboard/notifications/page.tsx:29](../legacy/app/dashboard/notifications/page.tsx#L29), [rep/notifications/page.tsx:29](../legacy/app/rep/notifications/page.tsx#L29)). For a manager, the list shows every user's notifications and "Mark all as read" writes to every user's rows.

**Coordinator write scope.** `companies_manager`, `contacts_manager`, `projects_manager` and `quotations_manager` are all `FOR ALL` with `current_user_role() = ANY (ARRAY['manager','sales_coordinator','super_admin'])`. A `sales_coordinator` therefore has INSERT/UPDATE/DELETE on companies, contacts and projects at the database level.

**`project_reps` INSERT.** `rls_policies.csv` lists only `project_reps_manager` (ALL, manager/super_admin) and `project_reps_rep_read` (SELECT). There is no rep-level INSERT policy on `project_reps`. `company_reps` by contrast has `company_reps_rep_insert`.

**Duplicate policies.** `project_history` carries four functionally paired policies: `history_manager` / `project_history_manager` (identical) and `history_rep_read` / `project_history_rep_read` (identical).

### 3.4 Documentation vs code

| Claim | Source | What the code does |
|---|---|---|
| "Rep: Can edit company name, type, region, source, source_detail, notes for their own companies" | `04_WORKFLOWS/02_CUSTOMER_WORKFLOW.md:74` | [rep/companies/[id]/page.tsx](../legacy/app/rep/companies/[id]/page.tsx) renders company fields read-only; there is no edit control or update call |
| "Notifications are per-recipient — each user sees only their own" | `04_WORKFLOWS/05_NOTIFICATION_WORKFLOW.md:5` | The same file at lines 100-106 quotes RLS granting managers all rows, and neither page filters by recipient |
| "Reps see only notifications addressed to them. RLS policy `notifications_select` enforces `recipient_id = current_rep_id()`" | `02_BUSINESS_RULES/01_BUSINESS_RULES.md:149` (BR-028) | The production policy is `recipient_id = current_rep_id() OR current_user_role() = ANY(ARRAY['manager','super_admin'])` |
| "Coordinator cannot create reps or delete entities" / "Only manager/super_admin can delete companies, projects, contacts" | `10_QUALITY/02_SECURITY_AUDIT.md:71-72`; also `01_BUSINESS_RULES.md:72` (BR-013) | The `FOR ALL` policies named above include `sales_coordinator` |
| "Only manager can delete contacts" | `04_WORKFLOWS/02_CUSTOMER_WORKFLOW.md:63` | True of the UI; not of RLS |
| "RPC Functions (all SECURITY DEFINER — bypass RLS)" | `FACET_CRM_CONTEXT.md:91`; `03_GLOSSARY.md:100` | `schema.sql:541` declares `create_project_with_rep` with no `SECURITY DEFINER`; the same function appears without it in both revisions in `Claude-development 2.json`. `create_company_with_rep` is declared `SECURITY DEFINER` in the transcript. `functions.csv` does not export the attribute, so production cannot be confirmed either way |
| "`projects.next_follow_up` … is unused in the UI" | `FACET_CRM_CONTEXT.md:206`; `10_QUALITY/03_TECHNICAL_DEBT.md:32`; `04_PROJECT_WORKFLOW.md:117` | It is read at [rep/companies/[id]/page.tsx:47](../legacy/app/rep/companies/[id]/page.tsx#L47) and rendered as "📅 Follow up" at [line 150](../legacy/app/rep/companies/[id]/page.tsx#L150), and selected from `stale_projects` at [dashboard/page.tsx:29](../legacy/app/dashboard/page.tsx#L29). It is never written |
| "`quotations` has THREE foreign keys to reps … PostgREST cannot resolve `.select(\"reps(name)\")`" | `05_DATABASE/02_TABLES.md:231`, `03_RELATIONSHIPS.md:96` | Consistent with `foreign_keys.csv`. Both quotation pages avoid the join. Separately, `projects` has exactly one FK to `reps`, and [dashboard/projects/page.tsx:69](../legacy/app/dashboard/projects/page.tsx#L69) does join `reps(name)` — the inline comment there says the join was changed "to unambiguous" |
| Sidebar for marketing includes Notifications | `03_USERS/01_USER_ROLES.md:144` | [Sidebar.tsx:56-62](../legacy/components/Sidebar.tsx#L56-L62) — the marketing nav has no Notifications entry. `06_ARCHITECTURE/02_FRONTEND.md:121` records the code's version |
| Coordinator has access to `/dashboard` KPI page | `03_USERS/02_ACCESS_MATRIX.md:21` | The layout permits it, but the coordinator sidebar has no Dashboard link ([Sidebar.tsx:49-54](../legacy/components/Sidebar.tsx#L49-L54)), and the page reads `activities`, on which a coordinator has no RLS grant |
| "Middleware protects all routes except `/login`, `/register`, `/pending`, `/auth/*`" | `06_ARCHITECTURE/04_AUTHENTICATION.md:95` | [middleware.ts:31](../legacy/middleware.ts#L31) matches `path.startsWith("/auth")`. The only auth route in the app is `/api/auth/callback`, which that prefix does not match |
| "Supabase Storage is not in use … No storage buckets have been created" | `05_DATABASE/07_STORAGE.md:5-7` | `triggers.csv:3-5,14-15` lists triggers on `buckets` and `objects`, including `protect_buckets_delete` and `protect_objects_delete` |
| `rep_monthly_sqm` "available but not directly used" | `01_DATABASE_OVERVIEW.md:72` | Consistent — no code references it. `rep_branch_summary` exists in production and is documented nowhere |

### 3.5 Documentation vs documentation

- `00_MASTER_INDEX.md` links to `13_AI_CONTEXT/` (lines 109, 111), `07_ARCHITECTURE/01_SYSTEM_ARCHITECTURE.md` (line 109), `11_QUALITY/03_TECHNICAL_DEBT.md` (line 117) and `docs/truth/exports/` (line 115). None of these paths exist under `legacy/docs/`. The actual directories are `06_ARCHITECTURE/`, `10_QUALITY/`, `docs/truth/founder/` and `docs/truth/production/`. The index is also wrapped in a stray ```` ```markdown ```` fence (lines 1 and 132).
- User rosters disagree:

  | Source | Contents |
  |---|---|
  | `FACET_CRM_CONTEXT.md:28-33` | Jerom Youssef (super_admin), Ahmed Alzaben (rep), Christina Refaat (sales_coordinator) |
  | `AI_PROJECT_CONTEXT.md:112-118` | same three, coordinator email "unknown" |
  | `03_USERS/01_USER_ROLES.md:88` | manager: "Zaid Arar (sales manager)" — named in no other file |
  | `03_USERS/01_USER_ROLES.md:67` | "Christina Refaat and one other coordinator (email TBC)" |
  | `schema.sql:812-814` | seed lists Jerom Youssef as `'manager'` |
  | `01_PRODUCT_VISION.md:74-80` | 8–10 reps, 1 manager, 2 coordinators, 1–2 marketing |

- `02_APPROVAL_RULES.md:10-13` states the trigger fires and the rep is redirected to `/pending`, then at line 17 states the status "may already be active". `10_QUALITY/03_TECHNICAL_DEBT.md:76-79` and `05_DATABASE/06_TRIGGERS.md:73-79` both state the trigger may never fire. `06_ARCHITECTURE/04_AUTHENTICATION.md:24` states there is no hard account lock.
- `02_APPROVAL_RULES.md:70` lists new self-registration as requiring "soft" approval; `03_USERS/01_USER_ROLES.md:113` says status defaults to `active` and the manager merely adjusts role and target afterwards.
- `10_QUALITY/02_SECURITY_AUDIT.md:29` states the Supabase anon key "was included in AI session context documents (FACET_CRM_CONTEXT.md)". No key appears in `legacy/FACET_CRM_CONTEXT.md` or in any other file under `legacy/` — the only Supabase identifier present is the project URL.
- `05_DATABASE/02_TABLES.md:15` gives `branches.region` a CHECK of five values with no NOT NULL; `production_schema.sql.csv` has it NOT NULL. The same file at line 32 lists `super_admin` in the `reps.role` CHECK and at line 37 lists a `language_pref` CHECK of `(en|ar)`; `schema.sql:39` declares `language_pref` with a default and no CHECK.
- `05_DATABASE/02_TABLES.md:253` declares `quotation_items.total_sqm` as `GENERATED ALWAYS AS (num_sheets * length_m * width_m) STORED`; `03_QUOTATION_WORKFLOW.md:34` repeats this. `production_schema.sql.csv:166` shows `total_sqm numeric` — but that export omits generation and default clauses for every column, so it neither confirms nor contradicts. The DDL in `Claude-development 2.json` includes the `GENERATED ALWAYS AS … STORED` clause.

### 3.6 History artifacts vs the current files

`docs/history/md audit.md` lists six "Critical Code Bugs (Confirmed Still Valid)". None matches the files present:

| Audit claim | Current state |
|---|---|
| "`app/rep/page.tsx` queries `from("customers")`" | [rep/page.tsx:107](../legacy/app/rep/page.tsx#L107) queries `company_reps` with a nested `companies(...)` select |
| "`schema.sql` creates `customer_id_1` / `customer_id_2`" | `schema.sql:193-194` declares `company_id_1` / `company_id_2`, matching the code |
| "`schema.sql` has `check (role in ('rep','manager'))`" | `schema.sql:33` lists four roles |
| "Team page role dropdown only shows `rep` and `manager`" | [team/page.tsx:296-300](../legacy/app/dashboard/team/page.tsx#L296-L300) offers four roles plus a static `super_admin` badge |
| "Friday/Saturday not excluded from submission status" | `set_activity_code()` in both `schema.sql:332` and `functions.csv` checks `activity_dow IN (5,6)` |
| "Loss reason is not enforced at stage change" | Both project pages open a blocking modal with a disabled confirm button |
| "`schema.sql` policies use `shared_with ilike …`" | `schema.sql:644-698` uses `company_reps` / `project_reps` EXISTS clauses |
| "`schema.sql` CHECK on `company_type` allows Factory/Contractor/Developer/Consultant/Trading/Government/Other" | `schema.sql:49-53` lists the nine-value UI list |
| "no `last_revised_at` timestamp" (Gap 2) | present in `schema.sql:179` and in production |

The audit therefore describes an earlier revision of the codebase and schema than the one in `legacy/`. It carries no version marker other than "May 2026".

`docs/history/md proj.md:34-42` lists four roles with no `super_admin`, and describes the system as "Phase 1 + Phase 2 + Phase 3"; `FACET_CRM_CONTEXT.md:2` says "Post Phase 6 cleanup".

`legacy/FACET_CRM_CONTEXT.md` and `legacy/docs/history/FACET_CRM_CONTEXT final.md` have different checksums but are textually identical — they differ only in line endings / trailing whitespace.

### 3.7 Internal code inconsistencies

- Both notification pages ([dashboard](../legacy/app/dashboard/notifications/page.tsx), [rep](../legacy/app/rep/notifications/page.tsx)) are byte-for-byte the same component under two routes.
- "My Companies" ([rep/companies/page.tsx:43](../legacy/app/rep/companies/page.tsx#L43)) and "My Projects" ([rep/projects/page.tsx:64](../legacy/app/rep/projects/page.tsx#L64)) select all rows with no rep predicate and display the count as "companies assigned to you" / "projects". Scoping depends entirely on RLS.
- The daily report resolves the rep's company list through `company_reps` ([rep/page.tsx:107](../legacy/app/rep/page.tsx#L107)); the rep company list does not.
- `dashboard/page.tsx` computes per-rep submission status by matching `activities.rep_name` to `reps.name` as strings ([lines 103, 111](../legacy/app/dashboard/page.tsx#L103)), while `performance/page.tsx` matches on `rep_id` ([line 92](../legacy/app/dashboard/performance/page.tsx#L92)).
- `dashboard/page.tsx:91` filters the submission-status list to `r.role === "rep"`, excluding `marketing`; `check_missing_submissions` includes `marketing`; `performance/page.tsx:73` includes both.
- Dropdown constant arrays (`COMPANY_TYPES`, `REGIONS`, `STAGES`, `INTERACTIONS`, status lists) are redeclared in nine separate page files.
- [activities/page.tsx:166](../legacy/app/dashboard/activities/page.tsx#L166) and [quotations/page.tsx:354](../legacy/app/dashboard/quotations/page.tsx#L354) render `<>` fragments inside `<tbody>` with the `key` on the inner `<tr>` rather than on the fragment.

---

## 4. Open business questions

Questions that cannot be answered from any file under `legacy/`. Each states what was checked.

1. **Which `source` values does the production `companies_source_check` actually accept?** `constraints.csv` confirms the constraint exists but exports no body; `schema.sql` and every UI list disagree. Whether companies created through the UI are being saved, rejected, or saved under a different constraint than `schema.sql` describes is unresolved.
2. **Is `create_project_with_rep` declared `SECURITY DEFINER` in production?** `functions.csv` omits routine attributes. `schema.sql` and both transcript revisions declare it without. `project_reps` has no rep-level INSERT policy. Whether reps can currently create projects at all depends on this.
3. **Is `quotation_items.total_sqm` a generated column in production?** Docs and the development transcript say yes; the DDL export drops all generation and default clauses so it cannot confirm. The application never writes `total_sqm`, and `update_quotation_sqm()` sums it into `quotations.sqm_quoted` — if the column is not generated, every `sqm_quoted` is 0, and `sync_project_sqm()` propagates 0 to `projects.quoted_sqm`.
4. **Is `quotations.sqm_invoiced` a cumulative running total or the value of a single invoice?** `AI_BUSINESS_CONTEXT.md:15` calls it "the commercial truth"; `11_ROADMAP/01_CURRENT_LIMITATIONS.md:9-12` says the coordinator must enter a cumulative figure; `03_QUOTATION_WORKFLOW.md:126` says the coordinator "manually sums them". The intended convention, and whether existing rows follow it, is not stated.
5. **How is SQM attributed when two reps work one project?** `project_reps.sqm_split` exists and is never written. `01_BUSINESS_RULES.md:133` (BR-025) says "the coordinator specifies attribution" via `quotations.rep_id` / `assigned_to_id`, but the quotation form writes the *same* rep id into both fields. The actual splitting rule is undefined.
6. **Which field is the operative follow-up date?** `project_date` drives the Follow-ups page; `next_follow_up` is still read in two places and never written; `quote_date` and `expected_close` exist on `projects` in production and are read nowhere. Whether `next_follow_up` still holds live data, and what `quote_date` / `expected_close` were for, is unknown.
7. **Do `companies.contact1_name/phone` and `contact2_name/phone` still hold data?** They exist in production, predate the `contacts` table, and are referenced by no code, doc, RPC or migration note.
8. **Is `stage_changed_at` populated for existing projects?** `create_project_with_rep` does not set it, and only stage changes write it. The `stale_projects` view treats `stage_changed_at IS NULL` as stale, so every project that has never had a stage change appears on the manager's stale list from creation. Whether that is the intended definition of "stale" is not stated anywhere.
9. **What is a `shared` versus a `conflict` duplicate classification supposed to trigger?** `02_APPROVAL_RULES.md:52-56` and `02_CUSTOMER_WORKFLOW.md:99-107` describe the meanings, but nothing in the code, triggers or RLS reads `classification`. There is no defined operational consequence.
10. **Who are the current users and what are their roles?** Four sources give four different rosters (§3.5). `01_USER_ROLES.md` names a manager, Zaid Arar, who appears nowhere else. The seed in `schema.sql` assigns Jerom Youssef `manager`, not `super_admin`.
11. **Should `marketing` be able to submit and read daily activity reports?** The sidebar routes them to the daily report, `check_missing_submissions` chases them for missing reports, `schema.sql` grants the policies, and production RLS does not. Which behaviour is intended is not recorded.
12. **Should `sales_coordinator` be able to create and delete companies, contacts and projects?** Production RLS grants it; three docs state the opposite; the coordinator UI offers no such controls. The intended permission is unresolved.
13. **Should a manager see and mark-as-read other users' notifications?** Production RLS permits it and the pages exercise it; the docs state notifications are per-recipient.
14. **Is the pending-approval flow intended to be live?** The screen, the status value, the trigger and both layout guards exist; the registration endpoint bypasses all of them. Three docs describe the gate as intentional, aspirational, and vestigial respectively.
15. **What governs branch assignment?** `branches` is referenced by `reps.branch_id` and `companies.branch_id`, drives the dashboard branch filter and the `rep_branch_summary` view, and has no create, edit or assignment UI anywhere. How branches are meant to be populated and maintained is not documented.
16. **Which environment do the production CSV exports describe, and when were they taken?** No timestamp appears in any of the eight files. `schema.sql:3` says "Last updated: May 2026"; `00_MASTER_INDEX.md:3` says "Generated: June 2026"; the transcript exports are dated June 8, 2026. Whether the CSVs predate or postdate the code in `legacy/app/` cannot be determined.
17. **Are the two truncated exports (`tables_columns.csv`, `constraints.csv`) truncated at the source or by transfer?** Both stop at exactly 100 data rows, which excludes `projects`, `quotations`, `quotation_items`, `quotation_services`, `reps` and `rep_absences` from the column-and-default and constraint inventories.
18. **What is the ERP system, and what is the contract between it and the CRM?** `02_BUSINESS_MODEL.md:108` states the ERP is "unnamed". `quotations.erp_quotation_id` is a free-text field with no validation. There is no specification of the identifier format or of what a coordinator is expected to reconcile.
19. **Is `revision_number` meant to increment, and on what event?** The column defaults to 1, is displayed in both quotation views, and is never written by code or trigger. `03_QUOTATION_WORKFLOW.md:89` says it increments "conceptually".
20. **What is the retention policy for `notifications` and `project_history`?** `01_DATABASE_OVERVIEW.md:59` marks pruning as an assumption with no mechanism. Both tables grow without bound and neither has a delete path in code.
