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
   CI (`.github/workflows/checks.yml`) re-runs the first four on push and on
   pull request, so a session that forgets them is caught at main rather than
   two sessions later. The ten verify scripts stay the session's own to run.
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
| 17 | ~~Told — refusals, cancellations, credit~~ **Done.** `S73`'s cancellation came in with it: `S128` requires a cancellation to reach the rep and there was nothing to tell them about without one. `S31`, `S73` and `S128` lost their markers; `S129` keeps its, because the moment it names — `S80`'s confirmation at approval — does not exist, so the telling hangs on `setCreditSplit` instead | `S128` `S129` `S92` `S73` |
| 18 | Compliance metric | `S123` `S127` |

Then AUDIT 1's remaining fixes, which are independent and small.

| # | Session | Rules |
|---|---|---|
| 19 | Primary rep on handover and reassignment | `S18` |
| 20 | Coordinator's comment access; the cancellation reason | `S62` `S114` |
| 21 | ~~Handover recipients narrowed to the roles `S9` names~~ **Done.** `S9` was wrong as well as the code: marketing holds companies as a rep does, so the rule gained a fourth recipient and lost its marker. The test is a deliberate proxy — no flag means "holds a company book" — and AUDIT 1 F8 records why `sees_all_reps` was the one chosen | `S9` |
| 22 | Dead-structure sweep — AUDIT 1 F9–F18, plus everything session 9 carried: `accounts`, `verificationTokens`, both snapshot tables, `project_companies.role`, and re-citing verify-routes.ts assertion labels to S numbers | `SPEC §15` |

Session 22 runs **last** of these, so it sweeps up whatever Phase 1b orphans.

### Phase 2 — The rebuild

| # | Session | Rules |
|---|---|---|
| 23 | The shell — seven-item rail, tokens, layout cap, theme, permission boolean | `D5`–`D23` `D49` `D50` |
| 24 | **The waiting list, rep scope** — and the notification tiers, persistence flags, per-anchor resolution and digest machinery come out in the same slice. The list now carries **dispatch requests as a fourth kind of item** (`S86`, `S89`) | `S86`–`S95` `D32`–`D37` |
| 25 | The waiting list, manager scope, and "Needs a decision". **The coordinator has her own queue** (`S88`) | `D38`–`D41` `S88` |
| 26 | Grouped lists with per-object lead cells — companies, projects, quotations | `D25`–`D27` |
| 27 | The stream — replaces `/reports` and `/activity`; comments narrowed to threads and projects | `S114` `D45`–`D48` |
| 28 | **The detail pages** — company, project and quotation against `D24`'s Detail archetype, **whose turn panel is half built**: `TurnPanel` renders on all three (and on a dispatch), while the rest of the archetype's order — mono reference, one line of state, facts in a bordered grid, related records as cards — is not what the screens do | `D24` `D2` `D26` `D27` |
| 28b | **The Targets screen** — `/performance` and `/targets` merge into one table, one row per rep, **the goal and the attainment together**, the edit control per row for `can_set_targets`. **It is what takes the rail from eight items to `D49`'s seven**, and it deletes `/performance`. `AD20` is settled here: the merged table either keeps the inline cell editor and `D58` says so, or it loses it. **A sub-number, not a renumber** — `§5` and `§6` cite session numbers by name, so 29 onward must not shift, and landing it before AUDIT 2 means the audit reads a seven-item rail rather than finding the eight | `D49` `D58` |

> **AUDIT 2 — the interface.** See §6.

### Phase 3 — Trust

Nothing below is optional before real users touch it.

| # | Session | Rules |
|---|---|---|
| 29 | Signals and loss reasons unified; loss cascades down | `S43`–`S49` |
| 30 | Duplicate detection and manager resolution | `S21`–`S23` |
| 31 | ~~Credit terms — rep requests, manager approves~~ **Removed.** Credit stopped being a company property to request and approve; it is now one payment method among six, recorded on the dispatch — `S71`. | — |
| 32 | Archive requests folded into the dormancy review | `S105`–`S107` |
| 33 | Sharing per project; contacts shareable | `S97` `S98` |
| 34 | **Bulk import** — nobody hand-types the customer base | `SPEC §15` |
| 34b | **The verification scripts stop leaving accounts and comments behind** — each deactivates the users it created; `verify:routes` §9 comments on a company it registers rather than on a demo one | `S111` |

### Phase 4 — Complete the picture

> **34b is ahead of 35 deliberately, and it is the founder's call.** Counted on
> 26 Aug 2026: **158 users, 149 of them `verify-*` residue**, 138 active of
> which 129 are residue — nine real accounts. A full pass of the seven
> in-process scripts adds **30 permanent active users**, and `S111` forbids
> deleting them, so nothing clears them but a re-seed. It has already reached a
> real screen twice: the comment box's people list renders one checkbox per
> active colleague, and `verify:routes` §9 posts two comments per run onto
> whichever demo company sorts first by attention — the one a reader opens
> first. Deactivating at the end of a run is `S111`'s own sanctioned end state
> and `listActiveUsers` drops them at once.


