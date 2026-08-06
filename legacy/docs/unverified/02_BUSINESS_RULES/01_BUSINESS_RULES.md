# 01. Business Rules — FACET CRM

These rules are enforced by the system (database, API, or UI). All future development must preserve these rules.

---

## Working Day Rules

### Rule BR-001: Saudi Weekend
Friday (DOW=5) and Saturday (DOW=6) are non-working days. The system must never penalize a rep for not submitting an activity on these days.
- Enforced by: `set_activity_code()` trigger, `check_missing_submissions()` function, manager dashboard
- Code: `activity_dow IN (5, 6) → submission_status = 'on_time'`

### Rule BR-002: Company Holidays
Company-declared holidays (stored in `company_holidays`) excuse all reps from submission requirements for the duration of the holiday.
- Enforced by: `set_activity_code()` trigger, `check_missing_submissions()` function
- Manager adds holidays via Team page → Company Holidays section

### Rule BR-003: Individual Absences
A rep with an approved absence (stored in `rep_absences`) is excused from submission requirements for the duration of the absence.
- Enforced by: `set_activity_code()` trigger, `check_missing_submissions()` function
- Manager adds absences via Team page → Rep Absences section
- Can be added retroactively

### Rule BR-004: Grace Period for Late Submissions
A rep who submits the next working day after the activity date is marked `on_time`, not `late`. Only submissions that are two or more working days after the activity date are marked `late`.
- Enforced by: `set_activity_code()` trigger
- The grace period calculates the next working day, skipping weekends AND company holidays

---

## Activity Submission Rules

### Rule BR-005: Company Must Be Selected
When submitting a daily activity report, the rep must select a company from their assigned companies dropdown. Free-text company entry is not allowed.
- Enforced by: `app/rep/page.tsx` — the Submit button is blocked if `company_id` is empty
- A company typed but not selected from the dropdown will fail the pre-submit validation

### Rule BR-006: Interaction Type Required
Every activity row must have an interaction type selected (Visit, Call, WhatsApp, Email, Meeting, Site Visit).
- Enforced by: UI validation before submission
- Invalid rows with no interaction type are filtered out silently (not submitted)

### Rule BR-007: One Activity = One Interaction
Each row in the daily report represents one interaction. A rep who visited three different companies submits three rows.

### Rule BR-008: Activity Date Timezone
All submission status calculations use the Asia/Riyadh timezone (UTC+3). A rep submitting at 11:59 PM Riyadh time on the same day as the activity is on-time.
- Enforced by: `date(submitted_at AT TIME ZONE 'Asia/Riyadh')` in trigger

---

## Company Rules

### Rule BR-009: Company Email Domain
All user registrations must use a @technopanel.com.sa email address. Registrations with other domains are rejected.
- Enforced by: `app/api/auth/register/route.ts` (server-side check)
- Enforced by: `app/register/page.tsx` (client-side check, also)

### Rule BR-010: Arabic Name Normalization
When a company is created or updated, its name is automatically normalized for duplicate detection.
- Enforced by: `trg_normalize_customer` trigger on `companies`
- Stored in: `companies.company_name_normalized`
- Normalization: strips diacritics, unifies Alef variants, converts ة→ه, ى→ي, removes ال prefix

### Rule BR-011: Company Owned via Junction Table
A rep's access to a company is determined entirely by the existence of a row in `company_reps`. There is no `shared_with` text column. Any code referencing `shared_with` is legacy and must be removed.

### Rule BR-012: Rep Can Edit Their Own Companies
A rep can edit the name and details of companies assigned to them without manager approval. This is intentional flexibility.

### Rule BR-013: Only Manager Can Delete
Only manager and super_admin roles can delete companies, contacts, and projects. Reps have no delete access.
- Enforced by: RLS policies (manager-only DELETE)

---

## Project Rules

