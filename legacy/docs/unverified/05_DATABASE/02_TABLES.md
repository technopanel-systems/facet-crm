# 02. Tables — FACET CRM

All tables are in the `public` schema unless noted. All have RLS enabled.

---

## `branches`

Regional office locations.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK, DEFAULT uuid_generate_v4() | |
| name | text | NOT NULL | e.g., "Riyadh Branch" |
| region | text | CHECK (Central\|West\|East\|North\|South) | |
| is_active | boolean | DEFAULT true | |
| created_at | timestamptz | NOT NULL DEFAULT now() | |

**Seeded data:** Riyadh (Central), Eastern Branch (East), Southern Branch (South)

---

## `reps`

All system users. Every person who logs in has a row here.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| name | text | NOT NULL | Display name |
| email | text | NOT NULL, UNIQUE | Must end in @technopanel.com.sa |
| role | text | NOT NULL, DEFAULT 'rep', CHECK (rep\|manager\|sales_coordinator\|marketing\|super_admin) | |
| status | text | NOT NULL, DEFAULT 'active', CHECK (active\|inactive\|pending) | |
| monthly_target_sqm | numeric | NOT NULL, DEFAULT 0 | Set by manager |
| auth_user_id | uuid | UNIQUE | Links to Supabase auth.users.id |
| branch_id | uuid | FK → branches(id) | Nullable — not all reps assigned to branch |
| language_pref | text | DEFAULT 'en', CHECK (en\|ar) | Future Arabic UI support |
| created_at | timestamptz | NOT NULL DEFAULT now() | |

**Indexes:** `idx_reps_auth_user` on auth_user_id

---

## `companies`

Root CRM entity. Formerly named `customers` — PK index still named `customers_pkey`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| customer_code | text | UNIQUE | Auto: CUST-00001 |
| company_name | text | NOT NULL | Primary company name (Arabic or English) |
| company_name_normalized | text | | Auto-normalized by trigger for duplicate detection |
| company_type | text | CHECK (Factory\|Advertising\|Real Estate\|Owner\|Consultant\|Contractor\|Station Management\|Workshop\|Other) | |
| region | text | CHECK (Central\|West\|East\|North\|South\|Foreign) | |
| source | text | CHECK (Field Visit\|Direct Contact\|Referral\|Exhibition\|Marketing\|Other) | How the lead was acquired |
| source_detail | text | | Sub-detail for source (e.g., "WhatsApp" under "Direct Contact") |
| primary_rep_id | uuid | FK → reps(id) | Cache of primary rep — also enforced via company_reps |
| status | text | NOT NULL DEFAULT 'active', CHECK (active\|inactive\|blocked) | |
| branch_id | uuid | FK → branches(id) | |
| notes | text | | |
| created_at | timestamptz | NOT NULL DEFAULT now() | |
| updated_at | timestamptz | NOT NULL DEFAULT now() | Updated by trigger |

**Triggers:** trg_customer_code (code gen), trg_normalize_customer (Arabic normalization), trg_customers_updated (updated_at)

---

## `company_reps`

Junction table linking companies to reps. This is the access control boundary for reps.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| company_id | uuid | NOT NULL, FK → companies(id) CASCADE | |
| rep_id | uuid | NOT NULL, FK → reps(id) CASCADE | |
| role | text | NOT NULL, CHECK (primary\|shared) | |
| assigned_by | uuid | FK → reps(id) | Who made the assignment |
| assigned_at | timestamptz | NOT NULL DEFAULT now() | |
| | | UNIQUE (company_id, rep_id) | One row per company-rep pair |

**Triggers:** trg_notify_company_assignment (fires notification to rep on INSERT)  
**Indexes:** idx_company_reps_company, idx_company_reps_rep

---

## `contacts`

Individual people at companies.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| contact_code | text | UNIQUE | Auto: CON-00001 |
| company_id | uuid | NOT NULL, FK → companies(id) CASCADE | |
| full_name | text | NOT NULL | English name |
| full_name_ar | text | | Arabic name |
| title | text | | Job title / role |
| phone | text | | |
| whatsapp | text | | Often same as phone |
| email | text | | |
| is_primary | boolean | DEFAULT false | Primary contact flag |
| notes | text | | |
| created_by | uuid | FK → reps(id) | |
| created_at | timestamptz | | |
| updated_at | timestamptz | | Updated by trigger |

**Triggers:** trg_contact_code (code gen), trg_contacts_updated (updated_at)  
**Indexes:** idx_contacts_company

---

## `projects`

