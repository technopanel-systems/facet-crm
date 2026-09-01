---
name: facet-audit
description: How FACET runs an audit pass and the §6b rule review — the read-only discipline, the four verdicts, and what an audit may and may not do. Use when asked to audit the model, the interface or the rules; when a rule has been argued past twice; or when reviewing whether a rule is still right.
---

# FACET audits and the rule review

**An audit is its own session, produces a findings list, and CHANGES
NOTHING.** Fixes are separate sessions afterwards. Plan mode is the right
mode — it physically cannot write.

## The three audits (WORKFLOW §6)

- **AUDIT 1 — the model.** Does the database say what SPEC.md says? Every
  table and column against the S rules. No column without a writer, no flag
  without a reader. Verify scripts green. Do `[CHANGE]` markers still
  describe the code?
- **AUDIT 2 — the interface.** Every screen against DESIGN.md, both themes,
  both locales, 1366 first — as PIXELS (playwright capture + reading shots
  by eye), with figures re-derived against SQL written fresh from the
  S rules over a different connection than the app's, so a disagreement
  names which side moved.
- **AUDIT 3 — pre-pilot.** The full walk with realistic volumes, a real
  phone, a restore proved on a second machine, a deactivation killing a
  session live.

Every finding lands as a **WORKFLOW §5 row** (What · Where · Disposition) —
a defect that exists only in a session report does not exist. Each AUDIT 2
row carries one of four verdicts: *deviates-bad* (screen wrong),
*conforms-bad* (RULE wrong, with what it should say), *deviates-good*
(screen found better), *question* (founder call).

## The §6b rule review

The audits ask whether the code matches the rule; **§6b asks whether the
rule is still right**. Run it beside each audit, over the file that audit
just read — and at any point a rule has been **argued past twice**; the
second argument is the trigger.

Three questions, in order:

1. **Does the thing it constrains still exist?** A rule about a replaced
   mechanism is a fossil.
2. **Is it a boundary or a waiver list?** A rule naming exceptions makes
   every new case an argument; a rule naming a TEST answers cases nobody
   has thought of. The tell is a session asking permission rather than
   applying the rule.
3. **What would it forbid that we now want, and what breaks if it goes?**
   A rule whose reasons still hold is **rewritten, never loosened**, with
   the reasons written into it.

Four verdicts and no others: **Stands** (dated) · **Rewritten** (same
number, states a test) · **Narrowed/widened** (what changed in the world
written in) · **Deleted** (number kept as a tombstone, never reused —
`D18`'s precedent, so no citation shifts).

It may not invent a rule for something nobody asked for, and it changes no
code. Rewrites are their own slice, after the founder approves the verdicts.

## Mechanics that earned their place

- Capture against the BUILT server; assert `location.host` on every shot
  (the compose container can shadow port 3000).
- An audit's own probes obey the wrong-red ledger (facet-verify skill): one
  AUDIT 2 probe went green over a defect by reading union-boxes instead of
  pixels — a 32px crop is what failed correctly.
- Counts taken by an audit are DATED and left as taken; a later reader
  re-takes them rather than patching (`WORKFLOW §5`'s standing instruction).
- Split mechanical sweeps across subagents (grep classification, shot
  capture); keep the WIDE reading and every verdict in the session's own
  model — every real defect here came from one reader noticing a
  contradiction across files.
