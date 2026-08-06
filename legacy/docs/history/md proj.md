# FACET CRM — Complete Project Context Export
> Generated for AI continuity. Paste this entire file at the start of any new session.
> Then say: **"Context loaded, continue from [section name or task]"**

---

# Project Overview

## What the Project Is
FACET CRM is a custom-built Customer Relationship Management system developed specifically for **Technopanel**, a company that supplies Aluminum Composite Panels (ACP / cladding materials) in Saudi Arabia and the broader GCC region.

## Business Goals
- Replace a fragile Google Sheets-based CRM that suffered from bidirectional sync issues and n8n token limits
- Provide clean, structured data for MBA-grade KPIs and analytics
- Enable sales team accountability through daily activity reporting
- Support future n8n + AI automation pipelines via clean Supabase REST API
- Centralize customer/project/quotation data across a distributed sales team

## Core Purpose
An **operational sales control system** — not an ERP, not a finance system, not an engineering platform. Purely sales-focused with scalable architecture for future expansion.

## Current Status 
**Fully operational Phase 1 + Phase 2 + Phase 3 CRM.** All core modules are built and deployed:
- Auth system (login, register, pending approval, role guards)
- Companies + Contacts module
- Projects module (atomic creation via RPC)
- Daily Report (dropdown-based, linked to structured entities)
- Activities log with CSV export
- Quotations module (coordinator entry + rep read-only view)
- Rep History page
- Rep Stats page (activities + quotations combined)
- Manager Dashboard (KPIs, pipeline, stale projects, branch filter)
- Team management
- Duplicates detection and classification
- In-app notifications with auto-triggers

## Intended Users
| Role | Description |
|---|---|
| `rep` | Sales representatives. Own companies/contacts/projects/activities. See only their own data. |
| `manager` | Full visibility + approval authority over everything. |
| `sales_coordinator` | Enters quotation records. Sees all companies/projects (read). Cannot see rep activity details. |
| `marketing` | Basically a rep + can register leads. Manager assigns or keeps with marketing user. |

## Long-Term Vision
- Phase 4: Advanced analytics, rep performance scoring, pipeline forecasting
- Phase 5: n8n automation (daily report reminders, stale alerts, weekly digest)
- Phase 6: WhatsApp Business API integration via n8n
- Phase 7: ERP integration (quotation/invoice mirroring)
- Phase 8: AI lead scoring and next-action suggestions
- Architecture is intentionally kept expandable — no premature ERP features

---

# Founder / User Context

## Technical Level
**Beginner to intermediate.** The founder/user:
- Built the initial system by following step-by-step AI guidance
- Uses GitHub web interface (not local git CLI primarily)
- Uses Supabase SQL Editor for database operations
- Uses Vercel for deployment (auto-deploy on push to main)
- Is NOT a developer by training — learned by doing with AI assistance
- Can follow precise instructions but gets confused by ambiguous or multi-step edits without clear file paths

## Working Style
- Prefers **step-by-step operational guidance**: "open this file → find this line → replace with this"
- Prefers **complete file replacements** over partial edits when confused
- Works across multiple AI sessions (Claude, Gemini) due to token/free-tier limits
- Saves context between sessions using a `.md` context file pasted at session start
- Does NOT have a local development environment set up (all editing in GitHub web UI or copy-paste from AI)
- Commits directly to `main` branch — no staging/branching workflow currently

## Constraints
- Free tier limits on Claude (hits token/message limits mid-session)
- Switches to Gemini when Claude hits limits, then returns to Claude
- No local Node.js development environment confirmed
- All database changes done manually via Supabase SQL Editor
- Budget-conscious — free tiers wherever possible

## Available Tools/Services
- GitHub (github.com/technopanel-systems/facet-crm)
- Vercel (auto-deploy)
- Supabase (PostgreSQL + Auth + RLS)
- Claude (Anthropic) — primary AI coding assistant
- Gemini (Google) — secondary AI when Claude hits limits
- Cloudflare (DNS management)

## Pain Points
- Token/context limits force session breaks mid-build
- TypeScript type errors from Supabase joined table responses (recurring `as unknown as Type[]` pattern)
- Redirect loops caused by cookie/session conflicts after deployments
- Confusion when AI gives partial edits without showing full context
- Risk of losing context between AI sessions

## Preferences
- Minimal but clear explanations
- Code always presented as complete files, not snippets when possible
- Errors explained with exact file + line reference
- One task at a time, confirmed working before moving to next

---

# Current Tech Stack