Construction jobs / sales opportunities.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| project_code | text | UNIQUE | Auto: PROJ-00001 |
| customer_id | uuid | FK → companies(id) SET NULL | Primary company |
| company_name | text | | **LEGACY CACHE** — do not use for access control |
| project_name | text | | Name of the building/job |
| city | text | | |
| stage | text | NOT NULL DEFAULT 'New Lead', CHECK (New Lead\|Catalog Sent\|Quotation Sent\|Under Review\|Won\|In Production\|Delivered\|Lost) | |
| quoted_sqm | numeric | NOT NULL DEFAULT 0 | **Auto-calculated from quotations** |
| won_sqm | numeric | NOT NULL DEFAULT 0 | **Auto-calculated from quotations** |
| assigned_rep_id | uuid | FK → reps(id) | **LEGACY CACHE** — also in project_reps |
| contact_id | uuid | FK → contacts(id) | Primary contact for this project |
| stage_changed_at | timestamptz | | Updated when stage changes |
| project_date | date | | Next follow-up / action date |
| next_follow_up | date | | **LEGACY — not used in UI, use project_date** |
| loss_reason | text | | Required when stage = Lost |
| loss_notes | text | | Optional additional notes when lost |
| notes | text | | |
| created_at | timestamptz | NOT NULL DEFAULT now() | |
| updated_at | timestamptz | NOT NULL DEFAULT now() | |

**Triggers:** trg_project_code, trg_project_history (audit log), trg_projects_updated  
**Indexes:** idx_projects_company (customer_id), idx_projects_stage

---

## `project_reps`

Junction table linking projects to reps.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| project_id | uuid | NOT NULL, FK → projects(id) CASCADE | |
| rep_id | uuid | NOT NULL, FK → reps(id) CASCADE | |
| role | text | NOT NULL, CHECK (primary\|shared) | |
| sqm_split | numeric | | SQM attribution split (future use) |
| assigned_by | uuid | FK → reps(id) | |
| assigned_at | timestamptz | NOT NULL DEFAULT now() | |
| | | UNIQUE (project_id, rep_id) | |

**Indexes:** idx_project_reps_project, idx_project_reps_rep

---

## `activities`

Daily rep activity reports. One row = one interaction.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| activity_code | text | UNIQUE | Auto: ACT-00001 |
| activity_date | date | NOT NULL | The date the activity occurred |
| month | text | | Auto-set: "Month YYYY" format |
| rep_id | uuid | FK → reps(id) | |
| rep_name | text | NOT NULL | **LEGACY CACHE** |
| company_id | uuid | FK → companies(id) | Structured link |
| company_name | text | NOT NULL | From selected company |
| company_type | text | | From selected company |
| contact_id | uuid | FK → contacts(id) | |
| contact_person | text | | From selected contact |
| phone | text | | |
| interaction_type | text | CHECK (Visit\|Call\|WhatsApp\|Email\|Meeting\|Site Visit) | |
| project_id | uuid | FK → projects(id) | |
| project_name | text | | From selected project |
| notes | text | | Free text outcome/notes |
| region | text | | Pre-filled from company |
| sqm_done | numeric | DEFAULT 0 | Rep's field SQM estimate |
| sqm_expected | numeric | DEFAULT 0 | Pipeline SQM expected |
| submitted_at | timestamptz | NOT NULL DEFAULT now() | When the row was inserted |
| submission_status | text | CHECK (on_time\|late\|missing) | Set by trigger |
| created_at | timestamptz | NOT NULL DEFAULT now() | |

**Triggers:** trg_activity_code (code gen, month, submission_status calculation)  
**Indexes:** idx_activities_rep_id, idx_activities_date, idx_activities_company_id, idx_activities_project_id

---

## `quotations`

ERP quotation mirrors. Created by coordinator only.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| quotation_code | text | UNIQUE | Auto: QUO-00001 |
| project_id | uuid | FK → projects(id) CASCADE | |
| company_id | uuid | FK → companies(id) | |
| rep_id | uuid | FK → reps(id) | Primary rep credited |
| coordinator_id | uuid | FK → reps(id) | Who created the CRM record |
| assigned_to_id | uuid | FK → reps(id) | Rep assigned by coordinator |
| erp_quotation_id | text | | Reference to ERP system quote number |
| product_type | text | CHECK (Normal ACP\|FR B1 ACP\|FR A2 ACP\|A2G2 ACP\|Other) | Legacy single-product field |
| finish | text | CHECK (Solid Color\|Wood Finish\|Custom) | Legacy field |
| sqm_quoted | numeric | NOT NULL DEFAULT 0 | **Auto-calculated from quotation_items** |
| price_per_sqm | numeric | | Legacy single price field |
| quote_date | date | | |
| valid_until | date | | Expiry date |
| revision_number | integer | DEFAULT 1 | Increments on revision |
| last_revised_at | timestamptz | | Set when quotation updated |
| status | text | NOT NULL DEFAULT 'pending', CHECK (pending\|submitted\|won\|lost\|expired\|cancelled) | |
| cancellation_reason | text | | Required when status = cancelled |
| sqm_invoiced | numeric | DEFAULT 0 | Coordinator-entered from ERP invoice |
| sqm_delivered | numeric | DEFAULT 0 | Delivered quantity |
| notes | text | | Coordinator-internal notes |
| created_at | timestamptz | NOT NULL DEFAULT now() | |
| updated_at | timestamptz | NOT NULL DEFAULT now() | |

