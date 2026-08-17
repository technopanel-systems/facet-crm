# 06 — Strategic Review

**Status: PROPOSALS, not user truth.** Nothing here has been confirmed by the
founder. It does not outrank `04-founder-answers.md` or `01-business-model.md`.

Each item below is either a **structural recommendation** (cheap now, expensive
later) or a **business risk** that will decide whether FACET is used or
abandoned. Items marked **→ §13** should be added to the open list in
`01-business-model.md`.

---

## Part A — Structural. Cheap now, expensive later.

These change the schema. Deciding them after Phase 5 means migrations across
live data.

### A1. Audit log — nothing else in the design replaces it

FACET will hold contested facts: who owned a lead, who dispatched what, whose
target got credited, who reassigned a project when a rep left. The first serious
argument about any of these will be unanswerable without a record of who changed
what and when.

**Recommendation:** an append-only `audit_log` from day one — actor, action,
entity type, entity id, before/after, timestamp. Written by the data layer, not
by each feature.

This is also the only real defence against a disputed target number, and it is
the difference between "the system says 400 sqm" and "the system says 400 sqm,
entered by Sara on the 3rd, unchanged since."

**→ §13**

### A2. Snapshots — current state cannot answer historical questions

Stock already has this planned (`[04 confirmed]`, daily snapshots). The same
logic applies more broadly and is not yet stated.

You cannot reconstruct "what did the pipeline look like in March" from a table
that only holds today's stage. The moment a project moves to won, March's
pipeline is gone.

**Recommendation:** month-end snapshots of pipeline state and of each rep's
target versus achievement. Small tables, written once a month, and the only way
to ever produce a trend.

**→ §13**

### A3. Targets must be historical, not a current setting

If a rep's target is a single field on their account, changing it in June
silently rewrites January's performance. Every historical report becomes wrong
and nobody notices.

**Recommendation:** targets are rows — rep, period, SQM, who set it, when. Never
a mutable field. This also answers open item 22 (who sets a target, does it
vary) by making both answerable from data.

**→ §13, relates to `01` §13.22**

### A4. Bilingual data is already a requirement

Duplicate detection must catch Arabic versus English spelling variants
`[04 confirmed]`. That means the same company is being entered in two scripts —
which is a data model fact, not just a matching problem.

**Recommendation:** company and contact names carry both an English and an
Arabic field, plus a normalised form for matching. Storing one name and hoping
is what created the duplicate problem in the first place.

Separately open: does the **interface** need Arabic and RTL? Retrofitting RTL
into a built UI is expensive; planning for it costs little.

**→ §13**

### A5. Deduplicate at entry, not after the fact

At 100–500 companies per month, duplicates compound faster than a manager can
resolve flags. v1 flagged duplicates and had no merge function at all
`[00 §2]` — the flag was a dead end.

**Recommendation:** check at creation. When a rep types a company name or phone
number, show likely matches *before* the record is created. Phone number is the
strongest key — company names vary, numbers rarely do.

The manager's flag queue should be the exception path, not the primary defence.
And whatever the manager decides, a **merge** must actually exist — otherwise
`04`'s "who continues / shared / false flag" has nowhere to land.

**→ §13, relates to `01` §13.23**

### A6. SMAC reconciliation will be needed, and should be designed now

Two systems linked by humans retyping numbers will drift. Not might — will.
Over a year, expect missing references, transposed digits, and the same SMAC
number attached to two FACET records.

**Recommendation:** a reconciliation view the coordinator or manager reviews
monthly — FACET quotations with no SMAC number, duplicate SMAC numbers, accepted
quotations with no dispatch, dispatches whose totals disagree with what SMAC
shows. It costs one screen and prevents the slow rot that kills double-entry
systems.

**→ §13**

### A7. Design the data layer as if an API is coming, because it is

`04` confirms n8n automations and an AI assistant as future work. Both need
programmatic access to the same logic the UI uses.

**Recommendation:** business rules live in server-side functions, not inside
page components. The UI calls them; later, an API route and n8n call the same
ones. This costs nothing now and saves a rewrite.

---

## Part B — Business risk. These decide adoption.

### B1. The real risk is not code. It is that reps stop using it.

Internal CRMs fail on data entry burden, not on features. If FACET asks a rep
for more typing than the Google Sheet did, they will keep using the Sheet, and
the database will be half-empty within a quarter — at which point every
dashboard lies.

**Recommendation, and it should be a stated design rule:** every rep-facing
screen must demonstrably reduce the rep's work versus today. Where it cannot,
the data should be derived instead of asked for (`04 C1` already establishes
this principle — it should govern UI design too, not only metrics).

