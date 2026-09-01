# THE FIXATION — Phase 6: the proofs

Session 50, 1 Sep 2026. Everything below is measured on this machine in this
session, not asserted.

## Every hook fed its defect

**Script level:** 45 stdin cases across the eleven hook classes — every deny
red on the forbidden thing, every pass green on the allowed thing
(`test-hooks.mjs` + `test-bash-guard.mjs`, session scratchpad; the case
tables are readable in this file's git history via the Phase 0 commit).

**Live harness level:** the settings file-watcher activated both guards
mid-session with no restart, and each was fed a real defect through the real
tools: a root-level `FORBIDDEN-PROBE.md` Write **denied** by H2 with
WORKFLOW §7's message; an uncited `git commit` **denied** by H10 with
CLAUDE.md § Authority's message.

**The wrong-red arrived within minutes of the first hook existing** — H11's
first draft matched the banned framework's NAME anywhere in a command, and
the first thing it blocked was this session's own Phase 0 commit, whose
message mentions the framework while explaining the ban. Rewritten to
command/install position; a mention now passes, an invocation is denied.
Recorded in `00-prohibitions.md` — enforcement needs the same wrong-red
discipline as the verify suite.

## Permissions active

The deny of `mcp__claude_ai_Supabase__*` and `mcp__claude_ai_Vercel__*` took
effect the moment settings were written: **66 MCP tools vanished from the
running session** (the harness reported the disconnect). One invalid rule
was caught by the harness itself and fixed: `Write(./legacy/**)` is not a
matchable permission — `Edit(path)` rules cover all file-editing tools — so
the ask-list carries `Read` and `Edit` only.

## Path-scoped rules load on-path and NOT off-path

Fresh-session matrix (two `claude -p --model haiku` runs against this repo):

| Session read | Migration rules | UI rules | Auth-bridge rule |
|---|---|---|---|
| `drizzle/0001_auth.sql` | **LOADED** (quoted its first sentence verbatim) | not loaded | — |
| `package.json` | not loaded | — | **LOADED** |

One caveat, found by testing rather than assumed: **rules created
mid-session did not inject into the session that created them** (this
session read a drizzle file after writing the rules; nothing injected).
Hooks and permissions hot-reload; rules take effect from the next session.
Every session after this one gets them.

## Skills and agents

All four skills (`facet-ui`, `facet-verify`, `facet-audit`,
`facet-register`) registered in the live session's skill list as they were
written — the harness listed `facet-verify`'s new description and both new
skills without a restart. The three agents are definition files consumed at
spawn; their frontmatter follows the current schema (name, description,
model, tools).

## The plugin

`scripts/build-plugin.mjs` generates `facet-plugin/` from `.claude/` —
16 copied + 2 generated files. `--check` was **fed its defect**: a byte
appended to a mirrored file turned it red (exit 1, naming the file);
rebuilt, green. The injection also caught a real portability defect — git's
autocrlf made a restored file read as drift, so the comparison now
normalizes line endings; a fresh Windows clone cannot false-drift.

## The measurements

**Always-loaded context (CLAUDE.md):**

| | Before | After | Change |
|---|---|---|---|
| Lines | 332 | **125** | −62% |
| Bytes (exact) | 20,259 | **6,451** | **−68%** |
| Tokens (bytes ÷ 4, the one estimated conversion, labeled) | ≈5,100 | ≈1,600 | ≈−3,500 per session, every session |

**The consulted-on-demand files:**

| File | Before | After |
|---|---|---|
| WORKFLOW.md | 406,672 bytes | **217,023** (−47%; 124 closed rows moved verbatim to `docs/archive/29-closed-register.md`, 196,871 bytes, byte-accounted) |
| SPEC.md | 59,012 | 63,585 (+ two new rules, five founder rewrites, two tombstones) |
| DESIGN.md | 84,605 | 87,016 (+ D75, two rewrites, three tombstones) |
| README.md | 19,774 / 431 lines | 14,656 / 285 lines (the entry document) |

**The new conditional layers** (load only when relevant): six path rules
11,528 bytes total · facet-verify 8,449 · facet-audit 3,649 ·
facet-register 2,890 · three agents · two guard hooks.

## The product is untouched

`git diff 4bfe2bb..HEAD -- src/` is **empty** — zero source changes across
the whole session. `scripts/` gained exactly one file (`build-plugin.mjs`).
Nothing under `src/` moved, so no behaviour moved.

## The gates and the suite

- `typecheck` **clean** · `lint` **0 errors** (1 pre-existing warning in
  `scripts/audit2/probe-overflow.mjs`, untouched by this session) ·
  `check:messages` **914 keys, en and ar agree** · `build` **succeeds**.
- All nine in-process verify scripts: **All checks passed** (slice2, slice3,
  phase9, phase11, phase10a, followups, comments, sharing, schema25), each
  ending its own accounts per S111.
- `verify:routes`: **All 1,806 checks passed** — 1,556 fetches, 9,950 forms
  scanned scripts-off, both locales, against the built server on a freed
  port 3000 (the shadowing app container stopped first, per the new
  `verify.md` rule, and restarted after). §23's one note is the known open
  §5 row (`/quotations/new`'s disabled contact select), reported exactly as
  the register carries it.

## §10 re-taken

WORKFLOW §10 was re-measured line by line (35 migrations · 43 tables · 37
routes · 138 S / 75 D numbers · 10 `[CHANGE]` / 24 `[BUILD]`, the moves
accounted: +S137, S135→S138).
