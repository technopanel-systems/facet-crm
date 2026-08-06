# AI Business Context — FACET CRM
> Business logic, rules, and Saudi market context for AI agents continuing development.

---

## The Business in One Paragraph

Technopanel sells aluminum composite panels (ACP) to construction projects in Saudi Arabia. Sales reps manage relationships with contractors, consultants, and developers. A single building project may have 3–5 companies bidding on the facade work. Technopanel's reps sell to as many of those companies as possible. Deals are won in square meters (SQM), not monetary values — the CRM never stores prices as KPIs.

---

## How Performance is Measured

### Real KPI (What Actually Matters)
`quotations.sqm_invoiced` — SQM that has been invoiced in the ERP and entered by the coordinator. This is the commercial truth.

### Leading Indicator (What Reps Report)
`activities.sqm_done` — SQM the rep says they confirmed in field discussions. Rep-estimated. Not verified. Used to show daily effort, not business outcomes.

### Target
`reps.monthly_target_sqm` — Set by manager. Measured against invoiced SQM, not activity SQM.

**Never conflate these. Never add them. Never compare them as equivalent.**

---

## The Coordinator's Role

The sales coordinator is NOT a sales rep. They:
- Work in the back office
- Mirror ERP quotations into the CRM
- Record invoice amounts when deals close
- Do NOT submit daily activity reports
- Can see all companies and projects (read-only)
- Have full control over quotations

The coordinator is the bridge between the ERP (source of commercial truth) and the CRM (analytics + accountability layer).

---

## Business Rules Every Developer Must Know

### BR-001: Saudi Weekend
```
Friday (DOW=5) = OFF. Saturday (DOW=6) = OFF.
Never penalize a rep for not submitting on these days.
```

### BR-002: Submission Grace Period
```
Submitting Monday for Sunday's work = ON TIME
Submitting Tuesday for Sunday's work = LATE
The "next working day" calculation skips weekends AND company holidays.
```

### BR-003: No Free-Text Companies
```
Reps must select companies from their assigned dropdown.
Free-text company names in activities are legacy data only.
All new submissions must have company_id populated.
```

### BR-004: Loss Reason Required
```
When stage changes to 'Lost', a reason MUST be selected.
Canonical reasons: Price | Competitor | Timeline | No Budget |
                   Specification Mismatch | No Response | Other
The stage change is blocked in UI until reason is provided.
```

### BR-005: Quotations Are Coordinator-Only
```
Reps CANNOT create quotations.
Reps see READ-ONLY view of their own quotations.
The quotation form exists ONLY at /dashboard/quotations.
This is intentional design, not a bug.
```

### BR-006: Junction Tables Are The Access Boundary
```
A rep's access to a company = row exists in company_reps
A rep's access to a project = row exists in project_reps
No other mechanism controls this.
shared_with text columns DO NOT EXIST and must NEVER be added.
```

### BR-007: Two Reps on One Entity Is Normal
```
Two reps on one company = both have company_reps rows (one 'primary', one 'shared')
Two reps on one project = both have project_reps rows
This is legitimate business scenario, not a data error.
```

### BR-008: Activity Isolation on Shared Entities
```
If Rep A and Rep B both work Company X:
- Rep A sees only Rep A's activities on Company X
- Rep B sees only Rep B's activities on Company X
- Manager sees all activities from all reps
```

### BR-009: Atomic Creation Only
```
NEVER: INSERT into projects + INSERT into project_reps (separate calls)
ALWAYS: supabase.rpc('create_project_with_rep', {...})
If the junction insert fails, the entity is invisible to the rep.
Same rule for create_company_with_rep.
```

### BR-010: Arabic Normalization
```
All company names are normalized on INSERT/UPDATE.
Stored in: companies.company_name_normalized
Purpose: duplicate detection via pg_trgm similarity
Normalizations: strip diacritics, unify Alef variants, ة→ه, ى→ي, remove ال
```

---

## Dropdown Canonical Values (Enforce These Exactly)

Any value not in these lists will fail a database CHECK constraint.

```
company_type:    Factory | Advertising | Real Estate | Owner | Consultant |
                 Contractor | Station Management | Workshop | Other

region:          Central | West | East | North | South | Foreign

source:          Field Visit | Direct Contact | Referral | Exhibition | Marketing | Other

interaction:     Visit | Call | WhatsApp | Email | Meeting | Site Visit

project_stage:   New Lead | Catalog Sent | Quotation Sent | Under Review |
                 Won | In Production | Delivered | Lost

loss_reason:     Price | Competitor | Timeline | No Budget |
                 Specification Mismatch | No Response | Other

quotation_status: pending | submitted | won | lost | expired | cancelled

product_class:   Class A | Class B | Class A2G2 | Class A2G1

fr_rating:       A2 | B1 | Normal

supplier_code:   N | K | D | C | G | G1 | Y

thickness_mm:    4 | 5 | 6

service_type:    Cutting | Grooving | Bending | CNC

absence_type:    sick | annual_leave | eid_vacation | other
```

---

## What NOT to Build or Assume

Do NOT build these — they are outside the scope of this CRM:
- Invoice payment tracking
- Inventory management
- Tender submission workflows
- WhatsApp messaging (use n8n for that)
- Email sending from the app
- ERP replacement features
- Customer-facing portals
- Supplier management

Do NOT assume these patterns from generic CRMs:
- "Contacts own deals" — Projects belong to companies, not contacts
- "Pipeline by rep" — Pipeline is by project stage, not by rep
- "Revenue tracking" — The CRM tracks SQM, not money
- "Lead scoring = automated" — No AI scoring yet, all manual
