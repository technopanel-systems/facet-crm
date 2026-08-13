# 24 — Documentation Audit

**Status: reference only — never authority.** This document decides nothing. It
records what was found when `docs/` was read end to end against `src/` on
**2026-08-12**. Every entry is a fact with a citation; nothing here is a
proposal, and no document was changed.

**Method.** All 23 files in `docs/` were read in full (`00-legacy-findings.md`
by section, per `CLAUDE.md`), together with `src/db/schema.ts`, every module in
`src/lib`, `src/auth`, `src/components`, the route tree under
`src/app/[locale]`, `scripts/seed/*` and the seven migrations in `drizzle/`.

**Scope note.** `00`, `02` and `06` are marked reference-only by `CLAUDE.md`;
disagreements between them and a user-truth document are by design and are not
listed as contradictions. `01` and `09` are marked derived; they restate other
documents and hold no authority of their own, but they are still expected to
agree with what they restate, so their disagreements **are** listed.

---

## 1. Contradictions the reversal list does not resolve

`CLAUDE.md` names five reversals explicitly (`21`→`10 §9`, `20`→`04 Q6` and
`07 D6`, `18`→`07 D3`, `17`→`08 B1`, `12 §7`→`04 Q8.1` / `14`→`12 §3`). The
following disagreements are not among them.

### 1.1 The coordinator's read-across — `04 Q10` versus `16 §8` and `18 §2`

The largest unrecorded reversal in the set.

- **`04 Q10` answers "Yes"** to `02 §5`'s question 10, which reads: *"Does
  `sales_coordinator` see all companies and projects read-only, but not rep
  activity detail?"* `01 §2.1` restates it as settled: *"A coordinator sees all
  companies and projects, read-only, but not rep activity detail `[04 Q10]`."*
  `04` is user truth; `CLAUDE.md` ranks it 11th, above `09` and `01`.
- **`16 §8` decides the opposite.** The coordinator gets **quotation threads
  only** — *"It grants nothing else. The coordinator gets no company, no contact
  and no project visibility from it"* — and explicitly rejects the wider grant:
  *"Granting the coordinator `sees_all_reps` … exposes every company, contact
  and project to internal sales — far past `07 A5`."*
- **`18 §2` restates the same premise as a problem to be worked around**: *"a
  coordinator can see **zero companies**"*, and fixes it with a name-only search
  rather than the read-across `04 Q10` granted.
