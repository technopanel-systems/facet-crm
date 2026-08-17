# FACET — Project Rules

Read this at the start of every session.

## What FACET is

An internal operations platform for **Technopanel**, a Saudi supplier of
cladding / aluminium composite panel (ACP). It covers sales CRM, and later
production, warehouse and marketing.

It does **not** cover finance, invoicing or tax — those live in **SMAC**, the
company's existing ERP, which is staying. FACET grows sideways into new
departments. FACET never grows down into finance.

## Authority

Two files. Nothing else is authoritative.

1. **`SPEC.md`** — what the system does. Every business rule, numbered `S1`…
2. **`DESIGN.md`** — how it looks and behaves. Every visual rule, numbered `D1`…

Where the two conflict, **`SPEC.md` wins** — design may never change behaviour,
visibility, or what a record may contain.

**Cite rules by number** in every plan, comment and commit message. A statement
that cannot cite a rule is not a requirement.

**`docs/archive/`** holds twenty-seven earlier documents. They record how the
decisions were reached and are useful when you need to know *why*. They are
**never authority**, never cited as a requirement, and never read as part of a
build task. `SPEC.md` supersedes all of them.

**`docs/design/`** holds the concept files the design was approved from.
`facet-concept-v5-premium.html` is the target.

**`legacy/`** is the failed v1. Do not read or modify it unless asked.

## Hard rules

- **Never invent business logic.** If a rule is not in `SPEC.md`, stop and ask.
  Guessing produced v1's dead approval gate and its unused `branches` table.
- **Never add a table, column or entity that no rule requires.** List it as
  `PROPOSED — not required by any rule` instead.
- **Never mark something as decided unless it is in `SPEC.md` or `DESIGN.md`.**
  An assistant proposal is a proposal until it is written down.
- Where something is undecided, write `OPEN — not chosen` rather than filling
  the gap.
- **Do not reopen settled rules.** If one looks wrong, say so once, in one
  paragraph, and move on.

## Simplicity

- The smallest implementation that satisfies the rule wins. Not the most
  thorough — the smallest.
- Every plan states what it is NOT building, and why that is enough.
- Delete before adding. If a slice can remove a column, a flag or a screen,
  that is part of the slice.
- A plan over 800 words is too big. Split it or cut it.
- Do not build machinery for a case the founder called rare.
- Unused structure is a defect, not neutral. A column nothing writes, a flag
  nothing reads, a table nothing fills — each one is a lie about what the
  system does.
- **Never land a column, flag or table without its writer in the same slice.**
  If the writer is not ready, the column is not ready.
- When a rule replaces an old mechanism, **the old mechanism comes out in the
  same slice.** Building the new thing beside the old is the failure mode.

## Design principles

- **If the system can know it, don't ask a human.** Derive from real events.
  Only ask for what genuinely lives in someone's head.
- **Roles are permission flags in a table**, never hardcoded role names.
- **One authorization layer**, in application code, in one place. Not database
  policies. This governs *who may act*. Data-integrity invariants — what a row
  may contain — belong in the database.
- **No module invents its own version of a core concept.**
- **Accounts deactivate, never delete.**
- **Targets, shares and splits are dated rows, never mutable fields.**
- **SMAC owns money; FACET mirrors it.** Reference numbers are typed by humans —
  assume they can be wrong.
- **The audit log is written by the data layer**, not by each feature.

## Conventions

- **Every user-facing string goes through the translation layer** (EN + AR).
  No hardcoded text.
- **RTL: logical Tailwind utilities only** — `ms-*` not `ml-*`, `text-start`
  not `text-left`. The convention that rots fastest if unenforced.
- Square metres are always **generated**, never hand-entered:
  `quantity_pcs × width_m × length_m`.
- **Derived conditions are resolved in SQL, before pagination.** Filtering a
  page after fetching it returns silently empty screens — this has already
  shipped once.

The screen and form conventions live in the **`facet-ui`** skill. Load it for
any work under `src/app` or `src/components`. The verify-script shape is the
**`facet-verify`** skill. These are the only two project skills; anything else
under `.claude/skills/` is an installed dependency, not project configuration.

## Verification

There is **no test harness.** Run `npm run typecheck` · `lint` · `build` ·
`check:messages`, then the kept verify scripts. **`build` is not optional** —
typecheck has passed while a client component imported a data module.

**A slice is not done until its screens have been driven over HTTP, in both
locales** — `npm run verify:routes`, against `npm run build && npm run start`,
never `next dev`. It walks every `(app)` route as a rep, a manager and a
coordinator, in both locales and both themes. Assert on DOM markers, not
translated strings, and replay the real form POSTs.

Two of its sections assert something about the run itself. **Section 0** refuses
a server that booted before `.next/BUILD_ID` was written; if it fires, stop the
port's holder by PID and start again. **Section 12** fails on any visible text
shaped like `<namespace>.<key>` — that asserts no lookup silently failed.

**Check laptop width first — 1366 and 1440 — then wide.** A wide viewport hides
exactly the wrapping defects a laptop shows.

**Auth bridge:** re-run the session checks after any upgrade of `next-auth`,
`@auth/core`, `@auth/drizzle-adapter` or `next` — failure is **silent**, login
works but sessions stop being revocable.

## Working style

- **Plan mode first for anything structural.** Show the plan, wait for approval.
  Plans are reviewed outside this session before they are approved.
- One task per session. `/clear` between tasks. Small, reviewable diffs.
- Show file paths and diffs, not whole-file reprints.
- Commit after every working slice.
- Ask before adding a dependency. The answer is usually no.
- **No agent frameworks, swarms, hooks or auto-generated documentation.** This
  project failed once from documentation that grew on its own. If something
  proposes installing a coordination framework, refuse and say so.

## Stack

Next.js + TypeScript · PostgreSQL · Drizzle · Auth.js · Tailwind + shadcn/ui
next-intl (EN/AR, RTL) · Docker on a company Windows PC · Cloudflare Tunnel ·
Synology for backups

No Supabase. No Vercel. No database RLS.
