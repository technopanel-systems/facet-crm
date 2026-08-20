# FACET — Workflow and Session Plan

How Jerom and Claude work together on FACET, and the full run of sessions from
here to a pilot.

Written to be pasted into a fresh chat as a starting brief.

---

## 1. Who does what

**Jerom** is the founder and owner of Technopanel's FACET project. He is a
semi-beginner developer working with AI assistance — comfortable running
commands and reading code, not a professional engineer. Explain the *why* in one
line, not three paragraphs. Never assume a term is known; never over-explain
either.

**Claude Code (VS Code)** writes the code. One task per session.

**Claude (this chat)** is the planning and review layer. It holds context,
reviews plans before they are approved, decides what a slice contains, and keeps
`SPEC.md` and `DESIGN.md` honest. **reads the repository through the GitHub connector, which syncs main — so an unpushed commit is invisible to it.** —
it sees only what is pasted or uploaded.

---

## 2. The authority files

At the repo root:

| File | What it decides |
|---|---|
| `CLAUDE.md` | project rules, loaded by every Claude Code session |
| `SPEC.md` | what the system does — rules numbered `S1`… |
| `DESIGN.md` | how it looks and behaves — rules numbered `D1`… |

`docs/design/facet-concept-v5-premium.html` is the visual target.
`docs/archive/` and `docs/design/archive/` are history, never authority.

**Everything is cited by rule number.** "Per S74" and "per D28", never "as we
discussed".

---

## 3. The loop, every session

1. **New Claude Code session.** `/clear` if reusing a window. Opus.
2. **State the task by rule number.** One task. Nothing else in the session.
3. **Plan mode** (`shift+tab`) for anything structural.
4. **Paste the plan into this chat before approving it.** This is the step that
   was missing before, and it is the cheapest defect-catching in the project.
5. **Approve in Claude Code.** It builds.
6. **Run the checks:** `typecheck` · `lint` · `build` · `check:messages` ·
   `verify:routes`. All five, every time. `build` is not optional.
7. **Update `SPEC.md` / `DESIGN.md`.** When a `[CHANGE]` or `[BUILD]` rule
   ships, delete its marker — the rule is now simply true. **The spec is a
   living file, not a record of intent.** If it drifts from the code, the whole
   arrangement fails the way it did last time.
8. **Commit and push.** Every session, no exceptions.
9. **Append anything discovered and deferred to §5.** A defect that exists
   only in a session report does not exist.
10. **Paste the status block (§9) into this chat.**

---

## 3b. Model, mode and effort

Jerom works in **VS Code with the Claude Code plugin**. His global settings are
already `opus[1m]` at `xhigh` effort, which is the right default — the old
project-level override that forced Sonnet has been deleted.

| Session type | Model | Mode | Notes |
|---|---|---|---|
| **Investigation / debugging** (session 1) | Opus | normal | Plan mode blocks writes, so it cannot fix anything. Let it work. |
| **Structural slice** (schema, new screens, deletions) | Opus | **plan mode** | `shift+tab` until the input says plan mode. Plan is reviewed in chat before approval. |
| **Small edit** (a skill file, a config line) | Opus | normal | Too small to plan. |
| **Audit** | Opus | **plan mode** | Plan mode is read-only, which is exactly what an audit should be. It physically cannot change anything. |

Leave effort at `xhigh`. It costs latency, not correctness, and every session in
this plan is judgement work rather than typing.

**Never lower the model to save allowance mid-slice.** A slice half-built by a
smaller model is worse than a slice not started.

---

## 4. The session plan

Some rows will take more than one session. That is expected — split, never
merge. A slice that grows past 800 words of plan is two slices.

### Phase 0 — Unblock

| # | Session | Done when |
|---|---|---|
| 1 | **Fix the Docker build.** Fails collecting page data for `/follow-ups` in-container, passes on host. | `docker compose build` succeeds |
| 2 | **Rewrite the `facet-ui` skill** to teach `DESIGN.md` — effect tokens and their named uses, per-object row anatomy, view-mode URL pattern, `D21` as a pre-flight checklist. | skill loads and cites `D` numbers |