| # | Session | Rules |
|---|---|---|
| 35 | The board view for projects | `D28` `D29` |
| 36 | The monthly rollup | `D42`–`D44` |
| 37 | Password reset; holiday calendar; thresholds into `settings`; the three dead flags made live | `S8` `S11` `S94` |
| 38 | Phone pass — rep screens at 375px | `D55` `D56` |
| 39 | RTL pass — every screen, both locales | `D57` |

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
| **`D29` draws a `paid` column that `D32` and `D42` have both already concluded cannot hold anything, and the board is where it becomes visible.** *"Paid-not-yet-out is not one of them. Payment is recorded on the dispatch (S70) and no route to approved bypasses it (S72, S73), so **no interval exists between paid and dispatched** for a figure to measure"* — `D32`, deciding the dashboard's side figures. `D42` says the same for the rollup: *"Paid is not a stage."* `CHAIN_COLUMNS` still carries `paid` as a rung and `D29` names it as one of the six columns. **Measured on the board slice's own data: `paid` holds 0 projects and `waitingPayment` holds 0, for every identity** — and the two empty columns are not an artefact of how a project's position is reduced from its threads. Three derivations were compared over every project (project-level `won`; per-thread `hasDispatch`; both) and **all three give the identical six figures**, so this is the chain, not the aggregation. `waitingPayment` is empty for a softer reason and will populate — its 6 live threads all sit on projects already won by another thread — but `paid` is the structural one: **every thread in the database that reaches `paid` already has an approved dispatch against it**, which is exactly the interval `D32` says does not exist. The rung is not wrong on a *quotation*, where the chain strip still draws six and `chainOwner` still says the rep owes the dispatch request; it is wrong as a *column*, because a column is a place things sit and nothing sits there. Three answers: `D29` drops it to five columns, `S70`/`S72` gain an interval, or the rule says out loud that the column is a marker on the ladder rather than a place | `DESIGN.md` `D29` `D32` `D42`, `src/lib/chain.ts` `CHAIN_COLUMNS`, `src/lib/projects.ts` `chainByProject` | Open — a founder decision between three, then a one-line change. Nothing is wrong today: the column renders with its zero, which is `D29`'s *all six, always* behaving correctly |
| **The board scrolls its tall columns instead of capping them, and that is what keeps the projects table ungrouped.** `D70`'s *cap and state the total* was the other answer and was declined in the board slice as the cheap option — take it now, see whether it bothers anyone. **The cost is not on the board, it is on the table.** A cap's way out has to land somewhere scoped (`D59`), which means `/projects?view=table&chain=waitingPayment`, which means **the chain ladder written a second time in SQL** so the filter and the per-column count resolve before pagination (`CLAUDE.md`). That same SQL is the only thing that would let the table be **grouped and ordered by chain position**, which `D24` (*grouped, never flat*) and `D25` (*projects group as your move / moving*) both ask for and it still does not do — the table is ordered by attention now `D25`, and grouped by nothing. So the two are one decision, not two: whoever caps a column writes the ladder, and whoever writes the ladder gets the grouping for nothing. The second ladder would need `verify:schema25` holding it to `chainState()` row for row, because a ladder that disagrees with `chain.ts` is the `21 §7` trap at a new address | `src/lib/projects.ts` (`chainByProject`, `listProjectBoard`), `projects/project-board.tsx`, `DESIGN.md` `D29` `D24` `D25` `D70` | Open — deliberately deferred, with the trade recorded rather than rediscovered |
| **`D26`'s project lead cell is not built, and half of it cannot be.** *"a **six-dot mini-chain** showing chain position, plus a quoted-vs-dispatched bar"*. The first half is buildable — `ChainStrip` already draws six nodes from `chain.ts` and would need a `mini` variant. **The second half is refused by `S68`**: *quoted* for a project means summing its threads' latest live versions, and a project with more than one live thread is the same square metres counted twice — which is exactly what `projects/[id]/page.tsx` already says out loud, summing them once *"only to show that summing them is meaningless"*. So there is no quoted figure for the bar to have a numerator from. The board slice built a `Turn` cell instead — whose move plus the position, the idiom `/quotations` already uses — which answers `D2`, the rule every screen is judged against, and left `D26` unbuilt rather than shipping half a lead cell and calling the rule done. `DESIGN.md` has 26 rules describing things that do not exist; this is a deliberate 27th rather than a silent one | `DESIGN.md` `D26`, `src/app/[locale]/(app)/projects/page.tsx`, `_components/chain-strip.tsx` | Open — needs `SPEC.md` to say what *quoted* means for a project, or `D26` to drop the bar |
| ~~**`SPEC §16` asks that project names be decided *before the projects slice*, and the projects slice has now shipped without it.**~~ **Closed by migration `0030`.** The founder decided: **one name field**, written in whichever language the rep prefers, and `S26` now says so — the rule that describes what a project shows, since no rule had ever asked for the pair, which is why `§16` could cite none to amend. `name_en` became `name` by RENAME, `0009`'s recipe. **The one departure from `0009` was measured, not inherited**: `0009` dropped `name_ar` outright on 2 of 90 companies, where here **49 of 50 projects carried a distinct Arabic name**, so the Arabic one wins and the fixture is no longer 121 Arabic company names beside 50 English project names. That made `name_normalized` move too, which `0009` never had to do — it was only ever `normalizeName(name_en)` — so the migration carries `normalizeName` translated into SQL (Postgres 17 has `normalize()` for both NFKC and NFD, so no step is approximated), **proven row for row against the function itself before it was written**: 99 project values and 126 company names, 0 mismatches. `verify:schema25` **§22** is what holds it from here, over every company, contact and project row. The **latent defect it closed** was not in the plan: `name_normalized` came from the English half alone, so **an Arabic-named project could never be found by its Arabic name** on `/projects` or the board. `lookupName` survives for roles, countries and cities and lost all 20 of its project callers; `threadLabelAr` and `FollowUpRow.anchorNameAr` are gone entirely, and with them the last reason the follow-up anchor was a pair | `SPEC.md` `S26` `§16`, `drizzle/0030_one_name_field_on_projects.sql`, `src/db/schema.ts`, `src/lib/normalize.ts`, `scripts/verify-schema25.ts` §22 | Done |
| **`D25` names three groups for the companies list and only two can be built.** *Gone quiet* and *recently touched* are the thresholds `07 D5` gives; **no rule anywhere says where *due soon* starts**, and `D6`'s amber band therefore goes unused on that screen — red past the threshold, faint otherwise. Three readings were measured against rep-a's 125 companies before the group was dropped rather than guessed at: a **7-day** window before the threshold holds **4**; a **14-day** window holds **6**; the rep's own `next_follow_up_at` — *"you said you'd do this"* rather than *"the system got worried"*, and the more interesting reading — holds **3**, which says the behaviour does not exist yet. A window nobody chose becomes the number everyone believes in six months later, so it is `OPEN — not chosen` | `DESIGN.md D25`, `src/lib/companies.ts` (`COMPANY_ATTENTION_GROUPS`), `_components/silence-meter.tsx` | Open — needs a `SPEC.md` or `DESIGN.md` line, not a value picked in code |
| **`companyQuiet()` in `follow-ups.ts` is a third copy of the silence derivation.** The companies slice moved `coverage()` and `listCompanies` onto one definition in `companySilence()` — and found the two it merged **had already drifted**: `coverage()` counted a never-logged company as quiet **from the day it was registered**, `companyQuiet()` counts from registration **plus the threshold**, while both carried the same sentence in prose. On rep-a that was **100 of 125** companies marked Quiet against **36**. `companyQuiet()` keeps its own copy for now because it feeds the waiting list and the daily digest, where a silent mistake reaches every rep's notifications | `src/lib/follow-ups.ts:703` (`companyQuiet`), `src/lib/coverage.ts` (`companySilence`) | **Next few slices — not open-ended.** Its own slice, with `verify:followups` as the gate. Three copies of one definition is how the numbers start disagreeing, and two of them already did |
| **No deliberately-long company name in `seed:demo` is quiet**, so `/companies` under its default attention order exercises no RTL truncation at all — and that is the screen a rep looks at. The three long names are recent, which is the calm end of the order; `?sort=recent` reaches them and `verify:routes` §20 drives it | `scripts/seed/demo/companies.ts`, `scripts/verify-routes.ts` §20 | Open — making one long name quiet is a change to the dataset and wants its own decision |
| Search filters `ilike` a raw name, so the same Arabic name is findable on one screen and not another. **Corrected by AUDIT 1: three of six, not five.** `companies.ts`, `projects.ts:134` and `contacts.ts:77` all normalise | `quotations.ts:261`, `dispatches.ts:372`, `reports.ts:527` | Own session after the model phase |
| ~28 sites need `dir="auto"` per D62 | list cells, option labels, panels — inventory in session 3a's report | Sweep session with the `SelectField` item below |
| Eight `SelectField`s should carry `required`; each validates server-side, so the placeholder costs a round trip, not correctness | user, contact, report and quotation-line forms | Same sweep session |
| ~~Participant add/remove forms never answer a no-JS POST — `Failed to parse body as FormData`; the write lands, the response does not~~ **Closed by the LEAD below.** Both actions are bound in `ProjectLinks` and passed to `LinkRow` and `AddLinkForm` as props. `verify:routes` §17 drives add-then-remove on one row in both locales and asserts the count returns to where it started `S27` — the add is driven twice, once with an empty `companyId` so a reply on a path that writes **nothing** is proved | `projects/[id]/project-links.tsx` | Done |
| ~~`confirmPaymentAction` never answers a raw form POST. Same shape, different action~~ **Closed by the LEAD below.** `PaymentForm` is its own component and the bind moved to the call site. Two assertions now stand behind it: `verify:routes` §17 drives it on the **empty-date path that writes nothing**, and section 3’s payment POST is waited for rather than abandoned — the `fireAndForget` helper that stood there is gone, and `post()` in that chain now carries an 8s abort returning `status: 0`, which no call site accepts | `quotations/[id]/thread-actions.tsx` | Done |
| ~~**A LEAD for the two rows above, found in session 13 and not acted on.** Both build the action inline inside `useActionState`~~ **Closed, and the cause is narrower than the row guessed.** Moving the `.bind()` out to the call site and passing the action in as a prop fixes it: measured on this build at `10s` abort before and `111ms` after. **Two refinements, and they are why this survived from session 4.** **First, it is not the inline expression.** Hoisting the `.bind()` to a `const` inside the hook’s own component was measured too and still hung, so what matters is *which component evaluates the bind*, not whether it sits inside the hook call. Why that is so is **not** established — only which shape answers. **Second, the hang is a property of the data, not only of the code.** The service-line remove answered while it was the only such row on the page and hung on every attempt once a second row rendered — 7 of 8, then 3 of 4, answering only on the last row remaining. So **any earlier attempt to reproduce it could have failed for reasons unrelated to the code**, and "it does not reproduce" was never evidence the shape was sound. `verify:routes` §17 is the standing guard: every such form is driven with an abort, and a missed reply is a named failure carrying its elapsed time | `quotations/[id]/thread-actions.tsx`, `quotations/[id]/thread-lines.tsx`, `projects/[id]/project-links.tsx`, `scripts/verify-routes.ts` §17 | Done |
| **Four `useActionState` forms keep a `.bind()` inside their own component, deliberately.** `updateQuotationLineAction` and `updateServiceLineAction` (`thread-lines.tsx:122`, `:249`) and the two add forms (`:394`, `:398`) are the LEAD’s shape and were **not** changed. Every one renders only behind client state — `open` on a row, `addingLine` and `addingService` on the section — so none reaches the HTML without JavaScript and the hang cannot be reproduced against any of them. **An unverifiable change is worse than none**, and `verify:routes` §17 says so out loud rather than skipping in silence: it drives what it can reach and prints a note where a fixture carries no service line. This row is the record `thread-lines.tsx:104` cites — a comment is not a record. **If any of the four is ever made to render server-side, it must be bound at the call site in the same slice** | `quotations/[id]/thread-lines.tsx:122`, `:249`, `:394`, `:398` | Open — correct as written; it becomes work only if one of them loses its toggle |
| `follow-ups.ts` filters in memory after the fetch. **Corrected by AUDIT 1: it is the whole function, not one line.** `followUps()` fetches every row with no SQL limit, then applies four in-memory filters, a sort and `.slice()` for pagination | `src/lib/follow-ups.ts:1151-1224` | None — file is deleted in session 24 |
| `listQuotationFormOptions` returns every visible company into one `<select>`. Fine at ~90 | `src/lib/quotations.ts` | Revisit after bulk import |
| `listDispatchableThreads` is unpaginated, and since `S116` each offered thread also carries its issued version's lines so the form can pre-fill them. About 320 bytes per line — a twenty-line quotation is ~6 KB, fifty threads averaging three lines ~48 KB on `/dispatches/new`. **`S72` widened it**: the payment filter moved to the approval, so the list is now every issued thread the viewer can see rather than every paid one, and every rep loads it rather than one coordinator. The cost is the missing pagination, not the lines | `src/lib/dispatches.ts` | With the row above — same question, same answer |
| **The pace tick counts no public holiday** `D32`. `working-days.ts` skips Friday and Saturday only and records a holiday calendar as `OPEN — not chosen` `[21 §8]`, so through Eid the tick advances while nothing ships and every rep reads *behind pace* for the remainder of that month. **Correct as written** — `D32` inherits that `OPEN` rather than answering it a second time, and a calendar-day denominator would be equally blind, so this is not a cost of counting working days. It will read as a bug the first Ramadan after go-live | `src/lib/working-days.ts`, `D32` | Open — a holiday calendar, if one is ever asked for |
| `awaitingSignatureCount` is unpaginated: it reads every visible thread's live version — three small columns — and counts the positions `chainState()` returns. Deliberate, and the alternative is worse: restating the chain ladder in SQL is the second derivation `src/lib/chain.ts` exists to prevent. Grows linearly with the reader's book — fine at one rep's ~60 companies, and a `sees_all_reps` identity reads the whole company | `src/lib/quotations.ts` | With the two rows above — same question, same answer |
| **`verify:schema25`'s `S121` check reads `status <> 'approved'` where the rule means *never approved*.** Two seeded dispatches were approved, numbered, then **cancelled** — which `S72` says is the only way out (*approval is final; the dispatch is cancelled, never un-approved*) and `S31` counts nowhere but keeps as history. All 7 cancelled dispatches in the database carry an `approved_at`, so the number is legitimately theirs and the assertion is too strict, not the data wrong. **Pre-existing**: introduced with `seed:demo` (`28141cd`), found while verifying the dashboard slice, which touches no writer of `dispatches`. Candidate fix is `approved_at is null` in place of the status test | `scripts/verify-schema25.ts:2306` | Own session — it is an assertion about `S121`'s meaning, not a display change |
| Comments render on companies, contacts and dispatches. `S114` and `D48` allow quotation threads and projects only; the `comments_record_type` CHECK admits five kinds, the company screen imports `CommentBox`, and `verify:routes` §9 asserts the wider behaviour | `src/db/schema.ts`, `companies/[id]/page.tsx`, `scripts/verify-routes.ts` §9 | Session 27, which narrows comments — it deletes that walk |
| ~~`quotation_threads.closed_at` and `closed_by_user_id` have no writer and no reader outside the schema~~ **Classified by the `0027` sweep and KEPT.** Still 0 of 636, and still unwritten — but `S47` names them in its own words: *losing a project closes every open quotation under it; they inherit the project's reason and are marked as **closed by the project***. That is their writer, and it is `[BUILD]`, not absent. So this is `has_credit_terms`'s pattern in the other direction: landed eleven migrations early, but by a rule that still wants it. The `quotation_threads_closed` CHECK stays with them, and it is `AUDIT 1 F18` entire — the only CHECK in the schema on columns nothing writes. `verify:schema25` §2 now asserts all three present, with `S47` named, so a later sweep cannot take them for being empty | `src/db/schema.ts` | `S47`'s slice, which builds the writer. **Not** a drop — the sweep looked and left them |
| `companies.merged_into_id` has readers (isNull filters) but no writer. **Corrected by AUDIT 1: four modules, not five** — `coverage.ts`, `dispatches.ts`, `dormancy.ts`, `follow-ups.ts`. 0 of 809 companies carry one. **Classified by the `0027` sweep and KEPT**: `S21`–`S23` build duplicate resolution, and four modules already read it, so it is the least dead thing the sweep looked at. `companies_merged_into_idx` stays with it; both are asserted present in `verify:schema25` §2 | `src/db/schema.ts` | Session 30, which builds duplicate merge |
| ~~**12 of 66 quotation versions carry no product lines at all, 6 of them issued.**~~ **Closed in the `S60` session** — 13 by the time it was measured, 7 of them frozen past `requested`. **Not reachable through today's code**, which was the guess in this row and was wrong: `createQuotationThread` already refused a version with none and `removeQuotationLine` already refused the last one, neither citing `S60`. Every violating row came from `verify-phase9` and `verify-phase10a` inserting `quotation_versions` directly; both now go through `scripts/quotation-fixture.ts`. `issueVersion` gained the third guard, `verify:schema25` §18 asserts it over every row | `src/lib/quotations.ts`, `S60` | Done. The remaining question is not `S60`'s: **nothing tells a rep why an issued quotation prefills no lines**, which is `S116`'s screen, not this rule |
| ~~`quotation_lines.form_factor` is always written `'sheet'`; the enum's `coil` value is set nowhere~~ **Dropped in the `0027` sweep**, 850 of 850 `sheet` by then. The column and the `form_factor` type went together — it was the type's only column, so a plain `DROP TYPE` rather than the rebuild `record_type` needed. `12 §11`'s scope boundary survives as the rule it always was; it never needed a column to state it, and `dispatch_lines` had already refused to copy one `S116` | `src/db/schema.ts` | Done |
| `report_signal` has nine values. **Corrected by AUDIT 1: `S43` lists eleven, not ten, and two are missing, not one** — *stock shortage* and *customer went quiet*. `loss_reasons` also seeds nine and is missing a different two — *quality concern* and *payment terms* — so the two lists are complementary halves whose union is exactly `S43`'s eleven. Seven shared concepts carry different tokens (`competitor_cheaper`/`lost_to_competitor`, `lead_time_too_long`/`delivery_time_too_long`, `specification_unavailable`/`specification_not_offered`, `project_delayed`/`project_cancelled_or_postponed`, `colour_unavailable`/`colour_or_product_unavailable`), so unifying is not a union. Only two values are in use in 30 signal rows, so the data migration is small | `src/lib/enums.ts`, `src/db/schema.ts`, `scripts/seed/loss-reasons.ts` | Session 29, which unifies the vocabulary |
| **A company parked with a date has nothing that surfaces when the date arrives.** `on_hold_until` only **suppresses**: `gather` drops every row on that company while the date is still ahead (`follow-ups.ts:1175-1178`), and when it passes the company simply stops being suppressed. Nothing announces the wake — it returns only if an automatic threshold independently holds, so a fortnight's park on a company touched last week ends **silently** and the rep is never told it woke up. `D33`'s *on hold resuming this week* tile was the only thing in either authority file that named this, and it left with `D33`'s rewrite because it was never a `FOLLOW_UP_KINDS` kind and no tile could have counted it. Recorded here so the gap does not leave with the tile | `src/lib/follow-ups.ts:1175-1178`, `DESIGN.md` `D33` | Open — needs a founder decision before it can be a rule. Session 24 owns the list it would join |
| **The rail footer's avatar overlaps the user's name — observed once, not reproduced.** Seen in the founder's screenshot at 1366: Windows, **Brave**, dark, English, usable viewport ≈890–910, name *Jerom*, role *Super Admin*, the circle painting over the name. **Not reproducible here.** The rail was rebuilt against the real compiled stylesheet and measured in headless Chrome: the footer holds a clean **10px gap** — avatar fixed at x=12–44, name at x=54 — across viewport heights 305–945, device scale 1 / 1.25 / 1.5, long / single-word / Arabic names, wide page content squeezing the column, and both the production and dev stylesheets. `md:flex` beats `hidden` and `md:overflow-visible` beats `overflow-x-auto` in the emitted CSS, so neither is a display or overflow failure. **Two hypotheses are eliminated outright**: there is no avatar component anywhere in `src/` — the rail inlines a `<div>` carrying a text node, `flex-none`, measured 32×32 every time, so no image, no fallback and no positioned span — and `mt-auto` is not it either, since the overflow it causes needs a viewport under ≈487px and only ever pushes the footer **below** the aside, never sideways. **What is left and cannot be tested here: Brave against Chrome on `backdrop-filter` compositing.** The rail took `glass` in `10d43c8` and the screenshot is after it; headless Chrome composites in software, Brave on that laptop does not. **Confirmed by the founder in the shell slice, and acted on.** It still reproduces in **Brave, dark, at 1366** — the exact configuration headless Chrome measured clean — which settles it as a **rendering difference, not a layout one**, and leaves the hypothesis above as the only one standing: `glass` gives the `<aside>` a `backdrop-filter`, that promotes it to its own composited layer, and a promoted layer can paint its children at subpixel offsets the layout tree never shows. That is precisely a clean measurement against a visibly overlapping paint. **Fix applied: `relative isolate` on the footer**, giving it its own stacking context so it is not painted by the aside's promoted layer. One class, no rule touched, and the reason is written at the line. **`glass` was never a candidate for removal** — `D8`, `D14` and `D21` make the rail one of exactly two surfaces that may carry `--blur` | `src/components/app-rail.tsx:169-184`, `DESIGN.md` `D8` `D14` `D19` `D21` | Open — **and it cannot be closed from here**, because headless Chrome never showed the bug and still does not, so a passing `verify:routes` is not evidence. The founder checks it in Brave. If it holds, this closes. If it does not, the next thing to try is `relative z-10` on the avatar so it cannot be painted over its sibling — and Brave with hardware acceleration off (`brave://settings/system`) confirms the compositing diagnosis either way, which would put it in `AD34`'s class of browser findings rather than the markup's |
| **`verify:routes` §17 consumes its own preconditions, so it passes once per database and then fails 10 checks for ever.** §17 drives the real POSTs — `confirm-payment`, `issue`, `return`, `remove-line` — and each one moves the only fixture in the state the next run needs. Measured in the shell slice: the first run was **778/778**; the second, against the same build, failed 10, all of them *reachability* preconditions (*"an unpaid quotation is reachable — nothing offered confirm-payment"*, *"the issue form is reachable for the coordinator"*). The database agrees — `accepted_for_processing_at is not null` is **0 of 996 threads**, so the payment form has nothing to render on. **Proven independent of any code change**: `git show HEAD:scripts/verify-routes.ts` run against the same server fails the *identical* 10, at 744 checks against the slice's 762 — a difference of exactly the 18 rail assertions the slice added. So a green §17 is evidence about the **data**, and a red §17 is not evidence about the diff. **`seed:demo` measured it, and the number is six.** Eight consecutive runs against one `npm run seed:demo`: runs 1–6 green (803 · 802 · 801 · 801 · 801 · 801 checks), run 7 red with **exactly these 10**, run 8 identically red. Re-running `seed:demo` returns it to 803/803. The mechanism is now known rather than guessed: each run adds **4 quotation threads under `rep-a` — 2 rejected and 2 paid — and 4 companies and 6 dispatches**, and *none of the four threads offers a §17 precondition*: a rejected thread is not `open` so the coordinator's issue, return and remove-line panels do not render, and a paid one does not offer `confirm-payment`. Page one of `/quotations` is 25 rows ordered `desc(created_at)`, so residue displaces a seeded precondition at 4 per run and the 25th slot is consumed on run 7 — `25 / 4 = 6.25`. **`cancel` is not among the 10 and never was**: it needs only `open`, which an issued thread still is. The drift 803 → 801 over runs 1–3 is the two `removeServiceLine` drives eating the three seeded service lines, one per locale per run | `scripts/verify-routes.ts` §17 **Amended by the `S133` slice: eight, not ten.** Both *an unpaid quotation is reachable for the payment form* checks — one per locale — went with the payment form itself, so two of the ten cannot go red again. The **six-runs-per-seed count is unchanged**: the same four threads per run still displace the same page-one slots, and the mechanism was never the payment form in particular. | Open — a harness defect, not a screen one, and now a **counted** one. `npm run seed:demo` is the reset: six clean runs, then re-seed. The real fixes are unchanged — §17 creates and tears down its own fixtures (as `scripts/quotation-fixture.ts` already does for versions), or the walk moves to a scratch database — and a third is now visible: **§17 could scan every page rather than page one**, which would buy far more than six runs for one loop. Until then, **read §17's 10 as environmental unless §1–§16 also move**, and re-seed rather than diagnose |
| **The verify suite is not idempotent against the record tables, and the database is now mostly its output.** Users and comments were the two classes that reached a *person* — a live account in every mention picker, a comment stuck on a demo company `S107` — and **slice 34b closed both**. The rest reaches the *numbers*, and nothing closes it: **a full pass writes ≈485 rows across sixteen tables**, before the ~300 audit rows that follow them. Measured 26 Aug 2026 by attributing every row to its script's stamp: **92% of dispatches** (573 of 621), **86% of quotation threads** (389 of 450), **84% of projects** (251 of 299), **100% of dormancy reviews** (48 of 48), 97% of credit splits, 83% of `company_reps`, 81% of comments, 78% of rep reports, 75% of companies, 66% of `project_companies`, 64% of notifications, 29% of the audit log — and 96% of users, which is what 34b was measured from. Worst writers per run: `verify-phase10a` **17 companies and 24 memberships**, from one `makeCompany` helper called in a loop; `verify-followups` **13 companies**; `verify-slice3` **55 dispatches and 182 audit rows**; `verify-phase9` **31 rep reports**. **`verify:schema25` is not read-only despite the name** — it holds no `insert()` call, which is exactly what made it look inert, and creates 3 companies and 2 projects a run through `createCompany` / `createProject`. **The consequence is not the row count.** Every screen judged from here on is being read against data that is mostly not real, so a figure that looks wrong on a dashboard may be residue rather than a defect, and a threshold tuned against it is tuned against nothing | every `scripts/verify-*.ts`. The counts reproduce by grouping each table on its script's stamp — `verify3-`, `verify9-`, `verify10a-`, `verify11-`, `verifyc-`, `verifyfu-`, `verifysh-`, `schema25-`, `routes-`, `s74-` | Open. **`seed:demo` is the ROUTINE reset, not an occasional one** — the §17 row above found the same wall from the other end and set the number at six runs. The real fix is the one that row already names: each script tears down the records it creates, as `scripts/quotation-fixture.ts` does, or the walk moves to a scratch database. **Records are not people** — nothing renders one as if it could act — so none of this is a disclosure defect, which is why 34b ended the accounts and only counted these |
| ~~**Arabic showed a hard vertical seam down the page with a lighter block beside it, and the rail looked wider than in English.**~~ **Both closed in the shell slice, and they were one defect.** `D13`'s glow reads logically now, but the RTL red was first set to the geometric mirror, **92%** — and the red ellipse is 1200px wide against a 1366px viewport, so at 92% its outer fade lands *inside* the frame: a visible edge at ≈537px with everything to its right washed lighter, the rail included. English never showed it because 8% puts that same edge off-frame. **108% is what puts it off-frame on the other side**, and the mirror was right on paper and wrong on screen. **The rail was never wider.** Measured in **Brave itself** over CDP at 1366 and 1440, both locales: the `<aside>` is **236px in all four**, `scrollWidth === clientWidth` on every link, and the widest Arabic label — *عروض الأسعار*, 75.5px — is **narrower** than the widest English one, *Performance* at 82.6px. `md:w-59` emits `width:calc(var(--spacing) * 59)` inside `@media (min-width:48rem)` with `--spacing:.25rem` defined, and flexbox clamps a flex item's automatic minimum to `min(specified, content)`, so a definite 236px cannot be pushed wider by content in either direction. The apparent width was the wash abutting the rail | `src/app/globals.css`, `src/components/app-rail.tsx:127`, `DESIGN.md` `D13` | Done. **The rail width itself is named by no `D` rule** — `w-59` is `AD27`/`AD28`'s class of uncited constants, for whoever writes that rule |
| **The rail carries EIGHT items against `D49`'s seven — deliberate, and temporary.** The shell slice added **Activity** and **Targets**, which `D49` requires and the rail lacked, and **kept Performance**, which `D49` lists as *not top-level*. Moving the rail item before the screens merge would hide attainment from everyone who can reach `/performance` today — the rule's merge is a screen change, and the rail cannot lead it. Performance sits **last in `track`**, so deleting one line leaves `D49`'s order already correct, and the code says so at the line. **Session `28b` is what takes the rail to seven**: it merges `/performance` and `/targets` into one table and deletes the route. Until then `D49` and the rail disagree by exactly one item, on purpose, and both files record it | `src/components/app-rail.tsx`, `DESIGN.md` `D49`, `WORKFLOW §4` row 28b | Closes with `28b`. Not a defect to fix in place — fixing it early is the thing that would break |
| **The rail footer leaves the rail when the viewport is shorter than ≈487px.** Measured, not inferred: the `<aside>` is `md:h-svh` and the `<nav>` cannot shrink — `md:overflow-visible` wins, so `min-height: auto` holds it at content height — so free space goes negative, `mt-auto` resolves to **0**, and the footer overflows the bottom. At a 305px viewport it lands **166px below** the rail's own box, painting over the page with no rail ground under it. Found while chasing the row above and unrelated to it. It needs a genuinely short window at `md` width or wider, which is why nobody has hit it | `src/components/app-rail.tsx:127,147,169` | Open — session 23 owns the rail. One line: the nav shrinks, or the footer does not float |
| **Three `verify:routes` assertions encoded "the coordinator holds no company" as if it were a rule. Corrected in the `seed:demo` slice.** `FORBIDDEN` listed `/projects/new` and `/contacts/new` as 404s for her and §15 asserted the New button absent, both with the same comment: *"the coordinator holds none"*. That was true of every fixture set ever built and of no rule. `S9` names the coordinator as one of the four an assignment may hand a company to, `companyBookHolderFilter` admits the role, and **`S127` needs her to hold one** — *she may raise a dispatch request against her own company and approve it herself*, which nothing in the project had ever exercised. `seed:demo` gives her four, so both forms correctly answer 200 and the button correctly renders; six checks went red for a rule-legal dataset. The route pair came off `FORBIDDEN` (the walk now asserts the 200), and §15's check became the **biconditional** — the button is offered exactly when the route answers — which is what `D51` actually says and holds whether or not she has a book. `S76` is untouched: `READ_ONLY` still holds her to read-only on every project and contact she can see | `scripts/verify-routes.ts` `FORBIDDEN`, §15 | Done |
| **`S76` says the coordinator "may not edit" a project or a contact, and the code lets her edit her own.** Measured, not inferred: `canViewRecord(coordinator, "project", …)` is **true** for a project she owns and **false** for another rep's, while `visibleProjectsFilter` is widened for her — so she reads every project and writes only hers. That split is coherent and is what `S76` was reaching for, but the rule's sentence does not say it, and until `seed:demo` no coordinator owned a project so nothing could tell the two readings apart. It matters because `S127` needs her to hold companies and `S9` lets one be assigned to her: a coordinator who may create a project on her own company but not edit the one she just created would be the incoherent reading | `SPEC.md` `S76`, `src/lib/authz.ts` | Open — a `SPEC.md` correction. `S76`'s "she may not edit either" needs *"a project or contact she does not own"*, the way `S30` already carries `S76`'s exception in place |
| ~~**The linked dispatch route forces a project; the free route forbids one.**~~ **Closed by migration `0031`, exactly as this row's disposition predicted.** `S50`'s amendment was taken: the null case is gone, so the required-but-empty picker is gone with it — `projectForThread` has one branch and no query, and the dispatch form renders no project control on either route. **The free half is not closed and was never this row's to close**: `S75`'s *"a free-entry dispatch may name a project"* is still unbuilt and still carries its own `[BUILD]`, and `dispatches/actions.ts` still strips the field on that route. What is no longer true is the asymmetry, because neither route asks any more | `src/lib/dispatches.ts` `projectForThread`, `src/app/[locale]/(app)/dispatches/dispatch-form.tsx`, `SPEC.md` `S50` `S74` | Done — the linked half. `S75`'s half stays with `S75` |
| **`S30`'s cost on the raise picker is real in production and cannot be produced by the seed.** `S50` offers the rep only *projects he can already see*, which is `ownProjectsFilter` — owner or explicit share, never company membership `S30`. So a rep whose company already holds a project belonging to **another** rep is offered nothing, creates a second project, and nobody finds out until the two are noticed. **Measured on `seed:demo`, and the measurement is the problem: zero.** Every company has exactly one live rep, no project is owned by anyone but a rep of its own company, and `preflight.ts` **refuses a fixture that breaks either**, citing `S30`. The case therefore **cannot be produced by the seed at all**, so no verify run will ever catch a regression in it — which is worse than a case that happens rarely. Not *small and accepted*: unmeasurable | `src/lib/quotations.ts` `listQuotationFormOptions`, `src/lib/authz.ts` `ownProjectsFilter`, `scripts/seed/demo/preflight.ts`, `SPEC.md` `S30` `S50` | Open — either a fixture that deliberately violates the preflight rule, or a rule saying the case is unguarded |
| **The company picker on the raise form is a native `<select>` at 126 rows, and `D20` names three JavaScript exceptions.** Decided in the `S50` slice: **it stays a `<select>`.** Recorded because the control deleted beside it was an **undeclared** exception — the project `Combobox` cited an archive doc (`[15 §5]`), never a `D` rule, and `D20`'s three are the ~200-item city list, the view-mode switch and the board's scroll. Deleting it was right; the inversion then made **company** the long list, which is a different question. Whether it earns a fourth exception has a real trigger rather than a feeling: **bulk import** (`SPEC §15` item 2), which changes the number | `DESIGN.md` `D20`, `src/app/[locale]/(app)/quotations/quotation-form.tsx` | Open — triggered, not open-ended. Revisit when bulk import lands |
| **`S79` puts shared credit on the quotation; the schema puts it on the project.** `project_credit_splits.project_id` is NOT NULL (`schema.ts:1130`) and `creditForDispatches` keys off `dispatch.projectId` (`credit-splits.ts:401-418`), so an `S50` quotation with no project and an `S75` free entry can carry **no split at all** — not an empty one, none. `S129` treats this as a timing gap, to be closed when the coordinator confirms at approval; it is an **anchor** gap, and moving the anchor is a migration, not a form. Found as `E1` | `src/db/schema.ts:1130`, `src/lib/credit-splits.ts:401-418`, `SPEC.md` `S79` `S129` | Open — with the `S79`/`S80` session, which opens both credit pickers anyway |
| **A participant that has bought can be removed, and its square metres vanish.** `removeProjectCompany` (`projects.ts:1313-1341`) checks only that one link is left `S27` — never whether that company is the one a dispatch went to. The dispatch keeps its `project_id`, so `projectIsWon()` still reads won and the rep stays credited, while `S26`'s per-participant figure loses the buyer entirely. The remove control sits on the very row that renders `data-dispatched` (`project-links.tsx:73, 143`), so the screen already knows. Found as `C3` | `src/lib/projects.ts:1313-1341`, `projects/[id]/project-links.tsx:73,143`, `SPEC.md` `S26` `S27` | Open — one guard in `removeProjectCompany`, but which rule refuses it is not written down |
| **Archiving a company silently removes its open quotation from every queue.** `archiveCompany` (`dormancy.ts:308-338`) checks nothing about open threads; `visibleQuotationThreadsFilter` has no company term, so the thread stays on `/quotations`, while `quotationNoResponse` filters `isNull(companies.archivedAt)` (`follow-ups.ts:304`) and drops it from the chase. The quotation is then open on one screen, waiting on nobody, and closed by nothing — **`S86` says that state is illegal.** Found as `A3` | `src/lib/dormancy.ts:308-338`, `src/lib/follow-ups.ts:304`, `SPEC.md` `S86` | Open — either archiving refuses while a thread is open, or it closes them the way `S47` closes a lost project's |
| **A field note reaches no timeline.** `S33` allows an entry with no company at all — market research, scouting, exhibition, training, internal — and `timeline.ts:223-234` scopes reports by company or project only, so there is no scope a field note falls into. `S42` makes the timeline the daily report, so `S33`'s work is logged and then never read by anybody. Roughly one entry in ten `S33`. Found as `D3` | `src/lib/timeline.ts:223-234`, `SPEC.md` `S33` `S42` | Open — needs a scope that is neither company nor project, or a rule saying a field note is write-only |
| **`S27` has no database constraint and no whole-table assertion**, unlike its structural twin `S18`, which `verify:schema25 §20` counts over every row. **11 violating rows measured** (`WORKFLOW §10`) — projects with no live participant — and every verify script inserts into `projects` directly, which is how they got there. The one guard that exists also **races**: `removeProjectCompany` reads the count and then updates, with no lock, so two concurrent removes both see two. Found as `C1`/`C2` | `src/db/schema.ts`, `src/lib/projects.ts` `removeProjectCompany`, `scripts/verify-schema25.ts` | Open — `S18`'s treatment applied to `S27`: a whole-table assertion first, then decide whether the invariant is a CHECK or a lock |
| **`notifications.record_type`/`record_id` are the one nullable pair with no pairing CHECK**, where three identically-shaped pairs elsewhere in the schema each have one. `notifications/page.tsx:205-212` reaches for `?? "company"` / `?? ""` to render around it, which is a screen inventing a default for a row the database allowed to be half-filled. Found as `E2` | `src/db/schema.ts` `notifications`, `notifications/page.tsx:205-212` | Open — one CHECK, in session 24 which touches the notification machinery `S91` |
| **All three of `S77`'s figures are gated on one nullable column.** `quotation_versions.total_sqm` (`dispatches/[id]/page.tsx:496`) decides whether the quoted-versus-dispatched comparison renders, so **a missing comparison looks identical to an `S75` free entry that legitimately has none** — the reader cannot tell *we did not compute this* from *there is nothing to compare*. Latent: no row carries it today. Found as `B3` | `src/app/[locale]/(app)/dispatches/[id]/page.tsx:496`, `SPEC.md` `S77` | Open — latent, and cheap while it stays that way |
| **The quotation readers ignore `companies.merged_into_id` while every follow-up reader excludes it** — so a merged company's quotations stay on `/quotations` and drop off the chase, the same split shape as the archive row above. And `quotationNoResponse` INNER JOINs `audit_log` on an **untyped `entity_id`** (`follow-ups.ts:295`): an issued version with no audit row is invisible to that queue **for ever**, silently, because an inner join drops it rather than failing. The no-writer half of `merged_into_id` is already a row below and is not restated here. Found as `A2`/`E3` | `src/lib/follow-ups.ts:295`, `src/lib/quotations.ts` | Open — the join is the live half and is a defect; the reader asymmetry waits on `S21`–`S23` |
| **Should a quotation stop being chased once a dispatch is submitted against it?** `S133` deleted the two `isNull(payment_confirmed_at)` suppressors and **nothing replaced them**, deliberately: measured before the deletion, the payment term removed **0** rows, because every paid thread also carried `end_state = 'accepted'` and `isNull(end_state)` already dropped it. The deletion therefore changed no behaviour, which is what made it clean. But the question the column was reaching for is real and now has nobody answering it. **Measured on a clean `seed:demo`, manager-wide, before the working-days cutoff: the `quotation_no_response` pool is 15 threads, of which 7 already carry a dispatch and 3 carry one at `submitted` or `approved`.** So the answer is worth between 3 and 7 rows on that queue | `src/lib/follow-ups.ts` `quotationNoResponse` `quotationReturned`, `SPEC.md` `S132` `S72` `S88` | Open — a founder decision, then one `notExists` term. It is a **new** suppression rule rather than a replacement, which is why it did not travel with the deletion |
| **Dropping the payment term from `projectMovement()` reorders `/projects` and moves `S89`'s stage-unchanged clock.** `projects.ts:284` took `greatest(max(thread.created_at), max(payment_confirmed_at))`; with the column gone under `S133`, a project's thread event is its raise date alone, so **every project whose payment stamp was later than its raise ages by exactly that gap**. `D25` orders the table oldest first and `projectStageUnchanged` composes the same function, so the board's within-column order, the table's order and the follow-up queue all shift together. A consequence of `S133`, not a decision — recorded so whoever notices the ordering moved has the answer written down rather than rediscovering it | `src/lib/projects.ts` `projectMovement`, `src/lib/follow-ups.ts` `projectStageUnchanged`, `DESIGN.md` `D25` | None — correct as written. The alternative was keeping a column `S133` deletes, and no rule makes a payment a movement event now that payment lives on the dispatch `S70` |

