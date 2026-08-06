# 02. Environment Variables — FACET CRM

## All Required Variables

| Variable | Scope | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public (browser-safe) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (browser-safe) | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only (secret) | Supabase service role key — bypasses RLS |

---

## Variable Details

### `NEXT_PUBLIC_SUPABASE_URL`
```
Value: https://qndpfbmniqxkegzmzcmh.supabase.co
Scope: All (Production, Preview, Development)
Used by: lib/supabase/client.ts, lib/supabase/server.ts, lib/supabase/admin.ts, middleware.ts
Safe to expose: YES — this is a public URL
```

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`
```
Scope: All (Production, Preview, Development)
Used by: lib/supabase/client.ts, lib/supabase/server.ts, middleware.ts
Safe to expose: YES — controlled by RLS policies
Security note: This key was previously exposed in AI session context documents.
              Rotate it in Supabase → Settings → API if not already done.
```

### `SUPABASE_SERVICE_ROLE_KEY`
```
Scope: All (Production, Preview, Development)
Used by: lib/supabase/admin.ts (API routes only)
Safe to expose: NO — NEVER put in frontend code or commit to git
Security: Bypasses ALL RLS policies. Full database access.
```

---

## Local Development Setup

For local development, create `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://qndpfbmniqxkegzmzcmh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

`.env.local` is in `.gitignore` and must NEVER be committed.

**Note:** There is currently no confirmed local development environment. The founder works exclusively through GitHub web editor + Vercel. If setting up local development for the first time, also install Node.js 18+ and run `npm install`.

---

## Where to Find These Values

### Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select the FACET CRM project
3. Go to Project Settings → API
4. Find: Project URL, anon key, service_role key

### Vercel Dashboard
1. Go to https://vercel.com
2. Select the facet-crm project
3. Go to Settings → Environment Variables
4. All three variables should be present for Production, Preview, and Development scopes

---

## Rotating the Anon Key

**The anon key has been exposed in AI session documents. It should be rotated.**

Steps:
1. Supabase Dashboard → Project Settings → API
2. Click "Reveal" on the anon key
3. Look for a "Rotate" or "Regenerate" option
4. Copy the new key
5. Update `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel (all 3 scopes)
6. Redeploy the application
7. Do NOT put the new key in any document shared with AI services

**Impact of rotating:** All existing browser sessions will be invalidated. Users will be logged out and need to log in again. This is a one-time disruption.