## Frontend
- **Framework:** Next.js 14.2.5 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS 3.4.1 with custom brand tokens
- **UI Components:** Custom (no component library) — card, input, label, btn-primary, btn-secondary, badge-* classes defined in `globals.css`
- **Icons:** Inline SVG paths (no icon library)
- **Date handling:** date-fns 3.6.0
- **Other:** clsx 2.1.1, lucide-react 0.400.0

## Backend
- **API Routes:** Next.js App Router API routes (`/api/auth/register`, `/api/auth/callback`)
- **Server Components:** Used for dashboard and layout data fetching
- **Client Components:** Used for all interactive pages (forms, tables, modals)

## Database
- **Provider:** Supabase (PostgreSQL)
- **Region:** Middle East — Bahrain (me-south-1)
- **Auth:** Supabase Auth (email/password, auto-confirmed)
- **RLS:** Enabled on all tables
- **Storage:** Not used currently

## Hosting & Deployment
- **Frontend:** Vercel (auto-deploy on push to `main`)
- **Database:** Supabase cloud
- **DNS:** Cloudflare CNAME → cname.vercel-dns.com (grey cloud, DNS only)
- **Live URL:** crm.technopanel.com.sa

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL        → public, browser-safe
NEXT_PUBLIC_SUPABASE_ANON_KEY   → public, browser-safe
SUPABASE_SERVICE_ROLE_KEY       → server only, used in /api routes
```
All set in Vercel for all 3 scopes: Production + Preview + Development.

## Git Workflow
- Repository: `github.com/technopanel-systems/facet-crm`
- Single branch: `main`
- No PR/review workflow
- Commits directly from GitHub web UI or `git push` after copying files
- Auto-deploy triggers on every push to `main`

## Authentication
- Supabase Auth with email/password
- Email auto-confirmed on registration (manager approves via `status` field, not email)
- Company email domain enforced: must end in `@technopanel.com.sa`
- Session managed via Supabase SSR cookies
- Middleware guards all routes except `/login`, `/register`, `/auth`, `/pending`

---

# Infrastructure Architecture

## System Communication
```
Browser → Next.js (Vercel) → Supabase (PostgreSQL)
                           ↗ (server components, API routes use service role key)
Browser → Supabase directly (client components use anon key + RLS)
```

## Supabase Clients (Three Types)
| Client | File | Used For |
|---|---|---|
| Browser client | `lib/supabase/client.ts` | Client components, real-time |
| Server client | `lib/supabase/server.ts` | Server components, layouts |
| Admin client | `lib/supabase/admin.ts` | API routes only, bypasses RLS |

## Deployment Flow
1. AI generates code → user copies into GitHub web editor
2. User commits to `main`
3. Vercel detects push → runs `npm run build`
4. If build passes → auto-deploys to production
5. If build fails → Vercel shows error log → user pastes to AI for fix

## Dev Workflow (Current Reality)
- No local development environment
- AI writes code → user pastes into GitHub → Vercel builds → test on live site
- Database changes: user pastes SQL into Supabase SQL Editor → runs manually
- No migration files — all schema changes done ad-hoc in SQL Editor

---

# Database Architecture

## Supabase Project
- URL: `https://qndpfbmniqxkegzmzcmh.supabase.co`
- Anon Key: `sb_publishable_8SZSJn-Dek5nJ9PYJC9Tlw_I41kt2XU`

## Tables (Final Schema)

### `reps`
```sql
id uuid PK | name text | email text unique
role text CHECK (role in ('rep','manager','sales_coordinator','marketing'))
status text CHECK (status in ('active','inactive','pending'))
monthly_target_sqm numeric | auth_user_id uuid unique
branch_id uuid → branches.id | language_pref text default 'en'
created_at timestamptz
```

### `branches`
```sql
id uuid PK | name text | region text
CHECK (region in ('Central','West','East','North','South'))
is_active boolean default true | created_at timestamptz
```
Seeded: Riyadh (Central), Eastern Branch (East), Southern Branch (South)

### `companies` (renamed from `customers`)
```sql
id uuid PK | customer_code text unique (auto: CUST-00001)
company_name text | company_name_normalized text (auto trigger)
company_type text CHECK (see dropdown list below)
region text | source text | primary_rep_id uuid → reps.id
status text CHECK ('active','inactive','blocked')
branch_id uuid → branches.id
notes text | created_at | updated_at
```
**Note:** `shared_with text` column was DROPPED. Replaced by `company_reps` junction table.
**Note:** `primary_rep_id` kept as a quick-lookup cache alongside junction table.

### `company_reps` (junction table)
```sql
id uuid PK | company_id uuid → companies.id (cascade)
rep_id uuid → reps.id (cascade)
role text CHECK ('primary','shared')
assigned_by uuid → reps.id | assigned_at timestamptz
UNIQUE(company_id, rep_id)
```

