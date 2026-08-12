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
- **Almost nothing else tests behaviour.** Slice 1's visibility rules were
  checked with throwaway scripts, which is not the same as a suite.
  `verify:slice2`, `verify:slice3`, `verify:phase9`, `verify:phase11` and
  `verify:phase10a` are the shape the rest should take. **All five pass back to
  back in one run**, verified on 2026-08-10.

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
