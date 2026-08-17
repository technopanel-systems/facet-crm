# 16 — Slice 2 Decisions (the quotation chain)

Answers given by the founder while planning Slice 2. Each one closes a question
that no earlier document answered, and each was needed before the first
quotation screen could be written.

**Status:** Sections 1–8 are **[founder]** — user truth. Section 9 is
**[derived]**: it is the implementation reading of the rest, not a separate
rule.

**Authority:** user truth, alongside `04`, `07`, `08 §A–C`, `11 §1–3`, `12`,
`14` and `15`. This is the later statement — where it corrects an earlier
document, this wins.

---

## 1. FACET computes the money **[founder]**

`08 D5` says FACET mirrors money and SMAC owns it, and `09 §5.3` lists four
stored totals on the version. Neither says who fills them in. The answer is
that **nobody types a total**:

| Value | How it is obtained |
|---|---|
| `quotation_lines.sqm` | the existing generated column, `quantity_pcs × width_m × length_m` `[08 D2]` |
| `quotation_lines.unit_price` | typed. **It is a price per square metre**, not per sheet |
| `quotation_lines.line_total` | `unit_price × sqm` |
| `quotation_lines.vat_amount` | `line_total × vat_rate ÷ 100` |
| `quotation_versions.total_sqm` | Σ of the **product** lines' `sqm` |
| `quotation_versions.total_excl_vat` | Σ line totals + Σ (service quantity × service unit price) |
| `quotation_versions.total_vat` | Σ line VAT amounts + Σ service totals × the default rate (§2) |
| `quotation_versions.grand_total` | `total_excl_vat + total_vat` |

**Why service VAT is computed at the version and not the line.**
`quotation_service_lines` has no `vat_rate` column — `09 §5.5` listed only
quantity, unit and unit price — but services are line items on the same SMAC
quotation `[08 B4]`, and that form carries VAT per line `[08 A]`. Leaving them
untaxed would make the grand total wrong. Adding the two columns would be a
migration no document asks for. So service VAT uses the default rate from §2.
`OPEN — not chosen`: whether a service line ever needs a rate of its own.

**An unpriced line is not a zero-priced line.** `unit_price` is nullable and
`04 flow 6` is not a requirement that it be filled, so a line with no price
keeps `line_total` and `vat_amount` null and contributes nothing to the totals.
The screen says so rather than quietly showing a total that is missing a line.

The founder's own statement of it: *"w × length = area of 1 sheet; w × length ×
number of sheets = total area; price is per 1 m, so total area × price per 1 m
= total price; VAT = total price × 15%."*

Service square metres stay out of `total_sqm`. They are tracked separately and
do not count toward SQM targets `[08 D4]`, `[12 §10]` — targets measure
cladding dispatched, not fabrication performed.

**This does not weaken `08 D5`.** That rule governs *disagreement*: where
FACET's figure and SMAC's differ, SMAC is correct. Computing the mirror rather
than retyping it removes the commonest way the two diverge — a typo — and
follows `CLAUDE.md`'s first design principle: if the system can know it, do not
ask a human. The reconciliation view `[06 A6]` remains a reference-only
proposal and is not built.

**Precision.** Every figure is a `numeric` column read and written as a string,
never through a float, for the reason already recorded in
[validation.ts](src/lib/validation.ts): a square-metre figure the business is
measured on must not be rounded by the language.

---

## 2. VAT is 15 per cent **[founder]**

*"15 % percent on total amount normally."*

`quotation_lines.vat_rate` **defaults to 15** — the Saudi rate — and stays
editable per line, because the column is per line and a real quotation may
carry an exempt or zero-rated line.

This is the one tax figure FACET holds, and it holds it as a default rather
than a rule. FACET does not do tax; SMAC does `[04 A1]`. The default exists so
nobody retypes the ordinary case, not so FACET can compute anybody's return.

`OPEN — not chosen`: whether the default should later move into the `settings`
store `[09 §10.2]` so it is editable without a deploy. Nothing depends on the
answer; the value is written in one place.

---

## 3. Expiry is an idempotent sweep on read **[founder]**