### `contacts`
```sql
id uuid PK | contact_code text unique (auto: CON-00001)
company_id uuid → companies.id (cascade)
full_name text | full_name_ar text | title text
phone text | whatsapp text | email text
is_primary boolean default false
notes text | created_by uuid → reps.id
created_at | updated_at
```

### `projects`
```sql
id uuid PK | project_code text unique (auto: PROJ-00001)
customer_id uuid → companies.id
company_name text (legacy, populated via trigger/RPC)
project_name text | city text
stage text CHECK (see dropdown list below)
quoted_sqm numeric | won_sqm numeric
assigned_rep_id uuid → reps.id (legacy cache)
contact_id uuid → contacts.id
stage_changed_at timestamptz
next_follow_up date | loss_reason text
notes text | created_at | updated_at
```
**Note:** `shared_with` and `sqm_split` DROPPED. Replaced by `project_reps` junction table.

### `project_reps` (junction table)
```sql
id uuid PK | project_id uuid → projects.id (cascade)
rep_id uuid → reps.id (cascade)
role text CHECK ('primary','shared')
sqm_split numeric | assigned_by uuid → reps.id
assigned_at timestamptz
UNIQUE(project_id, rep_id)
```

### `activities`
```sql
id uuid PK | activity_code text unique (auto: ACT-00001)
activity_date date | month text (auto)
rep_id uuid → reps.id | rep_name text (legacy)
company_name text | company_type text | contact_person text
phone text | interaction_type text | project_name text
notes text | region text
sqm_done numeric | sqm_expected numeric
submitted_at timestamptz | submission_status text
company_id uuid → companies.id (nullable)
project_id uuid → projects.id (nullable)
contact_id uuid → contacts.id (nullable)
created_at timestamptz
```

### `quotations`
```sql
id uuid PK | quotation_code text unique (auto: QUO-00001)
project_id uuid → projects.id (cascade)
company_id uuid → companies.id
rep_id uuid → reps.id
coordinator_id uuid → reps.id
product_type text CHECK ('Normal ACP','FR B1 ACP','FR A2 ACP','A2G2 ACP','Other')
finish text CHECK ('Solid Color','Wood Finish','Custom')
sqm_quoted numeric | price_per_sqm numeric
quote_date date | valid_until date
revision_number integer default 1
status text CHECK ('pending','submitted','won','lost','expired','cancelled')
sqm_invoiced numeric default 0
sqm_delivered numeric default 0
notes text | created_at | updated_at
```

### `duplicate_flags`
```sql
id uuid PK | company_id_1 uuid → companies.id (cascade)
company_id_2 uuid → companies.id (cascade)
match_type text CHECK ('phone','name')
match_key text
classification text CHECK ('pending','shared','conflict','resolved')
entity_type text CHECK ('company','contact','project')
entity_id_1 uuid | entity_id_2 uuid
resolved_at timestamptz | resolved_by uuid → reps.id
created_at timestamptz
```

### `notifications`
```sql
id uuid PK | recipient_id uuid → reps.id (cascade)
type text CHECK ('duplicate_alert','pending_approval','assignment',
  'project_stale','quotation_expiry','follow_up_due','lead_submitted','system')
title text | body text
entity_type text CHECK ('company','contact','project','quotation','rep')
entity_id uuid | is_read boolean default false
created_at timestamptz
```

## Views
- `rep_monthly_sqm` — SQM aggregated per rep per month vs target
- `stale_projects` — Projects with no stage update in 14+ days, not Won/Delivered/Lost
- `pipeline_summary` — Project count and total SQM by stage
- `rep_branch_summary` — SQM and activity count per rep per branch for current month

## RPC Functions
- `create_project_with_rep(...)` — Atomically creates a project + inserts into `project_reps` in one transaction. Prevents orphaned projects.
- `current_user_role()` — Returns role for current auth user
- `current_rep_id()` — Returns rep ID for current auth user
- `current_rep_name()` — Returns rep name for current auth user
- `normalize_arabic(input text)` — Normalizes Arabic text for duplicate detection
- `set_customer_code()`, `set_project_code()`, `set_activity_code()`, `set_quotation_code()`, `set_contact_code()` — Auto-code triggers

## DB Triggers (Notification Auto-Triggers)
- `trg_notify_pending_rep` — On new rep INSERT with status=pending → notifies all managers
- `trg_notify_company_assignment` — On new `company_reps` INSERT → notifies assigned rep
- `trg_notify_duplicate` — On new `duplicate_flags` INSERT with pending → notifies managers