### Phase 1 — The model

Schema and data layer first, because the UI renders whatever the model says.

| # | Session | Rules |
|---|---|---|
| 3 | One name field on companies and contacts; phone mandatory; country added | `S12` `S13` `S14` `S19` |
| 4 | Drop project role labels — participants only | `S25` |
| 5 | Quotation project optional — a quotation may be raised without one. **The write-back half moved to session 13**, where approval exists: `S74` fires when the coordinator approves, and that cannot be built before approval can | `S50` |
| 6 | VAT fixed at 15%; readable product fields. **Validity is no longer a note** — it leaves FACET entirely in session 10 (`S67`) | `S53` `S57` |
| 7 | Report splits into shared half and private note; same-day edit only; author keeps their own | `S38` `S39` `S40` |
| 8 | Coordinator sees projects and contacts. **The sight half is built here**; the edit right `S76` now mentions (`S62`) arrives in session 13 | `S76` |
| 9 | ~~Drop dead structure — `accounts`, `verificationTokens`, both snapshot tables, `project_companies.role`~~ **Folded into session 22.** Both were dead-structure sweeps citing `SPEC §15`, and 22 runs last so it catches Phase 1b's orphans too. The verify-routes.ts re-cite goes with it | — |

> **AUDIT 1 — the model.** See §6.

### Phase 1b — Dispatch and payment

The dispatch and payment model changed after a session with the sales
coordinator. It comes before any interface work, because the interface renders
whatever the model says.

| # | Session | Rules |
|---|---|---|
| 10 | Validity and delivery period leave FACET | `S67` |
| 11 | Stock on the quotation | `S118` |
| 12 | Dispatch lines and the three modes | `S116` `S75` `S126` |
| 13 | Request, approve, refuse; the `canDispatch` split | `S72` `S124` `S125` `S122` `S62` |
| 14 | Payment method, shipment, SMAC number | `S70` `S71` `S73` `S119` `S121` |
| 15 | The difference flag | `S120` `S77` |
| 16 | Won derived from dispatch; committed | `S28` `S29` `S31` |
| 17 | Told — refusals, cancellations, credit | `S128` `S129` `S92` |
| 18 | Compliance metric | `S123` `S127` |

Then AUDIT 1's remaining fixes, which are independent and small.

| # | Session | Rules |
|---|---|---|
| 19 | Primary rep on handover and reassignment | `S18` |
| 20 | Coordinator's comment access; the cancellation reason | `S62` `S114` |
| 21 | Handover recipients narrowed to the roles `S9` names | `S9` |
| 22 | Dead-structure sweep — AUDIT 1 F9–F18, plus everything session 9 carried: `accounts`, `verificationTokens`, both snapshot tables, `project_companies.role`, and re-citing verify-routes.ts assertion labels to S numbers | `SPEC §15` |

Session 22 runs **last** of these, so it sweeps up whatever Phase 1b orphans.

### Phase 2 — The rebuild

| # | Session | Rules |
|---|---|---|
| 23 | The shell — seven-item rail, tokens, layout cap, theme, permission boolean | `D5`–`D23` `D46` `D47` |
| 24 | **The waiting list, rep scope** — and the notification tiers, persistence flags, per-anchor resolution and digest machinery come out in the same slice. The list now carries **dispatch requests as a fourth kind of item** (`S86`, `S89`) | `S86`–`S95` `D29`–`D34` |
| 25 | The waiting list, manager scope, and "Needs a decision". **The coordinator has her own queue** (`S88`) | `D35`–`D38` `S88` |
| 26 | Grouped lists with per-object lead cells — companies, projects, quotations | `D22`–`D24` |
| 27 | The stream — replaces `/reports` and `/activity`; comments narrowed to threads and projects | `S114` `D42`–`D45` |

> **AUDIT 2 — the interface.** See §6.

### Phase 3 — Trust

