# FACET CRM — Corrected Audit
> Correction pass applied over prior audit | May 2026
> Business logic source: corrected workflow specification provided by founder

---

## 1. Audit Corrections Summary

The following items in the previous audit were wrong or overstated because the auditor assumed a generic CRM workflow instead of this system's actual operating model.

**Correction 1: Quotation creation being a rep function was never implied — it was correctly built.**
The previous audit suggested that "reps creating quotations" was a future risk. The system already correctly restricts this: the quotation form is only accessible under `/dashboard/quotations`, which is the coordinator's route. Reps see a read-only view at `/rep/quotations`. This is correct by design.

**Correction 2: The coordinator role is not broken — it is actively used.**
The previous audit raised the `sales_coordinator` role as potentially broken due to RLS gaps. The role IS real and the routing logic correctly sends coordinators to `/dashboard`. The problem is narrower: the `reps.role` CHECK constraint in `schema.sql` only allows `'rep'` and `'manager'`, but four roles are in use. This is a real schema bug, but the conclusion that the role is "broken" was overstated — if the DB constraint was already updated in production, coordinators work. The uncertainty is the gap between `schema.sql` and production reality.

**Correction 3: The daily report SQM fields are intentional.**
The previous audit implied that reps manually entering `sqm_done` and `sqm_expected` in daily reports was a design flaw. Per the corrected business rules, reps DO manually enter these values for their in-person activities. The event-driven automation is a future improvement, not a current bug.

**Correction 4: The company registration approval flow for marketing is not a code bug — it is a missing feature.**
The prior audit grouped marketing registration with general registration. They are different: rep registration is self-service through `/register`; marketing company registration potentially needs a separate approval path. The current code does not support this distinction. This is a missing feature, not a broken one.

**Correction 5: `sqm_invoiced` on quotations is the intended mechanism for KPI source of truth, not an ad-hoc field.**
The previous audit did not flag that there is no dedicated invoice table. Per the corrected business logic, coordinators register invoice/dispatch confirmation records, and one quotation can produce multiple invoices. The current `sqm_invoiced` field on quotations is a single summary number, not a true invoice record table. This is a structural gap, not something the previous audit identified.

**Correction 6: The duplicate detection governance model is correct by design.**
The previous audit noted that the manager manually decides on duplicates. This is intentional — the system flags, the human decides. "Shared" and "Conflict" classifications are correct business concepts, not workarounds.

**Correction 7: Branches are for visibility and reporting, not hard operational restriction.**
The previous audit had no meaningful critique here, but it is worth stating: the branch filter on the manager dashboard is correct. Branches should not block rep operations across regions. The current implementation matches this.

**Correction 8: Rep editing their own company name is intentional.**
Reps can edit company names in their view. The business rule says small naming corrections should not require manager approval. The current edit form accessible to reps is correct behavior.

---

## 2. Re-scored Executive Summary

| Dimension | Previous Score | Corrected Score | Reason for Change |
|---|---|---|---|
| Business process maturity | 5/10 | 6/10 | The coordinator/quotation/invoice model is correctly architected in intent even if partially incomplete in code |
| Technical debt | High | High | Unchanged — AI-generated code quality issues remain |
| Scalability readiness | 2/10 | 2/10 | Unchanged |
| Security posture | 4/10 | 4/10 | Unchanged — credentials still exposed |
| Operational readiness | 2/10 | 2/10 | Unchanged — no monitoring, no staging |
| **Overall score** | 3.5/10 | **4.5/10** | The business model is more coherent than the previous audit credited. The critical code bugs remain. |

The system is better designed than the first audit implied. The role structure, the coordinator-led quotation flow, the junction tables for sharing, the Arabic normalization — these are thoughtful decisions. The problems are in specific code bugs and operational infrastructure, not in the fundamental architecture.

---

## 3. Updated Business Logic Model

### Roles and What They Can Do

