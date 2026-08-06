# 05. Notification Workflow — FACET CRM

## Overview

FACET has an in-app notification system. Notifications appear in the sidebar bell icon with an unread count badge. Notifications are per-recipient — each user sees only their own.

There are no email or WhatsApp notifications currently. All notifications are in-app only.

---

## Notification Types

| type value | Trigger | Recipients |
|---|---|---|
| `pending_approval` | New rep registers (status=pending) | All active managers |
| `assignment` | Rep assigned to a company (company_reps INSERT) | The assigned rep |
| `duplicate_alert` | New duplicate_flag with classification=pending | All active managers |
| `missing_submission` | Rep did not submit for a working day | The rep + all active managers |
| `system` | Manual/administrative messages | Specified recipient |

---

## Trigger-Based Notifications (Automatic)

### 1. New Rep Registration
**Trigger:** `trg_notify_pending_rep` on `reps` AFTER INSERT  
**Condition:** `new.status = 'pending'`  
**Action:** Inserts a `pending_approval` notification for every active manager  
**Title:** `"New Registration: {rep_name}"`  
**Body:** `"{email} has registered and is awaiting approval."`

### 2. Company Assignment
**Trigger:** `trg_notify_company_assignment` on `company_reps` AFTER INSERT  
**Condition:** Always fires on insert  
**Action:** Inserts an `assignment` notification for the assigned rep  
**Title:** `"Company Assigned: {company_name}"`  
**Body:** `"You have been assigned to {company_name} as {role}."`

### 3. Duplicate Flag
**Trigger:** `trg_notify_duplicate` on `duplicate_flags` AFTER INSERT  
**Condition:** `new.classification = 'pending'`  
**Action:** Inserts a `duplicate_alert` notification for every active manager  
**Title:** `"Duplicate Detected: {match_key}"`  
**Body:** `"A possible duplicate company was detected. Please review in the Duplicates section."`

**Note:** This trigger only notifies managers where `role = 'manager'`. It does NOT include `super_admin`. [Known minor gap — can be fixed by updating the trigger to include super_admin]

---

## Function-Based Notifications (On Dashboard Load)

### Missing Submission Check
**Function:** `check_missing_submissions()` — called via `supabase.rpc()` from the manager dashboard page on every load  
**Logic:**
1. Calculate yesterday's date
2. If yesterday was a weekend (DOW 5 or 6) → return (do nothing)
3. If yesterday was a company holiday → return (do nothing)
4. For each active rep (role IN 'rep', 'marketing'):
   - Check if rep has an approved absence for yesterday → skip if yes
   - Check if rep submitted any activity for yesterday → if not:
     - Check if notification already sent today for this date → skip if yes
     - Insert `missing_submission` notification to the rep
     - Insert `missing_submission` notification to all active managers + super_admins

**Deduplication:** Uses `LIKE '%{date}%'` body matching to prevent duplicate notifications on the same day.

---

## Realtime Badge Update

The sidebar bell icon shows an unread count. This is kept live via Supabase Realtime:

**File:** `components/Sidebar.tsx`

```typescript
const channel = supabase.channel('realtime_notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
  }, () => { loadUnread(); })
  .subscribe();
```

**Note:** The realtime subscription currently listens to ALL new notifications (not filtered by recipient_id). The `loadUnread()` function then fetches the count filtered by the current user. This means an INSERT for any user triggers a re-fetch for all connected users — acceptable at current team size (< 15 users).

---

## Marking Notifications Read

Two mechanisms exist:

1. **Click individual notification** — clicking an unread notification in the list calls `markRead(id)` → UPDATE notifications SET is_read = true WHERE id = {id}
2. **Mark all read button** — appears when unread notifications exist → UPDATE notifications SET is_read = true WHERE is_read = false

---

## RLS on Notifications

```sql
-- Users see their own, managers see everything
CREATE POLICY "notifications_select" ON notifications FOR SELECT
USING (
  recipient_id = current_rep_id()
  OR current_user_role() = ANY (ARRAY['manager', 'super_admin'])
);

-- Inserts are open (triggers insert on behalf of other users)
CREATE POLICY "notifications_insert" ON notifications FOR INSERT
WITH CHECK (true);

-- Updates filtered by ownership
CREATE POLICY "notifications_update" ON notifications FOR UPDATE
USING (
  recipient_id = current_rep_id()
  OR current_user_role() = ANY (ARRAY['manager', 'super_admin'])
);
```

---

## Notification Table Schema

```sql
notifications (
  id           uuid PK,
  recipient_id uuid → reps(id) CASCADE,
  type         text CHECK (pending_approval|assignment|duplicate_alert|
                           project_stale|quotation_expiry|follow_up_due|
                           lead_submitted|missing_submission|system),
  title        text NOT NULL,
  body         text,
  entity_type  text CHECK (company|contact|project|quotation|rep),
  entity_id    uuid,
  is_read      boolean DEFAULT false,
  created_at   timestamptz DEFAULT now()
)
```
