# 22 — Design Language

The visual language of FACET, taken from the concept the founder approved:
`docs/design/facet-concept-v2.html`. It fixes the palette, the type, the four
screen shapes and the one rule every screen is measured against, so that later
stages of the redesign build against a written reference rather than re-reading
a mock.

**Status:** **[founder]** for §1–4 — the palette, the type, the archetypes and
the rule all come from the approved concept. §5–6 are **[derived]**: the
implementation reading of §1–4, and the register of what this stage left open.

**Authority: presentation only.** This document decides how FACET *looks*. It
decides nothing about business logic, visibility, or what a record may contain,
and where it appears to, **every user-truth document outranks it** — `04`, `07`,
`08 §A–C`, `11 §1–3`, `12`, `14`–`21`. It sits below them and beside `03`.

It is not a licence to restyle meaning. `16 §5` is the case in point and §4
restates it: a status pill's colour is not free to change just because a palette
did.

**Scope.** Stage 1 of the redesign is the shell — tokens, type, the rail, the
theme toggle, the Today screen, and the shared components. The chain strip,
kanban, calendar, drag-and-drop and charts are **not** in stage 1 and are not
decided here.

---

## 1. Palette — warm black **[founder]**

**Every neutral carries a red undertone, not blue.** The greys are mixed toward
the brand red so the interface reads as ink rather than as slate. This is the
whole identity of the palette; a neutral that drifts blue is a bug in it.

**Both themes are designed, not inverted.** Light is not dark with the lightness
flipped — the two have different accents, different shadows and different
relationships between surface and line. **Dark is the default.**

**The rail is dark in both themes.** It recedes; it is not a surface.

### Theme-independent

| Token | Value |
|---|---|
| `--red-600` | `#C8102E` |
| `--red-500` | `#E5233C` |
| `--blue-600` | `#2B5CA8` |
| `--amber-600` | `#B45309` |
| `--green-600` | `#15803D` |
| `--radius` | `10px` |
| `--radius-lg` | `14px` |

### Per theme

| Token | Dark (default) | Light |
|---|---|---|
| `--canvas` | `#151211` | `#F8F6F4` |
| `--surface` | `#1D1A18` | `#FFFFFF` |
| `--surface-2` | `#252120` | `#FAF8F6` |
| `--line` | `#302B29` | `#E8E3DE` |
| `--line-strong` | `#403A37` | `#D6CFC9` |
| `--text` | `#F0EBE8` | `#1A1614` |
| `--text-muted` | `#A29996` | `#6B615C` |
| `--text-faint` | `#756C69` | `#9A908A` |
| `--rail` | `#0E0C0B` | `#171311` |
| `--rail-text` | `#918885` | `#B5ABA6` |
| `--rail-text-strong` | `#FFF8F5` | `#FFFFFF` |
| `--rail-active` | `#211D1B` | `#26201D` |
| `--brand` | `#F2566B` | `#C8102E` |
| `--brand-ink` | `#FFFFFF` | `#FFFFFF` |
| `--a-red-bg` / `--a-red-fg` | `#2E1418` / `#F98A98` | `#FDF1F2` / `#C8102E` |
| `--a-blue-bg` / `--a-blue-fg` | `#141F31` / `#7FADEE` | `#EEF4FC` / `#2B5CA8` |
| `--a-amber-bg` / `--a-amber-fg` | `#2B1F0C` / `#E3A63E` | `#FDF4E6` / `#B45309` |
| `--a-green-bg` / `--a-green-fg` | `#0F2417` / `#57C57E` | `#EFF9F1` / `#15803D` |
| `--shadow` | `0 1px 2px rgba(0,0,0,.5)` | `0 1px 2px rgba(26,22,20,.05), 0 6px 20px -12px rgba(26,22,20,.18)` |
| `--glow` | `0 0 0 4px rgba(242,86,107,.14)` | `0 0 0 4px rgba(200,16,46,.1)` |

**The brand red differs by theme on purpose.** `#C8102E` is Technopanel's red
and holds its contrast on white. On `#151211` it is too dark to read, so dark
lifts it to `#F2566B`. Both are the same colour doing the same job.