**Manager:** Full visibility and control over everything. Approves pending reps, sets targets, assigns reps to companies, resolves duplicates, sees all activities, manages all data. Is the final decision-maker on structural changes (deletions, sharing, conflict resolution).

**Sales Rep:** Owns their own companies, contacts, and projects. Submits daily activity reports. Updates project stages and follow-up dates. Can register new companies (auto-assigned to themselves). Can add contacts to their companies. Views quotations that coordinators have linked to them. Cannot see other reps' activities, notes, or contacts unless explicitly shared.

**Sales Coordinator (2 people, Riyadh-based):** Operates in the `/dashboard` space alongside the manager. Creates and manages quotation records mirroring the ERP. Registers invoice/dispatch confirmation data (currently partially via `sqm_invoiced` on quotations). Can see all companies and projects by name and context — but NOT rep private activities or notes. Links quotations to projects and to reps. Handles SQM split attribution when two reps are on one project. Does NOT assign or re-assign company ownership unless operating in their own internal sales workflow.

**Marketing:** Behaves like a rep in most ways. Has an additional company registration path that may require manager approval or assignment before the company is fully active in the sales workflow. Can access quotation views.

### Quotation and Invoice Flow

1. A rep works a company → creates a project → negotiates → requests a quotation from the coordinator verbally or via ERP.
2. Coordinator receives the ERP quotation → registers it in the CRM quotation module, linking it to the project and the rep.
3. If multiple reps are involved, coordinator attributes the relevant rep(s) at quotation or invoice registration time.
4. A quotation can be revised. Revision number tracks edits. Edit date should be recorded (currently missing).
5. When a deal is won and an invoice is issued in ERP, the coordinator updates the CRM: marks the quotation as "won" and enters `sqm_invoiced`. This converts pipeline SQM into actual sold SQM for KPI purposes.
6. One quotation may eventually need to produce multiple invoice records (currently unsupported — there is no invoice table).
7. Reps see their own quotations in read-only mode. They see SQM invoiced but no coordinator notes.

### Company and Project Ownership

- A company is assigned to one rep (primary). Rare cases allow a second rep (shared).
- A rep registering a company in their workflow → auto-assigned to them. No manager approval needed.
- A marketing user registering a company → may need manager assignment/approval before active use.
- A project belongs primarily to one rep. Rarely two. The coordinator handles SQM split when creating the quotation/invoice.
- If two reps work the same project: each rep sees only their own activity entries on it. The manager sees all. The coordinator attributes SQM appropriately.

### Daily Report Logic

Reps submit one report per working day (Friday and Saturday excluded). Each row is one interaction: a company visit, a call, a WhatsApp exchange, etc. The rep selects the company from their registered companies (autocomplete), selects the interaction type, and adds outcome notes, SQM confirmed, and SQM expected. SQM confirmed in the daily report is a rep-level field for their daily tracking. Actual sold SQM comes from coordinator-registered invoice data — these are two different numbers that should eventually be reconciled on the dashboard.

If a rep visits a company not yet in the system, they type the name (no autocomplete match), and it is recorded as free text on the activity. They should then register the company separately so future reports can link to the structured entity.

### Duplicate Governance

The system scans for similar company names using Arabic normalization. Duplicate flags are created and assigned to the manager. The manager classifies: Shared (two reps legitimately working the same real-world company), Conflict (ownership dispute to resolve), or Not a Duplicate (different companies with similar names). This is the correct model.

---

## 4. Revised Technical Audit

### Critical Code Bugs (Confirmed Still Valid)

**Bug 1: `app/rep/page.tsx` queries `from("customers")` — table does not exist by this name.**
```ts
const { data: custData } = await supabase.from("customers").select(...)
```
The table was renamed to `companies`. This query returns nothing. Every rep's daily report autocomplete is broken. This is the most operationally damaging bug in the system. Fix immediately:
```ts
const { data: custData } = await supabase.from("companies")
  .select("company_name, company_type, region")
  // Also need to filter by rep assignment via company_reps
```

