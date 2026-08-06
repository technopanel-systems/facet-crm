# 01. Current Limitations — FACET CRM

These are confirmed gaps in the current system. Each limitation has a workaround or accepted trade-off.

---

## Commercial / Financial Limitations

### L-001: One Invoice Per Quotation
**Limitation:** `quotations.sqm_invoiced` is a single field. If materials are delivered in multiple shipments with separate ERP invoices, only the last entry survives — previous data is overwritten.  
**Workaround:** Coordinator enters the cumulative invoiced SQM each time.  
**Fix:** Build an `invoices` table (see Future Features).

### L-002: No SQM Split Enforcement for Shared Projects
**Limitation:** When two reps work the same project, there is no mechanism to attribute specific SQM percentages to each rep automatically.  
**Workaround:** Coordinator creates separate quotation records per rep or uses notes to track attribution.  
**Fix:** Add `sqm_split_pct` to quotation level with explicit rep-1 and rep-2 attribution.

### L-003: Activity SQM ≠ Invoiced SQM (No Reconciliation)
**Limitation:** The system tracks two separate SQM figures (rep-reported activity SQM and coordinator-entered invoiced SQM) with no reconciliation mechanism between them.  
**Workaround:** Manager uses invoiced SQM for KPI measurement and treats activity SQM as a leading indicator only.  
**Fix:** Future dashboard enhancement separating the two metrics explicitly.

---

## User Interface Limitations

### L-004: No Arabic UI / RTL Layout
**Limitation:** The UI is English-only and left-to-right. Field reps who are more comfortable in Arabic cannot use an Arabic interface.  
**Workaround:** All UI labels remain in English.  
**Fix:** Implement language switcher + RTL CSS. `reps.language_pref` column already exists for this purpose.

### L-005: Not Mobile-Optimized
**Limitation:** The UI is designed for desktop. Field reps using phones find the interface cramped. The sidebar takes significant space on mobile.  
**Workaround:** Reps use desktop or landscape tablet orientation.  
**Fix:** Mobile-first redesign of `/rep/*` pages. Sidebar should collapse to bottom nav on mobile.

### L-006: No Pagination on Large Lists
**Limitation:** Companies, projects, and activities pages load all records (up to 500 for activities). As data grows, page load time increases.  
**Workaround:** Filters reduce the result set.  
**Fix:** Implement cursor-based pagination in Supabase queries.

---

## Operational Limitations

### L-007: No Staging Environment
**Limitation:** All changes deploy directly to production. Schema changes and code changes cannot be tested safely before going live.  
**Workaround:** Test carefully in SQL Editor before running. Preview Vercel deployments for code-only changes.  
**Fix:** Create staging Supabase project + Vercel preview branch.

### L-008: No Error Monitoring
**Limitation:** JavaScript errors and silent Supabase query failures are invisible to the team until a user reports a problem.  
**Workaround:** Users report bugs verbally or via WhatsApp.  
**Fix:** Install Sentry.

### L-009: No Automated Notifications (n8n)
**Limitation:** Missing submission notifications only fire when the manager dashboard is loaded. If the manager doesn't open the dashboard, reps don't receive reminders.  
**Workaround:** Manager opens dashboard daily.  
**Fix:** Set up n8n scheduled job to call `check_missing_submissions()` via Supabase REST API at 9 AM daily.

### L-010: No WhatsApp Integration
**Limitation:** All notifications are in-app only. WhatsApp is the primary business communication channel but is not connected.  
**Workaround:** Manager manually follows up via WhatsApp.  
**Fix:** n8n + WhatsApp Business API integration (planned future phase).

---

## Data Quality Limitations

### L-011: Company Names Not Deduplicated Automatically
**Limitation:** Duplicate detection is manual. Reps can register companies that already exist under slightly different names. Duplicates accumulate until a manager runs the scan.  
**Workaround:** Manager runs "Scan for Duplicates" periodically.  
**Fix:** Run `detect_duplicate_companies()` automatically on every new company INSERT (add to trigger). Alert immediately.

### L-012: No Company Transfer Between Reps
**Limitation:** There is no UI for transferring a company's primary rep assignment from one rep to another in bulk. It must be done one company at a time via the company detail page.  
**Workaround:** Manager uses company detail page per company.  
**Fix:** Build a bulk transfer UI in the Team Management page.

### L-013: No Audit Log for Non-Project Entities
**Limitation:** `project_history` tracks project stage changes. There is no equivalent audit log for companies, quotations, contacts, or rep reassignments.  
**Workaround:** None — historical changes are untracked.  
**Fix:** Add audit tables or use a generic audit trigger pattern.
