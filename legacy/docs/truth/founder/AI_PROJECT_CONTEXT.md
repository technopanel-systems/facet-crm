# AI Project Context — FACET CRM
> READ THIS FIRST. This file gives an AI agent everything needed to understand and continue development.

---

## What This Project Is

FACET CRM is a **custom internal sales operations system** for Technopanel, a Saudi ACP (aluminum composite panel) cladding supplier. It is not a SaaS product. It has ~15 users. It runs at crm.technopanel.com.sa.

**Stack:** Next.js 14 (App Router), TypeScript strict, Tailwind CSS, Supabase (PostgreSQL + Auth + RLS), Vercel.

**Repo:** github.com/technopanel-systems/facet-crm  
**DB:** https://qndpfbmniqxkegzmzcmh.supabase.co (Bahrain, me-south-1)

---

## The Five Roles

| Role | Route | Description |
|---|---|---|
| `rep` | `/rep` | Field sales. Owns companies/projects/activities via junction tables. |
| `marketing` | `/rep` | Like rep. Registers leads. |
| `sales_coordinator` | `/dashboard` | Creates quotations. Reads all companies/projects. |
| `manager` | `/dashboard` | Full access. Approves accounts. Sets targets. |
| `super_admin` | `/dashboard` | Same as manager. Cannot be role-changed via UI. Jerom Youssef. |

---

## The Data Spine

```
Company → Project → Quotation (+ Items + Services) → Invoice (planned)
                 ↘ Activity (daily rep reports)
```

Every commercial measurement traces back to this spine. The `project` is the unit of measurement.

---

## Three Supabase Clients — Critical

| File | Key | Use |
|---|---|---|
| `lib/supabase/client.ts` | ANON | `"use client"` components ONLY |
| `lib/supabase/server.ts` | ANON + cookie session | Server components, layouts |
| `lib/supabase/admin.ts` | SERVICE ROLE | API routes (`/api/*`) ONLY |

**Using the wrong client is the most common source of bugs.**

---

## The Junction Table Architecture

Rep access to companies and projects is controlled exclusively by two junction tables:

- `company_reps` — links reps to companies
- `project_reps` — links reps to projects

**There is no `shared_with` text column anywhere in the system. Never add one.**

All rep CREATE operations must go through SECURITY DEFINER RPCs:
- `create_company_with_rep()` — atomic company + company_reps insert
- `create_project_with_rep()` — atomic project + project_reps insert

Never use two separate INSERT statements for these — if the second fails, the record becomes invisible to the rep.

---

## The Two SQM Numbers (Never Confuse Them)

| Field | Source | Meaning |
|---|---|---|
| `activities.sqm_done` | Rep | Field estimate. Leading indicator. NOT the KPI. |
| `quotations.sqm_invoiced` | Coordinator | ERP-confirmed. The actual commercial KPI. |

**Never add these together. Never treat them as the same thing.**

---

## Saudi Business Rules

- **Weekend:** Friday (DOW=5) and Saturday (DOW=6) — never mark as late
- **Timezone:** Asia/Riyadh (UTC+3) for all compliance calculations
- **Email domain:** @technopanel.com.sa — enforced server-side
- **Arabic normalization:** Applied to company names for duplicate detection

---

## Current File Structure

```
app/
  layout.tsx, page.tsx, globals.css
  login/page.tsx, register/page.tsx, pending/page.tsx
  api/auth/callback/route.ts, register/route.ts
  dashboard/
    layout.tsx, page.tsx (server component — KPI dashboard)
    team/, performance/, followups/, import/
    companies/[id]/, projects/[id]/
    activities/, quotations/, duplicates/, notifications/
  rep/
    layout.tsx, page.tsx (daily report)
    companies/[id]/, projects/, quotations/
    stats/, history/, notifications/
components/Sidebar.tsx
lib/supabase/client.ts, server.ts, admin.ts
middleware.ts
```

---

## Active Users

| Name | Email | Role |
|---|---|---|
| Jerom Youssef | jerom@technopanel.com.sa | super_admin |
| Ahmed Alzaben | a.alzaben@technopanel.com.sa | rep |
| Christina Refaat | (coordinator email unknown) | sales_coordinator |

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL         — public
NEXT_PUBLIC_SUPABASE_ANON_KEY    — public (rotate if exposed)
SUPABASE_SERVICE_ROLE_KEY        — server only, never in client code
```

All set in Vercel for Production + Preview + Development.

---

## Known Outstanding Issues

1. Anon key may need rotation (was in AI session documents)
2. `notify_duplicate_flag` trigger notifies `role='manager'` only — misses super_admin
3. `activities` RLS policies missing `marketing` role on insert/read
4. No staging environment
5. No Sentry error monitoring
6. `schema.sql` in repo is not authoritative — production DB is

---

## Where to Find Full Documentation

This file is a summary. Full documentation lives in `/docs/`:

- Business rules → `02_BUSINESS_RULES/`
- Database tables → `05_DATABASE/02_TABLES.md`
- RLS policies (verified) → `05_DATABASE/04_RLS_POLICIES.md`
- All functions → `05_DATABASE/05_FUNCTIONS.md`
- TypeScript patterns → `06_ARCHITECTURE/02_FRONTEND.md`
- Roadmap → `11_ROADMAP/`
- Technical debt → `10_QUALITY/03_TECHNICAL_DEBT.md`