**Bug 2: `duplicate_flags` column names mismatch between schema.sql and application code.**
`schema.sql` creates columns `customer_id_1` and `customer_id_2`. The duplicates page (`app/dashboard/duplicates/page.tsx`) queries `company_id_1` and `company_id_2`. One of these is wrong. Determine which column names exist in production and align the code to match. The application uses `company_id_1`/`company_id_2` — if production was migrated to match the context document, then `schema.sql` is wrong and needs updating.

**Bug 3: `reps.role` CHECK constraint blocks valid roles.**
`schema.sql` has:
```sql
role text not null default 'rep' check (role in ('rep','manager'))
```
But the application uses `sales_coordinator` and `marketing`. If this constraint was not updated in production, coordinator and marketing users cannot be assigned their roles via the Team page. Verify and update:
```sql
ALTER TABLE reps DROP CONSTRAINT reps_role_check;
ALTER TABLE reps ADD CONSTRAINT reps_role_check 
  CHECK (role in ('rep','manager','sales_coordinator','marketing'));
```

**Bug 4: Team page role dropdown only shows `rep` and `manager`.**
In `app/dashboard/team/page.tsx`:
```tsx
<option value="rep">Sales Rep</option>
<option value="manager">Manager</option>
```
`sales_coordinator` and `marketing` are missing. The manager cannot assign these roles from the UI. Add them.

**Bug 5: Notifications pages query all notifications without recipient filter.**
Both `app/dashboard/notifications/page.tsx` and `app/rep/notifications/page.tsx` query:
```ts
supabase.from("notifications").select("*")
```
If RLS on the notifications table correctly filters by `recipient_id = current_rep_id()`, this works. If RLS was not set up on notifications (not in schema.sql), every user sees every user's notifications. Verify that a RLS policy exists for notifications. If not, add it. Also, the Sidebar realtime subscription should be filtered:
```ts
.filter('recipient_id', 'eq', currentRepId)
```

**Bug 6: `app/rep/companies/page.tsx` loads all companies without a rep filter.**
```ts
const { data: compData } = await supabase
  .from('companies')
  .select('id, customer_code, company_name, company_type, region, status')
  .order('company_name');
```
No WHERE clause. This page relies entirely on RLS to filter. If the RLS policy for rep company access uses `shared_with ilike '%name%'` (the old text-column approach that was supposedly dropped), reps either see no companies or all companies. The query should explicitly filter via the junction table, or at minimum trust that RLS is working via `company_reps`. Until production RLS is verified, this is a data exposure or data visibility risk.

### Credentials (Still Critical)

The Supabase anon key was included in the context document that gets shared with Claude and Gemini every session. Rotate this key. The anon key for this project was published in this audit session and the previous one. Do this before anything else.

### Schema Gaps Identified Under Corrected Business Logic

**Gap 1: No invoice table.**
The business says: one quotation can produce multiple invoices, each with a date, an invoice reference, SQM amounts, and rep attribution. Currently this is a single `sqm_invoiced` numeric field on the `quotations` table. This is the wrong structure for the intended workflow. A future `invoices` table is needed:
```sql
invoices (
  id uuid PK,
  quotation_id uuid → quotations(id),
  invoice_code text,
  invoice_date date,
  sqm_invoiced numeric,
  coordinator_id uuid → reps(id),
  rep_1_id uuid → reps(id),
  rep_2_id uuid → reps(id),
  sqm_split_pct numeric default 100, -- rep_1's share; remainder goes to rep_2
  notes text,
  created_at timestamptz
)
```
This does not need to be built immediately, but the current single-field approach should not accumulate large volumes of data before migration becomes painful.

**Gap 2: No quotation edit date tracking.**
The business says quotations can be revised with the same quotation number. A `revision_number` field exists but there is no `last_revised_at` timestamp. Add it to the quotations table.

