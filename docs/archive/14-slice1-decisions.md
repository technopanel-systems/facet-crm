# 14 — Slice 1 Decisions (companies, contacts, projects)

Answers given by the founder while planning Phase 7. Each one closes a question
that no earlier document answered, and each was needed before the first CRM
screen could be written.

**Status:** Sections 1–4 and 6 are **[founder]** — user truth. Section 5 is
**[derived]**: it is the schema reading of §4, not a separate rule.

**Authority:** user truth, alongside `04`, `07`, `08 §A–C`, `11 §1–3` and `12`.
This is the later statement — where it corrects `12` or `13`, this wins.

---

## 1. Contact visibility — a contact follows its company **[founder]**

**A contact is visible exactly when its company is.** See the company —
by `company_reps` membership or by an unrevoked company share — and you see
its contacts.

No earlier document answered this. The evidence pulled both ways: `04 Q3` says
reps share a company "via the same contact or different contacts", which reads
as contacts travelling with the company; `04 Q7` says a shared company's
"projects, quotations and other records" stay private, which could be read to
include them.

The schema settles which readings are even expressible: `contacts` has no owner
column and no membership table. Per-rep contact privacy would require a new
column that no document requires, which `CLAUDE.md` forbids.

**Consequence.** `"contact"` joins `ViewableRecordType` in
[src/lib/authz.ts](src/lib/authz.ts), resolving through `company_id`. The
`contact` value already present in the `record_type` enum stays unused until a
share write path exists — it is not wired up on speculation.

**This does not weaken `04 Q7`.** Projects remain private on a shared company.
Contacts are attributes of the relationship; projects are separate records with
their own owner.

---

## 2. A share grants edit, not only view **[founder]**

A rep holding a share of a record **may edit it**. A share is working access,
not read-only access — the point of sharing is that both people work the
record (`07 B2`, `13 §3`).

**Consequence.** Visibility implies edit. There is no `can_edit` flag on
`roles` and none is added: the answer is that the question does not need a
flag.

---

## 3. The executive may edit records **[founder]**

`12 §3` describes the executive as monitoring rather than doing, and `07 A5`
says "no operational data entry". **On the question of editing records, that
prose is superseded.** An executive may edit companies, contacts and projects.

The rest of `12 §3` stands unchanged: the executive still holds no dispatch and
no quotation approval. Those are operational acts performed by coordinators.
Editing a customer record is not one of them.

**Consequence.** `sees_all_reps` grants edit as well as view, which falls out of
§2 with no extra code. This item is **closed**, not open.

---

## 4. A company link on a project can be removed **[founder]**

`12 §5` and `12 §6` made the project–company link flexible — free-text role, an
optional buyer flag. **Removal completes that: links are meant to be flexible
and changeable.** A company linked to a project in error, or one that drops out
of a project, can be removed.

**Removal is soft.** The link is hidden from normal views and retained, in line
with `09 §1` — no table in FACET deletes a row to represent a business event.

**Audited as `project_company.removed`**, with the removed row's state in
`before`.

**A project still requires at least one company** (`07 A9`). Removing the last
remaining active link is refused.

---

## 5. Schema change required — migration 0003 **[derived]**

§4 is the first thing in this slice that the existing schema cannot express.
Three statements, all on `project_companies`:

1. **Add `removed_at timestamptz`** — the soft-removal marker, matching
   `company_reps.removed_at` (`09 §3.2`), `record_shares.revoked_at` and
   `users.deactivated_at`. Same convention, same shape.

2. **`project_companies_key` becomes partial** — unique on
   `(project_id, company_id)` **where `removed_at is null`**. Without this, a
   company removed from a project could never be linked to it again, which
   would make removal a one-way door and contradict "flexible and changeable".
   This mirrors `company_reps_active_key` exactly.

3. **`project_companies_one_buyer_key` becomes partial on both terms** — unique
   on `(project_id)` **where `is_buyer and removed_at is null`**. Without this,
   a removed buyer row would permanently block naming a new buyer, and `12 §6`
   is about who currently buys.

Both index changes are consequences of adding the column, not separate
decisions: a partial-uniqueness rule that ignores the removal marker stops
describing the business the moment the marker exists.

---

## 6. Still open after this document

- **Cross-script duplicate matching.** `name_normalized` folds writing-system
  noise within one script. Matching an Arabic name against the English name of
  the same company (`04 B3`) needs transliteration, which no document
  specifies. Phase 10 — duplicate detection — not attempted in Slice 1.
- **When fields become required.** `09 §3.1` says fields become required
  "progressively in the application layer" without naming thresholds. Slice 1
  requires only `name_en` (plus `07 A9`'s one company per project, and a loss
  reason when a project is marked lost per `07 C5`). Nothing else is guessed.
