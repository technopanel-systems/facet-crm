# FACET — Project Rules

Read this at the start of every session. It is an INDEX: the judgment rules
live here; everything path-shaped loads itself when you touch the matching
files, and everything procedural is a skill. New to the project? README.md is
the entry document — what FACET is, how the business works, how sessions run.

## What FACET is

An internal operations platform for **Technopanel**, a Saudi supplier of
cladding / aluminium composite panel. Sales CRM now; production, warehouse
and marketing later — FACET grows sideways into departments, **never down
into finance**. Money lives in **SMAC**, the existing ERP; FACET mirrors
references typed by humans and assumes they can be wrong.

## Authority

Two files decide. Nothing else is authoritative.

1. **`SPEC.md`** — what the system does. Rules `S1`…, business truth.
2. **`DESIGN.md`** — how it looks and behaves. Rules `D1`…

Where they conflict, **SPEC wins** — design may never change behaviour,
visibility, or what a record may contain.

**Cite rules by number** in every plan, comment and commit message (a commit
without a citation is hook-blocked). A statement that cannot cite a rule is
not a requirement. **Rule numbers are a public API** — 194 of the 210 are
cited in code — so a number is never reused or reshuffled; a deleted rule
keeps its number as a tombstone (`D18`'s precedent).

`docs/archive/` is history — how decisions were reached — never authority
and never read as part of a build task (prose rule, not machine-enforced).
`docs/design/facet-concept-v5-premium.html` is the visual target, not
authority. `legacy/` is the failed v1 (permission-gated; touch only when
asked).

## The layers — where a rule lives decides when it loads

| Layer | Loads | Holds |
|---|---|---|
| This file | always | judgment rules only |
| `SPEC.md` / `DESIGN.md` | when consulted | every numbered requirement |
| `.claude/rules/*.md` | when a matching path is touched | the traps of that terrain (UI, data layer, migrations, verify, auth bridge, deploy) |
| `.claude/skills/` | when invoked | procedures: `facet-ui`, `facet-verify`, `facet-audit`, `facet-register` |
| `.claude/agents/` | when spawned | `classifier`, `conformance-sweeper`, `shot-looker` |
| `.claude/hooks/` + permissions | every tool call, deterministic | the prohibitions that used to be prose |
| `WORKFLOW.md` | when planning | the session plan (§4), the open register (§5), audits (§6, §6b) |

**Enforcement is deterministic where it can be** (hooks H1–H11, permissions
P1–P7 — the full map is `docs/archive/28-fixation/00-prohibitions.md`) **and
honest where it cannot**: a rule below marked *(prose)* is a sentence, and a
sentence is a hope — it held the memory store for zero of twenty sessions.

## Hard rules (prose — judgment, no hook can hold them)

- **Never invent business logic.** If a rule is not in `SPEC.md`, stop and
  ask. Guessing produced v1's dead approval gate.
- **Never add a table, column or entity no rule requires.** List it as
  `PROPOSED — not required by any rule` instead.
- **Never mark something as decided unless it is written in SPEC or
  DESIGN.** Where undecided, write `OPEN — not chosen`.
- **Do not reopen settled rules.** Say it once, one paragraph, move on. If
  a rule has been argued past twice, that is `WORKFLOW §6b`'s trigger — the
  rule gets REVIEWED, not ignored. The founder's standing instruction:
  *"Don't preserve a rule just because it's written down"* — flag it, ask.

## Simplicity (prose)

- The smallest implementation that satisfies the rule wins.
- Every plan states what it is NOT building, and why that is enough. A plan
  over 800 words is two plans.
- Delete before adding; no machinery for a case the founder called rare.
- **Unused structure is a lie about what the system does.** Never land a
  column, flag or table without its writer in the same slice; when a rule
  replaces a mechanism, the old one comes out in the same slice.

## Conventions — the always-on two

- **Every user-facing string goes through the translation layer** (EN + AR)
  and **layout uses logical utilities only** — physical utilities and
  `ms-*`/`me-*`-beside-`dir` are hook-blocked; the why lives in
  `.claude/rules/ui.md`.
- **Derive from real events; never ask a human for what the system can
  know** (`S108`). Derived conditions resolve in SQL before pagination —
  the data-layer traps (Drizzle, the Riyadh clock, one-ladder) load from
  `.claude/rules/data.md` when you touch `src/lib`.

## Verification

There is **no test harness.** Gates: `npm run typecheck` · `lint` ·
`build` · `check:messages`, then the ten kept verify scripts. **`build` is
not optional.** A slice is not done until its screens are driven **over
HTTP, in both locales** (`verify:routes` against a built server). The whole
check-writing discipline — the wrong-red ledger, feed-every-check-its-defect,
delta accounting — is the **facet-verify** skill: load it before touching
any check, and before believing one.

## Working style

- **Plan mode first for anything structural.** Plans are reviewed outside
  the session before approval. One task per session; small diffs; commit
  after every working slice (and push).
- Ask before adding a dependency (permission-gated). The answer is usually
  no.
- **No third-party agent frameworks or swarm tooling** — claude-flow is
  hook-blocked by name; it was installed twice, removed twice, and its
  memory store loaded into twenty sessions unaudited. Claude Code's OWN
  subagents and hooks are sanctioned and in use. Guidance lives in `git` or
  it does not exist: writes outside the repo are hook-blocked, and a
  session that records something **names the file it wrote to**.
- **Split mechanical work; never split the reading.** Grep classification,
  conformance sweeps, shot capture go to the project subagents on cheaper
  models. Judgment and anything needing a WIDE read stay with the session's
  own model — every real defect here came from one reader noticing a
  contradiction. **A subagent reports what it FOUND, never what it
  concluded.** Do not orchestrate a small slice.

## Stack

Next.js + TypeScript · PostgreSQL · Drizzle · Auth.js · Tailwind +
shadcn/ui · next-intl (EN/AR, RTL) · Docker on a company Windows PC ·
Cloudflare Tunnel + Access · Synology for backups.

No Supabase. No Vercel. No database RLS. (All three deny-enforced.)