**Triggers:** trg_quotation_code, trg_quotations_updated, trg_sync_project_sqm  
**Indexes:** idx_quotations_project, idx_quotations_company, idx_quotations_rep, idx_quotations_status

**IMPORTANT — Ambiguous FK:** quotations has THREE foreign keys to reps (rep_id, coordinator_id, assigned_to_id). PostgREST cannot resolve `.select("reps(name)")` on this table — it crashes silently. Always look up rep names from a pre-loaded reps array client-side. Never join reps directly from quotations in a Supabase query.

---

## `quotation_items`

Product line items per quotation. Multiple per quotation.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| quotation_id | uuid | NOT NULL, FK → quotations(id) CASCADE | |
| class | text | NOT NULL | Class A, Class B, Class A2G2, Class A2G1 |
| fr_rating | text | NOT NULL | A2, B1, Normal |
| color_code | text | | e.g., RAL 9016 |
| supplier_code | text | | N, K, D, C, G, G1, Y |
| width_m | numeric | NOT NULL | Sheet width in meters |
| width_is_custom | boolean | DEFAULT false | True if non-standard width |
| length_m | numeric | NOT NULL | Sheet length in meters |
| num_sheets | integer | NOT NULL DEFAULT 1 | Number of sheets |
| thickness_mm | integer | NOT NULL DEFAULT 4 | 4, 5, or 6 mm |
| price_per_sqm | numeric | | SAR per square meter |
| total_sqm | numeric | GENERATED ALWAYS AS (num_sheets * length_m * width_m) STORED | Computed column |
| created_at | timestamptz | NOT NULL DEFAULT now() | |

**Triggers:** trg_update_quotation_sqm (updates parent quotation.sqm_quoted on change)

---

## `quotation_services`

Optional fabrication services per quotation.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| quotation_id | uuid | NOT NULL, FK → quotations(id) CASCADE | |
| service_type | text | NOT NULL | Cutting, Grooving, Bending, CNC |
| price_per_sqm | numeric | | SAR per sqm for this service |
| created_at | timestamptz | NOT NULL DEFAULT now() | |

---

## `duplicate_flags`

Potential duplicate company pairs for manager review.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| company_id_1 | uuid | FK → companies(id) CASCADE | |
| company_id_2 | uuid | FK → companies(id) CASCADE | |
| match_type | text | CHECK (phone\|name) | How the match was detected |
| match_key | text | | The matching value |
| classification | text | NOT NULL DEFAULT 'pending', CHECK (pending\|shared\|conflict\|resolved) | |
| resolved_at | timestamptz | | When classified |
| resolved_by | uuid | FK → reps(id) | Manager who classified |
| created_at | timestamptz | NOT NULL DEFAULT now() | |

---

## `notifications`

In-app notification records.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| recipient_id | uuid → reps(id) CASCADE | |
| type | text CHECK (pending_approval\|assignment\|duplicate_alert\|project_stale\|quotation_expiry\|follow_up_due\|lead_submitted\|missing_submission\|system) | |
| title | text NOT NULL | |
| body | text | |
| entity_type | text CHECK (company\|contact\|project\|quotation\|rep) | |
| entity_id | uuid | |
| is_read | boolean DEFAULT false | |
| created_at | timestamptz DEFAULT now() | |

---

## `company_holidays`

Team-wide non-working days (Eid, National Day, etc.).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| holiday_name | text NOT NULL | e.g., "Eid Al Fitr" |
| date_from | date NOT NULL | |
| date_to | date NOT NULL | |
| created_by | uuid → reps(id) | Manager who added |
| created_at | timestamptz | |
| | CHECK (date_to >= date_from) | |

---

## `rep_absences`

Individual rep excused periods.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| rep_id | uuid NOT NULL → reps(id) CASCADE | |
| absence_type | text CHECK (sick\|annual_leave\|eid_vacation\|other) | |
| date_from | date NOT NULL | |
| date_to | date NOT NULL | |
| notes | text | |
| created_by | uuid → reps(id) | Manager who recorded |
| created_at | timestamptz | |
| | CHECK (date_to >= date_from) | |

---

## `project_history`

Audit trail for project changes.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| project_id | uuid NOT NULL → projects(id) CASCADE | |
| field_name | text NOT NULL | 'stage', 'quoted_sqm', or 'loss_reason' |
| old_value | text | |
| new_value | text | |
| changed_by | uuid → reps(id) | Via current_rep_id() in trigger |
| changed_at | timestamptz NOT NULL DEFAULT now() | |
