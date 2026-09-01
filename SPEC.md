# FACET — Specification

The single source of truth for what FACET does. Present tense, no history, no
provenance, no reversals. Where this contradicts anything in `docs/`, this wins.
The 27 numbered documents move to `docs/archive/` — they explain how decisions
were reached, and are never cited as authority.

**Markers.** A rule with no marker describes the system as it works today.

- **[CHANGE]** — the code currently does something different. This is the target.
- **[BUILD]** — nothing exists yet.

**A marker is one bit and a rule can be three quarters done** (`WORKFLOW §7`).
It says *whether* work remains, never how much; where only part of a rule is
built, **the rule's own text says which half**. So a marked rule may already
ship most of itself, and a marker is never a claim that nothing works.

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
| Sales Coordinator | issues quotations in SMAC, accepts them, approves dispatch requests |
| Sales Manager | sees every rep, sets targets, shares records, manages users |
| Executive | the CEOs — sees everything, sets targets, no operational entry |
| Super Admin | everything, plus impersonation and system configuration |

**S8. [CHANGE]** **Export is held by Super Admin alone** — customer data
leaving FACET is a super-admin act; a manager or CEO who needs a file asks and
it is handed over, and widening it later is one seed line if the pilot shows
the need (decided session 50 — narrower than both this rule's old text and the
seed). **Delete approval and duplicate resolution are held by Executive, Sales
Manager and Super Admin** — the founder's words: *"start with the person whose
job it is; if the pilot shows he's not keeping up, or the decisions look
wrong, it moves."* All three flags must be read by the code; today none are.

**S9.** Marketing assigns a company to a **rep, a desk rep, marketing, or the
coordinator**. **Marketing holds companies exactly as a rep does, and assigns
them as well** — taking calls and passing leads on is work added on top of a
rep's, not a different job, which is why marketing and the desk rep carry the
same permission flags.

**S10.** No self-registration. A user exists because a `can_manage_users` holder
created them.

**S11. [BUILD]** **Super Admin can reset a password.** Accounts can be
deactivated and re-enabled. Deactivate and re-enable are built; the reset is not.

---

## 3. Companies and contacts

**S12.** A company has **one name field**, written in English or
Arabic. Not two.

**S13.** **Phone is mandatory.**

**S14.** A company carries a **country**. Most are Saudi; some are not —
Egypt, Jordan, Syria and others.

**S15.** For a Saudi company, the **region is derived from the city** and shown
read-only. The rep is never asked for it. **The city is mandatory for a Saudi
company** — a derived value with no source is worse than a typed one. A company
outside Saudi Arabia has neither.

**S16.** Company category is one of: factory, contractor, advertising, real
estate, owner, consultant, station management, workshop, personal, other.
**[BUILD]** Choosing **other requires a text field** saying what it is.

**S17.** Lead source is one of: field visit, direct contact, referral,
exhibition, marketing, other. **Marketing is not selectable by an ordinary rep**
— it means the lead came from the marketing team. A company that already carries
it keeps it when a rep edits.

**S18.** The rep who creates a company becomes its **primary rep**
automatically. **Primacy follows the company, not its finder**: it moves to the
recipient on handover `S103` and on dormancy reassignment, so the primary rep
is whoever holds the company now. A company with a rep on it has **exactly one**
primary rep — none is as wrong as two. Who *found* the company is `created_by`
`S123`, and that never moves.

**S19.** A **contact has one name field**, English or Arabic.

**S20.** A contact has **no owner**. It is visible exactly when its company is,
and moves with the company on handover. The coordinator is the one exception,
per **S76** — they see every contact without seeing its company, because a
dispatch names a contact. A dispatch does not carry a contact today; the reason
is S76's, and S76 carries its own marker.

---

## 4. Duplicates

**S21.** A company is **always created**, even when it looks like a duplicate.
Nothing blocks the rep. True today, because nothing flags a duplicate at all
(S22).