`07 C7` says an expired quotation is marked expired and the record kept. FACET
has no scheduler, and notifications are Phase 10.

**One function marks every thread that is due**, and it runs when a quotation
screen is read. It is a single `UPDATE … RETURNING` that writes nothing when
nothing is due, so a read costs one statement.

**The audit actor is the system** — `{ actorUserId: null, actingAsUserId: null }`,
the form already used by `scripts/dev-fixtures.ts`. The person who happened to
open the list did not expire the quotation and the log must not say they did.

The same function is what a scheduled job will call when Phase 10 adds one. No
second code path.

**One consequence, found by running it [derived].** A revision carries the
previous version's validity forward **only while that date still has time to
run**; a date already past becomes null on the new version. Without this the
sweep re-expired a freshly revised quotation on the very next read, which would
make `07 C7`'s "revise" no remedy for expiry at all — and `07 C7` offers
*extend* and *revise* as the two alternatives, so neither may leave the record
expired. This is a reading of `07 C7`, not a new rule.

---

## 4. `service_types` seeds with four values **[founder]**

`08 B4` names CNC, cutting, bending and notching. No document gave their
Arabic; the founder did:

| English | Arabic |
|---|---|
| CNC | سي ان سي |
| Cutting | القص |
| Bending | الثني |
| Notching | التفريز |

`service_types` was accepted as a lookup in `10 §12` precisely because this
list will change. Adding a fifth service is a seed-file change, not a
migration.

Every service is priced **per square metre** `[12 §10]`, so the application
writes `unit = 'sqm'` on every service line. This is the same shape as
`form_factor = 'sheet'` `[13 §2]` and for the same reason: `12 §10` closed the
units question, and `12 §14` — the founder's own enumeration of the schema
changes that correction requires — does not ask for the column to change.

---

## 5. "Accepted" is internal approval, **not** a won deal **[founder]**

`quotation_threads.end_state = 'accepted'` means exactly one thing: **the
coordinator has the signatures** and internal approval is complete
`[04 flow 10]`, `[07 C3]`, `[08 C2]`, `[12 §13]`.

**It does not mean the customer has committed.** The customer commits later, in
two recorded steps:

1. **`payment_confirmed_at`** — the rep ticks payment with a date, because the
   rep receives the payment `[07 C3]`.
2. **`accepted_for_processing_at`** — the rep's mark, which comes after payment
   `[04 flow 13]`.

**No view, count, funnel stage, conversion figure or snapshot may treat
`end_state = 'accepted'` as won.** Two places will be tempting and both are
named here so the mistake is not made silently:

- `07 D4`'s primary conversion measure — *accepted SQM ÷ quoted SQM*. The
  numerator is customer commitment, not internal approval.
- `10 §11`'s `person_snapshots.quotations_accepted`. The column counts what its
  name says; whether the reporting that reads it means "signed off" or "bought"
  must be stated when that reporting is built, not assumed.

The distinction is the same one `07 C5` already draws between a quotation's end
state and a project's: *loss belongs to the project, rejection to the
quotation*. Winning belongs to the project too.

---

## 6. The quotation's company comes from the project — and must not dead-end **[founder]**

`quotation_threads` requires both a project and a company, and FACET requires a
project even though SMAC does not `[08 C3]`. Which companies may be chosen was
not stated.

**The company must be one of the project's live linked companies.** The
project–company link is already the model of who is on a project `[12 §5, §6]`,
and a quotation addressed to a company with no connection to the site is not a
thing the business does.

**The refusal must name the next step.** A rep whose customer is not linked to
the project is not stopped: the field carries a link to the project, where
`14 §4`'s per-row link editor already lives, and the error text says so in both
languages. A rule that leaves someone with nowhere to go gets worked around.

---

## 7. A payment-confirmed thread does not expire **[founder]**

The expiry sweep `[§3]` skips any thread with `payment_confirmed_at` set, as
well as any thread that already has an end state.

A customer who has paid has committed `[§5]`. Letting a validity date take that
back would contradict `07 C3`, where payment is the gate that *opens* dispatch,
not a state that can lapse.