- **The code implements `16 §8` / `18 §2`.** `visibleCompaniesFilter`
  ([authz.ts:443](src/lib/authz.ts#L443)) is membership-or-share with no
  coordinator term; `dispatchCompanyLookupFilter`
  ([authz.ts:714](src/lib/authz.ts#L714)) grants names only.

Neither `16` nor `18` cites `04 Q10` or `01 §2.1`, so the later-wins rule
resolves it silently and `01 §2.1` still reads as current. The same applies to
`04 Q10`'s second half — "but not rep activity detail" — which `20 §10`'s
anchor-following visibility now decides on different grounds.

### 1.2 `07 A5`'s "no operational data entry" for the executive

Three documents cut the executive's boundary differently and only one of the
three cuts is recorded as a reversal:

| Source | What it says |
|---|---|
| `07 A5` | executive does "monitoring, changing targets, seeing everything. **No operational data entry**" |
| `11 §1` | takes the narrow reading — no `can_manage_users` |
| `12 §3` | grants `can_manage_users`, exports, delete approval, duplicate resolution, credit splits; states `11 §1` "is amended" |
| `14 §3` | "**On the question of editing records, that prose is superseded.**" |

`14 §3` is in `CLAUDE.md`'s reversal list; `12 §3`'s amendment of `11 §1` is
recorded inside `12` itself. What is not recorded anywhere is that creating a
user, approving a delete and setting a credit split are each operational acts by
`07 A5`'s own wording, so `07 A5`'s sentence now stands corrected on four
separate counts while still reading absolutely. `11 §1`'s reasoning paragraph
("Creating users is data entry") is left in place, arguing for a conclusion `12
§3` reversed.

### 1.3 `09 §16`'s table inventory is factually wrong about the schema

`09 §16` lists "Thirty-five tables" and includes **`project_company_roles`**,
which `12 §5` dropped and migration `0002` removed. It omits four tables that
now exist: `company_dormancy_reviews` (`21 §10`), `rep_report_signals`
(`20 §13`), `notification_types` (`10 §10`, built in `0000`) and the Auth.js
tables the same document acknowledges elsewhere (`09 §2.2`). `09 §3.6` still
presents `project_company_roles` as a table that "must be a table", citing
`07 A3` — the exact statement `12 §5` corrects.

### 1.4 `01 §7.3` versus `12 §7` on what "no invoice records" means

`01 §7.3` infers that FACET keeps no invoice records and flags the inference for
confirmation (`01 §13.20`). No later document confirms or denies it. `04 Q13`
("Do coordinators also enter invoice records?" → "Yes") remains unreconciled
with `04 A1`'s "invoicing stays in SMAC" other than by `01`'s own inference,
which `01` labels as an inference. This is listed here rather than in §5 because
`01 §13.20` asks for a confirmation that never arrived, and the schema has
already been built on the unconfirmed reading (no invoice table).

### 1.5 `19 §8` cites `CLAUDE.md` for a fact that has moved

`19 §8` states: *"`CLAUDE.md` records that its final UPDATE is the one statement
never executed in process because no screen starts impersonation."* Since
`23`'s creation on 2026-08-12 that passage lives in `docs/23-verification-log.md`
("Impersonation … **One gap, stated rather than papered over**"), and the current
`CLAUDE.md` does not mention impersonation at all. The claim is still true; the
pointer is not.

### 1.6 `05-roadmap.md` disagrees with the repository on four counts

- **Status column.** Phase 3 is marked "← next" while phases 8, 8b, 9, 10a and
  11 are marked done. Phases 5 (schema), 6 (auth) and 7 (Slice 1) carry no
  status at all although `11`, `13`, `14` and the migrations record them as
  complete.
- **Skills.** The table lists four project skills to create —
  `facet-business-rules`, `facet-db`, `facet-ui`, `facet-module`. Only
  `.claude/skills/facet-ui` exists, plus `facet-verify`, which the roadmap does
  not mention. `CLAUDE.md` names the two that exist.
- **Phase 10.** `21`'s scope note says *"`05`'s phase 10 is 'follow-ups,
  duplicates, notifications'"*. The roadmap row actually reads "10a — Follow-ups
  and notifications" and "10b — Duplicates and merge", i.e. `21` quotes a
  version of the row that is no longer there.
- **Model routing.** The models table routes implementation to Sonnet and
  file operations to Haiku; `CLAUDE.md` points at this file for "current phase
  and model/skill routing", so the stale rows are load-bearing.

### 1.7 Two `[04 Q6]` restatements that `20 §10` superseded are still asserted

`20 §10` supersedes `04 Q6`'s "activities are private to the rep, without
exception" and names both restatements — `01 §4.1` and `09 §8.1`. This reversal
**is** in `CLAUDE.md`'s list, so it is not a hidden contradiction; it is recorded
here because both restatements still read absolutely (see §2.2 and §2.3), and
because `src/db/schema.ts`'s `activities` doc block repeats the superseded
sentence verbatim before explaining that the table stays empty
([schema.ts:1259](src/db/schema.ts#L1259)).

---

## 2. Superseded rules whose original text still reads the other way

`10 §9` is the only place in `docs/` where a superseded passage carries a
forward-pointing note (added 2026-08-12, commit `f9b3241`). Every item below is
the same shape and has no such note. They are listed in descending order of how
likely the stale text is to be read as current.

| # | Superseded text | Reads as | Superseded by | Note present? |
|---|---|---|---|---|
| 2.1 | `01 §11` "Working days belong to the rep" — the whole section | current rule | `07 D6`, restated `20 §7`, `21 §8` | none. `09 §2.2` says "`01 §11` … is overridden", but `01` itself is silent |
| 2.2 | `01 §4.1` "**Activities are private to the rep**, without exception" | current rule | `20 §10` | none |
| 2.3 | `09 §8.1` "**Private to the rep**, without exception `[04 Q6]`" | current rule | `20 §10` | none |
| 2.4 | `09 §4.2` "percentage (null for a contributor row)" | current column meaning | `18 §6` (contributor withdrawn) | none in `09`; `schema.ts` corrected its own comment |
| 2.5 | `09 §3.5` "**exactly one** linked company is flagged as the buyer" | current constraint | `12 §6` (zero or one) | none |
| 2.6 | `09 §3.6` `project_company_roles` "must be a table" | current table | `12 §5` (free text; table dropped) | none |
| 2.7 | `09 §5.4` line references "form factor (sheet or coil)" and a colour lookup | current model | `12 §11` (sheets only), `17 §2` (colour typed) | none |
| 2.8 | `09 §5.6` `product_colours` "many; lookup vs free code is OPEN" and `product_suppliers` "N, K, D, C, G, G1, Y" | current lookups | `17 §1`, `17 §2` | none |
| 2.9 | `09 §2.2` "`07 D6` supersedes that with a global Friday/Saturday weekend **and a two-day grace for everyone**" | current rule | `20 §7` removed the grace entirely | none |
| 2.10 | `10 §5` specifications key on class + fire rating + thickness | current key | `12 §9` (supplier added) | none — `10 §9` two sections later has one |
| 2.11 | `07 D3` "A rep helping without a split is recorded as a **contributor**" | current requirement | `18 §6` | none |
| 2.12 | `07 D6` "two-day grace, no automatic penalty" | current rule | `20 §7` | none |
| 2.13 | `07 E5` act-now notifications as described before persistence | current rule | `07 G1`, same document | `G1` says "supersedes E5"; `E5` does not point forward |
| 2.14 | `07 E4` "Desktop-first; mobile as helper" | current rule | `07 G2`, same document | as above |
| 2.15 | `08 B1` seven supplier codes; `08 B2` "Two form factors"; `08 D6` specifications on "the product record" | current model | `17 §1`; `12 §11`; `10 §5` then `12 §9` | none |
| 2.16 | `12 §12` "`product_colours` remains a lookup for the standard codes" | current design | `17 §2` (lookup never used) | none |
| 2.17 | `04 §16` / `04 C4` per-rep working days | current requirement | `07 D6`, `20 §7`, `21 §8` | none |
| 2.18 | `20 §14` "**The three follow-up thresholds not seeded** `[§11]` … Phase 10" | still open | `21 §2` seeded all three | none |
| 2.19 | `16 §10` "`product_suppliers` and `product_colours` are still empty" | still open | `17 §6` states it closed | none in `16` |

Three of the same shape exist in `src/` rather than in `docs/`, and are recorded
here because they are the schema's own documentation:

- [schema.ts:1419-1423](src/db/schema.ts#L1419-L1423) — the `tasks` doc block
  still describes `10 §9`'s design: *"System follow-ups are generated from the
  threshold settings `[07 D5]` and carry the trigger that created them, so a
  follow-up can close itself when the underlying condition clears `[10 §9]`."*
  `21 §1` declined that design; `tasks.system_trigger` is permanently unused.
- [schema.ts:934](src/db/schema.ts#L934) — `product_suppliers` is annotated
  "N, K, D, C, G, G1, Y `[08 B1]`". `17 §1` dropped G, G1 and Y.
- [schema.ts:342](src/db/schema.ts#L342) — "`07 D6` supersedes that with a global
  weekend **and a grace for everyone**". `20 §7` removed the grace; the same file
  says so correctly 970 lines later ([schema.ts:1315](src/db/schema.ts#L1315)).

---

## 3. Rules stated in a document that nothing in `src/` implements

Distinguished below between **unscheduled** (no document assigns them to a
phase) and **scheduled** (a document or `05` places them in a later phase).
Unscheduled items are the ones a reader would reasonably expect to find built.

### 3.1 Unscheduled

| Rule | Source | State in `src/` |
|---|---|---|
| **Deletes are requests.** "Deleting requires a stated reason and goes to the manager as a request"; on a shared company granting removes only the requester's membership | `04 Q8`, `01 §4.3`, `09 §4.3` | `delete_requests` is referenced only by `src/db/schema.ts`. No screen, no action, no data-layer function. `can_approve_delete` is seeded to three roles and read by nothing |
| **Sharing is manager-initiated and revocable** — the whole share write path | `07 B1`, `04 Q7`, `09 §4.1` | `record_shares` is **read** by `authz.ts` and never written. `can_share` is seeded to Super Admin and Sales Manager and read by nothing. `21 §11` records this, so it is known — but no document schedules the screen |
| **Bulk export is super-admin only, and every export is audited** | `07 B8`, `07 E1`, `06 B5` | No export path of any kind. `can_export` is seeded to Super Admin and Executive and read by nothing |
| **A departing rep's records are "marked `owner inactive`"** | `07 B7`, `09 §2.2` ("by *deriving* from this flag") | No derivation and no marker. `users.is_active` is displayed only on `/users`; no company, project, quotation or dispatch list indicates an inactive owner |
| **ERP references … can be corrected** | `04 A2`, `09 §1`, `09 §5.3` | `smac_reference_verification` is written once by `issueVersion` ([quotations.ts:1441](src/lib/quotations.ts#L1441)), which refuses a second call. There is no path to correct a mistyped reference short of creating a revision |
| **Quotation terms default from `settings`**; bank details are print-time boilerplate from `settings` | `08 D9`, `09 §10.1`, `09 §10.2` | `settings` holds only the five follow-up thresholds ([settings.ts](src/lib/settings.ts)). `deliveryPeriod` / `paymentMethod` / `shipmentTerms` arrive from the form with no defaults, and nothing reads or writes bank details |
| **Contact completeness as a derived diagnostic on the rep's dashboard** | `10 §3` | `contacts.email` and `.position` exist and are edited; nothing computes or displays completeness. `grep -i completeness src/` returns nothing |
| **Two pipelines** — "the main CRM is filtered to qualified leads; unqualified leads sit in a separate, lighter pipeline", i.e. a filter over one table | `04 B3`, `01 §5.4`, `10 §2` | `isQualified` is derived and **displayed** on the company list ([companies.ts:133](src/lib/companies.ts#L133)); there is no filter control and no second view. `listCompanies` accepts only `q` and `page` |
| **"A rep can never set his own [split]"** | `12 §1` | `setCreditSplit` ([credit-splits.ts:150](src/lib/credit-splits.ts#L150)) checks `can_set_credit_split` and never compares the members against the actor. Reps do not hold the flag, so the rule holds today by role configuration rather than by code; a coordinator or manager may include themselves |
| **Progressive requirement** — "fields become required progressively in the application layer" | `09 §3.1`, `10 §2` | Only `name_en` is required, unchanged since Slice 1. `14 §6` and `15 §8` record this as `OPEN`, so it is a known non-implementation of a stated rule rather than a gap |
| **Print-time rendering of the specifications block** | `08 D6`, `10 §5`, `12 §9` | `product_specifications` is referenced only by `src/db/schema.ts`. No seed, no reader, no print or PDF path exists at all |
| **Attachments** — record type, id, path, uploader | `03`, `09 §13.1` | Table exists, nothing writes it. `03` says so explicitly, so this is by design |

### 3.2 Scheduled to a later phase

Listed for completeness; each is placed by a document or by `05`.

- Duplicate detection at entry, the manager's queue, false-flag memory and merge
  — `07 B5`, `07 B6`, `09 §7`. `duplicate_flags` and `non_duplicates` are
  referenced only by the schema; `can_resolve_duplicate` is read by nothing.
  Phase **10b** (`05`, `21` scope note).
- Monthly snapshots — `07 E2`, `10 §11`, `09 §12`. Both tables unreferenced
  outside the schema; `12 §15` defers the job to Phase 12.
- Conversion measures — `07 D4`. Nothing computes SQM-weighted acceptance or
  cohort first-order rate. Phase 12.
- Performance formula — `04 B3`, `01 §13.2 #3`. Explicitly undecided, so nothing
  to implement.
- Signal aggregation — `20 §4`, `20 §14`. The reference column and its index
  exist so the question needs no migration; no screen asks it. Phase 12.
- Bulk import — `05` phase 11 row, `19 §8`. Not built, recorded as deferred.
- Password reset / change UI — `11 §5`, `12 §15`, `19 §8`. Not built.
- Impersonation UI — `07 A5`, `07 A6`. `startImpersonation` and
  `stopImpersonation` exist and are guarded; no screen calls
  `startImpersonation`. `19 §8` and `23` record this.
- A scheduler. `16 §3` and `21 §10` both say the sweep is "the one function a
  scheduled job will call when there is one". `sweepNotifications` is called
  from exactly one place — `/notifications` page load
  ([notifications/page.tsx:52](src/app/[locale]/(app)/notifications/page.tsx#L52))
  — and `expireOverdueThreads` from the quotation reads. No job exists, which is
  what those two sections describe.

---

## 4. Code in `src/` implementing a rule no document states

Each entry is code that decides something; none is a naming or layout choice.
Where the code carries its own reasoning, that is quoted rather than judged.

### 4.1 Dormancy reassignment removes **every** live membership

`reassignCompany` ([dormancy.ts:209-232](src/lib/dormancy.ts#L209-L232)) soft-
removes every live `company_reps` row on the company, not only the row of the
rep it is taking the company from, then inserts one for the recipient as
primary. `21 §6` route 2 says only *"Reassigned to another rep"*. `04 Q3` and
`09 §3.2` establish that several reps may legitimately share one company, and
`07 B7`'s handover (`team.ts`) moves memberships one at a time. So a
reassignment of a shared company silently strips the other reps, and no document
states that outcome either way.

### 4.2 Archiving requires a written note

`archiveCompany` ([dormancy.ts:299-313](src/lib/dormancy.ts#L299-L313)) refuses
without a note (`dormancy.errors.noteRequired`). `21 §6` route 3 and `21 §7`
make the note **optional** (`company_dormancy_reviews.note` is nullable, and
`21 §7` says "an optional note"). The code's comment derives the requirement by
analogy: *"for the same reason `10 §8` requires one on a cancellation"*. `10 §8`
is about quotation cancellation.

### 4.3 `can_set_credit_split` reaches every project that exists

`projectReachable` ([credit-splits.ts:119-132](src/lib/credit-splits.ts#L119-L132))
bypasses `canViewRecord` for flag holders, so a coordinator may both set and
**read** the credit split of any project in the database. `12 §1` grants the
flag; `16 §8` and `18 §2` are the two documented reach extensions and neither
covers projects. The code states the reasoning and cites `16 §8` as precedent —
that is a derivation from precedent, not a documented rule.

### 4.4 What counts as a "response" to an issued quotation

`quotationNoResponse` ([follow-ups.ts:176-242](src/lib/follow-ups.ts#L176-L242))
defines the condition as: no end state, no payment confirmed, the version still
the live `issued` one, and no interaction report against the company since the
issue date. `07 D5` gives only the threshold ("Quotation, no response — 5
working days"). The module says so plainly — *"**What counts as a response** is a
reading of `07 D5`, stated here rather than left in the query"* — and no
document ratifies it.

### 4.5 What counts as a project's "stage" moving

`projectStageUnchanged` ([follow-ups.ts:347-442](src/lib/follow-ups.ts#L347-L442))
defines a stage-advancing event as a quotation thread created on the project, a
payment confirmed on one of its threads, or a dispatch against one, falling back
to the project's creation date. `07 D5` says "Project stage unchanged — 21 days";
`09 §15.11` flags that **no document defines a stage field, its value list or
its owner entity**, and that item is nowhere closed. The chosen event set is the
code's.

### 4.6 The catalogue follow-up reads "most recent interaction"

`catalogueNoResponse` ([follow-ups.ts:272-332](src/lib/follow-ups.ts#L272-L332))
fires only when the company's **latest** interaction is `catalogue_sent`. `07 D5`
says "Catalogue sent, no response — 10 working days" and nothing more.

### 4.7 Suppression rules layered on top of every follow-up kind

`gather` / `suppressedCompanies` ([follow-ups.ts:561-591](src/lib/follow-ups.ts#L561-L591))
suppress **all four** kinds for an archived company, a merge tombstone, an
active `on hold`, or a re-inclusion inside one threshold period. `20 §5` scopes
`on hold` to follow-ups generally, and `21 §7` scopes a re-inclusion to *"that
company's quiet follow-up"* — the singular kind. Applying it to the quotation,
catalogue and project kinds as well is a broader reading than `21 §7` states.

### 4.8 The digest is generated only for a completed day, and only for the previous one

`generateDigests` ([notifications.ts:398-426](src/lib/notifications.ts#L398-L426))
writes one digest for `today - 1` and never for today. `20 §9` requires end-of-day
settled state; `21 §1` requires "one digest notification per recipient per day".
That the day is *yesterday specifically*, and that a recipient with nothing open
gets no row at all, are both the code's decisions. The module states the second
one: *"A user with nothing open gets no row: a daily notification saying
'nothing' is noise."*

### 4.9 A same-day second credit-split write forms its own generation

`generationInForce` ([credit-splits.ts:249-258](src/lib/credit-splits.ts#L249-L258))
groups a generation by `effective_from` **and** `created_at`, so the later write
wins a same-day tie. `18 §4` explicitly records this as `OPEN — not chosen` —
"nothing is engineered beyond that" — so the behaviour exists without a decision
behind it, by acknowledgement.

### 4.10 Service VAT at the version, at the default rate

`recomputeVersionTotals` ([quotations.ts:970-982](src/lib/quotations.ts#L970-L982))
taxes service lines at `DEFAULT_VAT_RATE` because `quotation_service_lines` has
no rate column. `16 §1` states this and marks the underlying question
`OPEN — not chosen`; it is listed here because a version's `total_vat` is a
stored figure the business reads, computed from a rate no document assigns.

### 4.11 A line may not be the last one removed; a project may not lose its last company

`removeQuotationLine` refuses when one line remains
([quotations.ts:1302](src/lib/quotations.ts#L1302)); `removeProjectCompany`
refuses the last live link ([projects.ts:619](src/lib/projects.ts#L619)). The
second is `07 A9` restated by `14 §4`. The first — that a quotation version must
always carry at least one product line — is stated by no document;
`createQuotationThread` enforces the same rule on creation
([quotations.ts:1162](src/lib/quotations.ts#L1162)).

### 4.12 Page size, search fields and note length

`PAGE_SIZE = 25` appears in eight modules, `FOLLOW_UP_PAGE_SIZE = 25`,
`TIMELINE_CARD_LIMIT = 20`, `TIMELINE_PAGE_SIZE = 25`, `NOTE_MAX = 500`
([dormancy.ts:125](src/lib/dormancy.ts#L125)), `SIGNAL_REFERENCE_MAX = 200`
([enums.ts:156](src/lib/enums.ts#L156)), `MIN_PASSWORD_LENGTH = 8`
([authz.ts:754](src/lib/authz.ts#L754)) and a two-character minimum on the
dispatch company search ([dispatches.ts:583](src/lib/dispatches.ts#L583)). Only
the 20-entry timeline card is documented (`20 §6`); the code labels the rest as
display details. `18 §2` says "a typed query of two or more characters", so that
one is documented.

### 4.13 The chain's authorization details

Three gates are derived rather than stated: `assertVersionEditable` allows line
edits only while the live version is `requested`
([quotations.ts:859](src/lib/quotations.ts#L859)); `confirmPayment` refuses on a
cancelled or rejected thread but permits it on an expired one
([quotations.ts:1835](src/lib/quotations.ts#L1835)); `createRevision` allows a
rep-originated revision on visibility alone and requires the coordinator flag
only for `coordinator_direct_edit` ([quotations.ts:1535](src/lib/quotations.ts#L1535)).
`07 C2` describes both routes producing a version without saying who may take
which.

### 4.14 A revoke withdraws the notification the grant raised

`sweepNotifications` resolves a live `share.granted` once the share behind it has
been revoked and no live one replaces it
([notifications.ts](src/lib/notifications.ts)). No document states this.

It is derived from `21 §4` rather than invented against it: that section makes a
type persistent **only** where its resolution condition *"can actually become
true"*, and `21 §3`'s single condition for `share.granted` — the grantee logs an
interaction against the anchor's company — becomes unreachable the moment the
share is revoked, because `createReport` requires `canViewRecord` on that
company. Left alone, a revoke produces exactly the badge `21 §4` exists to
forbid.

**`RESOLUTION_RULES` is deliberately not extended.** That table is what the
recipient can do and the screen renders it to them as advice; this is the system
withdrawing an announcement, which is a different kind of thing.

### 4.15 A second live share of one record on one person is refused

`grantShare` throws `sharing.errors.alreadyShared` rather than writing a second
unrevoked row ([sharing.ts](src/lib/sharing.ts)). No document asks for it. The
reason is structural rather than a business rule: two live rows for one
(record, person) make the panel's revoke control ambiguous about which row it
ends. Re-granting **after** a revoke is unaffected, and is a new row `[12 §7]`.

### 4.16 A grant to somebody who already holds the record is NOT refused

Stated here because it was decided rather than missed. `shareableUsers` does not
exclude the record's owner, its company members or a thread's raiser, and
`grantShare` does not refuse them — so a manager can share a company with the
rep whose company it is, writing a row that grants nothing new and raising a
persistent notification about access they already had.

No document asks for the refusal, and *"already holds it"* is a different
question for each of the three record types — membership, ownership, raisership.
Inventing the rule is what CLAUDE.md forbids, so it is `5.1 #37` instead.

---

## 5. The consolidated OPEN register

Every item any document marks `OPEN`, "still open", "not chosen" or "to be
confirmed", with where it was first raised and whether a later document closed
it. **Age is measured from first commit to 2026-08-12.** The whole corpus is
four days old, so age separates the founding documents (`01`, `04`, `07` — 4
days) from the slice documents (`17`–`21` — 2 days) rather than marking anything
as neglected.

### 5.1 Still open

| # | Item | First raised | Age | Restated in |
|---|---|---|---|---|
| 1 | **Performance formula** — which inputs, what weights | `04 D3` (2026-08-08) | 4 d | `01 §13.2 #3`, `06 B3`, `20 §14`, `21 §11` |
| 2 | **Does marketing assign, or only propose?** `04 Q9` grants the ability; `04 Q19` has the manager decide | `01 §13.12` (2026-08-08) | 4 d | never revisited; `07 B3` grants `can_assign` without addressing the tension |
| 3 | **Where loss sits in the funnel** — the funnel has no `lost` stage | `01 §13.19` (2026-08-08) | 4 d | never revisited |
| 4 | **Confirm FACET keeps no invoice records** — an inference across `04 A1`, `04 Q13`, `04 flow 15` | `01 §13.20` (2026-08-08) | 4 d | never revisited (see §1.4) |
| 5 | **Password reset / change UI** | `11 §5` (2026-08-09) | 3 d | `12 §15`, `19 §8`, `21 §11` |
| 6 | **Auth-bridge escape hatch** — first-party session if the `jwt.encode` bridge becomes impossible | `11 §4.1` (2026-08-09) | 3 d | — |
| 7 | **Automating the rest of the auth checklist** — login, cookie shape, impersonation's own UPDATE, sign-out | `11 §4.1` (2026-08-09) | 3 d | `12 §15`; `verify:phase11 §6` took the deactivation half (`23`) |
| 8 | **Cross-script duplicate matching** (Arabic ↔ English transliteration) | `14 §6` (2026-08-09) | 3 d | `15 §8`, `16 §10`, `17 §6`, `18 §8`, `19 §8`, `20 §14`, `21 §11` |
| 9 | **When fields become required** | `14 §6` (2026-08-09) | 3 d | same chain as #8 |
| 10 | **Who maintains lookups** — no screen edits cities, lead sources, categories, service types, products, or the `settings` thresholds | `15 §8` (2026-08-09) | 3 d | same chain as #8 |
| 11 | **Whether a service line ever needs its own VAT rate** | `16 §1` (2026-08-09) | 3 d | `17 §6`, `18 §8`, `19 §8`, `20 §14`, `21 §11` |
| 12 | **Whether the VAT default moves to `settings`** | `16 §2` (2026-08-09) | 3 d | same chain as #11 |
| 13 | **Whether a `requested` version expires** — and, since `21`, whether it raises a follow-up | `16 §7` (2026-08-09) | 3 d | `17 §6`, `18 §8`, `21 §11` |
| 14 | **Whether suppliers ever get real factory names** | `17 §1` (2026-08-10) | 2 d | `18 §8`, `19 §8` |
| 15 | **Whether two credit-split generations may be set on the same day** | `18 §4` (2026-08-10) | 2 d | `19 §8`, `20 §14`, `21 §11` |
| 16 | **Whether uncredited help is recorded at all** | `18 §6` (2026-08-10) | 2 d | same chain as #15 |
| 17 | **Dispatch against a thread cancelled *after* payment** | `18 §8` (2026-08-10) | 2 d | same chain as #15 |
| 18 | **Whether a second `can_dispatch` holder should approve a direct dispatch** | `18 §8` (2026-08-10) | 2 d | same chain as #15 |
| 19 | **Whether the last active `can_manage_users` holder may be deactivated** | `19 §5` (2026-08-10) | 2 d | `20 §14`, `21 §11` |
| 20 | **Promotion to primary on handover** — a company can end with no primary rep | `19 §8` (2026-08-10) | 2 d | `20 §14`, `21 §11` |
| 21 | **Whether offboarding revokes a departing user's `record_shares`** | `19 §8` (2026-08-10) | 2 d | same chain as #20 |
| 22 | **Whether the handover screen serves `04 C2`'s long-leave case** | `19 §3` (2026-08-10) | 2 d | `19 §8`, `20 §14`, `21 §11` |
| 23 | **Bulk import** | `05` phase 11 row / `19 §8` (2026-08-10) | 2 d | `20 §14`, `21 §11` |
| 24 | **The impersonation UI** | `19 §8` (2026-08-10) | 2 d | `20 §14`, `21 §11`, `23` |
| 25 | **Where signals are aggregated** | `20 §14` (2026-08-10) | 2 d | `21 §11`; Phase 12 |
| 26 | **Whether warmth should follow from reports** | `20 §14` (2026-08-10) | 2 d | `21 §11` |
| 27 | **Whether a merge moves reports** — and, since `21`, notifications and follow-ups | `20 §14` (2026-08-10) | 2 d | `21 §11`; Phase 10b |
| 28 | **Whether `on hold` should also suppress the daily view** | `20 §14` (2026-08-10) | 2 d | — |
| 36 | **Whether a rep may request a share in the system** — `07 B1` has them phone; feature slice 3 kept it that way and built only the manager's side. `07 B4` is the precedent (the assignment call stays a call) and `25 §15` the general rule. Reopening it needs a user-truth document, and a seventh notification type to tell the manager `[21 §2]` | slice 3 (2026-08-13) | 0 d | — |
| 37 | **Whether a share may be granted to somebody who already holds the record** — its owning rep, a company member, the thread's raiser. Allowed today: it writes a row granting nothing new and raises a persistent notification about access they already had. See §4.16 | slice 3 (2026-08-13) | 0 d | — |
| 30 | **The overlap notification** `04 Q6` asked for | `21 §2`, `21 §11` (2026-08-10) | 2 d | — |
| 31 | **A holiday calendar** — Eid and national holidays are not skipped | `21 §8`, `21 §11` (2026-08-10) | 2 d | — |
| 32 | **Weekly digests** — `07 E5` allows "daily or weekly"; only daily is built | `21 §11` (2026-08-10) | 2 d | — |
| 33 | **Notification preferences** — who may mute what | `21 §11` (2026-08-10) | 2 d | — |
| 34 | **Snapshot job scheduling** | `12 §15` (2026-08-09) | 3 d | Phase 12 |
| 35 | **Whether specifications key correctly on supplier + class + fire rating + thickness** — `10 §5` asked for confirmation with a coordinator; `12 §9` widened the key without recording that confirmation | `10 §5` (2026-08-09) | 3 d | `10 §13.12`, closed *procedurally* by `12 §9` |

### 5.2 Closed, and by what — recorded so they are not re-opened

`04 D1` → `12 §4` · `04 D2` → `18 §3` · `04 D4` → `07 D5` · `04 D5` → `07 C7` ·
`04 D6` → `10 §2` · `01 §13.7` → `07 A5` · `01 §13.8` → `12 §5` ·
`01 §13.9` → `07 A2` · `01 §13.10` → `07 A1` + `21 §1` · `01 §13.11` → `07 B1` ·
`01 §13.13` → `07 B4` · `01 §13.14` → `07 A7` · `01 §13.15` → `08` ·
`01 §13.16` → `09 §5.3` (`return_for_edit_round`) · `01 §13.17` → `07 C3` ·
`01 §13.18` → `07 C4`, `10 §8` · `01 §13.21` → dissolved by `20 §7` ·
`01 §13.22` → `07 D1` · `01 §13.23` → `07 B5` · `01 §13.24` → `21 §2` ·
`07 F1` → `12 §1` · `07 F2` → `07 G3` · `07 F3` → `12 §2`, `13 §3` ·
`07 F4` → `12 §3` · `07 F5` → `12 §4` · `07 F6` → `12 §5` · `07 F7` → `12 §7` ·
`07 F8` → `08` · `08 E1` → `12 §8` · `08 E2` → `12 §10` · `08 E3` → `12 §13` ·
`08 E4` → `12 §13`, `16 §5` · `08 E5` → `12 §11` · `08 E6` → `12 §12`, `17 §2` ·
`09 §15.1` → `11 §1`, `12 §2`, `12 §3` · `09 §15.2` → `10 §6` ·
`09 §15.3` → `10 §3` · `09 §15.4` → `10 §7`, `15 §4` · `09 §15.5` → `10 §4` ·
`09 §15.6` → `10 §5`, `12 §9` · `09 §15.7` → `10 §9`, overruled by `21 §1` ·
`09 §15.8` → `21 §2` · `09 §15.9` → `10 §11` · `09 §15.10` → `10 §2` ·
`09 §15.12` → `10 §8` · `10 §13` (all twelve) → `12 §15` ·
`16 §10` first item → `17 §4` · `16 §10` empty-lookup item → `17 §6` ·
`20 §14` "three thresholds not seeded" → `21 §2` ·
**`21 §11` "no share write path"** → feature slice 3, which built
`src/lib/sharing.ts` and the panel on the three record types a share grants
something on. `share.granted` now has a producer, so `21 §2`'s test — a type is
seeded only where a document names it **and** something raises it — holds again
for all six seeded types.

**Item 21 sharpens rather than closes.** *"Whether offboarding revokes a
departing user's `record_shares`"* was theoretical while nothing wrote a share
row. Shares now exist, `19 §7`'s handover moves four buckets and none of them is
a share, and a deactivated user keeps every row granted to them —
`getSession` refuses them a session, so nothing leaks today, but reactivation
restores access nobody re-granted.

**`09 §15.11` — "where funnel/stage state lives" — is the one `09 §15` item no
document closes.** `10 §1` settles that qualification is derived and warmth is
set, but neither addresses the project stage that `07 D5`'s 21-day threshold
depends on. `src/lib/follow-ups.ts` answers it in code (§4.5).

---

## 6. Referencing and orphans

**No document is unreferenced.** `CLAUDE.md`'s authority list names all 22
documents `00`–`21` plus `23`. Inbound references from *other documents*:

| Document | Referenced by other documents |
|---|---|
| `23-verification-log.md` | **none** — referenced only by `CLAUDE.md`. It is also the only file in `docs/` not yet committed to git (untracked as of 2026-08-12) |
| `03-stack.md` | `01 §4.4`, and by tag `[03]` in `09 §1` and `schema.ts`. Never by a decision document after `09` |
| `05-roadmap.md` | `19 §8` and `21`'s scope note only |
| `02-history-extract.md` | `01`, `04`, `05`, `09 §15.12`, `20 §4` |
| `06-strategic-review.md` | `07`, `08`, `12`, `16 §1`, `19 §3`, `20 §11` — always as an explicitly non-authoritative proposal |
| `00-legacy-findings.md` | `01`, `03`, `04`, `05`, `06`, `08`, `21 §10`, `23` |
| all others | densely cross-linked; `04`, `07`, `08`, `12` are the most cited |

Two structural observations:

- **There is no `docs/22-*.md`, and there never was.** `git log --all` shows no
  file at that number. The sequence runs `00`–`21`, then `23`. `CLAUDE.md`'s
  authority list numbers its *entries* 1–24, which is a separate numbering and
  does not correspond to document numbers — a reader matching "item 22" in
  `CLAUDE.md` to a document number will land on `11 §4`.
- **`README.md` cites only five documents** (`03`, `05`, `07`, `12`, `15`) and
  is not part of the authority chain.

---

## 7. Citation errors inside the corpus

Recorded because a wrong section number sends a reader to an "OPEN" list instead
of the decision.

**`16 §8` is cited as `16 §10` in eight places in `src/`.** `16 §8` is *"The
coordinator sees every quotation, and only names behind it"*; `16 §10` is
*"Still open after this document"*. The affected lines:

- [authz.ts:359](src/lib/authz.ts#L359), [authz.ts:495](src/lib/authz.ts#L495),
  [authz.ts:502](src/lib/authz.ts#L502), [authz.ts:545](src/lib/authz.ts#L545),
  [authz.ts:705](src/lib/authz.ts#L705)
- [dispatches.ts:370](src/lib/dispatches.ts#L370)
- [quotations.ts:554](src/lib/quotations.ts#L554)
- [reports.ts:175](src/lib/reports.ts#L175), [reports.ts:681](src/lib/reports.ts#L681)
- [quotations/[id]/page.tsx:107](src/app/[locale]/(app)/quotations/[id]/page.tsx#L107)

`credit-splits.ts:162` and `dormancy.ts:183` cite `16 §8` correctly, and
`quotations.ts:174` cites `16 §10` correctly (it genuinely refers to the open
list). So the same rule is cited two different ways in the same repository.

**`18 §3` cites `04 D2` as the question it closes.** `04 D2` is correct
(`04 §D` item 2, shared-project SQM split); `01 §13.2` renumbers the same item as
`#2` under §13.1. Both citations appear; neither is wrong, but `04 D2` and
`01 §13.2` are the same question under two numbers, and `18 §3` says "It has
been open since" without naming the second.

**`12 §14.6`** is cited by `schema.ts:284` for `can_set_credit_split`. `12 §14`
item 6 says "confirm `can_set_credit_split` exists and is granted per §1" — the
citation is right; noted only because `12 §14` is a checklist rather than a
decision, and the flag's actual authority is `12 §1`.

---

## 8. What this audit did not check

- Translation coverage. `npm run check:messages` is the tool for that and was
  not run.
- Whether the screens behave as `docs/` describes. `23` records the HTTP passes;
  this audit read code, not behaviour, and ran none of the four checks or the
  five verify scripts.
- `legacy/**`, per `CLAUDE.md`'s hard rule.
- Whether any founder statement in `04`, `07`, `08`, `12`, `14`–`21` is
  faithfully transcribed. Only internal consistency was examined.
