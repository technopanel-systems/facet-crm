---
name: facet-verify
description: FACET's verification discipline and the kept verify-script pattern — the wrong-red ledger, feed-every-check-its-defect, delta accounting, and the scripts/verify-*.ts shape. Use when starting, extending or reviewing ANY check (in-process verify scripts or verify:routes sections), when a check goes red or suspiciously green, or when asked to prove, verify or regression-check behaviour.
---

# FACET verification

There is **no test harness** — deliberately. The gates are `npm run
typecheck` · `lint` · `build` · `check:messages`, then the **ten kept verify
scripts** (`verify:slice2` … `verify:routes`; see package.json). `build` is
not optional — typecheck has passed while a client component imported a data
module.

A slice is not done until its screens have been driven **over HTTP, in both
locales** — `npm run verify:routes` against `npm run build && npm run
start`, never `next dev`. It walks every `(app)` route as a rep, a manager
and a coordinator, in both locales and both themes, replaying the real form
POSTs. Assert on **DOM markers** (`data-slot`, `name=`), never translated
strings. Check **laptop widths first — 1366 and 1440 — then wide**: a wide
viewport hides exactly the wrapping defects a laptop shows.

Two `verify:routes` sections assert something about the run itself.
**§0** refuses a server that booted before `.next/BUILD_ID` was written — if
it fires, stop the port's holder by PID and start again (and stop the
compose app container first: its `127.0.0.1:3000` outranks `next start`'s
`0.0.0.0:3000` on Windows, so §0 can be reading the WRONG server and cannot
tell). **§12** fails on any visible text shaped like `namespace.key` — no
lookup silently failed.

## The wrong-red ledger

**A check can be wrong in the direction that matters, and this has happened
eighteen times.** Four shapes:

1. **A wrong assertion.** §17 once asserted the *inverse* of `D20` on its
   own markers, so it went green over the thing the rule forbids.
2. **An assertion that reads nothing.** Four page-one reads with no total
   guard, three of them negatives — correct only because the fixture rows
   happened to be newest. And §20's old `>=` header check was green on the
   exact defect its comment claimed to catch: a header counting the page
   reads exactly the page, and `25 >= 25` holds. The sixteenth was a single
   BYTE: §41's attention-row regex carried a literal backspace where ``
   should have been — a Python heredoc turned `\b` into 0x08 on the way
   into the file — so it matched nothing, read 0 behind rows on every run
   since session 53, and its check stayed green beside a real second half
   (`data-behind="0"`). Found in session 54 only because the SAME slip
   landed in a new §35 check and went red there. **`od -c` a regex that
   reads zero of something that exists**; a terminal renders a backspace
   as nothing. The eighteenth (session 55) read the RIGHT string from the
   WRONG place: §6's *renders (app)/not-found.tsx, not a bare Next page*
   matched a class string anywhere in the response, and since session 23
   every 404 had been Next's error shell with the page only in the script
   payload — blank with scripts off, `D20` — because the root layout lived
   under the locale segment. The payload carries every class the DOM would.
   **A check about rendered markup reads the DOM before the first
   `<script`**, never the whole response.
3. **The mirror — a check that FAILS for the wrong reason.** §24 summed one
   page's group headers against the whole scope's total, an equality that
   stops holding the moment a pile falls off page one — red on a screen that
   had been correct all along. The thirteenth sighting was §40 pairing a
   tile with a panel `D64` legitimately removes; the fourteenth was §40
   again, hours later — its parser coupled to the block's exact markup, so a
   legitimate `dir` move read as `tile NaN`. **A check that parses a figure
   out of markup owns every shape that figure may legally take, and prints
   what it failed to parse.** The fifteenth asserted a verbatim class
   string. The seventeenth (session 54, caught in-slice): §45 replayed a
   manager's archive envelope as the COORDINATOR to prove the flag gate,
   and read a 404 — she cannot open a rep's company at all, so visibility
   answered before any gate was asked; the right identity was the rep who
   sees the company and lacks the flag. **A gate test needs an identity
   that clears every check BEFORE the gate.** A wrong red burns the suite's credibility exactly as a false
   green does — it is the shape that gets a correct screen "fixed", and it
   opened one session with a founder decision to rewrite working code.
