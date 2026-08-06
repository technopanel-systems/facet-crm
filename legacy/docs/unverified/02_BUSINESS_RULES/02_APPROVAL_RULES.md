# 02. Approval Rules — FACET CRM

---

## User Account Approval

### New Rep Self-Registration
1. Rep goes to `/register` and submits email + password + name
2. API creates Supabase Auth user with `email_confirm: true` (auto-confirmed — no email verification)
3. Rep row inserted into `reps` with `status = 'active'` immediately
4. Trigger `trg_notify_pending_rep` fires → notification sent to all active managers
5. Rep is redirected to `/pending` screen
6. Manager sees notification in dashboard and pending badge in Team page
7. Manager reviews at `/dashboard/team` and can change status / set role / set target
8. Once manager approves (sets status to active, assigns role and target), rep can log in normally

**Note:** Self-registered reps currently default to `role = 'rep'` and `status = 'active'` at the API level. The "pending" screen is shown but the status in the DB may already be active. The manager still needs to set the correct role and target. [ASSUMPTION: the intent is that all new reps are active but need target assignment]

### Manager-Created Accounts
The manager can create accounts directly from `/dashboard/team` → Create User modal. These accounts are immediately active with the role and target specified. No pending flow.

---

## Company Approval

### Rep-Registered Companies
When a rep registers a new company via their companies page, it is immediately created and assigned to them as primary rep. No manager approval required.

### Manager-Created Companies
Manager can create companies at `/dashboard/companies`. These can be assigned to any rep or left unassigned.

---

## Project Approval

Projects do not require approval. Any rep can create a project under their assigned companies. The manager has full visibility and can edit or delete any project.

---

## Quotation Approval

Quotations do not have a formal approval workflow. The coordinator creates them, updates their status, and records invoiced amounts. There is no approval step before a quotation can be created or marked as won.

---

## Duplicate Flag Resolution

When two companies are flagged as potential duplicates:
1. System auto-flags (via `detect_duplicate_companies()` RPC, triggered manually by manager)
2. Notification sent to all active managers
3. Manager reviews the pair at `/dashboard/duplicates`
4. Manager classifies as one of:
   - **Shared** — Both reps legitimately work the same real-world company. Both keep access.
   - **Conflict** — Ownership dispute. Manager resolves externally and then marks.
   - **Not a Duplicate** (resolved) — Different companies with similar names. Flag dismissed.
5. No automatic merging. Manager may manually delete one record if it is a true duplicate.

---

## Absence Approval

Only managers can create absence records. There is no self-service absence request flow for reps. The manager approves the absence outside the system and then records it in the CRM retroactively or in advance via `/dashboard/team`.

---

## Summary Table

| Item | Requires Approval | Approver | Mechanism |
|---|---|---|---|
| New user registration (self) | Yes (soft) | Manager | Manager sets role + target |
| New user (manager-created) | No | — | Immediate |
| Company registration (rep) | No | — | Auto-assigned to rep |
| Project creation | No | — | Auto-assigned to rep |
| Quotation creation | No | — | Coordinator creates directly |
| Duplicate resolution | Yes | Manager | Manual classification |
| Absence recording | Manager-only | — | Manager enters directly |
| Rep deletion | No delete in UI | — | Must be done via Supabase dashboard |
