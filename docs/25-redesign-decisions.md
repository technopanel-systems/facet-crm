# 25 — Redesign Decisions

Closes the ten conflicts between the founder's UI/UX brief and the settled
corpus, the coordinator reversal in `24 §1.1`, and the four rules `24 §3.1`
found stated but unscheduled. Taken across five planning batches.

**Status:** sections tagged **[founder]** are user truth, stated directly.
Sections tagged **[delegated]** were handed to the planning assistant and are
agreed, not proposals. Sections tagged **[derived]** are the implementation
reading of a founder statement.

**Authority:** user truth, at the top of the list. Where this contradicts any
earlier document, this is the later statement and wins.

---

## Part A — Stage, activities and the board

### 1. The "stages" are not a sequence **[founder]**

The single correction that reshapes this part. Quotations go out before
catalogues. Samples are sometimes skipped. A quotation is raised, samples are
sent, then a second quotation is raised or the first is edited. Some projects
never reach production.

**Two different things were wearing one word:**

| | Nature |
|---|---|
| **Activities** — catalogue sent, samples sent, technical submitting, documents sent, visit, call | **Unordered, repeatable.** Any order, any number of times |
| **The quotation chain** — no quotation → requested → issued → accepted → paid → dispatched | **Strictly ordered.** Cannot be skipped or reordered |

Legacy's single stage dropdown conflated them, which is exactly why it went
stale: a rep picked "Catalog Sent" once and it sat there while five other
things happened.

**Nothing new is needed for the first half.** `20`'s reports are already one row
per event, repeatable, in any order, with an outcome. This is that model,
recognised.

### 2. Technical Submitting is a new outcome value **[founder]**

Added to `20 §3`'s outcome list. Not a stage — an activity, like the others.

### 3. Board columns are the derived chain position **[delegated]**

`New · Quotation requested · Waiting signature · Waiting payment · Paid ·
Dispatched`, computed from real events. Always accurate, never stale, nothing to
maintain, and it answers whose move it is — `22 §4`'s rule.

**A card cannot be dragged between columns, and this is deliberate** `[founder
accepted]`. Dragging from "Waiting payment" to "Paid" would mean claiming a
payment that did not happen. The card moves when the event happens. A board of
derived truth is worth more than a board that can be pushed around.

### 4. What the rep sets **[founder]**

Three things the system cannot know:

- **In production** — a plain label. **Deliberately unverified**, and *not*
  connected to the production module. Production sometimes changes and stock
  sometimes covers an order, so FACET must not check it. Recorded so nobody
  later builds a check.
- **On hold until** — already exists (`20 §5`)
- **Lost, with a reason** — takes the card off the board

No stage dropdown. Nothing to go stale.

### 5. Loss is about why **[founder]**

Flagging a project lost requires a reason. Same shape as `20 §4`'s signals, so
the reasons aggregate the same way:

price too high · lost to a competitor · colour or product unavailable · stock
shortage · delivery time too long · specification we do not offer · project
cancelled or postponed · customer went quiet · **other (free text)**

The founder will collect real "other" entries and promote or prune the list.
Loss reasons feed a report to management.

**Lost is not a board column** `[delegated]`. A lost project leaves the board
and lives in a filter, or the board becomes a graveyard nobody clears.

### 6. Warmth is withdrawn **[founder]**

`10 §1` proposed Cold / Warm / Hot / Dormant, set by the rep. The founder does
not recognise the term and finds it strange. **Cut entirely.** Nothing
implements it, so it costs nothing. `10 §1`'s derived-qualification half stands
— see §16.

### 7. Some customers have credit terms **[founder]**

`07 C3`'s payment gate — dispatch blocked until payment is confirmed — has an
exception. Some customers buy on credit.

**Credit terms are a property of the company** `[delegated]`, set by the
manager. A dispatch against a credit customer is allowed and **flagged as
such**, the way a direct dispatch already is. Rejected: a per-dispatch override
tick, which would let anyone bypass the rule case by case. Some customers simply
have different terms; nobody skips a gate.

### 8. The board serves reps and managers both **[founder]**

With grouping and filtering — by rep, city, colour, quantity — and every card
opening its project. A manager looking at fifty projects filters rather than
scrolls.

---

## Part B — Comments

### 9. Comments belong on every record **[founder]**

Projects, companies, quotations, contacts, dispatches. All roles. The founder
called it structural rather than a feature, and it is.

