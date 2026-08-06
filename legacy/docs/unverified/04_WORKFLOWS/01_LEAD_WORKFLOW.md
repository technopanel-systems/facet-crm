# 01. Lead Workflow — FACET CRM

---

## Overview

A "lead" in FACET is any company not yet formally registered in the CRM pipeline. Lead generation is primarily the responsibility of the marketing role, though reps also register new companies they encounter in the field.

---

## Lead Entry Points

### 1. Field Rep Discovery
A rep visiting a construction site or making calls encounters a new potential client. They register the company directly from their companies page.

**Flow:**
1. Rep navigates to `/rep/companies`
2. Clicks "Register Company"
3. Fills: Company Name (Arabic or English), Type, Region, Source, optional Notes
4. Submits → `create_company_with_rep()` RPC executes
5. Company is created and immediately assigned to the rep as primary
6. No manager approval required
7. Rep can now select this company in daily reports and create projects under it

### 2. Marketing Lead Registration
A marketing team member registers a company after phone outreach or exhibition contact.

**Flow:** Identical to rep flow. Marketing role uses the same pages and same RPC.

### 3. Manager Entry
A manager registers a company from the dashboard and optionally assigns it to a rep.

**Flow:**
1. Manager navigates to `/dashboard/companies`
2. Clicks "Add Company"
3. Fills: Name, Type, Region, Source + Source Detail, Status, Assign Rep, Notes
4. Submits → `create_company_with_rep()` RPC executes
5. If a rep is selected, they are assigned as primary and notified

---

## Source Tracking

Every company has a `source` field recording how the lead originated. The two-level source system:

| Source | Sub-detail (source_detail) |
|---|---|
| Field Visit | — |
| Direct Contact | Call / Email / WhatsApp / Other |
| Referral | — |
| Exhibition | — |
| Marketing | Social Media / Website / Google / Email Marketing / Exhibition / Other |
| Other | Free text |

Both `source` and `source_detail` are stored on the company record.

---

## Post-Registration

Once a company exists:
1. Rep adds contacts (people at the company) via the company detail page
2. Rep creates projects linked to the company
3. Rep selects the company in daily activity reports
4. Manager can assign additional reps or reassign primary rep

---

## Duplicate Detection

When a new company is created:
1. The `trg_normalize_customer` trigger fires immediately, normalizing the Arabic company name
2. The manager manually triggers a duplicate scan from `/dashboard/duplicates` → "Scan for Duplicates"
3. The `detect_duplicate_companies()` RPC runs pg_trgm comparison across all active companies
4. Pairs with similarity > 0.6 are inserted into `duplicate_flags` with `classification = 'pending'`
5. Managers receive a notification for each new duplicate flag
6. Manager reviews and classifies each pair

**Note:** Duplicate detection is NOT automatic on company creation — it is a manual scan initiated by the manager. [ASSUMPTION: could be automated in future as a trigger, but currently manual]

---

## State Diagram

```
Unknown Contact
      ↓
  Discovery (field/marketing/exhibition)
      ↓
  Company Registered in CRM
      ↓ (may trigger duplicate flag)
  Duplicate Review (if flagged) ──→ Resolved / Merged / Shared
      ↓
  Contact Added
      ↓
  Project Created
      ↓
  Active Pipeline
```