Nothing below is optional before real users touch it.

| # | Session | Rules |
|---|---|---|
| 28 | Signals and loss reasons unified; loss cascades down | `S43`–`S49` |
| 29 | Duplicate detection and manager resolution | `S21`–`S23` |
| 30 | ~~Credit terms — rep requests, manager approves~~ **Removed.** Credit stopped being a company property to request and approve; it is now one payment method among six, recorded on the dispatch — `S71`. | — |
| 31 | Archive requests folded into the dormancy review | `S105`–`S107` |
| 32 | Sharing per project; contacts shareable | `S97` `S98` |
| 33 | **Bulk import** — nobody hand-types the customer base | `SPEC §15` |

### Phase 4 — Complete the picture

| # | Session | Rules |
|---|---|---|
| 34 | The board view for projects | `D25` `D26` |
| 35 | The monthly rollup | `D39`–`D41` |
| 36 | Password reset; holiday calendar; thresholds into `settings`; the three dead flags made live | `S8` `S11` `S94` |
| 37 | Phone pass — rep screens at 375px | `D52` `D53` |
| 38 | RTL pass — every screen, both locales | `D54` |

> **AUDIT 3 — pre-pilot.** See §6.

### Phase 5 — Pilot

Two or three reps. One month. Real companies, real quotations, real dispatches.
Everything after this is decided by what they say, not by this plan.

---

## 5. Known defects and deferred work

Found during a session, correctly not fixed there. A defect that exists only in
a session report does not exist.

| What | Where | Disposition |
|---|---|---|
| Search filters `ilike` a raw name, so the same Arabic name is findable on one screen and not another. **Corrected by AUDIT 1: three of six, not five.** `companies.ts`, `projects.ts:132` and `contacts.ts:77` all normalise | `quotations.ts:261`, `dispatches.ts:372`, `reports.ts:527` | Own session after the model phase |
| ~28 sites need `dir="auto"` per D62 | list cells, option labels, panels — inventory in session 3a's report | Sweep session with the `SelectField` item below |
| Eight `SelectField`s should carry `required`; each validates server-side, so the placeholder costs a round trip, not correctness | user, contact, report and quotation-line forms | Same sweep session |
| Participant add/remove forms never answer a no-JS POST — `Failed to parse body as FormData`; the write lands, the response does not. Bisected to pre-existing | `projects/[id]/project-links.tsx` | Own session |
| `confirmPaymentAction` never answers a raw form POST. Same shape, different action | `quotations/[id]` | Same session as the above — likely one cause |
| `follow-ups.ts:166` filters in memory after the fetch. **Corrected by AUDIT 1: it is the whole function, not one line.** `followUps()` fetches every row with no SQL limit, then applies four in-memory filters, a sort and `.slice()` for pagination | `src/lib/follow-ups.ts:1151-1224` | None — file is deleted in session 24 |
| `listQuotationFormOptions` returns every visible company into one `<select>`. Fine at ~90 | `src/lib/quotations.ts` | Revisit after bulk import |
| Comments render on companies, contacts and dispatches. `S114` and `D48` allow quotation threads and projects only; the `comments_record_type` CHECK admits five kinds, the company screen imports `CommentBox`, and `verify:routes` §9 asserts the wider behaviour | `src/db/schema.ts`, `companies/[id]/page.tsx`, `scripts/verify-routes.ts` §9 | Session 27, which narrows comments — it deletes that walk |
| `quotation_threads.closed_at` and `closed_by_user_id` have no writer and no reader outside the schema. `src/lib/projects.ts` never touches `quotationThreads`, so `S47`'s cascade — which is what would write them — is not built. AUDIT 1: 0 of 352 threads carry either, and the `quotation_threads_closed` CHECK guards the pair, so it goes with them | `src/db/schema.ts` | The loss-cascade slice `S47`, which builds their writer or drops them |
| `companies.merged_into_id` has readers (isNull filters) but no writer. **Corrected by AUDIT 1: four modules, not five** — `coverage.ts`, `dispatches.ts`, `dormancy.ts`, `follow-ups.ts`. 0 of 844 companies carry one | `src/db/schema.ts` | Session 29, which builds duplicate merge |
| `quotation_lines.form_factor` is always written `'sheet'`; the enum's `coil` value is set nowhere and nothing branches on it. AUDIT 1: 0 of 331 lines are anything but `sheet`, so a drop costs no migration | `src/db/schema.ts` | Undecided — needs a rule or a drop |
| `report_signal` has nine values. **Corrected by AUDIT 1: `S43` lists eleven, not ten, and two are missing, not one** — *stock shortage* and *customer went quiet*. `loss_reasons` also seeds nine and is missing a different two — *quality concern* and *payment terms* — so the two lists are complementary halves whose union is exactly `S43`'s eleven. Seven shared concepts carry different tokens (`competitor_cheaper`/`lost_to_competitor`, `lead_time_too_long`/`delivery_time_too_long`, `specification_unavailable`/`specification_not_offered`, `project_delayed`/`project_cancelled_or_postponed`, `colour_unavailable`/`colour_or_product_unavailable`), so unifying is not a union. Only two values are in use in 30 signal rows, so the data migration is small | `src/lib/enums.ts`, `src/db/schema.ts`, `scripts/seed/loss-reasons.ts` | Session 28, which unifies the vocabulary |

