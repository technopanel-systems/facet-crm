# 01 — Business Model

**Status:** Derived. This document restates the business as a model, so that a
schema can be built from it. It has no authority of its own — every substantive
statement here traces to `04-founder-answers.md`, and where it does not, it says
so.

**Authority:** below `04-founder-answers.md`, above `00-legacy-findings.md` and
`02-history-extract.md`. Where `04` contradicted a lower source, `04` won and
the override is recorded in §12.

**Citations used below**

| Tag | Means |
|---|---|
| `[04 A1]` | Section A, business context |
| `[04 Q7]` | Section B, answer 7 of the twenty |
| `[04 flow 10]` | Section B2, sales-flow step 10 |
| `[04 confirmed]` | Section B3, other confirmed requirements |
| `[04 C1]` | Section C, delegated decision 1 |
| `[04 D2]` | Section D, open item 2 |
| `[02 §1.2]`, `[00 §2]` | The lower sources — always labelled as such |

**Reading rule.** Anything cited to `02` or `00` alone is **not** founder truth.
It is recorded because it is the only account that exists, and it is marked
unconfirmed every time. Anything with no citation at all is a defect in this
document.

---

## 1. What FACET is modelling

Technopanel supplies cladding / aluminium composite panel (ACP) in Saudi Arabia
`[04 A3]`. FACET is the system of record for **work**: who owns which
relationship, what stage things are at, what was promised, and what actually
moved `[04 A1]`.

It is not an ERP `[04 Q20]`. Money — quotation pricing as the company books it,
invoicing, tax, stock accounting — stays in SMAC `[04 A1]`.

The unit that matters is the **square metre**, tracked monthly. Not currency
`[04 A3]`.

---

## 2. Actors and roles

### 2.1 The roles

| Role | What it does | Source |
|---|---|---|
| **Sales rep** | Owns relationships. Adds companies, contacts and projects; runs the funnel; raises quotation requests; files activity reports. | `[04 flow 1–6]` |
| **Sales coordinator** | Creates the real quotation in SMAC, obtains physical signatures, accepts or returns the quotation in FACET, raises the invoice in SMAC, records actual dispatch. **Also works as a rep**, carrying a target. | `[04 flow 7–16]`, `[04 Q12]` |
| **Sales manager** | Decides lead assignment, shares records between reps, approves delete requests, resolves duplicate flags, runs offboarding and handover. | `[04 Q8]`, `[04 Q7]`, `[04 Q19]`, `[04 confirmed]`, `[04 Q8.1]` |
| **Marketing** | Works as a normal rep with permissions, **plus** the ability to assign new leads and companies. Receives leads, registers the company with notes on what the customer needs, then asks the manager who to assign it to. | `[04 Q9]`, `[04 Q19]` |

A coordinator sees all companies and projects, read-only, but not rep activity
detail `[04 Q10]`. This coexists with §4: read-across at the coordinator level
is a role capability, not a change to per-record ownership.

> **Superseded by `16 §8` and `18 §2`.** The coordinator sees **quotation
> threads, and company names only** — no company, contact or project
> read-across. The second half is decided on different grounds by `20 §10`.

Note a tension `04` leaves standing: `[04 Q9]` gives marketing "the ability to
assign new leads and companies", while `[04 Q19]` says marketing *asks* the
manager and **the manager decides**. Whether marketing performs the assignment
the manager chose, or holds independent assignment rights, is not resolved. See
§13.

### 2.2 Role and target are separate

A person has a **role** — what they may do — and optionally a **target** — what
they are measured on. These must not be conflated `[04 Q12]`.

The case that forces the split is the sales coordinator: an internal sales
department that carries its own target while holding coordinator permissions
`[04 Q12]`. A schema that derives "has a target" from "is a rep" cannot express
this person.

Targets are monthly and measured in square metres `[04 A3]`. Who sets a target,
and whether it varies month to month, is not stated anywhere. See §13.

### 2.3 Accounts

Accounts are **deactivated, never deleted** — history must keep pointing at a
real person `[04 Q8.1]`, `[04 C2]`. This also covers long leave `[04 C2]`.

A fifth role, `super_admin`, appears in `[02 §1.2]` as a founder request for a
developer account with all views, and in `[00 §3.1]` as a value that existed in
v1's policies but not in its own role list. **It does not appear in `04`.** It
is therefore not a decided role. See §13.

