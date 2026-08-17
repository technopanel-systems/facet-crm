# 09 — Schema Design

**Status:** Derived. This document turns the decided requirements into a table
inventory. It has no authority of its own — every table cites the document that
requires it, and a table with no citation is listed under §14 as a proposal,
not as part of the schema.

**Authority:** below `04-founder-answers.md` and `07-phase4-answers.md`, beside
`01-business-model.md`. Where `07` supersedes `04`, the superseding statement
is used and noted.

**Scope:** prose and table listings only. No code, no migrations, no column
types beyond what a decision forces. Anything the documents leave undecided is
flagged in place and collected in §15 — it is not chosen here.

**Citation tags** follow the conventions of `01`: `[04 Q7]`, `[04 flow 6]`,
`[04 C1]`, `[07 A5]`, `[07 C2]`, `[07 G1]`, `[08 D1]`, `[03]` (stack
decisions), `[01 §x]` where `01`'s derivation is the clearest statement.

---

## 1. Cross-cutting conventions

These apply to every table and are not repeated per table.

- **Soft state, never deletion of history.** Accounts deactivate `[04 C2]`,
  merged companies become tombstones pointing at their winner `[07 B5]`,
  superseded quotation versions stay read-only `[07 C2]`, archived companies
  are kept `[07 E6]`. No table in this design deletes a row to represent a
  business event.
- **Bilingual names plus a normalised form.** Company and contact names carry
  `name_en`, `name_ar`, and `name_normalized` for duplicate matching
  `[07 E3]`. Projects get the same treatment because duplicate detection
  explicitly covers projects and Arabic-vs-English spelling variants
  `[04 B3 confirmed]`. The normalisation algorithm (transliteration, stripping,
  casing) is implementation detail, not schema.
- **ERP references carry a verification state.** Every SMAC reference number is
  typed by a human and can be wrong, so each such field is accompanied by a
  verification status and can be corrected `[04 A2]`.
- **One authorization layer in application code.** No RLS, no database
  policies. Visibility tables in this document are *data* the application
  layer reads; they are not enforcement `[03]`.
- **Polymorphic record references.** Shares, delete requests, tasks,
  activities, attachments and the audit log all need to point at "a record"
  of varying type. They use a `record_type` + `record_id` pair. This is a
  design consequence of per-record sharing `[07 B2]` and the generic audit
  requirement `[07 E1]`, not an invention.
- **Audit is written by the data layer**, not per feature `[07 E1]`. Tables
  below therefore do not carry their own change-history columns beyond
  `created_at` / `created_by` where a document requires knowing the creator.

---

## 2. Identity and authorization

### 2.1 `roles`

Roles are data, not code. A role is a named set of permission flags stored in
a table, so adding a role is configuration, not code changes across every
screen `[07 A5, decision C1]`.

Columns: name, plus one boolean per permission flag. Flags named in the
source: `can_assign`, `can_share`, `can_export`, `can_set_targets`,
`sees_all_reps`, `can_dispatch`, `can_approve_quotation`, `can_impersonate`
`[07 A5 C1]`. The source says "and so on" — **the complete flag list is
OPEN** (§15.1). Seed rows: super admin, executive, sales manager, sales
coordinator, marketing, sales rep, desk rep `[07 A5]` — with the desk-rep and
executive definitions themselves still open `[07 F3, F4]`.

### 2.2 `users`

The person. Holds a role reference; deactivates, never deletes `[04 Q12]`,
`[04 C2]`, `[07 B7]`.

Columns: name, email, role reference, active flag, deactivated timestamp.
Deactivation revokes access immediately; records stay attributed to the
person and are marked "owner inactive" by *deriving* from this flag, not by
touching the records `[07 B7]`.

**Deliberately absent: per-rep working days.** `04 Q16 / C4` required them;
`07 D6` supersedes that with a global Friday/Saturday weekend and a two-day
grace for everyone. `01 §11` describes the old rule and is overridden. No
working-days column exists.

Auth.js session/account tables exist as required by the settled stack
`[03]`; their shape is dictated by the library and not designed here.

### 2.3 `targets`

