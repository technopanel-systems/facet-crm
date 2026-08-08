# 04 — Founder Answers

**Status:** User truth. Statements in Section A and B came directly from Jerom
(founder/owner of this project) during planning. They outrank
`00-legacy-findings.md`, `02-history-extract.md`, the legacy code, and any
document under `legacy/`.

**Precedence when sources disagree:** this document > production behaviour >
application code > schema.sql > docs.

Section C records decisions delegated to the planning assistant. Section D
lists what is still open — these must be answered before schema design.

---

## A. Business context

### A1. SMAC stays
Technopanel runs an existing internal ERP called **SMAC**. It handles
quotations, invoicing, finance, taxing and stock accounting. FACET does **not**
replace it.

FACET is the system of record for *work*: who owns which relationship, what
stage things are at, what was promised, and what actually moved. SMAC remains
the system of record for money.

FACET does hold some stock, production and quotation pricing data of its own —
the split is not absolute — but finance and invoicing stay in SMAC.

**FACET grows sideways** (production, warehouse, marketing modules).
**FACET never grows down** into finance, invoicing or tax.

### A2. SMAC has no integration path
There is no API and no readable database. Every link between FACET and SMAC is
a **human retyping a reference number**.

Design consequence: FACET must assume the link can be wrong. ERP reference
numbers need a verification state and a way to correct mismatches.

### A3. What the company sells
Cladding / aluminium composite panel (ACP). Technopanel is a supplier.
Targets are measured in **square metres, not currency**, tracked monthly.

---

## B. Answers to the twenty reconstructed questions

Numbering follows Section 5 of `02-history-extract.md`.

**1. "Customer" → "company"**
The customer *is* the company being dealt with. The earlier rename was a
terminology correction, not a model change.

**2. No root entity**
There is no single root. Companies, contacts and projects are intertwined.
A project may involve multiple companies (contractor, supplier, consultant
office), so **project is a first-class entity**, not a child of company.

**3. What "shared" means**
Several reps may share a company — via the same contact or different contacts.
Projects are shared the same way, possibly through different companies.

**4. Provinces, not branches**
Riyadh is the main location. Eastern and Southern provinces each have a single
rep who opens the warehouse daily. Reps sell across provinces freely — a Riyadh
rep may sell in the East and vice versa.

Province is a **label on a record**, not an access boundary. The legacy
`branch_id` concept is rejected.

**5. Company categories**
Category values exist but the current list is not trusted and needs revising.
See Section D.

**6. Activity privacy**
Activities are private to the rep. Where a company is shared or two reps act on
the same record, a light notification to the other rep is sufficient. Avoid
complexity here.

**7. Visibility is per record, not per company**
On a shared company, both reps see the **company record**. Its projects,
quotations and other records stay **private to each rep** unless the manager
explicitly shares them.

**8. Deletes are requests**
Deleting requires a stated reason and goes to the manager as a request.
On a shared company, the delete removes it only from the requesting rep's side;
the record stays for the other reps.

**8.1. Rep offboarding (new requirement)**
When a rep leaves the company and their account is closed, the manager needs a
screen to review that rep's stalled quotations, projects, contacts and tasks,
and either redistribute them across other reps or delete them.

Accounts are **deactivated, never deleted** — records must keep pointing at a
real person for history.

**9. Marketing role**
Marketing works as a normal rep with permissions, plus the ability to assign new
leads and companies. More marketing-team features may follow later.

**10.** Yes.

**11.** Yes.

**12. Role and target are separate concepts**
Sales coordinators also work as reps — an internal sales department carrying
their own target. A person has a *role* (what they may do) and optionally a
*target* (what they are measured on). These must not be conflated.

**13.** Yes.

**14. Daily-report SQM entry — delegated**
See Section C1.

**15. Activity SQM vs invoiced SQM — delegated**
Open to changing the approach entirely. See Section C1.

**16. Working days**
Weekend is Friday/Saturday. **Out-of-province reps work Saturday** — expect
their reports and activity on Saturdays, but do not count Saturday as a required
working day for them.

Working days must be a property of the rep, not a global constant.

**17. Notification channels**
In-app only for now. Email, WhatsApp and/or SMS are wanted later, possibly via a
third party. Build with a channel concept from the start even if `in_app` is the
only working value.

**18.** Yes.

**19. Marketing assignment flow**
Marketing receives the lead, registers the company with notes on what the
customer needs, then asks the manager (currently by phone) who to assign it to —
possibly marketing themselves. The manager decides.

**20. FACET is not an ERP**
FACET stays a sales-operations and internal-workflow platform. SMAC is the real
ERP and handles finance and taxing.

