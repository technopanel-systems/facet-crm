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
1. `docs/18-slice3-decisions.md` — latest; dispatch, credit splits and targets.
   Credit with no split goes to **the rep on the dispatch**, splits divide
   **equally and are rare**, and **the contributor is withdrawn**
2. `docs/17-product-lookup-decisions.md` — seeds the suppliers, makes
   **colour free text rather than a lookup**, reseeds the thicknesses, and frees
   the quotation screen from SMAC's layout
3. `docs/16-slice2-decisions.md` — the quotation chain. FACET computes the
   money, VAT defaults to 15%, expiry is a sweep, and **`accepted` is internal
   approval, never a won deal**
4. `docs/15-lookup-decisions.md` — reverses 14 §5's control choice for the city
   field, and makes region derived rather than entered
5. `docs/14-slice1-decisions.md` — corrects 12 §3 and 13 §2's scope rule
6. `docs/12-closing-open-items.md` — corrects 07, 08, 09, 10, 11
7. `docs/11-architectural-decisions.md` §1–3
8. `docs/04-founder-answers.md`
9. `docs/07-phase4-answers.md`
10. `docs/08-quotation-model.md` §A–C

**Settled decisions** — agreed, do not re-litigate:
11. `docs/13-data-model-decisions.md` — §3 is **LOCKED**; §1–2 explain the
    schema, they do not govern it
12. `docs/10-schema-decisions.md`
13. `docs/09-schema-design.md`
14. `docs/03-stack.md`
15. `docs/01-business-model.md`

**Reference only** — never authority:
16. `docs/06-strategic-review.md` — proposals, explicitly not truth
17. `docs/00-legacy-findings.md` — audit of the failed v1 (~48 KB, never load
    whole; cite sections)
18. `docs/02-history-extract.md` — mined from old chat transcripts
19. `docs/11-architectural-decisions.md` §4 — known fragilities, not decisions
20. `legacy/**`

**Later decisions correct earlier ones.** `18` closes the last open item in
`04 D2` — shared credit divides **equally**, and the manager sets a split's
**membership**, never its proportions; makes **the rep named on the dispatch**
take 100% when no split is in force, because a project's owner is a mutable
field and crediting it would rewrite past months; **withdraws `07 D3`'s
contributor** and `09 §4.2`'s null percentage with it; forbids backdating a
split; and extends `16 §8`'s shape by one step so `can_dispatch` can search
company **names** and see every dispatch — without which the only role holding
the flag could not record a direct dispatch at all. `17` fills the supplier lookup with
four codes — **N, K, D, C; `08 B1`'s G, G1 and Y are dropped** — which is what
finally lets a quotation line be saved; makes the colour a typed value rather
than a list, so `colour_id` is always null and `custom_colour` carries every
line; reseeds the thicknesses as 2–8 mm with **4 mm the only standard row**;
and closes `16 §10`'s naming question — the generated product name is FACET's
own, 4 mm is omitted, and the screen is not a copy of SMAC's form. `16` settles
who fills the quotation
money columns (FACET computes them) and draws the line `07 D4` and `10 §11`
will otherwise blur: **`end_state = 'accepted'` is internal approval, not a won
deal** — the customer commits at payment. `15` reverses `14`'s "native select,
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
- `npm run verify:slice2` — **the first behavioural check that is kept rather
  than thrown away.** Development only, like `dev:fixtures`. It drives
  `src/lib/quotations.ts` in process and asserts: the arithmetic against real
  quotation 9592 (`86.3040 m²`, `10,356.48`, `1,553.47`, `11,909.95`); the
  request is version 1; issuing freezes the lines; a revision supersedes and
  carries them forward; every `can_approve_quotation` gate refuses a rep **with
  its own message**, not merely by throwing; payment ordering; expiry marks an
  overdue thread, skips a paid one, and audits under a null actor; and
  qualification is derived. It found two real bugs on its first run. Since
  `17 §1` it needs `npm run db:seed` first — the supplier fixture it used to
  insert for itself is gone, because suppliers are seeded.