**The distinction that makes it work** `[delegated]`:

- A **report** is what happened *with the customer* — visit, call, outcome,
  signals. It feeds metrics.
- A **comment** is what colleagues say *to each other* about a record.

Both land on the same timeline. One thread per record carrying reports, system
events and conversation.

**What it replaces.** The rep and coordinator currently coordinate a quotation
over WhatsApp, where it vanishes. `22 §4`'s chain shows whose move it is;
comments let them discuss it in place. Six months later the negotiation is on
the record instead of in a phone. This is `07 G3`'s "one place" criterion,
directly.

### 10. Comment visibility follows the record **[founder]**

Manager, coordinator, the owning rep, and any shared rep. The same rule reports
follow (`20 §10`), for the same reason.

### 11. Tagging covers records, not only people **[founder]**

`@Rawan`, `@9592`, `@مؤسسة فاينال فير` all become links.

**People-tagging ships first; record-tagging second** `[delegated]`. Tagging a
record means an autocomplete across four entity types that respects visibility —
worth building, but it is its own piece of work and must not be bundled in as
"comments, plus mentions".

Tagging a person raises a notification. That is the difference between a comment
box people ignore and one that replaces WhatsApp.

### 12. Editable by the author, never deleted **[founder]**

Consistent with `12 §7`. The audit log holds the edit.

### 13. The coordinator's "returned for edits" reason becomes a comment **[founder]**

It is the same act. No separate field.

### 14. Comments are counted, never summed with reports **[delegated]**

The daily view shows `reports: 4 · comments: 7` as separate columns. The founder
wants comments visible in reporting — a rep sometimes uses one to log detail —
but merging them would let a rep raise his activity count by talking to
colleagues, diluting the number that matters. Same principle as `07 D2`: shown
side by side, never combined.

### 15. FACET does not replace verbal talk or office work **[founder]**

Stated as a general principle. The system records outcomes; it does not try to
become the conversation. Applied here: comments are where a decision gets
written down, not where it has to be made.

---

## Part C — Qualification, follow-ups, notifications, tasks

### 16. Qualified means the rep said so, or a quotation exists **[founder]**

`10 §1` and `20 §7` derive qualification from a real quotation thread and let
nobody set it. The brief asked for a qualification workflow. Both stand:

- A rep may **mark a lead qualified** on his own judgement
- A quotation request makes a company qualified **regardless**
- Nobody can un-qualify a company that has been quoted

Two sources, one field. "Qualified" is the founder's own word, unlike warmth.

### 17. A notification is resolved by doing the act **[founder]**

The brief asked for tick-to-dismiss. `07 G1` and `21 §4` make act-now
notifications persistent, clearing only when the underlying condition clears.

**The founder's answer converges on the existing design**: the tick takes the
rep *to where the work is*; resolution comes from doing it. `07 G1` stands
unchanged. The only change is wording — **the button says "Go" or "Open", never
"Dismiss"** `[derived]`.

### 18. A manual follow-up date outranks the automatic clock **[founder]**

The strongest idea in the batch, in the founder's own framing: *a project will
go overdue in two days but the follow-up is set for next week, so instead of an
overdue alert the system offers to extend the overdue to the follow-up date.*

**The rule** `[derived]`:

- A rep may set **next follow-up** on a project, quotation or company
- That date **suppresses** the automatic chase until it arrives
- When it arrives, it **becomes** the follow-up
- With no date set, `07 D5`'s thresholds apply as they do now

This is `20 §5`'s on-hold mechanism generalised from the company to the record.
It resolves `20 §9`'s "computed on read, never stored" against the brief's
"next follow-up date on everything": the *timers* stay derived; the rep's own
date is an input to them, not a stored timer.

It also removes the largest source of notification fatigue — being chased about
something already scheduled.

### 19. The follow-up queue is the automatic task list **[derived]**

Already generated, already ordered by how long each thing has waited, and not
stored as rows — which is why it cannot go stale. **`21`'s refusal to write
`tasks` for follow-ups stands.**

### 20. Manual tasks are built, small **[founder]**

What `21` does not cover is the human half of `07 A1`: a manager assigning a
task to a rep, and a rep writing his own to-do. Neither is derivable. The
founder asked for something non-complex, to test and see how it is used.

Built for the **two human origins only**. `origin: 'system'` is never written.

---

## Part D — The quotation / project quantity relationship

