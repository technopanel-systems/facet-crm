# 21 — Phase 10a Decisions (follow-ups and notifications)

Answers given by the founder while planning Phase 10a — the notification
trigger and recipient list, act-now resolution, the dormancy lifecycle, working
days, and where follow-ups surface. Each one closes a question no earlier
document answered, and each was needed before the first `/notifications` screen
could be written.

`01 §13.2 #24` has been open since the business model was written: *"What
triggers a notification, and who receives it? … The full trigger and recipient
list is not enumerated."* `09 §15.8` restates it, `10 §10` rules the type a
lookup so the list can stay open, and `12 §15` defers it explicitly. This
document closes it.

`09 §9` reserved `notifications` and `notification_types` and nothing has ever
written either. Unlike `20 §13`, this document needs almost no schema: the tier,
channel and persistence columns `10 §10` and `07 G1` specified were all built in
migration `0000`. What was missing was the data and the code.

**Status:** Sections 1–9 are **[founder]** — user truth. Section 10 is
**[derived]**: it is the implementation reading of §1–9, not a separate rule.

**Authority:** user truth, alongside `04`, `07`, `08 §A–C`, `11 §1–3`, `12`,
`14`, `15`, `16`, `17`, `18`, `19` and `20`. This is the latest statement —
where it corrects an earlier document, this wins.

**Scope.** This is Phase **10a**. `05`'s phase 10 is "follow-ups, duplicates,
notifications"; duplicates are **10b** and nothing here decides them.

---

## 1. A follow-up is a condition, and it materialises as a notification — never as a task **[founder]**

`07 A1` makes a task one entity with three origins, one of which is *"a
system-generated follow-up"*. `10 §9` builds on that: *"System-generated tasks
carry the trigger that created them, so a follow-up can close itself when the
underlying condition clears."* `20 §9` then says the opposite in one line:
*"Follow-up timers are computed on read, never fired and stored."*

FACET has three overlapping concepts and they were one careless session away
from being collapsed into each other. They are separated here, permanently.

**A follow-up is a condition, not a record.** It is a query — *this thread has
been issued six working days with nothing back* — computed on read from real
events and a `settings` threshold. Nothing is stored. This is the pattern the
codebase has already chosen three times: the quotation expiry sweep `[16 §3]`,
Phase 9's coverage, and `on hold` `[20 §5]`.

**A notification is a delivery, and it is the only one of the three that is a
row.** `07 E5` puts follow-ups in the digest tier — one summary, daily, that
does not interrupt. A follow-up therefore surfaces as **one digest notification
per recipient per day**, summarising every condition true at end of day. Never
one notification per condition.

**A task with `origin 'system'` is not written.** `10 §9` is overruled, for four
reasons in order of weight:

1. **Authority.** `20` is later user truth and says the timers are never fired
   and stored. Later corrects earlier; no judgement call is needed.
2. **A task row is a second copy of a derived fact.** It must be created when
   the condition becomes true and closed when it clears — `10 §9`'s own sentence
   describes that reconciliation. Every reconciliation is a way for the row and
   the truth to drift, and `20 §5` chose derivation precisely so there is
   *"nothing to keep in step"*.
3. **Backfill.** A stored follow-up gives every already-overdue thread nothing
   until a job runs. A derived one is correct on the first read — `20 §6`'s
   stated reason for deriving the timeline rather than storing it.
4. **Correction.** `20 §9`'s end-of-day rule exists so that a report corrected
   minutes later cannot fire something that should not have been sent. A task
   written the instant a condition becomes true is exactly that failure.

**`tasks` keeps its other two origins and stays empty.** A rep's own to-do and a
manager-assigned task are real and unbuilt, and no document has asked for a
screen. This phase does not write the table, does not drop it, and does not
repurpose it. `19 §7`'s handover already reassigns open tasks, so the day one is
written, offboarding works.

**Consequence, stated rather than left to be found:** `tasks.system_trigger`
stays permanently unused. It was added for `10 §9`'s design and this document
declines that design. It is left in place rather than dropped — the same
treatment `13 §2` gives `form_factor`, and for the same reason.

---

## 2. Five notification types are seeded, and no sixth **[founder]**

Closes `01 §13.2 #24`, `09 §15.8` and `12 §15`. Each type below is named in a
user-truth document **and** has a real event in the code that can raise it.
Nothing else is seeded: a type nothing produces is the shape of v1's dead
approval gate, which `20 §11` already refused to repeat for settings rows.

| key | tier | persistent | recipient |
|---|---|---|---|
| `quotation.expired` | act-now | yes | the thread's raiser `[07 C7]` |
| `record.assigned` | act-now | yes | the receiving rep `[07 E5, G1]` |
| `record.handed_over` | act-now | **no** — §4 | the receiving rep |
| `share.granted` | act-now | yes | the grantee `[07 E5]` |
| `followup.digest` | digest | no | every rep, scoped to their own work |

Every one carries `default_channel = 'in_app'` — still the only working value
`[04 Q17, C3]`. The column exists so that adding email or WhatsApp later
touches no call site.