Targets are **historical rows, never a mutable field on an account**: person,
period (month), SQM, who set it, when `[07 D1]`. Targets are SQM only
`[07 D1]`, `[04 A3]`, monthly `[04 A3]`, set by the founder and the sales
manager `[07 D1]`. A person with no row for a month is simply not measured
that month — coordinators and marketing sometimes carry one and sometimes do
not `[07 D1]`, `[04 Q12]`.

Changing a target must not rewrite past months `[07 D1]`. Whether a
correction within the current month is a superseding row or an edit is a
detail flagged in §15.2.

---

## 3. Companies, contacts, projects

### 3.1 `companies`

The customer is the company `[04 Q1]`.

Columns: `name_en`, `name_ar`, `name_normalized` `[07 E3]`; phone — the
strongest duplicate-matching key `[07 B6]` and part of what marketing
registers `[07 B4]`; category reference `[04 Q5]`, `[07 A4]`; the customer's
VAT number `[08 D7]`; region and city `[07 A7]`; lead source (own search,
marketing, referral, recommendation) `[04 flow 1]` — kept because cohort
conversion judges lead sources `[07 D4]`; notes on what the customer needs,
entered at registration by marketing `[04 Q19]`, `[07 B4]`; archived state
for the dormancy lifecycle `[07 E6]`; and `merged_into_id` — set when this
record loses a duplicate resolution, preserving history while pointing at
the surviving record `[07 B5]`.

Region values are Center, North, South, East, West `[07 A7]`. Province/region
is a label, never an access boundary `[04 Q4]`, `[07 A7]`.

### 3.2 `company_reps`

Membership of reps on a company. Required because visibility is per record
`[04 Q7]`: several reps may share one company `[04 Q3]`, the duplicate
resolution outcome "shared" produces one company with both reps `[07 B5]`,
and a granted delete request removes the company **only from the requesting
rep's side** while it stays for the others `[04 Q8]` — which is only
expressible as per-rep membership rows.

Columns: company, rep, primary flag — the registering rep automatically
becomes primary `[04 Q11]` — how the membership arose (self-registered,
assigned, shared, merge), when, and a removed timestamp for the
delete-request outcome `[04 Q8]`.

Assignment of marketing-channel leads is recorded as a membership row plus
the audit entry; FACET records the outcome of the assignment call, not the
conversation `[07 B3, B4]`.

### 3.3 `contacts`

A person at a company. **One contact belongs to exactly one company**; a
person who moves gets a new contact record at the new company and the old
record stays for history `[07 A2]`.

Columns: company reference, `name_en`, `name_ar`, `name_normalized`
`[07 E3]`, phone `[08 A]`, `[07 B4]`. Further contact fields (position,
email) are not stated anywhere — flagged in §15.3 rather than invented.

### 3.4 `projects`

First-class, not a child of company `[04 Q2]`. Created by a rep and owned by
him unless reassigned or split by the manager `[07 A8]`. A project **requires
at least one linked company** — one entry point, deliberately `[07 A9]`
(enforced in the application layer, per §1).

Columns: `name_en`, `name_ar`, `name_normalized` (duplicate detection covers
projects `[04 B3 confirmed]`); owner rep `[07 A8]`; `sqm_expected` — the
human-entered forecast, set at creation and updated as things change; the
pipeline total is the sum of these `[04 C1]`; end state — won, lost, or
dormant `[07 C5]`; loss reason, required when marked lost `[04 Q18]`,
`[07 C5]`; region and city `[07 A7]` (which records carry geography is not
pinned by `07 A7` — see §15.4).

Achieved SQM is **never** a column here — it is derived from dispatch records
`[04 C1]`.

### 3.5 `project_companies`

The join that makes a company's involvement in a project meaningful
`[04 Q2]`. Carries a role, and **exactly one linked company is flagged as the
buyer** — the company that takes the cladding; other roles are context
`[07 A3]`.

Columns: project, company, role reference, buyer flag.

### 3.6 Lookup tables for this section

| Table | Why it must be a table | Source |
|---|---|---|
| `company_categories` | Category values exist; the list is accepted for now and will be revised at final adjustments — so values are data, not code | `[04 Q5]`, `[07 A4]` |
| `project_company_roles` | "The role list stays open and editable rather than fixed in code" — an explicit instruction that this is a table | `[07 A3]` |
| `cities` | "city, with a Saudi city lookup" | `[07 A7]` |

