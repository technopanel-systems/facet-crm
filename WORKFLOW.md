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
| Search filters `ilike` a raw name, so the same Arabic name is findable on one screen and not another. **Corrected by AUDIT 1: three of six, not five.** `companies.ts`, `projects.ts:134` and `contacts.ts:77` all normalise | `quotations.ts:261`, `dispatches.ts:372`, `reports.ts:527` | Own session after the model phase |
| ~28 sites need `dir="auto"` per D62 | list cells, option labels, panels — inventory in session 3a's report | Sweep session with the `SelectField` item below |
| Eight `SelectField`s should carry `required`; each validates server-side, so the placeholder costs a round trip, not correctness | user, contact, report and quotation-line forms | Same sweep session |
| Participant add/remove forms never answer a no-JS POST — `Failed to parse body as FormData`; the write lands, the response does not. Bisected to pre-existing | `projects/[id]/project-links.tsx` | Own session |
| `confirmPaymentAction` never answers a raw form POST. Same shape, different action | `quotations/[id]` | Same session as the above — likely one cause |
| **A LEAD for the two rows above, found in session 13 and not acted on.** Both build the action **inline inside `useActionState`** — `useActionState(confirmPaymentAction.bind(null, threadId), …)` — so the hook receives a new function identity on every render. `S72`'s refuse form reproduced the hang exactly in that shape, including on the **empty-reason path that writes nothing**, which **disproves** the standing "the panel is unmounted by its own success" explanation. Moving the `.bind()` out to the call site and passing the action in as a prop — what `PlainButton` and `CommentComposer` already do, and both answer fine — made both its paths answer in milliseconds. On the same dispatch page the comment composer answered while the refuse form hung, so the cause is the component, not the route | `quotations/[id]/thread-actions.tsx:113-128`, `projects/[id]/project-links.tsx:90-93` | Their own session. One line each, and it should be measured rather than assumed |
| `follow-ups.ts` filters in memory after the fetch. **Corrected by AUDIT 1: it is the whole function, not one line.** `followUps()` fetches every row with no SQL limit, then applies four in-memory filters, a sort and `.slice()` for pagination | `src/lib/follow-ups.ts:1151-1224` | None — file is deleted in session 24 |
| `listQuotationFormOptions` returns every visible company into one `<select>`. Fine at ~90 | `src/lib/quotations.ts` | Revisit after bulk import |
| `listDispatchableThreads` is unpaginated, and since `S116` each offered thread also carries its issued version's lines so the form can pre-fill them. About 320 bytes per line — a twenty-line quotation is ~6 KB, fifty threads averaging three lines ~48 KB on `/dispatches/new`. **`S72` widened it**: the payment filter moved to the approval, so the list is now every issued thread the viewer can see rather than every paid one, and every rep loads it rather than one coordinator. The cost is the missing pagination, not the lines | `src/lib/dispatches.ts` | With the row above — same question, same answer |
| Comments render on companies, contacts and dispatches. `S114` and `D48` allow quotation threads and projects only; the `comments_record_type` CHECK admits five kinds, the company screen imports `CommentBox`, and `verify:routes` §9 asserts the wider behaviour | `src/db/schema.ts`, `companies/[id]/page.tsx`, `scripts/verify-routes.ts` §9 | Session 27, which narrows comments — it deletes that walk |
| ~~`quotation_threads.closed_at` and `closed_by_user_id` have no writer and no reader outside the schema~~ **Classified by the `0027` sweep and KEPT.** Still 0 of 636, and still unwritten — but `S47` names them in its own words: *losing a project closes every open quotation under it; they inherit the project's reason and are marked as **closed by the project***. That is their writer, and it is `[BUILD]`, not absent. So this is `has_credit_terms`'s pattern in the other direction: landed eleven migrations early, but by a rule that still wants it. The `quotation_threads_closed` CHECK stays with them, and it is `AUDIT 1 F18` entire — the only CHECK in the schema on columns nothing writes. `verify:schema25` §2 now asserts all three present, with `S47` named, so a later sweep cannot take them for being empty | `src/db/schema.ts` | `S47`'s slice, which builds the writer. **Not** a drop — the sweep looked and left them |
| `companies.merged_into_id` has readers (isNull filters) but no writer. **Corrected by AUDIT 1: four modules, not five** — `coverage.ts`, `dispatches.ts`, `dormancy.ts`, `follow-ups.ts`. 0 of 809 companies carry one. **Classified by the `0027` sweep and KEPT**: `S21`–`S23` build duplicate resolution, and four modules already read it, so it is the least dead thing the sweep looked at. `companies_merged_into_idx` stays with it; both are asserted present in `verify:schema25` §2 | `src/db/schema.ts` | Session 29, which builds duplicate merge |
| ~~**12 of 66 quotation versions carry no product lines at all, 6 of them issued.**~~ **Closed in the `S60` session** — 13 by the time it was measured, 7 of them frozen past `requested`. **Not reachable through today's code**, which was the guess in this row and was wrong: `createQuotationThread` already refused a version with none and `removeQuotationLine` already refused the last one, neither citing `S60`. Every violating row came from `verify-phase9` and `verify-phase10a` inserting `quotation_versions` directly; both now go through `scripts/quotation-fixture.ts`. `issueVersion` gained the third guard, `verify:schema25` §18 asserts it over every row | `src/lib/quotations.ts`, `S60` | Done. The remaining question is not `S60`'s: **nothing tells a rep why an issued quotation prefills no lines**, which is `S116`'s screen, not this rule |
| ~~`quotation_lines.form_factor` is always written `'sheet'`; the enum's `coil` value is set nowhere~~ **Dropped in the `0027` sweep**, 850 of 850 `sheet` by then. The column and the `form_factor` type went together — it was the type's only column, so a plain `DROP TYPE` rather than the rebuild `record_type` needed. `12 §11`'s scope boundary survives as the rule it always was; it never needed a column to state it, and `dispatch_lines` had already refused to copy one `S116` | `src/db/schema.ts` | Done |
| `report_signal` has nine values. **Corrected by AUDIT 1: `S43` lists eleven, not ten, and two are missing, not one** — *stock shortage* and *customer went quiet*. `loss_reasons` also seeds nine and is missing a different two — *quality concern* and *payment terms* — so the two lists are complementary halves whose union is exactly `S43`'s eleven. Seven shared concepts carry different tokens (`competitor_cheaper`/`lost_to_competitor`, `lead_time_too_long`/`delivery_time_too_long`, `specification_unavailable`/`specification_not_offered`, `project_delayed`/`project_cancelled_or_postponed`, `colour_unavailable`/`colour_or_product_unavailable`), so unifying is not a union. Only two values are in use in 30 signal rows, so the data migration is small | `src/lib/enums.ts`, `src/db/schema.ts`, `scripts/seed/loss-reasons.ts` | Session 28, which unifies the vocabulary |

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
| **Three markers name something already built, in whole or in part.** `S34` `[CHANGE]` — all five channels including `meeting` have existed since migration `0005` and the enum matches `S34` exactly; only the *definitions* of visit and meeting are new, and no label carries them. `S81` `[CHANGE]` — "divides equally" and "nobody types a percentage" are already true, and the open clause is open the other way round, because `divideEqually` *is* the remainder machinery `S81` says not to build. `S11` `[BUILD]` — password reset does not exist but deactivate/re-enable does; `S106` `[BUILD]` has the same shape, the review and its three outcomes existing while only the rep's way in is missing | `SPEC.md` | Each needs the founder to retire, narrow or restate the marker |
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
