# 01. Testing — FACET CRM

## Current Test Coverage

**Automated tests: None.**

There is no Jest, Playwright, Cypress, or any other test framework installed. Quality is maintained through:
1. TypeScript compilation (build-time type checking)
2. Manual testing on production after every deployment
3. User-reported bugs

---

## Manual Test Checklist

Use this checklist after every deployment.

### Authentication
- [ ] Login with valid @technopanel.com.sa email works
- [ ] Login with wrong password shows correct error
- [ ] Non-@technopanel.com.sa email rejected on register page
- [ ] Logged-out user redirected to /login (not redirect loop)
- [ ] Manager sees /dashboard after login
- [ ] Rep sees /rep after login
- [ ] Coordinator sees /dashboard after login

### Daily Report (Rep)
- [ ] Companies load in dropdown (only rep's assigned companies)
- [ ] Typing company name filters dropdown (Arabic and English)
- [ ] Selecting company loads contacts and projects for that company
- [ ] Contact selection auto-fills phone number
- [ ] Projects show only active stages (not Won/Delivered/Lost)
- [ ] Submit button blocked if no company selected
- [ ] Submit button blocked if no interaction type selected
- [ ] Successful submission shows green confirmation
- [ ] Submission appears in manager activities log

### Companies
- [ ] Rep can register new company → appears in their list
- [ ] Manager can create company and assign to any rep
- [ ] Company detail page shows contacts tab and projects tab
- [ ] Manager can assign additional reps to a company
- [ ] Company type dropdown matches canonical values
- [ ] Source + source_detail two-level dropdown works

### Projects
- [ ] Rep can create project under their companies
- [ ] Project appears in rep's project list immediately
- [ ] Stage can be changed inline
- [ ] Changing stage to Lost shows modal requiring reason
- [ ] Loss reason modal blocks submit if no reason selected
- [ ] Project history shows stage changes after update
- [ ] Follow-ups due page shows overdue projects

### Quotations (Coordinator)
- [ ] New quotation form opens and submits
- [ ] Product lines calculate SQM correctly (W × L × sheets)
- [ ] Grand total SQM shown correctly
- [ ] Quotation appears in rep's read-only quotations page
- [ ] Status update works (pending → submitted → won)
- [ ] Cancellation requires reason field
- [ ] sqm_invoiced update reflects in project won_sqm

### Team Management
- [ ] Manager can change rep status (pending → active)
- [ ] Manager can change rep role (all 4 roles + super_admin visible)
- [ ] Manager can set monthly target SQM
- [ ] Manager can create new user account
- [ ] Manager can add company holiday
- [ ] Manager can add rep absence

### Duplicates
- [ ] Scan for Duplicates button runs and reports count
- [ ] Duplicate pairs displayed side-by-side
- [ ] Manager can classify as Shared / Conflict / Not Duplicate
- [ ] Classified flags move to correct tab

### Notifications
- [ ] Notification bell shows correct unread count
- [ ] Clicking notification marks it read
- [ ] Mark all read works

---

## Regression Check After Schema Changes

After any ALTER TABLE or new column addition:

- [ ] Confirm the affected page still loads without errors
- [ ] Verify Vercel build log shows no TypeScript errors
- [ ] Verify the new column appears in Supabase table editor
- [ ] Test the feature that uses the new column end-to-end

---

## Known Flaky Areas

These areas have had bugs in the past and deserve extra attention:

1. **Daily report company dropdown** — Has failed silently when querying wrong table name
2. **Quotation rep lookup** — Ambiguous FK join fails silently; always verify rep names display
3. **Middleware redirect** — Cookie passthrough must work; test login redirect on fresh browser
4. **Submission status** — Test submitting activity on Sunday for Thursday (verify not marked late)
