# 01. Product Vision — FACET CRM

## What FACET Is

FACET CRM is a custom-built operational sales control system for **Technopanel**, a Saudi Arabian supplier of Aluminum Composite Panels (ACP / cladding materials). It is an internal tool — not a SaaS product, not a public platform.

Live URL: crm.technopanel.com.sa

---

## The Problem It Solves

Before FACET, Technopanel managed sales operations through a Google Sheets-based CRM that failed in three specific ways:

1. **Bidirectional sync failures** — Multiple editors caused data corruption. No single source of truth.
2. **No activity accountability** — No way to verify if a rep visited a client or did nothing. Reports were self-reported with no timestamp verification.
3. **Fragmented commercial data** — Quotations lived in ERP. Projects lived in Sheets. No way to connect rep activity to invoiced revenue.

---

## What FACET Does

### 1. Daily Activity Tracking
Field reps submit one report per working day logging every customer interaction. The system timestamps submissions and marks each as on-time, late, or missing. This is the accountability layer.

### 2. Pipeline Management
Companies, contacts, and projects are structured entities. Reps manage their pipeline from New Lead through to Delivered. Stage changes are logged in an audit trail. Follow-up dates create operational urgency.

### 3. Commercial Mirroring (ERP Linkage)
Quotations generated in the ERP are mirrored into the CRM by the sales coordinator. When invoiced, the coordinator records sqm_invoiced, which becomes the true performance metric. The CRM does not replace the ERP — it mirrors it for KPI purposes.

### 4. Management Visibility
The manager dashboard shows daily compliance per rep, SQM progress vs. target, pipeline health, stale projects, follow-ups due, and duplicate company alerts.

---

## What FACET Is Not

- NOT an ERP or invoice management system
- NOT a financial or accounting system
- NOT a document management system
- NOT a WhatsApp replacement
- NOT a tender or material submittal platform
- NOT a multi-tenant SaaS product

---

## The Core KPI Distinction

| Metric | Source Table/Column | Meaning |
|---|---|---|
| Activity SQM | `activities.sqm_done` | Rep field estimate — leading indicator |
| Invoiced SQM | `quotations.sqm_invoiced` | Coordinator-confirmed commercial truth — real KPI |

**These two numbers must never be combined or treated as equivalent.**

Target attainment is measured against invoiced SQM, not activity SQM.

---

## The Sales Methodology

Technopanel operates a project-based sales model. A rep works specific construction projects, not just companies. Multiple contractors may bid on one building.

- One company → many projects
- One project → potentially multiple companies (contractor, consultant, owner)
- One project → potentially two reps (primary + shared)
- Performance measured by projects won, not just companies visited

---

## Users

| Role | Approx. Count | Primary Device |
|---|---|---|
| Sales Reps | 8–10 | Mobile/Desktop |
| Sales Manager | 1 | Desktop |
| Sales Coordinators | 2 | Desktop |
| Marketing | 1–2 | Desktop |
| System Owner (super_admin) | 1 | Desktop |

---

## Future Vision (Phased)

All future phases are additive — no schema rebuild required.

- **Near term:** n8n automations (daily report reminders, stale alerts via WhatsApp)
- **Near term:** Invoice table (proper multi-invoice per quotation)
- **Medium term:** Arabic UI / RTL toggle
- **Medium term:** Mobile-first redesign for rep pages
- **Long term:** AI lead scoring, pipeline forecasting
