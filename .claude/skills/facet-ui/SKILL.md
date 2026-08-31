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
**An enumeration or a number copied from a rule goes stale silently** — when a `D` rule's
list or cap changes, this file changes in the same commit.

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
| `--surface` `--surface-2` | card, inset — both translucent `D14`, each with a solid counterpart for `D19` |
| `--line` `--line-strong` · `--text` `--text-muted` `--text-faint` | dividers · body, secondary, faint |
| `--brand` · `--a-{red,blue,amber,green}-bg`/`-fg` | brand red · the four tone pairs |

**Colour means elapsed time, never outcome** `D6` — past due red, due soon amber, otherwise
faint, and **no status→colour map**: `accepted` keeps a plain pill, since a green pill is
where "internal approval, never a won deal" `S65` gets lost. The **four** identity
colours — company blue, project amber, quotation red, dispatch green — appear on the rail
marker, a page title's spine and a card's edge, **nowhere else** `D7`. Contact violet is
gone: `D21` forbids violet, and a rule may not mandate what another forbids.

**IBM Plex Sans**, **Sans Arabic** on `html[lang="ar"]`, **Mono for every number** `D10`;
every number is mono and tabular through one class, **`num`** `D11`; scale `D12`, and
**nothing under 10.5px**.

## Effects

Every effect is a named token with a named list of places it may be used; one used anywhere
else is a **defect**, not a flourish `D8`.

| Token | Where it may be used |
|---|---|
| `--canvas-glow` | the two fixed radial gradients on the page background — the only background gradient in the product `D13` |
| `--surface` + `--blur` + `--line-hi` + `--shadow`/`--shadow-lift` | the card texture, identical on every card; resting and hovered depth `D14` `D8`. It is the **`card-face glass`** utility pair in `globals.css`, worn by `Card`, `ListCard`, the board column and the stream card — the dashboard tiles stopped wearing it when `D33` became one quartered card (`A2-27`); a fifth card surface wears that pair, never its own copy |
| `--blur` alone | the rail and the header. Nothing else `D8` `D21` — the **`glass`** utility |
| `--surface-solid` `--surface-2-solid` `--rail-solid` | what each blurred surface becomes under `prefers-reduced-transparency` `D19`. Below 980px the blur is **reduced to 8px, never removed** `D19` |
| `--brand-grad` | **six uses**: primary button · active rail marker · target bar fill · rail count badge · dispatched segment of a rollup bar `D15` · a row's action button filling on hover `D17` |
| `--brand-glow` | **six uses**: primary button · app mark · the pace badge's ring · today's cell in the week strip · the target fill's bloom `D16` · the current chain dot's soft ring `D27` |

Motion is the closed list in `D17`, `prefers-reduced-motion` is the tested path, radius is
`D9` — which records the code at 10/14 and deliberately did not move it — and `D21` names
the forbidden tells. **JavaScript stays near zero** `D20`: depth is CSS, filters are GET
forms in the URL, the theme is a server-read cookie. **`D20` names a test, not a waiver
list** — turn scripts off and ask whether the person can still do the thing; if yes it is
an enhancement and needs no permission. Two things stay forbidden outright: optimistic
rendering `D58`, and dragging a card to change a position `S134` `D29`.

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
  The rail is `D49`'s **seven items plus user management for those who hold it**, in
  *Sell* and *Track*, with Reports, Coverage, Follow-ups, Notifications and Performance
  **not** top-level, so **a new screen usually belongs inside an existing section** `D49`,
  and nothing renders until something is behind it `D51`. **Performance and Targets are one
  item, Targets** `D49` — `28b` merged them, deleted `/performance`, and `GROUPS` holds
  the seven.)

## Archetypes and building blocks

**Pick one of `D24`'s four; do not invent a fifth.** Lists are **grouped by whose move it
is** `D25`, each header naming the group and its count.