## Indexes
```sql
idx_activities_rep_id, idx_activities_date, idx_activities_company_id,
idx_activities_project_id, idx_company_reps_company, idx_company_reps_rep,
idx_project_reps_project, idx_project_reps_rep, idx_contacts_company,
idx_projects_company, idx_projects_stage, idx_quotations_project,
idx_quotations_company, idx_quotations_rep, idx_quotations_status,
idx_notifications_recipient, idx_reps_auth_user
```

## RLS Policy Summary
- **Manager:** Full CRUD on all tables
- **Rep:** Own companies (via company_reps) + own activities + own projects (via project_reps). NEVER sees other reps' activities on shared entities.
- **Sales Coordinator:** Full access to quotations. Read-only on companies and projects.
- **Marketing:** Same as rep + can register companies/leads
- **Notifications:** Each user sees only their own (recipient_id = current_rep_id())
- **Key principle:** `shared_with` string matching COMPLETELY REMOVED. All access via junction tables.

## Dropdown Option Lists (Canonical — Must Stay Consistent)
| Field | Values |
|---|---|
| Company Type | Factory, Advertising, Real Estate, Owner, Consultant, Contractor, Station Management, Workshop, Other |
| Region | Central, West, East, North, South, Foreign |
| Interaction | Visit, Call, WhatsApp, Email, Meeting, Site Visit |
| Project Stage | New Lead, Catalog Sent, Quotation Sent, Under Review, Won, In Production, Delivered, Lost |
| Lead Source | Form, Marketing, Management, Referral, Direct, Exhibition |
| Product Type | Normal ACP, FR B1 ACP, FR A2 ACP, A2G2 ACP, Other |
| Finish | Solid Color, Wood Finish, Custom |
| Quotation Status | pending, submitted, won, lost, expired, cancelled |

## Known Tech Debt
1. `projects.company_name` text column still exists as legacy — should eventually be dropped and always derived via join on `customer_id → companies`
2. `projects.assigned_rep_id` kept as cache alongside `project_reps` junction — redundant but intentional for now
3. `activities.rep_name` text kept for legacy display — should eventually always join `reps` table
4. No formal migration files — all schema changes done ad-hoc in Supabase SQL Editor

---

# File Structure (Complete)

```
facet-crm/
├── app/
│   ├── layout.tsx                          ✅ root layout
│   ├── page.tsx                            ✅ redirects by role/status
│   ├── globals.css                         ✅ Tailwind + custom classes
│   ├── login/page.tsx                      ✅ email+password login
│   ├── register/page.tsx                   ✅ self-registration → POST /api/auth/register
│   ├── pending/page.tsx                    ✅ waiting screen for pending reps
│   ├── api/auth/
│   │   ├── callback/route.ts               ✅ Supabase OAuth callback
│   │   └── register/route.ts              ✅ admin creates auth user + pending rep row
│   ├── dashboard/                          manager + sales_coordinator only
│   │   ├── layout.tsx                      ✅ role check (manager/coordinator only) + Sidebar
│   │   ├── page.tsx                        ✅ full KPI dashboard (branch filter, pipeline SQM, stale projects)
│   │   ├── team/page.tsx                   ✅ rep list, approve/set role/target/status/branch
│   │   ├── companies/
│   │   │   ├── page.tsx                    ✅ list, search, filter, add modal, delete
│   │   │   └── [id]/page.tsx              ✅ detail: edit, contacts tab, projects tab, rep assignment
│   │   ├── projects/page.tsx               ✅ list, filter by stage, add via RPC, inline stage update
│   │   ├── activities/page.tsx             ✅ full log, multi-filter, expandable rows, CSV export
│   │   ├── quotations/page.tsx             ✅ coordinator entry, list, inline status+SQM update
│   │   └── duplicates/page.tsx             ✅ scan, side-by-side, classify, delete
│   └── rep/                               rep + marketing only
│       ├── layout.tsx                      ✅ role check + pending check + Sidebar
│       ├── page.tsx                        ✅ daily report (dropdown-based, linked entities)
│       ├── companies/
│       │   ├── page.tsx                    ✅ own companies list, register new
│       │   └── [id]/page.tsx              ✅ contacts tab, projects tab, add contact
│       ├── projects/page.tsx               ✅ own projects, follow-up banner, stage update, add via RPC
│       ├── quotations/page.tsx             ✅ read-only view of own quotations
│       ├── stats/page.tsx                  ✅ SQM progress, activity KPIs, quotation KPIs, breakdowns
│       └── history/page.tsx               ✅ submitted reports by month, grouped by date
├── components/
│   └── Sidebar.tsx                         ✅ 4 roles (manager/rep/sales_coordinator/marketing), notification bell
├── lib/supabase/
│   ├── client.ts                           ✅ browser client
│   ├── server.ts                           ✅ server client (cookie-based)
│   └── admin.ts                            ✅ service role client — server/API routes only
├── middleware.ts                           ✅ auth guard, cookie passthrough fix applied
├── schema.sql                              ⚠️ partially outdated — SQL Editor is source of truth
└── package.json                            ✅ Next.js 14.2.5, Supabase SSR, date-fns, clsx
```

