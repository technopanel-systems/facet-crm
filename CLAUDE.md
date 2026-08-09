# FACET — Project Rules

Read this at the start of every session. Keep it short; details live in `docs/`.

## What FACET is

An internal operations platform for **Technopanel**, a Saudi supplier of
cladding / aluminium composite panel (ACP). It covers sales CRM, and later
production, warehouse and marketing.

It does **not** cover finance, invoicing or tax — those live in **SMAC**, the
company's existing ERP, which is staying. FACET grows sideways into new
departments. FACET never grows down into finance.

Current phase and model/skill routing: `docs/05-roadmap.md`.

## Document authority

When sources disagree, higher wins.

**User truth** — stated directly by the founder:
1. `docs/14-slice1-decisions.md` — latest; corrects 12 §3 and 13 §2's scope rule
2. `docs/12-closing-open-items.md` — corrects 07, 08, 09, 10, 11
3. `docs/11-architectural-decisions.md` §1–3
4. `docs/04-founder-answers.md`
5. `docs/07-phase4-answers.md`
6. `docs/08-quotation-model.md` §A–C

**Settled decisions** — agreed, do not re-litigate:
7. `docs/13-data-model-decisions.md` — §3 is **LOCKED**; §1–2 explain the
   schema, they do not govern it
8. `docs/10-schema-decisions.md`
9. `docs/09-schema-design.md`
10. `docs/03-stack.md`
11. `docs/01-business-model.md`

**Reference only** — never authority:
12. `docs/06-strategic-review.md` — proposals, explicitly not truth
13. `docs/00-legacy-findings.md` — audit of the failed v1 (~48 KB, never load
    whole; cite sections)
14. `docs/02-history-extract.md` — mined from old chat transcripts
15. `docs/11-architectural-decisions.md` §4 — known fragilities, not decisions
16. `legacy/**`

**Later decisions correct earlier ones.** `14` corrects `12 §3` (the executive
may edit records) and adds project–company link removal. `12` corrects
`10 §5` (specs key on supplier too), `07 A3` (project roles are free text) and
`08 B2` (coils are out of scope for quotations). `10` corrects `09`. When two
documents disagree, the later one is the answer — no judgement call needed.

Never treat `legacy/` code, schema or docs as a specification. v1 failed. It is
kept to understand what was attempted, not what should be built.

## Hard rules

- **Do not read or modify anything under `legacy/`** unless explicitly asked.
- **Do not reopen settled decisions.** If one looks wrong, say so once, in one
  paragraph, and move on. Anything marked **LOCKED** requires new founder input
  in a new user-truth document — re-reading the old text is not new information.
- **Never invent business logic.** If a rule is not in `docs/`, stop and ask.
  Guessing produced v1's dead approval gate and its unused `branches` table.
- **Never add a table, column or entity that no document requires.** List it
  as `PROPOSED — not required by any document` instead.
- **Never mark something as founder-decided unless it appears in a user-truth
  document.** Assistant proposals are proposals until written down.
- **Changes follow the document that asked for them, at the scope it asked
  for.** Correct, harmless structure is left alone (`13 §2`).
- Where something is undecided, write it under `OPEN — not chosen` rather than
  filling the gap.

## Design principles

- **If the system can know it, don't ask a human.** Derive from real events.
  Only ask for what genuinely lives in someone's head.
- **Roles are permission flags in a table**, never hardcoded role names.
  Adding a role must be configuration, not code.
- **One authorization layer**, in application code, in one place. Not database
  policies. v1 had RLS, UI and docs disagreeing about who could do what.
  This governs **who may act**. Data-integrity invariants — what a row may
  contain — belong in the database (`13 §1`).
- **No module invents its own version of a core concept.** Warehouse gets no
  supplier table of its own; finance gets no customer list.
- **Accounts deactivate, never delete.** History must keep pointing at a real
  person.
- **Role and target are separate.** A person has a role (what they may do) and
  optionally a target (what they are measured on). Targets are SQM only.
- **Targets and shares are dated rows, never mutable fields.** Changing one
  must not rewrite history.
- **Sharing is manager-initiated.** Reps request by phone; the manager acts.
  Assignment hands a record over; sharing grants access to a record someone
  else still holds.
- **SMAC owns money; FACET mirrors it.** Where the two disagree, SMAC is
  correct. Reference numbers are typed by humans — assume they can be wrong.
- **The audit log is written by the data layer**, not by each feature.

## Conventions

- **Every user-facing string goes through the translation layer** (EN + AR).
  No hardcoded text, from the first screen.
- **RTL: logical Tailwind utilities only** — `ms-*` not `ml-*`, `pe-*` not
  `pr-*`, `text-start` not `text-left`. See the README substitution table.
  This is the convention that rots fastest if unenforced.
- Square metres are always **generated**, never hand-entered:
  `quantity_pcs × width_m × length_m`. Quotation lines are sheets; the
  application writes `form_factor = 'sheet'` (`13 §2`).

## Verification debt

There is **no test harness**. What is automated, and what is not:

- `npm run typecheck` · `npm run lint` · `npm run build` — the build is not
  optional: it catches a client component importing a data module, which
  `next dev` tolerates and which ships the database driver to the browser.
- `npm run check:messages` — EN and AR carry the same key tree and the same
  ICU placeholders.
- **Nothing tests behaviour.** Visibility, audit writes and the business rules
  were checked with throwaway scripts, which is not the same as a suite.

Still manual, still owed:

- **Auth bridge** (`11 §4.1`) — after any upgrade of `next-auth`, `@auth/core`,
  `@auth/drizzle-adapter` or `next`. Failure here is **silent**: login still
  works, sessions just stop being revocable. Credentials login and database
  sessions were re-verified against the current cluster on 2026-08-09;
  **deactivation and impersonation have still not been re-run there.**
- **RTL**: no lint rule enforces logical utilities. Grep before calling a
  screen done, and open `/ar`.

Automating the auth checklist is still the highest-value test to write.

## Working style

- Plan mode first for anything structural. Show the plan, wait for approval.
- One task per session. Small, reviewable diffs.
- Show file paths and diffs, not whole-file reprints.
- Commit after every working slice.
- Ask before adding a dependency.
- Host-side `db:*` scripts read `DATABASE_URL` from `.env`; the app container
  builds its own connection from `POSTGRES_*`. They can disagree — and
  `drizzle-kit` reports an auth failure by exiting 1 with no message.

## Stack (settled — see `docs/03-stack.md`)

Next.js + TypeScript · PostgreSQL · Drizzle · Auth.js · Tailwind + shadcn/ui
next-intl (EN/AR, RTL) · Docker on a company Windows PC · Cloudflare Tunnel ·
Synology for backups

No Supabase. No Vercel. No database RLS.
