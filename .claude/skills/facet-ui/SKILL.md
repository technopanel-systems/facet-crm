---
name: facet-ui
description: FACET's screen conventions as an index into DESIGN.md (D rules) and SPEC.md (S rules) — palette and effect tokens, colour semantics, type, the four archetypes, per-object row anatomy, view modes, the server-page shape, forms and server actions, RTL logical utilities, and the pre-flight list. Use for any work under src/app or src/components: building, editing or reviewing a page, form, table, detail screen or React component, and before calling a screen done.
---

# FACET UI conventions

An index into **`DESIGN.md`** (`D…`, how it looks) and **`SPEC.md`** (`S…`, what it does).
Where this file and `DESIGN.md` disagree, **`DESIGN.md` wins**. `DESIGN.md` may never change
behaviour, visibility or what a record may contain: where the two appear to conflict on any
of those, **`SPEC.md` wins**. `docs/design/facet-concept-v5-premium.html` is the visual
target, not authority — a screen that pixel-matches the concept against a `D` rule is wrong.
A line here with no `D`, `S` or `CLAUDE.md` behind it is a repo mechanic.

## Non-negotiable

- **Every user-facing string through the translation layer** (EN + AR) `S113`;
  `useTranslations` client-side, `getTranslations` server-side, one shared tree in
  `en.json`/`ar.json`, enforced by `npm run check:messages`.
- **Logical utilities only** `D57` `S113`, the convention that rots fastest. Arabic then
  needs no `rtl:` variants, and the mini-chain, silence meter and pace line are flex rows
  needing none. Radix reads `DirectionProvider` in the locale layout.
- **Navigation from `@/i18n/navigation`** — `next/*` drops the locale prefix.
- **No `@/lib/*` data-module import in a client component** — it bundles the Postgres driver
  and only `build` catches it (`CLAUDE.md`); re-declare option types client-side.

| Use | Never |
|---|---|
| `ms-*` `me-*` `ps-*` `pe-*` | `ml-*` `mr-*` `pl-*` `pr-*` |
| `text-start` `text-end` | `text-left` `text-right` |
| `start-*` `end-*` `border-s` `border-e` | `left-*` `right-*` `border-l` `border-r` |

## Palette, colour and type

**Both themes are designed, not inverted** `D5` — dark default, rail dark in both — and
**every neutral carries a red undertone** `D4`; one drifting blue is a bug. Values live in
`D5` and in the stylesheet: **never type a hex into a component.**

| Token | For |
|---|---|
| `--canvas` · `--rail` | page ground · rail ground, dark in both themes |
| `--surface` `--surface-2` `--surface-3` | card, inset, inset-within-inset |
| `--line` `--line-strong` · `--text` `--text-muted` `--text-faint` | dividers · body, secondary, faint |
| `--brand` · `--a-{red,blue,amber,green}-bg`/`-fg` | brand red · the four tone pairs |

**Colour means elapsed time, never outcome** `D6` — past due red, due soon amber, otherwise
faint, and **no status→colour map**: `accepted` keeps a plain pill, since a green pill is
where "internal approval, never a won deal" `S65` gets lost. The five **identity colours**
appear on the rail marker, a page title's spine and a card's edge, **nowhere else** `D7`.

**IBM Plex Sans**, **Sans Arabic** on `html[lang="ar"]`, **Mono for every number** `D10`;
every number is mono and tabular through one class, **`num`** `D11`; scale `D12`, and
**nothing under 10.5px**.

## Effects

Every effect is a named token with a named list of places it may be used; one used anywhere
else is a **defect**, not a flourish `D8`.

| Token | Where it may be used |
|---|---|
| `--canvas-glow` | the two fixed radial gradients on the page background — the only background gradient in the product `D13` |
| `--surface` + `--blur` + `--line-hi` + `--shadow`/`--shadow-lift` | the card texture, identical on every card; resting and hovered depth `D14` `D8` |
| `--surface-solid` | the fallback below 980px and under `prefers-reduced-transparency` `D18` `D19` |
| `--brand-grad` | **five uses**: primary button · active rail marker · target bar fill · rail count badge · dispatched segment of a rollup bar `D15` |
| `--brand-glow` | **four uses**: primary button and app mark · the pace badge's ring · today's cell in the week strip · the target fill's bloom `D16` |

