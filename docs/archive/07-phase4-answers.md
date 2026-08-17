# 07 — Phase 4 Answers

**Status:** Sections A and B are **user truth** — stated by the founder during
planning. They rank alongside `04-founder-answers.md` and above
`01-business-model.md`.

Section C holds **decisions delegated to the planning assistant** — agreed, not
proposals. Section D lists what remains open.

This document closes the open items in `01-business-model.md` §13 and
`06-strategic-review.md` Part D. Where it contradicts `01`, this document wins.

---

## A. Entities

**A1. Task — all three kinds.** A task covers a rep's own to-do, a
manager-assigned task, and a system-generated follow-up. One entity, with an
origin field. `[Q1]`

**A2. Contact belongs to one company.** A person spanning two companies happens
only rarely `[Q2]`. **Decision (C):** one contact, one company. If a person
moves, create a new contact at the new company; the old record stays for
history. A many-to-many relationship would cost complexity on every screen for a
rare case.

**A3. Project–company roles.** A company can be anything to a project, but the
one that matters to Technopanel is **the company that takes the cladding**
`[Q3]`. **Decision (C):** the project–company link carries a role, and exactly
one linked company is flagged as the **buyer**. Other roles are context. The
role list stays open and editable rather than fixed in code.

**A4. Company categories.** The existing list is acceptable for now; revisit
during final adjustments `[Q4]`.

**A5. Roles.** Confirmed roles:

| Role | Notes |
|---|---|
| Super admin | Yes to everything. Can open any role's view for testing, and log in as a rep when needed `[Q5]` |
| **Executive** | **New.** For the two CEOs, between super admin and sales manager. Monitoring, changing targets, seeing everything. No operational data entry `[26.1]` — but see the note below |
| Sales manager | Approves shares, assignments, deletes, duplicate resolution, offboarding |
| Sales coordinator | Internal sales. Quotations, dispatch, invoicing in SMAC. May carry a target |
| Marketing | Works as a rep, plus can assign leads and companies directly |
| Sales rep | Field sales |
| **Desk rep** | **New, provisional.** Works like a rep but does not go outside, and is not internal sales. Filters dump/imported leads, works some, assigns or shares the rest `[28.1]` |

> **"No operational data entry" is corrected by `12 §3` and `14 §3`.** The
> executive creates users, approves deletes, exports and sets credit splits
> `[12 §3]`, and **may edit records** `[14 §3]` — each an operational act by this
> sentence's own wording. `11 §1`'s narrow reading is amended by `12 §3`
> `[24 §1.2]`.

**Decision (C1) — roles are data, not code.** Two roles were added in a single
planning message; more will follow. A role is a **named set of permission
flags** (`can_assign`, `can_share`, `can_export`, `can_set_targets`,
`sees_all_reps`, `can_dispatch`, `can_approve_quotation`, `can_impersonate`,
and so on) stored in a table. Adding a role later becomes configuration rather
than code changes across every screen. This is one of the highest-value
decisions in the build and costs nothing if made now.

**A6. Impersonation is logged.** Super admin logging in as a rep is useful and
dangerous — actions taken while impersonating look like the rep performed them.
**Decision (C):** every impersonated action records both identities
("Jerom acting as Sara"), and a visible banner shows on screen throughout.

**A7. Geography — two fields.** Region (Center, North, South, East, West) plus
city, with a Saudi city lookup `[Q6]`. Province remains a label, never an access
boundary.

**A8. Project ownership.** A project is created by a rep and belongs to him,
unless reassigned or a duplicate surfaces from another rep. In rare cases a
project is split, and the manager decides `[Q7]`.

**A9. A project requires a company.** One entry point, deliberately — it forces
the rep to find who is behind the project `[Q8]`.

---

## B. Sharing, assignment, duplicates, offboarding

**B1. Reps request shares by phone.** The manager initiates in the system
`[Q9]`. Sharing can be revoked `[Q10]`.