**Gap 3: `schema.sql` CHECK constraint on `companies.company_type` does not match the UI dropdown.**
Schema allows: `'Factory','Contractor','Developer','Consultant','Trading','Government','Other'`
UI shows: `'Factory','Advertising','Real Estate','Owner','Consultant','Contractor','Station Management','Workshop','Other'`
These are different lists. Any company type entered via the UI that does not match the DB constraint will fail silently or throw a constraint error. Align the CHECK constraint to the UI canonical list.

**Gap 4: Friday/Saturday not excluded from submission status calculation.**
The activity trigger marks submissions as `on_time` or `late` based on whether the submission date matches the activity date. It does not skip Fridays and Saturdays. A rep who submits on Sunday for work done Thursday will be marked `late` even if Thursday was their last working day before the weekend. The trigger needs a working-day check.

**Gap 5: Loss reason is not enforced at stage change.**
When a project stage changes to `Lost`, the `loss_reason` field remains optional in the UI with no validation. The manager needs this data for pipeline analysis. Add a required `loss_reason` dropdown (with an optional notes text field) that appears when stage = Lost.

### RLS Policy Status (Requires Manual Verification)

The `schema.sql` policies for companies and projects use:
```sql
shared_with ilike '%' || current_rep_name() || '%'
```
But the context document says `shared_with` was dropped and replaced by junction tables (`company_reps`, `project_reps`). If this is true in production, these policies are broken — they reference a column that no longer exists, and either throw an error or return no rows for reps.

The correct rep-access policies should be:
```sql
-- For companies
create policy "companies_rep_read" on companies for select using (
  current_user_role() = 'rep' and exists (
    select 1 from company_reps cr
    where cr.company_id = companies.id
    and cr.rep_id = current_rep_id()
  )
);

-- For projects
create policy "projects_rep_read" on projects for select using (
  current_user_role() = 'rep' and exists (
    select 1 from project_reps pr
    where pr.project_id = projects.id
    and pr.rep_id = current_rep_id()
  )
);

-- Coordinator: read all companies and projects, no rep-private data
create policy "companies_coordinator_read" on companies for select using (
  current_user_role() = 'sales_coordinator'
);
create policy "projects_coordinator_read" on projects for select using (
  current_user_role() = 'sales_coordinator'
);
```

Open Supabase → Authentication → Policies and verify what is actually live before assuming anything.

---

## 5. Revised Business Audit

### Coordinator Workflow — What Works, What Doesn't

**Works:** The quotation form at `/dashboard/quotations` allows a coordinator to create a quotation linked to a company, project, and rep. The inline update row allows updating status, `sqm_invoiced`, and `sqm_delivered`. The rep-filtered read-only view at `/rep/quotations` works as intended.

**Doesn't work yet:**
- No invoice table means a second invoice on the same quotation overwrites the first `sqm_invoiced` value rather than adding to it.
- There is no `last_revised_at` field to record when a quotation was edited.
- The coordinator cannot currently set a per-rep SQM split when two reps are on one project. The quotation just links one rep. The business rule (50/50 unless noted otherwise) has no enforcement mechanism.
- The quotation form only supports one product row per quotation. The business wants multiple product line items. This is a missing feature.

### Rep Workflow — What Is Broken

**Daily report autocomplete is broken.** The `from("customers")` query returns nothing. Reps typing company names get no suggestions. They are submitting free-text company names, which means `company_id` on activity records is null for most or all historical records. This is a data quality crisis that has been silently accumulating.

**Rep companies page shows all companies (or no companies).** Without confirmed junction-table RLS in production, the rep's company list is either empty or shows every company in the system. Neither is correct.

**Rep registration path defaults everyone to `role: "rep"`.** A new coordinator or marketing person who registers via the public form gets created as a `rep`. The manager must then manually change the role via Team page. This is acceptable operationally with a small team, but the Team page does not expose the full role list, making this one step harder than it needs to be.

