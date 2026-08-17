# 26 — The Deletion Pass

Feature slice 6. This document records the state of the codebase at the
**start** of this slice, and what the slice removed from it.

**Status:** this is a founder-decided document — every deletion, correction
and withdrawal below was confirmed with the founder during the slice, not
inferred. Where a decision required judgement (which structure counts as
provably dead versus deferred, how to phrase a corrected decision), that
judgement is marked and was checked before being acted on.

**Authority:** later than `25`, so it corrects `25 §20` and `25 §28` in
place — struck through, not deleted, per the convention `22 §6` already
established for closed open-items. It does **not** edit `17 §2`, `20 §6`,
`07 A1`, `21 §1` or `19 §7`, for the reason §1 gives.

---

## 1. The authorisation

CLAUDE.md's Simplicity section carries a line added ahead of this slice:

> Unused structure is a defect, not neutral. A column nothing writes, a
> flag nothing reads, a table nothing fills — each one is a lie about
> what the system does.

That is founder input, and it is what authorises this slice. It supersedes
two earlier, explicit cautions:

- `17 §2`: *"`product_colours` stays in place, empty and unused. No document
  asks for it to be dropped, and `CLAUDE.md` does not permit removing a table
  on an assistant's judgement."*
- `20 §6`: *"`activities` therefore stays permanently empty, exactly as
  `product_colours` does `[17 §2]`."*

Both were correct when written — nothing had yet said either table should go.
This document is that document.

**`17` and `20` are not edited.** The project's established pattern is that
later documents correct earlier ones without rewriting them — `21` overrules
`10 §9`'s self-closing system task; `20` supersedes `04 Q6`'s "activities are
private to the rep"; `16 §8` and `18 §2` reverse `04 Q10`'s coordinator
read-across; `12 §7` supersedes `04 Q8.1`'s "or delete them." Rewriting `17`
or `20` in place would destroy the provenance that makes `docs/` worth
trusting — a reader could no longer tell what was true when a table was built
versus what became true later. The same reasoning holds `07 A1`, `21 §1` and
`19 §7` — all three mention `tasks`, all three are superseded by `§20`'s
withdrawal below, and none is edited.

---

## 2. What is deleted

Each of the following is **provably dead** — confirmed by exhaustive grep
across `src/` and `scripts/`, not inferred from a document's silence — rather
than merely unused-for-now.

- **`product_colours` + `quotation_lines.colour_id`.** `17 §2` made colour a
  typed value on the line; the `leftJoin` against `product_colours` in
  `src/lib/quotations.ts` has never matched a row, because `colour_id` is
  always null. `colourCode` dead-ended behind a `??` in `productDisplayName`.
  The CHECK constraint that once required exactly one of `colour_id` /
  `custom_colour` now only ever says one thing, so `custom_colour` is
  `NOT NULL` directly.
- **`activities`.** Zero imports of the table from `schema.ts` anywhere in
  the codebase. `20 §6` derives the timeline on read instead; nothing was
  ever written here to derive around.
- **`roles.sees_all_records_readonly`.** Never read by `authz.ts` —
  `verify:schema25`'s own log said so before this slice: *"nothing reads the
  new columns either... so `25 §28`'s third tier is not live."* Seeded
  correctly, consulted nowhere.
- **`company_rep_origin` values `'shared'` and `'merge'`.** `'merge'` was
  written nowhere at all, ever. `'shared'` was written only by three
  verify-script fixtures, already documented (`23`) as *"a membership, not a
  share"* — unrelated to the real `record_shares` sharing feature.
