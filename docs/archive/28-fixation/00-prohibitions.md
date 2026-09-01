# THE FIXATION — Phase 0: every prohibition, and what enforces it

Session 50, 1 Sep 2026. The founder's brief, verbatim mechanism: *"a rule is a
sentence and a sentence is a hope."* Anthropic's guidance: a real guardrail is
deterministic — hooks and permissions — because a prompted rule fails under
pressure, long sessions, ambiguity or injection. The memory store ran for
twenty sessions against a written prohibition; a hook would have caught it on
day one.

Every "never" / "must not" / "forbidden" across the five authority files, each
with one of three verdicts:

- **HOOK** — enforced by a PreToolUse hook in `.claude/hooks/`, deterministic.
- **PERMISSION** — enforced by `permissions` in `.claude/settings.json`.
- **PROSE** — stays a sentence. Marked so on the rule itself in Phase 4, so
  nobody believes it is enforced when it is not.

One clarification taken before anything else, because it decides whether this
phase is legal at all: CLAUDE.md and WORKFLOW §7 ban "agent frameworks, swarms,
hooks or auto-generated documentation". The banned "hooks" were **claude-flow's
hook system** — the third-party coordination framework installed twice and
removed twice, whose memory store is the failure this whole phase answers.
Claude Code's **native** hooks are the platform's own enforcement mechanism,
exactly as its native subagents are already sanctioned by the same rule's own
clarifying bullet. The founder's brief for this session quotes Anthropic's
guidance and orders hooks written. The Phase 4 rewrite states this distinction
in the rule's own text.

## The enumeration

### Enforced by HOOK (deterministic, `.claude/hooks/`)

| # | Prohibition | Source | Hook behaviour |
|---|---|---|---|
| H1 | **Guidance written outside the repository** — the memory-store failure. No Write/Edit outside the repo (scratchpad and OS temp excepted). Catches `~/.claude/projects/**/memory/`, user-level settings, any out-of-tree file | CLAUDE.md § Working style; WORKFLOW §5 S45-2 | `guard-writes` denies any Write/Edit/NotebookEdit whose path is outside the repo, the session scratchpad, or the OS temp dir |
| H2 | **A new document** — "New decisions go into SPEC.md or DESIGN.md. Never a new document. The 27 in docs/archive/ exist because that rule did not" | WORKFLOW §7 | `guard-writes` denies creating a NEW `.md` file in the repo outside the sanctioned set: the five authority files, `docs/archive/**`, `docs/design/**`, `.claude/**`, `AGENTS.md`, `node_modules`. Editing an existing file is never blocked by this check |
| H3 | **Physical Tailwind utilities** — `ml-* mr-* pl-* pr-* text-left text-right left-* right-* border-l border-r` — "the convention that rots fastest if unenforced" | CLAUDE.md § Conventions; S113; D57; README | `guard-writes` denies an Edit/Write to `src/**/*.{ts,tsx}` whose added text introduces a physical utility class token |
| H4 | **A logical margin on an element that itself carries `dir`** — `ms-*`/`me-*` beside `dir=` on one element; four sightings, three different utilities | CLAUDE.md § Conventions | `guard-writes` denies when added text contains a tag carrying both `dir=` and `ms-`/`me-` classes, either attribute order |
| H5 | **Raw Next navigation imports** — `Link`, `redirect`, `usePathname`, `useRouter` from `next/link` / `next/navigation` drop the locale prefix, silently | README § Bilingual; facet-ui | `guard-writes` denies an import of `next/link`, or of those four names from `next/navigation`, in `src/**` outside `src/i18n/`. A `notFound`-only import from `next/navigation` passes |
| H6 | **`current_date` in application SQL** — the server's UTC day, one behind Riyadh until 03:00; three verify scripts red on a small-hours run | CLAUDE.md § Conventions (S46-1) | `guard-writes` denies added `current_date` in `src/**` |
| H7 | **`AT TIME ZONE` on a bare date** — `::date at time zone` lifts then STRIPS the zone; the Riyadh month started six hours late | CLAUDE.md § Conventions (S46-1) | `guard-writes` denies added `::date at time zone` in `src/**` |
| H8 | **Database RLS** — "One authorization layer, in application code... Not database policies"; "No database RLS" | CLAUDE.md § Design principles, § Stack; S109 | `guard-writes` denies `CREATE POLICY` / `ENABLE ROW LEVEL SECURITY` added under `drizzle/**` or `src/db/**` |
| H9 | **Publishing a container port beyond loopback** — "Never publish it as 5432:5432"; the app is loopback-bound since 0b815db, and re-publishing skips Cloudflare Access | README § Deployment | `guard-writes` denies a `docker-compose.yml` edit adding a two-part port mapping (`"N:N"`) not prefixed `127.0.0.1:` |
| H10 | **A commit message that cites no rule** — "Cite rules by number in every plan, comment and commit message." One Phase 2 commit broke it; the gap is recorded in §5 as unfixable after the fact | CLAUDE.md § Authority | `guard-bash` denies `git commit` whose message carries no citation-shaped token (`S\d`, `D\d`, `§`, `A2-`, `AD\d`, `CLAUDE.md`, `SPEC`, `DESIGN`, `WORKFLOW`, `README`) |
| H11 | **Coordination frameworks by name** — claude-flow, installed twice, removed twice | CLAUDE.md § Working style; WORKFLOW §7 | `guard-bash` denies any Bash command invoking or installing `claude-flow` (and `ruv-swarm`, its sibling) |