**Added by AUDIT 1 (§6), ranked by consequence.** Counts are from the live
database on 19 Aug 2026, after all sixteen migrations.

| What | Where | Disposition |
|---|---|---|
| `S20` says a contact "is visible exactly when its company is". False since `S76`: `visibleContactsFilter` returns `undefined` for `can_dispatch`, so the coordinator reads every contact while every company stays closed to them. `S76` names itself an exception to `S30` and amends `S30` in place; it never amends `S20`. The code is right and the rule is stale | `SPEC.md` `S20`, `src/lib/authz.ts:546-555` | A `SPEC.md` correction — `S20` needs `S76`'s exception written onto it, as `S30` has |
| The coordinator reads every rep's comment conversation on **every project and every contact**. `visibleCommentsFilter` composes each anchor's own filter, and for those two they are the `S76`-widened ones, so both branches degrade to "the record exists". Company comments stay closed, so the asymmetry is real rather than uniform. No rule states this; `S38` protects a report's note from a share and comments have no equivalent half | `src/lib/authz.ts:878-898` | Needs a founder decision, then either a `SPEC.md` sentence or a narrowing. Session 27 touches the same code |
| `projects.region` and `projects.city_id` have **no writer that has ever fired**: 0 of 414 projects carry either, and no `project.created` or `project.updated` row in the audit log ever set one. **The discarded-input half is fixed** — `449a7e8` removed `regionForCity`'s fallback, which left the project form rendering a region select whose value silently vanished; that select, its `readProjectForm` read and `ProjectInput.region` are gone `D51`, and `verify:routes` asserts the form offers no region in both locales. The project's CITY select is deliberately untouched: what a rep picks there **is** stored, so it has something behind it. **What stays open is the columns question**, and it is three shapes: **(a)** a project's city is mandatory and the region derives from it; **(b)** it derives from the project's own city and the city stays optional, so the region is usually null; **(c)** both columns are dropped as unused structure, and a project's region is derived from its participants' cities if it is ever wanted. **It cannot simply mirror the company fix: `projects` has no country column**, so `S15`'s "mandatory when Saudi" has nothing to hang on | `src/db/schema.ts:813-814`, `src/lib/projects.ts` | Own session — needs a founder decision between the three, then one of them |
| `S18` says "the primary rep is always the first rep who had the company". False in both handover paths: `team.ts` carries `is_primary` to the recipient and `dormancy.ts` writes `isPrimary: true` on the new rep. **75 of 950 live memberships are primary *and* `origin = 'assigned'`.** `team.ts` records the sibling case as `OPEN [19 §8]` while the other branch settles it silently | `src/lib/team.ts:299-311`, `src/lib/dormancy.ts:234-246` | Needs a founder decision on what "primary" means after a handover, then `SPEC.md` or the two writers |
| `S62` says returning **or cancelling** requires a reason "which becomes a comment on the thread". `returnForEdit` writes the comment; `cancelThread` writes only `quotation_threads.cancellation_reason` — no comment, no mention, so the rep is never told a signed quotation was killed | `src/lib/quotations.ts:1846-1862` | Now `S128`'s problem rather than a standalone defect — the rule requires the reason to reach the rep. Session 17 |
| `S31` ("a project is **won** when payment arrives **or** the project is approved") carries no marker but is not built. `projects.end_state` is only ever set by hand from the project form; nothing derives `won` from `payment_confirmed_at` or an approval | `SPEC.md` `S31`, `src/lib/projects.ts` | `S31` needs a `[CHANGE]` marker, or `S28`'s scope stated to cover it |
| Handover and dormancy reassignment accept **any** active user as recipient — only `isActive` is checked and the picker is `listActiveUsers()` unfiltered — so a company book can land on an Executive or a Super Admin. `S9` names "a rep, a desk rep, or the coordinator". The code is wider than the rule, not narrower | `src/lib/team.ts:236-241`, `src/lib/dormancy.ts:199-207` | With `S9`, whose `[CHANGE]` currently implies the opposite gap |
| `users.city_id` has no writer and no reader. `createUser` accepts `cityId` but no form or action posts it, `UserUpdateInput` omits it and `ManagedUserRow` never selects it. **0 of 417 users carry one.** A live foreign key to `cities` that nothing fills | `src/db/schema.ts`, `src/lib/authz.ts:1294` | Undecided — needs a rule or a drop. Only `users.region` serves `10 §7` today |
| `quotation_threads.cancelled_at` is written by `cancelThread` and read by nothing; 0 rows carry one. `cancelled_by_user_id` beside it *is* read | `src/db/schema.ts` | With the `S62` row above, which reopens `cancelThread` |
| `notifications.channel` is written from `notification_types.default_channel` and read by nothing — no query, screen or filter | `src/db/schema.ts` | Session 24, which deletes the notification machinery per `S91` |
| **Five tables with no reference anywhere in `src/` or `scripts/`, and 0 rows each**: `attachments` (`S115`), `delete_requests` (`S8`, `S105`–`S107`), `duplicate_flags` and `non_duplicates` (`S21`–`S23`), `product_specifications` (SPEC §16 open). `SPEC §15`'s "Dropped outright" names none of them. `accounts` is the documented sixth — the adapter's TYPE requires it | `src/db/schema.ts` | Each with the slice that would build its writer; or a second deletion pass like `0015` |
| **Ten indexes nothing uses.** Six sit on those dead tables. Four more are live: `comments_author_idx` (no query filters or orders by `author_user_id`), `comment_mentions_user_idx` (the one predicate is inside a delete already scoped by `comment_id`), `rep_report_signals_signal_idx` (its own comment says it is for `S49`, which is `[BUILD]`), `companies_merged_into_idx` | `src/db/schema.ts` | With the table or column each serves |
| **Dead enum values.** `record_type.quotation_version` is set nowhere — the `comments` CHECK excludes it, `SHARED_RECORD_TYPES` excludes it, and the three tables that could carry it are dead. `project_end_state.dormant` is writable from the project form but no rule defines a dormant project end state, and 0 of 354 projects use it. (`form_factor.coil` is its own row above) | `src/db/schema.ts` | Undecided — each needs a rule or a drop |
| `product_suppliers.code`, `product_classes.code` and `product_fire_ratings.code` exist for the generated product name `S53` says FACET does not produce. Nothing renders them; they survive only as the `ORDER BY` of three dropdowns | `src/db/schema.ts`, `src/lib/lookups.ts:328-357` | Borderline — recorded so a later slice decides deliberately rather than inheriting them |
| `SPEC §15` lists `accounts` under "Dropped outright". It was **not** dropped, deliberately: `accountsTable` is a non-optional member of the adapter's `DefaultPostgresSchema`. That decision lives only in migration `0015`'s header and a `schema.ts` comment, so the authority file currently says something untrue about the database | `SPEC.md` §15 | A `SPEC.md` correction |
| **Three markers name something already built, in whole or in part.** `S34` `[CHANGE]` — all five channels including `meeting` have existed since migration `0005` and the enum matches `S34` exactly; only the *definitions* of visit and meeting are new, and no label carries them. `S81` `[CHANGE]` — "divides equally" and "nobody types a percentage" are already true, and the open clause is open the other way round, because `divideEqually` *is* the remainder machinery `S81` says not to build. `S11` `[BUILD]` — password reset does not exist but deactivate/re-enable does; `S106` `[BUILD]` has the same shape, the review and its three outcomes existing while only the rep's way in is missing | `SPEC.md` | Each needs the founder to retire, narrow or restate the marker |
| `canDispatch` **gates the whole dispatch act today** — `recordDispatch`, the `/dispatches/new` route, and five visibility filters in `authz.ts`, which is how `S76` is implemented. `S72` splits the act: a **rep requests with no flag at all**, the coordinator approves behind `canDispatch`. The flag must be re-read as "may **approve** a dispatch", four call sites change meaning, and `S76`'s widening rides on the same boolean | `src/lib/dispatches.ts:193`, `src/lib/authz.ts:429,549,603,696,1060`, `src/app/[locale]/(app)/dispatches/` | The session that builds `S72`. **No new flag** — do not invent `canEditDispatchRequest` |
| **`S90` and `S92` name two surfaces for one message.** `S90` shows a refused, rejected or cancelled item to the person it was taken from "as it leaves", at the list; `S92` now carries the same decision as **bell news** and says it does not belong on the list. `S90`'s paragraph predates `S92` gaining the item | `SPEC.md` `S90` `S92` | Decide against a real screen, in session 24 which builds `S90` |
| **`S122` gates archiving on the rep "having been told"**, and the telling is now a bell item (`S128`, `S92`). Either the bell needs a **read state** — the persistence machinery `S91` forbids — or "told" means "sent" and the gate is nominal | `SPEC.md` `S122` `S128` | The same decision as the row above, session 24 |
| **`S92` keeps "never work" while carrying "credit granted to you"** (`S129`). Nothing in SPEC lets a rep query or contest a split — `S82` forbids them setting one — so it holds as written. Untested the first time a rep disagrees | `SPEC.md` `S92` `S129` `S82` | None. Recorded so the pilot watches for it |
| **Session 24 deletes the notification machinery per `S91` while `S92` gains two new bell items** (`S128`, `S129`). The deletion must not take them with it | `SPEC.md` `S91` `S92`, session 24 | Session 24 itself — it deletes and adds in the same breath |

