# FACET CRM — Complete Project Context Export
> Generated: May 2026 — Post Phase 6 cleanup
> Paste this entire file at the start of any new AI session.

---

# Project Overview

FACET CRM is a custom sales operations CRM for Technopanel, a Saudi ACP cladding supplier.
Live URL: crm.technopanel.com.sa
Repo: github.com/technopanel-systems/facet-crm

## Stack
- Next.js 14.2.5 (App Router), TypeScript strict, Tailwind CSS
- Supabase (PostgreSQL + Auth + RLS), Bahrain region
- Vercel (auto-deploy on push to main)
- Cloudflare DNS (grey cloud, DNS only)

## Users
| Role | Access |
|---|---|
| `rep` | Own companies/contacts/projects/activities. `/rep` layout. |
| `marketing` | Same as rep. |
| `sales_coordinator` | `/dashboard` layout. Creates quotations. Read-only on companies/projects. |
| `manager` | Full access. `/dashboard` layout. |
| `super_admin` | Same as manager + cannot be role-changed via UI. Jerom's role. |

## Current Users
| Name | Email | Role |
|---|---|---|
| Jerom Youssef | jerom@technopanel.com.sa | super_admin |
| Ahmed Alzaben | a.alzaben@technopanel.com.sa | rep |
| Christina Refaat | (coordinator email) | sales_coordinator |

---

# Architecture

## Supabase Clients
| File | Use |
|---|---|
| `lib/supabase/client.ts` | Client components only |
| `lib/supabase/server.ts` | Server components, layouts |
| `lib/supabase/admin.ts` | API routes only (`/api/*`) |

## Environment Variables
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   ← server only, never commit

## Key Business Rules
- SQM targets are in square meters, not money
- A customer = a company (not a person)
- Friday + Saturday = weekend (off days)
- On time = submitted same calendar day as activity (Asia/Riyadh)
- Late = submitted next working day
- Reps only see their own activities even on shared companies/projects
- Only manager/super_admin can delete companies, contacts, projects

---

# Database Tables

## Core Tables
- `reps` — all users (rep/manager/sales_coordinator/marketing/super_admin)
- `branches` — regional offices
- `companies` — root CRM entity (formerly `customers`)
- `company_reps` — junction: which reps own which companies
- `contacts` — multiple per company
- `projects` — linked to companies
- `project_reps` — junction: which reps own which projects
- `activities` — daily rep reports
- `quotations` — created by coordinator, mirrors ERP
- `quotation_items` — product lines per quotation (auto-calculates total_sqm)
- `quotation_services` — services per quotation (Cutting/Grooving/Bending/CNC)
- `duplicate_flags` — system-detected, manager-resolved
- `notifications` — in-app per recipient
- `company_holidays` — team-wide excused days
- `rep_absences` — individual excused periods
- `project_history` — audit trail for stage/sqm/loss_reason changes

## Key Columns Added (not in original schema.sql)
- `companies.source_detail` — sub-detail for source field
- `projects.project_date` — replaces next_follow_up
- `projects.loss_notes` — optional notes when marking lost
- `quotations.erp_quotation_id` — reference to ERP system
- `quotations.cancellation_reason` — required when status=cancelled
- `quotations.assigned_to_id` — rep assigned by coordinator
- `quotations.last_revised_at` — timestamp of last edit

## RPC Functions (all SECURITY DEFINER — bypass RLS)
- `create_company_with_rep(...)` — atomic company + company_reps insert
- `create_project_with_rep(...)` — atomic project + project_reps insert
- `detect_duplicate_companies()` — pg_trgm server-side scan, returns count
- `check_missing_submissions()` — called from dashboard on load
- `current_user_role()` — returns role for auth.uid()
- `current_rep_id()` — returns rep id for auth.uid()

## Triggers
- `trg_update_quotation_sqm` — auto-updates quotations.sqm_quoted from quotation_items
- `trg_sync_project_sqm` — auto-updates projects.quoted_sqm and won_sqm from quotations
- `trg_project_history` — logs stage/sqm/loss_reason changes to project_history
- `trg_activity_code` — sets code, month, submission_status (weekend+holiday+absence aware)
- `trg_customer_code`, `trg_project_code`, `trg_quotation_code`, `trg_contact_code` — auto-codes
- `trg_normalize_customer` — normalizes Arabic company names
- `trg_notify_pending_rep` — notifies managers on new pending rep
- `trg_notify_company_assignment` — notifies rep on company assignment
- `trg_notify_duplicate` — notifies managers on new duplicate flag

## Views
- `pipeline_summary` — project count + SQM by stage
- `stale_projects` — projects with no stage update in 14+ days
- `rep_monthly_sqm` — SQM aggregated per rep per month vs target

