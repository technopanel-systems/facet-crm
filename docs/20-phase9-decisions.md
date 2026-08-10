# 20 — Phase 9 Decisions (activity reporting)

Answers given by the founder while planning Phase 9 — rep-written reports, the
customer timeline, coverage and the daily activity view. Each one closes a
question no earlier document answered, and each was needed before the first
`/reports` screen could be written.

`09 §8` reserved three tables — `activities`, `rep_reports` and `tasks` — and
nothing has ever written any of them. This document is what finally makes the
second one writable, and it reshapes it: `09 §8.2` gives `rep_reports` a
polymorphic `record_type` / `record_id` pair, which cannot hold what §2 below
specifies, because one interaction anchors to a company **and** optionally a
contact **and** a project at the same time, and a polymorphic pair can only name
one.

**Status:** Sections 1–12 are **[founder]** — user truth. Section 13 is
**[derived]**: it is the implementation reading of §1–12, not a separate rule.

**Authority:** user truth, alongside `04`, `07`, `08 §A–C`, `11 §1–3`, `12`,
`14`, `15`, `16`, `17`, `18` and `19`. This is the latest statement — where it
corrects an earlier document, this wins.

---

## 1. Reporting makes customer knowledge company property **[founder]**

`04 B3` describes two reporting layers and `07 D6` decides what must be written,
but neither says what reporting is *for*. Without that, every later question —
who reads a report, what a manager's screen shows, whether a rep is penalised —
gets answered by whoever is nearest.

**Reporting exists so customer knowledge becomes company property rather than
personal property.** When a rep leaves, `19` moves the pipeline: the company
memberships, the projects, the quotation threads and the tasks all change hands.
The relationship history moves with none of it, because none of it is recorded.
That is the gap this phase closes, and **it is the only reason a rep is asked to
type anything at all.**

Every decision below is settled against that test. Where a rule would make
reporting feel like supervision rather than handover, it is rejected — a report
written to satisfy a manager is the noise `07 D6` already refused.

---

## 2. Two entry types — the interaction and the field note **[founder]**

`09 §8.2` gives `rep_reports` one shape: a rep picks a record and writes what
happened. It has no room for work that touched no customer, which reps do
constantly and which no document has ever let them record.

**An interaction is anchored to a company, and the company is required.** The
contact is optional and must belong to that company. The project is optional,
shown as **chips drawn from that company's active projects**, and
**pre-selected when there is exactly one**. It is **never a required field** —
most calls are about no project in particular.

**A field note has no company at all.** It carries a category — market research,
scouting, exhibition, training, internal — an optional city, and free text.
**It counts as activity and never touches a customer timeline.**

The alternative — forcing field work onto a nearest-guess company — was
rejected: it would put a scouting trip on a customer's permanent record, and
`19 §1`'s principle is that a record says what actually happened.

---

## 3. An interaction carries a channel, one outcome and free text — and "asked for a quotation" is not an outcome **[founder]**

`09 §8.2` names the columns as "kind (visit / call), narrative". Two values is
not the list.

**Channel**, one value: visit, call, WhatsApp, email, meeting.

**Free text is always present** and is never replaced by the structured fields.
The structured fields exist so the data aggregates; the text exists because most
of what a customer says does not fit a list.

**Outcome**, exactly one value: introduced, catalogue sent, samples sent,
documents sent, discussed pricing, no answer, not interested, on hold, other.

**"Asked for a quotation" is deliberately not an outcome.** Instead the form
offers a button that raises the real quotation request. `10 §1` fixes
qualification as derived — *"the system knows this from the event; nobody ticks a
box"* — and an outcome saying a customer asked for a quotation would be exactly
that box, a second and softer definition of qualified that no thread backs. A
company is qualified when a quotation thread exists, and nothing a rep types can
make it so.

**Consequence for the button.** A quotation is raised on a **project**, not a
company `[16]`, so the button carries the project when the interaction names
one, and otherwise opens the quotation form unfilled.

