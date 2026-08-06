# 02. Security Audit — FACET CRM

## Security Architecture

### Authentication
- Supabase Auth with email/password (JWTs)
- Email domain restricted to @technopanel.com.sa (server + client enforced)
- Sessions managed via HTTP-only cookies (XSS resistant)
- No OAuth providers (reduced attack surface)

### Authorization
- RLS enforced at PostgreSQL level (cannot be bypassed by client code)
- Three-tier client separation (browser / server / admin)
- Role-based access via `current_user_role()` helper function
- Junction-table-based data isolation (no shared_with text column)

### Data Isolation
- Reps can only see their own companies (via company_reps)
- Reps can only see their own projects (via project_reps)
- Reps can only see their own activities (rep_id = current_rep_id())
- Even on shared entities, reps cannot see other reps' activities or notes

---

## Known Security Issues

### HIGH — Anon Key Exposure
**Status:** Unresolved (pending rotation confirmation)  
**Description:** The Supabase anon key was included in AI session context documents (FACET_CRM_CONTEXT.md) across multiple sessions with both Claude and Gemini. The key has been shared with external AI systems.  
**Impact:** The anon key is technically public (it's safe to expose in browser JS), but having it in AI training contexts could theoretically allow reconstruction of the project structure.  
**Mitigation:** Rotate the key in Supabase → Settings → API. Update Vercel env vars. Brief user disruption (re-login required).

### MEDIUM — Service Role Key in Vercel Only
**Status:** Correctly handled  
**Description:** `SUPABASE_SERVICE_ROLE_KEY` is server-only, stored in Vercel. It is never committed to the repository.  
**Risk:** If Vercel account is compromised, the service role key could be extracted.  
**Mitigation:** Enable Vercel 2FA. Limit team access to Vercel project.

### LOW — Open Notification INSERT Policy
**Status:** Intentional design  
**Description:** `notifications` table has `WITH CHECK (true)` on INSERT policy. Any authenticated user can insert a notification for any recipient.  
**Impact:** A malicious rep could send fake notifications to other users.  
**Mitigation:** At current team size (< 15 known users), this risk is acceptable. Future fix: restrict INSERT to trigger-based inserts only (SECURITY DEFINER functions).

### LOW — Realtime Subscription Not Filtered by Recipient
**Status:** Known, low priority  
**Description:** The Sidebar realtime subscription listens to ALL inserts on the notifications table. Each INSERT (for any user) causes all connected users to re-fetch their notification count.  
**Impact:** Minor performance overhead at scale. No data exposure (fetch is filtered by RLS).  
**Mitigation:** Add `.filter('recipient_id', 'eq', currentRepId)` to the subscription channel.

### LOW — duplicate notifications_manager Policy
**Status:** Harmless  
**Description:** Two identical manager policies exist on `project_history` (history_manager and project_history_manager). PostgreSQL evaluates PERMISSIVE policies with OR logic — duplicates are ignored.  
**Fix:** `DROP POLICY "project_history_manager" ON project_history;`

### INFO — No CSRF Protection on API Routes
**Status:** Acceptable  
**Description:** Next.js API routes don't have explicit CSRF tokens.  
**Mitigation:** Supabase session cookies are HTTP-only and SameSite. The email domain check prevents unauthorized registrations. Risk is minimal for an internal tool.

---

## What Is Correctly Secured

- ✅ RLS on all tables
- ✅ Admin client never exposed to browser
- ✅ Service role key never in git
- ✅ Email domain enforcement (server + client)
- ✅ Rep data isolation via junction tables
- ✅ Activity isolation (reps cannot see other reps' activities on shared entities)
- ✅ Coordinator cannot create reps or delete entities
- ✅ Only manager/super_admin can delete companies, projects, contacts

---

## Security Recommendations

1. **Rotate anon key** (immediate)
2. **Enable Vercel 2FA** for all team members with Vercel access
3. **Add Sentry** for error monitoring (catch data exposure errors)
4. **Restrict notification INSERT** to SECURITY DEFINER functions only
5. **Add realtime filter** to sidebar notification subscription
6. **Create staging environment** to test changes before production