Starting vocabulary for `project_company_roles` is OPEN `[07 F6]`; the real
category list is OPEN `[07 F5]`.

> **Corrected by `12 §5` and migration `0002`.** The role is **free text**, not a
> lookup: `project_company_roles` was dropped. `company_categories` and `cities`
> stand.

---

## 4. Visibility, sharing, credit, deletion

### 4.1 `record_shares`

Per-record sharing for everything that is not company membership (§3.2):
projects, quotations, and other records stay private to each rep unless the
manager explicitly shares them `[04 Q7]`. Sharing is per record — sometimes a
project and its quotation, sometimes a company, never everything at once
`[07 B2]`. The manager initiates in the system (reps request by phone)
`[07 B1]`, and sharing can be revoked `[07 B1]`.

Columns: record type + record id, shared-with rep, shared-by (manager),
created timestamp, revoked timestamp and revoker.

### 4.2 `project_credit_splits`

When sharing of a project is approved, the credit split is set **at that
moment**, and each dispatch uses whatever split is in force on its date —
which requires split rows with effective dates, not a field `[07 D3]`. A
single-owner project has no rows and credits 100% to the owner `[07 D3]`. A
rep helping without a split is a **contributor** — visible, not credited
`[07 D3]`.

Columns: project, rep, percentage (null for a contributor row), effective
from, set by, set at. Recording a dispatch never sets a split `[07 D3]`.

**Who sets the split — manager or coordinator — is OPEN** `[07 F1]`. The
table shape does not depend on the answer; `set_by` records whoever it is.

### 4.3 `delete_requests`

Deleting requires a stated reason and goes to the manager as a request
`[04 Q8]`.

Columns: record type + record id, requesting rep, reason (required), status,
deciding manager, decided timestamp. On a shared company, granting removes
only the requester's membership row (§3.2) `[04 Q8]`.

---

## 5. Quotations

### 5.1 The thread/version model

One quotation **thread** with multiple **versions**. SMAC inserts `RE` before
the reference number on a revision and treats it as a new linked document;
FACET mirrors that: version 1 carries the original SMAC number, version 2 the
`RE` number; earlier versions stay read-only, only the latest is live. Both
routes — the rep requesting a change, and the coordinator editing directly on
a call — produce a new version `[07 C2]`. Expiry adds a third route: expired
quotations are either extended or revised into a new version `[07 C7]`.

### 5.2 `quotation_threads`

The thread is created when the rep raises the quotation request in FACET with
all details filled in `[04 flow 6]`; the coordinator's SMAC quotation,
mirrored back, becomes version 1 `[04 flow 7, 11]`, `[07 C1]`. (Whether the
request's details *are* draft version 1 or live only on the thread is a
representation detail flagged in §15.5 — the documents describe the handoff,
not the storage.)

Columns: project reference — **required**; FACET requires a project even
though SMAC does not, so the link cannot be validated against SMAC
`[08 C3]`; customer company and contact `[08 A]`; the raising rep
`[04 flow 6]`; thread end state — accepted, rejected, cancelled, or expired
`[07 C5]`; cancellation by the coordinator when there is a problem
`[07 C4]`; payment confirmation — **one tick by the rep, with a date**,
because the rep receives the payment; not an amounts ledger `[07 C3]`; the
rep's accepted-for-processing mark, which comes after payment
`[04 flow 13]`.

Two application rules this table feeds, recorded here so the schema is read
correctly: dispatch is blocked until payment is confirmed `[07 C3]`, and
acceptance in FACET is performed by the **coordinator**, not the rep
`[04 flow 10]` (consistency with `08 C2` flagged for confirmation at
`[08 E4]`).

### 5.3 `quotation_versions`

