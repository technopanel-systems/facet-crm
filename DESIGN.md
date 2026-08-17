# FACET — Design

How FACET looks and behaves on screen. This is the single design authority.
It sits **beside** `SPEC.md`, which decides what the system does; where the two
seem to conflict, `SPEC.md` wins — this document may never change behaviour,
visibility or what a record may contain.

Rules are numbered `D1`… and cited by number.

---

## 1. What FACET is for, on screen

**D1.** FACET is a work tool used every day by fourteen people, most of them on
laptops at 1366px, some on phones in a customer's lobby. It is not a marketing
site, a landing page or a demo. Every visual decision is measured against one
question: **does this help a person finish what is waiting on them?**

**D2.** The one rule every screen is judged against: **a row says whose move it
is, not what the status is.** *"Waiting on Rawan — signatures"* beats *"Issued"*.
*"Nothing recorded for 23 days"* beats *"Lead"*. A status pill may sit beside
it; it is never the only thing a row says.

**D3.** The bar to clear is: **someone opens FACET and thinks "this does not
look like an ERP" — then, after a week, "this is easier."** The second matters
more than the first.

---

## 2. Palette — warm black, unchanged

**D4.** Every neutral carries a **red undertone, never blue**. The greys are
mixed toward the brand red so the interface reads as ink, not slate. A neutral
that drifts blue is a bug.

**D5.** **Both themes are designed, not inverted.** Dark is the default. Light is
not dark with lightness flipped. The rail is dark in both.

| Token | Dark | Light |
|---|---|---|
| `--canvas` | `#151211` | `#F8F6F4` |
| `--surface` | `#1D1A18` | `#FFFFFF` |
| `--surface-2` | `#252120` | `#FAF8F6` |
| `--surface-3` | `#2C2725` | `#F1EDE9` |
| `--line` | `#302B29` | `#E8E3DE` |
| `--line-strong` | `#403A37` | `#D6CFC9` |
| `--text` | `#F0EBE8` | `#1A1614` |
| `--text-muted` | `#A29996` | `#6B615C` |
| `--text-faint` | `#756C69` | `#9A908A` |
| `--rail` | `#0E0C0B` | `#171311` |
| `--brand` | `#F2566B` | `#C8102E` |
| `--a-red-bg` / `-fg` | `#2E1418` / `#F98A98` | `#FDF1F2` / `#C8102E` |
| `--a-blue-bg` / `-fg` | `#141F31` / `#7FADEE` | `#EEF4FC` / `#2B5CA8` |
| `--a-amber-bg` / `-fg` | `#2B1F0C` / `#E3A63E` | `#FDF4E6` / `#B45309` |
| `--a-green-bg` / `-fg` | `#0F2417` / `#57C57E` | `#EFF9F1` / `#15803D` |

The full mapping onto shadcn's semantic tokens is already in code and stays.

**D6.** **Colour describes how long something has waited, never how good the
outcome is.** Past due is red, due soon is amber, otherwise faint. There is
**no status→colour map**. `accepted` keeps a plain pill, because a green pill is
the first place "internal approval, never a won deal" gets lost.

**D7.** **Object identity colours** exist — company blue, project amber,
quotation red, contact violet, dispatch green — and appear **only** on the rail
marker, a page title's spine, and a card's edge. Never on a state, never on a
pill, never on text. Object type is not a status.

**D8. Effect tokens.** These carry the visual system and are listed here so
they are inspectable rather than scattered as inline values.

| Token | Purpose |
|---|---|
| `--canvas-glow` | the two fixed radial gradients on the page background |
| `--surface` / `--surface-2` | translucent card and inset surfaces |
| `--surface-solid` | the reduced-blur rule (D19) |
| `--line-hi` | the one-pixel top-edge highlight on a card |
| `--brand-grad` | red→orange, five uses only (D15) |
| `--brand-glow` | five uses only (D16) |
| `--shadow` / `--shadow-lift` | resting and hovered depth |
| `--blur` | 18px + saturation, cards and bars only |

**D9. Radius:** 12px cards, 16px large cards, 8–10px controls, 20px pills.
Nothing sharper, nothing rounder.

---

## 3. Type

**D10.** **IBM Plex Sans** for UI text, **IBM Plex Sans Arabic** on
`html[lang="ar"]`, **IBM Plex Mono** for every number. Never Inter, never
Roboto, never a system stack.

