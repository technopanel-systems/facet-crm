# 01. Deployment — FACET CRM

## Deployment Architecture

```
GitHub (main branch) → Vercel (auto-deploy) → crm.technopanel.com.sa
```

Every push to the `main` branch triggers an automatic Vercel deployment. There is no staging environment and no manual deployment step.

---

## How to Deploy a Change

1. Make code changes in GitHub web editor (or local environment)
2. Commit directly to `main` branch
3. Vercel webhook fires automatically
4. Vercel runs: `npm install` → `npm run build` (next build)
5. If build succeeds → deployed to production in ~1–2 minutes
6. If build fails → Vercel shows build log → fix the error → recommit

**Build command:** `next build`  
**Output directory:** `.next` (handled by Vercel automatically)  
**Node version:** Compatible with Next.js 14.2.5 (Node 18+)

---

## Making Database Changes

Database changes are NOT part of the code deployment. They must be done separately:

1. Open Supabase Dashboard → SQL Editor
2. Write and test the SQL (SELECT/ALTER/CREATE statements)
3. Execute manually
4. Verify the change worked
5. Update `schema.sql` in the repo if it's a significant schema change (optional but recommended)

**There are no migration files.** All schema changes are ad-hoc via SQL Editor.

**Warning:** Production Supabase is the only environment. There is no staging database. Test SQL carefully before running.

---

## Environment Variables

All environment variables must be set in Vercel dashboard for all three scopes:
- Production
- Preview  
- Development

See `09_OPERATIONS/02_ENVIRONMENT_VARIABLES.md` for the full list.

If a variable is missing in Vercel:
1. Go to Vercel → Project → Settings → Environment Variables
2. Add the variable for all three scopes
3. **Redeploy** the application (changes to env vars don't auto-deploy)

---

## Rollback Procedure

Vercel keeps deployment history. To rollback:

1. Go to Vercel Dashboard → Deployments
2. Find the last working deployment
3. Click the three-dot menu → "Promote to Production"
4. Production instantly rolls back to that deployment

Database changes cannot be rolled back through Vercel. Database rollbacks require manual SQL.

---

## Build Failure Diagnosis

When a build fails:
1. Vercel shows the full build log
2. Most common failures are TypeScript errors
3. Copy the error message and fix in the relevant file
4. Commit the fix → auto-redeploy

**Common TypeScript build errors in this project:**
- Supabase nested select type mismatches → use `any` + `as unknown as Type[]`
- Missing props on components → add required props
- Module not found → check import paths use `@/` alias correctly

---

## DNS Configuration

| Setting | Value |
|---|---|
| DNS Provider | Cloudflare |
| Record Type | CNAME |
| Name | crm |
| Target | cname.vercel-dns.com |
| Proxy | Off (grey cloud — DNS only) |

Cloudflare is NOT proxying traffic. SSL/TLS is handled entirely by Vercel. If SSL issues occur, check Vercel's SSL certificate status, not Cloudflare.

---

## Monitoring

**Current monitoring: None.**

There is no error tracking (Sentry not installed), no uptime monitoring, no performance monitoring. Failures are discovered when users report them.

Recommended next steps:
1. Install Sentry (free tier): `npm install @sentry/nextjs` + follow Sentry Next.js wizard
2. Add Vercel Analytics (built into Vercel dashboard — enable for free)
3. Set up Vercel deployment notifications (email on build failure)