- *List* — `SearchForm` · `FilterNav` · `ListCard` (`_components/list-controls`), the
  bordered card with table and pagination footer; `PAGE_SIZE` tracks the data modules.
  **`FilterNav` chips must carry the current search**: a chip linking to a bare `?type=…`
  throws the query away, which broke three lists `D59`.
- *Detail* — `DetailHeader` · `Facts`/`Fact` · `RecordRow` (`page-header`) and
  `Turn`/`TurnPanel` (`_components/turn`); **the turn panel is the screen's most important
  element** `D24`; `DetailRow` survives only for a totals block.
- *Form* — `FormShell` (`form-field`), shaped by `D24`, phone-first `D55`; `wide` is for
  repeating rows only. *Dashboard* — `D24`, and **one screen of blocks** `D64`: no rep
  dashboard and no manager dashboard, six blocks in a fixed order, each qualified by a
  permission flag. Contents `D32`–`D41`, `D65`–`D68`.

**Two numeric treatments**: magnitudes, money, counts and dates take the `numeric` prop on
`TableHead`/`TableCell`/`Fact` — mono **and** end-aligned together `D11` `D24`; identifiers
(SMAC reference, phone, email) take `className="num"` alone, since end-aligning a column a
list leads with reads as a magnitude.

**A row says whose move it is, not what the status is** `D2`, and the boolean behind
`turnTone({ overdue })` must come from a derivation the data layer already made — **never
derive a threshold in a screen** (`CLAUDE.md`: derived conditions are resolved in SQL,
before pagination). Where no rule decides whose move it is, do not invent one — `D26` settles
it per object, and a dispatch's turns on its state `S72`.

**An empty list** says what would make it non-empty and offers the action `D52`, takes a
different key when a search filtered it away, and sits **outside** `ListCard`, where a
pagination footer would make it read as broken `D60`; no skeleton state `D54`. **Container-drawn
line work assumes a full last row** — an `auto-fit` grid cannot promise one, so put the
borders on the cells `D61`.

## Rows and views

Each object type has its own **first column** — same table component, different lead cell.
The object-to-lead-cell mapping is `D26`'s: read it there. A copy of it lived here and had
already dropped a clause `D26` gained — do not put it back.

The mini-chain draws from `chainState()` in `src/lib/chain.ts` and nothing else, and
**derives nothing** `D27`; that file is the one definition of the six chain positions the
board's columns use `D29`.

**A control a thumb has to hit is at least 44px below `md`** `D74` — every button, input,
select and native date field. It is a **floor, not a size**: `min-height`/`min-width` on the
component's base, never `height`, which is what lets it outrank the `h-6` an `xs` chip
carries. **A component's own floor IS the floor and a caller may not pin it** — a local
`h-11` on a call site overrides it in both directions, 44px on a laptop where `D22`'s
density is deliberate. Anything hand-rolled rather than a `Button` has to say the floor
itself. A checkbox is the exception: its `<label htmlFor>` is the target. **Sixteen pixels
is a separate thing** — iOS Safari zooms on focus under 16px, so a text control carries
`text-base md:text-sm`, and repeating that locally pins 16px above `md`.

**On a phone a row keeps its lead cell, the name, and the one column the list's own
anatomy needs** `D56` — read the per-list table there; a copy here would go stale the
way the one above it did. Where the lead cell IS the name, that is two, not three. It is
**one DOM re-laid out in CSS**: `<Table phoneRows>` opts a list in, `TableCell`'s
`phone` prop names each slot, and an unannotated cell is hidden below `md` — hidden,
never scrolled. The kept column and a row action share one slot, so *the one column* is
structural. Six rep-facing lists take it; `/users`, `/targets` and `/activity?view=by-rep`
are laptop-first `D55` and declare the scroller they keep.

**One query parameter, no second screen** `D28` — `?view=` over the same filters, URL and
data: quotations default `table`, projects `board`, plus `cards`; Activity is `stream`
(default), `by-rep`, `calendar` `D30`. Board columns are the six chain positions and **cards
do not drag** `D29`. Build order `D31`.