### Manager Workflow — What Is Missing

**No global follow-up view.** The manager cannot see all overdue follow-ups across all reps in one place. The stale projects view shows projects with no stage update in 14+ days, but a project might have its stage updated while the specific follow-up date passed. These are different concepts.

**Manager has no inline activity detail for a specific rep without going to the Activities filter.** For a quick "what did Omar do this week?" the manager must navigate to Activities, filter by rep name, and filter by date. This is three clicks and a filter for a daily operational question.

**Pipeline forecasting is absent.** The dashboard shows pipeline SQM by stage (good) but there is no probability-weighted forecast, no expected close date tracking (the field exists but is not shown anywhere on the dashboard), and no way to see the financial value of the pipeline even when price data is available on quotations.

### KPI Logic — Corrected Assessment

The business has two distinct SQM sources that are currently conflated:

1. **Rep-reported SQM** — from `activities.sqm_done`. This is what the rep says they confirmed in the field. It is a leading indicator.
2. **Coordinator-confirmed SQM** — from `quotations.sqm_invoiced` (or future `invoices.sqm_invoiced`). This is what was actually invoiced. It is the real outcome KPI.

The manager dashboard currently shows "SQM This Month" from rep activities. This is the wrong number for measuring actual sales output. The correct number is coordinator-registered invoiced SQM. These need to be clearly separated on the dashboard:
- Rep activity SQM → leading indicator, compliance metric
- Invoiced SQM → lagging indicator, true business outcome

---

## 6. What Is Actually Broken

This is the definitive list after applying corrected business logic. Issues are sorted by operational impact.

| # | Issue | Impact | Where |
|---|---|---|---|
| 1 | `from("customers")` in daily report | All rep autocomplete broken | `app/rep/page.tsx` |
| 2 | Supabase anon key in shared AI context | Credential exposure | `FACET_CRM_CONTEXT.md` |
| 3 | `duplicate_flags` column name mismatch (schema vs app) | Duplicates page non-functional | `app/dashboard/duplicates/page.tsx` vs `schema.sql` |
| 4 | `reps.role` CHECK constraint excludes valid roles | Cannot set coordinator/marketing role in DB | `schema.sql` |
| 5 | Team page role dropdown missing coordinator and marketing | Manager cannot assign these roles via UI | `app/dashboard/team/page.tsx` |
| 6 | RLS policies may still reference dropped `shared_with` column | Reps see wrong companies (all or none) | Production Supabase — must verify |
| 7 | Notifications not filtered by `recipient_id` in RLS | All users may see all notifications | `app/dashboard/notifications/page.tsx`, `app/rep/notifications/page.tsx` |
| 8 | Realtime notification subscription not filtered per user | Performance + potential data leak | `components/Sidebar.tsx` |
| 9 | No invoice table — one quotation cannot have multiple invoices | Core coordinator workflow incomplete | Schema |
| 10 | `company_type` CHECK constraint in schema doesn't match UI dropdown | DB constraint errors on certain company types | `schema.sql` |
| 11 | Friday/Saturday not excluded from submission status trigger | Reps marked "late" on valid off-day gaps | `schema.sql` trigger |
| 12 | No loss reason enforcement in UI when stage = Lost | Lost deal reasons never captured | `app/rep/projects/page.tsx`, `app/dashboard/projects/page.tsx` |
| 13 | Quotation revision has no `last_revised_at` timestamp | No audit trail for when a quote was edited | `schema.sql`, quotations table |
| 14 | O(n²) duplicate scan runs in the browser | Will freeze tab at ~500+ companies | `app/dashboard/duplicates/page.tsx` |
| 15 | No staging environment — all deploys go live immediately | Any bad commit breaks production | DevOps / infrastructure |
| 16 | No error tracking or monitoring | Failures invisible until users report them | Infrastructure |
| 17 | `schema.sql` is not the source of truth for production schema | Nobody knows what is actually deployed | Documentation / process |
| 18 | Quotation only supports single product row | Multi-product quotations not possible | Schema + UI |
| 19 | Coordinator SQM split for two-rep projects has no enforcement | Attribution is verbal, not recorded | Schema + coordinator quotation UI |