Columns: thread reference, version number; SMAC reference number (`9592`,
then the `RE` form) with its **verification state** `[04 A2]`, `[07 C2]`;
origin of the version (rep change request, coordinator direct edit, expiry
revision) `[07 C2, C7]`; live / superseded state `[07 C2]`; coordinator
return-for-edit round `[04 flow 10]`; validity date — per quotation, set at
creation, varies case by case `[07 C7]`, `[08 D9]`; terms — delivery period,
payment method, shipment terms — as fields with defaults from settings
`[08 D9]`; totals mirror: total SQM, total without tax, total VAT, grand
total `[08 A, C1, D5]`.

FACET mirrors money; SMAC owns it. Where they disagree, SMAC is correct
`[08 D5]`.

Bank account details are **not** stored per quotation — print-time
boilerplate from settings `[08 D9]`. There is **no discount column** —
`Disc` is unused on the SMAC form and adding an unused field invites
inconsistent use `[08 B3, D8]`.

### 5.4 `quotation_lines`

Product line items, per version. Products are attribute combinations, not a
fixed SKU list `[08 D1]`.

Columns: version reference; one reference each into the five product lookups
— supplier, class, fire rating, colour, thickness `[08 D1]`; form factor
(sheet or coil) `[08 B2]`; width and length — standard values offered as
defaults, both editable; constraining them would block real orders
`[08 D3]`; quantity in pieces `[08 A]`; **square metres as a generated
column**: `quantity_pcs × width_m × length_m`, verified against quotation
9592, never hand-entered `[08 D2]`; unit price, line total, VAT rate, VAT
amount `[08 A, C1, D5]`.

The **printed product name is generated** from the attribute parts, including
the rule that 4 mm is the standard thickness and is omitted from the name, so
FACET's output matches SMAC's format without retyping `[08 B1, D1]`. It is
derived output, not a stored free-text column.

### 5.5 `quotation_service_lines`

Services are their own line type — CNC, cutting, bending, notching — each
with variable price and variable quantity; not every product line receives
one `[08 B4]`. v1 stored only price per metre and never quantity, making
totals impossible `[08 B4]`.

Columns: version reference; service type; **quantity and unit** `[08 D4]`;
unit price; optional reference to the product line it applies to `[08 D4]`.
Service square metres are tracked separately and **do not count toward SQM
targets** `[08 D4]`.

Whether the unit is always square metres is OPEN `[08 E2]`; whether service
type is a lookup table or a fixed set is not stated — see §14.

### 5.6 Product attribute lookups

Five lookup tables, replacing a SKU catalogue that would run to thousands of
combinations and go stale `[08 D1]`:

| Table | Known values | Source |
|---|---|---|
| `product_suppliers` | N, K, D, C, G, G1, Y | `[08 B1]` |
| `product_classes` | A, B, A2G1, A2G2 | `[08 B1]` |
| `product_fire_ratings` | B1, A2, Normal | `[08 B1]` |
| `product_colours` | many; **lookup vs free code is OPEN** `[08 E6]` | `[08 B1]` |
| `product_thicknesses` | 4 mm (standard, omitted from name), 5 mm, 6 mm | `[08 B1]` |

Whether class and fire rating are independent or one constrains the other is
OPEN `[08 E1]` — if dependent, invalid combinations get blocked at entry,
which may add a constraint table later.

The specifications block (manufacturing standards, alloy, layers, core) is
product boilerplate rendered at print time, belonging to "the product record,
not the quotation" `[08 D6]`. Since there is no SKU record `[08 D1]`, **which
attribute or combination the specifications key on is unresolved** — flagged
in §15.6 rather than guessed.

---

## 6. Dispatch

### 6.1 `dispatches`

What the coordinator records as actually having gone out — the one event that
credits targets `[04 flow 16]`, `[04 C1]`. One quotation can produce several
partial dispatches; quotation quantity ≠ paid quantity ≠ dispatched quantity
`[04 quantities]`.

Columns: company, rep, and SQM — always present; **quotation link optional**,
because customers sometimes buy directly from internal sales or a rep
`[07 C6]`; dispatch date (normally the same month as the order
`[04 quantities]`); recorded-by (the coordinator) `[04 flow 16]`; for direct
dispatches, the coordinator's approval — direct dispatches are visible as
such in reporting so the route cannot quietly bypass the chain `[07 C6]`.