---

## B2. The sales flow

1. Rep adds a company (own search, marketing, referral, recommendation)
2. Company enters the rep's funnel
3. Product introduced; brochure and catalogue sent
4. Samples sent on request
5. Data sheets and compliance documents sent as needed
6. **Rep raises a quotation request in FACET** (fills in all details)
7. Sales coordinator creates the real quotation **in SMAC**
8. Quotation is **physically signed** as management approval
9. Coordinator sends the signed PDF back to the rep
10. **The sales coordinator accepts the quotation in FACET** — not the rep —
    after obtaining signatures, or returns it for an edit round
11. SMAC quotation number is recorded in FACET as a reference link
12. Customer pays
13. Rep marks the quotation as accepted for processing
14. Same signature cycle repeats
15. Coordinator raises the invoice in SMAC
16. **Coordinator records what was actually dispatched** — this is what credits
    the rep's monthly target

### Qualification
There is no formal stage list. "Qualified" is roughly **when the customer asks
for a quotation**. This is an event the system can detect on its own.

Working funnel:
`introduced → catalogue/samples → documents → quotation requested (QUALIFIED) →
paid → dispatched`

Some customers buy once; others buy repeatedly.

### Quantities diverge
Quotation quantity ≠ paid quantity ≠ dispatched quantity. Cladding is often
taken in stages, so **one quotation can produce several partial dispatches**.

Dispatch normally happens in the **same month** as the order. Dispatching before
the cladding physically ships is rare.

### Approval
Signatures are currently physical. For now, the coordinator's approval action in
FACET stands in for them. Digital signing is a possible later addition.

---

## B3. Other confirmed requirements

- **Stock:** historically a daily Excel emailed to everyone, later a shared
  Google Sheet. Open to a better approach in FACET. Daily stock updates with
  history retained (e.g. daily snapshots) for later reporting.
- **Production:** the existing Sheets-based production order system **stays
  where it is for now**. The plan is to move it into FACET later.
- **Duplicates:** duplicate companies and projects must be flagged to the sales
  manager, including Arabic vs English spelling variants. Manager decides:
  who continues / shared / false flag.
- **Reporting has two layers:** silent system-recorded activity (lead added,
  catalogue sent, dispatch) and explicit rep-written reports where the rep picks
  a company, contact or project and records a visit or call with what happened.
- **Performance** should combine some mix of actions, target, conversion and
  reporting timeliness. Exact formula not yet decided.
- **Follow-ups** should chase overdue projects, overdue quotations, catalogues
  sent with no answer, and customers dormant beyond some period.
- **Two pipelines:** the main CRM is filtered to qualified leads; unqualified
  leads sit in a separate, lighter pipeline.
- **Future:** AI assistant and n8n automations.

---

## C. Decisions delegated to the planning assistant

The founder explicitly delegated these. They are agreed, not proposals.

### C1. Metrics are derived, not typed
**Reps do not enter `sqm_done` on daily reports.** Achieved SQM is derived from
the dispatch records the coordinator enters — a real event, in the same month,
from a reliable source. Numbers typed from memory at the end of a day become
permanent guesses.

This also resolves question 15: with `sqm_done` removed there is no second SQM
metric to reconcile. **One number, one source.**

`sqm_expected` is a forecast and does need a human — but it belongs on the
**project**, set at creation and updated as things change. The pipeline total is
the sum. Ask once, not daily.

**General rule for the whole build:** if the system can know it, do not ask a
human. Only ask for what genuinely lives in someone's head.

### C2. Accounts deactivate, never delete
Required by 8.1. Also covers long leave.

### C3. Notifications carry a channel from day one
Required by 17. Adding a column later is cheap; rewriting every notification
call site is not.

### C4. Working days belong to the rep
Required by 16. A global weekend constant would force an exception branch into
every compliance report.

---

## D. Open — decide before schema

1. **Company categories.** The existing list is not trusted and needs revising.
   What are the real company types? (Contractor, consultant office, supplier,
   fabricator, direct client, government…?)
2. **Shared-project SQM split.** When a project is shared between reps and SQM
   is dispatched, how is the credit divided? Equally, by a set percentage, by
   who raised the quotation, or manually by the manager?
3. **Performance formula.** Which inputs, and what weight each carries.
4. **Follow-up thresholds.** How many days before a quotation, catalogue or
   dormant customer is flagged overdue.
5. **Quotation validity period.** Stated as "to figure out".
6. **Unqualified pipeline.** What it holds and what moves a lead out of it.
