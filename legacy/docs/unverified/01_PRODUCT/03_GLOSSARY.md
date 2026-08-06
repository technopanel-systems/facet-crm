# 03. Glossary — FACET CRM

This glossary defines every term used in the system. When in doubt, this file is authoritative.

---

## Core Entities

### Company
The root entity in the CRM. Represents a business (not a person). Previously called "Customer" in early code — the database table is still named `companies` (formerly `customers`). One company can have many contacts, many projects, and be worked by multiple reps.

### Contact
An individual person at a company. Contacts belong to companies, not to reps. A company can have multiple contacts. The `is_primary` flag marks the main point of contact.

### Project
A specific construction job or opportunity. Projects are linked to companies and reps. One project can involve multiple companies (primary contractor, consultant, owner). One project tracks the sales stage. Projects are the unit of commercial measurement.

### Quotation
A price proposal mirrored from the ERP into the CRM. Created by the sales coordinator. One project can have multiple quotations (e.g., for different product specifications). Quotations have line items (quotation_items) and optional services (quotation_services).

### Activity
A single sales interaction recorded in the daily report. One row = one interaction. Can be a Visit, Call, WhatsApp, Email, Meeting, or Site Visit. Must be linked to a company selected from the rep's assigned companies (no free-text company entry).

---

## People / Roles

### Rep
A field sales representative. Works with rep-assigned companies and projects. Submits daily activity reports. Access restricted to own data via junction tables.

### Manager
A sales manager. Full system access. Approves new accounts, sets targets, resolves duplicates, monitors all reps.

### Sales Coordinator
Back-office team member (2 people, Riyadh-based). Manages quotations and invoice records. Does not submit daily activities. Can view all companies and projects but cannot manage rep data.

### Marketing
A lead-generation team member. Functions like a rep in the system. Registers companies (leads). Submits daily activity reports.

### Super Admin
System owner role. Functionally identical to Manager. Cannot be role-changed via the UI. Currently assigned to: Jerom Youssef (jerom@technopanel.com.sa).

---

## Metrics and Measurements

### SQM (Square Meters)
The primary unit of measurement. All sales targets, activity reporting, and quotations are measured in SQM. The CRM never tracks monetary value — price data exists in quotation_items but is ERP reference only.

### Monthly Target SQM
The SQM quota assigned to each rep by the manager. Set per rep in `reps.monthly_target_sqm`. Measured against invoiced SQM.

### Activity SQM
`activities.sqm_done` — The rep's field estimate of SQM confirmed in a given interaction. A leading indicator. Subject to rep estimation. **Not the commercial KPI.**

### Invoiced SQM
`quotations.sqm_invoiced` — The coordinator-recorded SQM from actual ERP invoices. The commercial truth. **The real performance KPI.**

### Pipeline SQM
`quotations.sqm_quoted` or `activities.sqm_expected` — SQM in the active pipeline, not yet invoiced.

---

## Status Values

### Submission Status (activities.submission_status)
| Value | Meaning |
|---|---|
| `on_time` | Submitted on the same calendar day as activity_date (Asia/Riyadh timezone) |
| `late` | Submitted after activity_date but within the grace period (next working day) |
| `missing` | No activity submitted for a required working day |

### Project Stage
New Lead → Catalog Sent → Quotation Sent → Under Review → Won → In Production → Delivered → Lost

### Quotation Status
pending → submitted → won / lost / expired / cancelled

### Rep Status
| Value | Meaning |
|---|---|
| `active` | Can log in and use the system |
| `pending` | Registered but awaiting manager approval |
| `inactive` | Account disabled |

### Company Status
active / inactive / blocked

---

## Technical Terms

### Junction Table
A database table that links two entities in a many-to-many relationship. FACET uses `company_reps` (links companies to reps) and `project_reps` (links projects to reps). These replaced the old `shared_with` text column. **The old `shared_with` approach is completely removed and must never be reinstated.**

### RLS (Row Level Security)
PostgreSQL feature that restricts which rows a database user can see or modify. FACET uses RLS to enforce rep data isolation — reps can only see their own companies and projects.

### SECURITY DEFINER
A PostgreSQL function attribute that causes the function to run with the privileges of the function owner (postgres/admin), not the calling user. Required for RPCs that need to bypass RLS for atomic inserts. All FACET RPCs that create records and immediately assign a rep use SECURITY DEFINER.

### RPC (Remote Procedure Call)
A PostgreSQL function called from the client via `supabase.rpc('function_name', params)`. Used for atomic operations that need to insert into multiple tables in a single transaction.

### pg_trgm
A PostgreSQL extension that enables trigram-based fuzzy text matching. Used for Arabic company name duplicate detection. The `similarity()` function returns a 0.0–1.0 score; FACET uses a threshold of 0.6.

### Arabic Normalization
The process of standardizing Arabic text for comparison. Strips diacritics, unifies Alef variants (أ/إ/آ/ٱ → ا), converts ة → ه, ى → ي, removes the definite article ال. Applied to company names before duplicate detection. Stored in `companies.company_name_normalized`.

### Stale Project
A project that has not had a stage update in 14 or more days and is not in Won, Delivered, or Lost status. Shown in the manager dashboard as requiring attention.

---

## Dropdown Canonical Values

These are the exact allowed values for every dropdown field. Using any other value will fail database CHECK constraints.

| Field | Allowed Values |
|---|---|
| company_type | Factory, Advertising, Real Estate, Owner, Consultant, Contractor, Station Management, Workshop, Other |
| region | Central, West, East, North, South, Foreign |
| source | Field Visit, Direct Contact, Referral, Exhibition, Marketing, Other |
| interaction_type | Visit, Call, WhatsApp, Email, Meeting, Site Visit |
| stage | New Lead, Catalog Sent, Quotation Sent, Under Review, Won, In Production, Delivered, Lost |
| loss_reason | Price, Competitor, Timeline, No Budget, Specification Mismatch, No Response, Other |
| quotation status | pending, submitted, won, lost, expired, cancelled |
| product class | Class A, Class B, Class A2G2, Class A2G1 |
| fr_rating | A2, B1, Normal |
| supplier_code | N, K, D, C, G, G1, Y |
| thickness_mm | 4, 5, 6 |
| service_type | Cutting, Grooving, Bending, CNC |
| absence_type | sick, annual_leave, eid_vacation, other |

---

## Saudi Business Context

### Work Week
The Saudi working week is Sunday to Thursday. Friday and Saturday are the weekend. Any compliance or scheduling logic must treat day-of-week 5 (Friday) and 6 (Saturday) as non-working days.

### Company Domain
All Technopanel employees use @technopanel.com.sa email addresses. This is enforced in both the API registration route and the frontend register form.

### Language
Arabic is the primary language for many company names and contacts. The system stores company names in Arabic and English. Arabic text normalization is applied for duplicate detection. Full Arabic UI (RTL) is planned but not yet implemented.