| ~~**The coordinator's approval queue has no signal for which requests need reading.**~~ **Built in session 15.** `S120`'s flag is resolved in SQL before pagination and marks the row in the Source column, so the queue now says which three of thirteen differ from their quotation without any of them being opened. Approve and refuse stay on the detail screen: `S72`'s verb is *checks*, and a per-row approve button would still be the opposite of it | `S72` `S120`, `/dispatches` | Done. **Watch it at the pilot** — whether the marker is the signal she actually works from |

**Added by AUDIT 1 (§6), ranked by consequence.** Counts are from the live
database on 19 Aug 2026, after the first **sixteen** migrations. There are now
**28**. The counts stay as they are — dated, and honest as history — but read
them against that. In particular **`0017` is the region migration**, so "0 of
414 projects carry a region" below describes exactly the state that migration
was written to change; and rows closed by the **`0027` dead-structure sweep**
carry their own re-count taken on 24 Aug 2026, so where two numbers appear the
later one is the sweep's.

**`0027` is where F9–F18 were answered as a set**, and the answer was not
uniform: eight columns, one enum value, two types and four indexes left, while
five tables, seven indexes, three role flags and two columns stayed because a
rule still names them. `F9` is confirmed closed — `companies.has_credit_terms`
is absent from the database, dropped in `0022`. `F18` turned out to be one
constraint, not a class: `quotation_threads_closed`, which stays with the
`S47` columns it guards.