`OPEN — not chosen`: whether a version still in `requested` — raised by the rep
but never issued in SMAC — should expire on its validity date at all, or
whether validity only begins to run once the quotation exists in SMAC. The
sweep currently treats both alike.

---

## 8. The coordinator sees every quotation, and only names behind it **[founder]**

**The problem this answers.** `Sales Coordinator` holds `can_approve_quotation`
and `sees_all_reps: false`. Under the visibility rule as `11 §2` left it — the
raising rep, an explicit thread share, or the parent project — the coordinator
could not see a single quotation raised by a rep, and therefore could not
issue, accept, reject or cancel one. The flag was unreachable for the only role
whose job it is `[07 A5]`, `[04 flow 7–11]`. Verified in process before asking:
`canViewRecord(coordinator, "quotation_thread", …)` returned `false`.

**The answer.** *"Sales coordinator is responsible for the internal ERP and
already creates the quotation, so he might see all quotations of the company —
but regarding details of project and company he cannot: only project title,
company name, contact name."*

Two halves, and the second is as load-bearing as the first:

1. **`can_approve_quotation` sees every quotation thread.** A fourth term in
   `visibleQuotationThreadsFilter` and its `canViewRecord` twin. Read through
   the flag, never a role name, and no new flag invented.

2. **It grants nothing else.** The coordinator gets no company, no contact and
   no project visibility from it. What they see of those records is what the
   quotation itself carries: **the project title, the company name and the
   contact name**. The thread detail therefore renders those as plain text
   rather than links unless the viewer may open the record on its own — the
   same treatment `14 §4` already gives a project's company links.

**Why this is narrow rather than `sees_all_reps`.** Granting the coordinator
`sees_all_reps` in the seed would have been one value and no code, but it
exposes every company, contact and project to internal sales — far past
`07 A5`'s "internal sales: quotations, dispatch, invoicing", and a permission
that is awkward to take back. This grant stops at quotations.

**Precedent.** `11 §2` is the same shape: a strict per-record reading broke the
chain, and it was extended by exactly one step rather than abandoned.

---

## 9. What this means in the schema — nothing **[derived]**

Unlike `14 §5` and `15 §6`, this document forces **no migration**. Every column
these decisions need already exists, created by migration `0000` and corrected
by `0002`:

- the `sqm` generated column and the four money columns per line (§1)
- `vat_rate numeric(5,2)`, nullable, per line (§2)
- `end_state`, `cancellation_reason`, `payment_confirmed_at`,
  `accepted_for_processing_at` on the thread (§3, §5, §7)
- `service_types` and `quotation_service_lines.unit` (§4)
- `quotation_threads.project_id` and `.company_id`, both `NOT NULL` (§6)

Two invariants stay in application code rather than the database, deliberately:

- **One live version per thread.** No document asks for a partial unique index
  on `quotation_versions.status`, and `CLAUDE.md` forbids adding one that
  nobody required. `createRevision` supersedes the previous version inside the
  same transaction.
- **A cancellation reason is required** `[10 §8]`. This is a rule about *who
  may act and under what condition*, which `13 §1` places in the authorization
  and data layer, not a rule about what a row may contain in isolation — a
  thread that is not cancelled legitimately has no reason.

---

## 10. Still open after this document

- **The generated product name's exact format.** `08 B1` gives one worked
  example, `N- CA FR 168`, and says 4 mm is omitted. `08 A` lists
  `Product Name · thickness` as two columns on the SMAC form, which reads
  against "written only for 5 mm and 6 mm". One look at a real 5 mm quotation
  settles whether the thickness joins the name or sits beside it. The format
  lives in a single function so the correction is one line.
- **Whether a `requested` version expires** — §7.
- **Whether the VAT default moves to `settings`** — §2.
- **`product_suppliers` and `product_colours` are still empty.** `08 B1` gives
  the seven supplier codes but no factory names, and says only "many" about
  colours. Quotation lines cannot be saved until suppliers exist. Unchanged
  from `scripts/seed/products.ts`; no placeholder will be invented.
- Carried forward unchanged from `15 §8`: cross-script duplicate matching,
  when fields become required, and who maintains lookups.
