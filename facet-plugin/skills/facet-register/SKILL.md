---
name: facet-register
description: How to open, work and close a WORKFLOW §5 register row — FACET's defect and deferred-work ledger. Use when recording a finding, closing a row, re-measuring a count from an old row, or deciding where a discovered defect belongs.
---

# The §5 register

**A defect that exists only in a session report does not exist.** Anything
found and correctly not fixed in-slice lands as a row in `WORKFLOW.md` §5:
**What** (the finding, with the measurement that proves it) · **Where**
(files, line refs, rules) · **Disposition** (who closes it, or
`OPEN — not chosen`).

## Opening a row

- **Measure before writing.** A row carries the number that proves it
  (`0 of 401 rows`, `26/99 growing`), the date, and how to reproduce the
  measurement. A count is a property of WHEN it was taken.
- **Name the mechanism, not the symptom** — and where the mechanism is
  unconfirmed, say "candidate, not confirmed" so the next session inherits
  a hypothesis rather than a fact.
- **Route it, don't fix it.** A finding outside the slice's task is the
  register's, not the diff's — reaching sideways is the scope creep the
  file exists to stop.
- A founder decision goes in as `OPEN — not chosen` with the options
  COSTED, never designed. Do not start by writing the query.

## Working a row

- **Re-take counts; never trust them.** Line references and tallies rot —
  the row's own number is evidence about its date, not about today.
  Re-derive by grep/SQL before acting (the ~28 `dir` sites turned out to be
  a different, smaller set; the "eight selects" were a different eight).
- **Check whether an earlier session already closed it** — session 48 found
  half its named rows already closed by earlier slices. `git log` and the
  code outrank the register's Disposition cell.
- A row's premise can be wrong: §4 row 24 called for deleting what the
  dashboard was BUILT ON. Read the imports before believing a
  "still ships beside" claim.

## Closing a row

- Strike the What cell (`~~…~~`), keep the original finding text beneath
  the closure note — the row is history the moment it closes.
- The closure names the session/commit that closed it and what was ACTUALLY
  done — especially where that differs from the row's prescription.
- **A row nobody owns does not close.** "Whichever slice next opens X" has
  been passed over twice; name a session number or the founder.
- Closed rows eventually move to `docs/archive/29-closed-register.md`
  (history changes address, citations keep resolving); open rows stay in §5.

## Markdown that bites

A row whose cell count does not match its header **loses its trailing cells
silently** — six rows once rendered without their Disposition. An unescaped
pipe inside a code span splits the row. Keep every row one physical line,
escape `\|`, and eyeball the rendered table after editing.