---

# Business Rules

| Rule | Detail |
|---|---|
| Saudi work week | Friday + Saturday are OFF days. Any scheduling logic must respect this. |
| SQM target | Monthly, per rep, pure square meters (no price) |
| On Time | submitted_at date = activity_date (Asia/Riyadh timezone) |
| Late | activity_date = yesterday, submitted_at = today |
| Missing | No activity found for previous working day |
| Shared records | Reps each see ONLY their own activities on shared entities. Manager sees all. |
| Company email | Must end in @technopanel.com.sa (enforced in API + client) |
| New rep flow | Register → status=pending → manager approves at /dashboard/team → sets role + target → status=active |
| Deletion | Only manager can delete companies, contacts, projects. Reps cannot permanently delete. |
| Quotations | Created by sales_coordinator team. Reps see read-only view of their own. |
| Arabic support | Normalize Arabic for search/duplicate detection. RTL planned but not yet implemented. |
| Duplicate detection | Arabic + English + mixed. System flags, manager resolves. |
| Free text in reports | REMOVED. Reps must select company/project from dropdowns. Only notes field is free text. |

---

# Current Reps (For testing)

| Name | Email | Role |
|---|---|---|
| Ahmed Alzaben | ahmed.alzaben@technopanel.com.sa | rep |
| Jerom Youssef | jerom@technopanel.com.sa | manager |

---

# CRM Features — Complete Status

## Completed ✅
- Auth (login, register, pending flow, role-based routing)
- Middleware with cookie passthrough (redirect loop fix applied)
- Sidebar (4 roles, notification bell with unread count + realtime)
- Companies module (manager: list/search/filter/add/delete/detail + rep: own list/add/detail)
- Contacts (multi-contact per company, primary flag, Arabic name support)
- Projects (atomic creation via RPC, stage inline update, follow-up dates, stale detection)
- Activities (daily report dropdown-based, link to company/project/contact)
- Manager Activities log (full log, multi-filter, expandable rows, CSV export)
- Quotations (coordinator entry: product/SQM/price/validity/revision + rep read-only view)
- Rep History (monthly archive, grouped by date, expandable notes)
- Rep Stats (SQM progress, activity KPIs, quotation KPIs, interaction breakdown, product breakdown, top companies)
- Manager Dashboard (8 KPI cards, pipeline SQM by stage, stale projects, interaction breakdown, branch filter)
- Team Management (approve, set role/target/status/branch)
- Duplicates (scan, side-by-side, classify shared/conflict/resolved, delete)
- Notifications (in-app, realtime badge, auto-triggers for pending reg/assignment/duplicate)

## Not Yet Built (Future Phases)
- Branch analytics page (dedicated branch comparison view)
- Advanced rep performance scoring
- Pipeline revenue forecasting (requires price data from quotations)
- AI lead scoring
- Language switcher (Arabic UI/RTL) — structurally planned, not implemented
- CSV/bulk import of companies from Google Sheets migration
- Sales coordinator dashboard (dedicated view beyond shared quotations page)

---

# Key Code Patterns

## Supabase Join TypeScript Fix (Recurring Pattern)
Supabase returns joined tables as arrays. TypeScript expects objects. Fix pattern used throughout:
```ts
// In type definition:
type Project = {
  companies: any;  // NOT { company_name: string } | null
  project_reps: { role: string; reps: any }[];
};

// In setState call:
setProjects((data ?? []) as unknown as Project[]);

// In JSX when rendering joined data:
const name = Array.isArray(item.companies) 
  ? item.companies[0]?.company_name 
  : item.companies?.company_name;
```
**This pattern applies to ALL pages that use Supabase nested selects.**

## Atomic Project Creation (RPC)
Never use two separate inserts for project + project_reps. Always use:
```ts
await supabase.rpc('create_project_with_rep', {
  p_customer_id, p_project_name, p_city, p_stage,
  p_quoted_sqm, p_next_follow_up, p_notes, p_contact_id, p_rep_id
});
```

## Sidebar Role Type
```ts
export type SidebarRole = "manager" | "rep" | "sales_coordinator" | "marketing";
```
Layouts pass the actual role from DB, not a hardcoded string.