### Enforced by PERMISSION (`.claude/settings.json`)

| # | Prohibition | Source | Permission |
|---|---|---|---|
| P1 | **No Supabase** | CLAUDE.md § Stack | `deny: mcp__claude_ai_Supabase__*` |
| P2 | **No Vercel** | CLAUDE.md § Stack | `deny: mcp__claude_ai_Vercel__*` |
| P3 | **`.env` is never read by a session** | Existing; S44-U4 relies on it | `deny: Read(./.env)`, `Read(./.env.*)` — already present, kept |
| P4 | **legacy/ is not read or modified unless asked** — it holds real colleague names | CLAUDE.md § Authority; WORKFLOW §8 | `ask: Read(./legacy/**)`, `Edit(./legacy/**)` — ask, not deny, because the rule says "unless asked" and the founder answering the prompt IS the asking |
| P5 | **A dependency is asked for first** — "The answer is usually no" | CLAUDE.md § Working style | `ask: Bash(npm install *)`, `Bash(npm i *)`, `Bash(npm uninstall *)` — bare `npm install` (restore) stays allowed |
| P6 | **`db:push` never against a real database** — "local scratch only" | README § Database | `ask: Bash(npm run db:push*)` |
| P7 | **The memory store's writer** | S45-2 | `autoMemoryEnabled: false` — already present, kept |

### PROSE — a sentence, and said to be one

Each of these stays prose because no deterministic test exists for it. In
Phase 4 the rule carries the marker **(prose — not machine-enforced)** where
believing otherwise would be dangerous.