### 21. Quotations are never summed **[founder + derived]**

The founder named the real problem: **too many quotations for one thing or one
company.** One project quoted three times at 2,000 m² each does not mean 6,000
m² was quoted — it means the same 2,000 was counted three times.

**Any report that sums quotations is wrong, and that is true of the code
today.**

| Number | Meaning |
|---|---|
| **Project expected sqm** | The rep's estimate. The anchor |
| **Quoted** | Never a sum. The latest live version of one thread |
| **Dispatched** | The only real number, and the only one that touches a target |

### 22. One quotation thread per project is the encouraged path **[founder]**

The causes of a second thread are price renegotiation, quantity change and
colour change — **all of which are revisions** — plus one that is not a business
need at all: *the sales coordinator does not know a quotation already exists for
that project.* That is a visibility failure.

**The design** `[derived]`. Raising a quotation against a project that already
has one shows, before submitting:

> This project already has quotation 9592 — 2,000 m², issued 6 Aug.
> **[Revise 9592]** · [Raise a separate quotation anyway]

Revise is the default; `16 §2`'s RE mechanism already supersedes cleanly. The
same panel appears on the coordinator's screen when she issues, so she stops
being the last to know.

Second threads remain possible and are **flagged**: the project shows *"3 open
quotations · 5,800 m² quoted against 2,000 expected"*.

### 23. No tolerance is built **[founder + delegated]**

The founder asked for an "acceptable difference" between project, quoted and
dispatched quantities, and then said he has no view on how to apply it. That is
the right answer.

Any percentage chosen today would be a guess, and once it exists people work
around it and the real distribution is never learned. Instead: show **expected ·
quoted · dispatched** side by side on the project, and flag only the unambiguous
case (more than one open thread).

`OPEN — not chosen`: revisit after roughly three months of real data.

### 24. A quotation closes when the rep knows, or when the project resolves **[founder]**

Either the rep closes it because he knows nothing more is coming, or it closes
when the project is won or lost. Management views filter accordingly so the
numbers are not misread.

**Taking a project in batches is normal** — partial dispatches are the expected
case, not an exception.

### 25. The shortfall reason belongs to the project **[founder]**

Quotations inherit it. A project lost for one reason does not make the rep write
that reason again on each quotation under it. The reason list is the same as
§5's.

### 26. The unfulfilled quantity is never shown as a number **[founder]**

Not on the quotation, not on the project. The founder judged it would confuse.
**A written reason is what is recorded.**

### 27. Management sees a monthly rollup, by rep first **[founder]**

Quoted against dispatched, the gap grouped by reason, **sliced by rep** as the
first cut. Computed live, reviewed monthly, and acted on — the founder describes
it as a report used to optimise the company and take decisions, not as
visibility for its own sake.

---

## Part E — The coordinator, and rules nobody built

### 28. Coordinators get read-only access across everything **[founder]**

Closes `24 §1.1`. `04 Q10` granted it; `16 §8` and `18 §2` reversed it silently
and the code followed them, so today a coordinator can search company **names**
and open no company record.

**The founder restores `04 Q10`** and widens it — coordinators already have full
access to the internal ERP, so withholding a read in FACET protects nothing.

**This introduces a third visibility tier, which FACET has never had**
`[derived]`. Every rule so far is all-or-nothing: `14 §2` makes a share grant
edit, not merely view. Read-only is architectural, not a permission tweak, and
needs **its own flag** rather than being folded into `sees_all_reps`.

### 29. A delete request is really a release **[founder]**

The founder's framing, which is better than the question asked: when a rep
judges a company is no use, he asks for it to be taken off his book **so it does
not drag down his conversion**. The manager then refuses, approves, or reassigns
the company to another rep or the sales desk.

**These are the same three routes as dormancy** (`21 §10`: re-include, reassign,
archive) `[derived]`. One workflow, two entry points — one rep-initiated, one
system-initiated. Nothing is deleted, so `12 §7` is intact.

The incentive problem is worth naming: dead companies sitting in a rep's book
quietly punish him for honest prospecting.

### 30. Build the sharing write path **[founder]**

`07 B1`'s manager-initiated sharing has never existed. `record_shares` is read
by four filters in `authz.ts` and written by nothing; `can_share` is seeded and
read by nothing; every verify script inserts share rows by hand. The
per-record visibility model — the most-designed thing in FACET — has never been
usable by a human. `21 §11`'s `share.granted` notification is seeded complete
and fires the day this exists.

