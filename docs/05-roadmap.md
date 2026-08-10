# 05 — Roadmap

Phases, and which model and skills to use for each. Update the status column as
work completes.

---

## Phases

| # | Phase | Output | Status |
|---|---|---|---|
| 1 | Legacy audit | `docs/00-legacy-findings.md` | ✅ done |
| 2 | History extract | `docs/02-history-extract.md` | ✅ done |
| 2b | Founder answers | `docs/04-founder-answers.md` | ✅ done |
| 3 | **Business model** | `docs/01-business-model.md` | ← next |
| 4 | Close the OPEN list | update `04` and `01` | |
| 5 | Schema + migrations (core only) | `db/schema.ts`, migrations | |
| 6 | Auth + authorization layer | one permissions module | |
| 7 | Slice 1 — companies, contacts, projects | working screens | |
| 8 | Slice 2 — quotation chain | working screens | ✅ done |
| 8b | Slice 3 — dispatch, credit splits, targets | working screens | ✅ done |
| 9 | Activities and reporting | working screens | ✅ done |
| 10 | Follow-ups, duplicates, notifications | | |
| 11 | Team, roles, offboarding, bulk import | working screens | ✅ done bar **bulk import** |
| 12 | Dashboards, targets, performance | | |
| — | Later: production, warehouse, marketing, n8n/AI | | |

Phase 3 determines whether this succeeds. Everything after it is typing.

**Build order rule:** the shared core first (organizations, people, users,
roles, permissions, notifications, audit), then modules on top. Each slice ends
deployable. No horizontal "build all the models first".

**Production stays in Google Sheets for now.** It works and its rules were
validated by real use. Port it later, when it is a port and not a discovery.

---

## Models

| Work | Model |
|---|---|
| Architecture, business logic, schema design, hard debugging | **Opus** |
| Implementation — components, CRUD, tests, refactors | **Sonnet** |
| File operations, renames, commit messages | **Haiku** |
| Fable | only if Opus visibly stalls; burns allowance faster |

`/model opusplan` plans with Opus and executes with Sonnet — a good default.

Effort: default. Raising it mostly buys latency on this kind of work.

---

## Skills

**Existing, use as needed:**
- `frontend-design` — visual direction for Phase 7 onward
- `skill-creator` — to build the project skills below
- `xlsx` / `docx` — exports and reports, much later

**Project skills to create (in `.claude/skills/`):**

| Skill | Purpose | Create before |
|---|---|---|
| `facet-business-rules` | Points at `01-business-model.md`; the arbiter when code and intuition disagree | Phase 5 |
| `facet-db` | Naming conventions, migration workflow, seed rules | Phase 5 |
| `facet-ui` | Component and layout conventions so screens stay consistent | Phase 7 |
| `facet-module` | The recipe for adding a module end to end: schema → API → UI → permissions → test | Phase 8 |

Keep each skill short with a sharp description. A vague description means the
skill never triggers. `CLAUDE.md` is always loaded — skills load on demand,
which is where the token saving is.

---

## Session discipline

- One task per session; `/clear` between tasks
- Plan mode for anything structural — read the plan before approving
- Sub-agents for research-heavy reading, to keep the main context clean
- Never load `docs/00-legacy-findings.md` whole (it is ~48 KB); point at sections
- Commit after every working slice — reverting is cheaper than re-explaining

---

## The rule that keeps this working

**Anything decided in chat has to land in a file before it counts.**

Planning conversations are not a source Claude Code can read. A decision that
never reaches `docs/` does not exist as far as the build is concerned.
