# 01. Reports — FACET CRM

## Activity Compliance Report

**Where:** Manager Dashboard → Daily Report Status card  
**Data Source:** `activities` table + `reps` table + `company_holidays` + `rep_absences`

Shows each active rep's submission status for the previous working day.

**Status values per rep:**
- `on_time` — Submitted at least one activity for yesterday, with on_time status
- `late` — Submitted, but after grace period
- `missing` — No activity found for yesterday (and not excused)
- `excused` — Yesterday was a weekend, company holiday, or rep had approved absence

**Logic (manager dashboard):**
```typescript
const yesterdayIsWeekend = yesterdayDow === 5 || yesterdayDow === 6;
const yesterdayIsHoliday = holidays.length > 0; // company_holidays for yesterday
const isAbsent = absences.some(a => a.rep_id === rep.id); // rep_absences for yesterday

// Determines status per rep
```

---

## Monthly SQM Progress Report

**Where:** Manager Dashboard → SQM Progress card | Rep Stats page  
**Data Source:** `activities.sqm_done` vs `reps.monthly_target_sqm`

Aggregates `sqm_done` per rep for the current calendar month. Compares against their `monthly_target_sqm`. Displayed as a progress bar with percentage.

**Calculation:**
```typescript
const totalSqm = activities
  .filter(a => a.rep_id === rep.id)
  .reduce((sum, a) => sum + (a.sqm_done ?? 0), 0);
const pct = target > 0 ? Math.min(100, Math.round((totalSqm / target) * 100)) : 0;
```

**Important:** This report uses `activities.sqm_done` (rep-reported field estimate), NOT `quotations.sqm_invoiced` (coordinator-confirmed invoiced amount). These are different metrics. See the KPI distinction in the glossary.

---

## Pipeline Report (by Stage)

**Where:** Manager Dashboard → Pipeline SQM by Stage  
**Data Source:** `pipeline_summary` database view

```sql
CREATE VIEW pipeline_summary AS
SELECT stage, COUNT(*) AS project_count, COALESCE(SUM(quoted_sqm), 0) AS total_sqm
FROM projects GROUP BY stage
ORDER BY CASE stage WHEN 'New Lead' THEN 1 ... END;
```

Displays count of projects and total quoted SQM for each stage. Includes Won, Delivered, Lost.

---

## Rep Performance Report

**Where:** `/dashboard/performance`  
**Data Source:** `activities`, `quotations`, `projects` — all filtered by month

Two views:

**Overview table:** All active reps side by side showing:
- SQM progress bar vs target
- Activity count (on-time, late)
- Compliance % (on-time ÷ total activities)
- Quotation count and win rate
- SQM invoiced (all time)

**Drill-down:** Click one rep to see full breakdown:
- Interaction type distribution
- Project stage distribution
- Quotation status distribution
- Top 5 most-visited companies

---

## Follow-ups Due Report

**Where:** `/dashboard/followups`  
**Data Source:** `projects` where `project_date <= today` and stage is active

Groups overdue projects by assigned rep. Color-coded urgency:
- Amber: due today
- Red: overdue 1–7 days
- Dark red: overdue 8+ days

---

## Activity Log (Manager)

**Where:** `/dashboard/activities`  
**Data Source:** `activities` table, last 500 records

Full filterable log with:
- Multi-filter: rep (by UUID), interaction type, submission status, date range, search
- CSV export of filtered results
- Expandable rows showing notes and contact details
- Project link column (if activity linked to a project)

---

## Rep History

**Where:** `/rep/history`  
**Data Source:** `activities` table filtered by rep + selected month

Monthly archive of the rep's own submitted activities. Grouped by date. Shows summary KPIs: total activities, SQM done, SQM expected, on-time count.

---

## Rep Stats

**Where:** `/rep/stats`  
**Data Source:** `activities`, `projects`, `quotations` — all filtered for current rep

Personal KPI dashboard showing:
- SQM progress bar vs target (monthly)
- Activity compliance breakdown
- Quotation KPIs (all time)
- Interaction type breakdown
- Projects by stage
- Top 5 companies by activity count

---

## CSV Export

**Where:** Manager Activities page  
**Format:** Comma-separated values, UTF-8

Columns: Date, Rep, Company, Project, Type, Region, SQM Done, SQM Expected, Status

Generated client-side using Blob + URL.createObjectURL. No server involvement.

---

## Database Views Used for Reporting

| View | Used By |
|---|---|
| `pipeline_summary` | Manager dashboard pipeline chart |
| `stale_projects` | Manager dashboard stale projects card |
| `rep_monthly_sqm` | Available but not directly used by current pages (pages run direct queries instead) |