---

## 6. The three audits

An audit is its own session, produces a findings list, and **changes nothing**.
Fixes are separate sessions afterwards.

**AUDIT 1 — the model.** Does the database say what `SPEC.md` says? Every table
and column against `S12`–`S129`. No column without a writer. No flag without a
reader. All verify scripts green. And: do the `[CHANGE]` markers for phase 1
now read as plain rules? **An audit that stops at `S85` does not look at the
dispatch and payment rules at all** — that was the old range, and it now misses
`S116`–`S129` entirely.

**AUDIT 2 — the interface.** Every screen against `DESIGN.md`, in both themes
and both locales, at 1366px. The `D21` checklist run by eye on each. Does any
screen still not answer `D3`'s question in five seconds? Is the waiting-list
predicate resolved in SQL before pagination — check the query, do not trust the
screen. That predicate now resolves **dispatch requests sitting with the
coordinator** (`S89`) alongside the other three kinds — a different join, and
exactly the shape §7 warns fails silently.

**AUDIT 3 — pre-pilot.** The full route walk with realistic data volumes. A
real phone in a real hand. Restore the backup onto a second machine and confirm
it comes up. Deactivate a user and confirm their session dies. Then the five
questions from `D3`, `D25` and `D31`, asked of a rep who has never seen it.

