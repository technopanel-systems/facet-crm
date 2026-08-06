# AI Developer Context — FACET CRM
> Code patterns, critical pitfalls, and development conventions for AI agents.

---

## Stack Reference

```
Next.js 14.2.5    App Router (NOT Pages Router)
TypeScript        strict mode
Tailwind CSS      3.4.1 with custom brand tokens
Supabase JS       ^2.45.0
Supabase SSR      ^0.5.1
date-fns          ^3.6.0
clsx              ^2.1.1
lucide-react      ^0.400.0 (used minimally — most icons are inline SVG)
```

No UI component library. No Prisma. No Redux. No React Query.

---

## CRITICAL PITFALL #1: Supabase Nested Selects Return Arrays

When you use `.select('*, companies(company_name)')`, Supabase returns `companies` as an array `[{company_name: '...'}]`, not as an object `{company_name: '...'}`.

**Type definition pattern:**
```typescript
type Project = {
  id: string;
  project_name: string | null;
  companies: any;           // ← use `any`, not { company_name: string }
  project_reps: { role: string; reps: any }[];
};
```

**setState pattern:**
```typescript
setProjects((data ?? []) as unknown as Project[]);
```

**Rendering pattern:**
```typescript
const companyName = Array.isArray(p.companies)
  ? p.companies[0]?.company_name
  : p.companies?.company_name;
```

Apply this pattern to EVERY joined field on EVERY page. Failure to do so causes TypeScript build errors.

---

## CRITICAL PITFALL #2: Ambiguous FK Joins Silently Return Empty Data

When a table has multiple foreign keys pointing to the same parent table, PostgREST cannot resolve the join and silently returns null/empty data. No error is thrown.

**The `quotations` table has THREE FKs to `reps`:**
- `rep_id`
- `coordinator_id`  
- `assigned_to_id`

**This WILL SILENTLY FAIL:**
```typescript
supabase.from('quotations').select('*, reps(name)')  // ← crashes silently
```

**ALWAYS do this instead:**
```typescript
// 1. Load reps separately
const { data: allReps } = await supabase.from('reps').select('id, name');

// 2. Look up client-side
const repName = allReps.find(r => r.id === q.rep_id)?.name ?? '—';
```

Check for multiple FKs to the same table before writing any joined select.

---

## CRITICAL PITFALL #3: Wrong Supabase Client

Three clients exist. Each has a specific use case.

```
lib/supabase/client.ts   → "use client" components ONLY
lib/supabase/server.ts   → Server components, layouts, middleware ONLY
lib/supabase/admin.ts    → /api/* routes ONLY (service role key)
```

Importing `admin.ts` in a client component exposes the service role key.  
Importing `client.ts` in a server component loses the user session.

---

## CRITICAL PITFALL #4: Middleware Cookie Passthrough

When redirecting in middleware, you MUST copy Supabase cookies to the redirect response. Without this, users get infinite redirect loops.

```typescript
// WRONG — loses session cookies:
return NextResponse.redirect(url);

// CORRECT — preserves cookies:
const redirectResponse = NextResponse.redirect(url);
supabaseResponse.cookies.getAll().forEach((cookie) => {
  redirectResponse.cookies.set(cookie.name, cookie.value);
});
return redirectResponse;
```

Do not change this pattern in `middleware.ts`.

---

## CRITICAL PITFALL #5: Promise Array with Supabase Queries

Supabase queries return a `PromiseLike`, not a native `Promise`. When pushing to a `Promise[]` array, wrap with `Promise.resolve()`:

```typescript
const loaders: Promise<void>[] = [];

// WRONG — TypeScript error:
loaders.push(supabase.from('projects').select('...').then(({ data }) => {}));

// CORRECT:
loaders.push(
  Promise.resolve(
    supabase.from('projects').select('...').eq('id', id)
  ).then(({ data }) => { setProjects(data ?? []); })
);

await Promise.all(loaders);
```

---

## CRITICAL PITFALL #6: Never Two Separate Inserts for Entity + Junction

Creating a company or project with two separate INSERT calls risks leaving the record invisible to the rep if the second insert fails.

