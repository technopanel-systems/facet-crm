# FACET — Specification

The single source of truth for what FACET does. Present tense, no history, no
provenance, no reversals. Where this contradicts anything in `docs/`, this wins.
The 27 numbered documents move to `docs/archive/` — they explain how decisions
were reached, and are never cited as authority.

**Markers.** A rule with no marker describes the system as it works today.

- **[CHANGE]** — the code currently does something different. This is the target.
- **[BUILD]** — nothing exists yet.

Rules are numbered `S1`… and are cited by number, never by paraphrase.

---

## 1. What FACET is

**S1.** FACET is Technopanel's internal operations platform. Technopanel is a
Saudi supplier of cladding and aluminium composite panel (ACP).

**S2.** FACET is the system of record for **work**: who owns which relationship,
what stage things are at, what was promised, what actually moved.

**S3.** **SMAC** is the company's existing ERP and remains the system of record
for **money** — quotations, invoicing, finance, tax, stock accounting. FACET
never grows down into finance.

**S4.** FACET grows **sideways** into new departments. Production, warehouse and
stock monitoring are planned modules with their own roles, reading CRM data.
Nothing in this specification may block that.

**S5.** There is **no integration with SMAC**. Every link is a human retyping a
reference number, so FACET must assume that link can be wrong.

**S6.** Targets are measured in **square metres per month**, never currency.

---

## 2. The people

**S7.** A role is a **row of permission flags**, never a name in code. Adding a
role is configuration.

| Role | What makes them different |
|---|---|
| Sales Rep | owns companies, raises quotations, confirms payment |
| Desk Rep | works like a rep, never in the field, filters and passes on leads |
| Marketing | works like a rep, plus assigns companies to others |
| Sales Coordinator | issues quotations in SMAC, accepts them, records dispatches |
| Sales Manager | sees every rep, sets targets, shares records, manages users |
| Executive | the CEOs — sees everything, sets targets, no operational entry |
| Super Admin | everything, plus impersonation and system configuration |

**S8. [CHANGE]** Export, delete approval and duplicate resolution are held by
**Executive, Sales Manager and Super Admin**, and in practice the Sales Manager
uses them. All three flags must be read by the code; today none are.

**S9. [CHANGE]** Marketing assigns a company to a **rep, a desk rep, or the
coordinator**.

**S10.** No self-registration. A user exists because a `can_manage_users` holder
created them.

**S11. [BUILD]** **Super Admin can reset a password.** Accounts can be
deactivated and re-enabled.

---

## 3. Companies and contacts

**S12.** A company has **one name field**, written in English or
Arabic. Not two.

**S13.** **Phone is mandatory.**

**S14.** A company carries a **country**. Most are Saudi; some are not —
Egypt, Jordan, Syria and others.

**S15.** For a Saudi company, the **region is derived from the city** and shown
read-only. The rep is never asked for it.

**S16.** Company category is one of: factory, contractor, advertising, real
estate, owner, consultant, station management, workshop, personal, other.
**[BUILD]** Choosing **other requires a text field** saying what it is.

**S17.** Lead source is one of: field visit, direct contact, referral,
exhibition, marketing, other. **Marketing is not selectable by an ordinary rep**
— it means the lead came from the marketing team. A company that already carries
it keeps it when a rep edits.

**S18.** The rep who creates a company becomes its **primary rep**
automatically. The primary rep is always the first rep who had the company.

**S19.** A **contact has one name field**, English or Arabic.

**S20.** A contact has **no owner**. It is visible exactly when its company is,
and moves with the company on handover.

---

## 4. Duplicates

**S21. [BUILD]** A company is **always created**, even when it looks like a
duplicate. Nothing blocks the rep.

**S22. [BUILD]** A suspected duplicate raises a **flag to the Sales Manager**,
who resolves it three ways: **false duplicate** · **who continues** · **shared
between both reps**.

**S23. [BUILD]** **Phone is the primary matching key.** With one name field
(S12) and a mandatory phone (S13), cross-script name matching is no longer the
main problem it was designed to be.

---

## 5. Projects

**S24.** A project is a first-class record, not a child of a company. One
project can involve several companies.

**S25.** A company linked to a project is simply a **participant, and
therefore a potential buyer**. There is **no role label** — the free-text role
column is dropped.

**S26.** **At most one participant is the buyer**, and possibly none. The flag is
set when someone actually buys.

**S27.** A project keeps at least one participant. A participant can be removed;
it is hidden, not deleted, and can be re-linked.

**S28. [CHANGE]** A project's **state is never reported — it is derived** from
real events: quotation raised, issued, paid, dispatched.

**S29. [CHANGE]** The rep sets exactly **four things** on a project and nothing
else:

1. **Expected square metres** — the rep's estimate, the anchor number
2. **In production** — a plain label, deliberately unverified, never checked
   against the production module **[BUILD]**
3. **On hold until** — a date, which parks it
4. **Lost, with a reason** — which closes it

**S30.** A project is visible **only to its owner or someone explicitly shared on
it**. Seeing a company does not reveal its projects.

**S31.** A project is **won** when payment arrives **or** the project is approved
(اعتماد).

---

## 6. Reports and the timeline

**S32.** The main entry point is a **Log button on the company page**, opening
pre-filled. It is built for a phone: three taps and a text box.

**S33.** There are two kinds of entry. An **interaction** attaches to a company
and optionally names a contact and a project. A **field note** has no company at
all — market research, scouting, exhibition, training, internal. Field notes are
**rare**; roughly nine in ten entries attach to a company or project.

**S34. [CHANGE]** Channel is one of: **visit** (the rep goes to the customer),
**meeting** (the customer comes to us and is seen here), call, WhatsApp, email.

**S35.** An interaction carries **exactly one outcome**: introduced, catalogue
sent, samples sent, documents sent, technical submitting, discussed pricing, no
answer, not interested, on hold, other.

**S36.** **"Asked for a quotation" is not an outcome.** The form offers a button
that raises the real quotation instead. A company is qualified because a
quotation exists, never because someone ticked a box.

**S37.** Outcome **on hold requires a date**. Until it passes, that company
raises nothing.

**S38. [CHANGE]** A report has **two halves, with different visibility**:

| Half | Contents | Who sees it |
|---|---|---|
| **What happened** | channel, outcome, project, signals | whoever can see the record, including through a share |
| **The note** | free text | the author, and anyone who sees all reps |

A share never exposes another rep's notes.

**S39. [CHANGE]** A report can be **edited only on the day it was written**, and
only by its author. After that it stands. Editing corrects one row and never
double-counts.

**S40. [CHANGE]** A rep who leaves a company **keeps their own reports** as a
record of what they did.

**S41.** Every company and every project has a **timeline**, computed on read,
merging what reps wrote with what the system observed — company added, quotation
issued, payment confirmed, dispatched. Nothing is stored, so every record has a
full history with no backfill.

**S42. [CHANGE]** The timeline is also **what a manager reads as the daily
report**. There is no separate daily report to write or submit.

---

## 7. Signals and loss

**S43. [CHANGE]** **Signals and loss reasons are one vocabulary**, not two:
price too high · competitor cheaper · colour or product unavailable · stock
shortage · lead time too long · quality concern · payment terms · specification
we do not offer · project delayed, cancelled or postponed · customer went quiet ·
other (free text).

**S44.** A **signal** is that reason recorded while the deal is still alive — a
warning. A **loss reason** is the one that turned out to be decisive.

**S45.** Signals may be attached to any report, not only losses. Each can carry a
reference — the competitor's name, the colour code.

**S46. [BUILD]** When a rep closes something as lost, **the signals already
recorded are offered first**: *"you noted 'competitor cheaper' on 12 June — is
that why?"*

**S47. [BUILD]** **Loss cascades down, never up.**

- Losing a **project** closes every open quotation under it; they inherit the
  project's reason and are marked as closed by the project.
- Losing a **quotation** does not close its project.
- A quotation with **no project** carries its own reason.

**S48. [BUILD]** Loss reporting counts **each situation once**. A lost project
counts once, not once per quotation beneath it.

**S49. [BUILD]** Signals aggregate into a report management reads.

---

## 8. Quotations

**S50. [CHANGE]** A quotation may exist **with or without a project**. Reps
sometimes need to quote before a project exists.

**S51.** A quotation always names a **company**.

**S52.** Raising creates a **thread** with **version 1**, status `requested`, no
SMAC number.

**S53. [CHANGE]** A product line carries supplier, class, fire rating, colour,
thickness, width, length and number of pieces, **displayed as ordinary readable
fields**. FACET does not reproduce SMAC's code format — optimise for fast, clear
entry.

**S54.** **Colour is typed free text** — a normal code or a RAL/Pantone special.
A colour is required.

**S55.** **Square metres are always computed**: pieces × width × length. Never
typed.

**S56.** **Unit price is per square metre.** Line total = unit price × square
metres.

**S57. [CHANGE]** **VAT is fixed at 15% and is never editable.**

**S58.** A line with no price contributes nothing and the screen says so, rather
than showing a total quietly missing a line.

**S59.** **Service lines** — CNC, cutting, bending, notching — are priced per
square metre, and their square metres are **excluded from the quotation's total
sqm**. Targets measure cladding, not fabrication.

**S60.** A quotation always keeps **at least one product line**.

**S61.** Lines are editable only while the live version is `requested` and the
thread is open.