Application rules fed by this table: dispatch against a quotation is blocked
until that quotation's payment is confirmed `[07 C3]`; credit divides by the
split in force on the dispatch date `[07 D3]`; achieved SQM and pipeline
metrics are derived from these rows and nowhere else `[04 C1]`.

---

## 7. Duplicates and merge

### 7.1 `duplicate_flags`

Duplicate companies and projects, including Arabic-vs-English spelling
variants, are flagged to the sales manager `[04 B3 confirmed]`. Checking
happens **at entry** — likely matches shown to the rep before the record is
created, phone number as the strongest key; the manager's queue is the
exception path `[07 B6]`.

Columns: record type (company or project), the two record references, how the
flag arose (entry-time match or manual), status, resolution — who continues /
shared / false flag — deciding manager, decided timestamp `[04 B3]`,
`[07 B5]`.

### 7.2 `non_duplicates`

"False flag" is **remembered permanently** in its own small table recording
that two specific records are not duplicates — otherwise the detector
re-flags them on every edit and the manager stops trusting the queue
`[07 B5]`.

Columns: record type, the two record references, decided by, decided at.

### 7.3 The merge mechanism

Both "who continues" and "shared" collapse two records into one — they *are*
merges, the mechanism behind the duplicate system, and they must move
contacts, projects, quotations and activities without losing history
`[07 B5]`.

How this schema supports it, with no extra table:

- The losing company keeps its row, marked with `merged_into_id` (§3.1), so
  every historical reference still resolves to a real record `[07 B5]`,
  consistent with the never-delete principle `[04 C2]`.
- Child records — contacts, projects (via `project_companies`), quotation
  threads, activities — are re-pointed to the winner.
- Every move is written to the audit log with before and after values
  `[07 E1]`, which is what "without losing history" rests on.
- The "shared" outcome additionally creates the second rep's `company_reps`
  membership row — one company with both reps `[07 B5]`.

---

## 8. Activity, reports, tasks

### 8.1 `activities`

Silent system-recorded events — lead added, catalogue sent, dispatch —
written by the system, typed by no one `[04 B3 confirmed]`. **Private to the
rep**, without exception; where reps overlap, a light notification is enough
— avoid complexity `[04 Q6]`.

> **Superseded by `20 §10`.** Visibility **follows the anchor**, not the rep, so
> "without exception" no longer holds; `activities` itself stays permanently
> empty `[20]`.

Columns: acting rep, activity type, record reference (company / contact /
project / quotation), timestamp. Qualification is detected from these events
— the customer asking for a quotation — never set by a human `[04
qualification]`.

### 8.2 `rep_reports`

The second reporting layer, never merged with the first `[04 B3 confirmed]`:
an explicit written report where the rep picks a company, contact or project
and records a visit or call with what happened `[04 B3 confirmed]`. Required
**only for what the system cannot see** — a visit, a call outcome, something
said — never for events FACET already records `[07 D6]`.

Columns: rep, target record reference, kind (visit / call), narrative, report
date. Compliance is a diagnostic on the manager's screen with a two-day grace
and no automatic penalty `[07 D6]` — a reporting rule, not a column.

### 8.3 `tasks`

One entity covering all three kinds — a rep's own to-do, a manager-assigned
task, and a system-generated follow-up — distinguished by an **origin field**
`[07 A1]`. Offboarding reviews a departing rep's tasks alongside quotations,
projects and contacts `[04 Q8.1]`.

Columns: origin (self / manager / system), assignee, optional record
reference, status. System follow-ups are generated from the threshold
settings (§10.2) chasing overdue quotations, unanswered catalogues, stalled
projects and dormant customers `[04 B3 confirmed]`, `[07 D5]`. Further task
fields (due date, title conventions) are not specified anywhere — §15.7.

---

## 9. Notifications

### 9.1 `notifications`

In-app only for now, but every notification carries a **channel** from day
one — adding a column later is cheap; rewriting every call site is not
`[04 Q17, C3]`.

Two tiers `[07 E5]`, with the amendment that **act-now notifications persist
until resolved** — they clear when the action is done, not when tapped;
digest remains for low-value staleness only `[07 G1]`.

Columns: recipient, tier (act-now / digest), channel (`in_app` today), what
it is about (record reference), created timestamp, read timestamp, and —
for act-now — a resolved timestamp tied to the completing action `[07 G1]`.

