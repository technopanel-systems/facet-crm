# 04. Project Workflow — FACET CRM

## Overview

A project represents a specific construction job. Projects are the unit of commercial measurement — quotations and invoices link to projects, not to companies directly.

---

## Project Lifecycle

```
New Lead → Catalog Sent → Quotation Sent → Under Review → Won → In Production → Delivered
                                                              ↘ Lost (at any stage)
```

---

## Stage Definitions

| Stage | Meaning |
|---|---|
| New Lead | Initial identification. Rep has made contact but nothing has been shared. |
| Catalog Sent | Product catalog or specification sheets sent to the client. |
| Quotation Sent | A formal ERP quotation has been prepared and sent. |
| Under Review | Client is reviewing the quotation. Active negotiation. |
| Won | Deal confirmed. Materials ordered or about to be. |
| In Production | Materials being manufactured or prepared. |
| Delivered | Materials delivered to site. Commercial closure. |
| Lost | Deal not won. Loss reason required. |

---

## Creating a Project

### Who Can Create
- Reps: at `/rep/projects` — creates project under their own assigned companies
- Manager/super_admin: at `/dashboard/projects` — can assign to any rep and any company

### How It Works (Atomic RPC)
Project creation MUST use the `create_project_with_rep()` RPC function. Never use two separate INSERT statements.

```typescript
await supabase.rpc('create_project_with_rep', {
  p_customer_id:  companyId,
  p_project_name: name,
  p_city:         city,
  p_stage:        'New Lead',
  p_quoted_sqm:   quotedSqm,
  p_project_date: projectDate,
  p_notes:        notes,
  p_contact_id:   contactId || null,
  p_rep_id:       repId,
});
```

The RPC atomically:
1. Inserts into `projects`
2. Inserts into `project_reps` (with role = 'primary')

If step 2 fails, step 1 is rolled back. This prevents orphaned projects that a rep cannot see.

---

## Updating Stage

### Rep Flow
1. Rep opens My Projects at `/rep/projects`
2. Selects new stage from dropdown on the project card
3. If stage = **Lost**: loss reason modal opens (required field)
4. Rep selects loss reason, optionally adds notes, confirms
5. Stage update saved, history logged

### Manager Flow
1. Manager opens Projects at `/dashboard/projects`
2. Selects new stage from inline dropdown in table row
3. Same loss reason modal for Lost
4. Stage update saved, history logged

### What Happens in the Database
```sql
UPDATE projects SET
  stage = new_stage,
  stage_changed_at = now(),
  loss_reason = loss_reason_if_lost,
  loss_notes = notes_if_provided
WHERE id = project_id;
```
The `trg_project_history` trigger fires on UPDATE and logs the change to `project_history`.

---

## Project History

Every stage change, quoted_sqm change, and loss_reason change is logged automatically.

Table: `project_history`
| Column | Content |
|---|---|
| field_name | 'stage', 'quoted_sqm', or 'loss_reason' |
| old_value | Previous value as text |
| new_value | New value as text |
| changed_by | rep_id of who made the change (via current_rep_id()) |
| changed_at | Timestamp |

Reps can view history for their own projects via the History modal on the projects page. Manager can view full history at `/dashboard/projects/[id]`.

---

## Follow-Up Dates

Each project has a `project_date` field (a date, not a timestamp). This represents the next action date for the project.

- Reps set this when creating or updating a project
- The manager Follow-ups page (`/dashboard/followups`) shows all projects where `project_date <= today` and stage is active (not Won/Delivered/Lost)
- Grouped by rep, colored by urgency (due today = amber, overdue ≤7d = red, overdue >7d = dark red)

**Note:** The column `projects.next_follow_up` also exists in the database as a legacy column. It is not used in the UI. The active field is `projects.project_date`.

---

## Project SQM Fields

| Column | Source | Meaning |
|---|---|---|
| `projects.quoted_sqm` | Auto-calculated from quotations | Sum of sqm_quoted across non-cancelled quotations for this project |
| `projects.won_sqm` | Auto-calculated from quotations | Sum of sqm_invoiced from won quotations for this project |

Both are updated automatically by the `trg_sync_project_sqm` trigger when quotations change. Reps should not manually edit these.

---

## Stale Projects

A project is considered stale when:
- `stage_changed_at < now() - interval '14 days'` OR `stage_changed_at IS NULL`
- AND `stage NOT IN ('Won', 'Delivered', 'Lost')`

Stale projects appear in:
- Manager dashboard → Stale Projects card (top 8)
- `stale_projects` database view

---

## Rep Visibility Rules

A rep sees a project if:
- Their `rep_id` appears in `project_reps` for that project (primary or shared), OR
- Their `rep_id` matches `projects.assigned_rep_id` (legacy cache)

Reps on shared projects see only their own activities. They cannot see the other rep's activity notes or interaction details on the same project.