**S62.** **Only the coordinator** may issue, return, accept, reject or cancel.
Returning or cancelling requires a written reason, which becomes a comment on the
thread.

**S63.** The coordinator creates the real quotation in SMAC and types the SMAC
number back into FACET. Status becomes `issued`.

**S64.** The physical signature is the approval, including price approval. There
is no separate price-approval field.

**S65.** **"Accepted" means the coordinator has the signatures — internal
approval only.** It never means the customer bought. No count, funnel or
conversion figure may treat it as won.

**S66.** A **revision** creates the next version carrying an RE number, and
supersedes the previous one.

**S67. [CHANGE]** **Validity is a note, not a gate.** An expired quotation is
shown as expired and **stops nothing**. Availability depends on the rep, the
company and the situation, so no rule is built on it.

**S68.** **Quotations are never summed.** One project quoted three times at
2,000 m² is the same 2,000 counted three times, not 6,000. Quoted means the
latest live version of one thread.

**S69.** The project shows when it has more than one open quotation.

---

## 9. Credit terms

**S70. [BUILD]** A **rep requests** that a company be treated as a credit
customer. **The manager approves it.** Credit is a property of the company, never
a per-dispatch tick.

**S71.** Fewer than 5% of companies are credit customers.

---

## 10. Dispatch

**S72.** The **coordinator** records what was actually dispatched. This is the
only event that credits a target.

**S73. [CHANGE]** A dispatch against a quotation is **blocked until payment is
confirmed — unless the company is an approved credit customer**, in which case it
proceeds and is flagged as a credit dispatch.

**S74. [BUILD]** **The project is chosen at dispatch.** If the linked quotation
has no project, the project selected here is **written back onto the quotation**,
and the quotation's company is added to that project as a participant if it is
not already one.

**S75.** A dispatch with **no quotation and no project** is a company simply
buying — from stock or similar. It names its own company and rep and is marked as
a direct dispatch.

**S76. [CHANGE]** The coordinator **sees projects and contacts**, because both
are part of the dispatch. The name-only restriction is removed.

**S77.** One quotation produces **any number of dispatches** — one, two, more.
The quotation and the project are linked; quantities are never reconciled against
each other.

---

## 11. Credit and targets

**S78.** By default, **100% of a dispatch credits the rep named on it**. Not the
project owner — reassigning a project must never move credit for a dispatch that
already happened.

**S79. [CHANGE]** **Shared credit is recorded on the quotation**, not the
project. It is rare.

**S80. [BUILD]** When a dispatch is linked to a quotation carrying more than one
rep, **the coordinator is prompted before dispatching** to confirm whether one
rep or both are credited.

**S81. [CHANGE]** A split divides **equally**. Nobody types a percentage. Splits
across three or more reps are so rare they may never occur, so no remainder-
distribution machinery is built.

**S82.** A rep can never set their own split.

**S83.** **Targets are square metres per month**, optional per person, and
independent of role.

**S84.** A target is a **dated row**. Correcting it adds a superseding row rather
than overwriting, so history stays visible.

**S85.** **Achievement is derived entirely from dispatches.** No rep ever types
how much they did.

---

## 12. The waiting list — the core loop

This replaces coverage, the follow-up queue, the notification bell and the
dashboard. It is one idea, and it is the heart of the system.

**S86.** Every company, project and quotation is in exactly one of three states:
**moving**, **waiting on a named person**, or **closed with a reason**. No other
state is legal.

**S87. [BUILD]** Each person has **one list of what is waiting on them**, oldest
first. That list is the dashboard, the follow-up queue and the notification
inbox.

**S88. [BUILD]** A manager sees **the same list across their team, grouped by
rep**. One screen, two scopes. There is no separate coverage screen and no
separate activity screen.

**S89. [BUILD]** Something joins the list when a company has had no contact for
too long, a project has not moved, a quotation is sitting with someone, or a
record was assigned or shared and has not been touched.

**S90. [BUILD]** Something leaves the list exactly three ways:

1. **Moved** — an interaction was logged, or the chain advanced
2. **Parked** — on hold until a date the rep set
3. **Closed** — lost, with a reason

**S91. [CHANGE]** **The list is the notification.** There are no notification
tiers, no persistence flags, no per-anchor resolution conditions and no daily
digest. If it is on the list it is waiting; if not, it is not.

**S92. [CHANGE]** A **bell** carries news only, never work: *a rep was handed to
you*, *you have been shared a record*. A handover raises one summary, not one
per record.

**S93.** **Friday and Saturday are the weekend for everyone.** Saturday work is
recorded and never required.

**S94. [BUILD]** A **holiday calendar** exists. When Eid or a national holiday is
announced it is entered as a date range and skipped.

**S95.** Logging is how a rep clears their own queue. That is what they get back
for typing.

---

