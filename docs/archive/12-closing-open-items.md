# 12 — Closing the Open Items

Closes all twelve items in `10-schema-decisions.md` §13, plus the carried-over
items from `07 F` and `08 E`.

**Status:** Sections marked **[founder]** are user truth. Sections marked
**[delegated]** were handed to the planning assistant and are agreed, not
proposals.

**Authority:** user truth, alongside `04`, `07`, `08 §A–C` and `11 §1–3`. This
is the later statement — where it corrects `08`, `09` or `10`, this wins.

---

## 1. Shared-credit authority **[founder]**

Setting a credit split is the **manager's authority**, but **both the manager
and the sales coordinator** may set it, because the coordinator performs the
actual dispatch.

Closes `07 F1`. `09 §4.2` already records `set_by` on each split row, so no
shape change — this fixes the permission flag: `can_set_credit_split` is
granted to sales_manager and sales_coordinator.

**Note.** `07 D3` still holds: recording a dispatch never sets a split.
Splits are set deliberately, as their own act, and a rep can never set his own.

---

## 2. Desk rep **[founder]**

Confirmed as previously described `[07 A5, 28.1]`: works like a rep, does not go
into the field, is not internal sales. Filters dump and imported leads, works
some himself, assigns or shares the rest.

**Flags [delegated]:** the sales_rep set, plus `can_assign`. No export, no
dispatch, no quotation approval, no user management, no target-setting. Targets
optional per person, as for every role `[07 D1]`.

Closes `07 F3`, `10 §13.2`. Add to the seed as a seventh role.

---

## 3. Executive **[founder + delegated]**

The founder asked for the executive to carry more privileges, as the highest
manager. `11 §1` took a deliberately narrow reading pending this answer.

**Flags:** sees all reps · sets targets · exports · manages users · approves
deletes · resolves duplicates · sets credit splits.

**Not granted:** dispatch, quotation approval. These are operational acts
performed by coordinators, and `07 A5` describes the executive as monitoring
rather than doing. An executive who needs one performed asks the coordinator —
the same as today.

**Difference from super admin.** Super admin additionally holds impersonation
and system configuration. The executive runs the business; the super admin runs
the system.

Closes `07 F4`. `11 §1` is amended: `can_manage_users` is now held by super
admin, executive and sales manager.

---

## 4. Company categories **[founder]**

factory · contractor · advertising · real estate · owner · consultant ·
station management · workshop · other

`other` is the fallback where none of the above fits. Seed values for
`company_categories`, with EN and AR names. Closes `07 F5`.

---

## 5. Project–company roles — free text, not a vocabulary **[founder]**

**No fixed role list.** Two contractors, or two factories, may be competing on
the same project — a structured vocabulary would force a false choice between
them.

`project_companies.role` is a **free text label** describing what that company
is on that project. `project_company_roles` as a lookup table is **dropped**.

Closes `07 F6`, and corrects `07 A3` and `09 §3.6`.

---

## 6. Buyer is optional — at most one per project **[founder]**

`07 A3` and `09 §3.5` required **exactly one** buyer per project, enforced by a
partial unique index. That breaks the competition case: while two contractors
compete there is no buyer, and there may never be one.

**Corrected:** `is_buyer` is a **boolean on the project–company link**,
separate from the free-text role. **Zero or one** per project. Set when a
company actually buys.

The partial unique index changes from *exactly one* to *at most one*.

The flag stays meaningful precisely because it is not guessed: it records who
bought, which is what targets and credit depend on.

---

## 7. Retention — keep everything **[founder]**

Nothing is deleted for now. Archived companies, departed contacts and
deactivated users are all retained. `archived_at` and `deactivated_at` mark
state; no purge job exists.

Closes `07 F7` and `06 B7`. Revisit if data protection obligations require it —
recorded as a deliberate choice, not an oversight.

---

## 8. Class and fire rating — no constraint **[founder]**

Many combinations exist and **they vary by factory**. Which combinations are
real is a property of what each supplier produces, and that changes.

**No database constraint between class and fire rating.** Any combination may
be entered. What actually exists is defined by which specification rows have
been seeded.

Closes `08 E1`.

---

## 9. Product specifications key on supplier too **[founder]**

`10 §5` keyed specifications on class + fire rating + thickness. The founder's
answer to §8 above — specifications are already variable per factory — makes
that key incomplete.

**Corrected key: supplier + class + fire rating + thickness.**

`product_specifications` needs its unique key and foreign keys widened to
include supplier. Closes `08 E4` / `10 §13.12`, and corrects `10 §5`.

---

## 10. Service units — square metres **[founder]**

All services (CNC, cutting, bending, notching) are priced **per square metre**.
No mixed units.

Service square metres **do not count toward SQM targets** — targets measure
cladding dispatched, not fabrication performed `[08 D4]`. Confirmed.

Closes `08 E2`.

---

## 11. Coils are out of scope for quotations **[founder]**

Coils are **not a sales or quotation concern**. Reps quote **sheets**, with
dimensions and area. Coils enter the **production** sheet with their own length
and width, and the production team records the estimated area. Thickness
describes the core, not the coil.

**Consequences:**
- `08 B2`'s "two form factors" is corrected — quotation lines are sheets only
- `quotation_lines.total_sqm` stays a generated column,
  `quantity_pcs × width_m × length_m`, unchanged
- The proposed `entered_sqm` / `COALESCE` change is **cancelled**
- Coil dimensions and total-square-metre handling belong to the production
  orders module, when it is built

Closes `08 E5`.

---

## 12. Colours — lookup plus a special field **[founder + delegated]**

Many colour codes exist. Occasionally a specific **RAL or Pantone** colour is
required; this is rare.

**Design:** `product_colours` remains a lookup for the standard codes. A
quotation line additionally carries an optional **custom colour** text field for
the rare RAL/Pantone case. A line uses one or the other.

Keeping specials out of the lookup stops one-off customer colours from
polluting the list every rep picks from.

Closes `08 E6`.

---

## 13. Price approval — no record needed **[founder]**

The flow already contains the approval:

1. The rep knows the price, or asks about it where there are arrangements
2. The rep raises the quotation request with the discussed price
3. The coordinator creates the SMAC quotation at that price
4. **The manager signs it — approving everything, including the price**
5. The coordinator accepts the quotation request in FACET
6. Edits or rejection go back to the rep and manager, and the coordinator fixes
   it

The signature is the price approval. No separate "price approved by" field —
it would duplicate what acceptance already means.

Closes `08 E3`.

---

## 14. Schema changes required

Small migration, before seed data:

1. `project_companies` — drop the `project_company_roles` foreign key, make
   `role` free text (§5)
2. `project_companies` — buyer index from *exactly one* to *at most one* (§6)
3. `product_specifications` — add supplier to the key and foreign keys (§9)
4. `quotation_lines` — add optional `custom_colour` text (§12)
5. Drop the `project_company_roles` table (§5)
6. `roles` — grant `can_manage_users` to executive (§3); confirm
   `can_set_credit_split` exists and is granted per §1

Then seed: 7 roles (§2, §3), company categories (§4), and the product lookups.

---

## 15. Nothing remains open before seed data

All twelve items in `10 §13` are closed. Items still deliberately deferred, none
blocking:

- Notification trigger enumeration `[10 §10]` — type is a lookup, added as data
- Snapshot job scheduling — Phase 12
- Password reset / change UI `[11 §5]`
- Automated regression tests for the auth bridge `[11 §4.1]` — the highest-value
  test to write when a harness exists