| What | Where | Disposition |
|---|---|---|
| `S20` says a contact "is visible exactly when its company is". False since `S76`: `visibleContactsFilter` returns `undefined` for `can_dispatch`, so the coordinator reads every contact while every company stays closed to them. `S76` names itself an exception to `S30` and amends `S30` in place; it never amends `S20`. The code is right and the rule is stale | `SPEC.md` `S20`, `src/lib/authz.ts:546-555` | A `SPEC.md` correction — `S20` needs `S76`'s exception written onto it, as `S30` has |
| The coordinator reads every rep's comment conversation on **every project and every contact**. `visibleCommentsFilter` composes each anchor's own filter, and for those two they are the `S76`-widened ones, so both branches degrade to "the record exists". Company comments stay closed, so the asymmetry is real rather than uniform. No rule states this; `S38` protects a report's note from a share and comments have no equivalent half | `src/lib/authz.ts:878-898` | Needs a founder decision, then either a `SPEC.md` sentence or a narrowing. Session 27 touches the same code |
| `projects.region` and `projects.city_id` have **no writer that has ever fired**: 0 of 414 projects carry either, and no `project.created` or `project.updated` row in the audit log ever set one. **The discarded-input half is fixed** — `449a7e8` removed `regionForCity`'s fallback, which left the project form rendering a region select whose value silently vanished; that select, its `readProjectForm` read and `ProjectInput.region` are gone `D51`, and `verify:routes` asserts the form offers no region in both locales. The project's CITY select is deliberately untouched: what a rep picks there **is** stored, so it has something behind it. **What stays open is the columns question**, and it is three shapes: **(a)** a project's city is mandatory and the region derives from it; **(b)** it derives from the project's own city and the city stays optional, so the region is usually null; **(c)** both columns are dropped as unused structure, and a project's region is derived from its participants' cities if it is ever wanted. **It cannot simply mirror the company fix: `projects` has no country column**, so `S15`'s "mandatory when Saudi" has nothing to hang on | `src/db/schema.ts:813-814`, `src/lib/projects.ts` | Own session — needs a founder decision between the three, then one of them |
| ~~`S18` says "the primary rep is always the first rep who had the company". False in both handover paths~~ **Closed in the `S18` session.** The founder decided **primacy follows the company** — the primary rep is whoever holds it now, and the badge means *this is whose customer this is*, not *this is who found them*. `S18` is amended to say so and loses its `[CHANGE]`; who found the company is `created_by` `S123`, which never moves. **The code was right in two writers of three.** Handover's third branch — the recipient ALREADY holds the company, so there is no row to insert — moved primacy nowhere, and that is the case `team.ts` carried as `OPEN [19 §8]`: **12 of 393 companies with a live membership had no primary rep at all**, six from `verify-phase11` §11 driving exactly that branch and six from `verify-phase9` §16 stamping `removed_at` on the primary directly. **None had two** — no writer has ever made a second. `team.ts` now promotes the row that stays, §16 promotes what is left of its company, migration `0026` repaired the twelve, and `verify:schema25` §20 counts both halves over every row. **No index**: a partial unique index could refuse a second primary — `project_companies_one_buyer_key` is that shape for `S26` — but not the missing half, and an unused index is the defect this section already lists ten of | `src/lib/team.ts`, `src/lib/dormancy.ts`, `SPEC.md` `S18` | Done |
| **`S62`'s three acts behave three different ways, and one of three matches the rule.** `S62` requires a written reason for returning, **rejecting** or cancelling, "which becomes a comment on the thread". `returnForEdit` does exactly that — it refuses an empty reason and writes a comment mentioning the thread's raiser. `cancelThread` requires a reason and stores it in `quotation_threads.cancellation_reason`, with **no comment and no mention**, so the rep is never told a signed quotation was killed. **`rejectThread` takes no reason at all** — no parameter, no column, no field on the screen: `rejectThreadAction` passes only a `threadId` and the control is a bare `PlainButton`, so a rejection leaves nothing but an audit row recording the end-state change. Rejection is the worst of the three, because cancellation at least persists the reason somewhere a person could find it | `src/lib/quotations.ts` — `returnForEdit` 1550-1596 (comment at 1589-1595), `rejectThread` 1834-1839, `cancelThread` 1846-1862; `quotations/[id]/thread-actions.tsx:264-268` | **Done in session 17.** All three now behave one way: `setEndState` takes the reason, writes it as a comment on the thread `S62`, and raises `decision.ended_work` to the thread's raiser `S128`. `rejectThread` gained the parameter, the action, the form and its own error key; `cancelThread` gained the comment it never wrote. `returnForEdit` is untouched — a return hands work back rather than ending it. **No `rejection_reason` column**: `S62` makes the comment the reason's home, and a column beside it would be a second one |
| ~~`projects.end_state` is set by hand from the project form and **nothing derives `won`**~~ **Closed in the `S31` session.** `won` is derived from an approved dispatch by `projectIsWon`, resolved in SQL at both readers, and the value is gone from `project_end_state` so no route can hand-set it. `dormant` went with it (below), leaving the type one value. **Two things stay open and are their own rows below**: `end_state` is now equivalent to `lost_reason_id is not null`, and a free-entry dispatch still names no project | `src/lib/projects.ts` | Done |
| **`end_state` is now derivable from `lost_reason_id`.** With the type down to `'lost'`, `projects_loss_state` and `projects_loss_detail` plus `assertLossReason` make the two a biconditional in both directions — a project has an end state exactly when it has a loss reason. The column could go, and the form's Open/Lost select becomes "pick a reason or do not". **Declined three times now**: twice in the `S31` session, as the third widening of one slice's scope after two deliberate ones, and again in the `0027` sweep. The sweep's reason is its own test — *redundant is not dead*. This column has a writer and readers; taking it changes a form, `projectState` and an enforcement path, which is not what a slice that removes what nothing reads should be doing. Whoever takes it should note it has now survived three sessions that each had good reason not to | `src/db/schema.ts`, `src/lib/projects.ts` | Undecided — a simplification, not a defect. Its own session, deliberately chosen |
| **A free-entry dispatch names no project, so it can never win one** (`S75`, `S31`). `requestDispatch` writes `project_id` null on the direct route by design, `/dispatches/new?mode=direct` loads no project options and its form renders no control. `S31`'s derivation is therefore true for the two quotation routes and vacuous for the third. `S75` carries its own marker for this and `verify:slice3` §28 asserts it, so it cannot be mistaken for built | `src/lib/dispatches.ts`, `dispatches/new/page.tsx`, `dispatch-form.tsx` | `S75`'s remaining half — its own session |
| **`projectStageUnchanged` reaches dispatches through the thread**, not through `dispatches.project_id`, so a free-entry dispatch is not a project event on the follow-up clock. Since `S74` the column is the reach every other reader uses — `dispatchedSqmByCompany` and `projectIsWon` both. Harmless today only because of the row above: a free entry has no project to be an event for | `src/lib/follow-ups.ts:588` | With the row above — the two are one question |