## Dropdown Canonical Values
| Field | Values |
|---|---|
| Company Type | Factory, Advertising, Real Estate, Owner, Consultant, Contractor, Station Management, Workshop, Other |
| Region | Central, West, East, North, South, Foreign |
| Source | Field Visit, Direct Contact, Referral, Exhibition, Marketing, Other |
| Interaction | Visit, Call, WhatsApp, Email, Meeting, Site Visit |
| Project Stage | New Lead, Catalog Sent, Quotation Sent, Under Review, Won, In Production, Delivered, Lost |
| Loss Reason | Price, Competitor, Timeline, No Budget, Specification Mismatch, No Response, Other |
| Quotation Status | pending, submitted, won, lost, expired, cancelled |
| Product Class | Class A, Class B, Class A2G2, Class A2G1 |
| FR Rating | A2, B1, Normal |
| Supplier Code | N, K, D, C, G, G1, Y |
| Thickness | 4, 5, 6 (mm) |
| Services | Cutting, Grooving, Bending, CNC |

---

# File Structure (Complete + Current)
facet-crm/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                          — role-based redirect
│   ├── globals.css
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── pending/page.tsx
│   ├── api/auth/
│   │   ├── callback/route.ts
│   │   └── register/route.ts            — creates auth user + rep row
│   ├── dashboard/
│   │   ├── layout.tsx                   — manager/coordinator/super_admin only
│   │   ├── page.tsx                     — KPI dashboard
│   │   ├── team/page.tsx                — approve, roles, targets, holidays, absences
│   │   ├── performance/page.tsx         — rep KPI overview + drill-down
│   │   ├── followups/page.tsx           — overdue project dates by rep
│   │   ├── import/page.tsx              — bulk CSV company import
│   │   ├── companies/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── projects/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx            — project detail + history timeline
│   │   ├── activities/page.tsx          — full log, project link column
│   │   ├── quotations/page.tsx          — multi-product form, items, services
│   │   ├── duplicates/page.tsx
│   │   └── notifications/page.tsx
│   └── rep/
│       ├── layout.tsx
│       ├── page.tsx                     — daily report, enforced dropdown
│       ├── companies/
│       │   ├── page.tsx
│       │   └── [id]/page.tsx
│       ├── projects/page.tsx            — history modal, loss reason
│       ├── quotations/page.tsx          — expandable items detail
│       ├── stats/page.tsx
│       └── history/page.tsx
├── components/
│   └── Sidebar.tsx                      — 5 roles, notification bell
├── lib/supabase/
│   ├── client.ts
│   ├── server.ts
│   └── admin.ts
├── middleware.ts
├── schema.sql                           — see note below
└── package.json

---

# RLS Policy Summary (Production)

All tables have RLS enabled. Key pattern:
- `manager` and `super_admin` have identical full access via ALL policies
- `sales_coordinator` has full access to quotations, read on companies/projects
- `rep`/`marketing` access own data only via junction tables
- All INSERT operations for reps go through SECURITY DEFINER RPC functions

Critical: `current_user_role()` returns null when called from SQL Editor (no auth session). This is expected. Policies work correctly in the browser session.

---

# Known Issues / Tech Debt

1. `schema.sql` in repo is partially outdated — production DB via Supabase SQL Editor is source of truth
2. `projects.company_name` text column is a legacy cache — eventually derive via join
3. `activities.rep_name` text column is a legacy cache — eventually always join reps table
4. `projects.assigned_rep_id` is a legacy cache alongside `project_reps` junction — kept intentionally
5. No formal migration files — all schema changes done ad-hoc in SQL Editor
6. No staging environment — all deploys go directly to production
7. No error tracking (Sentry not installed)
8. Quotations: one quotation cannot produce multiple invoices (no invoice table yet)
9. `projects.next_follow_up` column still exists in DB but is unused — UI uses `project_date`

---

# Completed Features

## Auth & Navigation
- Login, register (self-service + manager-created), pending approval flow
- Role-based routing: rep→/rep, manager/coordinator/super_admin→/dashboard
- Middleware with cookie passthrough (redirect loop fixed)
- 5-role sidebar with notification bell + unread count + realtime

## Manager Dashboard (/dashboard)
- 8 KPI cards: SQM, pipeline, won, invoiced, projects, stale, submitted
- Daily report status per rep (on time/late/missing/excused)
- SQM progress bars per rep vs target
- Pipeline SQM by stage
- Stale projects list
- Interaction breakdown chart
- Branch filter
- Weekend/holiday/absence-aware excused status
- Missing submission notifications (check_missing_submissions RPC)

## Companies
- Manager: list/filter/add/delete/detail
- Rep: own list (via company_reps), register new (via RPC)
- Detail: edit, contacts tab, projects tab, rep assignment
- Source + source_detail two-level dropdown
- Bulk CSV import (/dashboard/import)

