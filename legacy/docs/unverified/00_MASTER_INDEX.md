```markdown
# FACET CRM — Master Documentation Index
> Version: 1.1 | Generated: June 2026 | Status: Authoritative
> This is the primary entry point for all FACET CRM documentation.

---

## Project Quick Reference

| Item | Value |
|---|---|
| Product | FACET CRM |
| Company | Technopanel (Saudi Arabia) |
| Live URL | crm.technopanel.com.sa |
| Repository | github.com/technopanel-systems/facet-crm |
| Stack | Next.js 14, Supabase, Vercel, Tailwind CSS |
| Database | PostgreSQL (Supabase, Bahrain region) |
| Status | Production — Active Development |

---

## Documentation Map

### 01 — Product
| File | Description |
|---|---|
| [01_PRODUCT_VISION.md](01_PRODUCT/01_PRODUCT_VISION.md) | What FACET is, why it exists, what it solves |
| [02_BUSINESS_MODEL.md](01_PRODUCT/02_BUSINESS_MODEL.md) | How the business operates and how the CRM supports it |
| [03_GLOSSARY.md](01_PRODUCT/03_GLOSSARY.md) | Canonical definitions for every term used in the system |

### 02 — Business Rules
| File | Description |
|---|---|
| [01_BUSINESS_RULES.md](02_BUSINESS_RULES/01_BUSINESS_RULES.md) | All operational rules the system must enforce |
| [02_APPROVAL_RULES.md](02_BUSINESS_RULES/02_APPROVAL_RULES.md) | What requires approval, who approves, what happens |
| [03_PERMISSION_RULES.md](02_BUSINESS_RULES/03_PERMISSION_RULES.md) | Who can do what — the complete permission model |

### 03 — Users
| File | Description |
|---|---|
| [01_USER_ROLES.md](03_USERS/01_USER_ROLES.md) | Every role, its purpose, routing, and restrictions |
| [02_ACCESS_MATRIX.md](03_USERS/02_ACCESS_MATRIX.md) | Full table of role × resource × action |

### 04 — Workflows
| File | Description |
|---|---|
| [01_LEAD_WORKFLOW.md](04_WORKFLOWS/01_LEAD_WORKFLOW.md) | How leads are captured and qualified |
| [02_CUSTOMER_WORKFLOW.md](04_WORKFLOWS/02_CUSTOMER_WORKFLOW.md) | Full company lifecycle from creation to management |
| [03_QUOTATION_WORKFLOW.md](04_WORKFLOWS/03_QUOTATION_WORKFLOW.md) | Quotation creation, revision, invoicing |
| [04_PROJECT_WORKFLOW.md](04_WORKFLOWS/04_PROJECT_WORKFLOW.md) | Project lifecycle including stage changes and history |
| [05_NOTIFICATION_WORKFLOW.md](04_WORKFLOWS/05_NOTIFICATION_WORKFLOW.md) | When notifications fire, to whom, for what |

### 05 — Database
| File | Description |
|---|---|
| [01_DATABASE_OVERVIEW.md](05_DATABASE/01_DATABASE_OVERVIEW.md) | Schema overview, conventions, extensions |
| [02_TABLES.md](05_DATABASE/02_TABLES.md) | Every table: columns, types, constraints, purpose |
| [03_RELATIONSHIPS.md](05_DATABASE/03_RELATIONSHIPS.md) | Entity relationships and junction table architecture |
| [04_RLS_POLICIES.md](05_DATABASE/04_RLS_POLICIES.md) | Every RLS policy — verified from production |
| [05_FUNCTIONS.md](05_DATABASE/05_FUNCTIONS.md) | All PostgreSQL functions and RPCs |
| [06_TRIGGERS.md](05_DATABASE/06_TRIGGERS.md) | All database triggers and what they do |
| [07_STORAGE.md](05_DATABASE/07_STORAGE.md) | Storage buckets (currently none in use) |

### 06 — Architecture
| File | Description |
|---|---|
| [01_SYSTEM_ARCHITECTURE.md](06_ARCHITECTURE/01_SYSTEM_ARCHITECTURE.md) | High-level system design |
| [02_FRONTEND.md](06_ARCHITECTURE/02_FRONTEND.md) | Next.js structure, routing, component patterns |
| [03_BACKEND.md](06_ARCHITECTURE/03_BACKEND.md) | API routes, Supabase client usage, data flow |
| [04_AUTHENTICATION.md](06_ARCHITECTURE/04_AUTHENTICATION.md) | Auth flow, session management, middleware |

### 07 — API
| File | Description |
|---|---|
| [01_API_OVERVIEW.md](07_API/01_API_OVERVIEW.md) | API design philosophy, conventions |
| [02_ENDPOINTS.md](07_API/02_ENDPOINTS.md) | Every API route with request/response specs |

### 08 — Reporting
| File | Description |
|---|---|
| [01_REPORTS.md](08_REPORTING/01_REPORTS.md) | What reports exist, how they are calculated |
| [02_DASHBOARDS.md](08_REPORTING/02_DASHBOARDS.md) | Dashboard KPIs, data sources, logic |

### 09 — Operations
| File | Description |
|---|---|
| [01_DEPLOYMENT.md](09_OPERATIONS/01_DEPLOYMENT.md) | How to deploy, rollback, environment setup |
| [02_ENVIRONMENT_VARIABLES.md](09_OPERATIONS/02_ENVIRONMENT_VARIABLES.md) | All env vars, where they live, what they do |
| [03_BACKUPS.md](09_OPERATIONS/03_BACKUPS.md) | Backup strategy and recovery procedures |

### 10 — Quality
| File | Description |
|---|---|
| [01_TESTING.md](10_QUALITY/01_TESTING.md) | Manual test checklists per feature |
| [02_SECURITY_AUDIT.md](10_QUALITY/02_SECURITY_AUDIT.md) | Security posture, known risks, mitigations |
| [03_TECHNICAL_DEBT.md](10_QUALITY/03_TECHNICAL_DEBT.md) | Known debt, legacy columns, cleanup backlog |

### 11 — Roadmap
| File | Description |
|---|---|
| [01_CURRENT_LIMITATIONS.md](11_ROADMAP/01_CURRENT_LIMITATIONS.md) | What the system cannot do today |
| [02_FUTURE_FEATURES.md](11_ROADMAP/02_FUTURE_FEATURES.md) | Planned phases and feature backlog |


---

## How to Use This Documentation

**If you are a new developer:** Start with `13_AI_CONTEXT/AI_PROJECT_CONTEXT.md`, then read `07_ARCHITECTURE/01_SYSTEM_ARCHITECTURE.md`.

**If you are an AI agent continuing development:** Read all three files in `13_AI_CONTEXT/` before writing a single line of code.

**If you need to understand a business rule:** Go to `02_BUSINESS_RULES/`.

**If you need to understand the database:** Check the theoretical structural layout in `05_DATABASE/02_TABLES.md` or cross-reference the live raw configurations under `docs/truth/exports/` in section `06`.

**If something is broken:** Check `11_QUALITY/03_TECHNICAL_DEBT.md` first — the bug may already be documented.

---

## Documentation Confidence

This documentation was reconstructed from multiple sources cross-referenced against each other:
- Production code (GitHub, all files)
- Live Supabase schema (tables, constraints, functions, triggers, RLS policies extracted directly)
- Multi-session Claude development logs (Phases 1–6)
- Gemini audit report (corrected and verified)
- Founder clarifications

Where conflicts existed between sources, production code and database exports were treated as authoritative. Assumptions are marked with `[ASSUMPTION]` inline.

```