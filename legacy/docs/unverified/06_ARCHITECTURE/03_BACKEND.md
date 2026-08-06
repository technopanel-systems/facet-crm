# 03. Backend Architecture — FACET CRM

## Overview

There is no dedicated backend server. Backend logic lives in three places:
1. **Next.js API Routes** (`/api/*`) — for operations requiring the service role key
2. **Supabase PostgreSQL Functions** — for atomic database operations and business logic
3. **Supabase RLS Policies** — for data access enforcement at the database level

---

## API Routes

Only two API routes exist. Both are in `app/api/auth/`.

### POST `/api/auth/register`
File: `app/api/auth/register/route.ts`

**Purpose:** Creates a new Supabase Auth user and a corresponding reps row. Must use the Admin Client (service role key) because creating auth users requires admin privileges.

**Request body:**
```json
{
  "email": "name@technopanel.com.sa",
  "password": "minimum6chars",
  "name": "Full Name",
  "role": "rep",
  "monthly_target_sqm": 0
}
```

**Logic:**
1. Validate email ends with `@technopanel.com.sa` (server-side enforcement)
2. Call `adminClient.auth.admin.createUser()` with `email_confirm: true`
3. Insert row into `reps` table with provided fields
4. Return `{ success: true }` or `{ error: message }`

**Called from:**
- `app/register/page.tsx` (self-registration flow)
- `app/dashboard/team/page.tsx` Create User modal (manager-created accounts)

**Security:** Uses `SUPABASE_SERVICE_ROLE_KEY` — this route must NEVER be publicly callable without the email domain check. The domain check is the only guard against arbitrary user creation.

---

### GET `/api/auth/callback`
File: `app/api/auth/callback/route.ts`

**Purpose:** Handles Supabase OAuth callback code exchange. Required for the SSR auth flow.

**Logic:**
1. Extract `code` from query params
2. Call `supabase.auth.exchangeCodeForSession(code)`
3. Redirect to `/`

---

## Supabase as Backend

The majority of "backend" logic runs inside PostgreSQL via:

### Direct Client Queries (PostgREST)
Client components query Supabase directly using the browser client. PostgREST translates JavaScript method chains into SQL. RLS policies enforce access control at the database level.

```typescript
// This runs as: SELECT * FROM activities WHERE rep_id = current_rep_id() (enforced by RLS)
const { data } = await supabase
  .from('activities')
  .select('*')
  .eq('rep_id', repId)
  .order('activity_date', { ascending: false });
```

### RPC Calls (PostgreSQL Functions)
For operations requiring multiple inserts in a single transaction:

```typescript
const { data, error } = await supabase.rpc('create_project_with_rep', {
  p_customer_id: companyId,
  p_project_name: name,
  // ... other params
});
```

### Realtime Subscriptions
For live notification badge updates:

```typescript
supabase.channel('realtime_notifications')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, 
    () => loadUnread())
  .subscribe();
```

---

## Data Validation

### Server-side Validation
- Email domain check in `/api/auth/register` (TypeScript)
- Database CHECK constraints enforce dropdown value integrity
- NOT NULL constraints enforce required fields
- UNIQUE constraints prevent duplicate codes and emails

### Client-side Validation
- Company must be selected from dropdown (not free-text) in daily report
- Loss reason required when stage = Lost
- Cancellation reason required when quotation status = cancelled
- Password minimum length (6 chars) on registration form

### Database-level Validation (Triggers)
- Activity submission_status auto-calculated (can't be manipulated by client)
- Auto-codes assigned server-side (can't be forged by client)
- Arabic normalization applied automatically

---

## Error Handling Patterns

API routes return structured errors:
```typescript
return NextResponse.json({ error: error.message }, { status: 400 });
```

Client components check for errors:
```typescript
const { data, error } = await supabase.from('companies').insert({...});
if (error) { setError(error.message); return; }
```

Build-time TypeScript errors are the primary quality gate — discovered at Vercel build time, not locally.

---

## Middleware

File: `middleware.ts`

Runs on every request (except static files). Handles:
1. Session refresh (Supabase SSR cookie refresh)
2. Unauthenticated redirect → `/login`
3. Authenticated user on `/login` → redirect to `/`

**Critical cookie passthrough fix:** When redirecting, the middleware must copy Supabase cookies from `supabaseResponse` to the redirect response, otherwise the session is lost:

```typescript
const redirectResponse = NextResponse.redirect(url);
supabaseResponse.cookies.getAll().forEach((cookie) => {
  redirectResponse.cookies.set(cookie.name, cookie.value);
});
return redirectResponse;
```

Without this fix, users get redirect loops after login.
