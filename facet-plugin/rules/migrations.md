---
paths:
  - "drizzle/**"
---

# Migration rules

**For:** writing and applying migrations. **Prevents:** silent no-ops and
destroyed invariants. **Safe to remove when:** the pilot begins (the first
clause says so itself) or drizzle-kit changes the behaviours named.

- **There is no production data — a migration never preserves, backfills or
  merges.** Every row is fixture or verify residue; a migration clears, and
  `db:reset` is always available. Where clearing is impossible (a NOT NULL
  column losing an enum value), map onto a value the surviving vocabulary
  already names and say why in the header. **This clause dies at the pilot**
  — delete it then, and migrations become preserving.

- **A database tool that reports success may have changed nothing.** Three
  sightings, one class: `drizzle-kit migrate` exits 1 with no message on a
  connection error; a trailing carriage return in an inline `DATABASE_URL`
  connects to a database that does not exist; and a hand-written journal
  entry whose `when` predates the last applied migration is **skipped in
  silence while "migrations applied successfully!" still prints** — `0030`
  was recorded applied with its columns untouched. **Confirm from
  `information_schema` or `drizzle.__drizzle_migrations`, never from the
  success line.** To see a real error, pipe the migration's SQL through psql.

- **Removing an enum value a CHECK mentions needs two extra statements**
  drizzle-kit does not generate: the CHECK stores its literals already
  resolved to the old type, so the text-cast rebuild fails with `operator
  does not exist`. Drop the constraint before the swap, add it back after.
  Migration `0024` is the worked example.

- **No RLS** — hook-enforced (H8). One authorization layer, in code (S109).

- **Never `db:push` against a real database** — local scratch only
  (permission-gated, P6).