```typescript
// WRONG:
await supabase.from('projects').insert({...});
await supabase.from('project_reps').insert({...});  // If this fails, project is orphaned

// CORRECT:
await supabase.rpc('create_project_with_rep', { p_customer_id, p_project_name, ... });
```

Always use RPCs for atomic operations.

---

## Development Conventions

### File Naming
- Pages: `app/[section]/[subsection]/page.tsx`
- All interactive pages use `"use client"` at the top
- Server components (layouts, main dashboard) have NO `"use client"`

### Component Structure Pattern
All client component pages follow this structure:
```typescript
"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Type definitions at top of file
type Company = { id: string; company_name: string; ... };

export default function PageName() {
  const supabase = createClient();
  const [data, setData] = useState<Type[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('table').select('...');
    setData((data ?? []) as unknown as Type[]);
    setLoading(false);
  }

  // Event handlers...
  // Return JSX...
}
```

### CSS Classes
Always use custom classes for consistency:
```
.btn-primary     primary blue button
.btn-secondary   white outlined button
.input           standard input field
.label           form field label
.card            white rounded card
.stat-card       KPI card with padding
```

Never use raw Tailwind for buttons or inputs — always use these classes.

### Modal Pattern
All modals use the same pattern:
```tsx
{showModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Title</h2>
        <button onClick={() => setShowModal(false)}>×</button>
      </div>
      <div className="px-6 py-5 space-y-4">
        {/* form content */}
      </div>
      <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
        <button className="btn-secondary">Cancel</button>
        <button className="btn-primary">Save</button>
      </div>
    </div>
  </div>
)}
```

### Brand Colors
```typescript
brand-navy:  #0F1923  // sidebar
brand-blue:  #185FA5  // primary actions
brand-light: #E6F1FB  // hover/highlight
brand-green: #0F6E56  // success
brand-amber: #BA7517  // warning
```

---

## Working With the Database

### Query Pattern (Client Component)
```typescript
const supabase = createClient(); // from lib/supabase/client.ts

// Get current user's rep ID
const { data: { user } } = await supabase.auth.getUser();
const { data: rep } = await supabase.from('reps')
  .select('id, name, role')
  .eq('auth_user_id', user.id)
  .single();
```

### RPC Call Pattern
```typescript
const { data, error } = await supabase.rpc('function_name', {
  param_1: value1,
  param_2: value2,
});
if (error) { setError(error.message); return; }
```

### Filtering by Role in Queries
When loading reps for dropdowns (rep assignment, etc.):
```typescript
supabase.from('reps')
  .select('id, name')
  .in('role', ['rep', 'marketing'])
  .eq('status', 'active')
  .order('name')
```

---

## Founder's Working Style

Jerom (the founder) works via GitHub web editor. He edits files directly in the browser and commits to main.

**Code delivery format:**
- Always provide **complete file replacements**, not partial diffs
- State the exact file path
- One file at a time when making multiple changes
- No assumptions that he has local Node.js — he may not

**When generating SQL:**
- Write it as a standalone block ready to paste into Supabase SQL Editor
- Include `IF NOT EXISTS` and `IF EXISTS` guards
- Never assume a migration file system is in place

**No premature abstraction:**
- This is a small internal team (< 15 users)
- Don't suggest microservices, Docker, complex CI/CD
- Keep it simple and functional

---

## Common Mistakes Made By AI Agents on This Project

1. **Joining `reps(name)` from quotations** — Silent failure. Never do it.
2. **Using `from("customers")`** — Table is named `companies`. Always.
3. **Two-step insert for company/project** — Must use RPC.
4. **Adding `shared_with` column** — The architecture is junction tables.
5. **Missing `marketing` in role checks** — Both `rep` AND `marketing` access `/rep` route.
6. **Treating `activities.sqm_done` as the KPI** — It's a leading indicator only.
7. **Writing `if (role === 'manager')` without `super_admin`** — Always check both.
8. **Forgetting Friday/Saturday** in any scheduling or compliance logic.
9. **Using server client in client components** — Causes session issues.
10. **Generating diffs instead of complete files** — Founder edits in GitHub web UI.
