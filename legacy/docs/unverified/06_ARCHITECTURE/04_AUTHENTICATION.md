# 04. Authentication — FACET CRM

## Auth Provider

Supabase Auth with email/password. No OAuth providers (Google, etc.) are configured.

---

## Registration Flow

```
1. User visits /register
2. Fills in: name, email (@technopanel.com.sa only), password
3. POST /api/auth/register (admin client)
   a. Email domain validated server-side
   b. Supabase auth user created (email_confirm: true — auto-confirmed)
   c. reps row inserted: status='active', role='rep' (default)
4. User sees success screen
5. User redirected to /login
6. Manager receives notification (trg_notify_pending_rep — may not fire if status=active)
7. Manager sets role + target at /dashboard/team
```

**Note:** New self-registrations default to `status = 'active'` and `role = 'rep'`. There is no hard account lock — a new rep can log in immediately but needs target and role assignment by the manager.

---

## Login Flow

```
1. User visits /login
2. Enters email + password
3. supabase.auth.signInWithPassword({ email, password })
4. Supabase returns session (JWT access token + refresh token)
5. @supabase/ssr stores tokens in cookies
6. Browser redirects to /
7. app/page.tsx (server component) reads role from reps table
8. Redirects to /dashboard (manager/coordinator/super_admin) or /rep (rep/marketing)
```

---

## Session Management

Sessions are managed by `@supabase/ssr`. Tokens are stored as HTTP-only cookies. The server client reads these cookies on every server-side request.

**Session refresh:** The middleware automatically refreshes expired access tokens using the refresh token. This happens transparently on every request.

**Sign out:**
```typescript
await supabase.auth.signOut();
router.push('/login');
```
Called from the Sidebar sign-out button.

---

## Role-Based Routing

Role-checking happens at the layout level, not middleware.

### `/dashboard/layout.tsx`
```typescript
const role = rep?.role?.toLowerCase().trim();
if (role !== 'manager' && role !== 'sales_coordinator' && role !== 'super_admin') {
  redirect('/rep');
}
```
Any user without a dashboard-level role is sent to `/rep`.

### `/rep/layout.tsx`
```typescript
const role = rep?.role?.toLowerCase().trim();
if (role === 'manager' || role === 'super_admin' || role === 'sales_coordinator') {
  redirect('/dashboard');
}
```

### `app/page.tsx` (root redirect)
```typescript
const role = rep.role?.toLowerCase().trim();
if (role === 'manager' || role === 'sales_coordinator' || role === 'super_admin') {
  redirect('/dashboard');
}
redirect('/rep');
```

**Pending status redirect:**
Both layouts check `if (rep?.status === 'pending') redirect('/pending')`.

---

## Middleware Protection

`middleware.ts` protects all routes except: `/login`, `/register`, `/pending`, `/auth/*`

Unauthenticated requests to any other route are redirected to `/login` with cookies preserved.

---

## Company Email Enforcement

The `@technopanel.com.sa` domain restriction is enforced in two places:

1. **Client-side** (`app/register/page.tsx`):
```typescript
if (!email.endsWith('@technopanel.com.sa')) {
  setError('You must use a valid @technopanel.com.sa email address.');
  return;
}
```

2. **Server-side** (`app/api/auth/register/route.ts`):
```typescript
if (!email.endsWith('@technopanel.com.sa')) {
  return NextResponse.json({ error: 'Only @technopanel.com.sa emails allowed.' }, { status: 403 });
}
```

The server-side check is the security-critical one. The client-side check is UX only.

---

## Security Notes

### Anon Key
The `NEXT_PUBLIC_SUPABASE_ANON_KEY` is a public key. It is safe to expose to the browser. It does not grant any elevated permissions — all database access is filtered by RLS policies.

### Service Role Key
`SUPABASE_SERVICE_ROLE_KEY` bypasses ALL RLS policies. It is stored only in Vercel environment variables and used only in `/api/*` routes via the Admin Client. It must NEVER appear in client-side code or be committed to the repository.

### JWT Tokens
Supabase JWTs expire after 1 hour. The refresh token (stored in cookies) allows transparent renewal. The middleware handles this on every request.