**The digest recipient is every user with at least one open follow-up under
their own scope**, `sees_all_reps` included. It is a scope, never a gate — the
same shape `20 §7` gave coverage, and for the same reason: the rep is the person
who can act on a quiet company.

**`04 Q6`'s "light notification when two reps overlap" is not built.** It is
named in `04` and `01 §4.2`, but nothing in the code raises it, no document
says what "act on the same record" means as a condition, and `20 §10` has since
rewritten the privacy rule it was serving. It stays open rather than guessed.

---

## 3. Resolution is by condition, stated per type and per anchor **[founder]**

`07 G1` says act-now notifications *"clear when the action is done, not when the
user taps them"* and `10 §10` restates it: *"Resolution is by condition, not by
click. That is what makes persistence safe rather than maddening."* Neither
gives a single condition.

| type | anchor | clears when |
|---|---|---|
| `quotation.expired` | quotation thread | the thread is extended or revised, or reaches any other end state `[07 C7]` |
| `record.assigned` | company | the recipient logs an interaction report against that company |
| `share.granted` | company | the recipient logs an interaction report against that company |
| `share.granted` | project | the recipient logs an interaction report against any of the project's live linked companies |
| `share.granted` | quotation thread | the recipient logs an interaction report against the thread's company |

**A first view is not a resolution.** Opening a record is a click by another
name, and `07 G1` rejects the click precisely because *"a notification that can
be swiped away is a notification that gets swiped away."* What clears an
assignment is the rep working the record, and `20`'s report is the evidence
that they did.

**A share raises a notification for exactly three anchor types.**
`record_shares.record_type` also permits `contact`, `quotation_version` and
`dispatch`, but a share on one of those **grants nothing today**:
`visibleContactsFilter`, `visibleDispatchesFilter` and `visibleRepReportsFilter`
each deliberately carry no share term, recorded in place in
`src/lib/authz.ts`. Notifying somebody about access they did not receive would
be a permanent badge over nothing. If a share term is added to one of those
filters later, its resolution rule is added in the same change — §4 makes that
a rule rather than a hope.

---

## 4. Persistence belongs only to a notification whose condition can clear **[founder]**

`07 G1` makes act-now persistent and undismissable. It does not say what happens
to an act-now notification that has no condition to clear — and the answer, left
unstated, is a badge the rep can never get rid of. That is the failure mode that
makes a whole tier get ignored, which is the outcome `07 G1` exists to prevent.

**A type is persistent only if its resolution condition can actually become
true.** Where there is no such condition, the notification is act-now — it still
appears, it still counts as news — but `is_persistent` is false and it can be
dismissed.

**Every persistent type must state its resolution rule for every anchor it can
carry.** An anchor with no rule is not permitted. §3 is that statement for
today's types, and `scripts/verify-phase10a.ts` asserts it as a table of every
(persistent type × anchor), failing if one is missing — so the next anchor
cannot be added without a way to clear it.

---

## 5. A handover produces one summary notification, not one per record **[founder]**

`19 §7`'s handover moves four buckets at once and routinely moves dozens of
records. Under `07 G1` read literally, each one raises a persistent act-now
notification, and the receiving rep arrives at fifty undismissable badges.

**A handover raises exactly one `record.handed_over` notification per
recipient**, naming the departing rep and the counts. **Ordinary single
assignments stay per-record** — one assignment is one thing waiting on one
person, which is what act-now is for.

**It is not persistent** `[§4]`. It has no anchor and no completion condition,
so persistence would make it permanent. **A handover summary is news, not a work
item.** The work items are the individual records, and they already reach the
recipient through their own lists, their own timelines and their own follow-ups.
The summary exists so the rep knows where the work came from.

---

## 6. Dormancy — the rep re-includes, the manager reassigns or archives **[founder]**

`07 E6` gives a dormant company three routes and never says who takes them.

1. **Re-included with the same rep, with a warning** — the **owning rep** may do
   this for their own company. It needs no flag beyond being able to see the
   company. This follows `20 §7`: the rep is the person who can act on a quiet
   company, and making them ask a manager to keep working their own customer is
   the surveillance reading that document rejects.
2. **Reassigned to another rep** — requires `can_assign`. Handing a record over
   is an assignment, exactly as `13 §3` settled for the desk rep, and `07 B1`
   keeps that manager-initiated.
3. **Archived as out of scope** — requires `can_assign`. Taking a company out of
   the working set is not a rep's call.

**Nothing is deleted** `[12 §7]`. Archiving writes `companies.archived_at`,
which has existed since migration `0000` and is read in three places while never
having been written by anything.

---

## 7. A dormancy review is a dated row **[founder]**

Route 1 has to be recorded somewhere or it does nothing: a re-included company
is quiet again tomorrow and reappears in the next digest, which is the loop that
teaches a rep to ignore the list.

**Each review is a row** — company, outcome, who decided, when, and an optional
note. The latest row wins on read, and a re-inclusion suppresses that company's
quiet follow-up for **one further threshold period** from the review date.