| **The quotation's end-state badge is a status→colour map, which `D6` forbids.** `rejected` and `cancelled` render `destructive`, `accepted` renders `secondary` — *colour describes how long something has waited, never how good the outcome is*, and `D6` names `accepted` specifically as where that goes wrong. Found in session 17, which put the dispatch's own cancellation card and status badge deliberately on the other side of the line: no tone at all, asserted by `verify:routes`. Not fixed there — it is a pre-existing design defect on a different screen, and changing it was outside the task | `quotations/[id]/page.tsx:146-157` | AUDIT 2, which runs every screen against `DESIGN.md`; or the shell slice, whichever reaches it first |
| ~~Handover and dormancy reassignment accept **any** active user as recipient — only `isActive` is checked and the picker is `listActiveUsers()` unfiltered, so a company book can land on an Executive or a Super Admin~~ **Closed in the `S9` session.** The rule was wrong, not just the code: the founder decided **marketing holds companies exactly as a rep does** — taking calls and passing leads on is work added on top of a rep's, not a different job — which is why marketing and the desk rep carry the same flag vector, and that is correct modelling rather than an accident. `S9` gains a fourth recipient and loses its `[CHANGE]`. **No flag means "holds a company book"** — all twelve name acts — so the test is a deliberate **proxy**: `companyBookHolderFilter` is `sees_all_reps = false`, admitting Sales Rep, Desk Rep, Marketing and Sales Coordinator, refusing Sales Manager, Executive and Super Admin. Five flags give that same partition (`can_manage_users`, `can_set_targets`, `can_approve_delete`, `can_resolve_duplicate` are the others); **`sees_all_reps` was chosen because it is the only one naming a *position relative to the reps* rather than an act** — approving a delete or resolving a duplicate is reaching *into* a book, which does not put you above it — and `visibleMeasuredUsersFilter` already reads it that way. **If a rule ever needs the real thing, that is a flag, not a sixth proxy.** Written once in `authz.ts`; both writers ask it of one user through `isCompanyBookHolder` and keep their own `isActive` check and message, and the two pickers read `listCompanyBookHolders`. `verify:schema25` §21 asserts the partition by role name against the live seed and then every row — **592 live memberships, 0 held by an elevated role** — with an empty-read guard; `verify:phase10a` and `verify:phase11` assert each writer's refusal by its own key | `src/lib/authz.ts`, `src/lib/team.ts`, `src/lib/dormancy.ts`, `SPEC.md` `S9` | Done |
| **Two pickers name somebody who takes credit, and neither asks whether they may have it.** The **rep on a direct dispatch** (`dispatches.ts:1012`) checks **nothing** — not even `isActive` — only `can_dispatch` to name somebody other than self, and 100% of that dispatch credits the rep named on it `S78`. A **credit split's members** (`credit-splits.ts:205-210`) check **existence only**, so a deactivated colleague can be credited. Both answer *"yes, always"*, and they are **one question — may this person receive credit? — not two unrelated pickers**. That question is also the whole of it: credit reaches a person through `dispatches.user_id` and `project_credit_splits.user_id` and nowhere else, so answering it once answers it everywhere. `sharing.ts` was in this row until the founder settled it and is **not** part of the question: a share grants access to a record somebody else still holds `S100`, so it hands over no book and no credit, and `isActive` is the right test there | `src/lib/dispatches.ts:1012`, `src/lib/credit-splits.ts:205-210` | **One session, with `S79` and `S80`.** Both markers already move this code — `S79` takes shared credit off the project and onto the quotation, `S80` builds the coordinator's confirmation at approval, the moment credit is decided `S72` — so that session opens both pickers anyway and is where the one answer belongs. Deciding it earlier would be deciding it twice |
| ~~`users.city_id` has no writer and no reader~~ **Dropped in the `0027` sweep**, 0 of 401 by then. The `cityId` parameter on `createUser` went with it: taking a value and writing it to a column nothing reads is what made the column look alive, and it was the only thing that did. `users.region` still serves `10 §7`, and a rep's city is now a rule away rather than a column away | `src/db/schema.ts`, `src/lib/authz.ts` | Done |
| ~~`quotation_threads.cancelled_at` is written by `cancelThread` and read by nothing~~ **Dropped in the `0027` sweep** — the next dead-structure sweep, which is what this row named as its disposition. Nine rows carried one by then and no reader had appeared. `cancelled_by_user_id` beside it is read and stays. `dispatches.cancellation_reason` cited this column as its counter-example for carrying no stamp of its own; the two tables now say the same thing, and the audit row carries the actor and the moment `S112` | `src/db/schema.ts` | Done |
| ~~`notifications.channel` is written from `notification_types.default_channel` and read by nothing~~ **Dropped in the `0027` sweep**, ahead of session 24 rather than with it: a column with a writer and no reader is this section's business, not `S91`'s. 620 rows, every one `in_app`. **`notification_types.default_channel` went with it**, and is the finding this row did not reach — its only reader existed to write the dead column, so the sweep's rule (*a column with no reader*) reached one level further than AUDIT 1 had looked. The `notification_channel` type had no column left and went too. `04 Q17, C3` wanted the column "from day one so adding a channel is a migration, not a rewrite of every call site"; no rule ever asked for a second channel, and speculative generality is what this section exists to remove | `src/db/schema.ts` | Done. Session 24 still deletes the machinery `S91` names — this took only the channel |
| **Five tables with no reference anywhere in `src/` or `scripts/`, and 0 rows each.** **Classified by the `0027` sweep, and all five KEPT** — the answer is *each with the slice that would build its writer*, never the second deletion pass this row also offered. `attachments` `S115` · `delete_requests` `S105`–`S107` · `duplicate_flags` and `non_duplicates` `S21`–`S23` · `product_specifications` SPEC §16, which has not decided. `SPEC §15` now names all five under what the sweep examined and left, and `verify:schema25` §2 asserts each present with its rule, so *0 rows, no reference* can never again read as a licence to drop one. `accounts` is the documented sixth — the adapter's TYPE requires it. **One new finding, recorded not acted on:** `delete_requests.status` is `pending/granted/denied`, which is not `S105`'s three outcomes (*archive · keep · reassign*), and `S106` says the record is **one table** shared with the dormancy review. But a `company_dormancy_reviews` row has `outcome NOT NULL` and cannot hold an undecided request, so `S105` genuinely needs somewhere for a pending one to sit. Which vocabulary survives is that slice's to settle, not a sweep's | `src/db/schema.ts` | The `S105`–`S107` slice resolves the vocabulary. The tables themselves: done, kept |
| ~~**Ten indexes nothing uses.**~~ **Corrected by the `0027` sweep: eleven, and four of them dropped.** The eleventh is `audit_log_actor_idx` — every reader that cares who acted asks for `coalesce(acting_as_user_id, actor_user_id)` `[07 A6]`, and a btree on one of the two columns cannot serve a coalesce over both. **Dropped:** that one, `comments_author_idx`, `comment_mentions_user_idx` and `rep_report_signals_signal_idx`. The last was landed in `0005` *"so `20 §4`'s aggregation needs no migration when Phase 12 asks"* — an index built ahead of its query, which is the defect `CLAUDE.md` names for a column built ahead of its writer; `S49` adds it back with the query. **Kept:** the six on the tables above, and `companies_merged_into_idx`, which the earlier count wrongly grouped with the live four — it serves a column `S21`–`S23` wants. **And four more the sweep found that nobody had counted at all**, none of them dropped: `companies_phone_idx`, `companies_name_normalized_idx`, `contacts_name_normalized_idx` and `projects_name_normalized_idx` are only ever read through a leading-wildcard `ilike`, which no btree can serve — but `S23` names phone the primary matching key and the schema header names the normalised columns as what duplicate matching compares, so they are `S21`–`S23`'s too | `src/db/schema.ts` | Four done. The rest with the table or column each serves |
| ~~**Dead enum values.** `record_type.quotation_version` is set nowhere~~ **Dropped in the `0027` sweep**, 0 rows across all seven columns of the type. `ANCHOR_TYPES` excludes it as well as the `comments` CHECK and `SHARED_RECORD_TYPES`, and a version is reached through its thread, so nothing hangs off one. It was the canonical dead value — `dispatchStatusEnum`'s header cites it by name for why `cancelled` waited for `cancelDispatch` instead of landing early. The rebuild hit `0024`'s trap exactly as recorded: `comments_record_type` stores its literals already resolved to the type, so casting the column to `text` first fails with `operator does not exist: text = record_type`. **Proven, not assumed** — the migration was run once without the constraint pair on a clone of the live database, and it aborted on that line. ~~`project_end_state.dormant`~~ gone in `0024`; `form_factor.coil` gone with its column and its type | `src/db/schema.ts` | Done |

| ~~`product_suppliers.code`, `product_classes.code` and `product_fire_ratings.code` exist for the generated product name `S53` says FACET does not produce~~ **Dropped in the `0027` sweep.** The founder decided it: *an `ORDER BY` is not a reader, and `S53` settled the question*. The three lists order by `name_en` now, like every other lookup in `lookups.ts`. **No data was lost and no label changed**: `08 B1` says an invented longer form would be fiction, so the code and `name_en` were the same string in every seeded row — the three seed upserts and five verify scripts simply re-key on `name_en` | `src/db/schema.ts`, `src/lib/lookups.ts`, `scripts/seed-lookups.ts` | Done. This was the row that said "recorded so a later slice decides deliberately"; the sweep is that slice |
| ~~`SPEC §15` lists `accounts` under "Dropped outright". It was **not** dropped~~ **Done, and this row was stale.** The correction is in `SPEC §15` — *"`accounts` was on this list and **stays**"*, with the reason: a non-optional member of the adapter's `DefaultPostgresSchema`, so dropping it fails typecheck. A library requirement is a writer. The `0027` sweep found the fix had landed and the row had never been closed | `SPEC.md` §15 | Done |
| ~~**Three markers name something already built, in whole or in part.**~~ **Closed, and `AUDIT 1b` confirmed each from the file.** `S34` `[CHANGE]` — the marker is **gone entirely**; the enum still matches `S34`'s five channels exactly. `S81` `[CHANGE]` — kept, and the rule now names which half is true: *"The first two sentences are true today; the third is not — `divideEqually` distributes a remainder."* `S11` `[BUILD]` — kept, and says *"Deactivate and re-enable are built; the reset is not."* `S106` `[BUILD]` — kept, and says *"The review, the three outcomes and the one record all exist. Only the second way in — the rep's request — is missing."* All four are `WORKFLOW §7`'s shape now: the marker says whether work remains, the sentence says what | `SPEC.md` | Done. **The class is not closed** — `AUDIT 1b` found three more, in both directions: see `A1`, `A4` and `A5` below |
| **`S90` and `S92` name two surfaces for one message.** `S90` shows a refused, rejected or cancelled item to the person it was taken from "as it leaves", at the list; `S92` now carries the same decision as **bell news** and says it does not belong on the list. `S90`'s paragraph predates `S92` gaining the item | `SPEC.md` `S90` `S92` | Decide against a real screen, in session 24 which builds `S90` |
| **`S122` gates archiving on the rep "having been told"**, and the telling is now a bell item (`S128`, `S92`). Either the bell needs a **read state** — the persistence machinery `S91` forbids — or "told" means "sent" and the gate is nominal | `SPEC.md` `S122` `S128` | The same decision as the row above, session 24 |
| **`S92` keeps "never work" while carrying "credit granted to you"** (`S129`). Nothing in SPEC lets a rep query or contest a split — `S82` forbids them setting one — so it holds as written. Untested the first time a rep disagrees | `SPEC.md` `S92` `S129` `S82` | None. Recorded so the pilot watches for it |
| **Session 24 deletes the notification machinery per `S91` while `S92` gains two new bell items** (`S128`, `S129`). The deletion must not take them with it | `SPEC.md` `S91` `S92`, session 24 | Session 24 itself — it deletes and adds in the same breath |

**Added by AUDIT 1b (§6), ranked by consequence.** Counts are from the live
database on **24 Aug 2026**, after the twenty-eighth migration and after a full
run of all ten verify scripts — 987 companies · 517 projects · 775 quotation
threads · 807 versions · 1,230 dispatches · 466 comments · 952 live company
memberships. All ten scripts, and `typecheck` · `lint` · `build` ·
`check:messages`, were **green**; `verify:routes` passed 714 checks in both
locales. Markers stand at **12 `[CHANGE]` / 24 `[BUILD]`**.

**`AUDIT 1`'s own twenty-five were re-checked from the code and the database,
never from the commit message that claimed them. Nothing that was closed has
become wrong again** — every dropped column, index, type and enum value is
absent from `pg_catalog`; every deliberately kept table, index and flag is
present; and `F4`'s and `F12`'s invariants hold over **every row** rather than
over a fixture (930 companies with a live membership, 0 carrying no primary rep
and 0 carrying two; 946 live memberships, 0 held by an elevated role). Twelve
are closed, nine are open and unchanged (`F3`, `F8`–`F11`, `F22`–`F25`), `F7`
stays undecided by choice, and `F21` is now marked Done above.

**Two of the rows below are classes rather than incidents, and are marked as
such.** `A1`, `A4` and `A5` are **one question** — a marker that does not match
what is built — in three directions. `B1` to `B4` are **one shape** — an
assertion that can pass without reading anything.