The full trigger and recipient list is not enumerated anywhere `[01 §13.2
item 24]` and stays open — §15.8.

---

## 10. Settings

### 10.1 Why a settings store is required, not optional

Three separate decisions place values in manager-editable settings rather
than code: follow-up thresholds `[07 D5]`, quotation term defaults
`[08 D9]`, and print-time boilerplate such as bank account details
`[08 D9]`.

### 10.2 `settings`

Keyed configuration values. Known contents: the five follow-up thresholds
with their starting defaults (quotation no-response 5 working days, catalogue
10, project stage unchanged 21, qualified company no-contact 30, unqualified
60) — editable per type by the manager, to be tuned after the pilot
`[07 D5]`; default delivery period, payment method, shipment terms
`[08 D9]`; bank account details for quotation printing `[08 D9]`.

---

## 11. Audit log

### 11.1 `audit_log`

**Append-only**: actor, action, entity, before and after values, timestamp.
Written by the data layer, not per feature `[07 E1]`.

Impersonation is first-class: super admin can log in as a rep `[07 A5]`, and
every impersonated action records **both identities** — "Jerom acting as
Sara" — so the log carries the real actor and the impersonated identity as
separate references `[07 A6]`. (The on-screen banner is UI, not schema.)

Every bulk export is written here; bulk export itself is super-admin only
`[07 B8]`, `[07 E1]`. Payment confirmation records who confirmed and when
through this log `[07 C3]`.

---

## 12. Snapshots

Monthly snapshots of pipeline state and of each person's target versus
achievement, with selectable periods — current state cannot answer historical
questions `[07 E2]`.

### 12.1 `pipeline_snapshots`

Per month: the pipeline position as of capture — at minimum the sum of
project `sqm_expected` that defines the pipeline total `[04 C1]`, `[07 E2]`.

### 12.2 `person_snapshots`

Per month, per person: target SQM (from the target row in force `[07 D1]`)
versus achieved SQM (derived from dispatches and the splits in force on their
dates `[04 C1]`, `[07 D3]`) `[07 E2]`.

The exact captured column set beyond these is not specified — §15.9. Target
progress and activity level are shown side by side, never combined into one
score `[07 D2]`, so no combined-score column exists anywhere.

---

## 13. Attachments

### 13.1 `attachments`

Included from the start even though nothing writes to it in v1: record type,
record id, path, uploaded by, date. Files live on the PC disk with the path
stored in the database `[03]`.

---

## 14. PROPOSED — not required by any document

Listed separately because no document mandates a table for them. Each would
otherwise be an invention inside the main inventory.

1. **`service_types` lookup.** `[08 B4]` names CNC, cutting, bending,
   notching as examples and `[08 D4]` requires a service-type field, but no
   document says the list is data rather than a fixed set. Given the
   documents' consistent preference for editable lookups (`[07 A3]`,
   `[08 D1]`), a lookup table is the natural shape — but it is proposed, not
   required.
2. **`merge_events`.** A one-row-per-merge record (winner, loser, decided by,
   when) would make merge history traversable without reading the audit log.
   The requirement `[07 B5]` is satisfied by the tombstone-plus-audit
   mechanism in §7.3, so this is convenience only.
3. **`lead_sources` lookup.** §3.1 keeps source as a constrained field citing
   `[04 flow 1]`'s four values. If the founder expects the list to grow
   (campaign channels, exhibitions), it becomes a lookup; nothing states
   that.

---

## 15. OPEN — flagged, not chosen

Decisions the documents do not make. None of these is resolved in this
design; where a table shape depended on one, the dependency is stated.

1. **The complete permission-flag list.** `[07 A5 C1]` names eight flags and
   says "and so on". The `roles` table needs the closed initial list. Also
   still open from `07 F`: desk-rep existence and flags `[07 F3]`, the
   executive/super-admin boundary `[07 F4]`.
2. **Target corrections.** Are same-month changes a superseding row or an
   edit? `[07 D1]` forbids rewriting *past* months; it does not address the
   current one.
3. **Contact fields.** Only name and phone are documented `[08 A]`,
   `[07 B4]`. Position, email, and any other contact attributes are
   unstated.