## Forms, actions and values

- **A native `<select>`, deliberately** `D20` — no hidden-input bridge, no client state, no
  JavaScript to submit, and the browser places the RTL popup. **There is no exception list
  to join** `D20`: `Combobox` was deleted in session 40 and the rewritten rule names a test,
  not waivers. A long list is grouped instead — `city-field.tsx` puts 171 cities into five
  `<optgroup>`s keyed on the region `S15` already derives from the city.
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
- **Direction follows the run, and the test is one question: is there a word in it?** `D73`
  A run holding a **translated word** takes `dir="auto"`; only a **bare figure** — a
  reference, a decimal, a date, a percentage, a count standing alone — takes `dir="ltr"`.
  **Nothing takes `dir="ltr"` merely because it contains digits**: forcing it over
  *figure · word · figure* reverses the two figures for an RTL reader, so `4 of 13` renders
  as `13 of 4`, silently. The tell is a `dir` on a **container** rather than on a value.
  And `D62` is the same instinct about a **stored** value: one that may hold either script
  takes `dir="auto"` wherever it is entered or displayed, because direction belongs to the
  value, not the page.
  Decimals stay **strings** end to end; square metres are computed, never typed `S55`.
- Dates: `format.dateTime(new Date(value + "T00:00:00Z"), { dateStyle: "medium", timeZone:
  "UTC" })` from `getFormatter()` — a calendar day in Riyadh, not an instant. **One name
  field** `S12` `S19` `S26`: a company, contact **or project** renders `row.name`.
  `lookupName` covers what still carries a pair — the lookup tables alone, since `S26`
  took projects off that list; `bilingualName` is gone.

Screen contents when you need them: the dashboard's block model `D64` · its no-flag case
`D32`–`D37` · what a flag adds `D38`–`D41` · the coordinator `D65` · Marketing and the
Executive `D67` `D68` · where a dispatch's difference is seen `D66` · rollup `D42`–`D44` ·
stream, Log button, private note `D45`–`D47` · comments on quotation threads and projects
only `D48` `S114` · responsive `D55` `D56` `D74` · deliberately not built `D58` `D21`.

**Two rules here carry markers and describe something unbuilt** — read them before citing
them. `D71`, a mark on a card, waits on `S135`; `D72`, the visible refresh line, ships on
the lists, the stream and the coordinator's requests block, and **not** on the waiting list
or the rail's Today count.

## Before calling a screen done

1. Does every row say whose move it is, not only its status? `D2`
2. Is it one of the four archetypes, and is the list grouped? `D24` `D25`
3. Is every number `num`, mono and tabular, and nothing under 10.5px? `D11` `D12`
4. Is colour only elapsed time, and identity colour only in `D7`'s three places? `D6` `D7`
5. Is every effect one of its token's named uses? `D13`–`D17` `D21`
6. Does it look right with blur off `D19`, and did you test `prefers-reduced-motion`? `D17`
7. Is the physical-utility grep still zero `D57` `S113` —
   `ml-|mr-|pl-|pr-|text-left|text-right|border-l-|border-r-|left-|right-`?
   (`left-*` and `right-*` are in the Use/Never table above and were missing here.)
8. Driven in **both locales** `D57`, at **1366 and 1440 first** `D23`, then **375**
   `D55` `D56` — a wide viewport hides exactly the wrapping a laptop shows, and a laptop
   hides what a phone does?
9. `npm run typecheck` · `lint` · `build` · `check:messages`, then `npm run build && npm run
   start` and `npm run verify:routes`, never `next dev`. **`build` is not optional**: it
   alone catches a client component importing a data module (`CLAUDE.md`).
10. Asserting on markup? A DOM marker like `name="smacReference"`, never a translated string
    (`CLAUDE.md`).