| What | Where | Disposition |
|---|---|---|
| **`S114` carries no marker, and its first sentence is false.** *"Comments exist on quotation threads and projects only. Not on companies, contacts or dispatches."* Five kinds are admitted at every layer — the `comments_record_type` CHECK, `COMMENT_RECORD_TYPES`, five branches in `visibleCommentsFilter`, and `CommentBox` on the company, contact and dispatch screens — and the database holds **180 comments on the three the rule forbids**: 140 company, 15 contact, 15 dispatch. `S114`'s own text names one gap, the unread-comment surfacing, and stops; with no marker the rest reads as done. The **disclosure** is real rather than theoretical: a comment follows its anchor `S131`, so a company comment reaches anyone holding a company share, and `S38` gives a report's note a half a share may not read while a comment has no equivalent. The behaviour is already the `S114`/`D48` row further up this section; **what is missing is the marker on the rule** | `SPEC.md` `S114` | Open — a marker decision. **One of three: `A1`, `A4`, `A5` are the same defect** |
| **`S8` names three roles for `can_export`; the seed grants it to two.** *"Export, delete approval and duplicate resolution are held by **Executive, Sales Manager and Super Admin**, and in practice the Sales Manager uses them."* The seed sets `canExport: false` for Sales Manager and states the opposite rule in its own header — *"bulk export is super-admin only `[07 B8]`, plus the executive `[12 §3]`"*. `can_approve_delete` and `can_resolve_duplicate` **do** match all three. `S8`'s `[CHANGE]` names only the missing readers — *"All three flags must be read by the code; today none are"* — so reading the flags would leave the Sales Manager still unable to export, and the rule would still say she can. Two sources disagree and the rule is one of them | `SPEC.md` `S8`, `scripts/seed/roles.ts:79` | Needs a founder decision — which of the two is right |
| **`S107` states a gate that is wrong, and carries no marker.** *"Archiving is gated by the delete-approval flag (S8). That gate is not built… archiving is gated by `canAssign` instead."* Confirmed: `archiveCompany` checks `canAssign`, and `canApproveDelete` has no reader in `src/` at all. Work plainly remains and the rule carries **neither `[CHANGE]` nor `[BUILD]`**, which `WORKFLOW §7` makes the marker's job. Separately, the rule names the flag **`canApproveDeletion`**; the column is `can_approve_delete` and the TypeScript is `canApproveDelete`, so a grep for the name `S107` gives finds nothing | `SPEC.md` `S107`, `src/lib/dormancy.ts:314` | Open — a marker decision, and a one-word name correction |
| **`S117` is `[BUILD]`, is half built, and its text does not say which half.** `[BUILD]` means *nothing exists yet*. In fact `dispatch_lines.unit_price`, `line_total` and `vat_amount` are all `NOT NULL` at `VAT_RATE` `S57`, and the dispatch detail screen renders all three **below square metres in prominence**, citing `S117` by number three times — to the rep, the coordinator and the manager, which is exactly who the rule names. What does **not** exist is a dispatch-level total: `dispatches` carries no `total_excl_vat` / `total_vat` / `grand_total` the way `quotation_versions` does, and nothing sums the lines into money. This is the failure `WORKFLOW §7` was written for — *"`S118` read as finished while two of its three clauses were unbuilt"* — running the other way | `SPEC.md` `S117`, `dispatches/[id]/page.tsx:337-338`, `:491`, `:630` | Open — a marker decision. **One of three: `A1`, `A4`, `A5` are the same defect** |
| **`S123` is `[BUILD]` and is wholly built.** The rule's own text says so: *"Both figures exist, over dispatch requests, and nothing else is counted. `/performance` carries them per rep for a month."* Every clause checks out — `requestOriginForPeriod` computes `raised`, `raisedForThem` and `editedByAnother` in SQL, bounds the month on the **act**, and reads `coalesce(acting_as_user_id, actor_user_id)`; `/performance` renders all three and says they do not add or subtract; `verify:slice3` §30 asserts both figures, the impersonation case and `S127`'s self-raised request. **One of the twenty-four `[BUILD]`s therefore names nothing unbuilt**, which is a reading of the progress bar rather than of the code | `SPEC.md` `S123`, `src/lib/dispatches.ts:2622`, `performance/page.tsx` | Open — a marker decision. **One of three: `A1`, `A4`, `A5` are the same defect** |
| **`S76` is `[CHANGE]` and every sentence in it is true of the code.** Sight is widened — `visibleProjectsFilter` and `visibleContactsFilter` return `undefined` for `can_dispatch`; `canViewRecord` is deliberately not widened, so she writes to neither; and her `S62` edit right over a submitted request's lines, stock, shipment and payment ships. `verify:routes` §15 drives every clause in both locales. The unbuilt thing the marker appears to be carrying is that **a dispatch names no contact** — `S20` says so and sends the reader to `S76`'s marker for the reason — but `S76` never mentions a contact column. Either the marker is stale or the rule owes the sentence `S20` is standing in for | `SPEC.md` `S76` `S20`, `src/lib/authz.ts:569-572`, `:625-628` | Open — a marker decision, or one sentence on `S76` |
| **An assertion that can pass without reading anything — `verify-comments.ts:963-975`.** It takes page 1 of `listNotifications(repB)` (25 rows), filters to unread mentions, marks **those** read, then asserts `unresolvedCount === waitingBefore - mine.length`. Nothing is cleaned up between runs and repB accumulates notifications, so the moment the mention this section raised is not on page 1, `mine` is empty, nothing is read, and the check is `x === x - 0` — under the label *"reading it clears the badge"*. It is the only assertion standing behind `21 §4`. The suite already solves this shape elsewhere: `verify:slice3:2468` guards a negative with `working.total > 0`, and `verify:schema25` §20 and §21 each carry an explicit empty-read guard. **Unproven: read from the code and the page size, not reproduced** — constructing the row count that would make it pass falsely is a write, and an audit changes nothing | `scripts/verify-comments.ts:963-975` | Open. **One of four: `B1`–`B4` are one shape** |
| **`verify-comments.ts:749-753` asserts against whichever mention comes first.** `outsiderRows.rows.find(row => row.typeKey === mentionReceived)` pins no record — unlike the coordinator branch 190 lines above, which matches on `payload.recordId === project.id`. It is right today only because the list happens to be newest-first, and only until the outsider carries a second mention. Read from the code; the run was green | `scripts/verify-comments.ts:749-753` | Open. **One of four: `B1`–`B4` are one shape** |
| **Four page-one reads with no total guard, three of them negatives.** `verify-slice2.ts:555-558` reads page 1 of `listQuotationThreads(coordinator)`, who sees all **775** threads, and line 558 is `!(…).rows.some(…)` over repB's page 1; `verify-phase9.ts:813` and `:1495` are negatives over page 1 of `listReports`, the second unfiltered. Every list in `src/lib` pages at 25. All four are correct today because the fixture rows are the newest, and none prints `saw N of TOTAL` or guards on a non-empty read — which `verify-slice3.ts:1268-1287` already does, in a comment naming the earlier version's own bug. **Unproven: read from the code and the page size, not reproduced.** Every one of them passed in this audit's run | `scripts/verify-slice2.ts:555-558`, `scripts/verify-phase9.ts:813`, `:1495` | Open. **One of four: `B1`–`B4` are one shape** |
| **`scripts/dispatch-fixture.ts:103-112` writes the value `verify:schema25` §17 tests.** It sets `differed_at_submission` from `dispatchDiffers`, which is the expression §17 asserts against. Its header explains why — a hand-written row has to satisfy `dispatches_difference_flag` at INSERT, before any line exists — and it is the least-bad option available. The consequence stands anyway: §17's *"no submitted dispatch differs with nobody named for it"* **cannot fail on a fixture row**, and 660 of 1,230 dispatches carry the flag pair, most of them fixture rows. The check is not empty — the real path computes the value once at submission and could drift from it — but its coverage is smaller than the count reads. **This one is demonstrated, not inferred**, unlike `B1` and `B3` | `scripts/dispatch-fixture.ts:103-112`, `scripts/verify-schema25.ts` §17 | Recorded, deliberately not changed. **One of four: `B1`–`B4` are one shape** |
| **`S17`'s only restriction has no assertion anywhere, and its column has never held a value.** `assertLeadSourceSelectable` is the whole of *"Marketing is not selectable by an ordinary rep"*. No verify script references a lead source; `verify-routes.ts:1664` and `:1902` post `leadSourceId` **empty** on purpose, with `categoryId`, `vatNumber` and `notes` beside it. After a full ten-script run, **0 of 987 companies carry a category, a lead source or a VAT number**, and 0 of 987 contacts carry an email or a position. This is **not** `AUDIT 1 F3`'s defect: the writers are live at every layer and 176 `company.created` audit rows carry all three keys — every one of them null. A writer that works and has never been given anything, so `S16`'s ten categories and `S17`'s six sources are unexercised end to end | `src/lib/companies.ts:326`, `scripts/verify-routes.ts:1664`, `:1902` | Open — a verification gap, not dead structure |
| **Five doc claims that contradict a current rule.** This project reads comments as authority, so they are listed rather than counted. `quotations.ts:2003-2004` — `confirmPayment` still says *"dispatch is blocked until it is set"*; `S72` and `S73` moved the gate to the approval and replaced it with a payment method, and `dispatches.ts:1320-1335` says so at length. `dispatches.ts:2452-2453` — *"`S31` makes a project won when the payment arrives"*; `S31` wins on an **approved dispatch**, and the code below the sentence is right. `quotations.ts:1985-1987` — `cancelThread` names a `quotation_thread.end_state_set` audit row; `setEndState:1862` writes `quotation_thread.cancelled`, which `schema.ts:1216` names correctly. **Eight references to `recordDispatch`**, a function `dispatches.ts:728` says no longer exists. And `authz.ts:1191` cites *"`SPEC §15`'s F8 row"*; the `F` rows are here in `WORKFLOW §5` | `src/lib/quotations.ts`, `src/lib/dispatches.ts`, `src/lib/projects.ts`, `src/lib/authz.ts:1191`, `src/db/schema.ts` | Open — untidiness |
| **One mutation in `src/lib` sits outside `withAudit`.** `authz.ts:212` deletes a deactivated user's sessions from inside `getSession` — outside a transaction and outside the audit pen, and the only such write in the module. Nothing is lost: the `user.deactivated` row records the act and sessions are Auth.js rows. But `S112` says **every** mutation writes to the audit log, and nothing anywhere names this as the exception | `src/lib/authz.ts:212`, `SPEC.md` `S112` | Open — untidiness, or one sentence naming the exception |
| **`WORKFLOW §10` disagrees with the repository on six of its rows.** Migrations 20 → **28**, tables 41 → **42**, `SPEC.md` 718 → **895** lines, `S` numbers 129 → **131**, routes 38 → **39**, open markers 16/37 → **12/24**. The `D` count (63) and the skills row are still right. The section is explicitly a dated snapshot at `06aeb2b` that says to re-take rather than trust it, so this is a reading of that instruction rather than a defect | `WORKFLOW.md` §10 | Open — re-take when someone is in the file |
| **`smac_reference_verification = 'verified'` has never been written.** 0 of 807 versions, and 0 `quotation_version.issued` audit rows carrying it. Not a dead value — `thread-actions.tsx:243-251` renders a real `<select>` over both `SMAC_VERIFICATIONS` — an unexercised one, the same family as `S16` and `S17` above | `src/db/schema.ts`, `quotations/[id]/thread-actions.tsx:243-251` | Open — a verification gap |

**What AUDIT 1b could not check.** Sight — `AUDIT 2` is the interface audit, so
no `D` rule about layout, spacing or prominence was judged by eye, including
`S117`'s *"below square metres in prominence"*, which was read from the markup.
`verify:routes` drove a server on **port 3100**, because the Docker app
container holds 3000; §0's build guard passed, so it drove this build, but
`next start` warned it does not pair with `output: standalone` and the
container's own server was not the thing driven. `.env` was unreadable to the
session, so `DEV_FIXTURE_PASSWORD` and `NODE_ENV` were confirmed only by the
scripts running. `B1` and `B3` are shapes read from the code, not failures
constructed. Migration bodies were not read — the end state was checked in
`pg_catalog` and in the rows, so a migration that reached the right result by a
wrong route would not appear here.

**Added by AUDIT DESIGN (§6), ranked by consequence.** `DESIGN.md` D1–D63
against itself, against `SPEC.md`, against `src/`, against
`.claude/skills/facet-ui/SKILL.md` and against
`docs/design/facet-concept-v5-premium.html`, on **24 Aug 2026**. Read from
files only — no database query, no verify script, no rendered screen.

**The tally is the finding.** Of 63 rules, **17 hold**, **17 are partly true**,
**26 describe something that does not exist**, and **3 are not buildable
statements** (`D1`, `D3`, `D31`). `DESIGN.md` has no marker convention, so
`D46` (built) and `D42` (no such screen) are typographically identical, and
`SPEC §7`'s rule — *a rule that is only partly built says so in its own text* —
has no equivalent here. The full per-rule classification is in the audit's
report; the rows below are what has to be decided or corrected.

**The three lists below are the audit's count as at 24 Aug 2026, and are left as
taken.** An audit's number records what was true when it was read, and
`DESIGN.md` still has no marker convention to read a current one from. Later
slices have moved rules: the token slice alone rewrote `D5`, `D7`, `D8`, `D9`,
`D15`, `D16` and `D19`, deleted `D18`, and made `D8`, `D13`, `D14` and `D19`
true. Re-take the count; do not patch it.

**Holds (17):** `D4` `D10` `D11` `D22` `D23` `D37` `D46` `D47` `D50` `D51`
`D53` `D54` `D57` `D59` `D60` `D61` `D63`.
**Partly true (17):** `D2` `D5` `D6` `D9` `D12` `D20` `D21` `D24` `D27` `D32`
`D33` `D34` `D39` `D52` `D55` `D58` `D62`.
**Nothing makes it true (26):** `D7` `D8` `D13`–`D19` `D25` `D26` `D28`–`D30`
`D35` `D36` `D38` `D40`–`D45` `D48` `D49` `D56` — the last three
**contradicted** rather than merely absent.

**One row was the root rather than an incident, and it is closed.** `AD3` — the
stylesheet was a different generation of the design — is why `D8` and
`D13`–`D19` were unbuilt as a set, and why the file could not be marked rule by
rule until a founder decided which generation wins. **The token slice is that
decision: v5, and the whole palette.** It closed `AD2`, `AD3`, `AD11`, `AD12`,
`AD13` and `AD15` together, and `AD29` in passing. The second sentence here
used to credit `AD11` with `AD3`'s job; `AD11` is the gradient count.

**`AD1` is already corrected**, in `§4` above, and is recorded here so the
correction is checkable.