- `npm run verify:slice3` — the same shape, for dispatch, credit splits and
  targets. Development only; needs `db:seed` and `dev:fixtures`. It drives
  `src/lib/{dispatches,credit-splits,targets}.ts` in process and asserts, in
  thirteen sections: every gate refuses **with its own message**; the payment
  gate `[07 C3]`, and that company and rep are **derived from the thread**, not
  typed `[18 §7]`; a direct dispatch needs no payment but is stamped with the
  coordinator's approval `[07 C6]` and reads back as direct; **recording a
  dispatch writes no split row** `[12 §1]`; with no split the dispatch's own rep
  takes 100% `[18 §1]`; **a later generation does not change an earlier
  dispatch's credit** — the central claim `[07 D3]`; equal division loses
  nothing, asserted as a pure function `[18 §5]`; a same-month target
  correction writes a **second row**, and no target row means `null`, never
  zero; achievement ignores service m², quoted m² and `accepted` alike; and the
  `18 §2` visibility grant in **both** directions — the coordinator sees every
  dispatch and the company *name*, and still cannot open the company record.
  **It found two real bugs on its first run**, both recorded below.
  It creates its own reps per run, because achievement is a whole-database
  monthly total and the script keeps its rows `[12 §7]` — reusing the shared
  fixture accounts made the second run count the first run's square metres.
- **Almost nothing else tests behaviour.** The auth checklist and Slice 1's
  visibility rules were checked with throwaway scripts, which is not the same
  as a suite. `verify:slice2` and `verify:slice3` are the shape the rest should
  take.

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
- **Client-side interaction is untested.** The city combobox `[15 §5]` and the
  quotation line editors were checked only as rendered markup in both locales —
  served over HTTP, asserted on the DOM, `200` for the raiser and the
  coordinator and `404` for an unrelated rep. Their keyboard navigation,
  filtering, row add/remove and RTL popup behaviour have never been driven in a
  browser. (`17 §2` deleted one of the things on this list: the colour
  standard/custom switch is now a plain text input with no state.)
  **Two traps when asserting on that markup**, both hit on 2026-08-09:
  next-intl ships the whole message catalogue to every page, so grepping for a
  translated string proves nothing about what rendered — assert on a DOM marker
  like `name="smacReference"`. And a panel may be legitimately absent because
  of record state, not permissions.
- **A quotation line now saves against a clean database, and that was driven
  rather than assumed** `[17 §1]`. On 2026-08-10, in a scratch database created
  beside the dev one — `drizzle-kit migrate`, `db:seed`, `dev:fixtures`,
  dropped afterwards — `verify:slice2` passed in full, and the **real form POST
  was replayed over HTTP**: Next renders the no-JS action envelope as
  `$ACTION_*` hidden inputs, so re-posting those with the line fields drives
  `createQuotationAction` for real. It returned `303` to the new thread and
  wrote `custom_colour = '168'`, `colour_id` null, supplier `N`, 4 mm,
  `86.3040 m²` / `10,356.48` / `1,553.47` / `11,909.95`.
  **That replay is the one piece not kept** — `scripts/verify-slice2.ts` still
  stops at the data layer, so the form's own parsing (`readLine`) has no
  standing check.
- **`product_colours` is empty on purpose and permanently** `[17 §2]` — the
  colour is typed. `verify:slice2` inserts one dev-only colour row, solely to
  exercise the "never both" half of the CHECK that no screen can reach.
- **Slice 3's screens were driven over HTTP on 2026-08-10**, not merely
  compiled: both locales `200` for a coordinator and a rep; `/dispatches/new`
  `404` for a rep and `200` for the coordinator; the linked form offering no
  company or rep field at all `[18 §7]`; the direct form finding companies by
  name `[18 §2]`; and **the real form POST replayed**, which returned `303` and
  wrote a direct dispatch of `12.5000 m²` with `quotation_thread_id` null and
  the coordinator stamped in `approved_by_user_id` `[07 C6]`. The project
  screen showed the credit-split checkbox list with **no percentage input
  anywhere** `[18 §3]`, and `/targets` offered the set-target control to the
  manager and not to the rep. **A trap worth keeping:** `$ACTION_ID_…` and
  `$ACTION_REF_n` carry **no `value` attribute** — a scraper that requires one
  drops them and Next answers *"Failed to find Server Action"*. And on
  `/targets`, `name="period"` belongs to the month filter as well as the
  set-target form; `name="sqm"` is the marker that distinguishes them.
  That replay is **not kept** — `verify-slice3.ts` stops at the data layer, so
  the form's own parsing has no standing check, exactly as for Slice 2.
- **Two bugs `verify:slice3` caught on its first run**, both real:
  `setCreditSplit` asked project visibility before the flag, which made
  `12 §1`'s grant to the **sales coordinator** unusable — `16 §8` gives that
  role no project visibility, so a founder-granted flag was dead. And the
  stored percentages were assigned in submission order while the read ordered
  by name, so the rep holding `33.34%` need not have been the rep credited
  `33.3334 m²`. Both are fixed and both are now asserted.

Automating the auth checklist is still the highest-value test to write — the
throwaway script that produced the results above was deleted, which is exactly
the problem. `scripts/verify-slice2.ts` is the pattern to copy.

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