---

## 7. Rules that keep this from going wrong again

- **No agent frameworks, swarms, hooks, or auto-generated documentation.** This
  has been installed twice by accident and removed twice. If anything proposes
  a coordination framework, refuse.
- **New decisions go into `SPEC.md` or `DESIGN.md`.** Never a new document. The
  27 in `docs/archive/` exist because that rule did not.
- **When a rule replaces an old mechanism, the old mechanism comes out in the
  same slice.** Otherwise you end up with both.
- **Derived conditions are resolved in SQL, before pagination.** This has
  already shipped broken once, and it fails silently.
- **One task per session**, and the plan reviewed here before approval.
- **There is no production data.** Every row in every database is a fixture or
  verify residue. A migration never preserves, backfills or merges data — it
  clears, and `db:reset` is always available. This stops being true at the
  pilot, and this line comes out then.

---

## 8. Repository access at milestones

The repo is **private**. `legacy/` contains real colleague names and email
addresses, so it stays that way.

At each audit point, Jerom flips it public for the duration of the review, and
back to private afterwards. Claude clones it, reads the whole tree, and reports.
This has been done once already and works cleanly. Between audits, the status
block below is enough.

---

## 9. The status block

Run this at the end of a session and paste the output. It is what Claude uses
instead of repository access.