### One deliberate divergence from the concept file

The concept names the red token `--accent`. **In the codebase it is `--brand`.**

shadcn already owns `--accent`, with an unrelated meaning: the muted hover
background behind `bg-accent` / `text-accent-foreground`, used by the nav, the
combobox rows and every ghost button. That token maps to `--surface-2`. Leaving
both named *accent* would leave `bg-accent` rendering grey while this document
insists accent is red — a name collision that would be discovered by someone
styling a button at midnight.

The concept HTML is the artefact nothing depends on, so it is the one that
yields the name. **The concept file and the code are knowingly different on this
one token, and nowhere else.**

---

## 2. Type **[founder]**

| Family | Use | Weights |
|---|---|---|
| **IBM Plex Sans** | Latin UI text | 400 · 500 · 600 · 700 |
| **IBM Plex Sans Arabic** | swapped in on `html[lang="ar"]` | 400 · 500 · 600 · 700 |
| **IBM Plex Mono** | every number | 500 · 600 |

**Every number is mono with tabular figures.** Quantities, square metres, money,
references, dates, counts, percentages, durations. Always with
`font-variant-numeric: tabular-nums`, so a column of figures aligns on its
digits and a number that changes does not reflow the row it sits in. In the code
this is one utility, `num`, not two classes remembered separately.

This compounds a rule that already exists: decimals stay **strings** end to end
and are never `Number()`-ed (`CLAUDE.md`, Conventions). Tabular mono is how a
string of digits still reads as a quantity.

Scale: base 14px / 1.5. `h1` 25px / 600 / `-.025em`. Card heading 14px / 600.
Section labels 11px / 600 / `.09em` / uppercase. Nothing on a screen is smaller
than 11px.

---

## 3. The four screen archetypes **[founder]**

Every screen in FACET is one of four shapes. A new screen picks one; it does not
invent a fifth.

**List.** Search and filters are GET forms in the URL — shareable, reload-proof,
no JavaScript (this is already the rule; the redesign does not change it). The
header row is uppercase, 10.5px, faint. Numeric columns are end-aligned and
mono. One column says whose move it is. Pagination sits in the footer.

**Detail.** The record's name, its mono reference, and a line of state. Then a
**turn panel** naming who owes the next action — the most important element on
the screen. Then facts in a bordered grid, and related records as cards below.

**Form.** Single column. Labels above controls. Errors under the control in
`--a-red-fg`. Actions in a footer bar. A native `<select>` unless the list is
the ~200-item city one (`15 §5`).

**Dashboard.** A signature panel across the top — the target. Then a KPI row.
Then two columns: the queue on the wide side, a companion panel on the narrow
one.

---

## 4. The rule: whose move it is, not what the status is **[founder]**

**Every row and every header says who owes the next action.** In the second
person where that person is the reader.

> "Waiting on Rawan — signatures" beats "Issued".
> "Your turn" beats "Returned".
> "Nothing recorded for 23 days" beats "Lead".

A status pill may still render beside it, but **it is never the only thing a row
says.** A status names the state a record is in; this rule names the person the
record is waiting on, which is the thing a rep opens FACET to find out.

Waiting time shows as elapsed duration, coloured by lateness: past due in
`--a-red-fg`, due today or soon in `--a-amber-fg`, otherwise `--text-faint`.

### What this rule does not license

**It introduces no status→colour map.** There is none in the codebase today,
deliberately, and this document does not add one. `16 §5` stands: `accepted`
keeps the plain pill, because a success-coloured pill is the first place
"internal approval, never a won deal" gets lost. Colour here describes **how
long something has waited**, never **how good the outcome is**.

---

## 5. How the tokens reach the code **[derived]**

The implementation reading of §1. Recorded because the mapping is the reason a
restyle of six shared components repaints thirty-six screens.