---

## 3. Entities and relationships

### 3.1 There is no root entity

Companies, contacts and projects are intertwined. A project may involve
multiple companies — contractor, supplier, consultant office — so **project is
a first-class entity, not a child of company** `[04 Q2]`.

This is the single most consequential statement in `04`. Everything that
assumes a company-owns-everything hierarchy is wrong.

### 3.2 The entities

| Entity | What it is | Source |
|---|---|---|
| **Company** | The customer. The customer *is* the company being dealt with — the earlier `customers` → `companies` rename was a terminology correction, not a model change. | `[04 Q1]` |
| **Contact** | A person at a company. Reps may share a company through the same contact or through different contacts. | `[04 Q3]` |
| **Project** | A job. First-class. Carries the expected SQM forecast. May involve several companies in different roles. | `[04 Q2]`, `[04 C1]` |
| **Project–company link** | The join that makes a company's involvement in a project meaningful. **Carries a role**: contractor, supplier, consultant office. | `[04 Q2]` |
| **Quotation request** | What the rep raises in FACET, with all details filled in. Not the quotation. | `[04 flow 6]` |
| **Quotation** | The real document, created in SMAC, mirrored in FACET and linked by its SMAC reference number. | `[04 flow 7, 11]` |
| **Dispatch** | What the coordinator records as actually having gone out. Several per quotation. This is what credits the target. | `[04 flow 16]`, `[04 quantities]` |
| **Activity** | A system-recorded event — lead added, catalogue sent, dispatch. Silent; not typed by anyone. | `[04 confirmed]` |
| **Rep report** | An explicit written report where the rep picks a company, contact or project and records a visit or call with what happened. | `[04 confirmed]` |
| **User account** | The person. Holds a role, optionally a target, and working days. Deactivates, never deletes. | `[04 Q12]`, `[04 C2]`, `[04 C4]` |

### 3.3 Ownership

When a rep registers a company, they automatically become its primary rep
`[04 Q11]`.

Companies arrive from a rep's own search, from marketing, from a referral or
from a recommendation `[04 flow 1]`.

### 3.4 Where the sources are silent

- Whether contractor / supplier / consultant office is the **complete** set of
  project–company roles, and how that set relates to company categories, which
  are themselves open `[04 D1]`.
- Whether one contact may belong to more than one company.
- What a "task" is. `[04 Q8.1]` requires offboarding to review a rep's "tasks"
  alongside quotations, projects and contacts. Nothing else in `04` defines a
  task entity.

All three go to §13.

---

## 4. Visibility and sharing

### 4.1 The rule

**Visibility is per record, not per company** `[04 Q7]`.

On a shared company:

- Both reps see the **company record itself** `[04 Q7]`.
- Its **projects, quotations and other records stay private to each rep**,
  unless the manager explicitly shares them `[04 Q7]`.
- **Activities are private to the rep**, without exception `[04 Q6]`.

> **Superseded by `20 §10`.** Knowledge is company property: a report's
> visibility **follows its anchor**, so "without exception" no longer holds.

Sharing is not one-shaped: several reps may share a company via the same
contact or via different contacts, and projects are shared the same way,
possibly through different companies `[04 Q3]`.

### 4.2 Notification instead of complexity

Where a company is shared, or two reps act on the same record, a **light
notification to the other rep is sufficient**. `04` says explicitly: avoid
complexity here `[04 Q6]`.

Notifications are in-app only for now, with email / WhatsApp / SMS wanted later
`[04 Q17]`. A channel concept exists from day one even when `in_app` is the
only working value `[04 C3]`.

### 4.3 Deletes are requests

Deleting requires a **stated reason** and goes to the manager as a request
`[04 Q8]`.

On a shared company, the delete removes it only from the **requesting rep's
side**; the record stays for the other reps `[04 Q8]`.

### 4.4 Where enforcement lives

One authorization layer, in application code, in one place. That is settled in
`03-stack.md` and in `CLAUDE.md` and is not reopened here.

### 4.5 Where the sources are silent

Who may *request* a share, whether a share can later be revoked, and whether
sharing is per record or per record-type, are not stated. See §13.

---

## 5. The funnel

### 5.1 The working funnel

```
introduced → catalogue/samples → documents → quotation requested (QUALIFIED)
           → paid → dispatched
```

`[04 qualification]`

Expanded from the sales flow `[04 flow 1–5]`:

| Stage | What happened |
|---|---|
| **introduced** | Company is in the rep's funnel; product introduced |
| **catalogue/samples** | Brochure and catalogue sent; samples sent on request |
| **documents** | Data sheets and compliance documents sent as needed |
| **quotation requested** | The customer asked for a quotation — **QUALIFIED** |
| **paid** | Customer pays |
| **dispatched** | Coordinator records what actually went out |

### 5.2 Qualification is an event, not a stage a human sets

There is no formal stage list. "Qualified" is roughly **when the customer asks
for a quotation** — and this is an event the system can detect on its own
`[04 qualification]`.

This matters for §9: qualification is derived, not declared.

### 5.3 The funnel does not end

Some customers buy once; others buy repeatedly `[04 qualification]`. A company
is not spent when it reaches `dispatched`.

### 5.4 Two pipelines

The main CRM is **filtered to qualified leads**. Unqualified leads sit in a
**separate, lighter pipeline** `[04 confirmed]`.

What that lighter pipeline holds, and what moves a lead out of it, is open
`[04 D6]`.

### 5.5 Loss

A loss reason is required whenever a project is marked lost `[04 Q18]`.

The funnel above contains no `lost` stage and `04` does not say where loss sits
relative to it. Recorded as a rule; the placement is a silence.

---

## 6. The quotation chain

### 6.1 The handoff

| # | Actor | Action | Where | What FACET holds |
|---|---|---|---|---|
| 6 | **Rep** | Raises a quotation **request**, filling in all details | FACET | The request |
| 7 | **Coordinator** | Creates the real quotation | **SMAC** | — |
| 8 | — | Quotation is **physically signed** as management approval | Paper | — |
| 9 | **Coordinator** | Sends the signed PDF back to the rep | Out of band | — |
| 10 | **Coordinator** | **Accepts the quotation in FACET** — not the rep — after obtaining signatures, or returns it for an edit round | FACET | Acceptance / return |
| 11 | **Coordinator** | Records the SMAC quotation number | FACET | The reference link |
| 12 | Customer | Pays | — | — |
| 13 | **Rep** | Marks the quotation accepted for processing | FACET | Processing state |
| 14 | — | Same signature cycle repeats | Paper | — |
| 15 | **Coordinator** | Raises the invoice | **SMAC** | — |
| 16 | **Coordinator** | **Records what was actually dispatched** | FACET | The dispatch — this credits the target |

`[04 flow 6–16]`

### 6.2 What this chain asserts

- The rep raises a **request**. The rep does not create the quotation.
- The **coordinator, not the rep, accepts it in FACET** `[04 flow 10]`. This is
  stated emphatically in `04` and is easy to get backwards.
- Approval is a physical signature. For now, the coordinator's approval action
  in FACET stands in for it. Digital signing is a possible later addition
  `[04 approval]`.
- Step 13 is the rep's, and it comes **after** payment.

### 6.3 Quantities diverge

**Quotation quantity ≠ paid quantity ≠ dispatched quantity** `[04 quantities]`.

Cladding is often taken in stages, so **one quotation can produce several
partial dispatches** `[04 quantities]`. A single dispatched-quantity field on a
quotation cannot represent this.

Dispatch normally happens in the **same month** as the order. Dispatching
before the cladding physically ships is rare `[04 quantities]`.

### 6.4 Where the sources are silent

- What the FACET quotation record itself holds. `[04 A1]` says FACET *does*
  hold some quotation pricing data of its own — "the split is not absolute" —
  but does not say what.
- What a returned edit round `[04 flow 10]` does to the quotation's identity —
  whether it is a revision, a replacement, or a state.
- Whether payment `[04 flow 12]` is a recorded state, a flag, or inferred.
- Quotation validity period — explicitly "to figure out" `[04 D5]`.
- Cancelled versus lost. `[02 §1.4]` records a founder statement that
  cancellation is coordinator-only and needs a written reason, while a rep may
  only mark lost. **Unconfirmed — not restated in `04`.**

---

## 7. The SMAC boundary

### 7.1 The split

| FACET | SMAC |
|---|---|
| Who owns which relationship | Quotation pricing as booked |
| What stage things are at | Invoicing |
| What was promised | Finance |
| What actually moved (dispatch) | Taxing |
| Some stock, production and quotation pricing data | Stock accounting |

`[04 A1]`