**B2. Sharing is per record.** Sometimes a project and its quotation, sometimes
a company — never everything at once `[Q11]`.

**B3. Assignment.** A rep's own find registers to himself. A lead arriving
through a marketing channel must be assigned. Marketing can assign **directly**,
and phones the manager first to discuss `[Q12]`.

**B4. The assignment call stays a call.** Marketing registers the company with
name, contact, phone and the request, then contacts the manager to agree the
assignment. FACET records the outcome, not the conversation `[Q13]`.

**B5. Duplicate resolution** `[Q14]`:

| Outcome | Effect |
|---|---|
| Who continues | The loser's records — contacts, projects, quotations, activities — **move to the winner** |
| Shared | Becomes **one company** with both reps |
| False flag | **Remembered permanently**; never flagged again |

**Note (C):** both the first two outcomes collapse two records into one — they
*are* merges. Merge is therefore not an edge case to defer; it is the mechanism
behind the duplicate system, and it must move contacts, projects, quotations and
activities without losing history `[Q15]`.

**Decision (C):** "false flag" needs its own small table recording that two
specific records are **not** duplicates, or the detector re-flags them on every
edit and the manager stops trusting the queue.

**B6. Duplicate checking happens at entry.** At 100–500 companies a month,
flags alone cannot keep up. Likely matches are shown to the rep **before** the
record is created. Phone number is the strongest key — names vary, numbers
rarely do. The manager's queue is the exception path, not the primary defence.
`[06 A5]`

**B7. Offboarding.** The requirement is that the founder or manager can reassign
**all** of a departing rep's data `[Q16]`.

**Decision (C):** deactivation revokes access immediately. Records stay where
they are — still attributed to that rep, visible to manager and above, marked
`owner inactive`. A handover screen lists everything and allows reassignment in
bulk or one at a time. Nothing moves automatically; nothing lands in a pool
where it is forgotten.

**B8. Bulk export is super-admin only**, and every export is written to the
audit log `[Q17]`.

---

## C. The quotation chain

**C1. FACET mirrors SMAC.** FACET holds the quotation's own line items, prices
and details. The SMAC reference number exists so the real quotation can be found
easily `[Q18]`.

**C2. Revisions are versions.** SMAC inserts `RE` before the reference number on
a revision, so SMAC already treats a revision as a new linked document. FACET
mirrors that `[Q19]`.

**Decision (C):** one quotation thread with multiple versions. Version 1 carries
the original SMAC number, version 2 the `RE` number; earlier versions stay
read-only for history, and only the latest is live. Both routes — the rep
requesting a change, and the coordinator editing directly on a call — produce a
new version.

**C3. Payment is one tick, by the rep.** The **rep** marks the quotation
*payment confirmed* with a date, because the rep is the one who receives the
payment `[founder correction]`. Not an amounts ledger, not a finance module.

Today the rep posts to a WhatsApp group and finance confirms the money reached
the bank; dispatch only happens against a paid quotation `[Q20]`. WhatsApp
continues unchanged.

**The value is the gate:** dispatch is blocked until payment is confirmed. That
rule already exists informally; FACET enforces it. The audit log records who
confirmed and when.

**C4. Cancellation.** The coordinator sometimes cancels a quotation when there
is a problem `[Q21]`.

**C5. Loss belongs to the project; rejection to the quotation** `[Q22]`.

- **Quotation** ends as: accepted, rejected, cancelled, or expired
- **Project** ends as: won, lost (with reason), or dormant

A customer accepting quotation A and rejecting quotation B while the project
continues is a rejected quotation, not a loss. A project is lost when the site
goes to a competitor or dies.

**C6. Dispatch may exist without a quotation.** Normally a dispatch links to a
quotation, but customers sometimes buy directly — from internal sales or from a
rep `[Q23, Q24]`.