```powershell
cd C:\Projects\facet-crm
Write-Host "=== BRANCH & LAST COMMITS ==="
git log --oneline -5
git status --short
Write-Host "=== ROOT ==="
Get-ChildItem -Name -File
Write-Host "=== ROUTES ==="
Get-ChildItem -Recurse src\app -Filter page.tsx | ForEach-Object {
  $_.FullName.Replace("$PWD\src\app\","").Replace("\page.tsx","") }
Write-Host "=== TABLES ==="
Select-String -Path src\db\schema.ts -Pattern "^export const (\w+) = pgTable" |
  ForEach-Object { $_.Matches[0].Groups[1].Value }
Write-Host "=== SIZE ==="
(Get-ChildItem -Recurse src -Include *.ts,*.tsx |
  Get-Content | Measure-Object -Line).Lines
Write-Host "=== OPEN MARKERS ==="
# SPEC.md:10-11 are the legend, not rules.
@(Select-String -Path SPEC.md -Pattern '^(?!- \*\*\[).*\[CHANGE\]').Count
@(Select-String -Path SPEC.md -Pattern '^(?!- \*\*\[).*\[BUILD\]').Count
```

The last two numbers are the real progress bar. The count started at **26
`[CHANGE]` and 24 `[BUILD]` — 50 open**, rose to **55** when the dispatch and
payment rules were written, and falls as they ship. A rise is only wrong when no
rule was added.

Better still, add the script to the repo once (see §11) and run `npm run status`.

---

## 10. Current state, verified from the repository

**A snapshot, not a live reading.** Every figure below was taken by hand at the
commit named, and none of it updates itself. Re-take it rather than trusting it;
the previous version of this table was carried forward until nearly every row
disagreed with the repository, one of them a corrupted cell sitting beside a
number people trust.

Taken from `main` at commit `06aeb2b`.