**D11.** **Every number is mono with tabular figures** — quantities, square
metres, money, references, dates, counts. One utility class, `num`.

**D12.** Scale: base 14px / 1.5. Page title 24px / 600 / `-.025em`. Card heading
14px / 600. Section labels 10.5px / 600 / `.09em` / uppercase. **Nothing is
smaller than 10.5px.** Not everything is bold; weight 600 is for names and
headings, 500 for emphasis, 400 for everything else.

---

## 4. Depth, motion and JavaScript

FACET uses gradient, glow, blur and shadow **as a design system, not as
decoration**. The discipline that keeps this from becoming generic is simple and
absolute: **every effect is a named token with a named list of places it may be
used.** An effect used anywhere else is a defect, not a flourish.

**D13. The canvas carries atmosphere.** Two fixed radial gradients — red at
8% -10%, blue at 100% 0%, both under 14% opacity — on `--canvas-glow`. This is
the only place a background gradient appears. Never on a card, never behind a
section, never as a blob.

**D14. The card is a translucent surface.** `--surface` at ~72% opacity,
`--blur` (18px + slight saturation), a one-pixel top-edge highlight
(`--line-hi`), and a deep soft shadow with an inner top light. That combination
is the product's texture and it is used on every card, identically.

**D15. The brand gradient has exactly five uses.** `--brand-grad` appears on:
the primary button, the active rail marker, the target bar's fill, the rail
count badge, and the dispatched segment of a rollup bar. Nowhere else. Not on
text, not on pills, not on borders.

**D16. Glow has exactly five uses.** `--brand-glow` on the primary button and
the app mark; a soft ring on the pace badge; a ring on today's cell in the week
strip; the target fill's bloom. Nothing else glows. A glow is emphasis, and
everything emphasised is nothing emphasised.

**D17. Motion is small, fast and explains something.** A view change fades and
rises 6px over 350ms. A count tile lifts 2px on hover. A row's action button
fills with the brand gradient on hover. That is the complete list. No page
transitions, no scroll reveals, no skeleton shimmer, no counting numbers, no
bouncing. `prefers-reduced-motion` is respected and is the path that gets
tested.

**D18. Blur is capped for performance.** `backdrop-filter` is GPU work, and
FACET runs on phones over a tunnel from a Windows PC. Below 980px, and under
`prefers-reduced-transparency`, every blurred surface falls back to
`--surface-solid` with no filter. The design must look correct with blur off —
check it that way before calling a screen done.

**D19. Looks win; performance is tuned afterwards.** Of everything in D13-D16,
only `backdrop-filter` costs real work - gradients, shadows and glow are
effectively free. So the effects stay on everywhere, including phones, and the
blur radius is reduced rather than removed on small screens (18px desktop, 8px
below 980px). Under `prefers-reduced-transparency`, surfaces fall back to
`--surface-solid`. If a screen ever measures slow on a real phone, the fix is to
lower that one number - never to strip the design.

**D20. JavaScript stays near zero regardless of how the surface looks.** Depth
is CSS. Filters are GET forms in the URL. Native `<select>`. The theme is a
server-read cookie. The named exceptions are: the ~200-item city combobox, the
view-mode switch, and the board's horizontal scroll. Nothing else, and none of
the visual system above requires any.

**D21. Still forbidden, and these are the actual tells.** Purple, violet or cyan
accents. Rainbow or multi-hue gradients. Large gradient blobs. Glassmorphism on
elements other than cards and the two bars. A hover state that changes nothing.
An icon centred above a heading. Nested cards. Inter, Roboto, or a system font
stack. Six equal-weight tiles where four would do. Any effect not named in
D13–D17.

---

## 5. Layout and the four archetypes

**D22. Space is generous rather than tight.** Card padding 15-22px, row padding
11-12px vertical and 16-18px horizontal, 14px between cards. Legibility and calm
beat fitting one more row on screen - this is a tool people look at all day, and
a cramped screen reads as cheap however good the palette is.

**D23.** The content column is capped at 1320px and **start-aligned** — it hugs
the rail rather than floating. Check 1366 and 1440 first, then wide.

**D24.** Every screen is one of four shapes. A new screen picks one; it does not
invent a fifth.

**List.** Grouped, never flat. Group headers say the group's name and count.
Search and filters are URL state. Numeric columns end-aligned and mono. One
column says whose move it is. Pagination in the footer.