| # | Prohibition | Source | Why no hook |
|---|---|---|---|
| N1 | Never invent business logic | CLAUDE.md | Judgment — no string pattern distinguishes invention from implementation |
| N2 | Never add a table/column/entity no rule requires | CLAUDE.md | Judgment. The schema diff is reviewable, not machine-checkable against intent |
| N3 | Never mark something decided unless in SPEC/DESIGN | CLAUDE.md | Judgment over prose meaning |
| N4 | Do not reopen settled rules | CLAUDE.md | Judgment |
| N5 | Never land a column/flag/table without its writer in the same slice | CLAUDE.md | Requires knowing what "the writer" is — semantic |
| N6 | When a rule replaces a mechanism, the old one comes out in the same slice | CLAUDE.md; WORKFLOW §7 | Semantic |
| N7 | Every user-facing string through the translation layer | CLAUDE.md; S113 | Partially machine-checked already: `check:messages` (key parity) and `verify:routes` §12 (no raw `ns.key` on screen) catch the two failure shapes. Hardcoded English that never becomes a key is caught by neither — that residue is prose |
| N8 | Derived conditions resolved in SQL before pagination | CLAUDE.md | Semantic — a `.filter()` after a fetch is sometimes legitimate (client-side narrowing of a complete set) |
| N9 | Drizzle correlated-subquery qualifiers; `sql<T>` is an assertion; untyped params | CLAUDE.md | Pattern too varied; moved to a path-scoped rule on `src/lib/**` so it loads exactly when writing data-layer SQL |
| N10 | Square metres always generated, never typed | CLAUDE.md; S55 | Already enforced where it matters: generated columns in the schema |
| N11 | Accounts deactivate, never delete | CLAUDE.md; S111 | Enforced by the data layer's own shape; no `deleteUser` exists |
| N12 | Targets, shares, splits are dated rows | CLAUDE.md; S110 | Schema shape |
| N13 | The audit log is written by the data layer | CLAUDE.md; S112 | Semantic; `verify` scripts assert it per-slice |
| N14 | SMAC owns money; no finance features | CLAUDE.md; S3 | Judgment |
| N15 | A Tailwind class that compiles to nothing fails no check — read the emitted CSS | CLAUDE.md | It is an instruction to look, not a boundary |
| N16 | `docs/archive/` never read as part of a build task | CLAUDE.md | `.claudeignore` is not honored by Claude Code (checked against current docs in this session); a deny would also block the sanctioned "why" lookups. Prose, stated unenforced |
| N17 | Never `next dev` under `verify:routes`; build server only | CLAUDE.md § Verification | `verify:routes` §0 already refuses a server older than its build — the check IS the enforcement |
| N18 | No test harness — verify scripts instead; feed every new check its defect | CLAUDE.md § Verification | Process discipline; moves to the facet-verify skill where it loads at writing time |
| N19 | Plan mode first, one task per session, commit each slice | CLAUDE.md § Working style | Process |
| N20 | Never lower the model mid-slice | WORKFLOW §3b | Outside any hook's sight |
| N21 | A migration never preserves data (until the pilot) | WORKFLOW §7 | `UPDATE`/`INSERT..SELECT` are sometimes the sanctioned enum-mapping shape; not deterministic. Moves to a path-scoped rule on `drizzle/**` |
| N22 | D-rule design bans (violet, toasts, drag, inline edit, nested cards, status→colour…) | DESIGN.md D6 D7 D21 D58; S134 | Visual semantics; `verify:routes` holds the testable halves (e.g. §23 operability, §39 bidi) |
| N23 | Never type a hex into a component | facet-ui | Data-URI and token-definition false positives; path-scoped rule on `src/components/**` + `src/app/**` |
| N24 | A subagent reports what it FOUND, never what it concluded; never split the reading | CLAUDE.md | Process |
| N25 | Auth bridge: re-run `verify:routes` §30 after upgrading next-auth/@auth/core/adapter/next | CLAUDE.md | Not blockable (upgrades are legitimate); becomes a path-scoped rule on `package.json` so the warning loads exactly when the file is touched |
| N26 | `db:reset`, `seed:demo`, `dev:fixtures` refuse outside development | README | Already enforced in the scripts themselves (NODE_ENV guard + confirmation) |
| N27 | Backups: dumps are as sensitive as the database; no script prints POSTGRES_PASSWORD | README | Enforced by the scripts' own shape; reviewed, not hooked |

## What the memory store proves about this table

S45-2's store was H1's class: writes outside the repo that load into every
session. Under this table it is caught at the first write, denied with a
message naming the rule. That is the difference between the two columns above:
a HOOK row fails closed; a PROSE row fails the way the store did — twenty
sessions later, by a search.

## Decisions taken here, technical, one line each

- One writes-guard script and one bash-guard script, not eleven hooks: each
  check is a few lines, and eleven separate processes per edit would be the
  orchestration CLAUDE.md refuses.
- Node (`.mjs`), not PowerShell: hook stdin is JSON; Node parses it without a
  dependency and behaves identically on the office PC.
- Deny messages name the rule and the file so a blocked session can cite why.
- The scratchpad and OS temp are allowlisted in H1 or every session's own
  working files would be blocked.
- Hook scripts are proven by feeding them their defect over stdin (Phase 6),
  the same discipline every verify section owes.

## The first live block was the hook catching its own author

H11's first draft matched the framework's NAME anywhere in a Bash command, and
the first thing it blocked was this session's own Phase 0 commit — whose
message *mentions* the framework while explaining the ban. The guard was
rewritten to match command and install position only: `npx <name>`,
`npm install <name>`, `<name>` opening a command segment. A mention inside a
quoted message passes. Two lessons, both already in CLAUDE.md's vocabulary: a
check is proven by being fed its defect AND its legitimate case, and the first
wrong red arrived within minutes of the first hook existing — enforcement
needs the same wrong-red discipline the verify suite learned over fifteen
sightings. All 45 stdin cases green after the fix, both guards proven against
the live harness (a root NOTES.md write and an uncited commit, both denied
mid-session with no restart).
