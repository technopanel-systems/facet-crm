# 23 — Verification Log

Moved out of `CLAUDE.md` on 2026-08-12, word for word. It was 327 of that
file's 577 lines, loaded into every session, in a file whose own first line
says keep it short. It is a valuable archive and a poor always-loaded rule.

**Reference only — never authority.** This is a record of what has been
verified, what each script asserts, which bugs were caught and which traps were
hit. It decides nothing about the product. `CLAUDE.md` keeps the standing rules:
the commands, that they are development-only, that a phase is not done until
its screens have been driven over HTTP in both locales, and the auth bridge.

Read it when writing or extending a verify script, when a screen pass is due,
or when something fails in a way that feels familiar — it probably is. The
script shape itself is the `facet-verify` skill.

---

## Verification debt

There is **no test harness**. What is automated, and what is not:

- `npm run typecheck` · `npm run lint` · `npm run build` — the build is not
  optional: it catches a client component importing a data module, which
  `next dev` tolerates and which ships the database driver to the browser.
- `npm run check:messages` — EN and AR carry the same key tree and the same
  ICU placeholders.
- `npm run verify:slice2` — **the first behavioural check that is kept rather
  than thrown away.** Development only, like `dev:fixtures`. It drives
  `src/lib/quotations.ts` in process and asserts: the arithmetic against real
  quotation 9592 (`86.3040 m²`, `10,356.48`, `1,553.47`, `11,909.95`); the
  request is version 1; issuing freezes the lines; a revision supersedes and
  carries them forward; every `can_approve_quotation` gate refuses a rep **with
  its own message**, not merely by throwing; payment ordering; expiry marks an
  overdue thread, skips a paid one, and audits under a null actor; and
  qualification is derived. It found two real bugs on its first run. Since
  `17 §1` it needs `npm run db:seed` first — the supplier fixture it used to
  insert for itself is gone, because suppliers are seeded.
- `npm run verify:slice3` — the same shape, for dispatch, credit splits and
  targets. Development only; needs `db:seed` and `dev:fixtures`. It drives
  `src/lib/{dispatches,credit-splits,targets}.ts` in process and asserts, in
  thirteen sections: every gate refuses **with its own message**; the payment
  gate `[07 C3]`, and that company and rep are **derived from the thread**, not
  typed `[18 §7]`; a direct dispatch needs no payment but is stamped with the
  coordinator's approval `[07 C6]` and reads back as direct; **recording a
  dispatch writes no split row** `[12 §1]`; with no split the dispatch's own rep
  takes 100% `[18 §1]`; **a later generation does not change an earlier
  dispatch's credit** — the central claim `[07 D3]`; equal division loses
  nothing, asserted as a pure function `[18 §5]`; a same-month target
  correction writes a **second row**, and no target row means `null`, never
  zero; achievement ignores service m², quoted m² and `accepted` alike; and the
  `18 §2` visibility grant in **both** directions — the coordinator sees every
  dispatch and the company *name*, and still cannot open the company record.
  **It found two real bugs on its first run**, both recorded below.
  It creates its own reps per run, because achievement is a whole-database
  monthly total and the script keeps its rows `[12 §7]` — reusing the shared
  fixture accounts made the second run count the first run's square metres.
- `npm run verify:phase11` — the same shape, for team, user management and
  offboarding. Development only; needs `db:seed` and `dev:fixtures`. It drives
  `src/lib/{authz,team}.ts` in process and asserts, in sixteen sections: that
  the seed grants `can_manage_users` to exactly super admin, executive and
  sales manager `[12 §3]` **and to no other role**; that all eight gates refuse
  a rep and a coordinator, each with its own key — the section that pins the
  defect this phase fixed, where `createUser` used to throw raw English that
  `ruleErrorState` would rethrow as a 500; that creation normalises the email,
  hashes the password, and turns a duplicate into a field message; that editing
  the email works `[19 §6]` and a no-op save audits nothing; that
  **self-deactivation is refused** `[19 §5]`; that **deactivation kills a live
  session and releases an impersonating one in the same transaction** — this is
  **the first automated half of the auth checklist**, which had existed only in
  a deleted throwaway script; that reactivation restores the flag and
  **restores no session**; that handover is shut while the account is active
  `[19 §3]` and that **deactivating moves nothing** `[07 B7]`; that the book is
  exactly four buckets and **contacts are not one** `[14 §1]`; that
  reassignment soft-removes a membership and inserts one with `origin
  'assigned'`, **and that a recipient who is already a member ends with exactly
  one live row** — the partial-unique-index trap; that every refusal rolls the
  whole call back rather than half-applying it; that **a handover moves no past
  credit** `[18 §1]`; that visibility follows the work in both directions with
  **no new predicate written**; and that an impersonated identity loses the
  flag `[07 A6]`. It found one real framing error on its first run — see below.
- `npm run verify:phase9` — the same shape, for activity reporting.
  Development only; needs `db:seed` (which since `20 §11` also writes the two
  `settings` thresholds) and `dev:fixtures`. It drives
  `src/lib/{reports,timeline,daily-activity,coverage,settings}.ts` in process
  and asserts, in seventeen sections: the seed grants `sees_all_reps` to
  exactly three roles and **only the two thresholds Phase 9 reads are seeded**,
  because rows nothing reads are v1's dead approval gate; every gate refuses
  with its own key — **and the negative claim that coverage and the daily view
  refuse nobody**, because both are scoped `[20 §7, §8]`; both CHECK
  constraints refuse **at the database** `[13 §1]`; **editing corrects one row
  and never double-counts**, replacing the signal set rather than appending —
  the phase's first central claim; re-anchoring moves a report between
  timelines; "asked for a quotation" is not an outcome and qualification stays
  derived; `on hold` is derived on read and the current row wins; the timeline
  merges both halves and **a field note appears on none**; **the 20-entry cap
  is the card's, not the data's**, with the full history paging past it;
  coverage crosses at 30 days qualified and 60 unqualified; coverage is scoped
  in both directions; **the daily view shows real activity beside logged
  activity** — a rep who logged nothing but pushed a dispatch out still shows a
  non-zero row — the second central claim; **attribution**, in four ways a
  number lands on the wrong person; visibility in both directions including
  **a rep who cannot see a thread getting no `quotation issued` event though
  the audit row exists** `[20 §8.2]`; that handover needs no report bucket; and
  that every write is audited.
  **It found three real bugs on its first run**, all recorded below.
  It creates its own reps, because the daily view and coverage are
  whole-database figures over a range — the trap `verify:slice3` hit.
- `npm run verify:phase10a` — the same shape, for follow-ups and notifications.
  Development only; needs `db:seed` (which since `21 §2` also writes the five
  `notification_types` and the three remaining thresholds) and `dev:fixtures`.
  It drives `src/lib/{follow-ups,notifications,dormancy,working-days,team}.ts`
  in process and asserts, in sixteen sections: the seed carries **five types and
  no sixth**, each with the right tier and persistence — including that
  `record.handed_over` is **not** persistent `[21 §4]` — and all five of
  `07 D5`'s thresholds, every one of which now has a reader; every dormancy gate
  refuses with its own key, **and the negative claim that follow-ups and
  notifications refuse nobody**; the dormancy CHECK refuses **at the database**;
  working days as a **pure function with no database**, where a fortnight is
  always ten and the four excluded days are exactly the Fridays and Saturdays;
  **that computing follow-ups writes no `tasks` row and no `notifications`
  row** — the phase's first central claim, asserted as *no task anywhere carries
  `origin 'system'`* rather than *the table is empty*, which is a claim FACET
  does not make; each of the four kinds firing at its threshold and **not a day
  early**, with the boundary moving when the `settings` row moves; `on hold`
  suppressing every kind while a **passed** hold suppresses nothing; archived and
  re-included companies raising nothing, and a **stale** re-inclusion stopping
  shielding; **that the digest is dated yesterday and three sweeps write one
  row** — the second central claim `[20 §9]`; that reading is not resolving;
  **every persistent type × every anchor it can carry having a stated rule**,
  checked in both directions so a future anchor cannot be added with no way to
  clear it, and each rule then exercised until `resolved_at` fills; **that a
  handover raises ONE notification while a single assignment is per-record**;
  that a rep's list holds none of another rep's rows and `markRead` across
  recipients changes nothing `[00 §1.13]`; visibility both ways; dormancy's
  three routes with exactly one live membership after a reassignment; and that
  every write is audited, the sweep's own entries naming **no actor** on purpose.
  **It found two flaws in its own first draft and one real bug**, all recorded
  below.