## 13. Sharing, handover and archiving

**S96.** **Sharing is manager-initiated and lives only in the manager's view.** A
rep never sees a share request and never raises one in the app. Reps ask by
phone.

**S97. [BUILD]** Sharing is **per company, then per project**. The manager picks
the company, then chooses which of its projects are included. Some projects are
sensitive; a company may be worked by several reps on only some of its projects.

**S98. [CHANGE]** **Contacts are shareable.**

**S99.** A share grants **edit access**, not read-only. The point is that both
people work the record.

**S100.** **Assignment hands a record over** — the sender stops holding it. **A
share grants access to a record someone else still holds**, and is revocable.

**S101.** Deactivating a user **kills their sessions immediately**, before any
handover review begins.

**S102.** A user cannot deactivate their own account.

**S103.** The handover screen opens only after deactivation, and moves company
memberships, projects and quotation threads. It rewrites who **owns** a thread and
never who **performed** an act. Past dispatches, payment confirmations, version
authorship and credit never move.

**S104. [BUILD]** After a handover, **the previous rep's name stays visible** on
their work, so nobody mistakes it for the new rep's.

**S105. [BUILD]** A rep who judges a customer has no potential **requests its
removal, with a reason**. The manager reviews and decides: **archive** · **keep**
· **reassign**.

**S106. [BUILD]** That is the same review, the same three outcomes and the same
record as a company going quiet. The only difference is what raises it — the
clock, or the rep's judgement. One table, one screen, one manager decision, two
ways in.

**S107.** **Nothing is ever deleted.** "Removed" means archived: if that customer
resurfaces in two years, the record says they were already known and why someone
gave up on them. Archiving is gated by the delete-approval flag (S8).

---

## 14. System-wide rules

**S108.** **If the system can know it, do not ask a human.** Derive from real
events; only ask for what genuinely lives in someone's head.

**S109.** **One authorization layer, in application code, in one place.** Not
database policies. Data-integrity rules — what a row may contain — belong in the
database.

**S110.** **Targets, shares and splits are dated rows, never mutable fields.**
Changing one must never rewrite history.

**S111.** **Accounts deactivate, never delete.** History must keep pointing at a
real person.

**S112.** Every mutation writes to an **audit log**, written by the data layer
rather than by each feature. An audit row is never shown to a user without
joining back to the real record and applying its visibility.

**S113.** **Every user-facing string goes through the translation layer** (EN +
AR), and layout uses logical utilities so RTL works.

**S114.** **Comments exist on quotation threads and projects only.** Not on
companies, contacts or dispatches — the timeline already carries those. An unread
comment appears on the waiting list, so it cannot be missed.

**S115.** **File attachments are Super Admin only** — a logo or general image.
Rep file uploads are a possible later addition.

---

## 15. The work this implies

Ordered by what unblocks what.

**Blocking anything else**

1. Fix the Docker build — the app does not currently build in its own container,
   so it cannot be deployed
2. Bulk import — fourteen people cannot hand-type the existing customer base

**The model changes**

3. One name field on companies and contacts; phone mandatory; country added
4. Drop project role labels
5. Quotation project becomes optional; write-back at dispatch
6. VAT fixed; validity becomes a note; readable product fields
7. Report split into shared half and private note; same-day edit
8. Signals and loss reasons unified; loss cascade
9. Coordinator sees projects and contacts

**The big rebuild**

10. The waiting list — replacing coverage, follow-ups, notifications and the
    dashboard. This is a large deletion as much as a build

**Then**

11. Duplicate detection and manager resolution
12. Credit terms request and approval
13. Sharing per project; contacts shareable
14. Archive requests folded into the dormancy review
15. Password reset; holiday calendar; signal aggregation; the three dead flags

**Dropped outright**

- `accounts`, `verificationTokens` — Auth.js leftovers, credentials-only login
- `pipeline_snapshots`, `person_snapshots` — the dashboard rebuild decides what
  history it needs rather than inheriting a guess
- `project_companies.role` — S25
- Notification tiers, persistence flags, per-anchor resolution, digest
  machinery — S91

---

## 16. Open

- **The quiet thresholds.** Start at 30 days qualified, 60 unqualified, stored in settings and editable by a manager rather than hardcoded. Revisit once there are three months of real data.
- **Product specifications.** The standards-and-alloy block was designed to print
  onto quotations, but SMAC prints the quotation. Needed at all?
- **The performance formula.** Activity and target are shown side by side and
  never combined into one score. Nothing scores a rep.
- **Whether an unlinked quotation should ever be forced to gain a project**
  before dispatch, or whether S74's write-back is always enough.
- **Project names.** Companies and contacts have one name field (S12, S19).
  Projects still have two, and no rule says why. Same reasoning appears to
  apply. Decide before the projects slice.