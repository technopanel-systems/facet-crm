# 18 — Slice 3 Decisions (dispatch, credit splits, targets)

Answers given by the founder while planning Slice 3 — dispatch, credit splits,
targets and achievement, the last piece of the core sales loop. Each one closes
a question no earlier document answered, and each was needed before the first
dispatch screen could be written.

Three tables have sat in the schema since migration `0000` with no application
code touching them — `dispatches`, `project_credit_splits`, `targets` — and
three permission flags have been seeded and read by nothing: `can_dispatch`,
`can_set_credit_split`, `can_set_targets`. These decisions are what let all six
be used.

**Status:** Sections 1–6 are **[founder]** — user truth. Section 7 is
**[derived]**: it is the implementation reading of §1–6, not a separate rule.

**Authority:** user truth, alongside `04`, `07`, `08 §A–C`, `11 §1–3`, `12`,
`14`, `15`, `16` and `17`. This is the latest statement — where it corrects an
earlier document, this wins.

---

## 1. Credit with no split goes to the rep on the dispatch **[founder]**

`07 D3` says *"a single-owner project credits 100% to the owner"*. It does not
say what "the owner" resolves to when the dispatch names a rep and the project
names an owner and the two differ — which they can.

**The rep named on the dispatch takes the credit.** `dispatches.user_id` gets
100% whenever no credit split is in force.

Three reasons, the first decisive:

1. **`projects.owner_user_id` is a mutable, undated field.** Crediting the owner
   means reassigning a project `[07 A8]` would retroactively move credit for
   dispatches that already happened — which `07 D3` forbids in the very next
   sentence, and which `CLAUDE.md` forbids generally (*targets and shares are
   dated rows; changing one must not rewrite history*). `dispatches.user_id` is
   fixed at the moment of the event and no later act can rewrite it.
2. **It is the only rule that works for both cases.** A direct dispatch `[07 C6]`
   has no project at all, so it must credit the rep on the row. One rule beats
   two.
3. **`09 §6.1` says company, rep and SQM are "always present"** on a dispatch. If
   the rep on the row does not decide credit, the column means nothing.

For a genuinely single-owner project the two coincide, because the coordinator
records the dispatch against the rep whose deal it is. `07 D3`'s intent is
satisfied; only its wording is made precise.

**This is the normal path.** Splits are rare (§3). Almost every dispatch credits
one rep, in full, by this rule.

---

## 2. `can_dispatch` reaches company **names**, and every dispatch row **[founder]**

**The problem this answers.** Sales Coordinator holds `can_dispatch` and
`sees_all_reps: false`, and holds no `company_reps` memberships — they are not a
rep on companies. `visibleCompaniesFilter` is membership-or-share, so a
coordinator can see **zero companies**. A direct dispatch `[07 C6]` requires
naming one. Without an extension, the only role holding the flag could not record
a direct dispatch at all — the identical dead-flag shape `16 §8` was written to
fix for `can_approve_quotation`.

**The answer, and its exact boundary.** `can_dispatch` grants two things and
nothing else:

1. **Searching companies by name** on the dispatch form. A typed query of two or
   more characters returns matching names; the coordinator picks one.
2. **Seeing every dispatch row.**

**It grants nothing else.** No company record, no address, no contacts, no
projects, no link to open the company, no change to `/companies` or to
`canViewRecord`. What a coordinator sees of a company is its name — the same
concession `16 §8` already makes, extended by exactly one step for the same
reason.

**Search, not browse.** The form offers a search box, not a dropdown of every
company, so the route does not become a way to enumerate the customer base.

---

## 3. Credit is divided **equally** — and splits are rare **[founder]**

`04 D2` asked how shared credit divides: *equally, by a set percentage, by who
raised the quotation, or manually by the manager?* It has been open since.

**Equally.** The manager or coordinator picks **who** shares the credit. Nobody
types a percentage. An unequal split is not reachable, because no control exists
to express one.

This **closes `04 D2`** and **narrows `07 D3`, `09 §4.2` and `12 §1`**: the
manager or coordinator still *sets* the split, and `set_by` still records who —
but what they set is its **membership**, not its proportions. FACET computes the
shares.

**Splits are the exception, not the feature.** In almost every case the
responsible rep takes the full credit, and §1 is the normal path. The split is a
rare correction on top of it, and it is built as one: a small card on the project
screen, one function in the data layer, and nothing in the dispatch or target
flow that assumes a split exists.

**What does not change, however rare splits are:**

- **They are dated generations, never edits.** Each dispatch uses whatever split
  is in force on its own date, so changing a split must not rewrite past credit
  `[07 D3]`. This is not negotiable.
- **Recording a dispatch never sets a split** `[07 D3]`, `[12 §1]`. This is the
  guard against a rep taking full credit on shared work, and it is verified
  mechanically.
- **A rep can never set his own** `[12 §1]`.

---

## 4. A split may not be backdated **[founder]**

`effective_from` is today or later.