**Decision (C):** a dispatch always carries a company, a rep and SQM; the
quotation link is optional. **Direct dispatches are approved by the coordinator**
`[founder correction]`, since internal sales already performs dispatch,
invoicing and quotations in the ERP. Direct dispatches are visible as such in
reporting, so the route does not quietly become a way to skip the chain.

**C7. Validity is per quotation.** It varies case by case — three days, seven,
sometimes longer `[Q25]`. Set as a date when the quotation is created.

**Decision (C):** on expiry, notify the rep and mark the quotation expired,
keeping the record. Two follow-on actions: **extend** if nothing has changed, or
**revise** — a new version per C2 — if price or materials changed.

---

## D. Targets, performance, follow-ups

**D1. Targets** are set by the founder and the sales manager, and may or may not
be raised `[Q26]`. They are **SQM only** `[Q27]`. Coordinators and marketing
sometimes carry one and sometimes do not — the option must exist either way
`[Q28]`.

**Decision (C):** targets are **rows** — person, period, SQM, who set it, when —
never a mutable field on an account. Changing a target must not silently rewrite
past months. Someone with no target row simply is not measured on one, so
optional targets need no extra code.

**D2. Activity is an expectation, not a target.** A rep who hits his target
early still does visits, calls and reporting, with less pressure `[Q27]`.
**Decision (C):** target progress and activity level are shown side by side,
never combined into a single score.

**D3. Shared credit — no bypass** `[Q29]`. The founder's requirement: single-name
projects and dispatches continue normally, and no route may let a rep bypass or
wrongly claim full credit. Whether the manager or the coordinator sets the split
is **open** — see §E.

**Decision (C), pending that choice:** a single-owner project credits 100% to
the owner. When sharing is approved, the split is set **at that moment**, and
each dispatch uses whatever split is in force on its date. Coordinators record
dispatches; recording a dispatch never sets a split. A rep helping without a
split is recorded as a **contributor** — visible, not credited.

**D4. Conversion — delegated** `[Q30]`. Cladding is project-driven with long
cycles and many enquiries that never mature, so count-based ratios mislead: ten
50 sqm quotations should not outweigh one 5,000 sqm quotation.

**Decision (C):**
- **Primary — SQM-weighted acceptance:** accepted SQM ÷ quoted SQM
- **Secondary — first-order rate by cohort:** of companies added in a quarter,
  how many ever bought, measured 6–12 months later. This judges **lead sources**
  rather than reps, and answers whether marketing-channel leads convert better
  than rep-found ones — a number nobody has today

Conversion is a diagnostic. It does not enter the target calculation.

**D5. Follow-up thresholds are settings, not code** `[Q31]`. They vary too much
in practice to fix. Manager-editable per type. Starting defaults, to be tuned
after the pilot:

| Trigger | Default |
|---|---|
| Quotation, no response | 5 working days |
| Catalogue sent, no response | 10 working days |
| Project stage unchanged | 21 days |
| Qualified company, no contact | 30 days |
| Unqualified company, no contact | 60 days |

**D6. Daily reports — two-day grace, no automatic penalty** `[Q32]`. Friday and
Saturday off for everyone, including outside Riyadh; Saturday work is still
recorded, never required. This supersedes the earlier per-rep working-days rule
in `04 C4`.

**Founder's reasoning, adopted as a design rule:** a report written only to
avoid a manager's deduction is worse than no report — it is noise that makes the
data untrustworthy.

**Decision (C):** since FACET already logs actions in the background, a written
report is required only for what the system **cannot** see — a visit, a call
outcome, something said. Never for events FACET already records. Compliance
appears on the manager's screen as a diagnostic, with no automatic penalty.

---

## E. Structural decisions confirmed

**E1. Audit log — yes** `[Q33]`. Append-only: actor, action, entity, before and
after, timestamp. Written by the data layer, not per feature. Covers
impersonation (both identities) and every bulk export.

