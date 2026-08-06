# 02. API Endpoints — FACET CRM

## Custom Next.js API Routes

---

### POST `/api/auth/register`

Creates a new Supabase Auth user and rep profile.

**Authentication:** None required (public endpoint — guarded by email domain check)

**Request:**
```json
{
  "email": "string (required, must end in @technopanel.com.sa)",
  "password": "string (required, minimum 6 characters)",
  "name": "string (required)",
  "role": "string (optional, default: 'rep')",
  "monthly_target_sqm": "number (optional, default: 0)"
}
```

**Success Response (200):**
```json
{ "success": true }
```

**Error Responses:**
```json
// 403 — Invalid email domain
{ "error": "Only @technopanel.com.sa email addresses are allowed." }

// 400 — Supabase auth error (e.g., email already exists)
{ "error": "User already registered" }

// 400 — Database error
{ "error": "duplicate key value violates unique constraint..." }
```

**Side Effects:**
- Creates row in `auth.users`
- Creates row in `reps`
- Triggers `trg_notify_pending_rep` (if status=pending — see trigger notes)

---

### GET `/api/auth/callback`

Handles Supabase OAuth PKCE code exchange. Required for SSR auth flow.

**Query Parameters:**
- `code` — The OAuth authorization code from Supabase

**Response:** Redirect to `/`

**Notes:** This route is required for the `@supabase/ssr` package to work correctly. It is called automatically during the auth flow.

---

## Supabase RPC Endpoints

These are PostgreSQL functions callable via `supabase.rpc()`:

### `create_company_with_rep`
Creates a company and rep assignment atomically.

**Parameters:**
```typescript
{
  p_company_name: string,
  p_company_type: string,  // '' → stored as NULL
  p_region: string,
  p_source: string,
  p_source_detail: string,
  p_notes: string,
  p_rep_id: string | null,
}
```
**Returns:** `uuid` (new company id)

---

### `create_project_with_rep`
Creates a project and rep assignment atomically.

**Parameters:**
```typescript
{
  p_customer_id: string,    // uuid of company
  p_project_name: string,
  p_city: string,
  p_stage: string,
  p_quoted_sqm: number,
  p_project_date: string,   // ISO date string
  p_notes: string,
  p_contact_id: string | null,
  p_rep_id: string | null,
}
```
**Returns:** `uuid` (new project id)

---

### `detect_duplicate_companies`
Scans all active companies for name similarity duplicates.

**Parameters:** none

**Returns:** `integer` (count of new duplicate_flags inserted)

---

### `check_missing_submissions`
Checks for reps who missed yesterday's daily report and inserts notifications.

**Parameters:** none

**Returns:** `void`

**Note:** Called automatically from the manager dashboard on every page load.