4. **Two sides from ONE computation, balancing by construction.** §25
   asserted `D45`'s three kinds sum to the stream's own total — but
   `streamKindOf` folds five of six event kinds into `observed`, so both
   sides moved together: it stayed **green** under an injection that removed
   127 events while two other assertions went red. It could never have seen
   a whole source disappear. Five instances catalogued (S45-11), one a pure
   tautology (`quiet + (total − quiet) === total`). **A cross-check's two
   sides must have independent origins, or there is nothing that can
   disagree.**

So: **an assertion prints what it read** (`saw N of TOTAL`) — **on the GREEN
line**, in the label, never parked in `detail`, which prints only on failure;
after a check goes green, read the green line and ask whether somebody else
could re-derive the claim from it. **A negative guards on a non-empty read
first** — and on a non-empty read **of the right subject** (a stranger's
empty scope is correct; the OWNER's rows are what must be non-empty). **A
check spanning a paginated list asserts across the pages**, never on page
one. **Run a new assertion twice** — the second run distinguishes a claim
from an ordering accident. **A check comparing one computation against a
DIFFERENT one stands alone**, never merged with same-computation assertions,
so a disagreement names which side moved.

## Feed every check its defect — both injections

A check nobody has seen fail has not been shown to work. **Two injections,
and the second proves the more valuable half:**

1. **Break the thing under test, watch red.** Necessary but weak — a suite
   goes red for many reasons.
2. **Remove the check's PRECONDITION, watch it decline to report.** The
   section prints `NOT MEASURED`, runs ZERO of its assertions — no `ok`, no
   `FAIL` — because a section that cannot measure must not report something
   safe. Setup is reported apart from the claim (`SETUP FAILED at <step>`).

**The total's delta is ACCOUNTED, not assumed — diff the labels between the
two runs, never subtract.** Twice the obvious reading was wrong: a probe
that changes a page size changes what else the run can reach (§32's went
1700 → 1696 as ten claims left and six report-detail checks arrived; §33's
went 1689 → **1705** the other way). And the labels that moved may not
belong to the section under test: §36's probe moved the total by a plausible
net 17 that was really **72 departures against 55 arrivals, only 23 of them
§36's** — the rest fixture drift between runs. The contamination outran the
signal two to one. Two sections must never print an identical label, or the
diff cannot attribute a departure.

**Three things a new check does by default:** prove a cost or import claim
by RUNNING it (import with the variables absent; break the dependency and
see WHERE it fails); report setup apart from the claim; measure a cleanup
path instead of assuming it — with each status on screen as a `check`,
never in a `finally`.

## The kept in-process script shape

Every slice gets `scripts/verify-sliceN.ts`, copied from `verify-slice3.ts`,
driving `src/lib/*.ts` **in process** — no browser, no HTTP. Scaffolding,
not a feature.

```ts
process.loadEnvFile(".env");
// … imports; let failures = 0;
// check(label, condition, detail) · refuses(label, expectedKey, fn) · sessionFor(email)
async function main() { if (process.env.NODE_ENV !== "development") process.exit(1); /* … */ }
```

Register as `"verify:sliceN": "tsx --env-file=.env scripts/verify-sliceN.ts"`
— `--env-file` is not optional: `src/auth` reads `AUTH_SECRET` at module
scope, before any statement runs.

- **Assert the reason, never merely that it threw** — `refuses()` compares
  the thrown message against the expected translation key.
- **Refuse to run outside development.** It writes real rows.
- **Check the seed is present before using it** — exit with the fix
  (`Run: npm run db:seed`), not a later crash on undefined.
- **Nothing is cleaned up** — FACET does not delete history. Stamp every
  row (`verify3-${Date.now()}`) so a dev database stays readable.
- **Create run-scoped users when a figure is a whole-database total** —
  re-using shared fixtures made a second run count the first run's metres.
- **Cite the rule in the label; print the failing value in detail.**

Cover, in order: the flags and who must NOT hold them · every gate refuses,
each with its own key · the chain's preconditions · derived-vs-typed ·
what must NOT happen · the default path · the slice's central claim
(`*** … ***`) · pure arithmetic table-driven · visibility in both
directions (the negative half matters most) · every write audited.

## Environment facts that bite

- The suite is **not idempotent** — a full pass writes ≈485 rows across
  sixteen tables. `npm run seed:demo` is the routine reset.
- `seed:demo` refuses outside development, confirms interactively (`--yes`
  in scripts), and needs `BOOTSTRAP_ADMIN_*` present before it destroys.
- A red that names its own fix (`re-run seed:demo`) is data, not diagnosis —
  re-seed and re-run rather than investigate.
