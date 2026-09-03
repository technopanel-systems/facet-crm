---
paths:
  - "scripts/**"
---

# Verify-script rules — load the facet-verify skill before writing or editing a check

**For:** work under `scripts/`. **Prevents:** checks that pass for the wrong
reason — eighteen sightings — and runs that measure the wrong server. **Safe
to remove when:** the project gains a real test harness (it deliberately has
none).

- **The discipline lives in the facet-verify skill** — the four wrong-red
  shapes, feed-every-check-its-defect (both injections), delta accounting by
  label diff, the green line carrying its own evidence, independent origins,
  NOT MEASURED over a false green. **Load it before touching any
  `verify-*.ts`.**

- **`verify:routes` runs against `npm run build && npm run start`, never
  `next dev`.** §0 refuses a server older than its build — and §0 has a
  blind spot it cannot see: **the compose app container publishes
  `127.0.0.1:3000`, which outranks `next start`'s `0.0.0.0:3000` on
  Windows**, so with both up every probe reaches the CONTAINER, §0's own
  health check included. Stop the app container before a run
  (`docker stop facet-crm-app-1`) and check one PID holds :3000.

- **The suite is not idempotent against the record tables** — a full pass
  writes ≈485 rows. `npm run seed:demo` is the routine reset (it also resets
  §25's stream-flooding class). Assertions that depend on how much is in the
  database drift as it grows; scope them or guard them.

- **Fixture scripts refuse to run outside development** (`NODE_ENV` guard) —
  keep that guard on anything new that writes.

- `--env-file=.env` is not optional on a new script: `src/auth` reads
  `AUTH_SECRET` at module scope, before any statement runs.
