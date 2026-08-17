# 10 — Schema Decisions

Closes the thirteen open items in `09-schema-design.md` §15 and rules on the
three proposals in §14.

**Status:** Sections marked **[founder]** are user truth. Sections marked
**[delegated]** were explicitly handed to the planning assistant and are agreed,
not proposals. Read alongside `09`; where this document differs, this wins.

---

## 1. Funnel and qualification — closes §15.11 **[founder + delegated]**

**Two separate things, deliberately.**

**Qualification is derived, never set by hand.** A company becomes qualified
when it requests a quotation `[04 qualification]`. The system knows this from
the event; nobody ticks a box. The working funnel — introduced → catalogue and
samples → documents → quotation requested → paid → dispatched — is computed
from what has actually happened.

**Warmth is set by the rep.** Alongside the derived stage, the rep records how
promising the company looks. This is the rep's judgement and it is the thing a
funnel view sorts by.

**Decision — a short list, not a percentage.** Cold / Warm / Hot / Dormant.

Percentages invite false precision and drift: nobody can distinguish 60% from
70%, and once a number exists someone will average it and present it as a
forecast. A four-value list is honest about what it is, reports cleanly, and
takes one click.

Stored with: value, set by, set at. Changes go to the audit log so warmth
history is visible — a company that went Hot → Cold in a week is worth a
manager's attention.

**Never combined into one field.** Derived stage answers "where is this in the
process"; warmth answers "what does the rep think". Merging them would let a
rep move a company forward without anything happening.

---

## 2. Unqualified leads — closes §15.10 **[delegated]**

**One `companies` table, filtered by derived qualification.** Not a separate
leads table.

Reasoning: at 100–500 companies a month, most never qualify — but a separate
table would mean duplicate detection running across two tables, merge logic
spanning both, and promotion meaning a row physically moves. Every one of those
is a bug source, and v1 already proved that the duplicate machinery is where
this system is fragile.

**What changes is the form, not the table.** Unqualified entry requires very
little — company name, phone, source, what they asked about. Fields become
required progressively as the company advances. The main CRM view filters to
qualified; the unqualified pipeline is a different filter on the same data.

---

## 3. Contacts — closes §15.3 **[founder]**

Contacts hold name (EN and AR), phone, **email**, **position/title**, plus
notes. Marketing will use these fields, so they are worth collecting properly.

**Completeness is measured and credited.** The founder wants reps credited for
completing contact detail. **Decision [delegated]:** a derived completeness
indicator per company — what proportion of its contacts have email and position
filled — shown as a **diagnostic on the rep's dashboard, not as a target**,
consistent with `07 D2` (targets are SQM only; everything else is shown
separately).

Completeness is objectively checkable, which makes it one of the safer things to
measure — a field is filled or it is not. It should still never enter the target
calculation.

---

## 4. Quotation request — closes §15.5 **[delegated]**

**The request is version 1.** No separate request table.

- Rep raises it: version 1, status `requested`, no SMAC reference
- Coordinator creates it in SMAC: the reference is filled in, status `issued`
- A revision creates version 2 carrying the `RE` number `[07 C2]`

One place for line items, one shape to render, and the rep's original ask stays
readable next to what was actually issued — which is exactly what someone wants
to see when a quotation comes back different from what was requested.

---

## 5. Product specifications — closes §15.6 **[delegated]**

`08 D6` and `08 D1` contradicted each other: one put specifications on "the
product record", the other abolished product records in favour of attribute
combinations. `08 D6` is corrected here.

**Specifications key off physical construction: class + fire rating +
thickness.** Not supplier, not colour — those change the code and the price, not
the technical description.

A `product_specifications` table on that three-part key holds the boilerplate
(description, manufacturing standards, alloy, layers, core, protective film,
colour availability) in **English and Arabic**, rendered onto the quotation at
print time.

**Confirm with a coordinator** that those three attributes fully determine the
specification text before seeding it.

---

## 6. Targets — closes §15.2 **[delegated]**