---

## 7. What Is Intentional and Should NOT Be Flagged

The following behaviors are correct by design. Future AI sessions must not flag these as bugs.

- **Reps cannot create quotations.** The quotation form is behind `/dashboard` (coordinator/manager only). Reps have a read-only view at `/rep/quotations`. This is correct.
- **Reps only see quotations linked to their `rep_id`.** The rep quotations page filters by `eq("rep_id", rep.id)`. This is correct isolation.
- **The pending → active approval flow for new reps.** All new registrations start as `pending`. The manager approves them. This is intentional for reps. Coordinators are not typically self-registering — they are set up by the manager directly.
- **Activity SQM fields (sqm_done, sqm_expected) are manually entered by reps.** This is intentional for now. Event-driven automation is a future phase.
- **Companies can be registered by reps directly without manager approval.** A rep registering a new company in their own workflow gets it assigned to themselves immediately. Only marketing registration may need a different path.
- **Duplicate governance requires manager decision.** The system flags, the manager decides. No automatic merging. The three classifications (shared, conflict, not a duplicate) are correct business concepts.
- **Branch filter on dashboard is non-restrictive.** Reps can work across regions. Branches are for organizational visibility, not hard operational limits.
- **`sales_coordinator` and `marketing` both access `/dashboard`.** The layout check allows both `manager` and `sales_coordinator` to enter the dashboard. The coordinator then sees the coordinator-specific sidebar nav. This is intentional.
- **Rep can edit company name without manager approval.** Small name corrections are allowed. This is correct flexibility.
- **Quotation `notes` field exists on the coordinator form.** These notes are coordinator-internal and intentionally not surfaced in the rep's quotation view.
- **`sqm_done` in rep stats is different from `sqm_invoiced` from quotations.** These are intentionally two different metrics measuring different things. The rep stats page shows both. This is correct.
- **Coordinator is identified as `coordinator_id` on the quotation record.** This records which coordinator created the record. It is not a permission field — it is an attribution field.

---

## 8. Priority Fix Roadmap

### Immediate (Do Before Anything Else — Today)

**1. Rotate Supabase anon key.**
Go to Supabase dashboard → Settings → API → Regenerate anon key. Update the value in Vercel environment variables. Do not put the new key in any document shared with AI services.

**2. Fix `from("customers")` in `app/rep/page.tsx`.**
Change the query to `from("companies")`. Also update the query to fetch companies via the `company_reps` junction table, not just `primary_rep_id`, to capture shared assignments. At minimum, change the table name so the autocomplete works again for primary rep companies.

```ts
// Replace:
const { data: custData } = await supabase.from("customers").select(...)
// With:
const { data: compData } = await supabase
  .from("company_reps")
  .select("companies(company_name, company_type, region)")
  .eq("rep_id", repData.id);
```

**3. Verify production RLS policies in Supabase dashboard.**
Open Supabase → Authentication → Policies. Read every policy on `companies`, `projects`, and `notifications`. If any policy references `shared_with`, it is stale and needs to be replaced with junction table queries. Document what you find.

**4. Verify `duplicate_flags` column names in production.**
Run in SQL Editor: `SELECT column_name FROM information_schema.columns WHERE table_name = 'duplicate_flags';`
If columns are `customer_id_1`/`customer_id_2`, update the application code. If they are `company_id_1`/`company_id_2`, update `schema.sql`.

**5. Add `sales_coordinator` and `marketing` to Team page role dropdown.**
In `app/dashboard/team/page.tsx`, add the missing options:
```tsx
<option value="rep">Sales Rep</option>
<option value="sales_coordinator">Sales Coordinator</option>
<option value="marketing">Marketing</option>
<option value="manager">Manager</option>
```