Motion is the closed list in `D17`, `prefers-reduced-motion` is the tested path, radius is
`D9`, and `D21` names the forbidden tells. **JavaScript stays near zero** `D20`: depth is
CSS, filters are GET forms in the URL, the theme is a server-read cookie, and the only
exceptions are the city combobox, the view-mode switch and the board's scroll.

## Page and permission shape

- A page under `(app)/` is `export const dynamic = "force-dynamic"`, awaits its
  `params`/`searchParams` Promises, calls `setRequestLocale`, `requireSession()`, then its
  data module; a missing record is `notFound()`.
- **The `(app)` layout owns the content column** — 1320px cap, **start-aligned**, hugging
  the rail `D23`, spaced per `D22`; a page returns a `<div>` of its own flow and **never**
  `mx-auto`, `px-*` or `py-*`. A narrower measure goes on that `<div>`, never the form:
  `max-w-2xl` for field-stack forms, `max-w-4xl` for the two timeline pages, the full
  column for lists, detail screens and repeaters.
- **Permission shapes** — a route the role may not use returns `notFound()` `D53`, never a
  message; an unavailable action is not rendered; rail visibility is a boolean from the
  layout, never a `can()` in a client component `D50`; the data layer re-checks either way
  `S109`, so the UI is never the gate.
- **Structure** — `page.tsx`, `new/`, `[id]/`, `[id]/edit/`, `actions.ts`, `thing-form.tsx`.
  The rail is `D49`'s seven items, with Reports, Coverage, Follow-ups, Notifications and
  Performance **not** top-level, so **a new screen usually belongs inside an existing
  section** `D49`, and nothing renders until something is behind it `D51`. (`GROUPS` still
  holds the older six — the shell slice builds it to `D49`.)

## Archetypes and building blocks

**Pick one of `D24`'s four; do not invent a fifth.** Lists are **grouped by whose move it
is** `D25`, each header naming the group and its count.

- *List* — `SearchForm` · `FilterNav` · `ListCard` (`_components/list-controls`), the
  bordered card with table and pagination footer; `PAGE_SIZE` tracks the data modules.
  **`FilterNav` chips must carry the current search**: a chip linking to a bare `?type=…`
  throws the query away, which broke three lists.
- *Detail* — `DetailHeader` · `Facts`/`Fact` · `RecordRow` (`page-header`) and
  `Turn`/`TurnPanel` (`_components/turn`); **the turn panel is the screen's most important
  element** `D24`; `DetailRow` survives only for a totals block.
- *Form* — `FormShell` (`form-field`), shaped by `D24`, phone-first `D55`; `wide` is for
  repeating rows only. *Dashboard* — `D24`, contents `D32`–`D41`.

**Two numeric treatments**: magnitudes, money, counts and dates take the `numeric` prop on
`TableHead`/`TableCell`/`Fact` — mono **and** end-aligned together `D11` `D24`; identifiers
(SMAC reference, phone, email) take `className="num"` alone, since end-aligning a column a
list leads with reads as a magnitude.

**A row says whose move it is, not what the status is** `D2`, and the boolean behind
`turnTone({ overdue })` must come from a derivation the data layer already made — **never
derive a threshold in a screen** (`CLAUDE.md`: derived conditions are resolved in SQL,
before pagination). Where no rule decides whose move it is, do not invent one: a dispatch, a
contact and a filed report owe nobody `D26`.

**An empty list** says what would make it non-empty and offers the action `D52`, takes a
different key when a search filtered it away, and sits **outside** `ListCard`, where a
pagination footer would make it read as broken; no skeleton state `D54`. **Container-drawn
line work assumes a full last row** — an `auto-fit` grid cannot promise one, so put the
borders on the cells.