**FACET grows sideways** — production, warehouse, marketing modules.
**FACET never grows down** into finance, invoicing or tax `[04 A1]`.

The split is not absolute in the direction of FACET holding some pricing and
stock data `[04 A1]`. It is absolute in the direction of finance: that stays in
SMAC.

### 7.2 Every link is a human retyping a number

There is **no API and no readable database** for SMAC. Every link between FACET
and SMAC is a person retyping a reference number `[04 A2]`.

The design consequence is stated directly: FACET must assume the link can be
wrong. **Every ERP reference needs a verification state and a way to correct a
mismatch** `[04 A2]`.

This applies at minimum to the SMAC quotation number recorded at
`[04 flow 11]`, and to any invoice reference arising from `[04 flow 15]`.

### 7.3 Invoices

`[04 Q13]` answers yes to the question "do coordinators also enter invoice
records", and `[04 flow 15]` places that act in SMAC. Read together with
`[04 A1]`, the consistent reading is: **the coordinator is the invoice actor,
and invoicing happens in SMAC** — FACET does not keep invoice records.

That reading is an inference across three statements, not a single founder
sentence. It is flagged in §13 for confirmation.

What credits a rep's target is the **dispatch record**, not the invoice
`[04 flow 16]`, `[04 C1]`.

---

## 8. Rep offboarding and handover

When a rep leaves and their account is closed, the manager needs a screen to
review that rep's **stalled quotations, projects, contacts and tasks**, and
either **redistribute them across other reps or delete them** `[04 Q8.1]`.

The account is **deactivated, never deleted** `[04 Q8.1]`, `[04 C2]`. Records
must keep pointing at a real person for history. The same mechanism covers long
leave `[04 C2]`.

This makes handover a first-class operation, not a data-fix. Two things follow
that `04` does not spell out and that are therefore not asserted here: what
"stalled" means quantitatively — related to the open follow-up thresholds
`[04 D4]` — and what a "task" is (§3.4).

---

## 9. Derived versus human-entered

### 9.1 The rule

**If the system can know it, do not ask a human.** Only ask for what genuinely
lives in someone's head `[04 C1]`.

Numbers typed from memory at the end of a day become permanent guesses
`[04 C1]`.

### 9.2 The split

| Derived by the system | Entered by a human |
|---|---|
| **Achieved SQM** — from the dispatch records the coordinator enters `[04 C1]` | **`sqm_expected`** — a forecast, on the **project**, set at creation and updated as things change `[04 C1]` |
| **Qualification** — the customer asking for a quotation is a detectable event `[04 qualification]` | **Rep reports** — visit or call, against a chosen company, contact or project, with what happened `[04 confirmed]` |
| **Pipeline total** — the sum of project `sqm_expected` `[04 C1]` | **Loss reason** — required when a project is marked lost `[04 Q18]` |
| **Silent activity** — lead added, catalogue sent, dispatch `[04 confirmed]` | **Delete reason** — required on a delete request `[04 Q8]` |
| | **Cancellation reason** — coordinator, in writing `[02 §1.4, unconfirmed]` |

### 9.3 What C1 removed

**Reps do not enter `sqm_done` on daily reports** `[04 C1]`.

With `sqm_done` gone there is no second SQM metric to reconcile, so the
question of activity SQM versus invoiced SQM does not arise. **One number, one
source** `[04 C1]`.

Ask for the forecast once, on the project — not daily `[04 C1]`.

### 9.4 Reporting has two layers

Silent system-recorded activity, and explicit rep-written reports
`[04 confirmed]`. The two are not the same feed and should not be merged into
one.

Performance should combine some mix of actions, target, conversion and
reporting timeliness. **The exact formula is not decided** `[04 confirmed]`,
`[04 D3]`.

---

## 10. Province is a label, not an access boundary

Riyadh is the main location. The Eastern and Southern provinces each have a
single rep who opens the warehouse daily `[04 Q4]`.

**Reps sell across provinces freely** — a Riyadh rep may sell in the East and
vice versa `[04 Q4]`.

Province is therefore a **label on a record**. It is not an access boundary, it
does not scope visibility, and it does not group people. The legacy `branch_id`
concept is rejected `[04 Q4]`.

The set of valid province labels is not stated. `04` names Riyadh, Eastern and
Southern in the course of describing operations, but does not present them as a
complete list. See §13.

---