- `npm run verify:schema25` — **not the same shape as the five above**, because
  `25` Part G lands columns and nothing writes them yet. Development only; needs
  `db:seed` and `dev:fixtures`. It reads `information_schema` and `pg_catalog`
  rather than a data module and asserts, in ten sections: every column landed
  with the right type and nullability; every withdrawn thing is gone, including
  the `warmth` **type** and the tolerance and sales-desk structures `25` refuses
  to build; `tasks` gained nothing and no row carries `origin 'system'`; every
  CHECK refuses **at the database**; the seeds, with the read-only flag on
  **exactly** two roles and explicitly *not* on Sales Manager or Executive; that
  a second seed run inserts nothing; that `rep_report_outcome` and
  `REPORT_OUTCOMES` agree **at runtime**, which the compile-time assertion
  cannot see; **that nothing writes the new columns yet** — the pass's central
  claim; the foreign keys; and **that the loss writer and `projects_loss_detail`
  agree**, which is the one behavioural section and the reason the script
  exists. §8 also **prints what it deliberately does not assert**. Details and
  the trap behind it are under *Redesign stage 3* below.
- **Almost nothing else tests behaviour.** Slice 1's visibility rules were
  checked with throwaway scripts, which is not the same as a suite.
  `verify:slice2`, `verify:slice3`, `verify:phase9`, `verify:phase11` and
  `verify:phase10a` are the shape the rest should take. **All five pass back to
  back in one run**, verified on 2026-08-10, and again on 2026-08-13 after the
  warmth removal touched `companies.ts`.

- **Three bugs `verify:phase9` caught on its first run**, all real. Two were in
  `coverage.ts`: a correlated subquery written inside a `sql` template for
  `last_interaction_on`, and another for `is_qualified`, both silently returned
  the empty answer for **every** row — so a company logged against yesterday
  read as never contacted, and a company with a live quotation read as
  unqualified. Both are now plain grouped queries over the page's ids, which is
  the third time this codebase has chosen two readable queries over one clever
  one. The third was in the script itself: `databaseRefuses` matched only
  `error.message`, and Drizzle wraps the driver error so the constraint name
  lives on the `cause` — it failed all four CHECK assertions while the
  constraints were working perfectly.
- **One real bug in Phase 10a, and it was the HTTP pass that found it.**
  `isCompanyQuiet` — which decides whether the company page renders a dormancy
  panel at all — wrote `current_date - $2` with the threshold as a bound
  parameter. Postgres cannot infer a type for `date - unknown`, so **every
  company detail page answered 500**, and nothing in the data-layer script
  touched that function. It now computes both cut-offs in TypeScript the way
  `follow-ups.ts` does, and `verify:phase10a` §6 asserts it agrees with the
  queue in both directions. **The lesson is the one already on this list**: a
  script that stops at the data layer does not cover a function only a screen
  calls.
- **Two flaws in `verify:phase10a`'s own first draft**, both over-claims rather
  than code faults, and both the family `verify:phase11` §16 already
  demonstrated. It asserted `tasks` was **empty across the whole database** and
  failed on 21 `origin: 'assigned'` rows that `verify-phase11.ts` inserts as
  handover scaffolding and `12 §7` keeps — FACET's claim is that it never writes
  a **system** task, and that is what it asserts now. And it asserted a
  hand-picked date was a working day without checking which weekday it fell on;
  the no-holiday-calendar claim is now made over a fortnight.
- **A latent flaw in `verify:slice3` §12, found by running the five scripts back
  to back and fixed here.** It asked `listDispatches(coordinator, {})` and
  looked for two ids **on page one**. That list pages at 25 and orders by
  `dispatch_date desc`, and the script writes hard-coded September dates, so
  once a dev database had accumulated enough runs the earliest of them fell off
  page one and `18 §2` "failed" while working perfectly. It is now scoped by
  `companyId`. Same family as the two below: **an assertion that drifts as the
  database grows was never asserting what it claimed.**
- **A pre-existing flaw in `verify:phase11` §16, found by running the scripts
  back to back and fixed here.** Its "every entry names an actor" check scanned
  the whole audit log for the last ten minutes, so running `verify:slice2`
  first put a **legitimately** null-actor row in range — the expiry sweep
  audits under a null actor on purpose `[16 §3]`. The assertion was claiming
  something FACET does not claim; it is now scoped to the actions that script
  writes. All four verify scripts now pass back to back in one run.

**Auth bridge** (`11 §4.1`) — re-run after any upgrade of `next-auth`,
`@auth/core`, `@auth/drizzle-adapter` or `next`. Failure here is **silent**:
login still works, sessions just stop being revocable.

The whole checklist was run against a freshly reset cluster on 2026-08-09 and
passed:

- Credentials login writes a real `sessions` row; the cookie carries its token.
- **Deactivation kills a live session on the next request.** Verified both
  ways: flipping `is_active` directly in SQL — bypassing `deactivateUser`'s own
  cleanup — still redirects the next request to login and destroys every
  session row, so `getSession`'s re-check is doing the work on its own; and
  `deactivateUser()` also clears them in its transaction.
  **This half is now automated** — `verify:phase11` §6 inserts a real session
  row plus a second session impersonating the subject, calls `deactivateUser`,
  and asserts the first is gone and `acting_as_user_id` is cleared. It is the
  first piece of this checklist that survives the session it was written in.
- **Impersonation** sets `acting_as_user_id`, and the banner then renders,
  names both identities, offers "Stop impersonating", and the header greets the
  impersonated user. Clearing the column takes all of that back. All four of
  `startImpersonation`'s guards were exercised and each refuses for its own
  reason (not merely "it threw").
  **One gap, stated rather than papered over:** `startImpersonation`'s final
  UPDATE could not be executed in-process — it needs `getSessionToken()` and so
  a request context, and **no UI starts impersonation.** Phase 11 deliberately
  did not add one: it was not asked for, and `19 §8` records the decision, so
  this gap is now open-ended rather than due in a named phase. Its guards and
  its effect are verified; the single statement between them is not.

Still manual, still owed:

- **RTL**: no lint rule enforces logical utilities. Grep before calling a
  screen done, and open `/ar`.
- **Client-side interaction is untested.** The city combobox `[15 §5]` and the
  quotation line editors were checked only as rendered markup in both locales —
  served over HTTP, asserted on the DOM, `200` for the raiser and the
  coordinator and `404` for an unrelated rep. Their keyboard navigation,
  filtering, row add/remove and RTL popup behaviour have never been driven in a
  browser. (`17 §2` deleted one of the things on this list: the colour
  standard/custom switch is now a plain text input with no state.)
  **Two traps when asserting on that markup**, both hit on 2026-08-09:
  next-intl ships the whole message catalogue to every page, so grepping for a
  translated string proves nothing about what rendered — assert on a DOM marker
  like `name="smacReference"`. And a panel may be legitimately absent because
  of record state, not permissions.
- **A quotation line now saves against a clean database, and that was driven
  rather than assumed** `[17 §1]`. On 2026-08-10, in a scratch database created
  beside the dev one — `drizzle-kit migrate`, `db:seed`, `dev:fixtures`,
  dropped afterwards — `verify:slice2` passed in full, and the **real form POST
  was replayed over HTTP**: Next renders the no-JS action envelope as
  `$ACTION_*` hidden inputs, so re-posting those with the line fields drives
  `createQuotationAction` for real. It returned `303` to the new thread and
  wrote `custom_colour = '168'`, `colour_id` null, supplier `N`, 4 mm,
  `86.3040 m²` / `10,356.48` / `1,553.47` / `11,909.95`.
  **That replay is the one piece not kept** — `scripts/verify-slice2.ts` still
  stops at the data layer, so the form's own parsing (`readLine`) has no
  standing check.
- **`product_colours` is empty on purpose and permanently** `[17 §2]` — the
  colour is typed. `verify:slice2` inserts one dev-only colour row, solely to
  exercise the "never both" half of the CHECK that no screen can reach.
- **Slice 3's screens were driven over HTTP on 2026-08-10**, not merely
  compiled: both locales `200` for a coordinator and a rep; `/dispatches/new`
  `404` for a rep and `200` for the coordinator; the linked form offering no
  company or rep field at all `[18 §7]`; the direct form finding companies by
  name `[18 §2]`; and **the real form POST replayed**, which returned `303` and
  wrote a direct dispatch of `12.5000 m²` with `quotation_thread_id` null and
  the coordinator stamped in `approved_by_user_id` `[07 C6]`. The project
  screen showed the credit-split checkbox list with **no percentage input
  anywhere** `[18 §3]`, and `/targets` offered the set-target control to the
  manager and not to the rep. **A trap worth keeping:** `$ACTION_ID_…` and
  `$ACTION_REF_n` carry **no `value` attribute** — a scraper that requires one
  drops them and Next answers *"Failed to find Server Action"*. And on
  `/targets`, `name="period"` belongs to the month filter as well as the
  set-target form; `name="sqm"` is the marker that distinguishes them.
  That replay is **not kept** — `verify-slice3.ts` stops at the data layer, so
  the form's own parsing has no standing check, exactly as for Slice 2.
