# 02. Business Model — FACET CRM

## Company: Technopanel

Technopanel is a Saudi Arabian B2B supplier of Aluminum Composite Panels (ACP), also called cladding materials. The product is sold in square meters (SQM). Revenue is entirely project-based — large construction jobs where Technopanel supplies facade materials.

**Primary Market:** Saudi Arabia and GCC region  
**Sales Cycle:** Weeks to months (project-based)  
**Unit of Measurement:** Square meters (SQM) — never monetary value in the CRM  
**Primary Relationships:** Contractors, consultants, real estate developers, factory owners

---

## How Sales Works

### The Sales Funnel

```
Marketing → Suspects → Prospect (Company) → Project → Quotation → Invoice
```

1. **Marketing / Lead Generation**  
   Marketing team or assistants identify potential clients. These are contacts not yet in the formal CRM pipeline. They may be handled via phone calls before qualifying.

2. **Company Registration**  
   Once qualified, a company is created in the CRM. It is assigned to a rep as primary owner. The company record holds all contact people, relationships, and linked projects.

3. **Project Creation**  
   When a specific construction job is identified, a project is created. Projects are linked to companies and reps via junction tables. A project tracks the sales stage from New Lead to Delivered.

4. **Quotation (via ERP)**  
   When a client requests pricing, the rep communicates this need. The ERP generates the formal quotation. The sales coordinator mirrors this quotation into the CRM, linking it to the project and rep.

5. **Invoice (via ERP)**  
   When the deal is won and materials are dispatched, the ERP issues an invoice. The coordinator records the invoice's SQM against the CRM quotation. This is the commercial truth that drives KPIs.

---

## The Role of Each Team Member

### Field Sales Rep
- Registers companies they are working with
- Creates projects under those companies
- Submits one daily activity report per working day
- Updates project stages as deals progress
- Views quotations linked to their projects (read-only)

### Sales Manager
- Monitors daily compliance across all reps
- Approves new user accounts
- Reviews stale projects and follow-up dates
- Resolves duplicate company flags
- Sets monthly SQM targets per rep
- Has full read/write access to all data

### Sales Coordinator (2 people, Riyadh-based)
- Does NOT submit daily activity reports
- Creates quotation records in the CRM mirroring ERP quotations
- Updates quotation status (won, lost, expired, cancelled)
- Records invoiced SQM when ERP invoices are issued
- Can view all companies and projects (read-only except quotations)

### Marketing
- Registers companies / leads in the CRM
- Submits daily activity reports (same as rep)
- Reports to manager for company assignment decisions

---

## Performance Measurement

### Individual Rep KPIs
| KPI | Source | Calculation |
|---|---|---|
| SQM Target Attainment | `quotations.sqm_invoiced` vs `reps.monthly_target_sqm` | Sum of invoiced SQM for rep's quotations ÷ target |
| Activity Compliance | `activities.submission_status` | On-time submissions ÷ total required working days |
| Pipeline Volume | `projects.quoted_sqm` | Sum of quoted SQM across active projects |
| Win Rate | `quotations.status` | Won quotations ÷ total quotations |

### Team-Level KPIs (Manager Dashboard)
- Total SQM invoiced vs. total team target
- Daily report submission status per rep (on_time / late / missing / excused)
- Pipeline SQM by stage
- Stale projects (14+ days without stage update)
- Follow-ups due today / overdue

---

## Branches

Technopanel has regional branches. Currently seeded:
- Riyadh (Central region)
- Eastern Branch (East region)
- Southern Branch (South region)

Branches are used for filtering and reporting — they do not restrict a rep's ability to work across regions. A rep can be assigned to Riyadh but work a project in Jeddah.

---

## Duplicate Company Problem

In the Saudi/GCC market, company names vary significantly in Arabic spelling (e.g., different forms of Alef: أ / إ / ا). This creates frequent duplicate company records when different reps register the same real-world company. FACET uses pg_trgm fuzzy matching on normalized Arabic company names to detect potential duplicates. The manager reviews and classifies each pair.

---

## The ERP Boundary

The CRM is explicitly NOT the ERP. The company uses a separate ERP system (unnamed) for:
- Official quotation generation
- Invoice issuance
- Payment tracking
- Inventory management

The CRM mirrors commercial data from the ERP for KPI purposes only. The coordinator is the human bridge between ERP and CRM. There is no automated sync — it is manual entry.
