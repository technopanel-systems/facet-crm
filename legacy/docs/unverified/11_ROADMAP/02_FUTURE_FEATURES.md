# 02. Future Features — FACET CRM

Items are ordered by implementation priority within each phase.

---

## Immediate (Next 1–4 Weeks)

### F-001: Anon Key Rotation
Rotate the Supabase anon key that was exposed in AI session documents. Update Vercel env vars. No code changes required.

### F-002: Sentry Error Monitoring
Install Sentry free tier. Catches silent JavaScript errors, failed Supabase queries, and server-side crashes.
```bash
npx @sentry/wizard@latest -i nextjs
```

### F-003: Staging Environment
Create a second Supabase project. Create a Vercel `staging` branch that uses staging credentials. Test all future changes here before merging to main.

### F-004: n8n Daily Report Reminders
Set up n8n (self-hosted or cloud) with a scheduled job that calls `check_missing_submissions()` via Supabase REST API at 9 AM Riyadh time daily. Eliminates dependency on manager opening the dashboard.

---

## Short Term (1–3 Months)

### F-005: Invoice Table
Replace `quotations.sqm_invoiced` single field with a proper `invoices` table:
```sql
invoices (
  id uuid PK,
  quotation_id uuid → quotations(id) CASCADE,
  erp_invoice_id text,
  invoice_date date,
  sqm_invoiced numeric,
  rep_id uuid → reps(id),
  assigned_to_id uuid → reps(id),
  coordinator_id uuid → reps(id),
  notes text,
  created_at timestamptz
)
```
This allows multiple invoices per quotation and full invoice history.

### F-006: Constants and Types Files
Create `lib/constants.ts` (all dropdown arrays) and `lib/types.ts` (all shared TypeScript types). Eliminate copy-paste across files.

### F-007: Supabase Generated Types
Run `supabase gen types typescript` to generate accurate TypeScript types from the live schema. Eliminate all `as unknown as Type[]` casts.

### F-008: Local Development Environment
Document and set up local Node.js development workflow. Create `.env.local` template. Enable `npm run dev` usage before pushing.

### F-009: WhatsApp Notification via n8n
Extend n8n workflow to send WhatsApp Business API messages for:
- Missing daily report reminder (to rep)
- Weekly performance summary (to manager)
- New project follow-up due (to rep)

### F-010: Bulk Rep Transfer
Add UI to transfer all companies from one rep to another in bulk. Useful when a rep leaves or territories change.

---

## Medium Term (3–6 Months)

### F-011: Arabic UI / RTL Toggle
Implement language switcher using `reps.language_pref` column. Add RTL CSS support. Translate all UI labels to Arabic. Arabic text already exists in data fields (contacts, companies).

### F-012: Mobile-First Rep Pages
Redesign all `/rep/*` pages for mobile-first usage. Replace table layouts with card stacks. Collapse sidebar to bottom navigation. Optimize touch targets.

### F-013: SQM Split Attribution
Add rep-to-rep SQM split field to invoice/quotation level. Allow coordinator to specify 60/40, 50/50, 100/0 splits. Reflect in per-rep KPI calculations.

### F-014: Duplicate Prevention on Company Insert
Instead of (or in addition to) manual scan, automatically check for similar company names when a rep tries to register a new company. Show a warning modal: "Similar company already exists — are you sure this is a different company?"

### F-015: Pagination for Large Lists
Add cursor-based pagination to companies, projects, and activities lists. Prevents page load degradation as data grows.

### F-016: Company Audit Log
Add audit trail for company changes (similar to project_history). Track: name changes, rep reassignments, status changes.

---

## Long Term (6–12 Months)

### F-017: Pipeline Forecasting
Add probability weights per stage (e.g., New Lead = 10%, Under Review = 60%, Won = 100%). Calculate weighted pipeline forecast. Show expected SQM for the month based on open pipeline.

### F-018: AI Lead Scoring
Score companies based on: interaction frequency, company type, historical SQM, days since last contact, project stage history. Surface "hot leads" that need attention.

### F-019: Node Graph Visualization
Visual diagram showing relationships between projects, companies, and reps. Particularly useful for complex projects where one building has multiple contractors and consultants.

### F-020: ERP Sync (Automated)
Instead of manual coordinator entry, automatically sync quotations and invoices from the ERP via API or scheduled export/import. Reduces coordinator workload and eliminates entry delays.

### F-021: Multi-Branch Regional Manager Role
Add a `regional_manager` role with visibility limited to their assigned branch. Currently manager sees everything. This enables branch-level accountability without giving full system access.

### F-022: Quotation PDF Generation
Generate a formatted PDF from the quotation_items data. Send directly to client or save to Supabase Storage. Eliminates the need to go to ERP just for a quick quotation preview.

---

## Completed Features (Reference)

These were planned and are now built:
- ✅ Auth system (login, register, pending, role guards)
- ✅ Companies + Contacts module
- ✅ Projects module (atomic creation via RPC)
- ✅ Daily report (enforced dropdown, Arabic search)
- ✅ Activities log with CSV export
- ✅ Quotations (multi-product items + services)
- ✅ Rep History page
- ✅ Rep Stats page
- ✅ Manager Dashboard (8 KPIs, pipeline, stale, branch filter)
- ✅ Team management (holidays, absences, create user)
- ✅ Rep Performance page (overview + drill-down)
- ✅ Follow-ups due page
- ✅ Bulk CSV company import
- ✅ Duplicates detection and classification
- ✅ In-app notifications with realtime badge
- ✅ Project history timeline
- ✅ Loss reason enforcement (modal)
- ✅ Project detail page
