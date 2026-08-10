# 19 — Phase 11 Decisions (team, user management, offboarding)

Answers given by the founder while planning Phase 11 — user management and the
offboarding handover. Each one closes a question no earlier document answered,
and each was needed before the first `/users` screen could be written.

**Status:** Sections 1–6 are **[founder]** — user truth. Section 7 is
**[derived]**: it is the implementation reading of §1–6, not a separate rule.

**Authority:** user truth, alongside `04`, `07`, `08 §A–C`, `11 §1–3`, `12`,
`14`, `15`, `16`, `17` and `18`. This is the latest statement — where it
corrects an earlier document, this wins.

---

## 1. A handed-over quotation thread rewrites its raiser **[founder]**

`04 Q8.1` names quotations among the things a departing rep's handover must
cover, and `07 B7` says the manager can reassign **all** of that rep's data.
Neither says which column moves.

**`quotation_threads.raised_by_user_id` is rewritten** to the receiving rep,
and the change is audited with the old value in `before`.

**Nothing financial moves with it.** `18 §1` fixes credit to
`dispatches.user_id`, which is stamped at the moment of the event. A thread
changing hands cannot alter a past month's achievement, and `verify:phase11`
asserts exactly that.

**What is not rewritten.** `payment_confirmed_by_user_id`,
`cancelled_by_user_id`, every version's author and every dispatch are records of
**who performed an act**. Handover moves ownership, never authorship.

The alternative — leaving the thread and relying on `11 §2`'s project → threads
cascade — was rejected: it works only when the thread's project is handed to the
same person, and a thread raised on somebody else's project would be stranded
with no route to a new owner at all.

---

## 2. The user form asks for region directly **[founder]**

`15 §4` makes region derived from the chosen city. It names
**`companies.region` and `projects.region`** and no other table.

**It is not extended to `users`.** The create and edit forms ask for the
region with a native select, exactly as `14` prescribes for a short list.

`10 §7` explains why the two are different: a company or project region is the
**site** location, which a city determines. A user's region is the rep's
**base**, which is a fact about the person's posting rather than about any
address on file.

**Consequence.** `users.city_id` stays null and is not asked for. The column is
not dropped — `CLAUDE.md` does not permit dropping structure on an assistant's
judgement, and `10 §7` put it there deliberately.

---

## 3. The handover screen opens only after deactivation **[founder]**

`07 B7` states the order: *"deactivation revokes access immediately. Records
stay where they are… A handover screen lists everything and allows reassignment
in bulk or one at a time."*

**`/users/[id]/handover` returns `notFound()` while the account is active**, and
the data layer refuses in step with `team.errors.userStillActive` — the UI is
never the gate.

Access is cut before the review begins, which is `06 B5`'s point about
offboarding being an exfiltration risk as much as a redistribution problem.

`OPEN — not chosen`: whether the same screen should later serve `04 C2`'s long
leave case, where the account is not being closed permanently.

---

## 4. Navigation hides a section the role may not open **[founder]**

`app-nav.tsx` carried a comment stating that its entries are not
permission-gated, that the component is `"use client"` and cannot call `can()`,
and that *"the next screen that is meaningless without a flag will need a
different answer"*. `/users` is that screen.

**The `(app)` layout computes the flags and passes them down as booleans.** It
already holds `session`; `AppNav` gains a `canManageUsers` prop and filters its
section list on it. `AppNav` never asks `can()` and imports nothing from
`@/lib/authz` — not even a type, because a type-only import is one careless edit
away from becoming a value import that ships the Postgres driver to the browser.

**Hiding the link is cosmetic.** `/users` itself returns `notFound()` and every
write re-checks the flag in the data layer. `CLAUDE.md`'s one-authorization-layer
rule is unaffected: no predicate moved into the component.

---

## 5. A user may not deactivate their own account **[founder]**

**`deactivateUser` refuses when the subject is the actor**, with
`team.errors.cannotDeactivateSelf`.

The failure it prevents is unrecoverable. The actor loses their own session
mid-request — `deactivateUser` deletes every session row for the subject in the
same transaction as the flag flip. And if they were the only active holder of
`can_manage_users`, nobody can reactivate them: `12 §7` means the row cannot be
deleted and re-created, so the only remaining route is `scripts/bootstrap-admin.ts`
against the database directly.

`OPEN — not chosen`: whether deactivating the **last active holder of
`can_manage_users`** should also be refused, where one manager deactivates
another. §5 covers the case a person can cause alone; this one needs a founder
answer and **is not built**.

---

## 6. Email is editable **[founder]**

`11 §5` records that no password reset or change UI exists. That makes a typo in
an email address unrecoverable in a way it would not otherwise be: the account
cannot log in, cannot be corrected, and `12 §7` forbids deleting it.

**A `can_manage_users` holder may change a user's email.** It is trimmed,
lower-cased and checked for a duplicate exactly as on creation, and the change is
audited with both values.

**Changing an email changes the login identity.** It is a deliberate act, not an
edit anyone makes casually, and the form says so. `users_email_key` still
guarantees the address is unique, and a collision surfaces as
`team.errors.emailTaken` against the field rather than as a Postgres error.

---

## 7. What this means in the schema — nothing **[derived]**

Like `16 §9`, `17 §5` and `18 §7`, this document forces **no migration**. Every
column Phase 11 needs already exists:

- `users` — name, email, `role_id`, `region`, `is_active`, `deactivated_at`,
  `password_hash`
- `roles.can_manage_users`, seeded to super admin, executive and sales manager
  `[11 §1]`, `[12 §3]`
- `company_reps.removed_at`, `projects.owner_user_id`,
  `quotation_threads.raised_by_user_id`, `tasks.assigned_to_user_id` — the four
  handover buckets

Three readings this document settles, recorded so nobody re-derives them:

- **`12 §7` supersedes `04 Q8.1`'s "or delete them".** Q8.1 offers the manager a
  choice between redistributing a departing rep's records and deleting them.
  Retention is later and unambiguous: nothing is deleted. **Only redistribution
  is built**, and no delete control appears on the handover screen.
- **Contacts are not a handover bucket**, though `Q8.1` names them. `14 §1` says
  a contact has no owner of its own and is visible exactly when its company is —
  so handing over the company membership hands over its contacts, and a separate
  control would imply a per-contact ownership that the schema cannot express.
- **`deactivated_at` is cleared on reactivation.** `is_active` is the state; the
  audit log is what preserves that a break happened.

---

## 8. Still open after this document

- Whether deactivating the last active `can_manage_users` holder is refused —
  §5.
- Whether an existing membership is **promoted to primary** when the recipient
  already holds that company and the departing row was primary. `04 Q11` covers
  registration only. Until answered the existing row is left untouched, which
  means a company can end with no primary rep — the first path in FACET that can
  produce that state.
- Whether offboarding should **revoke `record_shares`** granted to the departing
  user. They are inert because login is blocked, and `12 §7` forbids deleting
  them, so they are neither listed nor revoked.
- Whether the handover screen serves `04 C2`'s long leave case — §3.
- **Bulk import**, deferred from this phase's roadmap row `[05]`.
- **Password reset / change UI**, carried forward unchanged from `11 §5` and
  `12 §15`.
- **The impersonation UI.** `startImpersonation` is built and guarded, and
  `CLAUDE.md` records that its final UPDATE is the one statement never executed
  in process because no screen starts impersonation. Phase 11 does not add one —
  it was not asked for, and the gap stays recorded as verification debt.
- Carried forward unchanged from `18 §8`: the dispatch-after-cancellation
  question, same-day split generations, whether uncredited help is recorded, and
  the `17 §6` list.