FACET's screens use **semantic** classes — `bg-card`, `text-muted-foreground`,
`border` — and never raw palette classes. There is exactly one exception in the
whole of `src` (the impersonation banner's `bg-amber-400`). So §1's tokens are
mapped onto the existing semantic names, and the pages need no edit:

| shadcn token | takes |
|---|---|
| `--background` | `--canvas` |
| `--card`, `--popover` | `--surface` |
| `--muted`, `--secondary`, `--accent` | `--surface-2` |
| `--foreground` | `--text` |
| `--muted-foreground` | `--text-muted` |
| `--border`, `--input` | `--line` |
| `--primary`, `--ring` | `--brand` |
| `--destructive` | `--a-red-fg` |
| `--success` | `--a-green-fg` |

§1's own names are exposed alongside as Tailwind colours, so new shell work can
say `bg-surface-2`, `text-faint`, `bg-brand`, `bg-a-amber-bg` directly.

Two happy accidents worth recording so nobody "fixes" them: `--radius` is
already `0.625rem` = 10px, and `rounded-xl` already computes to 14px — so the
existing Card radius **already matches** `--radius-lg`.

Dark stays a **class** strategy (`.dark` on `<html>`, `@custom-variant dark`),
not a `data-theme` attribute, so every `dark:` utility already written in
`src/components/ui` keeps working. The theme is a cookie read on the server, so
there is no flash and no inline script.

---

## 6. OPEN — not chosen

Recorded rather than filled in. Some need founder input, one is a defect.
**6.1 closed in stage 2 and 6.6's strip in feature slice 1**; both are kept
here, struck, so the decision is legible where the question was asked.

| # | Open item | Why it is open |
|---|---|---|
| ~~6.1~~ | ~~**Page-area width.**~~ **CLOSED — stage 2.** The `(app)` layout owns the content column: `max-w-330` (1320px), `px-6.5 pt-5.5 pb-10`, and **no `mx-auto`** — start-aligned is the proportion, so the page hugs the rail rather than floating. The header's inner row takes the same cap and padding, which is what finally lines the top-bar controls up with page content. Pages carry only their flow, and a narrower measure where the archetype needs one: `max-w-2xl` for a field-stack form, `max-w-4xl` for the two full-history timelines, the full column for lists, detail screens and repeater forms | — |
| 6.2 | **Global search and the New button** in the top bar | The concept has both. No global search exists in FACET, and a control that does nothing is worse than no control. Not rendered until there is something behind it |
| 6.3 | **"Everything I logged."** Neither `/activity` nor `/reports` answers it — see §6.5 | A `?rep=me` filter would be a URL param onto `listReports`'s **existing** `userId` option, so no new predicate — but it changes screen behaviour, not presentation |
| 6.4 | **Where cross-company contact search returns.** `/contacts` leaves the rail; contacts are reached inside a company | Nothing is orphaned — the company detail screen lists contacts and links `/contacts/new?companyId=` — but searching a contact across companies now has no entry point. Likely answered by 6.2 |
| 6.5 | **`coverage()` paginates before it filters — a real defect**, described below | The fix is a data-layer change. Out of scope for a shell stage |
| ~~6.6~~ | ~~The **chain strip**~~, kanban, calendar, drag-and-drop and charts | **The strip CLOSED — feature slice 1**, on the condition this entry set: it consumes `src/lib/chain.ts` and draws `CHAIN_COLUMNS`, labelling each step from `chainOwner`. See §9. The rest stay deferred by the founder to the redesign-decisions document, and the board's columns *are* those positions |
| 6.7 | **The turn column on `/companies` and `/projects`** `[new in stage 2]` | `22 §4` asks every row to say whose move it is. `/quotations`, `/follow-ups` and `/coverage` can: the chain position, the follow-up kind and `daysSince` are already on their rows. `listCompanies` and `listProjects` return **no last-interaction age**, so "Nothing recorded for 23 days" cannot be said there without a data-layer change. Not faked from a second derivation — that is the trap `21 §7` names |
| 6.8 | **Second person for the rep half of a quotation's turn** `[new in stage 2]` | `22 §4` says second person *where that person is the reader*. The coordinator half can be: `canApproveQuotation` names that identity exactly. The rep half names the raiser instead, because `QuotationThreadListRow` carries `raisedByName` and no id — and two people called Mohammed would read each other's turn as their own. A `raisedById` on the row would close it |

### 6.5 The coverage defect, in full

Found while planning stage 1. **It is live on `/coverage` today** — it is not
something the redesign introduced, and the Today screen was changed to avoid
inheriting it.

`isQuiet` is derived in TypeScript at `coverage.ts:183-184`, from `daysSince`,
`thresholdDays` and the on-hold date — all resolved **after** the page of
companies has been fetched. So `quietOnly` can only filter the rows already in
hand: `coverage.ts:189` filters the 25 rows selected at `coverage.ts:136-146`,
which are ordered `asc(companies.nameEn)`.

**The consequence:** `/coverage?quiet=1` returns the quiet companies among the
alphabetically-first 25 companies — **not the first 25 quiet companies**. A rep
whose quiet companies sort late in the alphabet sees an empty screen while nine
companies are genuinely quiet. And `total` at `coverage.ts:190` is the pre-filter
count, so `ListPagination` pages over the wrong denominator: page 2 is the quiet
subset of companies 26–50.

Silently empty is the failure mode this repo keeps hitting (`23`, the
`isCompanyQuiet` 500). Fixing it means moving the `isQuiet` derivation into SQL,
which is a data-layer change. Until then **the Today screen shows no coverage
region and links to `/coverage` instead**. The `company_quiet` KPI tile is safe
and does render — that number comes from `followUps().counts`, which is computed
over the whole scope, not a page.

---

## 7. What stage 1 built **[derived]**

For the record, so a later reader knows which parts of this document are
standing code and which are still paper:

- §1 and §2 — built: tokens and IBM Plex, both themes, cookie-persisted, dark
  by default.
- §3 — the **dashboard** archetype is built (the Today screen). List, detail and
  form are restyled to the tokens but keep their existing structure; their full
  archetype treatment is stage 2.
- §4 — stated here and applied to the Today queue. Applying it to every list and
  detail header is stage 2.

The rail replaced a twelve-item horizontal nav with six grouped items plus
Today. Contacts, Reports, Coverage, Follow-ups, Activity, Notifications and
Targets stopped being top-level; **every route still works** — the change was
navigation, not routing.

---

## 8. What stage 2 built **[derived]**

**All four of §3's archetypes are now standing code**, and §6.1 is closed. The
leverage is the same as stage 1's: six shared components carry the archetypes,
so the pages mostly lost code rather than gaining it.

| Archetype | What it is, in code |
|---|---|
| **List** | `ListCard` (bordered card, table, footer bar) · `FilterNav` (chips that carry the search) · a `numeric` prop on `TableHead`/`TableCell` |
| **Detail** | `DetailHeader` (name · state · mono reference) · `TurnPanel` · `Facts`/`Fact` · `RecordRow` |
| **Form** | `FormShell` (single column in a Card, actions in `CardFooter`) |
| **Dashboard** | the Today screen, now on the concept's own numbers |

Three things are worth knowing before reading the code:

**Two numeric treatments, not one.** §2 says every number is mono; §3 says
numeric columns are end-aligned. Those are not the same set. Magnitudes, money,
counts and dates get both — the `numeric` prop. **Identifiers get mono only**: a
SMAC reference, a phone, an email are read as strings, and end-aligning the
column a list leads with would read as a magnitude. The concept makes the same
split, between its `.num` and its `.code`.

**`src/lib/chain.ts` is the single definition** of `25 §3`'s six chain
positions — see §6.6.

**A turn is named only where a document decides one.** A dispatch, a contact, a
filed report, a superseded version and a user account owe nobody the next
action, so they get a header and facts and no panel. Where nothing decides,
nothing is invented — §6.7 and §6.8 record the two gaps this left.

### 8.1 Three defects it fixed on the way

None of them was introduced by the redesign:

1. **Filter chips dropped the search.** `/reports`, `/dispatches` and `/users`
   linked to a bare `?type=…`, throwing the user's query away — against §3's
   own bullet that filters are shareable, reload-proof URL state. `/follow-ups`
   and `/coverage` each carried a private helper to avoid it; that helper is
   now `FilterNav`, once.
2. **Two detail screens named no record.** `/dispatches/[id]` was titled with a
   *quantity* and `/reports/[id]` with a static string. `DetailHeader` exists
   because a detail screen's identity is three things and `title | description`
   is two.
3. **The handover form had no cancel**, and its submit sat in a mid-form panel.

### 8.2 And one the width check found

The fact grid's rules were first drawn with `gap-px` over a `bg-line` ground.
The concept can do that: it shows exactly four facts, on one row. **A company
detail has thirteen**, which at 1366px wraps to seven tracks and then six — and
the empty seventh track of the last row painted as a solid block of `--line`,
reading as a broken cell.

The rules are drawn by the cells now, so an empty track is simply blank: there
is no cell there to draw one. Recorded because it is the general lesson —
**container-drawn line work assumes a full last row**, and an `auto-fit` grid
is exactly the thing that cannot promise one.

---

## 9. The chain strip **[derived]**

Feature slice 1, and the close of §6.6's first item. `ChainStrip` lives at
`(app)/_components/chain-strip.tsx`, beside `TurnPanel`.

**The turn sentence, then the six steps, then the explanation** — the concept's
`.chain-card`, in that order, on the quotation thread detail screen. The
sentence says whose move it is; the strip says the two things a sentence
cannot — how far the deal has travelled, and what happens next.

**It derives nothing.** Every position, owner and node state comes from
`src/lib/chain.ts`, which grew three things to serve it and the board after it:
`CHAIN_COLUMNS` (the six, in order, with `CHAIN_POSITIONS` now derived from it),
`chainOwner(position)` so every step can be labelled and not only the current
one, and `ChainState.reached` so a **closed** thread can show where it stopped
— `position` alone erases that. `reached` is not a second derivation: the
furthest-along ladder moved into one function that `chainPosition` calls.

Three rules worth keeping:

**A node is ringed only while someone owes it.** That falls out of `owedBy`
rather than being a rule of its own — a dispatched thread's last node is filled,
and a closed thread rings nothing, showing done nodes up to `reached` and hollow
ones after.

**The rail is flex, not absolute.** Each step is `[half-rail][node][half-rail]`,
the outer halves invisible at the ends. The concept positions its connector at
`inset-inline-start:-50%` and flips a `translateX` under RTL; a flex row needs
no override, no transform and no `rtl:` variant.

**The second person must match its reader.** `22 §4` says second person *where
that person is the reader*, and the coordinator opens this screen more than
anyone — she neither raises the request nor confirms the payment. So the
explanation has two variants keyed on `canApproveQuotation`, the same condition
`chainTurnKey` already splits the turn line on. The closing sentence — **only
dispatched square metres count toward a target** `[25 §21]` — is one string for
both, because it is true of the company rather than of a role.

### 9.1 The project screen has two shapes

The strip renders there only where a project has **exactly one** live thread. A
strip implies one position, and a project with three live threads does not have
one, so `25 §22`'s flag replaces it: the count, and quoted against expected.
That flag is **the one place quotations are summed**, and `25 §21` is why —
the sum exists to show that the sum is meaningless.

### 9.2 What it cost elsewhere

- `listQuotationThreads` selects `totalSqm`. One column on an existing query,
  for the flag's quoted figure.
- Both screens pass `hasDispatch` from `listDispatches({ threadId })`, so the
  sixth node is real rather than permanently hollow. Safe by construction:
  `visibleDispatchesFilter`'s thread-cascade term means whoever can see a
  thread can see the dispatches against it.
- That made `dispatched` newly reachable on the quotation screen, which
  surfaced a contradiction: *"Sitting here since 3 August"* under *"Nothing
  outstanding — dispatched"*. The turn panel now gives no elapsed line when
  nobody owes anything, which is what §4 means by colouring how long something
  has waited.
- **Per-step dates are still not drawn**, and no column is needed for them:
  `quotation_versions` carries no `issued_at`, so `timeline.ts`'s
  `quotationIssuedEvents` already takes the actor and the moment from the
  `audit_log` row for `quotation_version.issued`, joined through the version to
  the thread and gated by `visibleQuotationThreadsFilter` — the audit row
  contributing nothing to the access question, which is what keeps it inside
  `20 §8.2`. A later slice extends that source.
