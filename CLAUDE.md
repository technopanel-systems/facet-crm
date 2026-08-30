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
  **But a logical margin resolves against the element's OWN direction**, so
  `ms-auto` on a run carrying `dir="ltr"` compiles to `margin-left` and lands
  on the wrong side in Arabic. **Four sightings — the rail, `/companies`, the
  board, the filter chip — and what they share is a POSITION, not a string:**
  any `ms-*` or `me-*` on an element that itself carries `dir`. They were
  `ms-auto` twice, `ms-2` once and `ms-1.5` once, so a sweep grepping the one
  utility named here finds under half of them. **Where a flex parent already
  supplies a `gap`, delete the margin** — it is a second spacing mechanism
  stacked on a working one, and that is the smaller fix; where it is
  load-bearing, the rail and the board, move it onto a neighbour that carries
  no `dir`. A logical utility is not protection when something nearby sets a
  direction.
- **A Tailwind class that compiles to nothing fails no check.** Tailwind scans
  the SOURCE TEXT, so a bare `/` inside an arbitrary value reads as the opacity
  modifier and an escaped quote reaches the stylesheet as a literal backslash —
  either way the declaration is dropped or malformed, in silence. The checkbox
  shipped **tickless** through a green `build`, and only reading the emitted CSS
  caught it. Same family: what `md:w-59` actually emits, and whether a closed
  `<details>` can have its children re-shown. **Read the compiled stylesheet
  when a visual change does not appear** — `build` cannot tell you.
- Square metres are always **generated**, never hand-entered:
  `quantity_pcs × width_m × length_m`.
- **Derived conditions are resolved in SQL, before pagination.** Filtering a
  page after fetching it returns silently empty screens — this has already
  shipped once.
- **A Drizzle column in a `sql` template keeps its table qualifier only when
  the outer query joins something.** In a correlated subquery with no join both
  sides render bare and resolve inside the inner table — `where "dispatch_id" =
  "id"` is never true, returns zero, and raises no error. This has bitten three
  times: sessions 5, 6 and 1b-3, the last shipping wrong numbers until a verify
  assertion caught it. Name both tables outright in any correlated subquery, and
  assert a derived figure at every reader, not one.