---

## 4. A signal is not an outcome **[founder]**

`07 C5` records a loss reason on a project, and `02 §1.4` remembers the founder
wanting free text beside a dropdown. Neither reaches a customer who says
something worth knowing on a deal that is still open.

**A signal is a separate, optional multi-select, distinct from the outcome.**
The outcome is what happened in the funnel; a signal is what the customer told
us that the business needs to know. Values: price too high, competitor cheaper,
colour or product not available, lead time too long, quality concern, payment
terms, specification we do not offer, project delayed, other.

**Signals carry an optional reference so they aggregate.** Competitor cheaper →
the competitor's name. Colour not available → the colour code. Specification we
do not offer → the class or fire rating. Other → free text.

**Signals are allowed on any report, not only losses.** A customer can say a
competitor is cheaper and still buy. Restricting them to lost projects would
lose the case that matters most — the one where the warning arrived early enough
to act on.

No aggregation screen is built in this phase. The reference column exists so the
question can be asked later without a migration; asking it is Phase 12's.

---

## 5. "On hold" suppresses follow-ups until a date the rep sets **[founder]**

`07 D5`'s thresholds chase a quiet customer automatically. A customer who has
said "come back after Ramadan" is not quiet, and chasing them is worse than
silence.

**The `on hold` outcome requires a date, and until that date passes the company
raises no follow-up.** The rep sets the date; nothing infers it.

**It is derived on read, never stored on the company.** The suppression is the
greatest `on_hold_until` among the company's reports that is not in the past —
so correcting the report corrects the suppression, with nothing to keep in step.
This is the same shape as the quotation expiry sweep and as §9's rule that a
report is one row.

---

## 6. One chronological timeline per company and per project, derived rather than stored, and readable in full **[founder]**

`01 §9.4` says the two reporting layers *"are not the same feed and should not be
merged into one"*. That is about how they are **recorded** — one is typed, one is
observed, and a typed row must never be presented as an observed fact. It is not
about what a rep may look at.

**One chronological view per company and per project**, merging rep-written
reports with the events FACET already records: company added, quotation issued,
payment confirmed, dispatched. **This is the rep's payoff for logging and must be
built, not deferred.** A rep who types into a form that gives nothing back stops
typing.

**The system half is derived on read from the source tables.** Nothing is
written. The consequence is the point: every company and quotation already in
the database has a full timeline immediately, with no backfill. **`activities`
therefore stays permanently empty**, exactly as `product_colours` does `[17 §2]`,
and `09 §8.1`'s "written by the system" is satisfied by deriving rather than
duplicating — which is what `04 C1`'s general rule asks for anyway: *if the
system can know it, do not ask, and do not store a second copy either.*

**The timeline must be readable in full.** A card showing the most recent
entries is right on a detail screen, but a cap alone breaks the one case this
phase exists for: a rep inheriting a company with years of history would read
twenty entries and nothing else. The card stays capped and says what it is not
showing; **a paginated full-history route sits behind it**, reachable from the
card header.

---

## 7. Compliance is coverage, not submission — and coverage is the rep's own tool **[founder]**

`07 D6` decided that a written report is required only for what the system
cannot see, that compliance appears on the manager's screen as a diagnostic, and
that a two-day grace applies with no automatic penalty.

**There is no daily report to submit, and therefore none to miss.** The
manager's screen answers **"which of this rep's companies have gone quiet"**, not
"who submitted yesterday". **This supersedes `07 D6`'s submission model and its
two-day grace**, both of which presuppose a thing to hand in.

Friday and Saturday are off for everyone, including outside Riyadh; Saturday
work is still recorded and never required. That part of `07 D6` stands, and
`04 C4`'s per-rep working days stay superseded.

**Consequence worth stating, because it removes work.** Since nothing is
submitted, nothing is late, and **no working-day arithmetic is needed anywhere in
this phase.** `01 §11` warned that report timeliness would need it. Timeliness
is gone.