- **`requirePermission()`** (`src/lib/authz.ts`). Zero callers. Its own
  doc-comment said *"kept because it is correct, harmless structure `[13
  §2]`"* — that licence is precisely what §1's new CLAUDE.md rule reverses.
- **`src/components/ui/separator.tsx`.** Zero importers anywhere in `src/`.
- **The `/coverage` route.** The *route* was orphaned from the nav rail and
  is deleted. Its quiet-only and per-rep filtering is a real capability, not
  incidental structure — `20 §7` requires a rep be able to ask "which of my
  companies have gone quiet" — so that capability moved onto
  `/performance`'s coverage section first, on the same `coverage()` call and
  the same `CoverageTable`, before the route was removed. Nothing a rep
  could do before this slice is lost. `22 §6.5`'s pagination-before-filter
  defect travelled with the filter to its new home, unfixed — this slice
  does not describe the move as retiring that defect.
- **`tasks`, `task_origin`, `task_status`, `HandoverTask`, and the handover
  reassignment plumbing for tasks.** Cascades from `§20`'s withdrawal — see
  §6 below.

---

## 3. The §28 correction

`25 §28` asked for a "read-only tier": a `sees_all_records_readonly` flag
letting a coordinator open any company or project record, view-only. It was
seeded on exactly Super Admin and Sales Coordinator and consulted by nothing
— the flag existed, the tier never shipped.

**What the founder actually asked for is a name lookup, not a tier.**
Coordinators need to see every company and project **by name**, so they can
reference them when writing quotations — not the record's contents unless it
is shared with them. `18 §2` already built exactly this pattern for
companies, on the dispatch form: a typed search of two or more characters,
names only, no address, no contacts, no link to open the record. A later
slice extends the same pattern to projects, at the screen where the
coordinator raises a quotation, including relaxing `createQuotationThread`'s
visibility guard so the write path agrees with what the lookup offers.

This slice ships the **decision**, struck into `25 §28` in place, and drops
the flag that implemented the wrong shape. It does not ship the lookup
screen itself — that is a feature (new search functions, a new authz filter,
a permission-widening change to who may create a quotation thread), sized
and reviewed on its own rather than folded into forty files of deletions.
`25 §28` stays in the backlog list at §6 below, now correctly scoped instead
of wrongly scoped.

---

## 4. The three lies

Three small pieces of UI told a user something that was not true. Each got
the smallest fix that stops the lie.

- **The impersonation stop control.** `startImpersonation` `[07 A5, A6]` has
  no caller, so `session.isImpersonating` can never be true — the banner and
  its "Stop impersonating" button could never render, ever, for anyone. A
  control that can never appear is not a bug in the control; the whole
  banner was dead code conditioned on an unreachable state. Removed the
  banner, its action wrapper, and its two translation keys. Kept
  `startImpersonation`, `stopImpersonation`, `session.isImpersonating` /
  `realUser`, `sessions.acting_as_user_id` and `roles.can_impersonate` —
  `07 A5`/`A6` is user truth asking for impersonation to exist; the fix is
  building the start control in a future slice, not deleting the plumbing
  that is correctly waiting for it.
- **The handover task bucket and its notification count.** Always empty,
  because nothing wrote to `tasks` even before this slice withdrew it. Was
  going to be phrased "removed until `25 §20` ships" — but §20 is withdrawn,
  not pending, so the bucket and the `{tasks}` count in the handover
  notification are removed permanently, not conditionally. See §6.
- **The `settings` comment.** Called the table "manager-editable" when no
  screen edits it — today a row only ever changes by a direct database
  edit. Corrected in `schema.ts` and in `src/lib/settings.ts` to say so
  plainly, while keeping `09 §10.2`'s intent on record as the reason the
  table exists in this shape.

---

## 5. Unused but deferred, not dead

Two lists, so the next deletion pass does not re-derive either from scratch.

### Tables and flags, with citations

| Structure | Cited by | Note |
|---|---|---|
| `delete_requests` | `25 §29` | §29 designs the workflow ("the same three routes as dormancy"); it does not pin this table as the implementation vehicle |
| `roles.can_approve_delete` | `25 §29` | Same caveat |
| `attachments` | `25 §36` | Cleanest citation — the table is named directly |
| `roles.can_export` | `25 §32` | Indirect, via the shared `07 B8`/`07 E1` source citations |
| `duplicate_flags`, `non_duplicates`, `roles.can_resolve_duplicate` | **not** in `25` | Cite `24 §3.2` + roadmap Phase 10b + `21`'s own scope note ("duplicates are 10b and nothing here decides them") |
| `pipeline_snapshots`, `person_snapshots` | **not** in `25` | Cite `12 §15` + roadmap Phase 12. **`25 §27`'s monthly rollup is computed live, not from snapshots — do not cite §27 as their future consumer** |

**Separately, not in the table above: `product_specifications` is a real
unscheduled gap.** Unlike its four siblings, it was never promoted from `24
§3.1`'s "unscheduled" bucket by `25`. Even the seed script
(`scripts/seed/products.ts`) says only that no document lists which
combinations are real — not that a screen is coming. Flagged here so it is
not mistaken for "deferred, cited" the way the table above is.

### Dead columns inside live tables

Found during this slice's inventory; each with its citation or the explicit
absence of one, so nobody re-derives this list column by column.

| Column | Status |
|---|---|
| `companies.has_credit_terms` | `25 §7` — flag exists, no screen sets it |
| `quotation_threads.closed_at` / `closed_by_user_id` | `25 §24` — columns exist, nothing writes them yet |
| `companies.merged_into_id` | The merge feature — `24 §3.2` / roadmap Phase 10b |
| `users.email_verified` / `image` | No citation needed — Auth.js adapter shape, library-owned, not a FACET decision |
| `audit_log.acting_as_user_id` | Written and guarded, never populated, because `startImpersonation` has no caller. **Do not drop** — the fix is the start control (§4 above), not this column |
| `company_reps.is_primary` | No citation; only ever written `true`, no code path inserts a second row for the same company yet |
| `project_credit_splits.percentage` | Nullable, always non-null in practice since `18` withdrew the contributor concept it was for |
| `form_factor` value `'coil'` | `13 §2` and `25 §11` keep it, reserved for the production module |
| `record_type` value `'quotation_version'` | Excluded by the `comments_record_type` CHECK; its other consumers are themselves unused structure, not a live path |

---

## 6. The backlog

**Withdrawn by this slice: `§20`.** "Manual tasks are built, small" — not
needed for now, founder-decided, 2026-08-16. This is a permanent no, not a
deferred maybe: nothing writes `tasks` and nothing will. A marketing rep
judging qualification from what the customer states, before any quotation
exists, is a *different* case, handled by `§16` below — withdrawing `§20`
does not touch it. The withdrawal cascades: `tasks`, `task_origin`,
`task_status`, `HandoverTask` and `team.ts`'s reassignment block for tasks
are all dropped in this same slice, per §2 above — leaving permanently-dead
structure in place after just deciding it is permanently dead would
contradict this document's own §1. This supersedes `07 A1` (which defines a
task with three origins) and `21 §1` (which records that `tasks` stays
unwritten for follow-ups) without editing either. It also means `19 §7`'s
"four handover buckets" — `company_reps` membership, `projects.owner_user_id`,
`quotation_threads.raised_by_user_id`, open `tasks` — is now three; a future
reader should take that as this withdrawal, not a regression against `19`.

**One list of the 14 `25` decisions with no built screen, as of the start of
this slice:** `§3`, `§7`, `§8`, `§16`, `§20`, `§22`, `§24`, `§27`, `§28`,
`§29`, `§31`, `§32`, `§34`, `§36`.

- **`§28`** — corrected in decision this slice (§3 above), flag dropped, but
  the lookup screen is not built yet. Stays in the backlog, now correctly
  scoped rather than wrongly scoped.
- **`§20`** — withdrawn this slice, per above. Removed from the backlog
  entirely; it is not "not built yet," it is "not being built."
- **`§16`** kept as **real backlog, not a maybe**, with the founder's
  reasoning recorded verbatim: marketing receives a lead, the customer
  states what they need, and a marketing rep judges qualification on that —
  before any quotation exists. The quotation-derived half (already built:
  `companyIsQualified` in `src/lib/quotations.ts`) only fires on a quotation
  request, so it cannot see this case. Both halves stand as independent,
  necessary requirements. **`§16` is backlog, not scaffold** — no schema
  column exists yet for the rep's manual "mark qualified" judgement, unlike
  `§32`, whose `can_export` flag is already seeded and waiting on a screen.
- **`§22`** kept, partial: the after-the-fact "3 open quotations" flag on the
  project detail screen is built; the proactive pre-submit warning
  ("Revise 9592, or raise a separate quotation anyway") described in the
  decision does not exist.
- **`§32`** kept unchanged — `can_export` seeded, no export path built.

**Leaves 13 open after this slice:** `§3`, `§7`, `§8`, `§16`, `§22`, `§24`,
`§27`, `§28`, `§29`, `§31`, `§32`, `§34`, `§36`.

**The miscount guard.** `§6` (warmth withdrawn), `§23` (no tolerance built)
and `§35` (the sales-desk workflow deliberately not modelled) are decisions
to withdraw or not build something, correctly satisfied by the code doing
nothing — they are not gaps, and neither is `§20` now that it has joined
them. `§15` and `§37` are stated principles with no implied screen. None of
these five counts as open backlog; a future reader recounting this list
should exclude all five, not just the three `25` already marked this way.