### 31. Build SMAC reference correction **[founder]**

`04 A2` states that references are typed by humans and can be wrong, and there
is no way to fix a typo short of creating a revision. The coordinator gets a
correction path, audited.

### 32. Build bulk export **[founder]**

Super-admin only and audited, per `07 B8` and `07 E1`.

---

## Part F — Smaller decisions

### 33. Personal is a tenth company category **[founder]**

Alongside `12 §4`'s nine. For people buying for a house or a private project.

### 34. An activity carries an optional reference **[founder]**

A report gets a small reference field beside its outcome — sample number, colour
code, document name — so *"Sample #2 → 168"* is a value rather than a sentence.
Same reasoning as `20 §4`'s signal references: it makes "how many samples of 168
went out this quarter" a query.

### 35. The sales-desk workflow is not modelled **[founder]**

Today: photos collected in Excel, handed to the manager, assigned to desk reps.
The founder rejects this as a business practice, considers it temporary, and was
explicit that describing it was conversation rather than a requirement.

**Nothing is built for it.** It is handled with existing features — manager
assignment (`07 B3`), or a desk rep adding companies and projects normally — and
adjusted slowly so the current flow is not broken.

**The reason not to model it** `[delegated]`: building the photo → Excel →
manager → assignment flow into FACET would make it permanent. It survives now
because it is improvised; put it in the system and it becomes how the system
works, someone trains new hires on it, and it outlives its reason. That is how
v1 acquired `branches`.

The founder's own vision — a rep works the projects he finds, while the sales
desk finds new ones by search and calls — is served by FACET existing at all,
since visible pipelines make "they are out all day" unusable as an explanation.

### 36. File storage, admin-only **[founder]**

Reverses `03`'s deferral, at a much smaller scope than the brief implied.

- **Uploads go through the super admin only.** Reps hand over photos; he
  resizes and uploads them. No rep-facing upload path.
- **Avatars are chosen from a set, not uploaded.**
- A small storage layer covers site photos, a stored logo and similar.
- Files live on disk with the path in `attachments` (`03`, `09 §13.1`), inside
  the Docker volume so a restore brings them back with the data.

`OPEN — not chosen`: reconfigure when the system expands and rep-facing
uploading becomes real. At that point size caps and resize-on-upload stop being
optional, because photos are the one thing in FACET that grows without limit.

### 37. Stop at every milestone **[founder]**

A stated working principle: at each milestone, stop and reassess or adjust
rather than pressing straight on. It is how this project has run, and every
stop has caught something.

---

## Part G — Schema changes required

None of these are presentation. Each needs a migration.

1. `companies.has_credit_terms` (§7)
2. Company category seed gains **personal** (§33)
3. Project: `in_production` label, `lost_reason`, `lost_at` (§4, §5)
4. Loss-reason lookup, seeded from §5, extensible
5. Project: `next_follow_up_at`; quotation thread and company likewise (§18)
6. `comments` — record type, record id, author, body, edited at (§9)
7. `comment_mentions` — for people first (§11)
8. `rep_reports.reference` (§34)
9. `tasks` gets its two human origins written; `origin: 'system'` stays unwritten (§20)
10. Roles gain a read-only visibility flag (§28)
11. Quotation thread: `closed_at`, `closed_by` (§24)
12. Outcome enum gains **technical_submitting** (§2)

Withdrawn rather than added: warmth (§6), a tolerance setting (§23), any
sales-desk structure (§35).

---

## Part H — Still open

1. **Tolerance** between project, quoted and dispatched quantities — revisit
   after ~3 months of data (§23)
2. **Record-tagging** in comments, after people-tagging ships (§11)
3. **Rep-facing uploads**, size caps and resize-on-upload (§36)
4. **Credit at dispatch time.** The founder described a simpler model than
   `18 §1`'s dated generations: a single-rep record credits automatically, and
   a shared record asks the coordinator at the moment of dispatch, with a tick
   for sharing arranged outside the system. This is likely better than what is
   built — no setup, no maintenance, asked only when genuinely ambiguous — but
   it changes working, verified code and belongs in its own decision.
5. **`coverage()` paginates before it filters** (`22 §6`, `23`) — a live defect,
   needing the `isQuiet` derivation moved into SQL
6. Everything carried forward from `24 §5.1`