**S22. [BUILD]** A suspected duplicate raises a **flag to the Sales Manager**,
who resolves it three ways: **false duplicate** · **who continues** · **shared
between both reps**. **Shared means access to the customer, never ownership of
the deals** (the founder's correction, session 50): both reps hold the
company, and each keeps his own projects and his own quotations with it — S30
already keeps a project its owner's, and a dispatch still credits the rep
whose project and quotation it came from (S78), split only by the credit-split
rule itself (S80), never by the sharing.

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

**S26.** **Who bought is derived from dispatches, never flagged.** A
dispatch names its company, so a project's buyers are the companies that have
dispatched against it. No participant is marked as the buyer by hand, and two
participants may both have bought. A project shows its dispatched square metres
per participant.

**A project has one name field**, written in English or Arabic — the shape S12
gives a company and S19 a contact. It carried two until now, and no rule ever
asked for the pair: §16 recorded that as an open question and could cite nothing
to amend, which is why the answer lands here rather than on a rule of its own.
Only one of the two was ever searchable, so a project named in Arabic could not
be found by its Arabic name; one field ends that as a side effect rather than as
a fix.

**S27.** A project keeps at least one participant. A participant can be removed;
it is hidden, not deleted, and can be re-linked.

**S28.** A project's **state is never reported — it is derived** from
real events: quotation raised, issued, accepted, dispatched. **S29** lists what
the rep sets on top of that; of those, **committed** is the only one a
conversion figure could mistake for won, and it never is (S31). One precedence
answers what a project's state is — won, lost, committed, open — and every
screen reads it rather than ranking the fields itself.

**S29. [CHANGE]** The rep sets exactly **five things** on a project and nothing
else:

1. **Expected square metres** — the rep's estimate, the anchor number
2. **In production** — a plain label, deliberately unverified, never checked
   against the production module
3. **On hold until** — a date, which parks it

4. **Lost, with a reason** — which closes it
5. **Committed** — the customer has agreed, ahead of any dispatch (S31)

Four of the five ship. **On hold until is the one that does not** — a project
carries no such column, and the only `on_hold_until` in the system belongs to a
report (S37), which parks a company rather than a project.

**S30.** A project is visible **only to its owner or someone explicitly shared on
it**. Seeing a company does not reveal its projects.

**S31.** A project is **won when a dispatch against it is approved**.
That is a real event and cannot be manufactured. Before that, a rep may mark a
project **committed** — the customer has agreed, verbally or otherwise. That is
the rep's own judgement, and no conversion figure treats it as won. **S65** is
unchanged: an accepted quotation is an internal signature and is neither.
Cancelling an approved dispatch **un-wins the project and takes back the
credit**. A cancelled dispatch never happened, whatever stage it reached — the
alternative is a rule about when stock physically moved, which FACET cannot
know. The cancelled dispatch stays visible on its record with its reason —
nothing is ever deleted (S107) — and its difference flag stays with it, but
**it is excluded from every figure**, including the quoted-versus-dispatched
comparison (S77). Visible as history, counted nowhere.
The Arabic term for the customer's commitment is **ملتزم**, from التزام, which
is the word the accept hint already uses to say what an internal accept is not.
It does not reuse اعتماد, which labels the coordinator's accept.

Won is derived at read time from the same approved-dispatch predicate that
credits a target (S72) and is **stored nowhere**. That is what makes
cancellation one act rather than two: a dispatch leaving `approved` un-wins the
project and de-credits the month together, with no second writer to keep in
step and nothing that could disagree with the dispatches it summarises. The
column that used to claim a win by hand is gone from the vocabulary entirely —
no route can set it. Committed is the rep's own flag, set and cleared by them,
and is ranked below won and lost wherever a state is printed.

**S132.** **A project sits in exactly one of six positions on the
quotation chain, each derived from a real event.** In order:

1. **No price yet** — no live quotation thread. Not the same as *no thread
   ever*: a project whose every quotation was rejected or cancelled sits here,
   because nobody has given up on it and the next move is the rep's, to quote
   again.
2. **Requested** — the live version is `requested`. The coordinator owes it: she
   builds the real quotation in SMAC (S63).
3. **Quoted** — the live version is `issued` and the thread is not accepted. The
   price exists. This is **not** the customer signing: the signature is internal
   management approval (S64, S65) and is effectively instant, so the position
   means *a price has been produced*, never *someone is waiting to sign*.
4. **With the customer** — the thread is `accepted`. Internal approval is in and
   the customer is deciding. **This is the long wait** — days to months — and no
   position named it before.
5. **Ready to ship** — a dispatch against the project is `submitted`. The
   coordinator is checking it (S72, S88). A `draft` request is not here: it is
   still the rep's own to edit (S125) and can sit indefinitely.
6. **Won** — a dispatch against the project is approved. This is S31's own
   predicate read at the same place, never a second one beside it.

**Furthest along wins.** A project may carry several threads; it has one
position, and it is the furthest any of them reached. A closed thread is not one
of them.

**What *With the customer* waits on is stated, not inferred.** It waits on
somebody who is not a FACET user. Whose move it is answers **the rep** — chasing
the customer is his job. It is **not a fourth S86 state**: S86's three are
moving, waiting on a named person, and closed with a reason, and this is the
second. Left unwritten, the next reader decides a fourth state exists, which is
how the silence derivation came to give two screens two answers.

**S133.** **Payment is not a position on the chain.** S70 records
payment on the dispatch and S73 makes a method a condition of approving one, so
**no interval exists between paid and dispatched** for a position to occupy.

The `paid` rung is removed, and **the mechanism behind it leaves in the same
slice**: confirming payment on a quotation, marking one accepted for processing,
and the three columns those two acts write. Each is a leftover of the gate S73
replaced, and none is cited by a rule still standing.

**Nothing replaces the two follow-up suppressors.** They read the confirmed
payment to stop chasing a quotation that was already moving, and measured before
the deletion the term removed **no rows at all**: every paid thread also carried
`accepted`, which the end-state term beside it already dropped. So the two come
out with the column and the behaviour is unchanged, which is what makes the
deletion clean. Whether a *submitted dispatch* should stop a chase is a
different question, and a new rule rather than a replacement; it is measured and
recorded in WORKFLOW §5, to be decided on its own.

**S134.** **A project's position is never set by hand.** No act moves a card,
and none is added. Where a project's real events jump a position — no quotation
one week, won the next, because the rep skipped a step — **the board shows the
jump**. A lazy process is meant to be visible, not smoothed into a tidy pile
somebody filled in by hand. This is S108 applied to the board: the system knows
where a project is, so it is not asked.

**OPEN — not chosen: how a rep explains a genuinely odd case.** A note is the
intent — a note explains, where an override would only move the card and lose
the reason. Where that note lives is undecided, and deliberately so. A project
carries no note today; its comments would serve, except that **S76 puts every
project on the coordinator's board while S131 keeps her out of its
conversation**, so a note on a card would either disclose to her or render blank
for her alone. That is a disclosure decision, not a rendering detail, and it is
not made in passing.

---

## 6. Reports and the timeline

**S32.** The main entry point is a **Log button on the company page**, opening
pre-filled. It is built for a phone: three taps and a text box.

**S33.** There are two kinds of entry. An **interaction** attaches to a company
and optionally names a contact and a project. A **field note** has no company at
all — market research, scouting, exhibition, training, internal. Field notes are
**rare**; roughly nine in ten entries attach to a company or project.

**S34.** Channel is one of: **visit** (the rep goes to the customer),
**meeting** (the customer comes to us and is seen here), call, WhatsApp, email.

**S35.** An interaction carries **exactly one outcome**: introduced, catalogue
sent, samples sent, documents sent, technical submitting, discussed pricing, no
answer, not interested, on hold, other.

**S36.** **"Asked for a quotation" is not an outcome.** The form offers a button
that raises the real quotation instead. A company is qualified because a
quotation exists, never because someone ticked a box.

**S37.** Outcome **on hold requires a date**. Until it passes, that company
raises nothing.

**S135.** *Deleted, session 50, by founder decision — together with `D71`.*
The outcome marks on cards (catalogue sent · samples sent · documents sent ·
technical submitting) are not wanted; if the overseer-dashboard conversation
(§16) later shows the gap, they return as a new rule. The reasoning about
which outcomes could never be marks survives in git history and
`docs/archive/28-fixation/`. The number is kept and never reused.

**S38.** A report has **two halves, with different visibility**:

| Half | Contents | Who sees it |
|---|---|---|
| **What happened** | channel, outcome, project, signals | whoever can see the record, including through a share |
| **The note** | free text | the author, and anyone who sees all reps |

A share never exposes another rep's notes.

**S39.** A report can be **edited only on the day it was written**, and
only by its author. After that it stands. Editing corrects one row and never
double-counts.

**S40.** A rep who leaves a company **keeps their own reports** as a
record of what they did.

**S41.** Every company and every project has a **timeline**, computed on read,
merging what reps wrote with what the system observed — company added, quotation
issued, payment confirmed, dispatched. Nothing is stored, so every record has a
full history with no backfill.

**S42.** The timeline is also **what a manager reads as the daily report**.
There is no separate daily report to write or submit. `/activity` is that
stream (S41, D45): a manager reads it by rep, and a person who did nothing
still has a row, which is the first thing the day is opened to find out.

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

**S48. [BUILD]** Loss reporting counts **each situation once**. A lost project
counts once, not once per quotation beneath it.

**S49. [BUILD]** Signals aggregate into a report management reads.

---

## 8. Quotations

**S50.** A quotation **always names a project**. Every sale is on the
board (D29), and a sale with no project cannot appear on it.

Raising asks for the company first. The rep then attaches the quotation to one
of that company's projects **he can already see** — S30 is unchanged, so a
project belonging to another rep is not offered — or **creates one as part of
raising**, pre-named from what he has already typed. **The default is the new
project.** Two projects that should have been one can be merged; one project
holding four unrelated jobs cannot be pulled apart.

**There is no free-text fallback and no "no project" option.** A description
typed into a box is faster than creating a project, so it becomes the lazy path,
and it produces a record nothing can quote against, count, or put in a column.

The code permitted the null until migration `0031` and refused it one step
later: a project-less quotation could not be dispatched at all (S74). The
refusal now happens at the moment the gap is cheap to close, and the window is
zero — `quotation_threads.project_id` is NOT NULL.

**S51.** A quotation always names a **company**.

**S52.** Raising creates a **thread** with **version 1**, status `requested`, no
SMAC number.

**S53.** A product line carries supplier, class, fire rating, colour,
thickness, width, length and number of pieces, **displayed as ordinary readable
fields**. FACET does not reproduce SMAC's code format — optimise for fast, clear
entry.

**S54.** **Colour is typed free text** — a normal code or a RAL/Pantone special.
A colour is required.

**S55.** **Square metres are always computed**: pieces × width × length. Never
typed.

**S56.** **Unit price is per square metre.** Line total = unit price × square
metres.

**S57.** **VAT is fixed at 15% and is never editable.**

**S58.** A line with no price contributes nothing and the screen says so, rather
than showing a total quietly missing a line.

**S59.** **Service lines** — CNC, cutting, bending, notching — are priced per
square metre, and their square metres are **excluded from the quotation's total
sqm**. Targets measure cladding, not fabrication.

**S60.** A quotation always keeps **at least one product line**.

**S61.** Lines are editable only while the live version is `requested` and the
thread is open.

**S62. [CHANGE]** Only the coordinator may **issue, return, accept, reject or
cancel** a quotation, and only she may **edit a submitted dispatch request**
(S125) or **park a dispatch request** (S90). Returning, rejecting or cancelling
requires a written reason, which becomes a comment on the thread. Everything but
parking ships today — coordinator-only issue, return, accept, reject and
cancel, the written reason becoming a comment, and **editing a submitted
dispatch request**. **Parking one (S90) does not.**

**S63.** The coordinator creates the real quotation in SMAC and types the SMAC
number back into FACET. Status becomes `issued`.

**S64.** The physical signature is the approval, including price approval. There
is no separate price-approval field.

**S65.** **"Accepted" means the coordinator has the signatures — internal
approval only.** It never means the customer bought. No count, funnel or
conversion figure may treat it as won.

**S66.** A **revision** creates the next version carrying an RE number, and
supersedes the previous one.

**S67.** **Validity and delivery period are SMAC's, not FACET's.**
FACET does not carry a validity date, does not compute expiry, and does not show
a delivery period.

**S68.** **Quotations are never summed.** One project quoted three times at
2,000 m² is the same 2,000 counted three times, not 6,000. Quoted means the
latest live version of one thread.

**S69.** The project shows when it has more than one open quotation.

---

## 9. Payment

**S70.** **Payment is recorded on the dispatch, not on the
quotation.** The coordinator records how the customer is paying, because she is
the one who confirms it with finance.

**S71.** The payment method is one of: **on delivery** · **in the office
by card** · **cash in the office** · **bank transfer, full** · **bank transfer,
downpayment** · **handled by finance** — credit, تساهيل, or a company contract,
settled in SMAC, where FACET carries the reference only. An optional note
carries anything the list does not.

---

## 10. Dispatch

**S72.** **A rep requests a dispatch; the coordinator checks it and
approves it.** She is the one who deals with SMAC and with finance. An approved
dispatch is the only event that credits a target — not the request, and not the
SMAC number that follows.

**S73.** A dispatch cannot be approved without a payment method. The
coordinator records the method as part of approving, and no route to `approved`
bypasses it — the request form never asks, the database refuses a row without
one, and that is true of a free entry as much as of one raised from a quotation.

**Approval is final.** If something is wrong afterwards — finance refuses, the
customer changes — the dispatch is **cancelled**, never un-approved. **The
coordinator cancels**, the same person who approves and refuses (S72, S124);
she is the one who deals with SMAC and with finance, and a cancellation is one
of them changing their mind. A cancelled dispatch stays visible on the record it
belonged to, carries a reason, and is **never revived**: a new dispatch is
raised instead. It keeps everything approval gave it — the stamps, the payment
method, the SMAC number and its difference flag (S120) — and it credits nothing
and wins nothing (S31). The reason reaches the rep and anyone whose credit it
takes back (S128).

**S74.** **The project is recorded on the dispatch itself**, and it is
always the quotation's own. A dispatch raised from a quotation takes that
quotation's project, shown and never chosen; a dispatch that names a different
one is refused rather than silently corrected. A **free entry** names none
(S75), because it has no quotation to have taken one from.

**The write-back is gone.** It existed only because a quotation might have no
project. Since S50 every quotation has one before it is ever dispatched, so
there was nothing to write back and no participant to add — the picker at
dispatch, the `projectRequired` refusal and the approval-time update came out
together with the null case, in one slice.

**S75. [BUILD]** A dispatch is raised one of three ways: **exactly as a
quotation** · **from a quotation, with edits** · **as a free entry with no
quotation at all**. The second is the normal case after negotiation. **A
dispatch that names a project wins it on approval (S31); one that names none
wins nothing**, which is why the project is asked for even when it is not
refused. A **free-entry dispatch may name a project** — the rep is asked, and
may leave it empty. Where it names one, approving it wins that project (S31);
where it does not, it wins nothing. All three routes exist today: a dispatch
raised from a quotation arrives with its lines and is kept or edited (S116),
and a free entry types them. The approval act exists too (S72), and **so does
winning on approval** (S31). What does not is **the asking**: the free-entry
route offers no project at all — no control, no options loaded, and the column
written null — so a free entry can only ever be the empty case, and the half
of this rule that lets a rep name one has nothing behind it yet.



**S76. [CHANGE]** The coordinator **sees projects and contacts**, because both
are part of the dispatch. The name-only restriction is removed. This is a
role-level exception to **S30**, which is unchanged: a project is still visible
only to its owner or someone explicitly shared on it, and seeing a company still
reveals none of its projects. The coordinator sees them; she may not edit **a
project or contact she does not own** — she holds companies like any rep (S9,
S127), and her own records are her own to edit, which is what the code has
always done and this sentence had not said. Her edit right under **S62**
reaches a submitted dispatch request's own fields — lines, stock, shipment,
payment — and never the project or contact records it names.

**S77.** One quotation produces **any number of dispatches**. What was quoted
and what was actually dispatched are **deliberately compared** — the gap is the
point, not drift to be prevented. The comparison is **S120**'s, and it is drawn
on the dispatch itself as three figures: what that version quoted, what has been
**approved** against it so far, and what this dispatch carries. Three rather
than two, because one quotation produces several dispatches and a partial one
measured alone against the version's total would read as a deviation nobody
made.

**S116.** **A dispatch carries its own lines**, the same shape as a
quotation's product lines — product, thickness, colour, dimensions, pieces and
price — but never service lines. Any line may differ from the quotation's,
including price, and a dispatch may add a product the quotation never had. The
invoice is made from these lines. A dispatch raised from a quotation arrives
**pre-filled with its lines**; the rep keeps them or edits them. **Every line
carries a price**; nothing is dispatched free. A quotation line with no price
(S58) arrives unpriced and **the rep prices it before submitting**. A dispatch
request with an unpriced line cannot be submitted — and cannot be saved
either, because a dispatch line's price is not nullable, so the refusal lands
before the rule has to. A dispatch's square metres are the sum of its lines
rather than a figure anybody types.

**S117. [BUILD]** FACET **mirrors** the dispatch's money for comparison. SMAC
issues the invoice and remains the system of record; a disagreement is SMAC's to
settle. The figures are shown to the rep, the coordinator and the manager,
**below square metres in prominence** — square metres are what a rep is
measured on (S83, S85). VAT is 15%, as S57.

**The line money ships; the dispatch's own total does not.** Every dispatch line
carries a unit price, a line total and a VAT amount, none of them nullable and
all three at S57's rate, and the dispatch screen shows all three to the rep, the
coordinator and the manager, below square metres. What does not exist is the
figure over the dispatch: it names no total excluding VAT, no VAT total and no
grand total the way a quotation version does, and nothing sums the lines into
one.

**S118.** A quotation is drawn from **one stock**: Riyadh, Malham, South or
Dammam. The stock is on the quotation because SMAC's inventory needs it — FACET
holds no inventory, only the name. The rep chooses it when raising, from a fixed
list.

**S119.** Shipment is one of: **CT** (customer's own truck) · **TT**
(Technopanel truck) · **Cargo** (third party). Only Riyadh and Malham stock have
trucks, so a dispatch from **South or Dammam stock is CT**. Malham has fewer
trucks than Riyadh; TT is discouraged there, never refused. Cargo carries a
destination note. The rep chooses the shipment method when requesting. A Cargo
destination note is optional. **That TT is discouraged at Malham is the
coordinator's knowledge, not a rule FACET enforces.**

**S120.** **A dispatch that differs from its quotation is flagged**, and the
flag is visible to the rep, the coordinator and the manager. **Nobody is
notified.** **Any difference flags it** — a colour swapped at the same price and
quantity counts, and so does pricing a line the quotation left unpriced (S58),
because in money terms a line that was never priced was never quoted. The flag
is **permanent**: it survives approval and is kept for later analysis, because
the gap between quoted and dispatched is the thing being measured (S77). **The
flag records who made each difference** — the rep before submitting, or the
coordinator after. A gap the coordinator created while fixing a request is not
the rep's deviation, and no figure may read it as one. The comparison is
against **the version the dispatch was raised from**, not the latest one (S68).
A later revision changes what is quoted; it does not retroactively create a gap
on a dispatch that never moved.

Two halves, and only one of them is stored. **Whether it differs is derived**,
over the fields a dispatch line takes from a quotation line, and it is permanent
without being stored because neither side can move: an issued version's lines
are not editable (S61, S66, S126) and an approved dispatch's are not either
(S73). **Who made the difference is stored**, because nothing else can recover
it — the rep's half is fixed when they submit, and the coordinator's records
that the lines moved after that. **A free-entry dispatch (S75) is outside the
question entirely**: it has no quotation to differ from, so it is neither
flagged nor recorded as matching one, and no figure may count it as either.

**S121.** An approved dispatch carries its **SMAC dispatch number**,
which is unique. The coordinator writes it when SMAC issues it — usually at
once. **It is not a condition of approval**; a dispatch is approved, then
numbered.

**S122.** A **refused dispatch request is archived**, not deleted, and kept out
of the working lists **at refusal**. A rep sees their own; coordinators and
managers see all. Only the coordinator may revive one, and a revived request is
treated as new. A rep who wants to withdraw a submitted request asks the
coordinator to refuse it — there is no separate act. A revived request returns
to the **rep**, unsubmitted, and they edit and submit it as they would a new one
(S125).

**"Told" means sent, and the gate is nominal — the rule says so in its own
words.** Refusal is the one moment: the request leaves the working lists and the
bell is raised (S128, S92) in the same act, so there is nothing for the telling
to gate. The alternative — archiving held open until the rep has *read* it —
needs a read state on the news, which is the persistence machinery S91 forbids.
It is therefore not open, and no dismissal is tracked.

**S124.** **The coordinator refuses a dispatch request**, the same
person who approves one. A refusal carries a reason and archives the request
(S122).

**S125.** A rep edits their own request **until they submit it**. After
that the coordinator edits it, usually after phoning the rep — that is faster
than refusing and re-raising. A quotation is different: **S61** keeps its lines
editable until the coordinator issues it, so the rep edits throughout.

**S126.** A dispatch may only be raised from a quotation the coordinator
has **issued**. A requested version is still being edited (S61) and is not
something to dispatch against. This is what makes S120's comparison stable: an
issued version does not change, and a later revision creates a new version
rather than altering it (S66).

**S127.** The coordinator may **raise a dispatch request against her
own company and approve it herself**. She holds companies like any rep (S9),
and nothing blocks the same person from both acts.

**S130.** A dispatch may draw from a **different stock** than its
quotation (S118). The rep chooses it when requesting, as they choose the
shipment method (S119); the coordinator may change it until approval, after
which it is fixed. The change is recorded on the dispatch and the quotation is
not rewritten. A **free-entry dispatch names a stock too** (S75). After approval
the stock cannot change; a dispatch that must change is **cancelled as a whole**
(S73) and raised again.

---

## 11. Credit and targets

**S78.** By default, **100% of a dispatch credits the rep named on it**. Not the
project owner — reassigning a project must never move credit for a dispatch that
already happened.

**S79. [CHANGE]** **Shared credit is recorded on the quotation**, not the
project. It is rare.

**S80. [BUILD]** When a dispatch is linked to a quotation carrying more than one
rep, **the coordinator is prompted at approval** to confirm whether one rep or
both are credited. Approval is the moment credit is decided (S72).

**S81. [CHANGE]** A split divides **equally**. Nobody types a percentage. Splits
across three or more reps are so rare they may never occur, so no remainder-
distribution machinery is built. The first two sentences are true today; the
third is not — `divideEqually` distributes a remainder, and that is what comes
out.

**S82.** A rep can never set their own split.

**S83.** **Targets are square metres per month**, optional per person, and
independent of role.

**S84.** A target is a **dated row**. Correcting it adds a superseding row rather
than overwriting, so history stays visible.

**S85.** **Achievement is derived entirely from dispatches.** No rep ever types
how much they did.

**S129. [BUILD]** **A rep is told when they are given a share of someone else's
credit** — the split case S80 confirms at approval, never the ordinary 100% of
S78, which needs no telling. A split is a dated row with an author (S110), so
the event exists. Being told it was taken back (S128) without ever being told it
was given is not disclosure.

**The telling ships; the moment this rule names does not.** A rep is told when a
split naming them is written — the dated row, by its one writer. What does not
exist is **S80's confirmation at approval**: S80 is unbuilt and S79 still keeps
the split on the project rather than the quotation, so nothing yet decides
credit at the moment a dispatch is approved. When it does, it writes that same
dated row and the telling follows it.

**S136.** **A company target is one figure for one month, set as a decision of its
own.** Square metres, like every target (S83), and a **dated row** like every target
(S84, S110) — a correction is a superseding row, never an edit.

**It does not derive from the reps' targets, and they do not derive from it.** Six reps
at 1,000 against a company figure of 6,000 is a coincidence, not an identity: the split
across people is one decision and the company figure is another, and either may total
more or less than the other. Nothing sums one into the other, and no screen may present
one as the other's total.

**It is set by a holder of `can_set_company_target`, which is a NEW permission flag
introduced by this rule, held by Super Admin alone.** It is new because **no existing
flag draws this line**. `can_set_targets` sets a person's figure (S83) and is held by
the Sales Manager, so gating on it would make the person who divides the work across
the reps also the person who sets the figure the whole company — themselves included —
is measured against, which is S82's principle one register up. `can_export` and
`can_impersonate` happen to exclude the right people but mean other acts, and a flag
that draws a line while meaning something else cannot be audited. Who holds this one is
configuration (S7), not code: widening it is a seed row, not a deploy.

**A person who sells and holds `sees_all_reps` carries no target of their own.** Their
square metres are already part of the company total — S78 credits the rep named on the
dispatch, whoever that is — so a personal target would measure the same work a second
time against a second denominator. Nothing forbids such a row, because S83 keeps
targets independent of role; nothing reads one either.

**The company's achievement is derived from dispatches** (S85), over every approved
dispatch in the month and **not** by summing the per-person rows — **because a share
credited to a deactivated rep is dropped from every one of those rows** (S111), so
their sum understates the company by exactly the work of anyone who has left. The two
routes do not give the same number, and only one of them is this figure.

---

## 12. The waiting list — the core loop

This replaces coverage, the follow-up queue, the notification bell and the
dashboard. It is one idea, and it is the heart of the system.

**PARKED, session 50, by founder decision — decide at the pilot.** The
dashboard now does much of this job (D33's tiles and D34's sections over the
same derivations, linking into the filtered list). His words: *"Don't retire
the one-list idea and don't build toward it. Park it, and let the first month
of real use decide. If reps navigate fine, it's dropped."* The rules below
stay because the anchors, states and exits they define are built and live;
only S87's single-list destination is parked, and no session aims at it until
the pilot rules.

**S86. [BUILD]** Every company, project, quotation **and dispatch request** is
in exactly one of three states: **moving**, **waiting on a named person**, or
**closed with a reason**. No other state is legal. All four anchors exist now:
a dispatch request is a draft waiting on its rep, a submitted one waiting on
the coordinator, an approved one that has moved, or a refusal — closed with a
reason. What does not exist is the one list they belong on (S87).

**S87. [BUILD]** Each person has **one list of what is waiting on them**, oldest
first. That list is the dashboard, the follow-up queue and the notification
inbox.

**S88. [BUILD]** A manager sees **the same list across their team, grouped by
rep**. One screen, two scopes. There is no separate coverage screen and no
separate activity screen. A **dispatch request waits on the coordinator, not on
a rep**, so it appears on her own list (S87) and on the manager's grouped under
her.

**S89. [BUILD]** Something joins the list when a company has had no contact for
too long, a project has not moved, a quotation is sitting with someone, a
record was assigned or shared and has not been touched, or a dispatch request
is sitting with the coordinator. Four of the five conditions are computed in SQL
today — company quiet, project stage unchanged, quotation awaiting a response,
and a dispatch request submitted and not yet decided, ordered by when it was
submitted. What does not exist is the one list they join (S87).

**S90. [BUILD]** Something leaves the list exactly three ways:

1. **Moved** — an interaction was logged, or the chain advanced. An approved
   dispatch request has moved.
2. **Parked** — held until a date, set by whoever it is waiting on. A rep parks
   their own record; the coordinator parks a request she is waiting on finance
   or a callback for.
3. **Closed with a reason** — a project or quotation is **lost** (S43-S49); a
   dispatch request is **refused** (S124). Different vocabularies, same exit.

An item leaving the list by refusal, rejection or cancellation is **told to the
person it was taken from, on the bell** (S128, S92). Leaving the list is not the
same as leaving without a word — but the telling is **news, not a second list
item**: nothing is waiting on the person told, so nothing of theirs is left
open. The record keeps its reason in the **archive** (S122), which is where it
is looked up afterwards. Three surfaces, three jobs — the bell tells once, the
archive holds permanently, and **nothing lingers on the working list**, because
a refused row sitting in someone's list is a job that is not a job. All three
exits work today on their own anchors. What does not exist is the single list
they leave.

**S91.** **The list is the notification.** There are no notification tiers, no
persistence flags, no per-anchor resolution conditions and no daily digest. If
it is on the list it is waiting; if not, it is not.

The bell's badge therefore counts **unread**, and reading is the only disposal
there is. It counted unresolved entries, and nothing resolves any more — a
count that could only ever rise is the badge nobody looks at, which is what
persistence was invented to prevent.

**S92.** A **bell** carries news only, never work: *a rep was handed to you*,
*you have been shared a record*. A handover raises one summary, not one per
record. The news also carries **credit granted to you (S129)**, and **a decision
that ended your work (S128)** — a refusal, a rejection, a cancellation. Both are
news: nothing is waiting on the person told, so neither belongs on the list.

**Six items and no seventh.** The daily digest was the seventh and the only one
that ever carried work; it left with the machinery S91 deletes.

**S93.** **Friday and Saturday are the weekend for everyone.** Saturday work is
recorded and never required.

**S94. [BUILD]** A **calendar of non-working time** exists, in two kinds
(widened session 50, the founder's words). **Public holidays** — Eid, national
days — entered as a date range, affecting everyone. **Personal leave** —
annual leave, sick leave, any absence — entered per person. Both are skipped
by the pace bar and by the reminders: *"if a rep is off for two weeks, his
pace bar and his reminders should know it, otherwise he comes back to a
screen telling him he's behind and neglecting customers he couldn't have
called."* Public affects everyone; leave affects one person; both must be
enterable.

**S95. [BUILD]** Clearing your own queue is what you get back for typing. A rep
logs; the coordinator approves or refuses. Same list, different act. Both acts
exist today — the rep logs, and the coordinator approves and refuses (S72).
What does not is the single list they clear, which is S87's.

**S137. [CHANGE]** **A submitted dispatch request pauses the chase on its
quotation thread.** The no-response reminder says the customer has not
replied; a dispatch raised against the thread IS the reply — the founder's
words: *"they said yes. The reminder isn't a judgment call, it's just
wrong."* While a request on the thread sits at `submitted`, the thread raises
no quotation-chase row. **Refused or cancelled, the chase comes back. Approved,
the quotation is won and the chase is finished, not resumed** (S31 already
ends it). This suppresses the QUOTATION chase only — the company-quiet
reminder (S89) asks a different question, staying in touch, and is untouched.
**No regular-customer distinction exists** (decided in the same breath):
pausing while processing removed the need for one; if FACET ever
distinguishes a regular customer, it is **bought more than once, derived from
dispatches** — never a rep-maintained flag, because *"a rep-maintained flag
goes stale the moment someone forgets."*

**S138. [BUILD]** **A company added and never contacted joins the reminder
list.** Every S89 condition anchors to an event that happened; a company with
no contact at all anchors to its own creation. Some days after being added
with nothing logged — a settings row beside S89's thresholds, starting value
`OPEN — not chosen` (14 proposed) — it joins its rep's own list. **Grouped or
capped** so forty companies added in a day do not drown the real reminders:
*"if dumping 40 companies puts 40 reminders on your own list, dumping stops
being free."* **And the manager reads a per-rep never-contacted count** where
he reads the team — *"the manager count lets you see whether it worked"* —
its exact placement decided with the overseer-dashboard conversation (§16).
Both halves decided session 50.

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
· **reassign**. **The press is a request, never an action** — nothing leaves
the rep's list until the manager rules — **and the reason is required: "the
reason is the point"** (decided session 50).

**S106. [BUILD]** That is the same review, the same three outcomes and the same
record as a company going quiet. The only difference is what raises it — the
clock, or the rep's judgement. One table, one screen, one manager decision, two
ways in. The review, the three outcomes and the one record all exist. Only the second way in — the rep's request — is missing.

**S107. [CHANGE]** **Nothing is ever deleted.** "Removed" means archived: if that customer
resurfaces in two years, the record says they were already known and why someone
gave up on them. Archiving is gated by the delete-approval flag (S8). That gate
is not built. `canApproveDelete` has no reader anywhere today (S8), and
archiving is gated by `canAssign` instead.

**S128.** **A decision that ends someone's work reaches them.** A
refused dispatch request (S124), a cancelled or rejected quotation (S62), and a
**cancelled dispatch (S73)** each carry a written reason, and that reason
reaches **everyone whose work it ends** — the rep who raised it, and any rep
whose credit it takes back (S80). A cancelled dispatch un-wins a project and
removes square metres from a rep's month (S31, S85); nobody learns that from a
record they have no reason to revisit. A record that vanishes with its reason in
a column nobody reads is the same as no reason at all. Where the person told
cannot see the record — a co-credited rep has no sight of the dispatch itself —
**the message carries the reason and stands alone**. It is not a link into
something they cannot open. This is a deliberate exception to **S112**, which is
otherwise unchanged: an audit row is never shown without joining back to the
record and applying its visibility. Here the rep's own credit was taken, so the
reason reaches them even where the record does not.

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

**S114.** **Comments exist on quotation threads and projects only.**
Not on companies, contacts or dispatches. An unread comment appears on the
waiting list, so it cannot be missed.

**Each of the three is excluded for its own reason, and they are not the same
reason.** A **company** already has a timeline carrying what happened with that
customer, so the conversation would sit beside a record of it. A **contact** and
a **dispatch** have no timeline at all — nothing else anchors to either, so
comments were the whole of what their screens could ever show, and both cards
came off rather than being emptied (D48, D70). The sentence that used to say
*the timeline already carries those* was true of the company alone.

**Narrowed in session 27b.** Five kinds were admitted at every layer — the
record-type check in the database, the record-type list, the visibility filter
and the comment card on five screens. It was a disclosure question rather than
tidying: a comment follows its anchor (S131), so a comment on a company reached
everyone holding a share of that company, and S38 gives a report's note a
narrower audience than that with no equivalent half here to withhold. Three
rows existed on the forbidden kinds and all three were verify residue; the
migration cleared them (WORKFLOW §7).

Comments ship. The unread-comment surfacing does not — it needs the waiting
list (S87).

**S115.** *Deleted, session 50, by founder decision.* File attachments are not
wanted; the `attachments` table loses the rule that kept it and becomes a drop
candidate for the next dead-structure sweep. The number is kept and never
reused, so no citation shifts.

**S123.** **Who created a record is a measure.** The normal case is the
rep creating their own companies, contacts, projects, quotations and dispatch
requests. A record **created for a rep by the coordinator or a manager**, and a
request the **coordinator had to edit before approving**, are both recorded and
counted. Both are someone else doing the rep's work, and both are what the
number is for. It is a number to look at, never an enforcement — a rep in a
meeting with no connection is a legitimate exception. This is not the deviation
S120 measures. A gap the coordinator introduced is never the rep's deviation
from a quotation; that the coordinator had to introduce it is a fact about how
the request arrived. Two questions, two figures, and a screen showing both must
say which is which. `created_by` exists today on companies, contacts, projects
and quotation versions; the dispatch request records who raised it, and a
coordinator's edit of a submitted one is an audit row naming her. S120's second
column is **not** this figure and must not be read as one: it records only that
the dispatch's *lines* moved after submission, which is what stops a gap she
introduced being counted as the rep's — this rule counts every edit she had to
make, lines or not.

**Both figures exist, over dispatch requests, and nothing else is counted.**
`/users/[id]` carries them per rep for a month: requests raised, of those the
ones somebody else raised, and requests a `can_dispatch` holder other than the
raiser edited. They sat on `/performance` until that route was merged into
`/targets` and deleted; the figures moved rather than went. The month bounds the **act**
rather than the dispatch date the tables around them use, because that is what
this rule measures and because an edit has no other date; the screen says so,
and says the three figures do not add or subtract.

**The other four kinds are not counted, and two of them cannot be.** A company
and a project are created by their own owner — `createCompany` and
`createProject` write `created_by` and the owner as the same person, so the
comparison is zero by construction and only a create-for path no rule asks for
would change that. A quotation version and a contact **do** differ at creation
today, and are still not counted: a handover rewrites `raised_by_user_id` and
moves `company_reps`, so the comparison would read a handover as somebody doing
the rep's work. A contact would additionally rest on what "primary rep" means
after a handover, which is not decided. A dispatch is the one kind where both
sides are immutable — S103 keeps past dispatches where they are — so its figure
is permanent, as S120's derived half is.

**S131.** A comment is visible to **whoever can see the record it hangs on**. A
comment is not a record with a visibility of its own — it follows its anchor,
the way a report's shared half does (S38).

**S76 is the one exception, and it does not carry the conversation.** The
coordinator sees a project because a dispatch names one; she does not see what
the reps say to each other on it. On a project her sight stops at the record.
The one thread she reads is the quotation thread, which she holds in her own
right (S62).

**S76 opened a contact on the same terms and that half is now empty rather than
excepted.** Since S114 a contact carries no conversation for anybody, so there
is nothing on one for this rule to withhold from her — the exception is
enforced in exactly one place, the project. A company's conversation was never
hers, and a company has none either.

---

## 15. The work this implies

Ordered by what unblocks what.

**Blocking anything else**

1. Bulk import — fourteen people cannot hand-type the existing customer base.
   (The Docker build was this list's first item; it was fixed before
   WORKFLOW.md existed and this line was the claim's last survivor.)

**The model changes**

3. One name field on companies and contacts; phone mandatory; country added
4. Drop project role labels
6. VAT fixed; validity and delivery period leave FACET; readable product fields
7. Report split into shared half and private note; same-day edit
8. Signals and loss reasons unified; loss cascade
9. Coordinator sees projects and contacts

**The big rebuild**

10. The waiting list — replacing coverage, follow-ups, notifications and the
    dashboard. This is a large deletion as much as a build. **PARKED — §12:
    decided at the pilot, built toward by nobody until then**

**Then**

11. Duplicate detection and manager resolution
12. Sharing per project; contacts shareable
13. Archive requests folded into the dormancy review
14. Password reset; holiday calendar; signal aggregation; the three dead flags

**Dropped outright**

- `verificationTokens` — an Auth.js leftover, credentials-only login.
  `accounts` was on this list and **stays**: `accountsTable` is a non-optional
  member of the adapter's `DefaultPostgresSchema`, so dropping it fails
  typecheck. A library requirement is a writer.
- `pipeline_snapshots`, `person_snapshots` — the dashboard rebuild decides what
  history it needs rather than inheriting a guess
- `project_companies.role` — S25
- Notification tiers, persistence flags, per-anchor resolution, digest
  machinery — S91
- `companies.has_credit_terms` — S70 and S73 were its only citations and both
  were rewritten. No rule stands behind it. **Dropped**, in the slice that
  rewrote them: a credit customer is the `handled by finance` payment method
  (S71), not a flag beside a gate.

**The dead-structure sweep — migration `0027`.** AUDIT 1's F9–F18 and
WORKFLOW §5's own rows, taken together. Everything below had no rule behind it
and none of it is recent: ten of the fifteen trace to migration `0000` and the
rest to `0002`, `0005` and `0007`, all written from the schema-design document
before this file existed. `has_credit_terms` above was not an anomaly.

- `users.city_id` — 0 of 401 rows. `createUser` took the parameter and wrote
  the column; nothing ever supplied or read one. `users.region` is the half of
  the rep's base that has a reader, and it stays
- `quotation_threads.cancelled_at` — written by `cancelThread`, read by
  nothing. `cancelled_by_user_id` beside it **is** read and stays
- `quotation_lines.form_factor`, and the `form_factor` type with it — 850 of
  850 `sheet`. Quotation lines are sheets only, so the application wrote a
  constant nothing read back. `dispatch_lines` had already refused to copy it
- `notifications.channel` and `notification_types.default_channel`, and the
  `notification_channel` type — every row `in_app`. The second is the sweep's
  clearest case: its only reader existed to write the first, which nothing read
- `record_type.quotation_version` — 0 rows across all seven columns of the
  type. A version is reached through its thread; nothing hangs off one
- `product_suppliers.code`, `product_classes.code`,
  `product_fire_ratings.code` — the token of a generated product name **S53**
  says FACET does not produce. Never rendered; an `ORDER BY` is not a reader.
  No data lost: the code was the name in every row
- Four indexes no query can use — `comments_author_idx`,
  `comment_mentions_user_idx`, `rep_report_signals_signal_idx` and
  `audit_log_actor_idx`, the last being an eleventh AUDIT 1 did not count

**Examined by the sweep and deliberately kept**, because a rule still asks:
`delete_requests` (S105–S107) · `duplicate_flags` and `non_duplicates`
(S21–S23) · `companies.merged_into_id` (S21–S23) · `quotation_threads.closed_at`
and `closed_by_user_id` (S47) · `roles.can_export`, `can_approve_delete` and
`can_resolve_duplicate` (S8, and item 14 above). Their indexes go with them.
**Unused was never the test — unwanted was**, and `verify:schema25` §2 asserts
each of them present, with its rule, so a later sweep cannot take them for
being empty.

**Two left that list in session 50, the test having flipped from unused to
unwanted:** `attachments` (S115 deleted) and `product_specifications` (§16's
question answered — not needed, SMAC prints the quotation). Both are **drop
candidates for the next dead-structure sweep**, and that sweep must move the
`verify:schema25` §2 assertions that currently hold them present — a check
asserting a table nobody wants is the check keeping it alive.

---

## 16. Open

- **The quiet thresholds — half resolved, session 50.** The values ARE
  settings rows, seeded and read at query time (the founder's belief,
  checked and confirmed); 30/60 stay as starting values. What does not exist
  is a screen for a manager to edit them — that half stays with `WORKFLOW §4`
  row 37. Revisit the numbers once there are three months of real data.
- **The performance formula.** Activity and target are shown side by side and
  never combined into one score. Nothing scores a rep.
- **Where a rep's explanation lives when a project jumps a position** on the
  board (S134). A note, not an override — but S76 and S131 disagree about who
  may read a project's conversation, and that is settled before a note renders.
- **The overseer-dashboard conversation** (session 50). What a manager and an
  executive should actually measure and see — *"metrics, what's shown, what's
  worth knowing"* — is deliberately unsettled; the founder wants a proper
  conversation, and **no session builds more dashboard until it is had**.
  D64's book-holder narrowing and D68's for-now shape stand meanwhile.
- **Form field order** (session 50) — settled as a PROCESS, not an answer:
  one form at a time, current order and proposed order side by side, the
  founder corrects. Each form is its own `WORKFLOW §4` row; nothing here is
  decided in passing.
- **Category and lead source, a month into the pilot** (session 50). Both
  fields stay — *"lead source especially: it's how I'd learn where business
  actually comes from."* If they are still empty a month in, **the problem is
  the form, not the fields** — re-raise then, against the form-order work.

Closed here in session 50, recorded in `docs/archive/28-fixation/`:
product specifications (not needed — SMAC prints the quotation) and the
chase-suppression question (answered by S137).