## 11. Working days belong to the rep

The weekend is Friday and Saturday. **Out-of-province reps work Saturday** —
expect their reports and activity on Saturdays, but **do not count Saturday as
a required working day for them** `[04 Q16]`.

Working days must be a **property of the rep**, not a global constant
`[04 Q16]`, `[04 C4]`. A global weekend would force an exception branch into
every compliance report `[04 C4]`.

This affects anything that asks "was this person expected to work that day":
report timeliness, follow-up ageing, and dormancy.

Related but **unconfirmed**: `[02 §1.1]` records the founder stating a one-day
grace period for the daily report, that the weekend does not consume the grace
period, and that the notification fires automatically on expiry. None of this
is restated in `04`. See §13.

---

## 12. What `04` overrode

Recorded so that the lower documents are not re-mined for these points.

| Point | Lower source said | `04` says |
|---|---|---|
| Root entity | Company is the root, everything hangs off it `[02 §5 Q2]` | **No root.** Project is first-class `[04 Q2]` |
| Branches | `branches` table, `reps.branch_id`, `companies.branch_id`, a branch filter and a branch summary view `[00 §1.1, §1.2, §2]` | **Rejected.** Province is a label on a record `[04 Q4]` |
| Achieved SQM | Reps type `sqm_done` on the daily report `[02 §5 Q14]` | **Derived** from coordinator dispatch records `[04 C1]` |
| Two SQM metrics | Activity SQM and invoiced SQM must be reconciled `[02 §5 Q15]` | **Question dissolved** — one number, one source `[04 C1]` |
| Dispatched quantity | A single `sqm_invoiced` figure, cumulative or per-invoice unresolved `[00 §4 Q4]` | **One quotation, several partial dispatches** `[04 quantities]` |
| Invoices in FACET | An invoice table is a structural gap to be filled `[02 §3]`, `[00 §2]` | **Invoicing is SMAC's** `[04 A1]`. FACET records dispatch `[04 flow 16]` |
| Weekend | Friday/Saturday globally, for all scheduling logic `[02 §5 Q16]` | **Per-rep working days**; out-of-province reps work Saturday `[04 Q16]`, `[04 C4]` |
| Account removal | No delete path exists for users `[00 §2]` | **Deactivate, never delete** — deliberate, not a gap `[04 C2]` |
| Marketing | Registers leads but never sees activities, quotations or other reps' data `[02 §5 Q9]` | **A normal rep with permissions**, plus lead and company assignment `[04 Q9]` |
| Deletes | Restricted to the manager; reps edit but never delete `[02 §5 Q8]` | **A request with a stated reason**, and on a shared company it removes only the requester's side `[04 Q8]` |
| Approval gate | A pending-approval flow for new accounts, variously described as intentional, aspirational and vestigial `[00 §2, §3.5]` | **No activation gate stated.** `[04 Q19]` describes an *assignment* decision by the manager, not an approval of the company or the account |
| Terminology | Was the `customers` → `companies` rename intended? `[02 §5 Q1]` | **Yes** — a terminology correction, not a model change `[04 Q1]` |

Two further points are settled elsewhere and are noted only so they are not
re-litigated here: authorization lives in one application layer rather than in
database policies, and there is no RLS — both closed in `03-stack.md`, in
response to the three-way contradiction documented at `[00 §3.3]`.

---

## 13. OPEN — decide before schema

### 13.1 Carried forward from `04` Section D

1. **Company categories.** The existing list is not trusted and needs revising.
   What are the real company types? (Contractor, consultant office, supplier,
   fabricator, direct client, government…?) `[04 D1]`
2. **Shared-project SQM split.** When a project is shared between reps and SQM
   is dispatched, how is the credit divided — equally, by a set percentage, by
   who raised the quotation, or manually by the manager? `[04 D2]`
3. **Performance formula.** Which inputs, and what weight each carries.
   `[04 D3]`
4. **Follow-up thresholds.** How many days before a quotation, catalogue or
   dormant customer is flagged overdue. `[04 D4]`
5. **Quotation validity period.** Stated as "to figure out". `[04 D5]`
6. **Unqualified pipeline.** What it holds and what moves a lead out of it.
   `[04 D6]`

### 13.2 Additionally open — surfaced while writing this document

Each states what is missing and which source is silent.

