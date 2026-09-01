# THE FIXATION — Phase 1: the inventory

Session 50, 1 Sep 2026. Every rule across the five authority files and the two
project skills, against five questions: what failure was it written against,
can that failure still happen, is it load-bearing, is it contradicted by the
system as built, and where does it belong in the layered architecture.

Verdicts: **KEEP** · **MOVE** (content relocates, authority unchanged) ·
**REWRITE** · **DELETE** · **ASK** (the founder's, batched in Phase 2).

## The measurement that decides the architecture

A citation census over all 206 code files in `src/` and `scripts/`
(census.json beside this file): **124 of 136 S rules and 70 of 74 D rules are
cited in code or scripts.** S72 is cited 171 times, S73 145, S76 125. The five
cited nowhere outside their own file — S2, S4, S36, S48, S104 — are
foundational statements or `[BUILD]` rules, not dead weight.

**Consequence: no rule is renumbered, ever.** A deletion keeps its number as a
tombstone (`D18`'s precedent). The numbering is a public API with hundreds of
consumers. The rebuild therefore moves PROSE, never numbers: `SPEC.md` and
`DESIGN.md` remain the authority layer, read on demand; what changes address
is the always-loaded index (`CLAUDE.md`), the machinery file (`WORKFLOW.md`),
and the new path-scoped/skill/hook layers.

Baseline sizes, measured: CLAUDE.md **332 lines / 20,259 bytes** (always in
context) · SPEC.md 1,101 / 59,012 · DESIGN.md 1,451 / 84,605 · WORKFLOW.md
1,221 lines / **406,672 bytes** · README.md 431 / 19,774. Markers: 9
`[CHANGE]` / 24 `[BUILD]`.

---

## CLAUDE.md — the file being dismantled (bullet by bullet)

The failure it was written against: v1's death by invented logic and
unaudited documentation. Every bullet was right when written. The file's
defect is its ADDRESS: 332 lines load into every session whether the session
touches SQL, screens, or nothing at all, and the sediment (fourteen wrong-red
case studies, three Drizzle traps, a timezone appendix) is teaching material,
not always-needed law.

| Block | Verdict | Where it goes, and why |
|---|---|---|
| What FACET is | KEEP, compressed | Index. Two sentences suffice; SPEC S1–S6 carry the full statement |
| Authority (two files, cite by number, archive never authority) | KEEP | Index — the core of the whole arrangement |
| Hard rules (never invent logic, no unrequired structure, not-decided-unless-written, OPEN — not chosen, don't reopen) | KEEP | Index. Judgment rules; no hook can hold them; they must always be loaded |
| Simplicity (smallest wins, NOT-building statement, delete before adding, 800-word plans, no rare-case machinery, unused structure is a lie, writer-in-same-slice, old-mechanism-out) | KEEP, tightened | Index. This is the founder's own diagnosis in rule form |
| Design principles block | DELETE the duplication | Every bullet restates an S rule (S108, S7, S109, S111, S110, S3/S5, S112). The index keeps one pointer line. A rule stated twice drifts twice — this file's own S8-vs-seed lesson |
| Translation-layer convention | MOVE | Path rule on `src/**` + one index line. `check:messages` and `verify:routes` §12 are the machine half |
| RTL logical utilities + the dir-margin trap | MOVE (now HOOKED) | H3/H4 enforce it deterministically; the WHY and the gap-over-margin fix move to the `src/**` path rule. "The convention that rots fastest if unenforced" stops being prose |
| Tailwind compiles-to-nothing | MOVE | `src/**` path rule — it matters exactly when editing UI source |
| Square metres generated | DELETE the duplication | S55 + a generated column already hold it |
| Derived-conditions-in-SQL | MOVE | `src/lib/**` path rule; loads when writing the data layer |
| Drizzle qualifier trap, `sql<T>` assertion, untyped params, untyped join | MOVE | `src/lib/**` path rule — three incidents, all in the data layer |
| Riyadh clock (current_date, AT TIME ZONE) | MOVE (now HOOKED) | H6/H7 block the two shapes; the explanation moves to `src/lib/**` |
| Skills pointer | KEEP, updated | Index names the grown skill set |
| Verification: the gates (typecheck·lint·build·check:messages·verify) | KEEP, compressed | Index — every session runs them |
| Verification: HTTP walk, both locales, laptop-width-first | MOVE | facet-verify skill + `scripts/**` path rule |
| Verification: the wrong-red ledger (fifteen sightings, four shapes), injection discipline, delta-diffing, green-line printing, independent origins, NOT MEASURED | MOVE | facet-verify skill. This is the project's crown-jewel discipline and its bulk is TEACHING — it loads when someone writes or touches a check, which is the only time it can act. Moved intact, weakened nowhere |
| Database-tool-reports-success trap (drizzle silence, CR in URL, skipped journal entries) | MOVE | `drizzle/**` path rule |
| Auth bridge warning | MOVE | Path rule on `package.json` + `src/auth/**` — loads exactly when the four packages could move |
| Working style: plan mode, one task, small diffs, commit per slice | KEEP, compressed | Index |
| Dependency ask | KEEP (now PERMISSION) | Index one line; P5 enforces the ask |
| No frameworks / memory-store clause | REWRITE (now HOOKED) | Index, shortened: H1/H11 enforce it; the text now distinguishes claude-flow's machinery from the platform's own hooks — the distinction the subagent bullet already drew |
| Subagent discipline (split mechanical, never the reading; report found not concluded; no orchestrating small slices) | KEEP | Index — judgment about how sessions think, needed before any file is touched |
| Stack | KEEP, compressed | Index. "No Supabase. No Vercel." now also PERMISSION-enforced (P1/P2) |

Projected index: ~120 lines. Nothing in the discipline weakens; it moves to
the layer that loads when it can act.

## WORKFLOW.md — machinery vs sediment

Written against: sessions losing context between chats, defects existing only
in session reports, and the plan drifting from the code. All three failures
are still live; the file's defect is 406KB in one file, most of it CLOSED
register rows — history wearing the clothes of work.

| Section | Verdict | Note |
|---|---|---|
| §1 Who does what | KEEP | Still the arrangement |
| §2 Authority files | REWRITE | Gains the new layers (rules/, skills/, agents/, hooks) |
| §3 The loop | KEEP | Step 7's living-spec clause is the ratchet's counterweight and stays verbatim |
| §3b Model/mode | KEEP, one line marked dated | Model names age; the never-downgrade-mid-slice rule is the load-bearing half |
| §4 Session plan | KEEP | Row numbers and commits are cited; history stays where citations resolve |
| §5 register — OPEN rows | KEEP | The project's live memory |
| §5 register — CLOSED rows | MOVE | To `docs/archive/29-closed-register.md`, verbatim, with a pointer left in §5. ~70% of the file's bytes are closed narrative; a session consulting the register pays ~100K tokens to find the ~30 open rows. History is not deleted — it changes address, which is what the archive is FOR |
| §6 audits / §6b rule review | KEEP | §6b is the standing version of this session — the ratchet-breaker. Its trigger ("argued past twice") and four verdicts survive unchanged |
| §7 Rules that keep this from going wrong | REWRITE | The hooks clause gains the claude-flow/platform distinction; the enforcement column is named per rule (which are hooked, which prose) |
| §8 Repo access | KEEP | |
| §9 Status block | KEEP | |
| §10 Snapshot | REWRITE | Re-taken by Phase 6's measurements, per its own instruction |
| §11 Housekeeping | KEEP | Done-record. One stale claim fixed: `.claudeignore` is not a Claude Code mechanism — the enforced equivalent is Phase 0's permissions, and the file stays only as documentation of intent |

## SPEC.md — S1–S136

Written against: v1's invented logic. The file is honest, current-tense, and
almost fully load-bearing (124/136 cited in code). AUDIT 1/1b's 26
contradictions were worked off by sessions 19–49 or carry open §5 rows with
owners. **Verdict for the file: KEEP as authority. No S rule is deleted by
this session's own hand — a business rule's deletion is the founder's act**
(CLAUDE.md: never invent business logic; removing a requirement invents its
absence). The exceptions below.

Blanket verdict: **S1–S136 KEEP**, except:

| Rule | Verdict | Why |
|---|---|---|
| S8 | ASK | Rule says Sales Manager exports; the seed says the opposite; both cannot stand (AUDIT 1b row, open) |
| S16/S17 | ASK | Category, lead source, VAT number: writers live at every layer, **0 of 987 companies carry any value** after a year of fixtures. Either the pilot will supply them or the fields are not wanted |
| S20 | KEEP | Already corrected (5fdea92) |
| S22/S23 duplicates | ASK | [BUILD], no writer, 25e blocked on it. Still wanted? |
| S29.3 on-hold-until on projects | ASK | The one unshipped setter of five; a project parks nowhere while a report can park a company |
| S44-* rows | KEEP | Security review rows, owned in §5 |
| S46/S49 signals | ASK | [BUILD]; signal-before-loss offer and the aggregate report. D44's one-line payoff depends on S49 |
| S76 | REWRITE | One sentence: "she may not edit either" needs "…a project or contact she does not own" — the open §5 row's exact fix; the code is already right |
| S86–S95 waiting list | ASK | "The heart of the system", [BUILD]; the dashboard now does much of its job (D33/D34 tiles + list read follow-ups.ts). Confirm the one-list rebuild is still the destination before more sessions aim at it |
| S94 holiday calendar | ASK | [BUILD]; the pace tick reads wrong through every Eid until it exists |
| S104 | ASK | [BUILD], cited nowhere; previous rep's name on their work — still wanted? |
| S105/S106 archive requests | ASK | [BUILD]; the rep's request path is the missing half of D41 |
| S115 attachments | ASK | Restricts nothing today; is the feature still coming? |
| S117 dispatch total | ASK | The line money ships; does anyone want the dispatch-level total? |
| S123 | KEEP | Figures live on /users/[id]; rule already updated |
| S129/S80/S79 credit | KEEP | One future session, already scoped in §5 |
| S135/D71 marks | ASK | [BUILD] pair; still wanted? |
| §15 item 1 "Fix the Docker build" | DELETE (line, not rule) | Fixed before WORKFLOW.md existed; §10 names this line as the claim's last survivor |
| §16 open items | ASK | All five are founder questions by their own text |

## DESIGN.md — D1–D74

Written against: the concept file being mistaken for authority, and 26 rules
describing things that did not exist (AUDIT DESIGN's tally). Sessions 46–49
rewrote the worst; the §6b review is live machinery. **Verdict for the file:
KEEP as authority.** The rewrite-notes ("Rewritten by §6b… session 49…") are
provenance inside an authority file — tolerated for now because each note is
the rule's reasons attached, which Phase 4 requires; a future §6b pass may
trim them to the archive.

Blanket verdict: **D1–D74 KEEP**, except:

| Rule | Verdict | Why |
|---|---|---|
| D18 | KEEP | Tombstone; the precedent this whole inventory relies on |
| D24 sort clause / FORM FIELD ORDER | ASK | HELD by §6b; the founder's real question was field order inside forms — his named unresolved item |
| D25 "due soon" window | ASK | OPEN — not chosen; no rule says where amber starts on /companies |
| D35/D36 | ASK | [BUILD], no component, A2-24. The week strip and Recently: still wanted, or deleted with numbers kept? |
| D41 | KEEP | Blocked on writers (25e), correctly |
| D42–D44 rollup | ASK | Unbuilt screen; D42's funnel stage deliberately open. Confirm the monthly rollup is still wanted before session 36 exists |
| D52 rider | ASK | HELD by §6b — the empty-fact widening |
| D66 "roughly half differ" | KEEP | §5 already forbids quoting the rate until the pilot measures it |
| D68 vs D64 | ASK | HELD by §6b — the founder's answer changes the dashboard's shape (A2-8/A2-9's question) |
| D72 two unpolled screens | KEEP | The rule already names them absent, with costs in §5 |

## README.md

| Block | Verdict | Note |
|---|---|---|
| Whole file | REWRITE (Phase 5) | Becomes the ONE entry document — the narrative (what FACET is, how the business works, how it is built, how sessions run, why the discipline exists, where everything lives) leading, the operational reference (run/db/backup/deploy) kept beneath it. No sixth file is created |
| Agent-skills table (.agents symlinks) | DELETE | Measured: `.agents/` does not exist and `skills-lock.json` is absent. The three third-party skills are not installed; the table describes a state the machine is not in |
| Deployment/backup sections | KEEP | Operational truth, recently proven (S44 rows) |

## The two project skills

| Skill | Verdict | Note |
|---|---|---|
| facet-ui | KEEP + fix one drift | Its Effects table still transmits `D15`/`D16`'s SIX-use lists; session 49 rewrote the rules to **two** and **one**. A2-27 said the skill updates when the founder answers; he answered. The skill's own header rule — an enumeration copied from a rule changes in the same commit — was breached by the very commit it warned about |
| facet-verify | REWRITE | Absorbs CLAUDE.md § Verification's full discipline (the four wrong-red shapes, both-injections, delta-diffing, green-line printing, independent origins, NOT MEASURED). Also stale on its own facts: it says slice2/slice3 are the only kept scripts — there are ten |

## What this inventory deliberately does not do

- It does not re-audit SPEC or DESIGN against the code — AUDIT 1/1b/2 did,
  their open findings sit in §5 with owners, and an audit that changed
  nothing was the deal (§6).
- It does not apply the HELD §6b proposals — they wait on the founder, and
  Phase 2 carries them to him.
- It does not renumber, merge, or "clean up" rule text that is merely
  verbose — the census shows the numbering is a public API, and cosmetic
  rewriting of 210 load-bearing rules is the most-thorough-not-smallest
  failure CLAUDE.md § Simplicity names.