- **Two bugs `verify:slice3` caught on its first run**, both real:
  `setCreditSplit` asked project visibility before the flag, which made
  `12 §1`'s grant to the **sales coordinator** unusable — `16 §8` gives that
  role no project visibility, so a founder-granted flag was dead. And the
  stored percentages were assigned in submission order while the read ordered
  by name, so the rep holding `33.34%` need not have been the rep credited
  `33.3334 m²`. Both are fixed and both are now asserted.

- **Phase 11's screens were driven over HTTP on 2026-08-10**, not merely
  compiled: both locales `200` for a holder of `can_manage_users` and `404` for
  a rep on every `/users` route; **the nav entry present for the holder and
  absent for the rep** `[19 §4]`; `/users/[id]/handover` **`404` while the
  account is active and `200` once deactivated** `[19 §3]`; and the manager's
  own record offering no deactivate control `[19 §5]`. **Both real form POSTs
  were replayed** — user creation returned `303` to the new detail screen, and
  the handover returned `303` and actually moved the work: the project owner
  changed, the departing membership was kept with `removed_at` set, a new one
  appeared with `origin 'assigned'` and `is_primary` carried across, and the
  audit log showed `user.handover`.
  **Two traps worth keeping, both hit on 2026-08-10:**
  a **bound** server action renders `$ACTION_REF_n` + `$ACTION_n:0`, **not**
  `$ACTION_ID_…` — so counting forms by `$ACTION_ID_` finds only the layout's
  unbound sign-out form and misses every bound one. Match `$ACTION_`. And the
  layout's sign-out form puts an action envelope on **every** page, so "an
  action form exists" proves nothing about the screen under test; count them
  instead. Same family as the `name="period"` trap on `/targets`.
  That replay is **not kept** — `verify-phase11.ts` stops at the data layer, so
  the form's own parsing has no standing check, exactly as for Slices 2 and 3.

- **Phase 9's screens were driven over HTTP on 2026-08-10**, not merely
  compiled: `/reports`, `/reports/new`, `/coverage` and `/activity` all `200`
  in **both locales for a rep and for a manager**, and the nav offering
  coverage and activity to the rep — the visible half of `20 §7`'s
  scoped-not-gated rule, which would look identical to a bug if it were wrong.
  `/reports/new?companyId=` `404` for a rep who cannot see the company; the
  full-history routes `200` for the holder and `404` for an unrelated rep; the
  project page carrying a timeline and **no** Log button `[20 §2]`; and the
  company page carrying the Log button, the on-hold date `[20 §5]`, and — once
  past twenty entries — the "showing the 20 most recent of N" line and the
  full-history link `[20 §6]`. **Both real form POSTs were replayed**: creating
  returned `303` and stored the narrative and a signal reference, proving the
  per-signal field name (`signalReference.<signal>`) survives the round trip;
  editing returned `303` and **corrected in place** — the new outcome present,
  the old narrative gone, the dropped signal's reference gone with it.
  A manager could open the report and got `404` on its edit screen `[20 §9]`.
  **The trap this pass hit:** an assertion written with `|| true` in it, and one
  matching a link that only renders past a threshold — both "passed" while
  proving nothing. A marker that appears only in some states is not a marker;
  the project timeline was finally proved by the report row inside it.
  That replay is **not kept** — `verify-phase9.ts` stops at the data layer, so
  `readReport`'s own field parsing has no standing check, exactly as for
  slices 2 and 3 and phase 11.

- **Phase 10a's screens were driven over HTTP on 2026-08-10**, not merely
  compiled: `/follow-ups` and `/notifications` both `200` in **both locales for
  a rep and for a manager**, and the nav offering both **to the rep** — the
  visible half of `21 §9`'s scoped-not-gated rule, which would look identical to
  a bug if it were wrong. The dormancy panel appeared on a quiet company for a
  holder of `can_assign`, carrying `name="toUserId"` and `id="archiveNote"`, and
  the same company `404`ed for an unrelated rep. **Both real form POSTs were
  replayed**: mark-as-read returned `200` and set `read_at` while leaving
  `resolved_at` **null** — `07 G1`'s "reading is not resolving", proved through
  the form rather than asserted at the data layer — and the re-include POST
  wrote a `company_dormancy_reviews` row whose note then rendered back in the
  company's own history.
  **The trap this pass hit** is the one that found the 500 above: the screens
  compiled, typechecked and built, and the data-layer script passed in full,
  while a page every rep opens was broken. Driving the screens is not optional
  even when the suite is green.
  That replay is **not kept** — `verify-phase10a.ts` stops at the data layer, so
  the forms' own parsing has no standing check, exactly as for slices 2 and 3
  and phases 9 and 11.

Automating the **rest** of the auth checklist is still the highest-value test
to write. `verify:phase11` §6 took the deactivation half; login, the cookie
shape, impersonation's own UPDATE and sign-out are still manual, and the
throwaway script that produced those results was deleted, which is exactly the
problem. `scripts/verify-slice2.ts` is the pattern to copy.

---

## Redesign stage 1 — the shell (2026-08-12)

A presentation-only change: warm-black tokens `[22 §1]`, IBM Plex, the rail,
the theme, Today at `/`, `/performance`, and the shared components restyled.
No data-layer module changed, so the five suites are the regression check that
nothing drifted, and the HTTP pass is the acceptance bar — **a restyle that
500s a screen is this stage's failure mode.**

- **The four checks passed**, and `grep` for physical Tailwind utilities across
  `src` still returns zero — a restyle is exactly where `ml-`/`text-left`
  creep back in.
- **The five suites pass**, with one caveat below that is not a code fault.
- **Every screen was driven over HTTP on 2026-08-12** against the production
  build, not `next dev`: **62 checks**, every `(app)` route in **both locales**,
  for a **rep**, a **manager** and a **coordinator**, and then **every shared
  route again under `facet-theme=light`** — a token defined in only one theme
  would otherwise hide behind the default. Markers were DOM, never translated
  strings: `data-slot="today-queue"`, `data-slot="today-waiting"`,
  `aria-current="page"` for the rail, `name="dispatchDate"` for the dispatch
  form. Dark renders with no cookie, `light` removes the `dark` class, and an
  unknown cookie value falls back to dark.
- **Both form POSTs were replayed.** The theme toggle is a server component and
  a plain form — no JavaScript — and its POST set `facet-theme=light`. Mark-read
  was replayed **and then checked at the database**: `read_at` set,
  `resolved_at` still **null**, which is `07 G1`'s "reading is not resolving"
  proved through the form after a restyle touched every shared component.
  That replay is **not kept**, exactly as for slices 2 and 3 and phases 9–11.
- **Three expectations in the first draft of the driving script were wrong, not
  the app** — worth recording because each looks like a bug: `/dispatches/new`
  `404`s for a rep *and* a manager because `can_dispatch` belongs to the Sales
  Coordinator and Super Admin alone; a manager `404`s on a report's edit screen
  because only the author may edit `[20 §9]`; and a rep's empty contact,
  dispatch and report lists yield no id to follow, which is a legitimate empty
  state rather than a broken link. **Asserting only the 404 would have passed on
  a broken route**, so the coordinator now asserts the 200.
- **The font assertion failed while the fonts were loading correctly.**
  `next/font` emits the family as an underscored class —
  `ibm_plex_sans_<hash>-module__…__variable` — so a marker written `ibm-plex`
  matches nothing. Same family as the next-intl trap: **a marker that never
  appears cannot fail loudly**, it just reads as a missing feature.

### Two defects found, neither fixed here

- **`coverage()` paginates before it filters — live on `/coverage` today.**
  `isQuiet` is derived in TypeScript at `coverage.ts:183-184` from `daysSince`,
  the threshold and the on-hold date, all resolved *after* the page is fetched,
  so `quietOnly` filters only the 25 rows already in hand — ordered
  `asc(companies.nameEn)` at `coverage.ts:136-146`. **Reproduction:**
  `/coverage?quiet=1` for a rep whose quiet companies sort late in `nameEn`
  returns an empty screen while the companies are genuinely quiet. `total` at
  `coverage.ts:190` is the pre-filter count, so pagination pages over the wrong
  denominator too. Fixing it means moving the derivation into SQL — a
  data-layer change, out of scope for a shell stage, so it is `22 §6.5` and the
  Today screen links to `/coverage` rather than inheriting it.
- **`verify:phase11` §16 failed if `dev:fixtures` ran within the last ten
  minutes.** The assertion scanned the **whole audit log** for ten minutes and
  kept the rows whose action it owned; `dev-fixtures.ts` creates its four users
  under a **null actor**, which is correct — nobody is logged in during a seed —
  and `user.created` was one of the owned actions. Confirmed by query: four
  null-actor `user.created` rows, all stamped at the second `dev:fixtures` ran.
  **Fixed below** — it was the third false failure from this one assertion.

