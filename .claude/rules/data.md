---
paths:
  - "src/lib/**"
  - "src/db/**"
---

# Data-layer rules — SQL, Drizzle, and the derivations

**For:** the failure modes of `src/lib` and the schema. **Prevents:** the
silent-wrong-numbers class — every item below shipped broken at least once.
**Safe to remove when:** the named mechanism (Drizzle's qualifier behaviour,
the Riyadh contract, the one-ladder rule) no longer exists.

- **Derived conditions are resolved in SQL, before pagination.** Filtering a
  fetched page returns silently empty or wrong screens; this shipped once
  and fails without an error. Group counts, quiet flags, whose-move — all in
  the query, never in the screen.

- **A Drizzle column in a `sql` template keeps its table qualifier only when
  the outer query joins something.** In a correlated subquery with no join,
  both sides render bare and resolve inside the inner table — `where
  "dispatch_id" = "id"` is never true, returns zero, raises nothing. Bitten
  three times (sessions 5, 6, 1b-3). **Name both tables outright in any
  correlated subquery**, and assert a derived figure at every reader.

- **The untyped `sql` parameter, three variants, all silent differently:**
  a value interpolated into `sql` becomes a bound parameter typed `text` —
  cast it (`::int`, `::date`) at every site, or the query dies with `42883`;
  **`sql<T>` is a type ASSERTION, not a decoder** — borrow the column's own
  mapper with `.mapWith(table.column)`, or a `sql<Date>` arrives as a string
  and 500s at the first `.getTime()`; **an untyped join column drops rows
  rather than failing** — `audit_log.entity_id` is text, and an INNER JOIN
  against a uuid silently returns nothing forever.

- **The app's "today" is Riyadh's.** The two shapes that lose it are
  hook-blocked (H6/H7): `current_date` is the server's UTC day, one behind
  Riyadh until 03:00; `AT TIME ZONE` on a bare `date` lifts to midnight-UTC
  then STRIPS the zone. The safe shapes:
  `(col at time zone 'Asia/Riyadh')::date` to get a Riyadh day from a
  `timestamptz`, and `${day}::date::timestamp at time zone 'Asia/Riyadh'`
  to get the instant a Riyadh day begins. Three verify scripts were red on
  every small-hours run until both sites were fixed (S46-1).

- **One ladder.** `src/lib/chain.ts` is the only definition of the chain
  positions (`D27`); a second derivation beside it — in SQL or a screen — is
  the drift trap that produced two answers on two screens. The same
  one-definition rule holds for the silence derivation (`companySilence()`)
  and any figure two surfaces share.

- **One authorization layer, in application code** (`S109`) — `authz.ts`.
  Data-integrity invariants (what a row may contain) belong in the database;
  who-may-act never does. The audit row is written by the data layer
  (`withAudit`), not by features (`S112`).

- **Never land a column, flag or table without its writer in the same
  slice.** An unused column is a lie about what the system does — the v1
  failure, and the dead-structure sweep's fifteen findings.