**Coverage is not manager-only.** A rep sees coverage for their own companies;
`sees_all_reps` sees everyone's. It is a **scope, never a gate** — the same shape
as `visibleMeasuredUsersFilter`, and in this case simply
`visibleCompaniesFilter` reused.

The founder's reasoning, adopted as the rule: **the rep is the person who can
act on a quiet company.** Showing them the same screen the manager sees is the
clearest possible answer to what they get back for logging, and it removes the
last reading in which coverage is surveillance. A diagnostic only the supervisor
can see is a scoreboard; one both can see is a work queue.

Nothing is written and nothing is penalised.

---

## 8. The daily view shows real activity beside logged activity, attributed to whoever performed it **[founder]**

`07 D2` says target progress and activity level are shown side by side and never
combined into one score, and `10 §11` reserves `person_snapshots.activity_count`.
Neither says what a manager looks at on a Sunday morning.

**A daily activity view.** A date or date range, defaulting to yesterday. One
row per rep: reports logged, companies touched, system events, signals raised.
Expanding a rep shows the actual entries. A team total across all reps. Scoped by
`sees_all_reps`; a rep sees only their own row.

**It merges logged reports with the system events FACET already records, and
that is the whole point.** A view showing only logged reports becomes the
attendance check that §7's coverage exists to avoid, and **reps will write filler
to fill it**. Real activity shown beside logged activity is what keeps it honest:
a rep who logged nothing but confirmed two payments and pushed a dispatch out has
had a working day, and the screen must say so.

**It does not replace coverage.** Both exist and do different jobs: **daily is
the follow-up conversation, coverage is the leading indicator.**

**Field notes count toward a rep's logged-reports figure.** They are activity;
they simply belong to no customer.

### 8.1 Attribution — whoever performed it

The view counts system events per rep, and until now nothing said whose event
each one is. A quotation is raised by a rep and issued by the coordinator;
payment is ticked by the rep; a dispatch is recorded by the coordinator and
credits a different rep. Left unstated it gets guessed, and the number lands on
the wrong person.

**Every event is attributed to whoever performed it** — not to who was credited,
and not to who benefits. The source tables carry it: `created_by`,
`payment_confirmed_by_user_id`, the dispatch's `recorded_by_user_id`.

**The consequence, stated plainly: a rep's system-event count will look thinner
than expected**, because the coordinator performs much of the quotation chain.
That is correct, not a bug. The view shows who acted.

Two places where the columns the rule names do not answer it, recorded here
rather than resolved silently in code:

- **"Quotation raised" reads `quotation_versions.created_by` on version 1, not
  `quotation_threads.raised_by_user_id`.** `19 §1` rewrites the raiser on
  handover, so attributing to it would move a past act onto a person who did not
  perform it — precisely the failure this rule exists to prevent. Version
  authorship is what `19 §1` promises never to rewrite.
- **"Quotation issued" has no actor column and no timestamp of its own.**
  `quotation_versions` carries `status` and the SMAC reference and nothing else;
  there is no `issued_by` and no `issued_at`. It is read from the **audit log**,
  which `07 E1` already has the data layer write on every act, with both
  identities and the moment. No column is added: one would be null for every
  version already issued, which is the same backfill objection that made §6
  derive rather than store.

### 8.2 `audit_log` is never read directly for a user-facing view

This is the first time the audit log is read for a user-facing view at all, and
it holds **every action in the system with no visibility filter of its own**.

**Every audit-sourced event must join to the record it describes and apply that
record's existing filter.** For "quotation issued", the join to
`quotation_versions` and `quotation_threads` plus `visibleQuotationThreadsFilter`
is what gates it — **not the audit row**. An audit row is not access-controlled
and must never be the only thing standing between a viewer and an event.

Stated as a rule rather than left to the implementation, because the next
feature that wants an event with no dedicated column will reach for the same
table, and the join is the easy thing to drop.

---

