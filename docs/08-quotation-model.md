# 08 — Quotation and Product Model

**Status:** Sections A–C are **user truth** — stated by the founder while
reviewing a real SMAC quotation (reference 9592, dated 06/08/2026).
Section D holds **decisions delegated to the planning assistant**.
Section E lists what remains open.

Closes item F8 of `07-phase4-answers.md`.

---

## A. What a real SMAC quotation contains

Observed directly from quotation 9592.

**Header**

| Field | Example |
|---|---|
| Our Offer Reference | `9592` — the SMAC number FACET stores |
| Sales Representative | rep name |
| Date | quotation date |
| Company Name | customer company |
| Contact | contact person |
| Telephone | contact phone |
| VAT Number | **the customer's** VAT registration |
| Project Name | **blank on this quotation** |

**Line items**

`Product Name · thickness · Quantity(pcs) · Width(m) · Length(m) ·
Quantity(sqm) · Price(SAR) · Disc · Total Without Tax · VAT % · VAT ·
Total(SAR)`

Then quotation totals: total sqm, total without tax, total VAT, grand total.

**Specifications block** — product description, manufacturing standard
(ASTM E84, BS EN 13501-1, BS EN 13823, BS EN 11925-2, SASO 2752-2019),
aluminium alloy (3003 H16), sheet thickness, top layer (PVDF), core
(halogen-free FR, 70–80%), bottom layer (PE polyester), protective film,
colour availability.

**Terms** — delivery period, method of payment, terms of shipment
(e.g. EX-F), offer validity, bank account details.

**Two signatures** — Sales Rep and Factory Sales Manager.

---

## B. Product structure

**B1. The product code decomposes.** Example `N- CA FR 168`:

| Part | Meaning | Values |
|---|---|---|
| `N` | Supplier code | N, K, D, C, G, G1, Y |
| `CA` | Class | A, B, A2G1, A2G2 |
| `FR` | Fire rating | B1, A2, Normal |
| `168` | Colour code | many |

**Thickness** is a fifth attribute — 4 mm, 5 mm or 6 mm. **4 mm is the
standard and is omitted from the printed name**; it is written only for 5 mm
and 6 mm.

**B2. Two form factors.**

| Form | Width | Length |
|---|---|---|
| **Sheet** | standard 1.24 m | standard 5.8 m |
| **Coil** | standard 1.24 / 1.5 / 2.0 m (special widths very rare) | cut to requirement on the production line |

Sheet length can also vary when a project requires it — neither rare nor
frequent. Coils are unwrapped and cut in production, so length is genuinely
free.

**B3. `Disc` is inert.** The discount column exists on the SMAC form but is not
used. The rep enters the final price directly, after asking management about it.

**B4. Services are optional line items.** CNC, cutting, bending, notching. Each
has a variable price and a variable quantity, and **not every product on a
quotation receives a service**.

v1 stored only price per metre and never the quantity — which made service
totals impossible to compute. Services must carry their own quantity.

---

## C. Confirmed behaviour

**C1. FACET stores pricing and VAT**, not only square metres — reps negotiate
on total price, not on rate alone.

**C2. Approval.** The quotation is signed across people; once the signature is
obtained, the rep's quotation request is approved in FACET. Per the correction
in `07 C3` and `04`, the **sales coordinator** performs that acceptance.
See open item E4.

**C3. Project Name is optional in SMAC.** FACET requires a project; SMAC does
not enforce it. The link cannot be validated against SMAC.

---

## D. Decisions

**D1. Products are attribute combinations, not a fixed SKU list.**

Seven suppliers × four classes × three fire ratings × many colours × three
thicknesses runs to thousands of combinations. Maintaining that as a SKU
catalogue is impractical and would go stale immediately.

**Design:** five lookup tables (supplier, class, fire rating, colour,
thickness). A quotation line references one value from each, plus form factor,
width and length. The printed product name is **generated** from those parts —
including the rule that 4 mm is omitted — so FACET's output matches SMAC's
format exactly without anyone retyping it.

This also makes reporting possible: "how much A2 fire-rated did we sell this
quarter" is a query, not a string search.

**D2. Square metres are a generated column.**
`quantity_pcs × width_m × length_m`, verified against quotation 9592
(12 × 1.24 × 5.8 = 86.304 ✓). This matches the one thing v1 got right
(`00-legacy-findings.md`, `quotation_items.total_sqm`). Never hand-entered.

**D3. Width and length are suggested, not constrained.** Standard values are
offered as defaults — 1.24 × 5.8 for sheets, 1.24/1.5/2.0 for coils — but both
remain editable. Constraining them would block real orders.

**D4. Services are their own line type**, with service type, quantity, unit and
unit price. A service line may optionally reference the product line it applies
to. Service square metres are tracked separately from panel square metres and
**do not count toward SQM targets** — targets measure cladding dispatched, not
fabrication performed.

**D5. FACET mirrors money; SMAC owns it.** FACET stores unit price, line total,
VAT rate, VAT amount and grand total so reps can negotiate and managers can see
value. Where FACET and SMAC ever disagree, **SMAC is correct** — FACET's figures
are a mirror, never the authority. The reconciliation view in `06 A6` should
surface any divergence.

**D6. Specifications live on the product, not the quotation.** The entire
specifications block is product-type boilerplate, identical across every
quotation for that product. It belongs to the product record and is rendered
onto the quotation at print time.

**D7. The customer's VAT number belongs on the company record**, not the
quotation. It is a property of the customer.

**D8. No discount field in v1.** `Disc` is unused (B3). Adding an unused field
invites someone to populate it inconsistently later. It can be added when
discounting becomes real.

**D9. Terms are quotation fields with defaults** — delivery period, payment
method, shipment terms, validity. Defaults come from settings, editable per
quotation. Validity is already per-quotation per `07 C7`.

Bank account details are **not** stored per quotation; they are print-time
boilerplate from settings.

---

## E. Open

1. **Class vs fire rating overlap.** Class values (A, B, A2G1, A2G2) and fire
   ratings (B1, A2, Normal) appear related. Are they genuinely independent
   attributes, or does one constrain the other? If dependent, invalid
   combinations should be blocked at entry.
2. **Service units.** Is service quantity always square metres, or do CNC and
   notching price per piece or per linear metre?
3. **Price approval.** The rep "asks management" before setting a price
   (B3). Should FACET record that approval — who approved, when — or does it
   stay a conversation?
4. **Who accepts.** `07 C3` and `04` state the coordinator accepts the
   quotation after signatures. C2 above should be confirmed as consistent.
5. **Coil quantity unit.** For coils, is `Quantity(pcs)` the number of cut
   pieces, or is the coil quoted by total length or weight?
6. **Colour codes.** Is there a fixed list with names, or a free code?
   Affects whether colour is a lookup table or a text field.