### Rule BR-014: Atomic Project Creation
A project must never be created without simultaneously creating its `project_reps` entry. This prevents invisible projects (projects a rep cannot see in their list). Always use the `create_project_with_rep()` RPC.

### Rule BR-015: Loss Reason Required
When a project stage is changed to "Lost", a loss reason must be provided from the canonical list. The stage change is blocked in the UI until a reason is selected.
- Enforced by: UI modal in `app/rep/projects/page.tsx` and `app/dashboard/projects/page.tsx`
- Canonical values: Price, Competitor, Timeline, No Budget, Specification Mismatch, No Response, Other

### Rule BR-016: Stage Changes Are Logged
Every time a project's stage, quoted_sqm, or loss_reason changes, the change is logged to `project_history`.
- Enforced by: `trg_project_history` trigger on `projects`
- Recorded: old_value, new_value, changed_by (rep_id), changed_at

### Rule BR-017: Stale Project Definition
A project is stale if its `stage_changed_at` is more than 14 days ago AND the stage is not Won, Delivered, or Lost.
- Used by: `stale_projects` view, manager dashboard

---

## Quotation Rules

### Rule BR-018: Quotations Are Coordinator-Only
Only `sales_coordinator`, `manager`, and `super_admin` can create or update quotations. Reps see a read-only view.
- Enforced by: RLS policies (`quotations_manager` policy covers coordinator + manager + super_admin for ALL operations)
- Enforced by: Routing — quotation form only exists at `/dashboard/quotations`

### Rule BR-019: SQM Quoted Auto-Calculated
`quotations.sqm_quoted` is automatically updated to the sum of all `quotation_items.total_sqm` when items are added, updated, or deleted.
- Enforced by: `trg_update_quotation_sqm` trigger on `quotation_items`

### Rule BR-020: Project SQM Auto-Synced
When a quotation's status changes or sqm_invoiced is updated, the parent project's `quoted_sqm` and `won_sqm` are automatically recalculated.
- Enforced by: `trg_sync_project_sqm` trigger on `quotations`

### Rule BR-021: Cancellation Requires Reason
When a quotation status is changed to "cancelled", a `cancellation_reason` must be provided.
- Enforced by: UI validation in the coordinator quotation update row

### Rule BR-022: Activity SQM ≠ Invoiced SQM
`activities.sqm_done` (rep field estimate) and `quotations.sqm_invoiced` (coordinator-confirmed) are different metrics measuring different things. They must never be added together or treated as equivalent.

---

## Rep Assignment Rules

### Rule BR-023: Two Reps on One Entity Is Normal
A company or project having two assigned reps (primary + shared) is a legitimate business scenario, not a data error. Do not flag this as a bug.

### Rule BR-024: Reps See Only Their Own Activities
Even on shared companies or projects, a rep can only see activities they themselves submitted. They cannot see the other rep's notes or interactions on the same entity.
- Enforced by: RLS policy `activities_rep_read` — `rep_id = current_rep_id()`

### Rule BR-025: SQM Split Attribution
When two reps work one project, the coordinator attributes invoiced SQM at quotation level. The system does not automatically split 50/50. The coordinator specifies attribution.
- Current implementation: `quotations.rep_id` and `quotations.assigned_to_id` — rep credited is the one linked to the quotation
- Limitation: No percentage split field exists yet (future invoice table will address this)

---

## Notification Rules

### Rule BR-026: Duplicate Detection is Manual Review
The system flags potential duplicates. The manager decides the classification. No automatic merging occurs.
- Classifications: pending → shared / conflict / resolved (not a duplicate)

### Rule BR-027: Missing Submission Notifications Fire Once Per Day
The `check_missing_submissions()` function is called from the dashboard on load. It checks if yesterday was a working day, then sends notifications only if not already sent today for that date.

### Rule BR-028: Notifications Filtered by Recipient
Each user sees only notifications addressed to them. RLS policy `notifications_select` enforces `recipient_id = current_rep_id()` for reps.