## 9. A report is one row; editing corrects it **[founder]**

`07 E1` puts change history in the audit log, and `12 §7` keeps everything. Read
together they could be taken to mean a correction is a second row — which would
count twice.

**A report is one row. Editing corrects it, and counts read the current
outcome.** Editing must never double-count. A correction is an UPDATE, and the
audit log records the change.

**Only the author may edit, forever, with no time window.** A manager reads a
report but never rewrites someone else's words — the record has to stay a record
of what that person said happened.

**Every field is editable, including the anchor.** A report filed against the
wrong company is corrected, not abandoned. The alternative — freezing the anchor
and requiring a fresh report — was rejected: FACET does not delete, so the wrong
row would sit on a customer's timeline permanently with no route off it.

**Follow-up timers are computed on read, never fired and stored** — the same
pattern as the quotation expiry sweep, and the reason §5's suppression needs
nothing kept in step.

**Anything firing outward reads the day's settled state at end of day**, not the
moment of entry, so a correction made minutes later cannot produce a
notification that should not have been sent. Nothing fires in this phase —
notifications are Phase 10 — so this is recorded as a rule Phase 10 must honour.
What this phase does is make it possible: `report_date` is a calendar day rather
than an instant, and every derived timer is computed on read.

---

## 10. A report's visibility follows its anchor **[founder]**

`04 Q6` says activities are private to the rep *"without exception"*, restated in
`01 §4.1` and `09 §8.1`. `07 D6` then puts compliance on a manager's screen, and
§1 above makes the whole point of the phase that this knowledge stops being
personal. Those cannot all hold.

**A report's visibility follows its anchor, and `04 Q6` is superseded.**

- **A company-level report follows the company** — visible to whoever can
  already see that company, by active membership or an unrevoked share, and to
  `sees_all_reps`.
- **A report naming a project follows the project as well.** Both must be
  visible, not either. Without this a rep who has been shared a company would
  read a project name `04 Q7` forbids them — the one rule Slice 1 exists to get
  right.
- **A field note has no anchor, so it follows its author.**

This is one new predicate in `src/lib/authz.ts` composed from terms already
there, and none anywhere else.

**Two consequences, both intended.**

A rep removed from a company **loses sight of reports they wrote** — exactly as
they lose the company. That is §1 working: the history belonged to the company,
not to them.

**Handover needs no report bucket.** `19 §7` names four; a fifth is not added,
because visibility moves with the anchor the moment the membership does, and the
author column is never rewritten — `19 §1`'s "handover moves ownership, never
authorship" applied without change.

`07 B5` cuts the other way for a **merge**: when a duplicate company is resolved,
its reports move to the winner with everything else. That is Phase 10's and is
noted here so it is not mistaken for a contradiction.

---

## 11. The quiet thresholds are `settings` rows **[founder]**

`07 D5` gives five follow-up thresholds and calls them settings rather than
code; `09 §10.2` gives them a table. No row has ever been written.

**The two thresholds §7's coverage reads are seeded as `settings` rows**, with
`07 D5`'s defaults: a **qualified** company is quiet after **30 days** without an
interaction, an **unqualified** one after **60**. Qualification is derived from a
real quotation thread `[10 §1]`, never from an outcome `[§3]`.

Only those two are seeded. The other three chase quotations and catalogues,
which is Phase 10's work; seeding them now would leave three rows nothing reads,
which is the shape of `06`'s dead approval gate.

The seed inserts them if absent and **never overwrites an existing value** — the
whole reason they are data is that they will be changed. No screen edits them in
this phase.

---

## 12. The log form must be nearly free to use **[founder]**

`07 E4` names logging a visit as one of three things that must work properly on
a phone, and `07 G2` confirms both desktop and phone are supported targets.
Every form built so far has been desktop-shaped.

**The primary entry point is a Log button on the company page, opening
pre-filled. Three taps and a text box.** This one form is phone-first: reps log
visits standing in a lobby.