### `verify:phase11` §16, third and final version (2026-08-12)

Three false failures from one assertion, each from a row FACET writes
**correctly**. It is now scoped to the run's own records and should not need a
fourth version.

| # | Scope | Failed on |
|---|---|---|
| 1 | The whole audit log, over a ten-minute window | `verify:slice2`'s expiry sweep, which audits under a null actor on purpose `[16 §3]` |
| 2 | The same window, filtered to a list of action names | `dev:fixtures`, which creates four users under a null actor because nobody is signed in during a seed — and `user.created` was on the list |
| 3 | **The rows anchored to this run's own records.** No window, no action list | — |

**Why the first two were wrong in the same way.** A window says *when* a row
was written and an action name says *what* it did. **Neither says whose it
is**, and whose it is was the entire claim. Both versions asserted something
FACET does not claim: that no null-actor row exists nearby.

**How version three scopes.** Every fixture already carries the run stamp
(`verify11-<ms>`) in its email, normalized name or title, so the script
resolves its own users, companies, projects and tasks from that stamp, then
reaches **threads through their project and memberships through their company**
— those two carry no name of their own, and going through the parent also
catches **the membership rows the handover itself creates**, whose ids the
script never sees. It then selects audit rows by `entity_id` alone and asserts
every one names an actor.

**Why no action list is needed any more, and this is load-bearing:**
`verify-phase11.ts` creates **no quotation versions**, and expiry needs a
version with a `valid_until`. So the sweep can never touch this script's
threads, and no legitimately null-actor row can reach its records. **If a
future edit gives this script a quotation version, that stops being true** and
§16 will fail for a correct reason — the fix then is to exclude the sweep's own
actions explicitly, not to widen the scope again.

**Both halves were proved, not assumed** (2026-08-12): a null-actor
`user.created` injected on `rep-a@example.test` — the shape `dev:fixtures`
writes — no longer fails the run, and a null-actor row injected on one of the
run's **own** users is still caught by the same predicate. Both injected rows
were removed afterwards; they were synthetic, not history. A side benefit worth
noticing: `actions seen` now prints exactly the ten owned actions instead of
every action in the database over ten minutes, so the line is finally worth
reading.

`check("this run's own records were found", ownIds.length > 0)` guards the new
failure mode — if the stamp ever stops reaching the fixtures, the set goes
empty and the assertion would otherwise pass over nothing.

### A `check:messages` trap

`{count, plural, =0 {nothing needs you today} …}` fails parity against a
correct Arabic translation. The checker extracts placeholders with
`/\{\s*(\w+)/g`, which reads the literal `=0` branch as a placeholder named
`nothing`; the Arabic branch begins with an Arabic letter and matches nothing,
so the two disagree. **An ICU literal branch must not begin with an ASCII
word character** — the zero case is a separate key on the Today screen for
exactly this reason.

---

## Redesign stage 2 — the screen archetypes (2026-08-13)

`22 §3`'s four archetypes applied to every screen, and `22 §6.1` closed: the
`(app)` layout took the content column and 38 pages dropped their own
`mx-auto max-w-*`. Presentation only — **no `src/lib` module changed**, and the
one new file there, `chain.ts`, imports nothing but types.

- **The four checks passed** at every commit, and `grep` for physical Tailwind
  utilities across `src` still returns zero. `check:messages`: 684 keys, en and
  ar agree.
- **The five suites pass**, which is the regression check that nothing drifted
  under a stage that was not supposed to touch behaviour.
- **The HTTP driver is now KEPT** — `scripts/verify-routes.ts`,
  `npm run verify:routes`. Stage 1 wrote one and threw it away, so its results
  could not be reproduced; this is that script rebuilt from the record above.
  **273 checks** against the production build on 2026-08-13: every `(app)`
  route in both locales for a rep, a manager and a coordinator; every route
  again under `facet-theme=light`; record ids **discovered from the lists**
  rather than hard-coded, then followed into detail, edit and timeline; and the
  theme form POST replayed. Markers are DOM only.
- **Three expectations were wrong again, not the app** — the same shape as
  stage 1, and worth recording because each looked like a bug:
  - The **coordinator's `/companies` and `/coverage` are empty** `[16 §8]`,
    `[18 §2]` — they see quotation threads and company *names*, not company
    records. An absent list card there is the empty state working. Archetype
    markers are now asserted for `sees_all_reps` only, the one identity with
    rows on every list.
  - **`/users/[id]/handover` 404s for an active user.** `19 §3` opens it only
    after deactivation and `team.ts:141` returns null until then. Asserted as a
    404 now, citing the rule.
  - **The theme form declares `encType="multipart/form-data"`, and Next means
    it.** A urlencoded body gets a **404** — which looks exactly like a missing
    route, not like a rejected content type. The script posts what a browser
    posts: a `FormData`, no hand-written `content-type`, no `Next-Action`
    header, because the action id is in the body.
- **One finding stands rather than an assertion.** A 404 renders
  `(app)/not-found.tsx` **without the `(app)` layout** — Next replaces the whole
  subtree with the boundary, so the rail is absent. Not introduced by this
  stage, and asserting the rail would be asserting a Next.js behaviour FACET
  does not choose. The script asserts the not-found screen's own shape instead.

  The consequence is a product one, and it is why this is worth writing down:
  a rep who mistypes a URL gets a screen with **no navigation**. The link out
  of `not-found.tsx` is therefore load-bearing rather than decorative — it is
  the only way back that is not the browser's own button. It names **Today**,
  the same word the rail uses for `/`; it said "Back to start" until stage 2,
  which is a second name for one place.

### The width check earned its place

`25` and the brief both put laptop first, and the start-aligned column behaves
differently by viewport: with the 236px rail, content is capped by the *screen*
at 1366 and 1440 (≈1078 and ≈1152 usable), while at 1920 it stops at 1556 and
leaves 364px of bare canvas. Checking 1366 first is what found the one real
visual defect of the stage:

**`Facts` drew its rules with `gap-px` over a `bg-line` ground.** The concept
can do that — it shows exactly four facts, on one row. A company detail has
**thirteen**, which at 1366px wraps to seven tracks and then six, and the empty
seventh track of the last row painted as a solid block of `--line`. The rules
are drawn by the cells now, so an empty track is blank: there is no cell there
to draw one.

The general lesson, since it will recur: **container-drawn line work assumes a
full last row, and an `auto-fit` grid is the one thing that cannot promise
one.** A wide viewport hides it, because more tracks make a full row likelier.

### Still manual

Mark-read was **not** replayed this stage — the theme POST was, and it is the
one that exercises the shell every screen sits in. Extending `verify:routes`
over the remaining form POSTs, and checking their effect at the database the
way stage 1 did for `read_at` / `resolved_at`, is the next thing to add — the
schema stage below took the first of them. The auth checklist `[11 §4.1]` is
still manual beyond `verify:phase11` §6.

**`dev-fixtures.ts` could not reset a password — fixed in stage 2.** It was
idempotent by email and *skipped* an account that already existed, so once the
four `@example.test` fixtures were created their password could never be
changed by re-running it; `DEV_FIXTURE_PASSWORD` was not in `.env.example`
either, so stage 2 lost the original and reset the hashes with a throwaway
script. The script now **re-applies the password on every run** and touches
nothing else — name, email and role are left as they are, because a fixture
whose role was changed by hand for a test should stay changed — and
`DEV_FIXTURE_PASSWORD` is in `.env.example` with the development-only note.
So the next HTTP pass starts with `npm run dev:fixtures`, not a detour.

---

## Redesign stage 3 — the schema (2026-08-13)

`25` Part G's twelve schema changes and one removal, on `redesign/schema`. No
screens. Migration `0007_redesign_schema`, and a new
**`npm run verify:schema25`**.

### What `verify:schema25` asserts

A different shape from the other five: Part G lands columns and the slices that
fill them come after, so there is almost no behaviour to drive. It reads
`information_schema` and `pg_catalog` instead — the first script here to do so.
Ten sections:

1. **Every column landed**, table-driven, one row per Part G item — name, type,
   nullability, and `false` for each defaulted boolean. Existence and type are
   two checks, not one conjunction, so a missing column and a wrong type say
   different things.
2. **Every withdrawn thing is gone** — the three `companies` warmth columns,
   `pipeline_snapshots.warmth`, and the `warmth` **type** absent from `pg_type`,
   plus the negative claims `25 §23` and `25 §35` make: no tolerance key in
   `settings`, no sales-desk table.
3. **`tasks` gains nothing** — exactly its thirteen existing columns,
   `task_origin` still carrying `system`, and **no row with that origin**.
4. **Every CHECK refuses at the database**, by constraint name.
5. **The seeds** — ten categories, the nine loss reasons and no tenth, and the
   read-only flag on **exactly** Super Admin and Sales Coordinator. The negative
   half is the point: Sales Manager and Executive must *not* hold it, or `25
   §28`'s third tier is a top-up for people who could already see everything.