**Detail.** Name, mono reference, one line of state. Then a **turn panel**
naming who owes the next action — the most important element on the screen.
Then facts in a bordered grid, then related records as cards.

**Form.** Single column, labels above, errors under the control, actions in a
footer bar. Built for a phone first where a rep uses it.

**Dashboard.** A signature panel across the top. Then a plain counts strip.
Then the waiting list on the wide side and a companion on the narrow side.

**D25.** **Lists are grouped by whose move it is.** Companies group as gone
quiet / due soon / recently touched. Quotations group as your move / waiting on
the coordinator / waiting on the customer. Projects group as your move / moving.
A flat list of forty identical rows is what reads as generic no matter how it's
styled.

---

## 6. Per-object row anatomy

**D26.** Each object type has its own **first column** — a visual that answers
that object's question before a word is read. Same table component, different
lead cell.

| Object | Lead cell | The question it answers |
|---|---|---|
| **Company** | a **silence meter** — a small bar and a day count, coloured by lateness | have I neglected this? |
| **Project** | a **six-dot mini-chain** showing chain position, plus a quoted-vs-dispatched bar | where is this? |
| **Quotation** | an **avatar and whose move it is** — "Rawan · signatures", "You · confirm payment" | who does this wait on? |
| **Dispatch** | the square metres, mono, large | how much went out? |
| **Contact** | name and position | who is this? |

**D27.** The mini-chain draws from `src/lib/chain.ts` and nothing else. Done
dots green, the current dot amber with a soft ring, future dots hollow. It
derives nothing.

---

## 7. View modes

**D28.** Projects and Quotations offer **more than one view of the same query**:
`?view=table` (default for quotations), `?view=board` (default for projects),
`?view=cards`. Same filters, same URL, same data — different arrangement. Nobody
builds a second screen for a second view.

**D29.** **The board's columns are the six chain positions** — New · Requested ·
Signature · Payment · Paid · Dispatched. Position is computed from real events.
**Cards do not drag.** Dragging from "Payment" to "Paid" would be claiming a
payment that didn't happen. Lost projects leave the board and live in a filter,
or the board becomes a graveyard nobody clears.

**D30.** Activity offers `?view=stream` (default), `?view=by-rep`, and
`?view=calendar`. All three read one query. "Just me" is a filter chip on the
stream, not a separate screen.

**D31.** Build order: table and stream first. Board second. Cards and calendar
only if someone asks twice.

---

## 8. The rep's dashboard — "what should I work on today?"

**D32. The signature panel is the target with a pace line.** Dispatched square
metres this month as a large mono figure, of the target; a bar filled to
achievement; a **vertical tick at today's position in the month**. Above the
tick is ahead, below is behind. Beside it, three small figures: paid-not-yet-out
(and what that would make the percentage), awaiting signature, last month.

**D33. The counts strip** is a plain quartered row inside one card, not four
KPI cards. Companies gone quiet · quotations on you · projects not moved ·
on hold resuming this week. Each is a link into the waiting list, filtered.

**D34. The waiting list** is the wide column. Grouped Overdue / Due soon, oldest
first. Each row: a one-letter kind mark (Q, C, P), the record, one line of why,
elapsed time coloured by lateness, and **the action as a button on the row** —
Log, Confirm, Open. The exit door is on the row.

**D35. The week strip** on the narrow side: seven days, two bars per day —
logged (red) and system events on your records (blue). Friday and Saturday
visibly off. Nothing more; this is what stops the view becoming an attendance
check.

**D36. Recently** below it: the last few events with three kinds of mark —
✎ typed by a person, ◆ observed by the system, 💬 said between colleagues.

**D37.** Nothing on the rep's dashboard is company-wide. No team figures, no
other reps, no executive analytics.

---

## 9. The manager's dashboard — "where do I need to intervene?"

**D38.** The **same signature panel**, at company scope. Same pace line.

**D39. The team table**: one row per rep — a small pace bar with the tick, m²
dispatched of target, waiting-on-them as two counts (overdue in red, due soon
plain), logged this week, quiet companies. **The footer says what the table is
for and is not**: *"Saad logged the most and dispatched the least. That is a
conversation, not a formula."* Activity and target sit side by side and are
never combined into a score.

**D40. "Waiting on the coordinator"** — the bottleneck card, because the
coordinator is one person and the quotation chain runs through her.