## Rows and views

Each object type has its own **first column** — same table, different lead cell `D26`:

| Object | Lead cell | The question it answers |
|---|---|---|
| Company | a silence meter — small bar and day count, coloured by lateness | have I neglected this? |
| Project | a six-dot mini-chain, plus a quoted-vs-dispatched bar | where is this? |
| Quotation | an avatar and whose move it is | who does this wait on? |
| Dispatch | the square metres, mono, large | how much went out? |
| Contact | name and position | who is this? |

The mini-chain draws from `chainState()` in `src/lib/chain.ts` and nothing else, and
**derives nothing** `D27`; that file is the one definition of the six chain positions the
board's columns use `D29`. On a phone a row collapses to lead cell, name and elapsed
time `D56`.

**One query parameter, no second screen** `D28` — `?view=` over the same filters, URL and
data: quotations default `table`, projects `board`, plus `cards`; Activity is `stream`
(default), `by-rep`, `calendar` `D30`. Board columns are the six chain positions and **cards
do not drag** `D29`. Build order `D31`.

## Forms, actions and values

- **A native `<select>`, deliberately** `D20` — no hidden-input bridge, no client state, no
  JavaScript to submit, and the browser places the RTL popup. **`Combobox` is the one
  documented exception** `D20`, for the ~200-item city list.
- **Filters and search are GET forms in the URL** `D20` `D45`, never client state: shareable,
  survives reload, needs no JavaScript.
- The form is `"use client"` with `useActionState(action, emptyFormState)`; submit shows
  `t("common.saving")` while `pending`; **errors are translation keys, never text**;
  `state.values` re-fills a rejected form.
- An action takes `(_previous: FormState, formData)` and is its own POST — no layout wraps
  it, so it calls `requireSession()` itself `S109`. `readFields` checks shape and accumulates
  errors; invariants come back from the data layer as `RuleError` → `ruleErrorState()`, also
  a key; then `revalidatePath()` and `redirect()` from `@/i18n/navigation`. The audit row is
  the data layer's `S112`.
- Wrap LTR content in Arabic with `dir="ltr"` — references, decimals, dates, percentages, m².
  Decimals stay **strings** end to end; square metres are computed, never typed `S55`.
- Dates: `format.dateTime(new Date(value + "T00:00:00Z"), { dateStyle: "medium", timeZone:
  "UTC" })` from `getFormatter()` — a calendar day in Riyadh, not an instant. **One name
  field** `S12` `S19`; `bilingualName` is still in the code and goes in the model slice — do
  not use it in a new screen.

Screen contents when you need them: rep dashboard `D32`–`D37` · manager `D38`–`D41` · rollup
`D42`–`D44` · stream, Log button, private note `D45`–`D47` · comments on quotation threads
and projects only `D48` `S114` · responsive `D55` `D56` · deliberately not built `D58` `D21`.

## Before calling a screen done

1. Does every row say whose move it is, not only its status? `D2`
2. Is it one of the four archetypes, and is the list grouped? `D24` `D25`
3. Is every number `num`, mono and tabular, and nothing under 10.5px? `D11` `D12`
4. Is colour only elapsed time, and identity colour only in `D7`'s three places? `D6` `D7`
5. Is every effect one of its token's named uses? `D13`–`D17` `D21`
6. Does it look right with blur off `D18` `D19`, and did you test `prefers-reduced-motion`? `D17`
7. Is the physical-utility grep still zero `D57` `S113` —
   `ml-|mr-|pl-|pr-|text-left|text-right|border-l-|border-r-`?
8. Driven in **both locales** `D57`, at **1366 and 1440 first** `D23`?
9. `npm run typecheck` · `lint` · `build` · `check:messages`, then `npm run build && npm run
   start` and `npm run verify:routes`, never `next dev`. **`build` is not optional**: it
   alone catches a client component importing a data module (`CLAUDE.md`).
10. Asserting on markup? A DOM marker like `name="smacReference"`, never a translated string
    (`CLAUDE.md`).