**Same-month changes are superseding rows, never edits.** `effective_from`
decides which row applies to a given date. Identical to the rule for past months
`[07 D1]` — no special case, and the history of who changed a target mid-month
stays visible.

---

## 7. Region and city — closes §15.4 **[delegated]**

On **companies**, **projects** and **users**.

Companies and projects carry the site or customer location. Users carry the
rep's base region, which makes "sales by rep's region" and "sales by site
region" two different and both-answerable questions. Province remains a label,
never an access boundary `[07 A7]`.

---

## 8. Cancellation — closes §15.12 **[delegated]**

**A written reason is required.** Cancellation is coordinator-only `[07 C4]` and
it kills a signed quotation — cheap to require, and the one field that makes the
audit entry worth reading.

---

## 9. Tasks — closes §15.7 **[delegated]**

Minimum viable shape, matching the three origins in `07 A1`:

title · description · origin (self / assigned / system) · assigned to ·
created by · linked record (type + id, optional) · due date · status (open /
done / cancelled) · completed at.

System-generated tasks carry the trigger that created them, so a follow-up can
close itself when the underlying condition clears — a quotation that gets a
response should not leave a stale task behind.

> **Overruled by `21 §1`.** A follow-up is a condition computed on read, not a
> record: **no task is written for one**, `tasks` stays empty and
> `system_trigger` stays permanently unused. The paragraph above describes a
> design FACET declined — `20 §9` fixes the timers as never fired and stored,
> and a task row would be a second copy of a derived fact. The shape and the
> three origins in this section still stand for the other two kinds, which are
> unbuilt. `21 §1` holds the reasoning.

---

## 10. Notifications — closes §15.8 **[delegated]**

**Type is a lookup, not an enum in code.** The full trigger list stays open;
`09` does not need it, because adding a type must be data, not a migration.

Each type carries: tier (**act-now** / **digest**), default channel, and whether
it is **persistent**. Per `07 G1`, act-now notifications stay until the
underlying action is resolved and cannot be dismissed.

**Resolution is by condition, not by click.** A notification clears when the
thing it points at is done. That is what makes persistence safe rather than
maddening.

---

## 11. Snapshots — closes §15.9 **[delegated]**

**`pipeline_snapshots`** — period, company or project, derived stage, warmth,
owning rep, expected sqm, value.

**`person_snapshots`** — period, person, target sqm, achieved sqm, quotations
raised, quotations accepted, dispatches, activity count, reports submitted.

Monthly by default, with the period selectable `[07 E2]`. Written by a scheduled
job, never edited afterwards. These are the only way to answer "what did March
look like" once March has moved on.

---

## 12. Rulings on §14 proposals **[delegated]**

| Proposal | Ruling |
|---|---|
| `service_types` lookup | **Accept.** CNC, cutting, bending, notching will change; a code change to add one is wrong |
| `lead_sources` lookup | **Accept.** Marketing channels will multiply — exhibitions, campaigns, referrals |
| `merge_events` | **Reject.** The tombstone plus audit log already covers it. Do not add a table for convenience |

---

## 13. Still open — not blocking schema

These affect seed data, constraints or later phases, not table shapes. Carried
forward from `07 F`, `08 E` and `09 §15.13`:

1. Shared-credit authority — manager or coordinator `[07 F1]`
2. Desk-rep role: confirm it exists and its flags `[07 F3]`
3. Executive vs super-admin boundary `[07 F4]`
4. Company category values `[07 F5]`
5. Project–company role vocabulary `[07 F6]`
6. Retention policy for archived records `[07 F7]`
7. Class vs fire-rating dependency — are invalid combinations possible `[08 E1]`
8. Service units — sqm, linear metres, or per piece `[08 E2]`
9. Price approval recording `[08 E3]`
10. Coil quantity unit `[08 E5]`
11. Colour lookup vs free code `[08 E6]`
12. Confirmation that specifications key on class + fire rating + thickness (§5)

Items 4, 5, 7, 8, 10 and 11 are answerable in one session with a sales
coordinator and a product list. Worth doing before seed data.