6. **The seeds are idempotent**, re-run in process, counts unchanged.
7. **The outcome enum agrees with `enums.ts` at runtime**, read back from
   `pg_enum`. `OutcomeMatchesSchema` proves it at compile time and cannot see a
   database that drifted after the build.
8. ***Nothing writes the new columns yet*** — every one null or at its default
   across the whole table, `comments` and `comment_mentions` empty.
9. **The foreign keys** point where they should.
10. ***The writer and the CHECK agree*** — the one behavioural section, below.

### The trap: a CHECK shipped without its writer

`projects_loss_detail` — *detail never without a reason* — refuses exactly what
`src/lib/projects.ts` used to write: `loss_reason` as free text with
`lost_reason_id` null. **Zero projects were lost**, so the migration applied
cleanly and every check stayed green; the defect was waiting for the first rep
to mark a project lost. None of the five suites drives that path, and
`verify:routes` replayed only the theme toggle.

Two things came out of it, and both are the lesson rather than the fix:

- **The writer changed in the same pass.** `lossFieldsFor()` writes the three
  loss columns together — `lost_reason_id` defaulting to the `other` code,
  `lost_at` stamped only on *becoming* lost, and the text — and clears all
  three when the end state moves off `lost`. A reason typed with no list to
  pick from **is** an `other` reason, which is what `25 §5` keeps the free text
  for. This is not a placeholder awaiting the screen.
- **`verify:routes` gained section 7**, replaying that POST in both locales:
  mark lost → 303, the detail screen still renders, re-open → 303. It is the
  third form POST the script replays, and the "still manual" note above is one
  shorter.

### `25 §5`'s remaining half cannot be a CHECK

*`other` requires `loss_reason`; every other code forbids it* has to read the
code behind a uuid, and **a CHECK may not subquery**. It goes in
`src/lib/projects.ts` with the screen that offers the nine reasons. Until then
every loss carries `other`, so the rule is trivially true and untested.

`verify:schema25` §8 **prints that as a stated non-assertion**, along with two
others: `projects_loss_state` is deliberately one-way (`assertLossReason` holds
the converse in the application layer), and nothing *reads* the new columns
either — `authz.ts` does not consult `sees_all_records_readonly`, so `25 §28`'s
third tier is not live. A gap recorded in a script that runs is a gap that gets
closed.

### Traps hit

- **The drizzle-kit TTY prompt, again.** `companies` both gains and loses
  columns, which is precisely the diff that makes generate ask "created or
  renamed?" and die without a terminal. Two passes — drops first, then the two
  additions — merged by hand into one `.sql`, pass 2's snapshot kept with its
  `prevId` repointed at 0006's, the extra journal entry deleted, and
  `npx drizzle-kit generate` confirming *No schema changes*.
- **PowerShell 5.1's `Set-Content -Encoding utf8` writes a BOM**, and
  drizzle-kit answers `Unexpected token '﻿', "﻿{ "id":"... is not valid JSON`.
  Edit a snapshot with `[System.IO.File]::WriteAllText` and a
  `UTF8Encoding($false)`, never `Set-Content`.
- **A stale `next start` serves stale route modules.** A server left running
  from an earlier session reported 500 on `/companies` — the removed warmth
  column — while the fresh build was fine. Check what is on the port before
  believing a failure: eight of them evaporated on restart.
- **The `$ACTION` values must be HTML-unescaped before replay.** `[23]` records
  that those inputs carry no `value` attribute; the other half is that a
  **bound** action's `$ACTION_n:1` carries JSON, so its quotes arrive as
  `&quot;` and replaying them verbatim makes Next answer *"Failed to find
  Server Action"* — a 500 that reads like a stale deployment. The theme toggle
  never hit this because its envelope has no JSON.

### Verified on an empty database, not only the dev one

`CREATE DATABASE facet_schema25`, `drizzle-kit migrate` and `db:seed` against
it with `DATABASE_URL` set in the environment (`process.loadEnvFile` does not
override one that is already set), then `DROP DATABASE … WITH (FORCE)`. The
eight CHECKs, nine loss reasons, ten categories and the two read-only roles all
land from zero. The CHECKs are ordered last in the migration for this reason.

**One casualty worth naming:** `npm run build` overwrote the `.next` a dev
server on port 3000 was holding, which breaks it unrecoverably. Known `[23]`,
and it happened anyway — check for a dev server before building.

---

## Feature slice 1 — the chain strip (2026-08-13)

`22 §6.6`'s strip, on the quotation thread and project detail screens, on
`redesign/chain-strip`. No schema. `verify:routes` grew a **section 8**.

### What section 8 asserts

It drives the **two screens together**, as the manager, in both locales. That
pairing is the whole design: reading `data-position` off the quotation's own
strip says whether that thread is live, and a live thread obliges the project
behind it to draw something. Asserting the project screen alone would be a
tautology — it renders the card only when it has a thread to render it for.

1. Every quotation thread draws a strip — a closed one included.
2. **Six nodes.** A dropped `25 §3` column fails here.
3. **Exactly one node is ringed, and only while someone owes it.** A
   `dispatched` or `closed` thread rings none; every other position rings one.
4. A closed thread has done nodes and no current one — the `reached` branch.
5. The turn panel sits with it.
6. The project behind a live thread draws either the strip or `25 §22`'s flag,
   and the flag carries its figures.

### It walks by shape, not by row

The first version followed all 25 threads on page 1 and produced 588 checks,
of which 550 re-proved what the first one had. Worse, it proved the wrong
things: **every project it reached had two live threads**, so the strip half of
the project screen went untested while the flag half was asserted forty times —
and no `closed` thread appears until page 2, so the one branch that needed a
helper change was never drawn.

It now pages (four pages, capped) and asserts a shape the **first** time it
meets it — position plus which project half it reached. Seven shapes per
locale, 356 checks, and the run prints what it reached:

```
--    reached 32 project strip(s), 72 flag(s), 64 closed thread(s)
```

with a `NOTE:` line naming any branch the data never reached. **No silent
coverage** — which shapes exist at all depends on fixture data, so what was
exercised is printed rather than assumed.

### The hole this closed: section 0 and section 9

The trap below cost two green runs. Both halves of it are now guarded, and
**both guards were made to fail on purpose before being believed** — an
assertion that has never failed proves nothing.

**Section 0 — the server must have booted from this build.** `/api/health`
carries `bootedAt`, stamped at module scope, so the condition is directly
checkable: a server whose boot **precedes the mtime of `.next/BUILD_ID`** is
running code older than the build on disk. The script refuses before check one.

That is the checkable form of *"did not start from this run"*. It is stricter
than an occupied-port snapshot in the way that matters — it still fires after
the operator restarts against a stale build — and looser only where looseness
is right: a server started from *this* build by an earlier command is a valid
thing to verify against, so running the suite twice is not an error. It cannot
catch code edited and never rebuilt; nothing served over HTTP can.

Proven by reproducing incident 2 exactly — rebuild under a running server, then
run:

```
The server at http://localhost:3100 did not start from this run.
  It booted   2026-08-13T09:04:17.533Z
  The build is 2026-08-13T09:05:24.251Z
```

The failure names the port's holder and prints the `Get-NetTCPConnection` /
`Stop-Process` line, because *kill it by PID* is the part that was got wrong.

**Section 9 — nothing may read like a key that failed to resolve.** Every page
the script fetches is scanned: script and style blocks are removed **whole**
(the flight payload carries the entire catalogue as JSON — a scan that only
stripped tags would match all 699 keys on every page), tags are replaced by a
space, and the visible text is matched against
`<namespace>.<key>`. **The namespaces are read from `messages/en.json`'s own
top-level keys**, not guessed, so the pattern cannot drift from the catalogue.

**This is not asserting on translated strings**; `20 §8` and the existing rule
stand. It never looks for a translation. It looks for the *shape* of a lookup
that failed — which is precisely what the stale server rendered, and precisely
what every marker assertion passed straight through: `data-slot="chain-strip"`
was correct on a page whose six labels were raw keys.

Proven by deleting `chain.step.new`, rebuilding and running:

```
FAIL  no visible text is <namespace>.<key> — 27 namespaces watched — 1 found
      chain.step.new   first seen on /en/quotations/79423651-…
```

