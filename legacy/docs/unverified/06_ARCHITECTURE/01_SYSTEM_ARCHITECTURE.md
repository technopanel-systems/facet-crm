# 01. System Architecture — FACET CRM

## Overview

FACET CRM is a full-stack web application. There is no separate backend server — Next.js handles both the frontend UI and the server-side API routes. Supabase provides the database, authentication, and real-time subscriptions.

---

## Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        USER BROWSER                          │
│                                                             │
│   Next.js Client Components (React, Tailwind)               │
│   ├── Supabase Browser Client (anon key + RLS)              │
│   └── Realtime Subscriptions (notifications)                │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTPS
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              VERCEL (Next.js 14 App Router)                  │
│                                                             │
│   Server Components                                         │
│   ├── Supabase Server Client (anon key + user session)      │
│   └── Layout data fetching, auth checks                     │
│                                                             │
│   API Routes (/api/*)                                       │
│   └── Supabase Admin Client (service role key, bypasses RLS)│
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTPS
                   ▼
┌─────────────────────────────────────────────────────────────┐
│           SUPABASE (PostgreSQL, Bahrain me-south-1)          │
│                                                             │
│   ├── Auth (email/password, JWT sessions)                   │
│   ├── Database (PostgreSQL + RLS + Triggers + Functions)    │
│   ├── PostgREST (REST API auto-generated from schema)       │
│   └── Realtime (WebSocket for table change subscriptions)   │
└─────────────────────────────────────────────────────────────┘
```

---

## Request Flow by Type

### 1. Page Load (Server Component)
```
Browser → Vercel Edge → Next.js Server Component
  → Supabase Server Client (cookie-based session)
  → PostgreSQL (query filtered by RLS)
  → HTML rendered server-side → Browser
```

### 2. Interactive Form (Client Component)
```
Browser React Component
  → Supabase Browser Client (anon key)
  → PostgREST API → PostgreSQL (RLS enforced)
  → Response → React state update → Re-render
```

### 3. User Registration (API Route)
```
Browser → POST /api/auth/register
  → Next.js API Route
  → Supabase Admin Client (service role key, bypasses RLS)
  → Creates auth user + inserts rep row
  → Response → Browser
```

### 4. Real-time Notification Badge
```
Supabase Realtime WebSocket → Browser
  → INSERT on notifications table detected
  → loadUnread() called → count updated in sidebar
```

---

## Three Supabase Clients

This is the most critical architectural distinction. Using the wrong client causes security issues or failures.

| Client | File | Key Used | When To Use |
|---|---|---|---|
| Browser Client | `lib/supabase/client.ts` | ANON key | Client components with `"use client"` |
| Server Client | `lib/supabase/server.ts` | ANON key + cookie session | Server components, layouts, middleware |
| Admin Client | `lib/supabase/admin.ts` | SERVICE ROLE key | API routes only (`/api/*`) |

**Rules:**
- The Admin Client MUST NEVER be imported in client components or used in pages
- The Browser Client MUST NEVER be used in server components (no cookie session)
- The Server Client MUST NEVER be used in API routes that need to bypass RLS

---

## Hosting & DNS

```
User types: crm.technopanel.com.sa
    ↓
Cloudflare DNS (grey cloud — DNS only, no proxy)
    ↓ CNAME → cname.vercel-dns.com
    ↓
Vercel Edge Network
    ↓
Next.js App (Vercel deployment)
```

**Cloudflare is in grey-cloud (DNS-only) mode.** Cloudflare's proxy and WAF are NOT active. Vercel handles SSL/TLS termination directly.

---

## Deployment Pipeline

```
Developer edits code in GitHub web editor
    ↓
Commit to main branch
    ↓
Vercel webhook triggered (auto-deploy on push to main)
    ↓
Vercel runs: npm run build (next build)
    ↓
If build succeeds → deploy to production
If build fails → Vercel error log → developer fixes
    ↓
Site live at crm.technopanel.com.sa
```

**There is no staging environment.** All deployments go directly to production. There is no CI/CD test suite.

---

## Technology Stack Summary

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 14.2.5 |
| Language | TypeScript | 5.x (strict mode) |
| Styling | Tailwind CSS | 3.4.1 |
| Database | PostgreSQL (Supabase) | Latest |
| Auth | Supabase Auth | Latest |
| ORM/Client | @supabase/supabase-js | ^2.45.0 |
| SSR Auth | @supabase/ssr | ^0.5.1 |
| Date Utils | date-fns | ^3.6.0 |
| Icons | Inline SVG (no library) | — |
| Utilities | clsx, lucide-react | latest |
| Hosting | Vercel | Latest |
| DNS | Cloudflare | — |

---

## Infrastructure Details

| Item | Value |
|---|---|
| GitHub Repo | github.com/technopanel-systems/facet-crm |
| Branch Strategy | Single branch: main |
| Vercel Project | Auto-deploy from main |
| Supabase URL | https://qndpfbmniqxkegzmzcmh.supabase.co |
| Supabase Region | Middle East — Bahrain (me-south-1) |
| Live URL | crm.technopanel.com.sa |
