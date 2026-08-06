# 03. Permission Rules — FACET CRM

Permission in FACET is enforced at two layers:
1. **Routing** — layouts redirect users to the wrong section before any page loads
2. **Database RLS** — even if a user bypasses the UI, the database refuses unauthorized reads/writes

Both layers must be maintained. Never remove RLS policies assuming the UI is sufficient protection.

---

## Role Routing

| Role | Allowed Routes | Blocked Routes |
|---|---|---|
| `rep` | `/rep/*` | `/dashboard/*` |
| `marketing` | `/rep/*` | `/dashboard/*` |
| `sales_coordinator` | `/dashboard/*` | `/rep/*` |
| `manager` | `/dashboard/*` | `/rep/*` |
| `super_admin` | `/dashboard/*` | `/rep/*` |

Routing enforced in:
- `app/dashboard/layout.tsx` — redirects rep/marketing to `/rep`
- `app/rep/layout.tsx` — redirects manager/coordinator/super_admin to `/dashboard`
- `app/page.tsx` — root redirect based on role
- `middleware.ts` — redirects unauthenticated users to `/login`

---

## Permission Matrix by Resource

### Companies

| Action | rep | marketing | sales_coordinator | manager | super_admin |
|---|---|---|---|---|---|
| SELECT own | ✅ via company_reps | ✅ via company_reps | ✅ all | ✅ all | ✅ all |
| SELECT all | ❌ | ❌ | ✅ | ✅ | ✅ |
| INSERT | ✅ (via RPC) | ✅ (via RPC) | ✅ | ✅ | ✅ |
| UPDATE own | ✅ | ✅ | ✅ | ✅ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ✅ | ✅ |

### Projects

| Action | rep | marketing | sales_coordinator | manager | super_admin |
|---|---|---|---|---|---|
| SELECT own | ✅ via project_reps | ✅ via project_reps | ✅ all | ✅ all | ✅ all |
| SELECT all | ❌ | ❌ | ✅ | ✅ | ✅ |
| INSERT | ✅ (via RPC) | ✅ (via RPC) | ✅ | ✅ | ✅ |
| UPDATE own | ✅ | ✅ | ✅ | ✅ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ✅ | ✅ |

### Activities

| Action | rep | marketing | sales_coordinator | manager | super_admin |
|---|---|---|---|---|---|
| SELECT own | ✅ rep_id match | ✅ rep_id match | ❌ | ✅ all | ✅ all |
| SELECT all | ❌ | ❌ | ❌ | ✅ | ✅ |
| INSERT own | ✅ | ✅ | ❌ | ✅ | ✅ |
| UPDATE | ❌ | ❌ | ❌ | ✅ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ✅ | ✅ |

### Quotations

| Action | rep | marketing | sales_coordinator | manager | super_admin |
|---|---|---|---|---|---|
| SELECT own | ✅ rep_id match | ✅ rep_id match | ✅ all | ✅ all | ✅ all |
| SELECT all | ❌ | ❌ | ✅ | ✅ | ✅ |
| INSERT | ❌ | ❌ | ✅ | ✅ | ✅ |
| UPDATE | ❌ | ❌ | ✅ | ✅ | ✅ |
| DELETE | ❌ | ❌ | ✅ | ✅ | ✅ |

### Contacts

| Action | rep | marketing | sales_coordinator | manager | super_admin |
|---|---|---|---|---|---|
| SELECT own companies' | ✅ | ✅ | ✅ all | ✅ all | ✅ all |
| INSERT | ✅ | ✅ | ✅ | ✅ | ✅ |
| UPDATE own | ✅ | ❌ | ✅ | ✅ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ✅ | ✅ |

### Reps (user profiles)

| Action | rep | marketing | sales_coordinator | manager | super_admin |
|---|---|---|---|---|---|
| SELECT all | ✅ (names only for dropdowns) | ✅ | ✅ | ✅ | ✅ |
| UPDATE | ❌ | ❌ | ❌ | ✅ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ✅ | ✅ |

### Notifications

| Action | rep | marketing | sales_coordinator | manager | super_admin |
|---|---|---|---|---|---|
| SELECT own | ✅ recipient_id match | ✅ | ✅ | ✅ all | ✅ all |
| Mark read | ✅ own | ✅ own | ✅ own | ✅ | ✅ |
| INSERT | ✅ (trigger-generated) | ✅ | ✅ | ✅ | ✅ |

### Company Holidays / Rep Absences

| Action | rep | marketing | sales_coordinator | manager | super_admin |
|---|---|---|---|---|---|
| SELECT | ✅ (read all holidays) | ✅ | ✅ | ✅ | ✅ |
| INSERT/UPDATE/DELETE | ❌ | ❌ | ❌ | ✅ | ✅ |

### Duplicate Flags

| Action | rep | marketing | sales_coordinator | manager | super_admin |
|---|---|---|---|---|---|
| SELECT | ❌ | ❌ | ❌ | ✅ | ✅ |
| UPDATE (classify) | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## Super Admin Special Rules

- `super_admin` has identical database permissions to `manager` in all RLS policies
- `super_admin` role cannot be changed via the Team page UI (it renders as a static badge, not a dropdown)
- `super_admin` can be assigned via direct database update in Supabase SQL Editor only
- Currently assigned to: Jerom Youssef (jerom@technopanel.com.sa)

---

## How RLS Identity Works

The database identifies the current user via two helper functions:

```sql
current_user_role() → SELECT lower(trim(role)) FROM reps WHERE auth_user_id = auth.uid() LIMIT 1
current_rep_id()    → SELECT id FROM reps WHERE auth_user_id = auth.uid() LIMIT 1
```

**Critical:** These functions return `NULL` when called from the Supabase SQL Editor (no auth session). This is expected behaviour — not a bug. Policies work correctly in browser sessions.

---

## Supabase Client Security Model

| Client | File | Key Used | RLS Enforced |
|---|---|---|---|
| Browser client | `lib/supabase/client.ts` | Anon key | ✅ Yes |
| Server client | `lib/supabase/server.ts` | Anon key | ✅ Yes |
| Admin client | `lib/supabase/admin.ts` | Service role key | ❌ Bypassed |

The admin client is used **only** in `/api/auth/register/route.ts` for creating new Supabase Auth users. It must never be imported into any client component or any page outside of `/api/*` routes.