## Middleware Cookie Pattern (Critical — Do Not Change)
The middleware must pass cookies through on redirects to avoid redirect loops:
```ts
const redirectResponse = NextResponse.redirect(new URL("/login", request.url));
supabaseResponse.cookies.getAll().forEach(cookie =>
  redirectResponse.cookies.set(cookie.name, cookie.value)
);
return redirectResponse;
```

---

# Problems & Bottlenecks Encountered

## TypeScript Errors (Most Common)
- Supabase nested selects return arrays, TypeScript types expect objects
- Fix: use `any` for joined table types + `as unknown as Type[]` cast
- This happened in: companies/page.tsx, dashboard/companies/[id]/page.tsx, dashboard/projects/page.tsx, rep/projects/page.tsx — all fixed

## Redirect Loop (Resolved)
- Cause: Middleware redirect responses lost Supabase auth cookies
- Fix: Copy cookies from supabaseResponse to redirect response manually
- Applied in: `middleware.ts`

## Registration Bug (Resolved)
- Symptom: "Creating..." hung → server error about SUPABASE_SERVICE_ROLE_KEY
- Root cause: Service role key not set in Vercel environment variables
- Fix: Added to all 3 scopes in Vercel dashboard

## DB Migration Errors (Resolved)
- `shared_with` column couldn't be dropped because old RLS policies referenced it
- Fix: Drop old policies first, then drop column
- Sequence: DROP POLICY → DROP COLUMN → CREATE junction table → CREATE new policies

## Company Type Inconsistency (Resolved)
- Three different type lists existed: schema.sql, context.md, and UI code
- Canonical list established: Factory, Advertising, Real Estate, Owner, Consultant, Contractor, Station Management, Workshop, Other
- Note: "Real State" → "Real Estate", "Station Managment" → "Station Management" (typos corrected)

## Pending Rep UX (Resolved)
- Pending reps could log in and see the full rep UI
- Fix: Rep layout and root page.tsx check status=pending → redirect to /pending page

## Non-Transactional Inserts (Resolved)
- Project insert + project_reps insert were two separate awaits
- If second failed, project existed with no rep assignment (invisible to rep)
- Fix: `create_project_with_rep` RPC function handles both atomically

## CSV Export Newline Bug (Resolved)
- Python script used to patch activities page corrupted `\n` to literal newline
- Fix: Use `"\n"` escape sequence in string, not template literal with actual newline

---

# Decisions Already Made

## Architecture
- Next.js 14 App Router (NOT Pages Router)
- Supabase for everything: DB, auth, RLS, realtime
- Vercel for hosting
- No separate backend API server
- Junction tables (not text columns) for rep sharing
- RPC function for atomic operations
- Server components for dashboards (data fetching), client components for interactive pages

## Product Scope
- Sales CRM ONLY — not ERP, not finance, not engineering
- No WhatsApp integration yet (in-app notifications only)
- No email automations yet
- No AI features yet
- Quotations mirror ERP data — CRM does NOT replace ERP quotation generation
- Coordinator team enters quotation records manually from ERP data

## Data Model
- Root entity: Company (not Contact, not Deal)
- Company → Contacts (many)
- Company → Projects (many)
- Project → Company (many)
- Project → Quotations (many)
- Project → Activities (many)
- Free text company entry in daily report: REMOVED — dropdown only
- `shared_with` text field: REMOVED — junction tables only

## Security
- RLS enabled on all tables
- Admin client ONLY in server-side API routes
- Rep isolation is absolute on activities (even on shared entities)
- Only manager can delete companies/contacts/projects

