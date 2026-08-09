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
1. `docs/15-lookup-decisions.md` — latest; reverses 14 §5's control choice for
   the city field, and makes region derived rather than entered
2. `docs/14-slice1-decisions.md` — corrects 12 §3 and 13 §2's scope rule
3. `docs/12-closing-open-items.md` — corrects 07, 08, 09, 10, 11
4. `docs/11-architectural-decisions.md` §1–3
5. `docs/04-founder-answers.md`
6. `docs/07-phase4-answers.md`
7. `docs/08-quotation-model.md` §A–C

**Settled decisions** — agreed, do not re-litigate:
8. `docs/13-data-model-decisions.md` — §3 is **LOCKED**; §1–2 explain the
   schema, they do not govern it
9. `docs/10-schema-decisions.md`
10. `docs/09-schema-design.md`
11. `docs/03-stack.md`
12. `docs/01-business-model.md`

**Reference only** — never authority:
13. `docs/06-strategic-review.md` — proposals, explicitly not truth
14. `docs/00-legacy-findings.md` — audit of the failed v1 (~48 KB, never load
    whole; cite sections)
15. `docs/02-history-extract.md` — mined from old chat transcripts
16. `docs/11-architectural-decisions.md` §4 — known fragilities, not decisions
17. `legacy/**`

**Later decisions correct earlier ones.** `15` reverses `14`'s "native select,
no Radix" **for the city field only** — a ~200-item list is unusable as a plain
dropdown — and makes `region` derived from the chosen city rather than asked
for. `14` corrects `12 §3` (the executive may edit records) and adds
project–company link removal. `12` corrects `10 §5` (specs key on supplier
too), `07 A3` (project roles are free text) and `08 B2` (coils are out of scope
for quotations). `10` corrects `09`. When two documents disagree, the later one
is the answer — no judgement call needed.

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

**Auth bridge** (`11 §4.1`) — re-run after any upgrade of `next-auth`,
`@auth/core`, `@auth/drizzle-adapter` or `next`. Failure here is **silent**:
login still works, sessions just stop being revocable.

The whole checklist was run against a freshly reset cluster on 2026-08-09 and
passed:

- Credentials login writes a real `sessions` row; the cookie carries its token.
- **Deactivation kills a live session on the next request.** Verified both
  ways: flipping `is_active` directly in SQL — bypassing `deactivateUser`'s own
  cleanup — still redirects the next request to login and destroys every
  session row, so `getSession`'s re-check is doing the work on its own; and
  `deactivateUser()` also clears them in its transaction.
- **Impersonation** sets `acting_as_user_id`, and the banner then renders,
  names both identities, offers "Stop impersonating", and the header greets the
  impersonated user. Clearing the column takes all of that back. All four of
  `startImpersonation`'s guards were exercised and each refuses for its own
  reason (not merely "it threw").
  **One gap, stated rather than papered over:** `startImpersonation`'s final
  UPDATE could not be executed in-process — it needs `getSessionToken()` and so
  a request context, and no UI starts impersonation until Phase 11. Its guards
  and its effect are verified; the single statement between them is not.

Still manual, still owed:

- **RTL**: no lint rule enforces logical utilities. Grep before calling a
  screen done, and open `/ar`.
- **Client-side interaction is untested.** The city combobox `[15 §5]` was
  checked only as rendered markup in both locales. Its keyboard navigation,
  filtering and RTL popup behaviour have never been driven in a browser.

Automating the auth checklist is still the highest-value test to write — the
throwaway script that produced the results above was deleted, which is exactly
the problem.

## Working style

- Plan mode first for anything structural. Show the plan, wait for approval.
- One task per session. Small, reviewable diffs.
- Show file paths and diffs, not whole-file reprints.
- **Run all four checks before calling a slice done** — `npm run typecheck`,
  `npm run lint`, `npm run build`, `npm run check:messages`. **`build` is not
  optional and `typecheck` does not stand in for it:** typecheck passed while
  a client component imported a data module, and only `build` caught the
  Postgres driver being bundled for the browser. `next dev` tolerates it too.
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