| What | Where | Disposition |
|---|---|---|
| **`AD1`. `WORKFLOW §4`'s session plan cited the wrong `D` rules — nine rows, twelve citations, every one exactly three low.** Session 23's *"seven-item rail … permission boolean"* pointed at `D46` `D47`, which are the Log button and the private note. Session 38's *"phone pass"* pointed at `D52` `D53`, which are empty states and `notFound()`. Session 39's *"RTL pass"* pointed at `D54`, which is *there is no skeleton state*. **Not drift** — `git show 12689b4:DESIGN.md` has `D52` as the empty list and `D25` as grouped lists exactly as today, so `bd3a943` wrote them wrong. `§4`'s prose citations and all 24 backticked `D` citations in `src/` and `scripts/` are correct; only this table was. Every Phase 2 and Phase 4 session would have opened the wrong screen's rule | `WORKFLOW.md` §4 rows 23, 24, 25, 26, 27, 35, 36, 38, 39 | **Done, in this audit.** `D46`→`D49`, `D47`→`D50`, `D29`–`D34`→`D32`–`D37`, `D35`–`D38`→`D38`–`D41`, `D22`–`D24`→`D25`–`D27`, `D42`–`D45`→`D45`–`D48`, `D25`→`D28`, `D26`→`D29`, `D39`–`D41`→`D42`–`D44`, `D52`→`D55`, `D53`→`D56`, `D54`→`D57`. The `D5`–`D23` range on row 23 is unchanged — it is correct as written |
| ~~**`AD2`. `D8`'s effect tokens do not exist, and the `facet-ui` skill hands all of them to a build session as live.**~~ **Resolved by the token slice.** All seven are in `globals.css` now, at v5's values, in both themes — plus two the concept has no value for, `--surface-2-solid` and `--rail-solid`, which `D19` needs and `D8` names. `--surface-3` is gone from `D5` (it was v4's, and no stylesheet ever carried one) and from the skill's palette table. The skill's Effects table now names only what exists, points at the `card-face`/`glass` utilities that hold the texture, and writes both six-item lists out one item at a time — which closes `AD29` in passing. `--glow` went with them: no reader, and `D8` never named it | `src/app/globals.css`, `.claude/skills/facet-ui/SKILL.md`, `DESIGN.md` `D5` `D8` | Done |
| ~~**`AD3`. `DESIGN.md` carries two generations of the design in adjacent sections, and they disagree about what a surface is.**~~ **Resolved: v5 wins, and the founder took the whole palette rather than half of it.** `D5`'s table is v5's values in both themes — canvas, the two surfaces as `rgba`, line and line-strong, the dark text trio, the rail and its three text tokens, and the eight tone tokens as tints — and `globals.css` is the same list. The decisive argument was the rail: `--blur` on an opaque hex is a no-op, which is exactly the unused structure `CLAUDE.md` calls a defect. `D14`'s texture is real on all three card surfaces, `D13`'s glow is on `<body>`, and both of `D19`'s fallback paths are built | `DESIGN.md` `D5` `D8` `D14` `D21`, `src/app/globals.css` | Done |
| **`AD4`. `D41` names four things routed to a manager; two have no `S` rule and one rests on a deleted mechanism.** Duplicates `S22` ✓ and archive requests `S105` ✓. **Credit approvals: no rule** — `S80` puts the credit question on the *coordinator* at approval, `SPEC §15` records `companies.has_credit_terms` dropped (*"a credit customer is the `handled by finance` payment method `S71`, not a flag beside a gate"*), and `§4` session 31 is struck out as **Removed**. The concept still draws the card. **Shares: `S96` says there is nothing to route** — a manager initiates a share; nothing arrives to decide. `D41` is what *"makes the manager's version of the waiting list different"*, and half of it does not exist | `DESIGN.md` `D41`, `SPEC.md` `S71` `S80` `S96`, `SPEC §15` | Founder decision — what a manager actually decides, then `D41` says it |
| ~~**`AD5`. `D33`'s counts strip cannot express what the data layer computes, and the screen that tried breaches `D21`.**~~ **Resolved: four tiles over six kinds, and the fifth condition is not a tile at all.** `D33` now groups the six `FOLLOW_UP_KINDS` into four — Quotations (`quotation_no_response` + `quotation_returned`) · Gone quiet (`company_quiet` + `catalogue_no_response`) · Not moved · Your dates — so **no condition is dropped** and `D21`'s six-equal-tiles clause is not breached. `S89`'s dispatch request sitting with the coordinator is deliberately **not** a tile: it goes to `D64`'s **Requests waiting on me** block, where it can be acted on rather than counted. `D33`'s old fourth item, *on hold resuming this week*, was never a kind and leaves with the rewrite — the gap it stood for is its own row above. **Nothing in code changed**: the six-card strip still ships | `DESIGN.md` `D33` `D21` `D64`, `src/lib/enums.ts:431-438`, `src/app/[locale]/(app)/page.tsx:132-147` | Done as a rule. The screen is session 24 |
| ~~**`AD6`. `D32`'s "paid, not yet out" and `D42`'s "paid" funnel stage name a state `S70`–`S73` removed.**~~ **Resolved by halves, and the second half is open on purpose.** `D32` closes: **nothing stands in paid's place — two side figures, not three**, and its `OPEN — not chosen` is gone. **`D42` keeps its own**, by founder decision rather than oversight: the rollup is a later phase and the figure is better chosen with the screen in front of him, so it is not closed by inference from `D32`. `D42`'s separate *approved* ambiguity — `S72` gave that word to the dispatch while the concept's funnel means `S65`'s accepted — is untouched and stays with it | `DESIGN.md` `D32` `D42`, `SPEC.md` `S65` `S70` `S72` `S73` | `D32` done. `D42` open by decision, with the rollup |
| **`AD7`. `D48`'s second sentence is false and `D48` carries no marker.** *"Nothing renders a comments card on a company, contact or dispatch."* `CommentBox` renders on **five** screens. The behaviour is already this section's `S114`/`D48` row and `A1`; **the `D48` half has never been recorded**. `S114` at least admits one gap in its own text — `D48` reads as finished | `DESIGN.md` `D48`, the five `[id]/page.tsx` screens | Session 27 fixes the behaviour; the rule needs the same marker decision as `A1` |
| **`AD8`. `D56` describes the opposite of what ships, in both halves.** *"secondary columns are **hidden, not scrolled**. The rail becomes a bottom sheet."* `Table` is `overflow-x-auto` and **no** page hides a column at any breakpoint — grep for `hidden md:`/`md:table-cell` returns zero. The rail below `md` is a horizontally scrollable strip, and the code defends it: *"no Sheet component, no new dependency, no JavaScript."* A reasoned choice against a rule it does not cite | `DESIGN.md` `D56`, `src/components/ui/table.tsx:11`, `src/components/app-rail.tsx:127,145-147` | Session 38 — decide which is right before building to either |
| **`AD9`. Three status→colour maps ship against `D6`; this section records one.** The recorded one is `quotations/[id]/page.tsx:146-157`. Two more: `quotations/page.tsx:30-32` + `:177`, the same map on the **list** as a separate function; and `_components/project-state.tsx:43`, `lost`→`destructive`, rendered on the projects list, the project detail and the company page's projects card — whose own comment says *"whether a status→colour map belongs here at all is a `D6` question this rule did not open."* A fourth candidate: `dispatches/[id]/page.tsx:283` renders `approved` as `default`, solid brand red on a state, which `D7` also forbids | `src/app/[locale]/(app)/quotations/page.tsx:30-32`, `_components/project-state.tsx:43`, `dispatches/[id]/page.tsx:283` | Widens the existing `D6` row above — same session |
| **`AD10`. The chain says the coordinator owes the move at `paid`; `S72` gives it to the rep.** `OWNERS.paid = "coordinator"`, commented *"Paid unlocks dispatch, which the coordinator records."* `S72`: *"A rep requests a dispatch; the coordinator checks it and approves it."* It renders today — `chain.turn.coordinator.paid` = *"Waiting on the coordinator · dispatch"* — on `/quotations`' whose-move column, in the chain strip and in the turn panel. `D2` makes whose-move the one rule every screen is judged against and `D27`/`D29` pin it to this file, so a `D` rule stands behind a stale answer. `schema.ts:1715` notes the rung *"no longer gates a dispatch"* without following it to the owner | `src/lib/chain.ts:74-88`, `messages/*.json` `chain.turn.coordinator.paid` | Its own fix — one map entry and one message, but it changes what three screens say |
| ~~**`AD11`. `D15` says the brand gradient has exactly five uses; `D17` names a sixth.**~~ **Resolved: the count moves, not the rule.** `D15` says six and names `D17`'s row-action hover as the sixth. `D17` is untouched — it was right, and a rule that names a use joins the list rather than breaking it. Of the six only the primary button is built; the other five belong to screens no slice has reached, and an unbuilt use is not a breach | `DESIGN.md` `D15` `D17` | Done |
| ~~**`AD12`. `D16` says nothing else glows; `D27` gives the current chain dot a soft ring.**~~ **Resolved the same way as `AD11`.** `D16` says six and names `D27`'s chain dot as the sixth, which already ships at `chain-strip.tsx:165`. The list is now written one item at a time, so it can no longer read as four or six depending on how *"primary button and the app mark"* is split — that was `AD29`, closed here | `DESIGN.md` `D16` `D27`, `src/app/[locale]/(app)/_components/chain-strip.tsx:165` | Done |
| ~~**`AD13`. `D18` and `D19` give opposite instructions for the same breakpoint.**~~ **Resolved: `D18` is deleted and `D19` wins.** Below 980px the blur is reduced to 8px, never removed. Under `prefers-reduced-transparency` each blurred surface takes its own solid counterpart — `--surface-solid`, `--surface-2-solid`, `--rail-solid` — and `--blur` is `none`; one fallback token for three surfaces would have collapsed the inset onto the card and left table hover changing nothing, which `D21` forbids. `D18`'s one surviving idea, that the design must look correct with blur off, is `D19`'s last sentence. **The number is kept as a tombstone** so no citation shifts: `DESIGN.md` is now 62 rules across 63 numbers. Both media queries are in `globals.css`, and `D8` lists all three solids | `DESIGN.md` `D18` `D19` `D8`, `.claude/skills/facet-ui/SKILL.md`, `src/app/globals.css` | Done |
| ~~**`AD14`. `D49` enumerates eight rail items and says seven.**~~ **Resolved: the count was right and the sentence was wrong.** `D49` now reads *seven items, **plus** user management for those who hold it* — the eighth is conditional `D50` and never was one of the seven; running it into the same list is what read as eight named against seven counted. Separately, **Performance and Targets merge into one item called Targets** — one table, one row per rep, goal and attainment together, the edit control per row for `can_set_targets` — which is what frees the seventh slot for **Activity**. `D49` now records outright that the built rail carries Performance and lacks Activity and Targets, so the file no longer reads as describing what ships. **Nothing in code changed** | `DESIGN.md` `D49`, `.claude/skills/facet-ui/SKILL.md:91`, `src/components/app-rail.tsx:35-52` | **Done.** Session 23 built the rail: Activity and Targets are on it, and Performance stays one slice longer by decision — the row above carries that, and `28b` closes it |
| ~~**`AD15`. `D7` mandates contact violet; `D21` forbids violet.**~~ **Resolved: violet goes.** `D7` names four identity colours — company blue, project amber, quotation red, dispatch green — and `D21`'s ban stands unchanged, because a rule may not mandate what another forbids. A contact's lead cell is its name and position `D26`, which never needed a colour. **Nothing in code changed**: `D7` was wholly unbuilt and still is, so this settles what a later screen slice may build rather than correcting anything that ships | `DESIGN.md` `D7` `D21` | Done |
| **`AD16`. `D25` names a quotation group the one definition of chain ownership cannot produce.** *"Quotations group as your move / waiting on the coordinator / **waiting on the customer**."* `ChainOwner` is `"rep" \| "coordinator" \| null`, and by `D27` that file is the single definition which *"derives nothing"*. `waitingPayment` is owed by the **rep** — `S65` makes accepted internal approval and the rep confirms payment. There is no customer owner, and `D26`'s own quotation examples do not have one. Session 26 cannot build the third group | `DESIGN.md` `D25` `D26` `D27`, `src/lib/chain.ts:72-88` | Session 26 needs this settled first |
| ~~**`AD17`. `D28` makes the board the projects default; `D31` builds it second.**~~ **Closed by the board slice.** `?view=` exists on `/projects` — board by default, `?view=table` beside it, as `FilterNav` links carrying the current search `D59` rather than the client switch `D20` licenses. `D31` was already satisfied: the table shipped first. `?view=cards` is `D31`'s *only if someone asks twice* and is not built; `D30`'s three activity views are still nothing, and are `AD23`'s row | `DESIGN.md` `D28` `D31`, `src/app/[locale]/(app)/projects/page.tsx` | Done. `AD19`'s half about the view-mode switch not existing goes with it |
| **`AD18`. `D62` cites a rule `DESIGN.md` does not contain.** *"This is the converse of the `dir=\"ltr\"` rule, which only ever covered LTR content."* There is no `D` rule for `dir=\"ltr\"`. It lives only in the skill. `D62` was written to promote a skill-only lesson into DESIGN — `D59`–`D63`'s whole purpose — and left its own counterpart behind. 133 `dir=\"ltr\"` sites in `src/` obey a rule that is not in an authority file | `DESIGN.md` `D62`, `.claude/skills/facet-ui/SKILL.md:158` | Phase 1c — one sentence, and it is the class `D59`–`D63` exists to close |
| **`AD19`. `D20` names three JavaScript exceptions; one exists and is used for two things it does not name.** The view-mode switch and the board's horizontal scroll do not exist. `Combobox` is used for the city list in three forms **and** for a **project** picker and a **company** picker. The skill restates it as *"the one documented exception `D20`, for the ~200-item city list"* — false in both directions | `DESIGN.md` `D20`, `quotations/quotation-form.tsx:125`, `reports/report-form.tsx:155`, `.claude/skills/facet-ui/SKILL.md:146-147` | Phase 1c |
| **`AD20`. `D58` forbids inline cell editing; it ships on `/performance`.** `TargetRow` renders an `<Input>` plus a save button **inside a `<TableCell>`**. `D58`'s other six — drag-and-drop, bulk selection, saved views, command palette, charts beyond bars, toasts — all hold | `DESIGN.md` `D58`, `src/app/[locale]/(app)/_components/attainment-table.tsx:98-105` | Decide whether `D58` means it; the control is otherwise correct |
| **`AD21`. `D52`'s second half is unbuilt in all 21 places and `D52` reads as done.** *"An empty list says what would make it non-empty **and offers the action**."* All 21 are a bare `<p class=\"…border-dashed…\">`; **none renders an action**, and the strings are *"No companies yet."*, *"Nothing logged yet."*, *"Nothing is waiting."* `D60`'s placement half is built and correct | `DESIGN.md` `D52`, `messages/en.json`, 21 sites | Phase 1c marks it; the sweep that writes the strings is its own |
| ~~**`AD22`. `D34`'s three kind marks are one short of `S86`'s four anchors.**~~ **Resolved: a fourth mark, a third action, and both chains.** `D34` carries **C, P, Q and D**, four marks for `S86`'s four anchors, as the concept already draws. Its actions are **Log** on a company or project row, **Open** on a quotation or dispatch row, and **Plan** on anything slipping; *Confirm* goes, because confirming a payment is a step inside the quotation rather than a row action. **Approve and refuse are deliberately not row actions** — they belong to `D64`'s **Requests waiting on me** block, which is where a coordinator acts. `D40` gains the second chain: both run through her, the quotation chain and, since `S72`/`S124`, the dispatch chain | `DESIGN.md` `D34` `D40` `D64`, `SPEC.md` `S86` `S88` `S89`, `docs/design/facet-concept-v5-premium.html:348` | Done as a rule. Sessions 24 and 25 build it |
| **`AD23`. `D45`'s one stream is four screens.** *"'What happened' is **one stream**, not five screens."* Today: `/reports`, `/activity`, `/companies/[id]/timeline`, `/projects/[id]/timeline`. Of `D45`'s four filters — *who, what kind, outcome, signals raised* — `/reports` has type and outcome; who and signals do not exist. `D30`'s three activity views do not exist | `DESIGN.md` `D45` `D30` | Session 27 |
| **`AD24`. `D9`'s radii are not the code's.** Cards render 14px (`rounded-xl`) against *"12px cards, 16px large cards"*; badges render 32px (`rounded-4xl`) against *"20px pills"*. Controls at 10px are right. `globals.css:78-83` defends 14px by citing `22 §1`, an archived document | `DESIGN.md` `D9`, `src/app/globals.css:78-83`, `src/components/ui/badge.tsx` | Untidiness — Phase 1c or session 23 |
| **`AD25`. `D12` is met on its floor and missed on its title and its base.** Nothing is under 10.5px ✓. `PageHeader` is 24px ✓ but `DetailHeader` is `text-[25px]`, taking the concept's number over the rule's. *"base 14px / 1.5"* is set nowhere — no `font-size` on `body`, so 14px is achieved per component and an unsized element renders 16px. Section labels use `tracking-wider` (.05em) in tables and `tracking-widest` (.1em) in the rail, neither being `.09em` | `DESIGN.md` `D12`, `src/components/page-header.tsx:65`, `src/app/globals.css:200-207` | Untidiness |
| **`AD26`. `D17`'s three motions are unbuilt and `prefers-reduced-motion` is honoured nowhere.** No media query, no `motion-reduce` variant anywhere in `src/`, against *"`prefers-reduced-motion` is respected and is the path that gets tested."* The only motion that ships is `transition-colors`, which `D17` does not name and `D21`'s last clause therefore forbids | `DESIGN.md` `D17` `D21`, `src/` | Untidiness until session 23 |
| **`AD27`. Six tokens in `globals.css` have no `D` rule and three are dead.** `--blue-600`, `--amber-600`, `--green-600` are **declared and never read**; `--success`/`--success-foreground` are aliased to `--color-success` with **no consumer**; `--glow` is **declared in both themes and never read**, and is misnamed against `D8`'s `--brand-glow`. `Badge`'s four tone variants `red`/`blue`/`amber`/`green` have **zero call sites**. `--red-500`, `--red-600`, `--brand-ink`, `--rail-text`, `--rail-text-strong`, `--rail-active` are read but named by no `D` rule | `src/app/globals.css:98-105,158-159,136,197`, `src/components/ui/badge.tsx:25-28` | Untidiness — a dead-structure question, not a design one. With the next sweep |
| **`AD28`. Patterns in use that no `D` rule names.** Three two-stop avatar gradients with hexes typed straight into components — `#7A1020`, `#8A3244`, `#4A1622`, `#31527F`, `#1B2F4C` — against the skill's *"never type a hex into a component"*; `text-destructive` as the colour of form errors and the required asterisk, which `D6`'s *"colour describes how long something has waited"* does not permit or name; the `Absent` component's deliberately-not-yet treatment; the `numeric` prop's mono-**and**-end-aligned pairing, which is the skill's invention rather than `D11`'s; `ListPagination`'s documented refusal to apply `num` to *"Showing 1–7 of 7"* against `D11`'s *"every number"*; and `TOUCH_INPUT_CLASS`, a phone-first affordance applied to one of `D55`'s four named screens | `src/components/app-rail.tsx:130,171`, `_components/turn.tsx:112`, `src/components/form-field.tsx:86,98`, `src/components/page-header.tsx:186`, `_components/list-controls.tsx:230-233`, `src/lib/enums.ts:441` | Phase 1c decides which deserve a rule. `D59`–`D63` are the precedent |
| **`AD29`. The skill's `--brand-glow` row reads as four items under a "five uses" label.** *"**five uses**: primary button and app mark · the pace badge's ring · today's cell in the week strip · the target fill's bloom"* — five only if the first is read as two. `D16`'s original error restated in the file whose header rule exists to prevent it | `.claude/skills/facet-ui/SKILL.md:68` | With the skill's rewrite, after Phase 1c |
| **`AD30`. The skill's pre-flight grep does not cover two of its own table's entries.** Item 7 greps `ml-\|mr-\|pl-\|pr-\|text-left\|text-right\|border-l-\|border-r-` and omits `left-*` and `right-*`, which the Use/Never table lists. Zero today either way | `.claude/skills/facet-ui/SKILL.md:33,180` | With the skill's rewrite |
| **`AD31`. `dispatches/page.tsx:48` cites `D28` for something `D28` does not say.** *"One query parameter, no second screen"* on a **status filter**; `D28` is specifically `?view=` on Projects and Quotations and states no general principle. The only mis-citation found: all 24 other backticked `D` citations in `src/` and `scripts/` resolve and are used correctly, and every `D` and `S` citation in `SKILL.md` resolves | `src/app/[locale]/(app)/dispatches/page.tsx:48` | Untidiness |
| **`AD32`. `D22`'s ranges are met except in two components.** `Card data-size=\"sm\"` is 12px against a 15px floor; `RecordRow` and `TimelineRow` are `py-2.5` (10px) against 11–12px. Read from the markup, not by eye | `src/components/ui/card.tsx:15`, `src/components/page-header.tsx:220`, `src/components/timeline.tsx:115,168` | Untidiness — AUDIT 2 confirms by eye |
| **`AD33`. `D26`'s dispatch clause cites a `[BUILD]` rule and covers two of four states.** It cites `S88`, which is `[BUILD]`, for behaviour that ships under `S72`. It answers for a submitted request and an approved dispatch, and has nothing for a draft (owes its rep, `S86`) or a refusal (closed). The code renders all four, so the rule is narrower than the screen | `DESIGN.md` `D26`, `src/app/[locale]/(app)/dispatches/page.tsx:245-263` | Phase 1c — one clause |
| **`AD34`. `background-attachment: fixed` is ignored on iOS Safari, so `D13`'s glow is not fixed on a phone.** The canvas gradient sits on `<body>` and the declaration is correct; iOS Safari has never honoured `fixed` and paints as though it were `scroll`, so the atmosphere travels with the content instead of staying behind it. Found while building the token slice and deliberately not fixed there — every workaround is a positioned pseudo-element or a second painted layer, which is machinery `D13` does not ask for and `D20` would have to name. It matters because `D55` builds rep screens phone-first | `src/app/globals.css`, `DESIGN.md` `D13` `D55` | Open — a phone finding. Session 38's phone pass, or whoever first opens FACET on an iPhone |

**The concept against `DESIGN.md`** — `AUDIT 1b` found three glows in
`facet-concept-v5-premium.html` that `D16` does not permit. There is a
**fourth**: `.nav .count` carries `box-shadow:0 2px 8px rgba(242,86,107,.4)`
(line 89), a brand-coloured bloom on the rail count badge — a judgement call,
but neither `--shadow` nor anything `D8` names. Beyond `D15`'s five, the
concept uses `--brand-grad` four more times: `.mark` (line 81), **`.tab.on`
`border-image` (line 111, which `D15` forbids outright — *"not on borders"*)**,
`.tile .spark i.hi` (159) and `.act:hover` (173, which is `AD11`). Four
gradients and eight shadows have no token at all — `.big` paints a gradient
**onto text** via `background-clip` (137), `.fill::after` a sheen (143),
`.reason .rb` a fading amber bar (213), four avatar gradients (91–93); five
one-pixel inset highlights sit on `.search`, `.seg button.on`, `.kind` and
`.av`, where `D8` gives `--line-hi` to *a card* and `D14` says the card texture
is *"used on every card, identically"*; three inset depth shadows on `.track`,
`.mbar` and `.gbar`. The concept also renders a **global search with a `⌘K`
hint** (232), which `D51` and `D58` each forbid. Its own unread tokens
`--brand-2` and `--ease` are real design decisions — a second brand hue, and
the motion easing `D17` never states — that no `D` rule carries.

**What AUDIT DESIGN could not check.** **Everything requiring sight — that is
`AUDIT 2`'s, and none of it is inferred above.** No screen was rendered, in
either theme or either locale, at any width. Specifically unjudged: whether the
neutrals read warm on a real display (`D4` — hex channel order only); whether
spacing reads generous (`D22` — numbers read out of the markup, which is
`AD32`'s caveat); whether any hover state changes nothing or an icon is centred
above a heading (`D21`); whether anything wraps at 1366 or 1440 (`D23`);
whether a screen answers `D3`'s question in five seconds; whether the design
looks correct with blur off (`D18`); whether the rail's mobile strip is usable
(`D56`). **Not run:** `typecheck`, `lint`, `build`, `check:messages` or any
verify script — an audit changes nothing and none was needed to read a file.
**Not queried:** the database; every count here is from files, and the comment
counts behind `AD7` are `AUDIT 1b`'s. **Not read:** migration bodies,
`docs/archive/`, `legacy/`; `docs/design/superseded/` is empty, so the v5
concept and the three files in `docs/design/archive/` are the whole design
record. **Judgement calls, flagged as such:** whether `.nav .count`'s coloured
shadow is a glow; whether `transition-colors` is motion under `D17` (`AD26`);
whether `dispatches/[id]:283`'s solid-brand `approved` badge is a status→colour
map (`AD9`).

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
- **A rule that is only partly built says so in its own text.** A marker is one
  bit and a rule can be three quarters done — `S118` read as finished while two
  of its three clauses were unbuilt. `S81` and `S129` are the model: they name
  which half is true today. The marker says whether work remains; the sentence
  says what.
- **Derived conditions are resolved in SQL, before pagination.** This has
  already shipped broken once, and it fails silently.
- **One task per session**, and the plan reviewed here before approval.
- **There is no production data.** Every row in every database is a fixture or
  verify residue. A migration never preserves, backfills or merges data — it
  clears, and `db:reset` is always available. Where clearing is not available
  — a NOT NULL column losing an enum value, a row whose deletion would break an
  invariant — the migration may map onto a value the surviving vocabulary
  already names, and the header says why. That is not a backfill: nothing is
  being preserved that a reset would not recreate. This stops being true at the
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
| Migrations | 20 — re-measured since the stamp above, at `S118` |
| Tables | 41, of which **5 have no reference anywhere in `src/` or `scripts/`**: `delete_requests`, `product_specifications`, `duplicate_flags`, `non_duplicates`, `attachments`. `accounts` is referenced and stays — the adapter's TYPE requires it |
| Code | `src/lib` 14,612 · `src/app` 14,480 · `src/db` 1,935 · `src/components` 1,691 · `scripts` 16,132 |
| Largest under `src` | `quotations.ts` 1,956 · `schema.ts` 1,869 · `follow-ups.ts` 1,527 · `authz.ts` 1,527 · `notifications.ts` 934 |
| Largest under `scripts` | `verify-routes.ts` 2,488 · `verify-schema25.ts` 1,732 · `verify-slice3.ts` 1,679 · `verify-phase9.ts` 1,558 · `verify-phase10a.ts` 1,447 |
| Open markers | 16 `[CHANGE]`, 37 `[BUILD]` — **53 open**, re-measured at `S118`. The 17 was drift; `npm run status` is the reading, never a grep. See §9 for what a rise means |
| Blocking | the Docker build |
| **`D65`'s day count is not built — *approved · issued · refused*, below the two columns.** The dashboard slice built `D65`'s heading and both queues and stopped there: the count is a fourth query over the coordinator's decisions today, and no other part of the slice needed it. It is the only part of a **built** block still missing, which is why it is a row here rather than a silent gap — `D64` now says three of six blocks are built, and this is the asterisk on one of them | `src/app/[locale]/(app)/_components/requests-block.tsx`, `DESIGN.md` `D65` | Open — small, and it wants the founder to say what *her day* means: the calendar day in Riyadh, or since she last cleared the queue |
| **`chain.ts` and `follow-ups.ts` disagree about who owes a returned-for-edit quotation, and `D65`'s first column follows the chain.** A version that is `requested` sits at chain position `requested`, which `chainOwner` says the **coordinator** owes; but `quotationReturned` chases the **rep** on the same version until they touch the lines, because there is no resubmit act in FACET and the status never moves. Measured on `seed:demo`: **11 of the 42** threads in her issuing column have been returned at least once, so it is not a corner. The dashboard slice followed `chain.ts` deliberately — `D27` makes it the only ladder and a second one inside `quotations.ts` is exactly the trap that module exists to prevent — and the founder approved that reading rather than lifting `quotationReturned`'s audit-log predicate out. **The real fix is a resubmit act**, which would move the version's status and let both readings agree; until then one version can legitimately appear on her queue and in his digest at once | `src/lib/quotations.ts` `awaitingIssue`, `src/lib/follow-ups.ts` `quotationReturned`, `src/lib/chain.ts` | Open — needs a rule. `S86`'s three states cannot both be true of one record, so `SPEC.md` has to say which |
| **A planned row speaks in the second person to whoever can see it, and the person who set the date may be someone else.** `next_follow_up_at` is one column per record and `canViewRecord` admits `can_approve_quotation` on a thread `[16 §10]`, so a date a rep set appears on the coordinator's own planned section reading *"You planned to come back to this on …"* — and it is 2 of her 2 planned rows on `seed:demo`. **Pre-existing, not a regression**: the tile it replaced said *"Your date has come"*, which is the same second person; `D34`'s row wording only makes it a sentence. The record's own panel already reads back who set it — `nextFollowUpContext` exists for exactly this — so the fact is derived and merely not on the row | `src/app/[locale]/(app)/_components/waiting-list.tsx`, `src/lib/follow-ups.ts` `nextFollowUpSetBy` | Open — small, and it costs one query per planned row unless the setter is decorated in `gather`. `D34` says the planned section holds *the dates the rep set himself*, so the rule already implies the answer |
| ~~**`verify:routes` §15 asserted participants on whatever project sorted first, so any other verify script's residue turned it red.**~~ **Fixed in the dashboard slice.** `S50` allows a project with no live company link; `verify:slice3` and `verify:phase10a` each leave several behind, and `/projects` is newest-first — so running either before `verify:routes` put an orphan at the top and *"the participants render for the coordinator"* failed on a screen that was correct. **Measured: 11 such projects from one afternoon's runs.** Found while verifying the dashboard slice, which touches no writer of `projects`. The check now picks its subject from the **manager's** view — choosing it from the coordinator's would presuppose what it asserts — and compares the two COUNTS, which is the biconditional `S76` actually makes: she reads every project *in full*. It notes and skips where none of the first eight carries a participant | `scripts/verify-routes.ts` §15 | Done — and it is the same family as §17's row above: a walk that assumes a shared database's shape rather than asserting it |

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
