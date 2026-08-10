# 17 — Product Lookup Decisions (suppliers, colour, thickness, layout)

Answers given by the founder after Slice 2 shipped. Slice 2 ended with the
quotation chain working but **unsaveable against a clean database**:
`quotation_lines.supplier_id` is `NOT NULL` and `product_suppliers` was empty,
because `08 B1` gave the supplier codes and no document gave the factory names
`[16 §10]`. These are the missing decisions, and they close that gap.

**Status:** Sections 1–4 are **[founder]** — user truth. Section 5 is
**[derived]**: it is the implementation reading of §1–4, not a separate rule.

**Authority:** user truth, alongside `04`, `07`, `08 §A–C`, `11 §1–3`, `12`,
`14`, `15` and `16`. This is the latest statement — where it corrects an
earlier document, this wins.

---

## 1. Suppliers — four codes, no factory names **[founder]**

`product_suppliers` seeds with **N, K, D, C**.

**`08 B1`'s G, G1 and Y are dropped.** *"we dont need them anymore."* They were
never seeded — the array has been empty since Slice 1 — so nothing is deleted
and no `quotation_lines.supplier_id` can point at them. This is a correction to
`08 B1`'s list of seven, not a data migration.

**No factory name is needed.** The bilingual name columns take the code, which
is the same treatment `08 B1` already forced on `product_classes` and two of
the three fire ratings: *the code is the name — an invented longer form would
be fiction* (`scripts/seed/products.ts`). The supplier code is also the first
token of the generated product name `[08 B1]`, so it is what everyone
recognises anyway.

**This unblocks quotation lines.** A line can now be saved against a freshly
seeded database, which was the one thing Slice 2 could not do.

`OPEN — not chosen`: whether a real factory name is ever wanted alongside the
code. Adding one is a seed edit and a re-run, never a migration — the columns
already exist.

---

## 2. Colour is free text, not a lookup **[founder]**

**The colour code is typed directly.** `168` is typed into a text field, and
**the same field takes a RAL or Pantone value** in the rare cases those are
used. There is no list to pick from.

This reverses the shape `12 §12` was implemented in, not its rule. `12 §12`
said a line carries either a lookup colour or a custom one and never both; the
answer here is that the lookup half is simply never used.

| | Before | Now |
|---|---|---|
| `quotation_lines.colour_id` | the ordinary case | **always null** |
| `quotation_lines.custom_colour` | the rare RAL/Pantone special | **every line** |
| the control | a select switching between a lookup dropdown and a text input | **one text field** |

**Why this is right rather than a shortcut.** `08 B1` says only "many" about
colours, and a colour code varies by supplier and by production run. A lookup
that nobody maintains `[15 §8]` would be a dropdown that is always missing the
colour in front of the coordinator — and the fallback for that, in the shape it
had, was the switch to "custom" that the coordinator would then use every time.
The switch was ceremony around a text field.

Three consequences, all of them deliberate:

- **No migration.** The CHECK is
  `num_nonnulls(colour_id, custom_colour) = 1`, and a line with only
  `custom_colour` set has always satisfied it. **A colour is still required** —
  exactly one of the two, as `12 §12` says; only which one changes.
  `assertColourChoice` stays as the data-layer backstop, and now names
  `customColour` as the field at fault, because that is the control the person
  is looking at.
- **`product_colours` stays in place, empty and unused.** No document asks for
  it to be dropped, and `CLAUDE.md` does not permit removing a table on an
  assistant's judgement. The read path still joins it, so a row written with a
  `colour_id` by a non-form caller still renders.
- **The generated product name is unchanged.** `productDisplayName` already
  takes the custom colour in the colour code's place `[12 §12]`, so `N- CA FR
  168` comes out identically whether `168` was picked from a list or typed.

---

## 3. Thickness — 2 to 8 mm, 4 mm standard **[founder]**

`product_thicknesses` reseeds with **2, 3, 4, 5, 6, 7 and 8 mm**.

**4 mm is the default and the only row where `is_standard` is true.** That is
the single flag `08 D1` uses to decide whether the thickness joins the printed
product name: 4 mm is omitted, every other thickness appends. `08 B1`'s worked
example — `N- CA FR 168`, a 4 mm sheet with no thickness in the name — is
unchanged.

**The extra sizes are for future products.** 2, 3, 7 and 8 mm are not quoted
today. Seeding them now costs a row each and means the list does not have to be
edited the first time one is.

This is additive: 4, 5 and 6 mm were already seeded and keep their ids and
their `is_standard` values. Nothing is deleted, as with every other lookup
`[15 §3]`.

---

## 4. FACET's quotation screen is not a copy of SMAC's **[founder]**

*"FACET's quotation screen does not need to match SMAC's layout. It should be
clear and easy for the coordinator to work with. Optimise for that rather than
for visual fidelity to the SMAC form."*

**This closes `16 §10`'s first open item.** That item asked whether the
thickness joins the generated name or sits beside it as its own column,
because `08 A` lists `Product Name · thickness` as two columns on the SMAC form
while `08 B1` says the thickness is *written* into the name for 5 mm and 6 mm.
The answer is that the question was about the wrong thing:

- **The generated name is FACET's own.** `08 A`'s column layout describes
  SMAC's form, and FACET is not reproducing it.
- **4 mm omitted is the rule**, exactly as `08 B1` and `08 D1` state, and
  `productDisplayName` already implements it. No real 5 mm quotation needs to
  be found first.

**It also licenses §2's simplification.** One text field where there was a
control switching between two is a layout choice, and this is the standard the
choice is judged against: what is quickest and least confusing for the person
filling the form in, not what mirrors the SMAC document.

`08 D5` is untouched. **SMAC still owns the money and FACET still mirrors it**
— that is about the figures, not about where a field sits on a screen.

---

## 5. What this means in the schema — nothing **[derived]**

No migration. Every change is a seed edit or a form change:

| Change | Where |
|---|---|
| four suppliers, names = codes (§1) | `scripts/seed/products.ts` |
| thicknesses 2–8, 4 standard (§3) | `scripts/seed/products.ts` |
| colours stay empty (§2) | `scripts/seed/products.ts` — unchanged |
| one colour text field (§2) | `src/app/[locale]/(app)/quotations/line-fields.tsx` |
| `colour_id` always null (§2) | `readLine` in `.../quotations/actions.ts` |

`listProductColours` is removed from `src/lib/lookups.ts` because nothing calls
it any more. The **table** stays — §2 — and `src/lib/quotations.ts` still joins
it to read a colour code back.

---

## 6. Still open after this document

- **Whether a `requested` version expires** — unchanged from `16 §7`.
- **Whether the VAT default moves to `settings`** — unchanged from `16 §2`.
- **Whether a service line ever needs a VAT rate of its own** — unchanged from
  `16 §1`.
- **Whether suppliers ever get real factory names** — §1.
- Carried forward unchanged from `16 §10`: cross-script duplicate matching,
  when fields become required, and who maintains lookups.

`16 §10`'s "`product_suppliers` and `product_colours` are still empty" is
**closed**: suppliers are seeded (§1), and colours are empty on purpose and no
longer read by any screen (§2).