**E2. Snapshots — yes, with selectable periods** `[Q34]`. Monthly snapshots of
pipeline state and of each person's target versus achievement, plus the ability
to choose a period. Current state cannot answer historical questions.

**E3. Bilingual from day one** `[Q35]`. English is the main language and reps are
trained on it; Arabic is available for those who find English hard.

**Decision (C):** every string passes through a translation layer from the first
screen, and the layout mirrors for Arabic RTL. Built in from the start this is a
modest overhead; retrofitted it means touching every file. Company and contact
names carry both English and Arabic fields plus a normalised form for duplicate
matching `[06 A4]`.

**E4. Desktop-first; mobile as helper** `[Q36]`. Laptop and PC are the primary
design target. Mobile covers cases where a laptop cannot be opened.

**Decision (C):** these screens must work properly on a phone — log a visit, look
up a company, check today's follow-ups. Everything else must simply not break.

**E5. Notifications — two tiers** `[Q37]`:
- **Act now** — something waits on you: a quotation returned for edits, a lead
  assigned to you, a share approved. These interrupt.
- **Digest** — one summary daily or weekly: what went stale, what is dormant.
  These do not interrupt.

Follow-ups are digest. Anything requiring a decision is act-now. Without the
split, reps mute everything and miss what mattered.

**E6. Dormancy lifecycle** `[Q38]`. A company with no interaction or report for
a long period is notified, then takes one of three routes:

1. Re-included with the same rep, with a warning
2. Reassigned to another rep
3. Archived as out of scope, for later investigation and possible deletion

**E7. Six-month success criterion** `[Q39]`. Stated: organise internal work and
get a better overall view, so effort is not stuck on one or two things.

**Proposed measurable form — confirm one:**
- **No bottleneck (recommended):** the manager and the CEOs can see pipeline,
  targets and rep activity without asking anyone to assemble anything
- **One place:** no rep keeps a private spreadsheet; stock no longer circulates
  by WhatsApp
- **Traceable:** every dispatched sqm traces to a rep, a project and a company

---

## F. Still open

1. **Shared-credit authority** — does the manager or the coordinator set the
   split? (D3)
2. **Confirm the six-month success criterion.** (E7)
3. **Desk-rep role** — confirm it exists, and which permission flags it carries.
   (A5)
4. **Executive role** — confirm the exact boundary against super admin: can
   executives change targets only, or also assignments and sharing? (A5)
5. **Company categories** — deferred by the founder to final adjustments. (A4)
6. **Project–company role vocabulary** — the open list needs starting values.
   (A3)
7. **Retention policy** — how long archived companies and departed contacts are
   kept before deletion. (E6, `06 B7`)
8. **What FACET's quotation record holds exactly** — line items confirmed;
   whether it mirrors every SMAC field, or a subset, needs one pass with a
   coordinator looking at a real SMAC quotation. (C1)
---

## G. Amendments

**G1. Notifications — act-now is persistent (supersedes E5).**
Act-now notifications **stay until resolved** and cannot be dismissed —
a manager assignment, a quotation returned for edits, an approval waiting.
They clear when the action is done, not when the user taps them.

Digest remains for low-value staleness only (dormant companies, quiet
quotations). Anything requiring a decision is act-now and persistent.

Rationale: a notification that can be swiped away is a notification that
gets swiped away. Persistence is what makes act-now trustworthy — and it
only works because the digest tier keeps the noise out of it.

**G2. Desktop and phone both work (supersedes E4).**
Not desktop-first with mobile as fallback. Both are supported targets from
the start; problems found in testing get fixed. Layouts are responsive
rather than two separate designs.

**G3. Six-month success — both criteria confirmed (closes E7).**
1. **No bottleneck** — the manager and the CEOs can see pipeline, targets
   and rep activity without asking anyone to assemble anything.
2. **One place** — no rep keeps a private spreadsheet; stock no longer
   circulates by WhatsApp.

These two together define "worth it" at six months. Feature requests that
serve neither can wait.