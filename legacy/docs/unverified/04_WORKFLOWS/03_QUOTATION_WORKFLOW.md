# 03. Quotation Workflow — FACET CRM

---

## Overview

Quotations in FACET mirror the commercial data from the company's external ERP system. The CRM does not generate quotations — it records them for KPI tracking. The sales coordinator is the human bridge between ERP and CRM.

**Critical rule:** Only `sales_coordinator`, `manager`, and `super_admin` can create or modify quotations. Reps see read-only views.

---

## Quotation Creation

**Who:** Sales coordinator, from `/dashboard/quotations`

**Steps:**
1. Coordinator opens `/dashboard/quotations` and clicks "New Quotation"
2. Selects Company → this filters the Project dropdown to that company's projects
3. Selects Project (required)
4. Optionally selects "Assigned To" (the rep who owns this quotation for KPI purposes)
5. Enters ERP Quotation ID (reference number from the external ERP)
6. Sets Quote Date and Valid Until date
7. Adds one or more **Product Lines** (quotation_items):
   - Class (Class A / Class B / Class A2G2 / Class A2G1)
   - FR Rating (A2 / B1 / Normal)
   - Supplier Code (N / K / D / C / G / G1 / Y)
   - Color Code (free text, e.g. RAL 9016)
   - Thickness (4mm / 5mm / 6mm)
   - Width (m) — standard options 1.24 / 1.5 / 2 or custom
   - Length (m) — numeric
   - Number of Sheets — integer
   - Price per m² — optional, SAR
   - **Total SQM auto-calculated:** width × length × sheets (stored as GENERATED column)
8. Optionally adds **Services** (quotation_services): Cutting / Grooving / Bending / CNC with optional price/m²
9. Adds coordinator notes (internal, not visible to reps)
10. Clicks "Create Quotation"

**On save:**
- Quotation code auto-generated: `QUO-00001`, `QUO-00002`, etc.
- `quotations.sqm_quoted` auto-calculated from sum of all item total_sqm (trigger `trg_update_quotation_sqm`)
- Quotation created with `status = 'pending'`

---

## Quotation Status Flow

```
pending → submitted → won
                   ↘ lost
                   ↘ expired
                   ↘ cancelled
```

| Status | Meaning |
|---|---|
| `pending` | Just created, not yet formally submitted to client |
| `submitted` | Sent to client, awaiting decision |
| `won` | Deal accepted |
| `lost` | Client chose another supplier |
| `expired` | Valid until date passed with no decision |
| `cancelled` | Cancelled for any reason (requires cancellation_reason) |

---

## Quotation Update (Status + Invoice)

The coordinator updates quotations inline from the quotation list:

1. Clicks "Update" on any quotation row
2. An inline form appears with:
   - Status dropdown
   - SQM Invoiced (numeric)
   - SQM Delivered (numeric)
   - Cancellation Reason (required if status = cancelled)
3. Clicks "Save"

**When status changes to `won` and SQM Invoiced is entered:**
- `quotations.sqm_invoiced` updated
- `quotations.last_revised_at` timestamped
- Trigger `trg_sync_project_sqm` fires → updates `projects.quoted_sqm` and `projects.won_sqm`
- Rep's KPI dashboard reflects the updated invoiced SQM

---

## Quotation Revision

If a client requests a revised price or specification:
- Coordinator updates the existing quotation (increments `revision_number` conceptually)
- `last_revised_at` is updated on every save
- There is no formal versioning with parent/child quotations — each revision overwrites the current quotation [LIMITATION: no true version history; future invoice table will address this]

---

## Rep View of Quotations

Reps view their quotations at `/rep/quotations`. This is read-only.

**What reps can see:**
- Quotation code and ERP reference ID
- Company and project linked
- Status, revision number
- SQM quoted, SQM invoiced (if won)
- Quote date and validity period
- Expandable detail showing all product lines (class, FR, supplier, color, thickness, dimensions, SQM, price/m²) and services
- Coordinator notes are NOT visible to reps

**Filter/search:** By status, by code/company/project text

---

## KPI Impact of Quotations

When a quotation is marked won and sqm_invoiced is recorded:
- `projects.won_sqm` is updated via trigger
- This feeds the dashboard KPI "SQM Won (Quoted)"
- `quotations.sqm_invoiced` feeds the dashboard KPI "SQM Invoiced"
- Rep's performance page shows their quotation win rate and invoiced SQM

**Activity SQM (from daily reports) and Invoiced SQM (from quotations) are always displayed separately and never combined.**

---

## Current Limitations

1. **One quotation cannot produce multiple invoices.** There is no invoice table. `sqm_invoiced` is a single number on the quotation. If a deal is invoiced in two shipments, the coordinator manually sums them.
2. **No SQM split enforcement.** When two reps share a project, the coordinator assigns the quotation to one rep (`rep_id`). There is no percentage-split field to attribute partial SQM to each rep.
3. **No quotation line-item history.** If a line item is edited, the previous values are not preserved.

These are documented limitations, not bugs. See `11_ROADMAP/01_CURRENT_LIMITATIONS.md`.