**6. Update `reps.role` CHECK constraint in production.**
Run in SQL Editor:
```sql
ALTER TABLE reps DROP CONSTRAINT IF EXISTS reps_role_check;
ALTER TABLE reps ADD CONSTRAINT reps_role_check 
  CHECK (role in ('rep','manager','sales_coordinator','marketing'));
```

**7. Align `company_type` CHECK constraint with UI canonical list.**
```sql
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_company_type_check;
ALTER TABLE companies ADD CONSTRAINT companies_company_type_check
  CHECK (company_type in (
    'Factory','Advertising','Real Estate','Owner',
    'Consultant','Contractor','Station Management','Workshop','Other'
  ));
```

### 30-Day Fixes

**8. Add notification RLS policy if missing.**
Verify and add if needed:
```sql
CREATE POLICY "notifications_own" ON notifications FOR ALL 
USING (recipient_id = current_rep_id());
```
Also filter the Sidebar realtime subscription by `recipient_id`.

**9. Fix the submission status trigger to skip Friday and Saturday.**
```sql
CREATE OR REPLACE FUNCTION set_activity_code()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE 
  submission_day_of_week int;
  activity_day_of_week int;
BEGIN
  -- ... existing code ...
  activity_day_of_week := EXTRACT(DOW FROM new.activity_date); -- 0=Sun, 5=Fri, 6=Sat
  IF activity_day_of_week IN (5, 6) THEN
    new.submission_status := 'on_time'; -- weekend days are always on-time if submitted
  ELSIF date(new.submitted_at AT TIME ZONE 'Asia/Riyadh') = new.activity_date THEN
    new.submission_status := 'on_time';
  ELSIF date(new.submitted_at AT TIME ZONE 'Asia/Riyadh') > new.activity_date THEN
    new.submission_status := 'late';
  END IF;
  RETURN new;
END;
$$;
```

**10. Add loss reason enforcement.**
When a rep or manager changes project stage to `Lost`, show a required dropdown with options: `Price`, `Competitor`, `Timeline`, `No Budget`, `Specification Mismatch`, `No Response`, `Other`. Store in `projects.loss_reason`. Block the stage change until a reason is selected.

**11. Add `last_revised_at` to quotations table.**
```sql
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS last_revised_at timestamptz;
```
Update `saveEdit()` in the coordinator quotation page to set this timestamp.

**12. Add `stale_projects` and `pipeline_summary` views if not present.**
Verify these views exist in production. If not, create them. The manager dashboard queries them and returns empty data silently if they are missing.

**13. Move duplicate scan to a database function.**
The current O(n²) JavaScript loop will freeze the browser at scale. Move the detection to a PostgreSQL function using the existing `pg_trgm` extension and the `company_name_normalized` field:
```sql
-- Detect and insert new duplicate flags in one DB call
CREATE OR REPLACE FUNCTION detect_duplicate_companies()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO duplicate_flags (company_id_1, company_id_2, match_type, match_key)
  SELECT a.id, b.id, 'name', a.company_name
  FROM companies a
  JOIN companies b ON b.id > a.id
  WHERE a.status = 'active' AND b.status = 'active'
    AND similarity(a.company_name_normalized, b.company_name_normalized) > 0.8
    AND NOT EXISTS (
      SELECT 1 FROM duplicate_flags df
      WHERE df.company_id_1 = a.id AND df.company_id_2 = b.id
    );
END;
$$;
```

**14. Set up error tracking.**
Add Sentry to the Next.js project (free tier). At minimum this catches JavaScript errors in the browser and server-side errors in API routes. One line of configuration catches most failures.

**15. Create a staging environment.**
Create a second Supabase project for development/testing. Create a `staging` branch on Vercel. Use the staging Supabase credentials for the staging branch. Test all future changes on staging before deploying to production.

