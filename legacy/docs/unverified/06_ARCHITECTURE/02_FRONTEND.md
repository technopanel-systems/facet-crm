# 02. Frontend Architecture — FACET CRM

## Framework: Next.js 14 App Router

The application uses the Next.js App Router (not Pages Router). All routing is file-system based under `app/`.

---

## Route Structure

```
app/
├── layout.tsx                    Root layout (html, body, metadata)
├── page.tsx                      Role-based redirect (→ /dashboard or /rep)
├── globals.css                   Tailwind + custom component classes
├── login/page.tsx                Public login page
├── register/page.tsx             Public self-registration page
├── pending/page.tsx              Pending approval screen
├── api/
│   └── auth/
│       ├── callback/route.ts     Supabase OAuth callback
│       └── register/route.ts    User registration API (admin client)
├── dashboard/                    manager | sales_coordinator | super_admin
│   ├── layout.tsx                Auth guard + role check + Sidebar
│   ├── page.tsx                  KPI dashboard (server component)
│   ├── team/page.tsx             Team, holidays, absences management
│   ├── performance/page.tsx      Rep KPI overview + drill-down
│   ├── followups/page.tsx        Overdue project follow-up dates
│   ├── import/page.tsx           Bulk CSV company import
│   ├── companies/
│   │   ├── page.tsx              Company list, filter, add
│   │   └── [id]/page.tsx         Company detail, contacts, projects, reps
│   ├── projects/
│   │   ├── page.tsx              Project list, stage inline update
│   │   └── [id]/page.tsx         Project detail + history timeline
│   ├── activities/page.tsx       Full activity log, CSV export
│   ├── quotations/page.tsx       Coordinator quotation management
│   ├── duplicates/page.tsx       Duplicate detection and classification
│   └── notifications/page.tsx   Notification list
└── rep/                          rep | marketing
    ├── layout.tsx                Auth guard + role check + Sidebar
    ├── page.tsx                  Daily report form
    ├── companies/
    │   ├── page.tsx              Own companies list
    │   └── [id]/page.tsx         Company detail (contacts + projects)
    ├── projects/page.tsx         Own projects, history modal
    ├── quotations/page.tsx       Read-only quotation view
    ├── stats/page.tsx            Personal KPIs and breakdowns
    ├── history/page.tsx          Monthly activity archive
    └── notifications/page.tsx   Notification list
```

---

## Server vs Client Components

### Server Components (no "use client")
Used for initial data fetching where SEO or performance matters, and for layout auth guards.

- `app/dashboard/page.tsx` — KPI dashboard (fetches all data server-side)
- `app/dashboard/layout.tsx` — Role check, Sidebar render
- `app/rep/layout.tsx` — Role check, Sidebar render
- `app/page.tsx` — Role-based redirect
- `app/pending/page.tsx` — Status check and redirect

### Client Components ("use client")
Used for all interactive pages — forms, modals, dropdowns, real-time updates.

All pages under `/dashboard/*` (except layout and main dashboard page) and all pages under `/rep/*` are client components.

---

## Styling System

### Tailwind CSS with Custom Brand Tokens

```typescript
// tailwind.config.ts
colors: {
  brand: {
    navy:  "#0F1923",  // Sidebar background
    blue:  "#185FA5",  // Primary actions, progress bars
    light: "#E6F1FB",  // Hover states, highlights
    green: "#0F6E56",  // Success states
    amber: "#BA7517",  // Warning states
  }
}
```

### Custom CSS Component Classes (globals.css)
These classes must be used consistently throughout the app:

| Class | Usage |
|---|---|
| `.btn-primary` | Blue filled button (primary actions) |
| `.btn-secondary` | White outlined button (secondary actions) |
| `.input` | Standard form input field |
| `.label` | Form field label (uppercase, small, semibold) |
| `.card` | White rounded card with border and shadow |
| `.stat-card` | KPI card (card + padding) |
| `.badge-on-time` | Green badge for on-time status |
| `.badge-late` | Amber badge for late status |
| `.badge-missing` | Red badge for missing status |

### No External Component Library
There is no Shadcn, MUI, Ant Design, or any other component library. All components are built with pure Tailwind.

---

## Sidebar Navigation

File: `components/Sidebar.tsx`

The sidebar renders different navigation items based on role:

| Role | Nav Items |
|---|---|
| manager | Dashboard, Companies, Projects, Activities, Performance, Follow-ups, Quotations, Team, Import, Duplicates, Notifications |
| sales_coordinator | Companies, Projects, Quotations, Notifications |
| rep | Daily Report, My Companies, My Projects, My Stats, My Quotations, History, Notifications |
| marketing | Daily Report, My Companies, My Projects, Quotations, History |
| super_admin | Same as manager |

**Notification Bell:** Shows unread count badge. Updated via Supabase Realtime subscription on notifications table INSERT. Count fetched per-user by querying `notifications WHERE is_read = false AND recipient_id = current_user_id`.

---

## TypeScript Patterns

### Critical: Supabase Nested Select Returns Arrays

When using `.select()` with joined tables, Supabase returns joined rows as arrays even for one-to-one relationships. TypeScript typing must reflect this.

```typescript
// CORRECT type definition
type Project = {
  companies: any;              // NOT: { company_name: string } | null
  project_reps: { role: string; reps: any }[];
};

// CORRECT setState
setProjects((data ?? []) as unknown as Project[]);

// CORRECT rendering (handles both array and object)
const companyName = Array.isArray(project.companies)
  ? project.companies[0]?.company_name
  : project.companies?.company_name;
```

### Critical: Ambiguous FK Joins Crash Silently

When a table has multiple FK columns pointing to the same table, PostgREST silently returns empty data for joined selects.

```typescript
// THIS WILL SILENTLY FAIL on quotations (has rep_id, coordinator_id, assigned_to_id):
const { data } = await supabase.from('quotations').select('*, reps(name)');

// CORRECT: Load reps separately, look up client-side
const repName = allReps.find(r => r.id === q.rep_id)?.name ?? '—';
```

### Critical: Promise.resolve() Wrapper for Query Arrays

When pushing Supabase queries into a `Promise[]` array, wrap them:

```typescript
const loaders: Promise<void>[] = [];
loaders.push(
  Promise.resolve(
    supabase.from('projects').select('...').eq('customer_id', id)
  ).then(({ data }) => { setProjects(data ?? []); })
);
await Promise.all(loaders);
```

---

## Font

Inter (Google Fonts) loaded via CSS import in `globals.css`. Fallback: system-ui, sans-serif.

Arabic text uses `direction: rtl` and system Arabic fonts (`Segoe UI`, `Tahoma`) via the `.arabic` CSS class. Full RTL layout is not yet implemented.
