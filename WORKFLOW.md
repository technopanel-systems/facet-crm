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
`SPEC.md` and `DESIGN.md` honest. **It does not have access to the repository** —
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
9. **Paste the status block (§7) into this chat.**

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
| 5 | Quotation project optional; project chosen at dispatch and written back; company added as participant | `S50` `S74` |
| 6 | VAT fixed at 15%; validity becomes a note, not a gate; readable product fields | `S53` `S57` `S67` |
| 7 | Report splits into shared half and private note; same-day edit only; author keeps their own | `S38` `S39` `S40` |
| 8 | Coordinator sees projects and contacts | `S76` |
| 9 | Drop dead structure — `accounts`, `verificationTokens`, both snapshot tables, `project_companies.role` | `SPEC §15` |

> **AUDIT 1 — the model.** See §5.

### Phase 2 — The rebuild

| # | Session | Rules |
|---|---|---|
| 10 | The shell — seven-item rail, tokens, layout cap, theme, permission boolean | `D5`–`D23` `D46` `D47` |
| 11 | **The waiting list, rep scope** — and the notification tiers, persistence flags, per-anchor resolution and digest machinery come out in the same slice | `S86`–`S95` `D29`–`D34` |
| 12 | The waiting list, manager scope, and "Needs a decision" | `D35`–`D38` |
| 13 | Grouped lists with per-object lead cells — companies, projects, quotations | `D22`–`D24` |
| 14 | The stream — replaces `/reports` and `/activity`; comments narrowed to threads and projects | `S114` `D42`–`D45` |

> **AUDIT 2 — the interface.** See §5.

### Phase 3 — Trust

Nothing below is optional before real users touch it.

| # | Session | Rules |
|---|---|---|
| 15 | Signals and loss reasons unified; loss cascades down | `S43`–`S49` |
| 16 | Duplicate detection and manager resolution | `S21`–`S23` |
| 17 | Credit terms — rep requests, manager approves | `S70` `S73` |
| 18 | Archive requests folded into the dormancy review | `S105`–`S107` |
| 19 | Sharing per project; contacts shareable | `S97` `S98` |
| 20 | **Bulk import** — nobody hand-types the customer base | `SPEC §15` |

### Phase 4 — Complete the picture

| # | Session | Rules |
|---|---|---|
| 21 | The board view for projects | `D25` `D26` |
| 22 | The monthly rollup | `D39`–`D41` |
| 23 | Password reset; holiday calendar; thresholds into `settings`; the three dead flags made live | `S8` `S11` `S94` |
| 24 | Phone pass — rep screens at 375px | `D52` `D53` |
| 25 | RTL pass — every screen, both locales | `D54` |

> **AUDIT 3 — pre-pilot.** See §5.

### Phase 5 — Pilot

Two or three reps. One month. Real companies, real quotations, real dispatches.
Everything after this is decided by what they say, not by this plan.

---

## 5. The three audits

An audit is its own session, produces a findings list, and **changes nothing**.
Fixes are separate sessions afterwards.

**AUDIT 1 — the model.** Does the database say what `SPEC.md` says? Every table
and column against `S12`–`S85`. No column without a writer. No flag without a
reader. All verify scripts green. And: do the `[CHANGE]` markers for phase 1
now read as plain rules?

**AUDIT 2 — the interface.** Every screen against `DESIGN.md`, in both themes
and both locales, at 1366px. The `D21` checklist run by eye on each. Does any
screen still not answer `D3`'s question in five seconds? Is the waiting-list
predicate resolved in SQL before pagination — check the query, do not trust the
screen.

**AUDIT 3 — pre-pilot.** The full route walk with realistic data volumes. A
real phone in a real hand. Restore the backup onto a second machine and confirm
it comes up. Deactivate a user and confirm their session dies. Then the five
questions from `D3`, `D25` and `D31`, asked of a rep who has never seen it.

---

## 6. Rules that keep this from going wrong again

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

---

## 7. Repository access at milestones

The repo is **private**. `legacy/` contains real colleague names and email
addresses, so it stays that way.

At each audit point, Jerom flips it public for the duration of the review, and
back to private afterwards. Claude clones it, reads the whole tree, and reports.
This has been done once already and works cleanly. Between audits, the status
block below is enough.

---

## 7. The status block

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
(Select-String -Path SPEC.md -Pattern "\[CHANGE\]").Count
(Select-String -Path SPEC.md -Pattern "\[BUILD\]").Count
```

The last two numbers are the real progress bar. They start at **26 `[CHANGE]`
and 24 `[BUILD]` — 50 open** and should only ever go down. If they rise,
something was decided outside the spec.

Better still, add the script to the repo once (see §9) and run `npm run status`.

---

## 8. Current state, verified from the repository

Checked directly against `main` at commit `12689b4`.

| | |
|---|---|
| Branch | `main`, up to date, feature branch merged |
| Authority files | `CLAUDE.md` 142 lines · `SPEC.md` 544 · `DESIGN.md` 395, all at root |
| Docs | 27 in `docs/archive/`; `docs/design/` holds v5 only |
| Skills | `facet-ui`, `facet-verify` — nothing else |
| claude-flow | fully removed, no remnants in the tree |
| Routes | 38 |
| Tables | 43, of which **8 have no reference anywhere**: `verificationTokens`, `deleteRequests`, `productSpecifications`, `duplicateFlags`, `nonDuplicates`, `pipelineSnapshots`, `personSnapshots`, `attachments` |
| Code | `src/lib` 13,966 · `src/app` 14,272 · `src/components` 1,619 · `scripts` 13,120 |
| Largest files | `quotations.ts` 1,965 · `schema.ts` 1,857 · `follow-ups.ts` 1,497 · `authz.ts` 1,318 · `notifications.ts` 1,011 |
| Open markers | 26 `[CHANGE]`, 24 `[BUILD]` |
| Blocking | the Docker build |

**Session 11 is larger than it looks.** It deletes `follow-ups.ts` (1,497) and
`notifications.ts` (1,011), and with them `verify-phase10a.ts` (1,431) and
`verify-followups.ts` (1,087) — roughly **5,000 lines**, against a much smaller
waiting list. Expect that, or it will look like something went wrong.

**Session 1 head start.** Three causes of the Docker build failure are already
ruled out and must not be re-investigated:

- every page under `src/app` has `export const dynamic = "force-dynamic"`
- `src/db/index.ts` exports `db` as a lazy Proxy — importing opens no connection
- `src/env.ts` uses getters, so `env.DATABASE_URL` only throws when read

The relevant difference is that `.dockerignore` excludes `.env*`, so there is no
`DATABASE_URL` during the container build. Something in the `/follow-ups` import
chain reaches it at module load anyway.

---

## 9. Repository housekeeping

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

**4. Add a status script** so §7 is one command. Save as `scripts/status.ps1`:

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
"CHANGE: " + (Select-String -Path SPEC.md -Pattern "\[CHANGE\]").Count
"BUILD:  " + (Select-String -Path SPEC.md -Pattern "\[BUILD\]").Count
```

Then in `package.json` scripts:

```json
"status": "powershell -NoProfile -File scripts/status.ps1"
```

`npm run status` at the end of every session. Paste the output into chat.
