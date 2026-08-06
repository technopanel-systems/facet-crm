# 03. Relationships — FACET CRM

## Entity Relationship Overview

```
branches ──────────────────────────────────────────────────────┐
                                                                │
reps ──────────────────────────────────────── branch_id ───────┘
  │
  ├── company_reps ──── companies ──── contacts
  │        │               │
  │        │               └── projects ──── project_reps ──── reps
  │        │                       │
  │        │                       └── quotations ──── quotation_items
  │        │                               │
  │        │                               └── quotation_services
  │
  ├── activities ──── companies
  │         │──────── projects
  │         └──────── contacts
  │
  ├── notifications (recipient)
  ├── rep_absences
  └── project_history (changed_by)

duplicate_flags ──── companies (×2)
company_holidays (no FK, global)
```

---

## Core Relationship Rules

### Company → Rep (Many-to-Many via company_reps)
- A company can be assigned to 1 or 2 reps
- One rep can be assigned to many companies
- Access controlled entirely by company_reps entries
- `companies.primary_rep_id` is a cache — the junction table is authoritative

### Project → Company (Many-to-One)
- Each project has exactly one `customer_id` (primary company)
- Projects are linked to companies, not contacts
- The `company_name` text field on projects is a legacy cache

### Project → Rep (Many-to-Many via project_reps)
- A project can be assigned to 1 or 2 reps
- Rep access via `project_reps` OR `projects.assigned_rep_id` (legacy fallback)
- When querying projects for a rep, check BOTH (RLS policy does this)

### Quotation → Project (Many-to-One)
- Each quotation belongs to one project
- Multiple quotations per project are normal (different product specs, revisions)
- Quotation CASCADE deletes quotation_items and quotation_services

### Activity → Company/Project/Contact (Many-to-One, nullable)
- Activities link to companies (structured), projects, and contacts
- All three FKs are nullable (though company_id should always be populated for new submissions)
- Legacy activities may have null company_id with free-text company_name

---

## Junction Table Detail

### `company_reps`
```
companies (1) ←──── company_reps ────→ (N) reps
```
Unique constraint: (company_id, rep_id) — one row per pair  
Role values: 'primary' (first/main rep), 'shared' (second rep)  
Trigger: fires notification to rep on INSERT

### `project_reps`
```
projects (1) ←──── project_reps ────→ (N) reps
```
Unique constraint: (project_id, rep_id)  
Role values: 'primary', 'shared'  
sqm_split: future use for SQM attribution percentage

---

## Cascade Behaviors

| Delete From | Cascades To |
|---|---|
| companies | company_reps (CASCADE), contacts (CASCADE), quotations.company_id (no cascade — FK nullable) |
| projects | project_reps (CASCADE), quotation_items via quotations (CASCADE), project_history (CASCADE) |
| quotations | quotation_items (CASCADE), quotation_services (CASCADE) |
| reps | company_reps (CASCADE), project_reps (CASCADE), notifications (CASCADE), rep_absences (CASCADE) |
| contacts | activities.contact_id (SET NULL via FK constraint) |

---

## Critical Gotcha: Multiple FKs to Same Table

`quotations` has THREE foreign keys pointing to `reps`:
- `rep_id` — primary rep
- `coordinator_id` — who created the CRM record  
- `assigned_to_id` — rep assigned by coordinator

**PostgREST (Supabase) cannot resolve `.select("reps(name)")` when multiple FKs exist to the same table.** The query silently returns empty results.

**Solution:** Never join reps from quotations in a Supabase query. Instead:
1. Fetch all reps separately
2. Look up rep names client-side:
```typescript
const repName = allReps.find(r => r.id === q.rep_id || r.id === q.assigned_to_id)?.name || '—';
```

This pattern applies to any table with multiple FKs to the same parent table.