**Not a `suppressed_until` column on the company.** FACET's rule is that these
are dated rows, never mutable fields — the shape `07 D1` gives targets and
`18 §4` gives credit splits — because changing one must not rewrite history. A
column would also lose who re-included what, which is the entire content of
`07 E6`'s *"with a warning"*: **the warning is the record**. A company
re-included three times in a row is visible as such to the manager, and that
visibility is the whole point of route 1 being a route rather than a no-op.

---

## 8. Working days skip Friday and Saturday, for everyone **[founder]**

`07 D5` states two of the five thresholds in **working days** — quotation
no-response 5, catalogue no-response 10 — while the other three are calendar
days. `20 §7` removed working-day arithmetic from Phase 9 entirely; it comes
back here, for those two thresholds only.

**Friday and Saturday are the weekend, globally.** `04 C4`'s per-rep working
days stays superseded `[07 D6]`, `[20 §7]`; Saturday work is still recorded and
never required.

**No holiday calendar.** Eid and national holidays are not skipped. No document
asks for one, and a table somebody has to keep fed is a table that silently
rots. Recorded as **`OPEN — not chosen`** rather than filled in.

---

## 9. Follow-ups get their own screen; coverage is untouched **[founder]**

`20 §7` built `/coverage` to answer *"which of this rep's companies have gone
quiet"*. The three thresholds seeded here chase quotations, catalogues and
projects — not companies.

**A new `/follow-ups` screen** is one work queue over every open follow-up of
every kind, with its anchor and its age. **A new `/notifications` screen** is
the bell list. **`/coverage` is left exactly as Phase 9 built it**, so it stays
the company-level leading indicator `20 §8` describes.

Neither new screen is gated. Both are scoped by the filters that already exist —
the same scoped-not-gated rule `20 §7` set, and the reason `20 §13` added no
permission flag.

---

## 10. What this means in the schema — migration 0006 **[derived]**

Almost nothing, because `09 §9` was built. Four additions, each traceable to a
statement above:

**`notifications.payload jsonb`**, nullable. Used by exactly one type:
`record.handed_over` carries the departing rep and the four counts `[§5]`.
`notifications` has no title or body column by design — the type plus the record
supply the text — so without this the counts are unrenderable.

**`notifications.digest_date date`**, nullable, with a partial unique index on
`(recipient, type, digest_date)`. It makes digest generation idempotent under
sweep-on-read. A column rather than an expression index because
`(created_at AT TIME ZONE 'Asia/Riyadh')::date` is `STABLE`, not `IMMUTABLE`,
and Postgres will not index it.

**A partial unique index on `(recipient, type, record_type, record_id) WHERE
resolved_at IS NULL`.** A persistent notification is raised at most once while
unresolved. This is what makes re-deriving on every sweep safe rather than
duplicating.

**`company_dormancy_reviews`** — company, outcome, decided by, an optional
recipient for the reassignment case, a note, and the decision date `[§7]`. One
CHECK, per `13 §1`: the recipient is present exactly when the outcome is
`reassigned`. That is a rule about what a row may contain in isolation, so the
database holds it.

**No change to the `record_type` enum.** The handover summary anchors to nothing
and carries the departing rep in `payload` instead, so a shared enum used by
`record_shares`, `tasks` and `activities` is not widened for one row type.

**No new permission flag.** `can_assign` covers dormancy `[§6]`, and the two new
screens are scoped rather than gated `[§9]` — the same reading `20 §13` gave.

Three readings this document settles, recorded so nobody re-derives them:

- **`tasks` stays empty** `[§1]`, and `system_trigger` stays unused. Not
  dropped.
- **The sweep is `expireOverdueThreads`'s shape, not a second one** `[16 §3]`:
  idempotent, system actor, run on read, and the one function a scheduler will
  call when there is one.
- **Recipient filtering is in the application layer, in every query's own
  `WHERE`.** `00 §1.13` records v1's bug exactly — neither notifications page
  filtered by `recipient_id`; both selected `*` and relied on RLS. FACET has no
  RLS `[03]`, so a missing filter is not a weakened defence, it is no defence.

---

## 11. Still open after this document

- **No share write path.** `07 B1`'s manager-initiated sharing screen has never
  been built and no document schedules it. `share.granted` is seeded with its
  tier, persistence and resolution rules complete, and the raise call sits
  behind that path the day it exists. This is the one seeded type with no live
  producer, named here so it is not later mistaken for a dead gate.
- **The overlap notification** `[04 Q6]`, `[01 §4.2]` — §2.
- **A holiday calendar** — §8.
- **Weekly digests.** `07 E5` allows "daily or weekly"; only daily is built and
  no setting is added for the choice.
- **Notification preferences.** Nothing says who may mute what.
- **Whether a `requested` version raises a follow-up** — the same question
  `16 §7` left open for expiry. Only `issued` versions are chased.
- **Whether a merge moves notifications or follow-ups.** `20 §14` leaves the
  reports half to Phase 10; that is **10b**'s, with the rest of duplicate
  handling.
- Carried forward unchanged from `20 §14`: signal aggregation, warmth following
  from reports, the performance formula, and the `19 §8` list — the last
  `can_manage_users` holder, promotion to primary on handover, revoking a
  departing user's shares, long leave, bulk import, password reset and the
  impersonation UI.