- **The other half of that trap is the untyped `sql` parameter**, in three
  variants, all silent in a different way. `coverage.ts` cites this file for it,
  so it is written down here rather than in one module's comment.
  - **A value interpolated into a `sql` template becomes a bound parameter, and
    Postgres types it `text`.** The comparison then reads `integer > text` and
    the query dies with `42883`. Cast it — `::int`, `::date` — at every site.
  - **`sql<T>` is a type ASSERTION, not a decoder.** Drizzle applies a column's
    decoder only to that column; a raw expression comes back as the driver left
    it. `sql<Date>` returned a string, `typecheck` · `lint` · `build` all
    passed, and every `/dispatches` request 500'd on `a.getTime is not a
    function`. Borrow the column's own mapper with `.mapWith(table.column)`.
  - **An untyped join column drops rows rather than failing.** `audit_log`'s
    `entity_id` is text; INNER JOINed against a uuid it silently returns
    nothing, and the queue reading it is empty for ever with no error.

The screen and form conventions live in the **`facet-ui`** skill. Load it for
any work under `src/app` or `src/components`. The verify-script shape is the
**`facet-verify`** skill. These are the only two project skills; anything else
under `.claude/skills/` is an installed dependency, not project configuration.

## Verification

There is **no test harness.** Run `npm run typecheck` · `lint` · `build` ·
`check:messages`, then the kept verify scripts. **`build` is not optional** —
typecheck has passed while a client component imported a data module.
Derived conditions — quiet, overdue, whose move — are resolved in SQL before
pagination, never in a screen. This has shipped broken once and fails silently.

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

**A check can be wrong in the direction that matters, and this has happened
eleven times.** Three shapes. **A wrong assertion:** `§17` once asserted the
*inverse* of `D20` on its own markers, so it went green over the thing the rule
forbids. **An assertion that reads nothing:** four page-one reads with no total
guard, three of them negatives, all correct only because the fixture rows
happened to be newest. **And the mirror — a check that FAILS for the wrong
reason:** `§24` summed one page's group headers against the whole scope's total,
an equality that stops holding the moment a pile falls off page one, and went
red on a screen that had been correct all along. A wrong red burns the suite's
credibility exactly as a false green does, and it is the shape that gets a
correct screen "fixed": `S45-1` opened with a founder decision to rewrite
working code. So — **an assertion prints what it read** (`saw N of TOTAL`), **a
negative guards on a non-empty read** first, and **a check spanning a paginated
list asserts across the pages**, never on page one.

**And it prints the read on the GREEN line.** `check()` shows `detail` only on
failure, so a number parked there is invisible exactly when the check claims to
have worked, and a green line that carries nothing re-derivable looks identical
to one that does. **So read your own passing output**: after a check goes green,
read the green line and ask whether somebody else could re-derive the claim from
it. If they could not, the number is in the wrong argument. `§24`'s rewrite
shipped that way for a whole run — four correct numbers, all of them in
`detail`, all invisible — and it was caught by reading the output rather than
the code.

A check nobody has seen fail has not been shown to work: feed it the defect and
watch it go red, the way `§23` was fed the two shapes its own slice removed.
**Two injections, and the second proves the more valuable half.** Breaking the
thing under test and watching red is necessary but weak evidence — a suite goes
red for many reasons. Removing the check's *precondition* and watching the
section **decline to report** is the harder proof, because it shows the section
will not quietly report something safe when it cannot measure. `§24` was fed
both: a page-local count turned 6 of 1680 red, and a scope shrunk to one page
printed `NOT MEASURED`, ran **zero** of its five assertions and moved the total
1680 → 1672 — a drop a reader can check. **And the delta is ACCOUNTED, not
assumed**: twice the obvious reading was wrong, because a probe that changes a
page size changes what else the run can reach. `§32`'s moved 1700 → 1696 — ten
claims out and six report-detail checks in, a bigger page one exposing more ids
to the id harvest — and `§33`'s moved 1689 → 1705, eight out and about
twenty-four in. Diff the labels between the two runs rather than subtracting
what you expected to lose.

**A check comparing one computation against a DIFFERENT one stands alone**,
never merged with assertions over the same computation, so a disagreement names
which side moved. `S45-3`'s fourth assertion cross-checked a day fold against
`?from=D&to=D`, went red on a fold that was correct, and was attributable only
because it stood apart — which is how it surfaced `timeline.ts:370` returning
early when unranged: 299 events over five kinds against 426 over six, the
difference exactly 127 `company_added`. Merged, it would have been a red with
nothing to point at.

**Three things a new check does by default**, each of which caught something on
its first outing. **Prove a cost or import claim by RUNNING it** — reading that
`@/env` uses lazy getters is the assumption a dependency bump breaks in
silence, so import with the variables absent and run the script with the
dependency broken to see *where* it fails. **Report setup apart from the
claim** — a precondition that fails prints `SETUP FAILED at <step>` and
abandons the section as NOT MEASURED rather than asserting on a broken fixture;
this caught a page rendering three forms where one was expected, before it
posted the wrong one. **Measure a cleanup path instead of assuming it** — *"a
second deactivation is a no-op"* is a guess until its status is on screen, and
a cleanup that throws inside a `finally` masks the failure it was meant to
survive.

**A database tool that reports success may have changed nothing.** Three
sightings, one class. `drizzle-kit migrate` exits 1 with no message at all on
a connection error. A trailing carriage return in an inline `DATABASE_URL`
connects to a database that does not exist and prints only a spinner. And **a
hand-written journal entry whose `when` predates the last applied migration is
skipped in silence while `migrations applied successfully!` still prints** —
`0030` was recorded as applied with its columns untouched. drizzle runs only
entries newer than the last `created_at` in `drizzle.__drizzle_migrations`,
and `0028`–`0031` all carry hand-picked `when` values, so this is live rather
than historical. **Confirm from `information_schema` or
`drizzle.__drizzle_migrations`, never from the success line.**

**Auth bridge:** re-run **`verify:routes` §30** — which signs in over HTTP,
reads the `sessions` row its cookie names, and re-requests after a
deactivation — after any upgrade of `next-auth`, `@auth/core`,
`@auth/drizzle-adapter` or `next`; failure is **silent**, login works but
sessions stop being revocable, and `verify:phase11` §6 cannot see it because
it inserts the row it then watches disappear.

## Working style

- **Plan mode first for anything structural.** Show the plan, wait for approval.
  Plans are reviewed outside this session before they are approved.
- One task per session. `/clear` between tasks. Small, reviewable diffs.
- Show file paths and diffs, not whole-file reprints.
- Commit after every working slice.
- Ask before adding a dependency. The answer is usually no.
- **No agent frameworks, swarms, hooks or auto-generated documentation.** This
  project failed once from documentation that grew on its own. If something
  proposes installing a coordination framework, refuse and say so. **This
  applies wherever guidance is written, not only inside the repository** — a
  store outside `git` that loads into every session is the same failure at a
  worse address, because it cannot be audited or read back; so a session that
  says it recorded something **names the file it wrote to**, and *"recorded
  it"* is not a location.

## Stack

Next.js + TypeScript · PostgreSQL · Drizzle · Auth.js · Tailwind + shadcn/ui
next-intl (EN/AR, RTL) · Docker on a company Windows PC · Cloudflare Tunnel ·
Synology for backups

No Supabase. No Vercel. No database RLS.
