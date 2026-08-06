# 01. User Roles — FACET CRM

There are five roles. All roles are stored in `reps.role` and enforced via database CHECK constraint.

---

## `rep` — Sales Representative

**Purpose:** Execute field sales. Register companies, create projects, submit daily activity reports.

**Routing:** `/rep/*` only. Redirected away from `/dashboard/*`.

**What they can do:**
- Submit daily activity reports (one per working day)
- Register new companies (auto-assigned to themselves as primary rep)
- Add contacts to their companies
- Create projects under their companies (via RPC)
- Update project stages including marking as Lost (with required reason)
- View their quotations (read-only)
- View their stats, history, and notifications

**What they cannot do:**
- Create or edit quotations
- See other reps' activities, even on shared companies
- Delete any record
- See the manager dashboard
- Change their own role or target

**Data isolation:** A rep sees only records linked to them via `company_reps` or `project_reps` junction tables. No cross-rep data leakage.

---

## `marketing` — Marketing / Lead Generation

**Purpose:** Generate top-of-funnel leads and act as an internal sales resource.

**Routing:** `/rep/*` only. Same as rep.

**What they can do:** Identical to `rep`. Creates companies (leads), submits daily reports.

**Difference from rep:** Conceptually generates leads that may be assigned to reps by the manager. In practice, the system treats marketing identically to rep in all RLS policies and routing logic.

---

## `sales_coordinator` — Back-Office Commercial

**Purpose:** Mirror ERP commercial data (quotations, invoices) into the CRM. Bridge between the ERP system and the CRM.

**Routing:** `/dashboard/*`. Same routing as manager.

**What they can do:**
- Create and manage quotations (all CRUD operations)
- Update quotation status (won, lost, expired, cancelled)
- Record invoiced SQM
- View all companies and projects (read-only)
- View all notifications addressed to them

**What they cannot do:**
- Submit daily activity reports
- Create or delete companies, contacts, or projects
- Access team management
- Approve user accounts
- Resolve duplicate flags

**Sidebar navigation (coordinator-specific):** Companies, Projects, Quotations, Notifications

**Current users (2026):** Christina Refaat and one other coordinator (email TBC).

---

## `manager` — Sales Manager

**Purpose:** Oversee the entire sales team. Full read/write access to all data.

**Routing:** `/dashboard/*`.

**What they can do:**
- Everything a coordinator can do
- Approve and configure user accounts (set role, target, status)
- Delete companies, contacts, and projects
- Create and manage company holidays and rep absences
- Resolve duplicate company flags
- View all reps' activities, stats, and performance
- Access all dashboard KPIs
- Create companies and projects manually
- Add and remove rep assignments to companies

**Current users (2026):** Zaid Arar (sales manager).

---

## `super_admin` — System Owner

**Purpose:** Developer and system administrator. Functionally identical to manager.

**Routing:** `/dashboard/*`.

**What they can do:** Everything a manager can do. Identical RLS permissions.

**Special restrictions:**
- Cannot be role-changed via the Team page UI (static badge is shown instead of dropdown)
- Role can only be changed via direct SQL in Supabase SQL Editor
- This prevents accidental demotion of the system owner

**Current users (2026):** Jerom Youssef (jerom@technopanel.com.sa).

---

## Role Assignment Flow

### Self-Registration Path
1. User registers at `/register` with @technopanel.com.sa email
2. Role defaults to `rep`, status to `active`
3. Manager notified
4. Manager changes role and sets target via Team page

### Manager-Created Path
1. Manager opens Team page → Create User
2. Selects role and target at creation time
3. Account immediately usable

---

## Role CHECK Constraint (Production)

The database enforces:
```sql
CHECK (role IN ('rep','manager','sales_coordinator','marketing','super_admin'))
```

Any attempt to insert or update a rep with a role outside this list will fail at the database level.

---

## Sidebar Navigation per Role

### Manager / Super Admin
Dashboard, Companies, Projects, Activities, Performance, Follow-ups, Quotations, Team, Import, Duplicates, Notifications

### Sales Coordinator
Companies, Projects, Quotations, Notifications

### Rep / Marketing
Daily Report, My Companies, My Projects, My Stats, My Quotations, History, Notifications