A share approved on Tuesday and recorded on Friday takes effect Friday. Dating it
back to Tuesday would re-credit every dispatch already recorded in between, which
is precisely what `07 D3` forbids.

Future dates stay allowed and useful — *"from the first of next month"*.

`OPEN — not chosen`: whether two generations may be set on the same day, and
which one wins. The read takes the greatest `effective_from` that is not in the
future, with the later write breaking a same-day tie; nothing is engineered
beyond that.

---

## 5. Never lose a square metre **[founder]**

Three reps sharing 100 m² is 33.333… each, and the columns hold two decimals for
percentage and four for square metres. The odd fraction must land somewhere.

**It lands on a rep, never nowhere.**

| | Rule |
|---|---|
| Stored percentage | the equal share to 2 dp, leftover units to the earliest rows, so a generation reads as **exactly `100.00`** — three reps store `33.34 / 33.33 / 33.33` |
| Credited square metres | the dispatch's own sqm divided equally at 4 dp by the same rule, so the shares add back to **exactly** the dispatch — `100.0000` becomes `33.3334 / 33.3333 / 33.3333` |

The sum of everyone's achieved square metres therefore always equals the sum of
everything dispatched. The alternative — identical `33.3333` shares leaving
`0.0001 m²` credited to nobody — was rejected: a number the business is measured
on may not quietly disagree with what went out of the door.

Where the two rules differ in the fourth decimal, **the square-metre rule wins**,
because that is the measured number; the stored percentage is the two-decimal
rendering of the same equality.

---

## 6. The contributor is withdrawn **[founder]**

`07 D3` ends: *"A rep helping without a split is recorded as a **contributor** —
visible, not credited."* `09 §4.2` and `schema.ts` carried it as a
`percentage`-null row.

**It is dropped.** No contributor row is written, no contributor appears on any
screen, and nothing in the data layer produces one.

It was an assistant proposal — `07 D3`'s contributor sentence sits under
**Decision (C)**, the delegated half of that section, not under the founder's own
statement — and it is a rare case inside a rare case (§3). Building it would put
machinery on a screen almost nobody opens, to express something nobody asked to
record.

**Consequences:**

- `project_credit_splits.percentage` is **always non-null**. The column stays
  nullable — no migration, and `CLAUDE.md` does not permit dropping structure on
  an assistant's judgement — but null becomes unreachable through every write
  path. The schema comment is corrected to say so rather than left claiming a
  meaning nothing produces.
- `07 D3`'s contributor line and `09 §4.2`'s "percentage (null for a contributor
  row)" are **withdrawn**, not merely deferred.

`OPEN — not chosen`: whether uncredited help should be recorded at all, and if so
whether a split row is the right place for it. Nothing depends on the answer
today.

---

## 7. What this means in the schema — nothing **[derived]**

Like `16 §9` and `17 §5`, this document forces **no migration**. Every column
Slice 3 needs was created by migration `0000`:

- `dispatches` — company, rep, sqm, the **nullable** quotation link `[07 C6]`,
  dispatch date, recorded-by, and the approval pair the direct route uses
- `project_credit_splits` — project, user, percentage, `effective_from`,
  `set_by`
- `targets` — user, period, sqm, `effective_from`, `set_by`
- `roles.can_dispatch`, `.can_set_credit_split`, `.can_set_targets`, already
  seeded correctly by `12 §1` and `12 §3`

The only schema-file change is a **comment**: the `project_credit_splits` doc
block stops describing a contributor row (§6).

Two readings this document settles, recorded here so nobody re-derives them:

- **The payment gate is scoped to dispatches against a quotation.** `09 §6.1`
  already states it that way — *"dispatch **against a quotation** is blocked
  until that quotation's payment is confirmed"* `[07 C3]`. A direct dispatch has
  no quotation, so the rule has no object; `07 C6`'s coordinator approval is the
  control that stands in its place, and `approved_by_user_id IS NOT NULL` is
  therefore exactly the marker that makes the direct route *"visible as such in
  reporting"*.
- **Company and rep on a linked dispatch are derived from the thread**, never
  asked for. `CLAUDE.md`'s first design principle, and it closes `07 D3`'s stated
  worry directly: if the coordinator picks the rep, the credited person becomes a
  dropdown choice rather than a fact of the quotation chain.

---

## 8. Still open after this document

- **Whether a dispatch may be recorded against a thread cancelled *after*
  payment was confirmed.** Payment confirmed is the only stated gate and no
  second one is invented.
- **Whether a second `can_dispatch` holder should approve a direct dispatch**
  rather than the recorder approving their own act. `07 C6`'s reasoning —
  internal sales already performs dispatch, invoicing and quotations — suggests
  there is no second person in the loop.
- **Whether two credit-split generations may be set on the same day** — §4.
- **Whether uncredited help is recorded at all** — §6.
- Carried forward unchanged from `17 §6`: whether a `requested` version expires,
  whether the VAT default moves to `settings`, whether a service line needs its
  own VAT rate, whether suppliers get factory names, cross-script duplicate
  matching, when fields become required, and who maintains lookups.