## UI/UX
- No external component library (pure Tailwind)
- Brand colors: navy (#0F1923), blue (#185FA5), light (#E6F1FB), green (#0F6E56), amber (#BA7517)
- Mobile not fully optimized (later development)
- Arabic text fields exist (full_name_ar on contacts) but RTL UI not implemented

---

# Important Strategic Notes

## What This CRM Is NOT
- Not a finance system
- Not an invoice/accounting system
- Not a payment collection tracker
- Not a material submittal platform
- Not a tender management system
- Not a document management system
- Not a WhatsApp replacement
- Not an ERP

## Sales Philosophy
- KPIs should measure performance quality, not just form submission
- Activity compliance (on-time/late/missing) is a starting metric, not the end goal
- Real KPIs: customer growth, quotation volume, conversion rate, sold SQM, pipeline health
- Quotation data (from coordinator) + activity data (from rep) together give the full picture

## Duplicate Detection Philosophy
- Saudi/GCC market has severe duplicate problems due to Arabic spelling variations
- System flags, human (manager) decides — no automatic merging
- Three classifications: Shared (legitimate), Conflict (dispute), Resolved (not a duplicate)

## Scalability Philosophy
- Keep architecture expandable but implementation lightweight
- Don't build future departments now unless structurally required
- Every new feature should attach to the Company → Project → Quotation spine

---

# AI Development Workflow

## How Development Currently Works
1. User pastes context `.md` file at start of each Claude session
2. User describes what to build next
3. Claude generates complete file(s)
4. Claude presents files for download
5. User copies file content → pastes into GitHub web editor
6. User commits directly to `main`
7. Vercel auto-deploys
8. User tests on live site (`crm.technopanel.com.sa`)
9. If error → user pastes Vercel error log back to Claude
10. Claude fixes → repeat

## Multi-AI Workflow
- **Claude** (Anthropic): Primary. Best for architecture, complex logic, full file generation.
- **Gemini** (Google): Secondary. Used when Claude hits free tier limits mid-session.
- Context preserved via `.md` file pasted at session start.
- Both AIs have contributed code in this project — Gemini made some changes during a Claude token-limit break (documented in uploaded Untitled.md).

## Token Limit Management
- Sessions often hit free tier limits mid-build
- User checks outputs directory for partially generated files
- Asks next AI session to "check where you stopped and continue"
- Context file (`FACET_CRM_CONTEXT.md`) updated periodically with new state

## Known Gemini Contributions (from session break)
- Fixed redirect loop (cookie passthrough in middleware)
- Role sanitization with `lower(trim(role))`
- Notifications table + realtime subscription in Sidebar
- Some daily report upgrades
- RLS race condition fix on project creation

---

# Recommended Improvements (Not Yet Implemented)

## Development Process
- Set up local development environment (Node.js + npm + `.env.local`)
- Use `npm run dev` locally to test before pushing
- Use feature branches instead of committing directly to `main`
- Add Supabase migration files to track schema changes in version control

## Database
- Create formal migration files in `/supabase/migrations/`
- Add `supabase db push` to deployment workflow
- Eventually drop `projects.company_name` legacy column
- Eventually drop `activities.rep_name` legacy column
- Add `updated_at` trigger to contacts table (currently missing)

## Code Quality
- Centralize dropdown constants into a single `lib/constants.ts` file
- Create shared TypeScript types file `lib/types.ts` instead of per-file type definitions
- The `as unknown as Type[]` pattern should eventually be replaced with proper Supabase generated types

---

# Open Questions / Unresolved Areas

1. **Branch assignment for existing reps** — No reps have been assigned to branches yet. Manager needs to do this via Team page once branch_id column exists.
2. **`contacts` updated_at trigger** — The `set_updated_at()` trigger was created for `trg_contacts_updated` in the context notes but may not have been run in SQL Editor — needs verification.
3. **Marketing role lead flow** — When marketing submits a lead, manager gets notification. But is there a dedicated "leads" list view for manager? Currently marketing companies just appear in the main companies list.
4. **Quotation expiry automation** — Quotations have `valid_until` field. No automated status change to `expired` exists. Must be updated manually by coordinator.
5. **`rep_monthly_sqm` view for zero-activity reps** — View may still exclude reps with no activities for the current month due to GROUP BY on activity_date.
6. **Language switcher** — Arabic UI planned structurally but not implemented. `language_pref` field exists on reps table.
7. **Sales coordinator dedicated dashboard** — Coordinators currently land on `/dashboard` which is the manager dashboard. A dedicated coordinator view may be needed.
8. **Loss reason enforcement** — `loss_reason` field exists on projects but is not required when stage = Lost. No UI enforcement exists.
9. **Follow-up date on activities** — Projects have `next_follow_up` but there's no global "follow-ups due today" view for manager.

---

# Future Vision

## Near-Term (Next Sessions)
- Branch analytics dedicated page
- Manager follow-ups view (all reps' overdue follow-ups)
- Loss reason enforcement when project stage = Lost
- Bulk company import from CSV (Google Sheets migration)
- Contacts updated_at trigger verification
- Arabic UI / RTL toggle


## Long-Term
- AI lead scoring based on interaction frequency + company type + SQM history
- Advanced pipeline forecasting with probability weighting per stage
- Multi-branch regional manager role
- Mobile-first redesign for field reps

---

# Critical Context For Future AI

## How the User Thinks
- Thinks in operational terms ("I want reps to register companies first, then select from dropdown")
- Does not think in code terms ("I need a foreign key constraint")
- Explains business logic clearly but may not know the technical implications
- Trusts AI recommendations on architecture — but needs to understand WHY

## What the User Struggles With
- Partial code edits with vague instructions ("find line X and change it")
- Multi-step changes across multiple files simultaneously
- TypeScript errors — doesn't understand why they happen
- Database migration sequence — fears breaking production
- Understanding which client (browser vs server vs admin) to use when

## What Explanations Work Best
- Complete file replacements (not diffs)
- Exact file paths always stated
- "Open X → find Y → replace with Z" format
- One file at a time when confused
- Error message + exact fix, no lengthy explanation unless asked
- Test checklists after each deployment

## What Future AI Should NOT Assume
- Do NOT generate diffs or partial file edits as the default — generate complete files
- Do NOT assume previous session context is available — always check current state
- Do NOT over-engineer — this is a practical sales tool, not a SaaS platform
- Do NOT add external dependencies without checking package.json first
- Do NOT suggest email/WhatsApp automations — in-app notifications only for now

## Technical Gaps to Be Aware Of
- User does not understand TypeScript generics deeply
- User may not know the difference between server and client components
- All TypeScript errors are discovered at Vercel build time, not before

## Operational Realities
- Saudi Arabia timezone: Asia/Riyadh (UTC+3)
- Weekend: Friday + Saturday (not Saturday + Sunday)
- Arabic is the primary language of many company names and contacts
- WhatsApp is the dominant business communication channel (future integration priority)
- Sales team is mobile/field-based — but CRM currently desktop-optimized
- All reps have @technopanel.com.sa email addresses — domain is enforced in auth

---

# Appendix

## Key Terminology
| Term | Meaning |
|---|---|
| Company | The root CRM entity. Previously called "Customer" in early code. Table still named `companies` (renamed from `customers`). |
| Rep | Sales representative. Also includes marketing role. |
| Coordinator | Sales coordinator. Enters quotation data from ERP into CRM. |
| SQM | Square meters. The primary unit of measurement for deals. |
| On Time | Activity submitted on the same calendar day as activity_date (Asia/Riyadh) |
| Late | Activity submitted the day after activity_date |
| Stale Project | Project with no stage update in 14+ days, not in Won/Delivered/Lost |
| Junction Table | A table linking two entities (company_reps, project_reps) replacing the old text `shared_with` field |
| RPC | Remote Procedure Call — a Supabase database function called from the client |

## Brand Colors (Tailwind Config)
```
brand-navy:  #0F1923  (sidebar background)
brand-blue:  #185FA5  (primary action, progress bars)
brand-light: #E6F1FB  (hover states, highlights)
brand-green: #0F6E56  (success states)
brand-amber: #BA7517  (warning states)
```

## Custom CSS Classes (globals.css)
```css
.btn-primary    → blue filled button
.btn-secondary  → white outlined button
.input          → standard form input
.label          → form field label
.card           → white rounded card
.stat-card      → KPI card (card + padding)
.badge-on-time  → green badge
.badge-late     → amber badge
.badge-missing  → red badge
```

## Supabase Client Usage Rules
```
lib/supabase/client.ts  → "use client" components only
lib/supabase/server.ts  → server components, layouts, middleware
lib/supabase/admin.ts   → API routes only (/api/*), NEVER in client code
```

## TypeScript Fix Reference
Every time Supabase returns a nested select, apply this pattern:
1. Type the joined field as `any` in the type definition
2. Cast the setState call as `as unknown as Type[]`
3. When rendering, use `Array.isArray(item.joined) ? item.joined[0]?.field : item.joined?.field`

## Environment Variables Reference
```bash
# .env.local (local dev) + Vercel dashboard (all 3 scopes)
NEXT_PUBLIC_SUPABASE_URL=https://qndpfbmniqxkegzmzcmh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_8SZSJn-Dek5nJ9PYJC9Tlw_I41kt2XU
SUPABASE_SERVICE_ROLE_KEY=[secret — in Vercel only, never commit to git]
```

## Infrastructure Details
```
GitHub:         github.com/technopanel-systems/facet-crm
Vercel:         auto-deploy on push to main
Supabase URL:   https://qndpfbmniqxkegzmzcmh.supabase.co
Supabase Region: Middle East — Bahrain (me-south-1)
Live URL:       crm.technopanel.com.sa
DNS:            Cloudflare CNAME → cname.vercel-dns.com (grey cloud)
```

## Next Recommended Development Steps (In Order)
1. Verify `contacts` table has `updated_at` trigger running
2. Assign branch_id to existing reps via Team Management page
3. Build dedicated "Follow-ups due" manager view
4. Enforce loss_reason when project stage changes to Lost
5. Build bulk company CSV import page
6. Build dedicated sales coordinator dashboard
7. Add `updated_at` trigger to `contacts` if missing
8. n8n automation setup for daily report reminders
9. Arabic UI / RTL toggle implementation
10. Mobile-first redesign for field rep pages