# 02. Dashboards — FACET CRM

## Manager Dashboard (`/dashboard`)

**File:** `app/dashboard/page.tsx` (server component)  
**Access:** manager, sales_coordinator, super_admin

The main dashboard is a server component that fetches all data in a single parallel Promise.all call on every page load. It also calls `check_missing_submissions()` RPC on load.

### KPI Cards (Row 1 — SQM)
| Card | Source | Calculation |
|---|---|---|
| SQM This Month | `activities.sqm_done` | Sum for all reps, current month |
| Pipeline SQM | `activities.sqm_expected` | Sum for all reps, current month |
| SQM Won (Quoted) | `quotations` where status='won' | Sum of sqm_quoted |
| SQM Invoiced | `quotations.sqm_invoiced` | Sum across all quotations |

### KPI Cards (Row 2 — Operations)
| Card | Source | Calculation |
|---|---|---|
| Active Projects | `projects` | Count where stage NOT IN (Won, Delivered, Lost) |
| Won Projects | `projects` | Count where stage = Won |
| Stale Projects | `stale_projects` view | Count returned |
| Submitted Today | Derived from rep status | Count on_time + late ÷ (total reps - excused) |

### Daily Report Status Card
Shows each rep's status for yesterday: on_time / late / missing / excused.

Logic respects:
- Weekend detection (DOW 5, 6)
- Company holidays (fetched for yesterday)
- Individual absences (fetched for yesterday)

### SQM Progress Card
Progress bar per rep: `sqm_done (month) ÷ monthly_target_sqm`. Color-coded:
- Green: ≥ 100%
- Blue: ≥ 60%
- Amber: ≥ 30%
- Red: < 30%

### Pipeline by Stage Card
Uses `pipeline_summary` view. Shows count and total SQM for each of 8 stages. SQM displayed in thousands (e.g., 12.5k m²).

### Stale Projects Card
Uses `stale_projects` view. Shows top 8. Columns: project name, company, assigned rep, stage.

### Activity Breakdown Card
Aggregates `interaction_type` from this month's activities. Shows percentage bars per type (Visit, Call, etc.).

### Branch Filter
Links at top of dashboard filter all data to reps assigned to a specific branch. Implemented as query param: `/dashboard?branch={branch_id}`. When active, `reps` query adds `.eq('branch_id', branchId)`.

---

## Rep Stats Dashboard (`/rep/stats`)

**File:** `app/rep/stats/page.tsx` (client component)  
**Access:** rep, marketing

Personal performance view. Month selector (last 6 months).

### Sections
1. **SQM Progress Bar** — sqm_done vs monthly_target_sqm for selected month
2. **Activity KPI Cards** — total activities, on-time, late, compliance %
3. **Quotation KPI Cards** — total quotes, won, win rate, SQM invoiced (all time)
4. **Interaction Types** — breakdown bars by Visit/Call/etc.
5. **Projects by Stage** — count per stage badge
6. **Quotation Status** — count per status badge
7. **Top 5 Companies** — most activities this month

---

## Rep Performance Dashboard (`/dashboard/performance`)

**File:** `app/dashboard/performance/page.tsx` (client component)  
**Access:** manager, super_admin

Two views in one page:

### Overview Table
All active reps (role: rep or marketing) shown side-by-side with:
- SQM progress bar + percentage vs target
- Activity count, on-time, late counts
- Compliance % (color-coded: green ≥80%, amber ≥50%, red <50%)
- Quotation count + won count
- Win rate %
- SQM invoiced (all time, all quotations for rep)
- "View →" link to drill-down

### Rep Drill-Down
Clicking "View →" shows same KPI cards as rep/stats but managed by the manager. Includes:
- SQM progress bar
- 4 activity KPI cards
- 4 quotation KPI cards
- Interaction type breakdown
- Projects by stage
- Quotation status breakdown
- Top 5 most-visited companies

Month selector works independently in both overview and drill-down.

---

## Follow-ups Dashboard (`/dashboard/followups`)

**File:** `app/dashboard/followups/page.tsx` (client component)  
**Access:** manager, super_admin

Shows all active projects where `project_date <= today`, grouped by assigned rep.

Summary cards: Due Today count, Overdue count, Total count.

Filters: by rep, by urgency (all / today only / overdue only).

Each project shows: name, company, stage badge, urgency badge ("Due today" / "Xd overdue"), project date, quoted SQM. Links to `/dashboard/projects/[id]`.

---

## Data Freshness

The manager dashboard (`/dashboard/page.tsx`) is a **server component** — data is fetched on every page load. There is no client-side caching or stale-while-revalidate.

All other dashboards are **client components** — data is fetched on `useEffect` mount. There is no automatic refresh. Users must navigate away and back (or reload) to see new data.

Real-time updates only apply to the notification badge count.