## Contacts
- Multiple per company, primary flag
- Arabic name support (full_name_ar)
- Rep can add contacts to own companies

## Projects
- Atomic creation via create_project_with_rep RPC
- Stage inline update with loss reason modal (required on Lost)
- project_date field (replaces next_follow_up)
- History timeline (project_history table)
- quoted_sqm and won_sqm auto-updated from quotations via trigger
- Follow-ups due page (/dashboard/followups)

## Activities (Daily Report)
- Enforced company selection from dropdown (no free text)
- Arabic fuzzy search for company names
- Contact dropdown (loads on company select, auto-fills phone)
- Project dropdown (loads on company select, active only)
- Submission status: weekend/holiday/absence aware
- Manager view: project link column, rep filter by UUID

## Quotations
- Coordinator creates multi-product quotations with items + services
- quotation_items: Class, FR Rating, supplier, color, width×length×sheets → auto SQM
- quotation_services: Cutting/Grooving/Bending/CNC
- ERP reference ID field
- Cancellation requires reason
- sqm_quoted auto-updated from items via trigger
- Rep read-only view with expandable item detail
- Status update inline (invoiced/delivered SQM)

## Team Management
- Approve/set role/target/status per rep
- Company holidays (team-wide excused days)
- Rep absences (individual excused periods)
- Create user modal (manager creates accounts directly)

## Performance Page (/dashboard/performance)
- Overview table: all reps side by side
- Drill-down per rep: SQM, compliance, quotations, interactions, projects, top companies
- Month selector

## Analytics
- Duplicates: server-side pg_trgm scan, side-by-side classify
- Rep stats page: activities, SQM, quotations, breakdowns
- Rep history: monthly archive grouped by date

## Notifications
- In-app, realtime badge, auto-triggers for pending/assignment/duplicate/missing

---

# TypeScript Patterns

## Supabase Nested Select Fix
Supabase returns joined tables as arrays. TypeScript expects objects.
```ts
// In type definition:
type Project = { companies: any; project_reps: { role: string; reps: any }[] };
// In setState:
setProjects((data ?? []) as unknown as Project[]);
// In JSX:
const name = Array.isArray(item.companies)
  ? item.companies[0]?.company_name
  : item.companies?.company_name;
```

## Ambiguous FK Join (Critical)
When a table has multiple FK columns pointing to the same table (e.g. quotations has rep_id, coordinator_id, assigned_to_id all pointing to reps), PostgREST throws a silent error on `.select("reps(name)")`.
Fix: remove the join, look up from already-loaded reps array client-side:
```ts
const repName = allReps.find(r => r.id === q.rep_id || r.id === q.assigned_to_id)?.name || "—";
```

## Promise.resolve() Wrapper for Supabase Queries in Arrays
```ts
loaders.push(
  Promise.resolve(
    supabase.from("projects").select("...").eq("customer_id", c.id)
  ).then(({ data }) => { ... })
);
```

---

# Instructions for Future AI

1. **Quotations are coordinator-only.** Reps see read-only expandable view.
2. **Four active roles + super_admin.** super_admin = manager access, cannot be changed via UI.
3. **All rep INSERT operations use SECURITY DEFINER RPCs.** Never two separate inserts.
4. **Activity SQM ≠ Invoiced SQM.** Different metrics, never conflate.
5. **Junction tables only.** No `shared_with` text columns anywhere.
6. **Friday + Saturday = weekend.** All compliance logic must respect this.
7. **schema.sql is not source of truth.** Production DB may differ.
8. **Do not suggest external libraries** without checking package.json first.
9. **Complete file replacements** over partial diffs — user edits in GitHub web UI.
10. **Test checklists** after every deployment.
11. **Ambiguous FK joins crash silently** — never join `reps(name)` when multiple FK columns point to reps.
12. **`current_user_role()` returns null in SQL Editor** — this is expected, not a bug.

---

# Infrastructure
GitHub:    github.com/technopanel-systems/facet-crm (main branch, direct commits)
Vercel:    auto-deploy on push to main
Supabase:  https://qndpfbmniqxkegzmzcmh.supabase.co (Bahrain, me-south-1)
Live URL:  crm.technopanel.com.sa
DNS:       Cloudflare CNAME → cname.vercel-dns.com (grey cloud)

# Next Recommended Steps
1. Set up Sentry error tracking (free tier)
2. Create a staging Supabase project + Vercel branch
3. Build invoice table for multi-invoice per quotation
4. n8n automation: daily report reminder notifications
5. Mobile-first redesign for rep pages
6. Arabic UI / RTL toggle
7. Drop legacy `projects.next_follow_up` column (unused)
8. Drop legacy `projects.company_name` and `activities.rep_name` text caches