### 90-Day Fixes

**16. Build the invoice table and coordinator invoice registration UI.**
Add an `invoices` table as described in the schema gaps section. Build a simple coordinator interface: select a quotation, enter invoice reference, date, SQM invoiced, and rep attribution. Display the invoice history under the quotation row. Update KPIs to use sum of invoice SQM rather than single `sqm_invoiced` field.

**17. Add multi-product rows to quotation form.**
Add a `quotation_items` table:
```sql
quotation_items (
  id uuid PK,
  quotation_id uuid → quotations(id) ON DELETE CASCADE,
  product_type text,
  finish text,
  sqm_quoted numeric,
  price_per_sqm numeric,
  notes text
)
```
Update the quotation form to support multiple product rows. Aggregate `sqm_quoted` for KPI display.

**18. Add SQM split tracking to coordinator workflow.**
On the quotation/invoice record, allow the coordinator to select two reps and specify a split percentage. Default to 100% for one rep, 50/50 for two. Store this so rep KPIs correctly attribute partial SQM.

**19. Separate rep-activity SQM from coordinator-invoiced SQM on the manager dashboard.**
The dashboard should have two distinct SQM metrics clearly labeled: "Activity SQM (rep-reported)" and "Invoiced SQM (coordinator-confirmed)". The first is a leading indicator; the second is the business outcome. They should never be added together or treated as the same number.

**20. Add a global manager follow-up view.**
A page or dashboard card showing all projects with `next_follow_up <= today` across all reps, sorted by most overdue. Filter by rep. This is a daily operational tool for the manager.

**21. Generate production schema dump and commit it.**
Run `pg_dump --schema-only` against production or use Supabase's schema export. Commit the output as `schema.production.sql`. This becomes the source of truth, replacing the outdated `schema.sql`. All future schema changes go through migration files committed to the repo before being applied to production.

---

## 9. Prompt Fix Recommendations

When starting a new AI session about FACET CRM, include this instruction block:

---

**How to read this codebase — mandatory context for AI:**

This is a sales CRM for Technopanel, a Saudi ACP cladding supplier. It is an internal operational tool, not a public SaaS. Before suggesting any change, apply these rules:

1. **Quotations are created only by sales coordinators.** Reps only view quotations linked to them. Do not suggest reps creating quotations — this is intentional.

2. **There are four roles: `rep`, `manager`, `sales_coordinator`, `marketing`.** The coordinator and manager both access `/dashboard`. The rep and marketing roles access `/rep`. Routing is correct by design.

3. **Activity SQM and invoiced SQM are different things.** `activities.sqm_done` is rep-reported field activity. `quotations.sqm_invoiced` is coordinator-confirmed commercial outcome. Do not conflate these.

4. **Company ownership uses junction tables.** `company_reps` and `project_reps` are the access control tables. The old `shared_with text` column has been dropped. Any RLS policy or query that references `shared_with` is stale and wrong.

5. **Reps can edit their own company names.** This is intentional flexibility, not a security gap.

6. **Arabic is a primary language.** Company names are stored in Arabic or mixed Arabic/English. The normalization functions are intentional.

7. **The CRM mirrors ERP — it does not replace it.** Quotation and invoice data in the CRM is a linkage/registration layer. The ERP is the commercial source of truth.

8. **Friday and Saturday are non-working days.** Any date or compliance logic must respect this.

9. **The schema.sql file is outdated.** The actual production schema may differ. Do not assume schema.sql reflects production. When writing SQL, note that it must be verified against production before running.

10. **Do not suggest standard SaaS patterns that conflict with this model.** This is a small-team, Saudi-market, Arabic-supporting, ERP-mirroring internal tool. Generic SaaS advice about multi-tenancy, feature flags, or enterprise auth does not apply at this stage.

---

*End of Corrected Audit — FACET CRM — May 2026*