4. **Which records carry region and city.** `[07 A7]` establishes the two
   fields and the city lookup but not their placement. This design puts them
   on companies and projects; confirm.
5. **Request-versus-version representation.** Is the rep's quotation request
   `[04 flow 6]` stored as draft version 1 of the thread, or as thread-level
   fields that version 1 supersedes? The documents define the handoff
   `[04 flow 6–11]`, `[07 C2]`, not the storage.
6. **Where specifications attach.** `[08 D6]` puts the boilerplate on "the
   product record"; `[08 D1]` abolishes product records in favour of
   attribute combinations. Which attribute (class? fire rating? a
   combination?) keys the specifications block must be answered before the
   block can be stored.
7. **Task shape.** Due dates, titles, completion semantics — `[07 A1]`
   defines only the three origins.
8. **Notification triggers and recipients.** The full enumeration is open
   `[01 §13.2 item 24]`; thresholds themselves are settings `[07 D5]`.
9. **Snapshot column sets.** `[07 E2]` states intent (pipeline state, target
   vs achievement, selectable periods), not fields.
10. **Unqualified pipeline.** What it holds and what moves a lead out
    remains open `[04 D6]` — not closed by `07`. This design assumes
    unqualified companies live in the same `companies` table with
    qualification derived from events `[04 qualification]`, and the pipeline
    as a filter; confirm before schema.
11. **Where funnel/stage state lives.** The working funnel `[04
    qualification]` is described per company-in-a-rep's-funnel; the
    follow-up default "project stage unchanged — 21 days" `[07 D5]` implies
    projects have stages. No document defines a stored stage field, its
    value list, or its owner entity.
12. **Cancellation reason.** `[07 C4]` confirms coordinator cancellation but
    not whether a written reason is required — the written-reason rule
    exists only in unconfirmed `[02 §1.4]`.
13. **Carried forward from `07 F` and `08 E`, affecting seed data or
    constraints rather than table shapes:** shared-credit authority
    `[07 F1]`; company category values `[07 F5]`; project–company role
    vocabulary `[07 F6]`; retention policy for archived records `[07 F7]`;
    class/fire-rating dependency `[08 E1]`; service units `[08 E2]`; price
    approval recording `[08 E3]`; who-accepts consistency check `[08 E4]`;
    coil quantity unit `[08 E5]`; colour lookup vs free code `[08 E6]`.

---

## 16. Table inventory at a glance

Thirty-five tables (excluding Auth.js library tables), grouped:

> **Corrected by `12 §5` and migration `0002`.** The count and the list below are
> stale: `project_company_roles` was dropped, and `company_dormancy_reviews`
> `[21 §10]`, `rep_report_signals` `[20 §13]` and `notification_types`
> `[10 §10]` were added. `src/db/schema.ts` is the inventory `[24 §1.3]`.

| Group | Tables |
|---|---|
| Identity | `roles`, `users`, `targets` |
| CRM core | `companies`, `company_reps`, `contacts`, `projects`, `project_companies` |
| CRM lookups | `company_categories`, `project_company_roles`, `cities` |
| Visibility | `record_shares`, `project_credit_splits`, `delete_requests` |
| Quotations | `quotation_threads`, `quotation_versions`, `quotation_lines`, `quotation_service_lines` |
| Product lookups | `product_suppliers`, `product_classes`, `product_fire_ratings`, `product_colours`, `product_thicknesses` |
| Dispatch | `dispatches` |
| Duplicates | `duplicate_flags`, `non_duplicates` |
| Work | `activities`, `rep_reports`, `tasks` |
| Platform | `notifications`, `settings`, `audit_log`, `pipeline_snapshots`, `person_snapshots`, `attachments` |

(`pipeline_snapshots` and `person_snapshots` may collapse into one table
depending on §15.9.)

No table for: invoices (SMAC's, `[04 A1]`), branches (rejected, `[04 Q4]`),
per-rep working days (superseded, `[07 D6]`), discounts (unused, `[08 D8]`),
SKUs (attribute combinations instead, `[08 D1]`), or a combined performance
score (never combined, `[07 D2]`).