Suggested test before building any rep screen: *what does the rep get back for
filling this in?* If the answer is "management gets a report", it will be
filled in badly or not at all.

### B2. Reps work in the field. Nothing in the design mentions mobile.

Site visits, showrooms, customer offices. A rep logging a visit report is
standing in a lobby with a phone, not sitting at a desk.

**Recommendation:** rep-facing screens are designed mobile-first — lead capture,
visit report, quotation request, company lookup. Manager and coordinator screens
can be desktop-first. This is a UI architecture decision that is painful to
reverse.

**→ §13**

### B3. Measuring activity invites gaming

`04` asks for performance combining actions, target, conversion and reporting
timeliness. Anything scored on *actions* will produce actions — forty logged
calls a day, catalogues "sent" to nobody.

**Recommendation:** outcomes carry the score — dispatched SQM, conversion rate.
Activity and reporting timeliness are shown as **diagnostics**, visible but
unscored. A manager can see a rep with no activity and a good number, and ask.
The system should not turn that into a formula.

**Relates to `01` §13.3.**

### B4. Lead attribution will cause the first real argument

Two reps, one company, one dispatch. `[04 D2]` treats this as a calculation
question. It is really a **policy** question, and the calculation only encodes
it.

Until the policy is stated in plain language — first to register? whoever raised
the accepted quotation? manager's call each time? — any split rule will feel
arbitrary to whoever loses.

**Recommendation:** write the policy as a sentence a sales manager would say out
loud, get it agreed, then implement that. Not the reverse.

**Relates to `01` §13.2.**

### B5. Offboarding is also an exfiltration risk

`[04 Q8.1]` covers redistributing a departing rep's work. The other half is that
a rep leaving with the customer list is the single most common data loss in any
sales organisation.

**Recommendation:** bulk export is a permission, not a feature everyone has, and
every export is written to the audit log. Deactivation revokes access
immediately, before the handover review begins.

**→ §13**

### B6. Notification fatigue will kill the follow-up system

Overdue projects, overdue quotations, unanswered catalogues, dormant customers,
shared-record overlaps, approval requests, duplicate flags. A rep with twelve
notifications a day mutes all of them, including the one that mattered.

**Recommendation:** two tiers from the start — **act now** (a quotation is
waiting on you) versus **digest** (five things went stale this week, one
summary). The channel abstraction in `04 C3` should carry a tier alongside it.

**→ §13**

### B7. Personal data carries obligations in Saudi Arabia

FACET stores names, phone numbers and business relationships of individuals at
customer companies. Saudi Arabia's Personal Data Protection Law applies to this.

**Recommendation:** not a v1 blocker, but worth one deliberate decision now on
retention — how long dormant leads and departed contacts are kept — rather than
discovering the question during an audit. The snapshot and audit designs above
should not accidentally make deletion impossible.

**→ §13**

---

## Part C — Rollout, which is not currently planned anywhere

### C1. FACET is not on the critical path, and that is an asset

If FACET is down for a day, SMAC still quotes and invoices, and the business
still runs. That is worth stating explicitly: it means a single-PC deployment is
an acceptable risk, and it means rollout can be gradual without danger.

### C2. Pilot before rollout

**Recommendation:** two or three reps for a month before company-wide. They will
find the business logic errors no document catches — and reps trust a system
their colleagues already use far more than one management announces.

### C3. Define what success means before building

Worth agreeing now, in one line each: what does FACET have to achieve in six
months to have been worth it? Candidates — every quotation traceable to a rep
and a project; targets calculated without anyone assembling a spreadsheet;
duplicate rate below some threshold; reps logging visits without being chased.

Without this, "done" is whenever the feature list runs out, and the feature list
never runs out.

---

## Part D — New open questions for `01` §13

25. Should an append-only audit log exist, and what does it cover? (A1)
26. Should pipeline and target snapshots be taken monthly? (A2)
27. Are targets historical rows rather than a current setting? (A3)
28. Do companies and contacts carry both Arabic and English names? Does the UI
    need Arabic and RTL? (A4)
29. Is duplicate checking done at entry as well as by manager flag, and does a
    merge operation exist? (A5)
30. Is there a SMAC reconciliation view, and who reviews it? (A6)
31. Are rep-facing screens mobile-first? (B2)
32. Is bulk export a restricted permission, and is it audited? (B5)
33. Do notifications have act-now and digest tiers? (B6)
34. What is the retention policy for dormant leads and departed contacts? (B7)
35. What is the lead attribution policy, stated in plain language? (B4)
36. What defines success for FACET at six months? (C3)