**D41. "Needs a decision"** — duplicates, archive requests, credit approvals,
shares. The four things the system routes to a manager, on one card, nowhere
else. This is what makes the manager's version of the waiting list different.

---

## 10. The monthly rollup — "what happened, and why?"

**D42.** Four figures across the top in square metres: quoted · approved · paid
· dispatched, each with its count. Beside them: lost, and still open. A note
under it stating that quoted counts each thread's latest live version once, and
that dispatched can exceed paid because credit customers ship first.

**D43. Quoted vs dispatched, by rep** — a two-segment bar per rep, red for
dispatched, grey for the gap. Sliced by rep as the first cut, per the founder.

**D44. Where the gap went** — loss reasons ranked as horizontal bars, with the
square metres lost to each. And one line under it, which is the whole point of
the signal system: *"7 of 9 losses had the same reason logged as a signal before
the loss — 19 days before."* Whether that number moves is how you know the
signals are worth recording.

---

## 11. Reports and the stream

**D45.** "What happened" is **one stream**, not five screens. It has three
event kinds (typed / observed / said) and filters down the side — who, what
kind, outcome, signals raised. Every filter is a URL parameter. A record's
timeline is the same stream, scoped to that record.

**D46.** The **Log button** on a company page opens pre-filled. Three taps and a
text box. Channel, outcome, optional project and contact, optional signals, the
note. Built for a phone.

**D47.** A report's shared half and its private note render differently: the
note is visually a quote block, and is absent entirely for a reader who may not
see it. Nothing is greyed out or "locked" — it simply is not there.

---

## 12. Comments

**D48.** Comments appear on **quotation threads and projects only**, inside the
timeline as a third event kind, with a plain composer in the card — a box, the
people to tell, a button. No typing indicator, no read receipt, no reply
threading, no emoji. Nothing renders a comments card on a company, contact or
dispatch.

---

## 13. Navigation

**D49.** The rail carries **Waiting on me** (with a count), then Companies,
Projects, Quotations, Dispatches under *Work*; Activity and Targets under
*Team*; user management for those who hold it. Seven items. Reports, Coverage,
Follow-ups, Notifications and Performance are **not top-level** — they are the
waiting list and the stream, filtered.

**D50.** The rail is hidden by a permission boolean passed from the layout, never
by a `can()` call in a client component. Hiding a link is cosmetic; the route
still returns `notFound()`.

**D51.** No global search is rendered until there is something behind it. A
control that does nothing is worse than no control.

---

## 14. Empty, error and permission states

**D52.** An empty list says what would make it non-empty and offers the action.
*"Nothing is waiting on you. That is the goal."* *"No companies yet — add the
first one, or import from a spreadsheet."*

**D53.** A permission-denied route is `notFound()`. FACET does not tell someone
a thing exists that they may not see.

**D54.** There is no skeleton state. Server-rendered pages arrive whole.

---

## 15. Responsive

**D55.** Rep-facing screens — waiting list, log form, company lookup, quotation
request — are **built phone-first**. Manager and coordinator screens are
laptop-first. Nothing is designed for tablet specifically.

**D56.** On a phone, a table row collapses to its lead cell, name and elapsed
time; secondary columns are hidden, not scrolled. The rail becomes a bottom
sheet. The board scrolls horizontally with the current column snapped in view.

---

## 16. RTL

**D57.** Logical utilities only — `ms-*` not `ml-*`, `text-start` not
`text-left`, `inset-inline-start` not `left`. Native controls place themselves.
The mini-chain, the silence meter and the pace line are flex rows and need no
`rtl:` override. Every screen is driven in both locales before it is done.

---

## 17. What is not built, deliberately

**D58.** No drag-and-drop anywhere. No inline cell editing. No bulk selection.
No saved views. No keyboard command palette. No charts beyond bars and the pace
line. No toasts — the row changing is the feedback. Each of these can be argued
for later; none is argued for now, and each would breach D21.

**D59.** A filter chip carries the current search. A chip linking to a bare
`?type=…` throws the query away and the list silently returns the wrong rows.
This broke three lists.

**D60.** The empty state sits outside the list card, not inside it. D52 decides
what it says; this decides where. Inside a card with a pagination footer, an
empty list reads as a broken page rather than an empty one.

**D61.** Container-drawn line work assumes a full last row, and an `auto-fit`
grid cannot promise one — the empty track paints as a solid rule. Borders go on
the cells.