One failure, the key named, the page named, and the other 366 checks still
green — specific, not noisy. A space, not nothing, replaces a tag for a reason:
`<b>team</b>.<i>x</i>` must not become `team.x`, and ordinary prose ("…on the
team. Next…") never matches because a namespace needs a dot and a segment
immediately after it.

### The trap: three servers, one port

Twice in one session, a green suite was measured against the wrong server.

`npx next start` **failed to bind** — a `next dev` from earlier in the day held
port 3000 — and the suite ran happily against that stale process, which
compiled the new component from source but served the message catalogue it had
imported at boot. The screens rendered `chain.step.new` as literal text and
296 checks passed anyway, because they assert on DOM markers, which were
correct. `check:messages` was green throughout; the JSON was never wrong.

Then, moving to port 3100 to leave the dev server alone, `kill %1` was used to
recycle it — **a job spec from a previous shell invocation**, which killed
nothing, so the port stayed held and a subsequent build's marker never reached
the running server. Forty checks failed against code that was correct on disk.

Three rules, all cheap, and **the script now enforces the first two itself**:

- **Read the server's log before trusting the suite.** `EADDRINUSE` is one
  line, and nothing downstream mentions it. Section 0 catches it whether or
  not anyone reads the log.
- **Kill by PID.** `Get-NetTCPConnection -LocalPort N` then `Stop-Process`, and
  assert the port is free before starting.
- **A stale `next dev` serves new code with old messages.** That combination
  reads exactly like a missing translation key, and is not one. It is also the
  other half of stage 3's casualty — a build overwriting the `.next` a dev
  server holds — so: check for a dev server before building *and* before
  verifying.

**Neither guard existed while the strip was being built**, which is why the
trap was hit twice in one afternoon and why the write-up above is longer than
the fix. The general lesson is the one this repo keeps relearning: a suite that
only asserts what it expects to see will pass against a server that is not the
one under test. Both new sections assert something about the *run itself*
rather than about the screens.

### Still manual

The strip has not been **looked at** in a browser — no screenshot was taken at
1366 or 1440, in either locale. Everything above is markup-level. What is
proven structurally: six `flex-1 min-w-0` steps cannot overflow their row, the
labels `truncate`, and every token the strip uses (`--brand`, `--brand-ink`,
`--line-strong`, `--a-amber-bg`, `--a-amber-fg`, `--text-faint`) is defined in
**both** themes — checked against `globals.css`, which is section 4's own
lesson about a token defined in only one.

---

## Feature slice 2 — comments and mentions (2026-08-13)

`25 §9`–`§15` built. `scripts/verify-comments.ts` is kept, and
`npm run verify:routes` gained a section that posts the comment form for real.

**All four checks, the whole verify suite and the HTTP pass are green:**
`typecheck` · `lint` · `build` · `check:messages` (719 keys), then
`verify:{comments,slice2,slice3,phase9,phase11,phase10a,schema25}` and
`verify:routes` — **389 checks**, three identities, both locales, both themes.

### What `verify-comments.ts` asserts

Ten sections, each citing the document it comes from:

1. All five record types take a comment, and **the database refuses a sixth by
   constraint name** — `comments_record_type`, walked off `error.cause` the way
   `verify-phase10a.ts` learned to. A positive CHECK is the only thing standing
   between a future `record_type` value and silently becoming commentable.
2. Visibility follows the record `[25 §10]`, **in both directions**. The
   negative half is the one that found a bug.
3. Author-only edit, each refusal asserting its own translation key; `edited_at`
   moves; a no-op save writes no audit row; **no delete path exists**.
4. The mention: act-now, not persistent, raised anchorless — and **two mentions
   of the same person on the same record both land**.
5. A tag on somebody who cannot see the record still raises, and its payload
   withholds the body and the link while still naming who tagged them.
6. Comments join the record's timeline, and a record-only scope returns **its own
   comments and nothing else**.
7. `25 §14`, the central claim: one more comment moves the comment column and
   moves no other.
8. `25 §13`: the return-for-edit reason is a comment on the thread; **returning
   tags the thread's raiser and that reaches their bell**; and a refused return
   **rolls its reason back with it**.
9. `21 §4`: a notification with no resolution condition can be dismissed.
10. Every write is audited, and the distinct actions are printed.

### Three defects it caught, and one it did not

**1. `recordTimeline` returned another rep's conversation.** §2 handed it an
outsider's session and got a comment back. The design had the anchored read skip
`visibleCommentsFilter` on the reasoning that a detail screen has already proved
visibility by loading the record — true of every screen, and **not a property of
the function**. Nothing in production reached it, because the pages `notFound()`
first; as a claim about the module it was simply false. The filter is now applied
on every read, anchored or not. The anchored case pins `record_type` by equality,
so four of the five branches are contradicted and never execute — one `exists`
over one row, which is not a price worth trading a silent leak for in a codebase
with no RLS `[03]`, `[00 §1.13]`.

**2. `notifications_live_key` would have swallowed every repeat mention.** The
partial unique index covers `(recipient, type, record_type, record_id)` for every
unresolved row **with a `record_id`**, and nothing resolves a type that is not
persistent — so an anchored `mention.received` would have delivered the first tag
of a person on a record and dropped every later one, permanently and silently.
Found while designing rather than in production, so the type is raised
**anchorless** with the record in `payload`, the way `record.handed_over` carries
its counts `[21 §10]`. §4 asserts the second tag lands, so the index cannot be
re-introduced by a later "tidy-up".

**3. The bell counted a dismissible notification forever.** `unresolvedCount`
counts `tier='act_now' AND resolved_at IS NULL` and **never reads
`is_persistent`**; `markRead` deliberately never touches `resolved_at`; no sweep
resolves a non-persistent type. So `record.handed_over` had been incrementing the
badge permanently since Phase 10a, and `mention.received` — the highest-volume
type in FACET once it replaces WhatsApp — would have buried the tier within
weeks. `21 §4` already legislated the fix in its own words: where no resolution
condition can become true, *"`is_persistent` is false and **it can be
dismissed**"*. That sentence had no implementation. `waiting` is now one
definition, in `notifications.ts`, read by the badge query, `/notifications` and
the Today screen — which had each spelled the rule out separately.

**What it did not catch: the wrong server.** The first `verify:routes` run
reported *"1 of 389 CHECK(S) FAILED"* — five message keys rendering as raw text.
The keys were in both catalogues and `check:messages` was green. The cause was
that `npm run start` had lost the port to **a stale server from an earlier
session** (`EADDRINUSE`, in the start log nobody reads), so 388 checks had passed
against a days-old build.

**Section 0 exists precisely to refuse this, and it waved it through.** The
`/api/health` boot stamp was `const BOOTED_AT = new Date()` at module scope, with
a comment claiming it was *"stamped once at boot"*. A route module is evaluated
**lazily, on the first request that reaches it** — so the stamp was really "when
somebody first asked for `/api/health`", and a days-old server that had never
been probed reported itself as milliseconds old. It now derives from
`process.uptime()`, which is the process's real age whenever the module loads.
Verified by pointing the guard at a server older than the build and watching it
refuse.

Two lessons, both already this repo's shape: **a guard is not verified until it
has been made to fire**, and the untranslated-key scan earned its place a second
time — it was the only assertion in the suite that could see a stale server,
because it is the only one that does not merely check a marker is present.

### The auto-tag, added after the first review

The slice first shipped with the return-for-edit reason landing on the thread and
tagging nobody, recorded as `22 §6.10` because no document said a return should
tag the rep. **The founder decided it, and the framing is the useful part:** it
is not `25 §11`'s manual tag, it is `25 §13`'s act notifying the person it
creates work for. A reason exists to end the WhatsApp round-trip `[25 §9]`, and a
reason nobody is told about does not end it.

So `returnForEdit` tags `raisedByUserId` — the rep who holds the thread **now**,
since `19 §1` rewrites that column on handover — with no control for it and no
way to return without it. `verify-comments` §8 asserts the tag, that it reaches
the bell, and that exactly one person is tagged.

**It is a patch over `22 §6.11`, which is the real gap:** a returned quotation is
in no queue at all. A notification is read once and gone; a follow-up persists
until its condition clears `[21 §1]`. Not built, deliberately — the founder sees
the tag working first.

### What is still manual

- **Nobody has looked at it.** No screenshot at 1366 or 1440, in either locale.
  The chip row and the comment body are the two things that wrap, and the chip
  row's scale limit is `22 §6.9`.
- **The client half is untested**, as everywhere: the composer's uncontrolled
  reset after a successful post, and its remount against `state.values` after a
  rejected one, are asserted only by the POST returning 200 and the comment
  appearing on the next render.
- **The edit screen's form is not replayed** over HTTP. `verify-comments` §3
  drives `updateComment` in process; the POST through `readFields` is not driven.

---

## Feature slice 3 — the sharing write path (2026-08-13)

`25 §30` built. `07 B1`'s manager-initiated sharing existed on paper since the
first migration and had never had a writer. `scripts/verify-sharing.ts` is kept,
and `npm run verify:routes` gained a section that posts the grant and the revoke
for real.

**All four checks, the whole verify suite and the HTTP pass are green:**
`typecheck` · `lint` · `build` · `check:messages` (735 keys), then
`verify:{sharing,comments,slice2,slice3,phase9,phase11,phase10a,schema25}` and
`verify:routes` — **408 checks**, three identities, both locales, both themes.

**No migration.** `record_shares` has carried `revoked_at`,
`revoked_by_user_id` and `shared_by_user_id` since `0000`; this slice is the
first thing to write any of them.

### What `verify-sharing.ts` asserts

Eleven sections. Five are worth naming here:

1. **§1 is scoped to the seeded roles, and that is load-bearing** — see the trap
   below.
2. **§2 includes a gate no seeded role can reach.** `revokeShare` checks the
   anchor's visibility as well as `can_share`. Checking only the flag is safe
   today *because both roles holding it also hold `sees_all_reps`* — safety by
   caller, not by function, which is the property `verify-comments` §2 disproved
   for `commentEvents` in one line. The script constructs a role with
   `can_share` and no `sees_all_reps` rather than waiting for the seed to grow
   one.
3. **§5 is the centre of the script:** a share made by the real `grantShare` is
   followed through **every** call site of `activeShareExists` and
   `hasActiveShare` — companies, contacts (`14 §1`), projects, quotation threads
   (`11 §2`), dispatches (`18 §2`), rep reports (`20 §10`), comments (`25 §10`)
   and coverage. It exists because until this slice every share row in FACET was
   hand-written by a verify script, so *"the filters honour a share"* had only
   ever been proved against fixtures.
4. **§8**: re-granting after a revoke is a NEW row — two rows, the first still
   carrying its `revoked_at`, exactly one live.
5. **§9**: `share.granted` fires on all three anchors, an interaction resolves
   it `[21 §3]`, and **a revoke withdraws it** `[21 §4]`.

### Two defects it caught

**1. The fixtures stored `name_normalized` un-normalized.** §3 and §5 failed on
the **list** filters while `canViewRecord` and the detail reads passed — which
looks exactly like a share that grants a record but not a listing. It was
neither: `normalizeName` folds every non-alphanumeric to a space, so a stamp of
`verifysh-1755…` stored raw was searched for as `%verifysh 1755…%` and matched
nothing. The fixture was fixed to store what `createCompany` stores, not the
assertion loosened. Worth recording because the symptom pointed at the feature
and the cause was in the scaffolding.

**2. A revoke would have left a badge nobody could clear.** `share.granted` is
persistent and `21 §3` gives it one condition — the grantee logs an interaction
against the anchor's company — while `createReport` requires `canViewRecord` on
that company. Revoke the share and the grantee can no longer log it, so the
entry sits in the act-now tier forever. That is precisely the failure `21 §4`
exists to forbid. `sweepNotifications` gained a third resolver.

### `RESOLUTION_RULES` was deliberately NOT extended

The resolver is not in that table and `21 §3` is untouched. The table is what
the **recipient** can do, and `notifications/page.tsx` renders it to them as
advice with `.find`; *"clears when somebody revokes it"* is not advice anyone
can act on. So: no new row, no new message key, and `verify:phase10a` §11 —
which asserts every (persistent type × anchor) has a rule, in both directions —
passes unchanged.

### The trap: a resolver that would have hollowed out another script

The obvious condition for the new resolver is *"the recipient holds no live
share"*. It is wrong, and not in a way that fails visibly.

`verify-phase10a.ts` §11 **plants `share.granted` rows with no `record_shares`
row behind them**, deliberately, to test `21 §3`'s rule at a time when no
producer existed. Under the loose condition every one of those clears on the
first sweep — and that script's *"an interaction resolves the project anchor"*
then passes whether or not `resolveOnInteraction` still works. A green
assertion that cannot fail is worse than a red one.

The condition is therefore **granted and then revoked**: a revoked row exists
for that (record, recipient) **and** no live one does. `verify-sharing` §9 pins
both halves — the withdrawal, and that a planted row with no share behind it is
left alone.

### The other trap: an assertion about every row in a table

**Third outing of one shape**, after `verify:phase11` §16 over `audit_log`.
§1 asserts who holds `can_share`; §2 creates a role that holds it; nothing is
cleaned up `[12 §7]`. Written as a claim about *every row in `roles`* it goes
green on the first run and red on every run after — and reads as a seed
regression, which it is not. **Excluding the current run's stamp does not fix
it either:** the previous run's role is still there.

The fix is `phase11` §16's: scope by **whose** the rows are. §1 matches against
`ROLE_SEED`'s own names, so any number of accumulated run-stamped roles is
invisible to it. **Proved rather than reasoned about** — the script was run
twice, and §1 is green on the second.

The constructed role also had to not disturb the two other scripts that make
claims about `roles`, and this was checked by running them, not by reading them:

- `verify:phase10a` makes **no** flag claim about roles — it resolves two by
  name behind a `seededRoles.length < 7` **floor**, and a floor is immune to
  extra rows.
- `verify:schema25` §5 **does** iterate every row in `roles`, asserting each
  one's `sees_all_records_readonly` matches what `ROLE_SEED` grants by name. The
  new role passes only because it holds that flag **false**. Both facts are
  stated in `verify-sharing.ts` beside the insert, as the reason those values
  are not free to change. Both scripts were re-run and are green.

### What the five existing scripts actually do with shares

The premise that "the five verify scripts insert `record_shares` rows by hand"
needed one correction before it could be answered:

| script | what it writes | converted? |
|---|---|---|
| `verify-slice3.ts:877` | a `record_shares` row, project → repC, to prove the dispatch cascade | no |
| `verify-comments.ts:446` | a `record_shares` row, company → repB, to prove comment visibility | no |
| `verify-phase9.ts` | `company_reps` with `origin: 'shared'` — a **membership**, not a share | n/a |
| `verify-phase11.ts` | the same, and a company named `Company Shared` | n/a |
| `verify-phase10a.ts` | nothing; it names the three record types in its §11 anchor table | n/a |

**Both real fixtures stay.** Neither asserts anything *about* sharing — each
uses a share row as scaffolding for something else — so neither duplicates the
behaviour under test, and the schema is unchanged so both keep passing.
Converting them would couple two green scripts to a new module for no assertion
gained, and would make a comments run fail when sharing changed.

What the fixtures raise is answered **once, in the script that owns sharing**:
§5 walks a real share through every filter, including the dispatch cascade
`verify-slice3` proves from a hand row and the comment branch `verify-comments`
proves from one. Each insert now carries a comment saying so.

### What is still manual

- **Nobody has looked at it.** No screenshot at 1366 or 1440, in either locale.
  The panel sits in the company screen's **narrow** column, so a long name
  beside a "Stop sharing" button is the pair that wraps; the row is
  `flex-wrap`, which is an argument rather than an observation.
- **The client half is untested**, as everywhere: one `useActionState` per form
  means a rejected revoke cannot blank the grant control, and that is asserted
  only by both POSTs returning 200.
- **The picker's scale.** `shareableUsers` returns every active colleague minus
  those already holding the record — the same shape, and the same unaddressed
  limit, as the mention picker `[22 §6.9]`.
- **A grant to somebody who already holds the record** is allowed, writes a row
  that grants nothing new, and raises a persistent notification about access
  they already had. No document asks for the refusal and "already holds it" is a
  different question per record type, so none was invented. Stated in
  `sharing.ts` as a non-rule and in `24 §4.16` as an OPEN item.

---

## Feature slice 4 — follow-ups (2026-08-16)

`25 §18` and `22 §6.11` built together, because the second needs the first: a
returned quotation now raises a follow-up, and a rep with nothing to change
needs a way to say when they will get to it.

**All four checks, the whole verify suite and the HTTP pass are green:**
`typecheck` · `lint` · `build` · `check:messages` (748 keys), then
`verify:{followups,schema25,phase10a,sharing,comments,slice2,slice3,phase9,phase11}`
and `npm run verify:routes` — **466 checks**, three identities, both locales,
both themes.

**No migration.** `next_follow_up_at` has been on all three tables since `0007`
and this slice is the first thing to write any of them.

### The four decisions this slice needed, none of them in `docs/`

Founder-answered in session, and recorded here because they are the basis of
what was built rather than something derivable from the code:

1. **An arrived date produces, it does not merely stop suppressing.** `25 §18`'s
   *"when it arrives it becomes the follow-up"* is a **sixth kind**, `date_due`,
   which supersedes the automatic kinds on its own anchor. A record with a date
   and no threshold met still raises a row.
2. **The returned kind clears on the rep editing a line**, read from the audit
   log — not on the version's status alone. There is no resubmit act in FACET,
   so the status would keep chasing the rep for work already done.
3. **The write path is inline on all three detail screens**, one action, three
   call sites. A thread has no `/edit` route, so nothing else covers all three.
4. **The new threshold is 5 working days**, both borrowed from `07 D5`'s nearest
   analogue. This stretches `21 §8`'s *"for those two thresholds only"* past the
   two it names — that sentence scopes which of `07 D5`'s five come back, and is
   not read as forbidding a sixth.

### What `verify-followups.ts` asserts

Sixteen sections. Five worth naming:

1. **§8 is the one that fails if the override is ever rebuilt as a suppressor.**
   A company created today, never logged against, no quotation — nothing
   automatic to un-suppress — raises `date_due` and nothing else once its date
   arrives.
2. **§7 pins the boundary without faking a clock**, which cannot be done:
   `today()` reads the real one and nothing under test takes a date. Tomorrow
   suppresses, today does not, yesterday does not. `>` not `>=`, where
   `on_hold_until` is inclusive — a due-on date stops suppressing **on** the day
   it arrives, because that is the day it becomes the follow-up.
3. **§6's last check is the one that proves the two suppressions have different
   reach.** `stage-co` is quiet in its own right *and* holds the stale project;
   the date goes on the project only, and the company must still fire. Without
   it the override could be cascading like `on hold` and every other assertion
   in §6 would still pass.
4. **§14 pins the deferred-date note both ways**, including that the company it
   names is the one `gather` suppresses on — asserted on a **project** anchor,
   where the two resolutions could diverge.
5. **§13 pins the overwrite.** One column, last writer wins; the second writer
   is named and the first's audit row is still there.

### The defect it caught, and it was §2 that caught it

**Every clearing assertion was passing against nothing.** §4's *"the rep edits a
line and the follow-up is gone"*, §5's two status routes and §6's *"the returned
thread is suppressed"* were all green on the first run — while
`quotation_returned` **never fired at all**.

The cause was in the fixture, not the feature. `createQuotationThread` writes
its `quotation_line.added` audit entries at the real `now()`, and the helper
backdated only the return — so every thread looked like a rep who had already
resubmitted, which is the exact inverse of the real sequence. The lines are
written, and *then* the coordinator sends them back; they are now dated a day
before it.

**What made it visible was §2 and §3's "before" assertions** — a plain check
that the thing is firing *before* the act that should clear it. Four
"it cleared" checks cannot distinguish a working clear from an empty queue, and
this is the fourth outing of that family after `verify:sharing`'s planted-row
trap. Any assertion that something stopped needs a sibling proving it started.

### Three scripts had to move, all three by design

- **`verify-schema25` §8** asserts the `0007` columns are unwritten. The three
  `next_follow_up_at` entries left `NEW_COLUMNS`; they stay in `LANDED`, because
  that they exist with the right type is still true. The inversion `comments`
  got in slice 2.
- **`verify-phase10a` §1 and `verify-phase9` §1** both count
  `settings.key like 'followup.%'`. Five became six. The claim `20 §11` set is
  unchanged — a threshold row is seeded when, and only when, something reads it
  — and `verify:phase9` is the one that found this, on the full-suite run rather
  than in the slice's own script.

### What is still manual

- **Nobody has looked at it.** No screenshot at 1366 or 1440, in either locale.
  Two things gained a column this slice and both are the wrapping risk: the
  Today KPI row is now **six** tiles at `minmax(178px,1fr)` and `/follow-ups`'
  `FilterNav` is **six** chips plus "All". Six by 178 plus gaps fits 1320px on
  paper, which is an argument rather than an observation. Driving it would need
  a browser dependency, which is not added without asking.
- **The client half is untested**, as everywhere: one `useActionState` per form
  means a rejected set cannot blank the clear, asserted only by both POSTs
  answering 200.
- **The `date_due` tone.** A row whose age is zero is coloured `soon` rather
  than `late` — due today, not overdue. It reads the age the data layer
  computed and derives no threshold, but nobody has seen the amber.
- **A coordinator can date a thread a rep is working.** `canViewRecord` admits
  `can_approve_quotation` `[16 §10]`, and the brief's rule was to reuse the
  existing predicate rather than invent one. The panel names whoever set it, so
  the overwrite is visible; it is not prevented, and no document says it should
  be.
- **A deferred date is delayed, not consumed.** When the hold lapses, the row
  appears. Whether an arrived-but-deferred date should instead be spent is a
  rule no document states.

---

## Looked at by a person

Every visual risk named across stages 1–2 and slices 1–4, collected so the
polish pass starts from a checklist rather than from memory. **Nothing here has
been seen.** `verify:routes` proves markup and status codes; none of it proves
a layout.

**Check 1366 first, then 1440, then wide** — with the 236px rail, content is
capped by the *screen* at those two (≈1078 and ≈1152 usable) and by the 1320px
column at 1920, which leaves 364px of bare canvas. The one real visual defect
found so far — `Facts` painting its empty seventh track as a block of `--line`
— was visible at 1366 and hidden at 1920.

The general rule the same defect produced, since every row below is a candidate
for it: **container-drawn line work assumes a full last row, and an `auto-fit`
grid is the one thing that cannot promise one.**

| # | Screen | Viewport | Locale | What would break |
|---|---|---|---|---|
| 1 | `/companies/[id]` — `Facts` | 1366 | both | Thirteen facts wrap to seven tracks then six. Fixed by moving the rules onto the cells; **the fix has not been re-checked at width** `[stage 2]` |
| 2 | `/` — Today KPI row | 1366, 1440 | both | Now **six** tiles at `minmax(178px,1fr)`. 6×178 + gaps = 1128 < 1320 on paper, which is arithmetic, not an observation. A seventh kind wraps it `[slice 4]` |
| 3 | `/follow-ups` — `FilterNav` | 1366 | both | **Six** kind chips plus "All follow-ups", each carrying a count badge. Arabic labels are longer than the English `[slice 4]` |
| 4 | `/quotations/[id]`, `/projects/[id]` — chain strip | 1366, 1440 | both | Six `flex-1 min-w-0` steps with `truncate` labels. Structurally cannot overflow; the truncation point is what nobody has seen `[slice 1]` |
| 5 | Comment composer — mention chip row | 1366 | both | Every active colleague as a checkbox under every comment box. Readable at fourteen people, a wall at thirty, unusable at sixty. The trigger for `22 §6.9` is the row ceasing to fit `[slice 2]` |
| 6 | Comment body | 1366 | both | Long bodies and the 5000-char cap; wrapping inside the timeline card `[slice 2]` |
| 7 | `SharingPanel` rows | 1366 | both | Sits in the company screen's **narrow** column. A long name beside "Stop sharing" is the pair that wraps; the row is `flex-wrap`, which is an argument `[slice 3]` |
| 8 | `NextFollowUpPanel` — the value row | 1366 | both | Same narrow column. The date, "set by <name> on <date>" and the Clear button share one `flex-wrap` row; an Arabic name plus a medium date is the long case `[slice 4]` |
| 9 | `NextFollowUpPanel` — the on-hold note | 1366 | both | `"{company} is on hold until {date}. This follow-up will not raise until then."` — a full sentence with a company name in it, in a narrow column `[slice 4]` |
| 10 | `/follow-ups` — the age column | any | both | The `date_due` tone is `soon` (amber) at zero days, not `late`. Nobody has seen the amber, or checked it against `--a-amber-fg` in **both** themes `[slice 4]` |
| 11 | `not-found.tsx` | any | both | Next replaces the whole `(app)` subtree, layout included, so there is **no rail**. Its one link out is the only way back that is not the browser's button `[stage 2]` |
| 12 | Every screen | any | **ar** | RTL beyond the logical utilities: the native `<input type="date">` and `<select>` popups are placed by the browser, and no one has watched them open in Arabic `[slice 3, 4]` |
| 13 | Every screen | any | both | Both themes. A token defined in only one hides in the default — the lesson `verify:routes` §4 exists for `[stage 1]` |

Two things would let a machine take most of this over, and neither is built: a
browser driver (an npm dependency, not added without asking) and a screenshot
diff. Until then this table is the pass.

---

## Why the HTTP pass is not optional

Also moved from `CLAUDE.md`, from its **Working style** section, which now
carries the rule in two lines and points here for the case behind it:

> - **Run all four checks before calling a slice done** — `npm run typecheck`,
>   `npm run lint`, `npm run build`, `npm run check:messages`. **`build` is not
>   optional and `typecheck` does not stand in for it:** typecheck passed while
>   a client component imported a data module, and only `build` caught the
>   Postgres driver being bundled for the browser. `next dev` tolerates it too.
> - **A phase is not done until its screens have been driven over HTTP, in both
>   locales.** The four checks above prove a screen compiles, not that it works.
>   Phase 10a is the case that settles it: typecheck, lint, `build` and the
>   whole sixteen-section `verify:phase10a` were green while **every company
>   detail page returned 500** — `isCompanyQuiet` wrote `current_date - $2`,
>   Postgres cannot infer a type for `date - unknown`, and no data-layer script
>   called that function because only a screen does. Log in, fetch the routes,
>   assert on DOM markers rather than translated strings, and replay the real
>   form POSTs.
