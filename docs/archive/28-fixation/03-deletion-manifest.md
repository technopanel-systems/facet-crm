# THE FIXATION — Phase 4: the deletion manifest

Session 50, 1 Sep 2026. Every rule deleted, moved or rewritten, with the
reason and the authority. Without this the rebuild is a black box; with it,
the next founder-session can check every removal. Verbatim founder words are
in `02-founder-answers.md`.

## Deleted rules — five, every one by founder decision, every number kept as a tombstone

| Rule | Was | Deleted because | Authority |
|---|---|---|---|
| **S115** | File attachments, super-admin only | Not wanted; restricted nothing (no feature existed). The `attachments` table loses its keeper and is a sweep drop candidate | Founder, batch 4: unticked from "still wanted" |
| **S135** | Outcome marks (catalogue sent…) read from reports | Not wanted on cards; if the dashboard conversation shows the gap they return as a NEW rule | Founder, batch 4: unticked |
| **D35** | The dashboard week strip | Never built, never missed through four audits — *"don't carry them as unbuilt debt"* | Founder, batch 3: "Drop both" |
| **D36** | The Recently feed | Same words, same act; the stream `D45` already carries its three kinds | Founder, batch 3 |
| **D71** | The mark's visual shape (label, never column/colour) | Dies with `S135` — a design rule for a feature that no longer exists is a fossil (`§6b` question 1) | Founder, with S135 |

**No other numbered rule was deleted.** The census
(`28-fixation/census.json`) shows 124/136 S and 70/74 D rules cited in code —
the numbering is a public API, deletions keep their numbers (`D18`'s
precedent), and a business rule's deletion is the founder's act alone.

## Deleted prose — duplication and staleness, deleted on measurement

| What | Where it was | Why deleted |
|---|---|---|
| The "Design principles" block | CLAUDE.md | Every bullet restated an S rule (S108, S7, S109, S111, S110, S3/S5, S112). A rule stated twice drifts twice — S8-vs-seed was the worked example. The S rules stand; the index points |
| The sqm-generated convention | CLAUDE.md | S55 + a generated column already hold it |
| The five-file monolith reading | CLAUDE.md (implicit) | The rule conflated file COUNT with AUTHORITY. Authority kept (SPEC/DESIGN decide); the monolith dropped (layers load when they act) |
| "Fix the Docker build" | SPEC §15 item 1 | Fixed before WORKFLOW.md existed; §10 had already named this line the claim's last survivor |
| Two §16 open items | SPEC §16 | Product specifications (founder: not needed, SMAC prints) and the chase question (answered by S137) — closed, not lost: recorded in §16's own closing note |
| The agent-skills table | README (Phase 5 rewrite) | `.agents/` does not exist and `skills-lock.json` is absent — measured; the table described a state the machine is not in |
| "hooks" in the framework ban | CLAUDE.md, WORKFLOW §7 | The word banned claude-flow's hook system; kept meaning that, now says so — and the ban's real content became H1/H11, deterministic |

## Moved, not deleted — the discipline changed address, never strength

| What | From → To | Why |
|---|---|---|
| The verification discipline (wrong-red ledger, four shapes, both injections, delta diffing, green-line printing, independent origins, NOT MEASURED) | CLAUDE.md § Verification → `facet-verify` skill | It is teaching that acts at CHECK-WRITING time; the skill loads exactly then. Moved intact — compare the skill against the old section: nothing weakened |
| The RTL trap, Tailwind-compiles-to-nothing, hex ban | CLAUDE.md § Conventions → `.claude/rules/ui.md` + hooks H3/H4 | Path-shaped; the deterministic halves are hooks now |
| Drizzle's three sql traps, derive-in-SQL, Riyadh clock, one-ladder | CLAUDE.md § Conventions → `.claude/rules/data.md` + hooks H6/H7 | Loads when `src/lib` is touched — the only time it can act |
| drizzle-kit silence, journal-skip, 0024 enum trap, no-preserve | CLAUDE.md + README → `.claude/rules/migrations.md` | Loads on `drizzle/**` |
| The auth-bridge warning | CLAUDE.md § Verification → `.claude/rules/auth-bridge.md` | Loads when package.json / src/auth move — the exact moment of risk |
| §0-shadow, seed residue, env-file rules | CLAUDE.md → `.claude/rules/verify.md` | Loads on `scripts/**` |
| Audit + §6b procedure | WORKFLOW §6/§6b (kept there) → also `facet-audit` skill | The procedure invocable at audit time; WORKFLOW stays the authority for WHEN |
| §5 row discipline | practice → `facet-register` skill | Was tribal knowledge in closed rows |
| 124 closed §5 rows | WORKFLOW §5 → `docs/archive/29-closed-register.md` | History changes address: 408,521 → 214,764 bytes for the file every planning session consults. Moved verbatim, grouped under their audit headings, byte-accounted (85 open rows kept) |

## Rewritten — same number, founder's words in

S8 (export → super admin alone; other two flags keep the three roles) ·
S22 (+ shared-means-access) · S76 (+ the she-may-edit-her-own sentence the
code always implemented) · S94 (widened: public holidays + personal leave) ·
S105 (+ request-never-action, reason required) · S137 new · S138 new ·
D64 (narrowed to book-holders, `[CHANGE]`) · D68 (rewritten to what flags
produce) · D75 new · §12 header (PARKED to pilot) · WORKFLOW §2 (the layers)
· WORKFLOW §7 (enforcement named per rule) · CLAUDE.md entire (332 → 125
lines, index).

## Declined — asked, and the answer was no

- `§6b`'s D24 sort-clause proposal — sorting waits for the pilot.
- A regular-customer distinction — dissolved by S137's pause.
- Re-numbering, merging or cosmetically rewriting the 210 rules — the
  census forbids it, and cosmetic rewriting of load-bearing text is the
  most-thorough-not-smallest failure.
- Building anything toward S87's one list — PARKED by the founder.

## Still held — asked of nobody, honestly

- The `D52` empty-fact rider (§6b) — not put to the founder; keeps its HELD
  mark and D52 its `[CHANGE]`.
- The overseer-dashboard and metrics conversations — the founder wants them
  as conversations, recorded in SPEC §16, blocking dashboard work.
