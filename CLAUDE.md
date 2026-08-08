# FACET — Project Rules

Read this at the start of every session. Keep it short; details live in `docs/`.

## What FACET is

An internal operations platform for **Technopanel**, a Saudi supplier of
cladding / aluminium composite panel (ACP).

It covers sales CRM, and later production, warehouse and marketing.
It does **not** cover finance, invoicing or tax — those live in **SMAC**, the
company's existing ERP, which is staying.

FACET grows sideways into new departments. FACET never grows down into finance.

## Document authority

When sources disagree, higher wins:

1. `docs/04-founder-answers.md` — user truth, stated directly by the founder
2. `docs/01-business-model.md` — derived from 04
2b. `docs/06-strategic-review.md` — proposals only, never treat as truth
3. `docs/03-stack.md` — technical decisions, already settled
4. `docs/00-legacy-findings.md` — audit of the failed v1
5. `docs/02-history-extract.md` — mined from old chat transcripts
6. `legacy/**` — reference only, never authority

Never treat `legacy/` code, schema or docs as a specification. v1 failed. It is
kept to understand what was attempted, not what should be built.

## Hard rules

- **Do not read or modify anything under `legacy/`** unless explicitly asked.
- **Do not reopen settled decisions.** `docs/03-stack.md` is closed. If you
  think one is wrong, say so once, in one paragraph, and move on.
- **Never invent business logic.** If a rule is not in `docs/`, stop and ask.
  Guessing is what produced v1's dead approval gate and unused `branches` table.
- **Never mark something as decided by the founder unless it appears in
  `docs/04-founder-answers.md`.** Assistant proposals are proposals until
  written down.
- Where something is undecided, write it under `OPEN — decide before schema`
  rather than filling the gap.

## Design principles

- **If the system can know it, don't ask a human.** Derive metrics from real
  events. Only ask for what genuinely lives in someone's head.
- **One authorization layer**, in application code, in one place. Not scattered
  across database policies. v1 had RLS, UI and docs disagreeing about who could
  do what.
- **No module invents its own version of a core concept.** Warehouse does not
  get its own supplier table. Finance does not get its own customer list.
- **Accounts deactivate, never delete.** History must keep pointing at a real
  person.
- **Role and target are separate.** A person has a role (what they may do) and
  optionally a target (what they are measured on).
- **SMAC reference numbers are typed by humans.** Assume they can be wrong.
  Every ERP link needs a verification state and a way to correct it.

## Working style

- Plan mode first for anything structural. Show the plan, wait for approval.
- One task per session. Small, reviewable diffs.
- Show file paths and diffs, not whole-file reprints.
- Commit after every working slice.
- Ask before adding a dependency.

## Stack (settled — see `docs/03-stack.md`)

Next.js + TypeScript · PostgreSQL · Drizzle · Auth.js · Tailwind + shadcn/ui
Docker on a company Windows PC · Cloudflare Tunnel · Synology for backups

No Supabase. No Vercel. No database RLS.
