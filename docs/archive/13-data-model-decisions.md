# 13 — Data Model Decisions (migration 0002 and the desk rep flag set)

Records the reasoning behind three decisions taken while applying
`docs/12-closing-open-items.md` §14 to the schema (migration
[0002_schema_corrections.sql](drizzle/0002_schema_corrections.sql), commit
`0fb0ce7`). Each one was implicit in the code and its comments; none was written
down where a future session would find it.

**Status:** **[derived]** — none of the three is a new business rule. Each is an
implementation reading of an existing user-truth statement in `12`. Where this
document appears to add a rule, it is describing how an existing one was
expressed in the database, not creating one.

**Authority:** reference for §1 and §2 — they explain the schema, they do not
govern it; `12` governs it. §3 is **LOCKED**: it settles a documented conflict
inside `12 §2` and must not be reopened without new founder input.

---

## 1. Nullable `colour_id`, guarded by a `num_nonnulls` CHECK

**Decision.** [quotation_lines.colour_id](src/db/schema.ts#L899) dropped its
`NOT NULL`. An optional `custom_colour` text column joins it. A single table
constraint keeps them honest:

```sql
ALTER TABLE "quotation_lines" ALTER COLUMN "colour_id" DROP NOT NULL;
ALTER TABLE "quotation_lines" ADD COLUMN "custom_colour" text;
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_colour_choice"
  CHECK (num_nonnulls(colour_id, custom_colour) = 1);
```

**Why `colour_id` became nullable.** `12 §12` is the founder statement: standard
colour codes stay in the `product_colours` lookup; the rare RAL or Pantone
special is typed onto the line instead. "A line uses one or the other." A
required `colour_id` makes the second case unrepresentable — the only way to
quote a special would be to insert it into the lookup, and then every rep on
every future quotation picks from a list polluted with one-off customer colours.
That pollution is the failure `12 §12` exists to prevent, so the nullability is
not a loosening of the model; it is the model.

**Why a `num_nonnulls` CHECK rather than the alternatives.** The rule is
*exactly one of two columns is present*, which is an exclusive-or over
nullability, not a foreign key and not a permission.

`num_nonnulls(a, b)` is a PostgreSQL variadic function returning the count of
non-null arguments. `= 1` states the rule directly and completely: it rejects
the both-null row and the both-populated row in one expression, at write time,
for every writer — the app, a migration, a seed script, a hand-typed `psql`
statement. It also scales without rewriting: a third mutually exclusive column
extends the argument list, where a hand-written
`(a IS NULL) <> (b IS NULL)` would have to be re-derived.

The rejected alternatives, and why:

| Alternative | Why not |
| --- | --- |
| Keep `colour_id` `NOT NULL`, put specials in the lookup | Exactly the list pollution `12 §12` forbids |
| Two nullable columns, no constraint | A line with no colour, or with two contradictory ones, becomes storable — the schema stops describing the business |
| A `colour_kind` discriminator column plus per-kind columns | A third column that carries no information the other two don't already imply, and that can itself disagree with them |
| Enforce it only in application code | One missed write path, one migration, one seed script, and the invariant is gone — with no error at the moment it breaks |

**Why the database and not the authorization layer.** FACET keeps
authorization in **one** place, in application code — never in the database
(`CLAUDE.md`, "One authorization layer"). That rule is about *who may act*.
This constraint is about *what a row may contain*: a data-integrity invariant
that holds regardless of who is writing. Those belong in the database, and the
distinction is recorded inline at
[schema.ts:926-931](src/db/schema.ts#L926-L931) so the two rules are not
confused with each other later.

**On "loose schema coupling."** Making a column nullable normally weakens a
schema, because the meaning of null becomes a matter of convention that lives
in prose and in whoever remembers it. The CHECK is what prevents that here:
null in `colour_id` is not "unknown" or "not filled in yet" — it means, and can
only mean, "this line carries a custom colour instead," because the database
refuses every other reading. The nullability buys the expressiveness; the
constraint pays back the rigour.

---

## 2. `form_factor` — left unchanged, deliberately

**Decision.** [quotation_lines.form_factor](src/db/schema.ts#L910) keeps the
`form_factor` enum (`'sheet' | 'coil'`) and its `NOT NULL`, exactly as `08 B2`
defined it. Migration 0002 does not touch the column. The application writes
`'sheet'`.

**Why, when `12 §11` removed coils from quotations.** `12 §11` is a scope
statement: reps quote sheets; coils enter the production sheet with their own
length and width, and thickness describes the core, not the coil. It corrects
`08 B2`'s "two form factors" *as a description of quoting*. It does not ask for
a column to be dropped, and `12 §14` — the founder's own enumeration of the
schema changes this correction requires, six items long — does not list one.
Removing the column would have been the schema change nobody asked for.

**Why not normalize it further.** The obvious "tidier" moves each cost more
than they return:

- **Drop the column.** The enum type, the Drizzle field, and every read path
  would change to reclaim one byte per row on a column whose single value is
  already the correct one. It also discards the distinction the production
  module will need the moment it is built, forcing the same enum to be
  reintroduced under a new name.
- **Promote it to a lookup table.** A two-row table, a foreign key, a join on
  every quotation-line read, and a seed step — to model a closed set of two
  values fixed by the physical product, not by configuration. Lookups earn
  their overhead when rows are added by users over time (colours, service
  types, company categories); `sheet` and `coil` are not that.
- **Narrow the enum to `'sheet'` only.** A single-value enum is a comment with
  a migration attached, and it would have to be widened again for production
  orders.

**How the scope rule is actually enforced.** By the application writing
`'sheet'`, with the reason recorded at
[schema.ts:905-909](src/db/schema.ts#L905-L909). This is a deliberate exception
to §1's preference for database-level invariants: §1's rule ("one colour or the
other") is permanent and applies to every writer, whereas this one ("quotation
lines are sheets") is a **current scope boundary** on one module. A CHECK
pinning the column to `'sheet'` would have to be dropped the moment production
orders arrive — and this is a shared column, not a quotation-only one. Pinning
the column would encode a temporary boundary as a permanent constraint.

**The general principle.** Legacy structure that is correct, harmless, and
already load-bearing for a future module is left alone. `12` corrects `08` on
what reps may **quote**; it does not correct it on what the column may **hold**.
Changes follow the document that asked for them, at the scope it asked for.

---

## 3. Desk rep and lead assignment — `can_assign` only **LOCKED**

**Decision.** The Desk Rep role seeds with `can_assign: true` and
`can_share: false` ([roles.ts:117-131](scripts/seed/roles.ts#L117-L131)). It is
otherwise the sales_rep flag set: no export, no dispatch, no quotation
approval, no user management, no target-setting.

**The conflict.** `12 §2` says two things that do not sit together:

- **Prose:** the desk rep "filters dump and imported leads, works some himself,
  **assigns or shares** the rest."
- **Flag list [delegated]:** "the sales_rep set, **plus `can_assign`**."

Read literally, the prose implies a share capability the flag list does not
grant. One of the two had to give.

**Resolution — the flag list is taken, and the prose is not describing a
`can_share` grant.** Three reasons, in order of weight:

1. **Sharing is manager-initiated, system-wide.** `07 B1` is unambiguous and is
   user truth: *"Reps request shares by phone. The manager initiates in the
   system."* Sharing in FACET is not an action a rep-level role performs — it
   is an action a rep **asks for**, by telephone, and a manager **executes**.
   Granting `can_share` to the desk rep would not extend one role's
   permissions; it would contradict how sharing works everywhere else in the
   system. Nothing in `12` withdraws `07 B1`.
2. **A desk rep passing a lead onward is an assignment, not a share.** The two
   are different acts. An assignment *hands the record over* — the desk rep
   stops holding it. A share *grants a second person access to a record someone
   else still holds*, per record (`07 B2`), and is revocable (`07 B1`). What
   `12 §2` describes the desk rep doing — filtering an inbound dump, keeping
   some, passing the rest on — is handing over. That is `can_assign`, and it
   matches `07 B3`'s treatment of marketing, which assigns **directly** and
   phones the manager to discuss.
3. **A specific flag list outranks a prose gloss.** `12 §2` marks the flag list
   **[delegated]** — agreed and precise, written to be implemented. The prose
   is a description of the job. Where a document states a rule specifically in
   one place and loosely in another, the specific statement is the one that was
   written to be executed. `CLAUDE.md` forbids inventing permissions no
   document requires; no document requires `can_share` here.

**What this means in practice.** A desk rep who needs a lead to reach another
rep assigns it — one act, done directly, no approval step. A desk rep who needs
a lead **shared** — both people working it, the desk rep still holding it —
telephones the sales manager, who performs the share. This is exactly the path
every other rep already uses (`07 B1`), so the desk rep introduces no new
sharing mechanism and no new authorization surface.

**Consequence, noted and accepted.** Desk Rep and Marketing are flag-identical
in the current seed. They stay separate roles: `12 §2` is explicit that the
desk rep is not internal sales and does not go into the field, they are
different jobs, and their flag sets will diverge as flags are added. Roles are
rows, so a role that costs nothing to keep distinct should be kept distinct.

**LOCKED.** Do not reopen. The prose/flag-list tension in `12 §2` is a known
one and is resolved above; re-reading the prose does not constitute new
information. This changes only if the founder states, in a new user-truth
document, that a desk rep may share records without a manager — which would
also require restating `07 B1`, since it would be a change to how sharing works
system-wide, not to one role.

---

## Summary

| # | Decision | Enforced by | Status |
| --- | --- | --- | --- |
| 1 | `colour_id` nullable; exactly one of `colour_id` / `custom_colour` | `num_nonnulls(...) = 1` CHECK in the database | Implements `12 §12`, `§14.4` |
| 2 | `form_factor` unchanged; app writes `'sheet'` | Application code; no constraint | Implements `12 §11` at the scope `12 §14` asked for |
| 3 | Desk rep gets `can_assign` only | Role seed; `can(session, flag)` in the authz layer | **LOCKED** — resolves `12 §2` against `07 B1` |