| | |
|---|---|
| Branch | `main`, clean, no uncommitted work |
| Authority files | `CLAUDE.md` 144 lines · `SPEC.md` 718 · `DESIGN.md` 421, all at root |
| Rules | 129 `S` numbers · 63 `D` numbers |
| Docs | `docs/archive/` holds 27 numbered documents plus `INVENTORY.md`. `docs/design/` holds v5 at the top level, with v2, v3 and v4 under `archive/` and an empty `superseded/` |
| Skills | `facet-ui`, `facet-verify` — nothing else |
| claude-flow | fully removed, no remnants in the tree |
| Routes | 38 |
| Migrations | 18 |
| Tables | 41, of which **5 have no reference anywhere in `src/` or `scripts/`**: `delete_requests`, `product_specifications`, `duplicate_flags`, `non_duplicates`, `attachments`. `accounts` is referenced and stays — the adapter's TYPE requires it |
| Code | `src/lib` 14,612 · `src/app` 14,480 · `src/db` 1,935 · `src/components` 1,691 · `scripts` 16,132 |
| Largest under `src` | `quotations.ts` 1,956 · `schema.ts` 1,869 · `follow-ups.ts` 1,527 · `authz.ts` 1,527 · `notifications.ts` 934 |
| Largest under `scripts` | `verify-routes.ts` 2,488 · `verify-schema25.ts` 1,732 · `verify-slice3.ts` 1,679 · `verify-phase9.ts` 1,558 · `verify-phase10a.ts` 1,447 |
| Open markers | 17 `[CHANGE]`, 38 `[BUILD]` — **55 open**. See §9 for what a rise means |
| Blocking | the Docker build |

**Session 24 is larger than it looks.** It deletes `follow-ups.ts` (1,527) and
`notifications.ts` (934), and with them `verify-phase10a.ts` (1,447) and
`verify-followups.ts` (1,098) — **5,006 lines**, against a much smaller waiting
list. Expect that, or it will look like something went wrong.

**Session 1 head start.** Three causes of the Docker build failure are already
ruled out and must not be re-investigated:

- every page under `src/app` has `export const dynamic = "force-dynamic"`
- `src/db/index.ts` exports `db` as a lazy Proxy — importing opens no connection
- `src/env.ts` uses getters, so `env.DATABASE_URL` only throws when read

The relevant difference is that `.dockerignore` excludes `.env*`, so there is no
`DATABASE_URL` during the container build. Something in the `/follow-ups` import
chain reaches it at module load anyway.

---

## 11. Repository housekeeping

Four small changes. None affects the workflow; all of them remove friction.
Do them in one commit before session 1.

**1. Stop Claude Code reading the archive by accident.** `.claudeignore`
currently holds only `legacy/`. Add the archive, so the rule in `CLAUDE.md` is
enforced by the tool rather than by good intentions:

```
legacy/
docs/archive/
docs/design/archive/
```

**2. Keep the authority files out of the build image.** Add to `.dockerignore`:

```
SPEC.md
DESIGN.md
WORKFLOW.md
```

**3. Move `INVENTORY.md`** to `docs/archive/` — its content is in `SPEC.md` now.

**4. Add a status script** so §9 is one command. Save as `scripts/status.ps1`:

```powershell
Write-Host "=== BRANCH & COMMITS ==="
git log --oneline -5
git status --short
Write-Host "`n=== ROUTES ==="
Get-ChildItem -Recurse src\app -Filter page.tsx | ForEach-Object {
  $_.FullName.Replace("$PWD\src\app\","").Replace("\page.tsx","") }
Write-Host "`n=== TABLES ==="
Select-String -Path src\db\schema.ts -Pattern "^export const (\w+) = pgTable" |
  ForEach-Object { $_.Matches[0].Groups[1].Value }
Write-Host "`n=== SIZE ==="
(Get-ChildItem -Recurse src -Include *.ts,*.tsx | Get-Content |
  Measure-Object -Line).Lines
Write-Host "`n=== OPEN MARKERS ==="
# SPEC.md:10-11 are the legend, not rules. A rule's marker never opens a
# bullet, so excluding "- **[" is what makes these counts rule-level.
"CHANGE: " + @(Select-String -Path SPEC.md -Pattern '^(?!- \*\*\[).*\[CHANGE\]').Count
"BUILD:  " + @(Select-String -Path SPEC.md -Pattern '^(?!- \*\*\[).*\[BUILD\]').Count
```

Then in `package.json` scripts:

```json
"status": "powershell -NoProfile -File scripts/status.ps1"
```

`npm run status` at the end of every session. Paste the output into chat.