7. **Does `super_admin` exist in v2?** A developer account with all views was
   requested in `[02 §1.2]`, and the value existed in v1 `[00 §3.1]`. `04` names
   four roles and not this one. If it exists, is it a role or a flag on an
   account? (§2.3)
8. **Are contractor / supplier / consultant office the complete set of
   project–company roles?** `[04 Q2]` gives three by example. Whether the set is
   closed, and whether it is the same vocabulary as company categories `[04 D1]`
   or a different one, is not stated. (§3.4)
9. **Can one contact belong to more than one company?** `[04 Q3]` describes reps
   sharing a company through different contacts but does not address a contact
   spanning companies. (§3.4)
10. **What is a "task"?** `[04 Q8.1]` requires offboarding to review a rep's
    tasks alongside quotations, projects and contacts. No other statement in
    `04` defines one. (§3.4, §8)
11. **Who may request a share, and can it be revoked?** `[04 Q7]` says the
    manager shares. It does not say whether a rep can ask, whether sharing is
    per record or per record type, or whether it can be withdrawn. (§4.5)
12. **Does marketing assign, or only propose?** `[04 Q9]` grants marketing the
    ability to assign leads and companies; `[04 Q19]` has marketing ask the
    manager, who decides. (§2.1)
13. **Should lead assignment move into FACET?** `[04 Q19]` says marketing asks
    the manager "currently by phone". Whether FACET should replace that call, or
    only record its outcome, is not stated.
14. **What is the province label set?** `[04 Q4]` names Riyadh, Eastern and
    Southern operationally but does not present a complete list. (§10)
15. **What does the FACET quotation record hold?** `[04 A1]` says FACET holds
    some quotation pricing data of its own and that the split is not absolute,
    without saying what. (§6.4)
16. **What does a returned edit round do to a quotation?** `[04 flow 10]` allows
    the coordinator to return a quotation for editing. Whether the result is a
    revision, a replacement or a state change is not stated. (§6.4)
17. **Is payment a recorded state?** `[04 flow 12]` says the customer pays.
    Whether FACET records a payment, a flag, or nothing at all is not stated.
    (§6.4)
18. **Cancelled versus lost.** `[02 §1.4]` records the founder saying
    cancellation is coordinator-only, requires a written reason, and does not
    count as a loss, while the rep may only mark lost. **Not restated in `04`.**
    (§6.4)
19. **Where does loss sit in the funnel?** A loss reason is required when a
    project is marked lost `[04 Q18]`, but the funnel `[04 qualification]` has
    no lost stage. (§5.5)
20. **Confirm FACET keeps no invoice records.** `[04 Q13]` answers yes to
    coordinators entering invoice records; `[04 flow 15]` places invoicing in
    SMAC; `[04 A1]` keeps invoicing out of FACET. The reading in §7.3 is an
    inference across three statements and should be confirmed in one.
21. **What is the daily-report grace period?** `[02 §1.1]` records one day, the
    weekend not consuming it, and automatic notification on expiry. **Not
    restated in `04`.** It interacts directly with per-rep working days
    `[04 C4]`. (§11)
22. **Who sets a target, and does it vary by month?** `[04 A3]` gives monthly
    SQM targets. Nothing states who assigns them or whether they change.
    (§2.2)
23. **What follows a duplicate resolution?** Duplicate companies and projects,
    including Arabic versus English spelling variants, must be flagged to the
    sales manager, who decides *who continues / shared / false flag*
    `[04 confirmed]`. What each decision then does to the records is not stated.
24. **What triggers a notification, and who receives it?** `[04 Q6]` requires a
    light notification when reps overlap; `[04 confirmed]` requires follow-ups
    chasing overdue projects, overdue quotations, unanswered catalogues and
    dormant customers. The full trigger and recipient list is not enumerated,
    and the thresholds are open `[04 D4]`.

---

## 14. Adjacent, confirmed, not yet modelled

Recorded because `04` confirms them, and because §13 items touch them. Not in
scope for the sales core.

- **Stock.** Historically a daily Excel emailed to everyone, later a shared
  Google Sheet. Open to a better approach in FACET: daily stock updates with
  history retained — e.g. daily snapshots — for later reporting
  `[04 confirmed]`.
- **Production.** The existing Sheets-based production order system **stays
  where it is for now**. The plan is to move it into FACET later
  `[04 confirmed]`.
- **Future.** AI assistant and n8n automations `[04 confirmed]`.