Everything in §2 and §3 is arranged to serve that — the company already known,
the project pre-selected when there is only one, the outcome a single choice, and
the free text always there for whatever the list does not hold. A form that
takes a minute in a lobby gets filled in. One that takes five gets filled in
later from memory, which `04 C1` calls a permanent guess.

---

## 13. Schema change required — migration 0005 **[derived]**

Unlike `16 §9`, `17 §5`, `18 §7` and `19 §7`, this document **does force a
migration**. `rep_reports` exists but cannot hold §2's shape.

**Five new enums:** `rep_report_entry_type` (interaction, field note);
`rep_report_channel` (visit, call, WhatsApp, email, meeting);
`rep_report_outcome` (the nine in §3); `field_note_category` (the five in §2);
`report_signal` (the nine in §4).

**`rep_reports` reshaped.** `record_type`, `record_id` and `kind` are dropped
with the `rep_report_kind` enum and the `rep_reports_record_idx`; nothing has
ever written the table, so no data moves. Added: `entry_type`, `company_id`,
`contact_id`, `project_id`, `channel`, `outcome`, `category`, `city_id`,
`on_hold_until`. `user_id`, `narrative`, `report_date` and `created_at` stay.

**Two CHECK constraints, per `13 §1`.** One fixes the shape of each entry type —
an interaction has a company, a channel and an outcome and no category; a field
note has a category and none of the others. The other requires `on_hold_until`
exactly when the outcome is `on_hold`, and forbids it otherwise. These are rules
about **what a row may contain in isolation**, which `13 §1` places in the
database. That the contact and project belong to the company is a **cross-table**
rule and stays in the data layer as a `RuleError`, exactly as
`dispatches.ts` handles a company not on a thread.

**One new table, `rep_report_signals`** — report, signal, optional reference —
unique on report and signal so one cannot be picked twice, and indexed on signal
so §4's aggregation needs no migration later.

Three readings this document settles, recorded so nobody re-derives them:

- **`activities` stays empty permanently** `[§6]`, and no `activity_types`
  lookup is created. The vocabulary `09 §8.1` left open is not needed, because
  the events are read from the tables that already hold them.
- **No new permission flag.** Coverage and the daily view are scoped, not gated
  `[§7, §8]`, and editing is an identity question, not a visibility one `[§9]`.
  `ViewableRecordType` gains no value: the authz module's own rule is to add a
  value and a real case together, and no write path takes a report id as a
  visibility question.
- **No handover bucket and no new share type** `[§10]`. `record_shares` could
  carry a report, but nothing writes such a row and no document asks for
  per-report sharing — wiring it on speculation is what produced v1's dead
  approval gate.

---

## 14. Still open after this document

- **Where signals are aggregated.** §4 stores the reference so the question can
  be asked; no screen asks it. Phase 12.
- **Whether a company's warmth should follow from its reports.** `10 §1` keeps
  warmth rep-set and derived stage separate on purpose, and an outcome of "not
  interested" is not a warmth change — but nothing says whether the rep should
  be prompted. Not built.
- **Whether a merge moves reports to the winning company** — `07 B5` says
  activities move, and §10 notes it. Phase 10 resolves it with the rest of
  duplicate handling.
- **The three follow-up thresholds not seeded** `[§11]` — quotation with no
  response, catalogue sent with no response, project stage unchanged. Phase 10.
- **Whether `on hold` should also suppress the daily view**, or only coverage.
  §5 answers only follow-ups; the daily view counts what happened and is not a
  chase, so it is left alone.
- **The performance formula** — `01 §13.2 #3` and `04 B3`. `07 D2` still forbids
  combining activity and target into one score, and this document adds no
  formula.
- Carried forward unchanged from `19 §8`: the last `can_manage_users` holder,
  promotion to primary on handover, revoking a departing user's shares, the long
  leave case, bulk import, password reset, the impersonation UI, and the `18 §8`
  and `17 §6` lists.
