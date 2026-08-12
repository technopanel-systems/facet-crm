---
name: facet-verify
description: The kept verify-script pattern FACET uses instead of a test harness — scripts/verify-sliceN.ts, driven in process against the data layer. Use when starting, extending or reviewing a slice's verification script, or when asked to prove, verify or regression-check a slice's behaviour.
---

# FACET verify scripts

There is no test harness. `scripts/verify-slice2.ts` and
`scripts/verify-slice3.ts` are the only behavioural checks that are **kept**
rather than thrown away — the throwaway script that verified the auth
checklist was deleted, so its results cannot be reproduced. Every new slice
gets one, copied from `verify-slice3.ts`. Both found two real bugs on their
first run.

A verify script drives `src/lib/*.ts` **in process** — no browser, no HTTP.
It is scaffolding, not a feature.

## Skeleton

```ts
/**
 * Verification scaffolding for <the slice> — NOT a feature.
 *
 * It drives `src/lib/<modules>.ts` in process and checks the things that are
 * otherwise only claimed:
 *
 *   1. The flags exist and the seed grants them to the right roles.
 *   2. Every gate refuses, each with its own translation key.
 *   …
 *   N. Every write is audited `[07 E1]`.
 *
 * Usage: `npm run verify:sliceN` — needs NODE_ENV=development in .env,
 * `npm run db:seed`, and `DEV_FIXTURE_PASSWORD=… npm run dev:fixtures`.
 */

process.loadEnvFile(".env");

import { and, eq, sql } from "drizzle-orm";
import { closeDatabase, db } from "@/db";
// … schema tables, then the lib modules under test

let failures = 0;

function check(label: string, condition: boolean, detail = ""): void { … }
async function refuses(label, expectedKey, fn): Promise<void> { … }
async function sessionFor(email: string): Promise<AuthSession> { … }

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== "development") { …; process.exit(1); }
  …
}

main()
  .then(async () => {
    console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} CHECK(S) FAILED.`);
    await closeDatabase();
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch(async (error) => { console.error(error); await closeDatabase(); process.exit(1); });
```

Register it in `package.json`:
`"verify:sliceN": "tsx --env-file=.env scripts/verify-sliceN.ts"`.

## The rules that make it worth keeping

**Assert the reason, never merely that it threw.** `refuses()` compares the
thrown message against the expected translation key — "it threw" would pass on
a typo in the function under test. Every permission gate, every business
invariant, gets its own key asserted.

**`--env-file=.env` is not optional** and `process.loadEnvFile` does not
replace it: the script reaches `@/lib/authz`, and `src/auth/index.ts` reads
`AUTH_SECRET` at module scope — before any statement in the file runs.

**Refuse to run outside development** `[15 §7]`. It writes real rows.

**Check the seed is present before using it.** Select the lookups, and if any
is missing print `The lookups are not seeded. Run: npm run db:seed` and exit
— not a later crash on an undefined `.id`.

**Nothing is cleaned up.** FACET does not delete history `[12 §7]` and this
script gets no exception. Prefix every row it writes with a run stamp
(`const stamp = \`verify3-${Date.now()}\``) so a dev database stays readable.

**Create run-scoped users when a figure is a whole-database total.** Monthly
achievement sums every dispatch in the database, so reusing the shared
`dev:fixtures` reps made the second run count the first run's square metres.
Names also fix the order an equal division falls in `[18 §5]`.

**Cite the document in the label.** `check("D1's credit is UNCHANGED by the
later generation [07 D3]", …)`. The label is the claim; the citation is where
the claim comes from.

**Print the failing value.** The third argument to `check` is the detail —
`` `got ${actual}` `` — otherwise a failure says nothing.

## What to cover, in order

Numbered `console.log("\n7. …")` sections, one per claim, so the output reads
as an argument:

1. **The flags** — reachable, and granted to the right roles by the seed,
   including the roles that must *not* hold them.
2. **Every gate refuses**, each with its own key.
3. **The chain's own preconditions** (payment before dispatch, ordering).
4. **What is derived rather than typed** — assert the derived value equals the
   source, and that a conflicting typed value is refused.
5. **What must *not* happen** — recording a dispatch writes no split row.
6. **The default path** when nothing special is configured.
7. **The central claim of the slice**, marked as such
   (`*** … ***`) — usually that later data does not rewrite earlier records.
8. **Pure arithmetic with no database**, as a separate section, table-driven.
9. **Visibility, in both directions** — the negative half matters most: names
   yes, records no.
10. **Every write is audited**, and print the distinct actions seen.

State a gap rather than papering over it. `verify-slice3.ts` records in a
comment that a split-credited rep still cannot open the dispatch, and that no
document asks for that visibility term — so none was invented.

## What these scripts do not cover

They stop at the data layer. The form's own parsing (`readFields` and each
screen's field reading) has no standing check — the real form POST was
replayed over HTTP by hand for slices 2 and 3, and that replay was **not
kept**. If you extend the pattern, extending it over the action boundary is
the highest-value next step. Automating the auth checklist is the other.
