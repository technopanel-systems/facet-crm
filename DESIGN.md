# FACET — Design

How FACET looks and behaves on screen. This is the single design authority.
It sits **beside** `SPEC.md`, which decides what the system does; where the two
seem to conflict, `SPEC.md` wins — this document may never change behaviour,
visibility or what a record may contain.

Rules are numbered `D1`… and cited by number.

**Markers**, on `SPEC.md`'s definitions and for the same reason: a rule with no
marker describes the screen as it renders today.

- **[CHANGE]** — the code currently does something different. This is the target.
- **[BUILD]** — nothing exists yet.

`D48` was the first rule here to carry one, and the legend is written down
rather than inferred from it (`WORKFLOW §5 AD7`). **A `D` marker is not in the
progress bar** — `npm run status` counts `SPEC.md`'s and only those, so adding
one here moves no number. The point is the opposite of a count: `WORKFLOW §7`
asks that a rule say whether work remains, and a number of rules in this file
describe things that do not exist while reading as finished.

**How many is not stated here, deliberately.** `AUDIT DESIGN` counted them on
24 Aug 2026 and `WORKFLOW §5` carries that tally with its own instruction —
*re-take the count; do not patch it*. Phase 2 has since made a good part of it
true, so a number repeated here would be the stale one people trust. Re-taking
it belongs to the rule review `§6b`, beside `AUDIT 2`, and so does marking the
rules it finds. What a build slice may not do is leave the one rule it just
touched still reading as finished — which is why `D71` and `D72` carry markers
and the older set does not yet.

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

## 2. Palette — warm black

**D4.** Every neutral carries a **red undertone, never blue**. The greys are
mixed toward the brand red so the interface reads as ink, not slate. A neutral
that drifts blue is a bug.

**D5.** **Both themes are designed, not inverted.** Dark is the default. Light is
not dark with lightness flipped. The rail is dark in both.

**A surface is translucent** `D14`, so a surface token is an `rgba` and not a
hex. Each of the three blurred surfaces carries a solid counterpart, and those
are the only thing `D19`'s reduced-transparency path substitutes.

| Token | Dark | Light |
|---|---|---|
| `--canvas` | `#0F0D0C` | `#F5F2EF` |
| `--surface` | `rgba(30,26,24,.72)` | `rgba(255,255,255,.78)` |
| `--surface-2` | `rgba(40,35,32,.6)` | `rgba(255,255,255,.55)` |
| `--surface-solid` | `#1B1816` | `#FFFFFF` |
| `--surface-2-solid` | `#232120` | `#F3EFEB` |
| `--line` | `rgba(255,255,255,.07)` | `rgba(26,22,20,.07)` |
| `--line-strong` | `rgba(255,255,255,.12)` | `rgba(26,22,20,.13)` |
| `--text` | `#F3EEEB` | `#1A1614` |
| `--text-muted` | `#A69D99` | `#6B615C` |
| `--text-faint` | `#786F6B` | `#9A908A` |
| `--rail` | `rgba(9,8,7,.85)` | `rgba(23,19,17,.94)` |
| `--rail-solid` | `#0E0C0B` | `#171311` |
| `--rail-text` | `#8F8683` | `#B5ABA6` |
| `--rail-text-strong` | `#FFF8F5` | `#FFFFFF` |
| `--rail-active` | `rgba(255,255,255,.05)` | `rgba(255,255,255,.07)` |
| `--brand` | `#F2566B` | `#C8102E` |
| `--a-red-bg` / `-fg` | `rgba(242,86,107,.14)` / `#FF8FA0` | `rgba(200,16,46,.09)` / `#C8102E` |
| `--a-blue-bg` / `-fg` | `rgba(127,173,238,.14)` / `#8FB8F0` | `rgba(43,92,168,.09)` / `#2B5CA8` |
| `--a-amber-bg` / `-fg` | `rgba(227,166,62,.14)` / `#EBB35A` | `rgba(180,83,9,.1)` / `#B45309` |
| `--a-green-bg` / `-fg` | `rgba(87,197,126,.14)` / `#6FD08F` | `rgba(21,128,61,.09)` / `#15803D` |

These are `docs/design/facet-concept-v5-premium.html`'s values. The table held
concept v4's opaque hexes until the token slice, which is why nothing made
`D8` or `D13`–`D19` true (`WORKFLOW §5 AD3`). `--surface-3` is gone: it was
v4's, and neither v5 nor the stylesheet ever had one.

The full mapping onto shadcn's semantic tokens is already in code and stays,
with one exception. **`--popover` takes `--surface-solid`**: a popup is neither
a card nor one of the two bars, so `D21` forbids blurring it, and a translucent
surface with nothing blurred behind it is unreadable.

**D6.** **Colour describes how long something has waited, never how good the
outcome is.** Past due is red, due soon is amber, otherwise faint. There is
**no status→colour map**. `accepted` keeps a plain pill, because a green pill is
the first place "internal approval, never a won deal" gets lost.

**D7.** **Object identity colours** exist — company blue, project amber,
quotation red, dispatch green — and appear **only** on the rail marker, a page
title's spine, and a card's edge. Never on a state, never on a pill, never on
text. Object type is not a status.

**Four, not five: contact violet is gone.** `D21` forbids violet, and a rule may
not mandate what another forbids (`WORKFLOW §5 AD15`). `D21`'s ban stands
unchanged; a contact's lead cell is its name and position `D26`, which needs no
colour of its own.

**D8. Effect tokens.** These carry the visual system and are listed here so
they are inspectable rather than scattered as inline values.

| Token | Purpose |
|---|---|
| `--canvas-glow` | the two fixed radial gradients on the page background |
| `--surface` / `--surface-2` | translucent card and inset surfaces |
| `--surface-solid` / `--surface-2-solid` / `--rail-solid` | the reduced-transparency fallbacks (D19) |
| `--line-hi` | the one-pixel top-edge highlight on a card |
| `--brand-grad` | red→orange, six uses only (D15, D17) |
| `--brand-glow` | six uses only (D16, D27) |
| `--shadow` / `--shadow-lift` | resting and hovered depth |
| `--blur` | 18px + saturation, cards and bars only |

**D9. Radius:** 12px cards, 16px large cards, 8–10px controls, 20px pills.
Nothing sharper, nothing rounder.

**The code is 10px and 14px**, not 12 and 16, and the token slice deliberately
left it alone — a radius is a component pass, not a token one, and moving it in
passing would have made `WORKFLOW §5 AD24` unfindable. Controls at 10px are
already right.

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

**D13. The canvas carries atmosphere.** Two fixed radial gradients on
`--canvas-glow`, both under 14% opacity — **red at the inline start, blue at
the inline end**, the red 10% above the top edge. This is the only place a
background gradient appears. Never on a card, never behind a section, never as
a blob.

**The positions are logical, not physical.** A percentage in `radial-gradient`
knows nothing about direction, so written as `8%` and `100%` the red wash
stayed on the left in Arabic — over the content, with the rail on the right
lit by nothing. The concept was drawn in English and nobody had decided the
physical position; the founder decided it here. The two x positions are their
own tokens and `[dir="rtl"]` swaps them.

**D14. The card is a translucent surface.** `--surface` at ~72% opacity,
`--blur` (18px + slight saturation), a one-pixel top-edge highlight
(`--line-hi`), and a deep soft shadow with an inner top light. That combination
is the product's texture and it is used on every card, identically.

**D15. The brand gradient has exactly six uses.** `--brand-grad` appears on:
the primary button, the active rail marker, the target bar's fill, the rail
count badge, the dispatched segment of a rollup bar, and **a row's action button
filling on hover** `D17`. Nowhere else. Not on text, not on pills, not on
borders. The count said five while `D17` already named the sixth
(`WORKFLOW §5 AD11`).

**D16. Glow has exactly six uses.** `--brand-glow` on the primary button; the
app mark; a soft ring on the pace badge; a ring on today's cell in the week
strip; the target fill's bloom; and **the current chain dot's soft ring**
`D27`, which already ships. Nothing else glows. A glow is emphasis, and
everything emphasised is nothing emphasised. The count said five over a list
that read as four or six depending on how its first item was split, and `D27`
had been adding to it unannounced (`WORKFLOW §5 AD12`, `AD29`).

**D17. Motion is small, fast and explains something.** A view change fades and
rises 6px over 350ms. A count tile lifts 2px on hover. A row's action button
fills with the brand gradient on hover. That is the complete list. No page
transitions, no scroll reveals, no skeleton shimmer, no counting numbers, no
bouncing. `prefers-reduced-motion` is respected and is the path that gets
tested.

**D18.** *Deleted.* It gave the opposite instruction to `D19` for the same
breakpoint — fall back with no filter, against reduce the radius — and `D19`
won (`WORKFLOW §5 AD13`). Its one surviving idea, that the design must look
correct with blur off, is `D19`'s last sentence. The number is kept and never
reused, so no citation shifts.

**D19. Looks win; performance is tuned afterwards.** Of everything in D13-D16,
only `backdrop-filter` costs real work - gradients, shadows and glow are
effectively free. So the effects stay on everywhere, including phones, and the
blur radius is reduced rather than removed on small screens (18px desktop, 8px
below 980px). **Never removed.** Under `prefers-reduced-transparency`, every
blurred surface takes its solid counterpart — `--surface` → `--surface-solid`,
`--surface-2` → `--surface-2-solid`, `--rail` → `--rail-solid` — and `--blur`
is `none`. Three tokens, one rule, all three in `D8`. If a screen ever measures
slow on a real phone, the fix is to lower that one number - never to strip the
design. **The design must look correct with blur off** — check it that way
before calling a screen done.

**D20. JavaScript may enhance, never enable.** Every screen works with scripts
off: it renders, it reads, and **every act it offers can be completed**. Script
may make a screen nicer, faster or fresher — it may never be the thing that
makes it work. Depth is CSS. Filters are GET forms in the URL. Native
`<select>`, native `<input type="date">`, native checkboxes. The theme is a
server-read cookie.

**The test is a sentence, not a list.** Turn scripts off, then ask whether the
person can still do the thing. If yes, it is an enhancement and needs no
permission from this rule. If no, it is **enablement**, and it is a defect
whatever it is called. This replaces the three named exceptions the rule used to
carry — the city combobox, the view-mode switch, the board's scroll. A waiver
list makes every new need an argument about whether it earns another entry, and
it cannot answer a case nobody has thought of yet. Of those three, two were
never JavaScript at all: `?view=` ships as `FilterNav` links carrying the search
`D59`, and the board's scroll is `overflow-x-auto`.

**The reasons the ban existed still hold, which is why this is a boundary and
not a loosening:**

- **The quality system is server-rendered HTML.** `verify:routes` drives 1,556
  checks by fetching HTML and reading it. It executes no script and this project
  has no browser. A screen that needs script to render is a screen nothing can
  test.
- **RTL.** Arabic works because the server sends finished markup, with direction
  decided before it leaves.
- **A rep on a bad connection outside Jubail gets HTML, not a bundle.**

**Two things are not enhancements and stay forbidden outright:**

- **No optimistic rendering** `D58`. A screen never shows a state the database
  has not confirmed. A screen that lies about state is worse than a slow one,
  and in FACET a lie about state is a lie about money.
- **No dragging a card to change a position** `S134` `D29`. A position is
  derived from a real event; a drag is a person asserting one.

**Enforcement.** `verify:routes` is already the check for half of this, and
nothing has to be built for that half: it fetches over HTTP and **executes no
script**, so all 1,556 checks are already scripts-off checks — every DOM marker
it asserts is proof that screen rendered without a bundle. What it cannot see is
**operability**: a control can render and do nothing. So one section joins the
same walk — for every form it reaches, each field the action requires is present
as a **native, focusable control carrying that name**; a `type="hidden"` input,
an `aria-hidden` one, or a `role="checkbox"` / `role="combobox"` button standing
in for a field is a named failure, and every non-required one is printed as a
note. `§17` already replays the POST, but it writes the body itself, so it
proves the action answers and never that a person could have produced the body.
This is that second half.

**D72. [BUILD]** **A screen refreshes itself visibly, or not at all.** Nothing in FACET
updates without a reload: a rep submits a request at 9:15 and the coordinator's
open screen still says 9:00 until she presses F5. So a screen where somebody
else's work arrives polls for **how much** has arrived and renders one line —
*"3 new — refresh"* — that the person chooses to press.

**Visible, never silent, and that is safety rather than taste.** A silent update
can move a row under the cursor between the decision to click and the click, and
on the coordinator's queue that means **approving the wrong dispatch**. Visible
also degrades honestly: scripts off, no line, page unchanged — which is what
`D20` asks of every enhancement.

**What it polls.** **One route, not one per screen.** The screen's scope and the
moment it was rendered go out; a **count** comes back, resolved in SQL by the
same query the screen ran (`CLAUDE.md`). No second definition of *new*.

**How often.** Every **60 seconds**, and only while the screen is in front of
the person — a hidden tab polls nothing. Sixty suits a queue where work arrives
every few minutes and is cheap on one company PC behind a tunnel. If it reads
slow to the person working the queue, one number changes.

**What it may update.** The number in that line, and whether the line is there
at all. **Nothing beneath it.** No row is inserted, removed, re-ordered or
re-coloured; no tile's figure moves; no badge changes meaning. The refresh a
person presses is the ordinary server render they would have got from F5.

**Where it renders.** In the header of the block it belongs to — the list card's
own header, the dashboard block's heading row. Never floating, never over
content, never dismissing itself. **It is not a toast**, which `D58` forbids: it
is static, it stays until it is acted on, and pressing it navigates.

**Which screens.** Every screen where the work is somebody else's: the
dashboard's blocks and the waiting list `D64` `D34`, the coordinator's queues
`D65`, `/quotations`, `/dispatches`, `/projects` in both views, the stream
`D45`, and the rail's Today count `D49`. A screen showing only your own typing
polls nothing.

**Two of those are not built, and the marker is for them.** Polling ships on
`/quotations`, `/dispatches`, `/projects`, the stream and the coordinator's
requests block. **The waiting list and the rail's Today count poll nothing**,
and neither is a matter of getting round to it: no follow-up row records *when
it joined the list* — every `S89` condition is a day-threshold crossing, so the
earliest a new row can appear is Riyadh midnight — and `followUpScope` is about
fifteen queries, which would run on every open screen every minute. Nothing
that ships contradicts this rule; those two screens are absent from it. The
cost of building them is recorded in `WORKFLOW §5` rather than half-paid.

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

**D70. A block on a detail page is sized by its content, not by its column.**
Company, project, quotation and dispatch detail screens all inherit this.

**What leads is chosen by what the reader is doing when they open the screen**,
never by the order the fields were declared in. A company's phone leads because
a rep reads it standing outside the customer's office. If no field can be
defended that way, the screen has no lead and the grid is a wall — eleven facts
in equal cells, which is what the company detail was.

**A block sizes to what it holds.** A card whose whole content is one empty
field and one sentence is not a card — it is a control, and it renders as one.
Nothing gets a heading, a badge, a form and a history block for a decision
nobody has taken.

**A long list caps and states its total.** Whatever a card holds — timeline
entries, quotations, dispatches — it shows a stated number and names the rest:
*5 of 46*, with the way to them. A card the reader must drag through hides its
own size, and a full one and an empty one look alike until they do. Where the
rest live behind a filtered list, that list **says what it is scoped to** and
offers the way out `D59`.

**An empty block is absent, not an empty shell.** `D52` says what an empty
*list* says and `D60` says where it sits; this says the block around it does not
render at all when there is nothing in it and nothing to offer. A heading over
*"No decisions recorded yet"* is the shell. (`D53` is the permission case — a
different rule with the same instinct.)

**The two columns are balanced by height, not by category.** The wide side takes
what is genuinely long, the narrow side what is genuinely short. A column is not
*work* and *people*; it is tall and short. When the short side runs out, a block
moves rather than the column stretching.

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
| **Dispatch** | the square metres, mono, large | how much went out? A **draft** owes the rep who raised it (S125); a **submitted request** owes the coordinator (S72); an **approved**, **refused** (S122) or **cancelled** (S73) dispatch owes nobody. |
| **Contact** | name and position | who is this? |

**The dispatch clause answered for two states and the screen renders five**
`AD33`. It named a submitted request and an approved dispatch, and had nothing
for a draft, a refusal or a cancellation — all three of which `/dispatches` has
shown since `S73` gave cancellation its own line. It also cited `S88`, which is
`[BUILD]`, for behaviour that ships under `S72`; the citation is corrected with
the widening. **Five states, three answers** — which is why the list groups into
three piles and not five: approved, refused and cancelled owe nobody, and the
row's own state badge is what separates them.

**D27.** The mini-chain draws from `src/lib/chain.ts` and nothing else. Done
dots green, the current dot amber with a soft ring, future dots hollow. It
derives nothing.

---

## 7. View modes

**D28.** Projects and Quotations offer **more than one view of the same query**:
`?view=table` (default for quotations), `?view=board` (default for projects),
`?view=cards`. Same filters, same URL, same data — different arrangement. Nobody
builds a second screen for a second view.

**D29.** **The board's columns are `S132`'s six positions** — No price yet ·
Requested · Quoted · With the customer · Ready to ship · Won. Each is computed
from a real event and **no act moves a card** `S134`: there is no drag, and none
is added. A card that jumps from *No price yet* to *Won* is a rep who skipped a
step, and the board is meant to show that rather than hide it behind a pile
somebody tidied. Lost projects leave the board and live in a filter, or the
board becomes a graveyard nobody clears.

**A project has one column and may have several threads, so furthest along
wins** — the rule `chainReached` already applies one rung down. A project with
one thread won and one still quoted reads as Won, and the card carries **a count
of its live threads** so the second one is not lost behind the first. `S68` is
why that is a count and never a sum of their metres.

**`No price yet` means something different here, and it is written down rather
than inferred.** On the board it is **a project with no LIVE thread**; in
`src/lib/chain.ts` the first rung is a project with **no thread at all**. So a
project whose every quotation was rejected or cancelled sits in the first
column — it is not lost, nobody has given up on it, and the position already
says whose move it is: the rep's, to quote again. A definition that shifts by
level and is not stated is how the silence derivation came to give two screens
two answers.

**The column header carries the pile's name and its count, and never a person.**
That is `D24`'s default for a group header, and the board takes it. A header
describing a person makes the person the subject; **the subject is the project,
and the rep owns it end to end.** The coordinator processes paperwork inside
three of the six positions and owns none of them, so naming her at the top of a
column would put her in charge of work that is not hers.

**`D2` is answered by the pile's own definition.** *With the customer* says
whose move it is as clearly as a name would, and better — it names nobody who is
not a user of FACET. So the board still satisfies *a row says whose move it is,
not what the status is*, because **a pile is not a status**: `S132` fixes each
position's owner once, and the grouping carries the answer exactly as a board is
supposed to. What changed is that the answer is the pile, not a name in a
header. It generalises: wherever rows are grouped by the thing `D2` asks about,
the group's name says it once.

**The header carries a count and no square metres.** `S68` — quotations are
never summed. The one figure that could be summed down a column without double
counting is `sqm_expected`, one row per project; it is a sum of forecasts, it
reads as a pipeline value, and that is the thing `S68` exists to stop being
invented.

**A tall column scrolls; it does not cap.** Every column is the same height and
its header states the true count, so nothing hides its own size. `D70`'s
cap-and-state is the other answer and was deliberately not taken — `WORKFLOW §5`
carries what that costs.

**D30.** Activity offers `?view=stream` (default), `?view=by-rep`, and
`?view=calendar`. All three read one query. "Just me" is a filter chip on the
stream, not a separate screen.

**D71. [BUILD]** **A mark is a small label on a card, never a column and never
a colour.** `S135`'s four — catalogue sent, samples sent, documents sent,
technical submitting — say *what is out with this customer*, and several may sit
on one card at once. They are not a position, so they never become a column
`D29`; and they are not a duration, so they take no colour — `D6` gives colour
to how long something has waited and nothing else. A card with no mark shows
nothing rather than an empty slot.

**Nothing draws one yet.** `S135` is itself unbuilt, so no card carries a mark
on any screen and this rule describes the shape one takes when it does. It was
written beside `S132`–`S135` in the board-rules slice and landed unmarked; the
marker is the correction, not a change of mind.

**D31.** Build order: table and stream first. Board second. Cards and calendar
only if someone asks twice.

**It has now decided two views, and neither was declined for being hard.**
`?view=cards` on `/projects` in session 35, and `?view=calendar` on the stream
in session 27 — which is cheap, because every event already carries `day` as a
Riyadh calendar day and `working-days.ts` knows which of them are working days.
Cheap is not the test this rule sets; **the second ask is.** So a third
deferral needs no fresh argument, and a rule that has been applied twice is no
longer one nobody reaches for.

---

## 8. The dashboard — one screen of blocks

**D64. The dashboard is one screen of blocks in a fixed order, and a block
appears when the person's flags qualify it.** A role in FACET is a row of
permission flags and never a name in code (CLAUDE.md), so there is no rep
dashboard and no manager dashboard to build — there would be nothing to name
them after. There is **one** dashboard, and six blocks:

| Block | Appears when | Contents |
|---|---|---|
| My target and pace | a target row exists for this person | `D32` |
| Requests waiting on me | `can_approve_quotation` or `can_dispatch` | `D65` |
| My waiting list | always | `D33`–`D36` |
| The team table | `sees_all_reps` | `D39` |
| Waiting on the coordinator | `sees_all_reps` | `D40` |
| Needs a decision | `can_assign` | `D41` |

**The order is fixed** and does not vary by who is looking. A block that does
not qualify is absent, not disabled and not empty `D53`.

**The first block is the exception, in two ways.** Its condition is data rather
than a flag — a target row exists for this person `S83`, `S84` — and it is the
only block a flag *widens* instead of revealing: holding `sees_all_reps` reads
it at company scope, which is `D38` and not a seventh block.

**A person holding none of the flags gets the target and the waiting list**,
which is exactly the rep's screen. So `D32`–`D37` are this rule's **no-flag
case** rather than a design of their own, and `D38`–`D41` are what a flag adds.
This is also what gives Marketing `D67` and the Executive `D68` a sensible
screen without anyone designing one.

All five flags named above are columns on `roles` today. **Three of the six
blocks are built** — *My target and pace*, to `D32` entire, including the pace
tick, both side figures and the overage segment; *Requests waiting on me*, to
`D65`'s two columns; and *My waiting list*, to `D33` and `D34`. The
notifications list that stood under `D65`'s heading is gone: it was news `S92`,
not work, and on a rep's screen it was twenty-five rows of it.

**The three that are not built are `D39`, `D40` and `D41`** — the blocks
`sees_all_reps` and `can_assign` add. A manager therefore gets the target and
the waiting list and nothing else today, which is the same screen a rep gets;
that is `D64` behaving correctly on the flags that exist, not a gap in this
rule. `D65`'s **day count** — *approved · issued · refused* — is the one part of
a built block still missing, and is a row in `WORKFLOW §5`.

**D69. The dashboard opens with a search field and a Log button, and nothing
else.** They are the page's **first element**, above the greeting and above this
rule's first block — and they are **not a seventh block**: they render for
everyone whatever flags they hold, so there is no condition for `D64` to test,
and its count of six is unchanged.

**Exactly two controls.** A visually hidden submit button is not one and is kept
deliberately — a single-field form submits on Enter, but the hidden button
covers IME composition and the mobile keyboards that do not fire one.

The field is a plain GET form submitting to `/companies?q=`, the search that
already matches a company name **or a phone** — a shortcut to a screen, never a
second search, so `D51` is satisfied and nothing new sits behind it. `D20`
holds: no client JavaScript. It is the one cross-route GET form in the product,
which makes it the one that must carry the locale in its action.

The button is `D15`'s primary gradient and opens the report form with **no
record preselected** — `S33`'s form, which asks for the company itself.
**Everything in FACET is downstream of a rep bothering to record something**, so
logging must be reachable from the first screen without finding a company first.
**`S32`'s placement stands unchanged**: the Log button on the company page opens
**pre-filled** and remains the main entry point `D46`; this one opens **empty**.
Two placements doing two jobs, not a duplicate.

**D32. The signature panel is the target with a pace line.** Dispatched square
metres this month as a large mono figure, of the target; a bar filled to
achievement; a **vertical tick at today's position in the month**. Fill past the
tick is ahead, fill short of it is behind. **Beneath** the bar, small figures:
quoted, last month.

**The panel appears only where a target row exists** `D64`, `S83`. Someone not
measured this month has no target to be ahead or behind of, so the block is
**absent** — not an empty bar and not a zero `D53` — and its two side figures go
with it. That is the screen a new rep sees on their first day.

**Square metres render as whole metres**, here and everywhere a figure is a
**sum or a target**: 675 of 800, never 674.8080 of 800.0000. A quotation or
dispatch **line** keeps its four decimals — that is a document line and it
reconciles against what SMAC issued `S5`.

**Expected to date is working days, and today counts.** Working days done this
month over the working days in it — Sunday to Thursday, the week
`working-days.ts` already owns for `S87`'s thresholds and `D35` already draws.
On the 25th of a 22-working-day August that is 18 of 22: **82%**. Counting only
the days already finished tops out below 100%, which would make the last day of
every month read *ahead of pace* while the rep was short. Counting today makes
the fraction **reach 100% on the last working day and hold there through any
trailing Friday and Saturday** — a rep who hits target on Thursday sees a full
bar and the tick at the end all weekend, which is correct and is stated here
rather than discovered. Calendar days are the other candidate and are wrong for
this: a rep dispatches on working days, so a calendar denominator would show
them slipping every weekend and catching up every Monday.

**No public holiday is skipped.** `working-days.ts` skips none and records a
holiday calendar as `OPEN — not chosen`; this rule **inherits** that rather than
answering it a second time. Through Eid the tick advances while nothing ships.
A calendar denominator is equally blind, so that is not a cost of counting
working days — `WORKFLOW §5` carries the row.

**Both percentages render** — achievement in the bar's legend, expected-to-date
in the pace line. *84% means nothing until you can see that the month expects
82%.* The pace line then gives the distance in square metres, and **that
distance is not derived from the percentage**: it subtracts the two whole-metre
figures already on the screen, so a rep checking it by hand gets the same
number. 800 × 82% is 656 while the expected figure is 655, because the
percentage is itself rounded and is display-only. Both are computed per request
in Riyadh on a `force-dynamic` page, so the tick cannot go stale at midnight.

**The pace line takes no colour** `D6`. Ahead-of-pace is an outcome, and colour
in FACET describes how long something has waited, never how good the outcome is.
The words *ahead* and *behind* carry it. There is no green in that vocabulary
and this rule does not add one.

**The bar is 8px, `--radius-lg` ends, `--brand-grad` fill** — `D15`'s third use.
**The tick is a 2px bar and never a glow**: `D16`'s six are spoken for. It takes
`--text` on the empty track and `--canvas` inside the fill, because one colour
cannot read against both a translucent inset and a saturated red-orange gradient
in both themes. That is a colour chosen by side, not a second effect, so `D21`
stands.

**Beating the target must not look like meeting it.** The bar used to clamp its
fill at 100%, so 819 of 800 drew exactly the same full bar as 800 of 800 — the
one thing a rep most wants to see was the one thing the bar could not say. So
**the track's scale is the target until achievement passes it, and then it is
the achievement**: the solid fill runs to where the target sits, and the excess
continues past it in **the same `--brand-grad` at lower opacity**. That is not a
seventh use of the gradient `D15` — it is the target bar's fill, continued — and
the opacity step is what marks where the target was, so nothing new is drawn to
say it. **The pace tick divides by the same scale**, or it would drift off the
day it means the moment a rep went past target.

**The legend's end stays the target.** The rescale is geometry and the axis
still measures the target, so the figure under the bar's end does not follow the
scale — a bar labelled with its own achievement reads *963 of 963*, which is
every rep exactly on target and no rep ahead. The achievement is already the
large figure above, and the percentage is already in the middle of the legend.

**The side figure is a COUNT of quotation threads, never a sum of their square
metres.** `S68`: quotations are never summed, because one project quoted three
times at 2,000 m² is the same 2,000 counted three times, and summing it inflates
the pipeline. The position comes from `chainState()` and nowhere else, as `D27`
and `D29` already read it.

**Its label follows the position it reads**, which `S132` now calls **Quoted** —
a price has been produced and is not yet with the customer. It was *awaiting
signature*, and that name outlived its meaning: `S64` and `S65` make the
signature internal management approval, effectively instant, so the figure never
counted people waiting to sign. The set it counts is unchanged.

**Last month** is the previous period's achievement against the previous
period's target, from the same derivation as this month's `S85`.

**Paid-not-yet-out is not one of them.** Payment is recorded on the dispatch
(S70) and no route to approved bypasses it (S72, S73), so no interval exists
between paid and dispatched for a figure to measure. **Nothing stands in its
place — two side figures, not three.** That closes the `OPEN — not chosen` this
rule carried (`WORKFLOW §5 AD6`). `D42`'s funnel stage is the same argument
about a different screen and is deliberately **still open**: the rollup is
decided with the screen in front of the founder, not here.

**D33. The counts strip** is a plain quartered row inside one card, not four
KPI cards. **Four tiles over six conditions** — `FOLLOW_UP_KINDS` has six, and
six equal-weight tiles where four would do is the thing `D21` names outright:

| Tile | The kinds it counts |
|---|---|
| Quotations | `quotation_no_response` · `quotation_returned` |
| Gone quiet | `company_quiet` · `catalogue_no_response` |
| Not moved | `project_stage_unchanged` |
| Your dates | `date_due` |

**No condition is dropped.** Each tile is a link into the waiting list, filtered
to its own kinds. `S89`'s fifth condition — a dispatch request sitting with the
coordinator — is deliberately not here: it belongs to `D64`'s **Requests
waiting on me** block, where it can be acted on, not to a count. Following the
old four dropped two live conditions and following the code breached `D21`;
this is the shape that does neither (`WORKFLOW §5 AD5`).

***On hold resuming this week* is gone.** It was never a follow-up kind — on
hold is a **suppression**, not a condition — so no tile could have counted it.
The real gap it was standing in for is recorded in `WORKFLOW §5` rather than
lost with the tile.

**D34. The waiting list** is the wide column, and it is in **two sections**.

**Today · you planned this** holds the `date_due` rows — the dates the rep set
himself — **grouped by the anchor record**: within a group the oldest date
first, and between groups the group's oldest date decides. That is still
oldest-first overall `S87`, without meeting the same customer at rows 2, 6 and
9, which is what makes a list feel like busywork.

**The group is the customer, not the row.** One record carries one follow-up
date, so grouping by the anchor itself would give groups of one and *"within a
group the oldest date first"* would have nothing to order. The rows this exists
for are the three that land on one company — its own row, its project's and its
quotation's — which are one phone call, not three.

**The group header is the customer's name at the inline-start, above the rows
it governs**, in the section headings' own weight and colour — with the count
after a separator, never run against the name. It is a **value**, so it takes
neither the uppercase nor the letter-spacing `D12` gives a section label: a
name is not a label, and both would mangle one. **`dir="auto"` belongs on the
name and not on the header** `D62` — on the header it turns the whole line RTL
for an Arabic customer, which on an English page puts it at the far inline-end
reading as a stray label. A group of one renders no header at all; there is
nothing to group, and a header repeating its only row is noise.

**Slipping** holds the other five kinds.

**The action follows the row**, because two actions cannot cover four anchors:
**Log** on a company or a project row, **Open** on a quotation or a dispatch
row, and **Plan** on anything in Slipping — Plan sets a follow-up date and
moves the row into a day. **Confirm is gone**: confirming a payment is a step
inside the quotation, not a row action. The exit door is still on the row.

Each row also carries a **one-letter kind mark — C, P, Q and D**, four rather
than three because `S86` puts dispatch requests on the list as a fourth anchor
and `S88`/`S89` make one sitting with the coordinator first-class
(`WORKFLOW §5 AD22`). Then the record, one line of why, and elapsed time
coloured by lateness `D6`.

**Elapsed reads in calendar days, for every kind.** It used to read in whichever
unit the row's own threshold was stated in, which put *78 working days* and
*117 days* on adjacent rows of one list. This list is **worked down by ranking**,
and two units cannot be ranked against each other by eye. Calendar days is also
the unit the customer's silence is actually measured in. **The thresholds are
untouched** — each is still applied in the unit `07 D5` states it in, and
`/follow-ups` still names them that way in its own line. What changed is the
figure a person reads, not the test that put the row on the list.

**The kind mark has three letters until it has four.** `D` needs `S86`'s
dispatch anchor, which is not on the list yet, and a letter nothing can render
is unused structure rather than a head start.

**The list is worked down by ranking, never emptied, and the shape follows from
that.** A rep with 200 companies cannot clear a 30-day quiet list — it would
take 9 to 10 touches every working day, which is out of reach. So the two
sections exist to help him *decide*, not to tally: the planned section is what
he already chose, and Slipping is what he is choosing between. An empty Slipping
is not the goal, and `D52` says so.

**Only part of this has an `S` rule behind it.** `S87` gives one list oldest
first and `S90` gives *parked* as an exit; **that a planned row is shown in a
section of its own, and that the act on a slipping row is called Plan**, are
decisions this rule makes. `SPEC.md` has not been asked and does not say them.

**D35. The week strip** on the narrow side: seven days, two bars per day —
logged (red) and system events on your records (blue). Friday and Saturday
visibly off. Nothing more; this is what stops the view becoming an attendance
check.

**D36. Recently** below it: the last few events with three kinds of mark —
✎ typed by a person, ◆ observed by the system, 💬 said between colleagues.

**D37.** Nothing on the rep's dashboard is company-wide. No team figures, no
other reps, no executive analytics.

**This is a flag rule, not a role rule** `D64`. Sales Rep holds no flags at all,
which is why the screen narrows to one person's own figures; **`sees_all_reps`
is what widens it** — it reads the target block at company scope `D38` and adds
the team table `D39`. Nothing here is keyed to the word "rep".

---

## 9. The blocks a flag adds

**D38.** The **same signature panel**, at company scope. Same pace line. This is
not a block of its own: it is `D64`'s first block **read wider**, and
`sees_all_reps` is what widens it.

**D39. The team table**: one row per rep — a small pace bar with the tick, m²
dispatched of target, waiting-on-them as two counts (overdue in red, due soon
plain), logged this week, quiet companies. **The footer says what the table is
for and is not**: *"Saad logged the most and dispatched the least. That is a
conversation, not a formula."* Activity and target sit side by side and are
never combined into a score.

**D40. "Waiting on the coordinator"** — the bottleneck card, because the
coordinator is one person and **both chains run through her**: the quotation
chain, and since `S72` and `S124` the dispatch chain too. It is a block on
`sees_all_reps` `D64`, the same flag as the team table — a manager watching one
person's queue is the same act as watching the team's.

**D41. "Needs a decision"** — duplicates (S22) and archive requests (S105). The
two things the system routes to a manager, on one card, nowhere else. This is
what makes the manager's version of the waiting list different. It is `D64`'s
block on `can_assign`.

**D65. The coordinator's dashboard leads with Requests: one heading, two
columns.** Quotation requests needing issuing on one side, dispatch requests
needing a decision on the other, **oldest first in each**. They sit beside each
other rather than interleaved because they are different work — issuing is a
task, deciding a dispatch is a judgement — and a single merged queue would ask
her to switch between the two on every row. Below it, a plain count of her day:
approved · issued · refused.

**She typically carries no target and no pace line**, because she does not sell.
Where she does carry one — `S127` lets her raise and approve against her own
company, and `S78` credits the rep named on the dispatch — `D64`'s first block
shows it exactly as it shows anyone's. Nothing here special-cases her.

**Each column follows its own flag.** `D64` decides whether the block appears —
`can_approve_quotation` **or** `can_dispatch` — and this decides what is inside
it: the issuing column on `can_approve_quotation`, the deciding column on
`can_dispatch`. A holder of only one flag would otherwise read a column of their
own records under a heading claiming to be a queue, because the visibility
filters scope a list rather than emptying it. **A column nobody may act on is
worse than no column.** Today the Sales Coordinator is the only role holding
either flag, so she is the only identity the block appears for at all; a rep and
a manager get no such block, which is `D64`'s *absent, not disabled and not
empty*.

**No `S` rule stands behind the two columns.** `S88` puts a dispatch request on
her own list and `S89` orders it by when it was submitted; that quotation and
dispatch requests are shown **side by side under one heading** is a decision
this rule makes, and `SPEC.md` does not say it.

**D66. A dispatch's difference from its quotation is recorded, never flagged to
the coordinator.** The company treats a quotation as a **price, not a
commitment**; the dispatch is the absolute figure. The rep links the latest
version by default and may reach an earlier one, and the difference is computed
against whichever he linked `S120`. **Roughly half of all dispatches already
differ**, and a warning that fires half the time is not a warning — it is a
thing people learn to click past.

So the difference surfaces **on the project and in the monthly rollup** `D43`,
where a gap is the thing being measured `S77`, and **not on her queue** `D65`.
`S120` and `S77` already compute it and already show it to the rep, the
coordinator and the manager on the dispatch itself; this rule decides only
**where it is seen as a signal** and answers *nowhere on the queue*.

**D67. Marketing** gets `D64`'s no-flag blocks — the target and the waiting
list — plus **Needs a decision** via `can_assign`. Marketing holds companies as
a rep does `S9`, so the no-flag case is already the right screen. Short because
nobody holds the role yet.

**D68. The Executive** gets **the team table** and nothing else. No target, no
queue, nothing to approve: the question is how the company is doing, not what is
waiting. Short for the same reason as `D67`.

---

## 10. The monthly rollup — "what happened, and why?"

**D42.** Figures across the top in square metres: quoted · approved ·
dispatched, each with its count. Beside them: lost, and still open. A note under
it stating that quoted counts each thread's latest live version once.

**Paid is not a stage.** Payment is recorded on the dispatch (S70) and no route
to approved bypasses it (S72, S73), so there is no interval between paid and
dispatched for the funnel to measure, and "dispatched can exceed paid because
credit customers ship first" was the credit-terms flag SPEC §15 deleted.
Whether a figure stands in its place, and what the rollup measures instead, is
**OPEN — not chosen**.

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
timeline is the same stream, scoped to that record. **A day header states the
whole day's size in the filtered scope, not the part of it that landed on this
page** — the stream pages by row, so a day is cut wherever the boundary falls
and appears at the foot of one page and the head of the next, reading the same
true number in both places.

**D46.** The **Log button** on a company page opens pre-filled. Three taps and a
text box. Channel, outcome, optional project and contact, optional signals, the
note. Built for a phone.

**The order that ships is the sentence's, and the note comes third** — company,
channel · outcome, **the note**, then project, contact, the two dates, then the
signals. The list above reads as a field order and never was one: the code has
put the note before the signals since the form was built, and until `38c` it
also put it sixth, under everything optional. At 375 that meant the box *"three
taps and a text box"* names started **below the fold**, which is the one thing
this rule exists to prevent. Optional context follows the note; it does not
precede it.

**The signals are behind a disclosure, at every width.** Nine checkboxes were
~530px of a ~1500px form — a third of the screen for the block most reports
leave empty — and the summary carries the count, so a rep who has raised one
sees it without opening. **Not below `md` only**: a closed native `<details>`
hides its children through a slot or `::details-content` and author CSS cannot
reliably re-show them `D56`, so closed-on-a-phone-open-on-a-laptop is not a
shape a disclosure can take. `D24` builds this form phone-first and the laptop
reader is the same rep, so it collapses for both.

**Every field is in the markup whether it is open or shut** `D20`. That is the
point of a `<details>` rather than a toggle, and it is what a signal's reference
input did not manage: it rendered on client state, so with scripts off a rep
could not record a competitor's name at all, on any device. It is revealed by
the checkbox itself now — a sibling selector, no bundle.

**D47.** A report's shared half and its private note render differently: the
note is visually a quote block, and is absent entirely for a reader who may not
see it. Nothing is greyed out or "locked" — it simply is not there.

---

## 12. Comments

**D48.** Comments appear on **quotation threads and projects only**,
inside the timeline as a third event kind, with a plain composer in the card —
a box, the people to tell, a button. No typing indicator, no read receipt, no
reply threading, no emoji. Nothing renders a comments card on a company,
contact or dispatch.

**A screen whose only timeline events were comments carries no timeline card at
all** — which is the contact and the dispatch. Neither has a derived event of
its own: nothing anchors to a contact, and a dispatch is an event rather than a
thing that accumulates them. So on those two the composer was not the card's
contents alongside other things, it was the whole of them, and removing it left
a heading over nothing. `D70` says an empty block is absent rather than an empty
shell, so both cards came off entire. **The company keeps its card** and loses
only the composer, because Dispatched, Quotation issued and Quotation raised are
still on it.

Everything else in this rule ships: the comment IS the timeline's third event
kind, it is the stream's **said** kind `D45`, and the composer is in the card
rather than beside it.

---

## 13. Navigation

**D49.** The rail carries **Today** (with a count), then Companies, Projects,
Quotations, Dispatches under *Sell*; Activity and Targets under *Track*.
**Seven items — plus user management for those who hold it.** The count was
always right and the sentence was wrong: user management is conditional `D50`,
so it was never one of the seven, and running it into the same list read as
eight named against seven counted (`WORKFLOW §5 AD14`). Reports, Coverage,
Follow-ups, Notifications and Performance are **not top-level** — they are the
waiting list and the stream, filtered.

**The first item is Today, not *Waiting on me*.** It is shorter, and since
`D34` split the list into planned and slipping, *waiting on me* describes only
half of what is on the screen.

**The groups are *Sell* and *Track*, which is what the rail renders.** They
were written here as *Work* and *Team*, and the rule moved rather than the
code: *Track* is accurate for what is in the group, and *Team* would have
collided with the user-management item, whose own label is already **Team** in
both locales.

**Performance and Targets are one item, called Targets.** One table, one row per
rep, **the goal and the attainment together** — they were never two questions,
and splitting them put a rep's number on one screen and what it was measured
against on another. The edit control renders **per row** for `can_set_targets`,
and **not in a cell**: `D58` bans inline cell editing and this rule asks for a
control on every row, so the row carries a disclosure of its own beneath its
figures. Merging them is what frees the seventh slot for Activity.

**The built rail carries seven**, since session `28b` merged the two screens
and deleted `/performance`. It had carried eight until then, deliberately —
merging is a screen change, and moving the rail item first would have hidden
attainment from everyone who could reach it. Performance sat **last in
*Track*** so that deleting it left this rule's order already correct.

**D50.** The rail is hidden by a permission boolean passed from the layout, never
by a `can()` call in a client component. Hiding a link is cosmetic; the route
still returns `notFound()`.

**D51.** No global search is rendered until there is something behind it. A
control that does nothing is worse than no control.

---

## 14. Empty, error and permission states

**D52.** An empty list says what would make it non-empty and offers the action.
*"Nothing planned for today — plan one from Slipping."* *"No companies yet —
add the first one, or import from a spreadsheet."*

**The waiting list as a whole is not one of these.** This rule used to give
*"Nothing is waiting on you. That is the goal."* as its example, and `D34` now
says that state is one a rep with a real book never reaches — the list is
worked down by ranking, never emptied. The **planned** section is the half that
genuinely empties, so it is the half that carries the empty state, and its
action is the one `D34` gives a slipping row: Plan.

**D53.** A permission-denied route is `notFound()`. FACET does not tell someone
a thing exists that they may not see.

**D54.** There is no skeleton state. Server-rendered pages arrive whole.

---

## 15. Responsive

**D55.** Rep-facing screens — waiting list, log form, company lookup, quotation
request — are **built phone-first**. Manager and coordinator screens are
laptop-first. Nothing is designed for tablet specifically.

**D56.** On a phone, a table row **collapses to a row**: its lead cell, the
name, and the one column the list's own anatomy needs. Secondary columns are
hidden, not scrolled. The rail becomes a bottom sheet. The board scrolls
horizontally, each column snapped to the inline start.

**The rail clause ships** — session `38a`. It is a native `<details>`: the
`<summary>` is a bar fixed to the bottom edge, and the panel is its **peer**,
revealed by CSS. Not a child, because every engine hides a closed `<details>`'
non-summary children through a slot or `::details-content` and author CSS
cannot reliably re-show them — nested, `D49`'s seven links would be
unreachable at `md` and up, where there is no disclosure to open. No client
state, so `D20` holds; it closes itself on navigation, because every link is a
full page load. It replaced a horizontally scrollable **top** strip, which was
the wrong half of `AD8` in both directions: the wrong edge, and scrolled where
this rule says a sheet.

**The kept set is a widening, taken in `38b`** — the same shape `D26` took at
`AD33`, and for the same reason: the anatomies moved after this rule was
written. It used to say *lead cell, name and elapsed time*, and three columns
literally would take **Log** off `/companies` and **position** off
`/quotations`, which are the two things those screens exist to answer.

| List | Lead cell `D26` | The one column, and why |
|---|---|---|
| `/companies` | the silence meter | **Log** — the meter already holds the elapsed, and Log is what made this list a work queue `28b` |
| `/quotations` | avatar and days | **position** — which of the coordinator's three moves is owed; the pile's name answers `D2` once and cannot say this |
| `/dispatches` | the square metres | **status** — five states have three answers, so approved, refused and cancelled share a pile and only the badge separates them |
| `/projects?view=table` | days since it moved | **whose move** — this view is flat, so no group header answers `D2` |
| `/contacts` | *is* the name | **the phone** — `D70`'s argument: a rep reads it standing outside the customer's office |
| `/follow-ups` | the kind badge | **the age** — the kind IS the *why*, so the one column is the figure the list is worked down by `D34` |

**Where the lead cell IS the name, that is two, not three.** `D26` gives a
contact *name and position*; the row fills two slots and fills them honestly.
Written down rather than left to be re-argued on each list, which is the waiver
shape `§6b` exists to catch.

**It applies to the six rep-facing lists** `D55`. `/users`, `/targets` and
`/activity?view=by-rep` are laptop-first: they keep `Table`'s horizontal
scroller below `md` and **declare it at the call site**, so it is a decision
rather than an omission. `D49` is the second reason `/targets` is out — it asks
that screen for the goal and the attainment **together**, and one kept column
carries one of them. That is evidence this rule does not fit a laptop screen,
not a puzzle to solve inside it.

**The arrangement changes and the content does not.** `D26`'s anatomies are the
content; the table was only ever the arrangement. So it is **one DOM at every
width**, re-laid out in CSS: below `md` a phone-row table hides its header and
each row becomes a two-line grid — the lead cell at the inline start spanning
both lines, the name on the first, the one column on the second, a control at
the inline end. The kept column and a row action are **the same slot**, so *the
one column* is enforced by the layout rather than remembered by a person. The
two views cannot drift apart, `verify:routes` reads the same markers at every
width, and no script is involved `D20`.

**The board snaps, and there is no *current* column.** The clause named one and
had no referent: six piles `S132`, no selection, and no act may move a card
`D29` `S134`. So every column snaps to the inline start and the board opens on
the first, which is `S132`'s own order. A reader who wants rows has
`?view=table` `D28` — the same query, already built, carrying the search `D59`.
No third arrangement was invented for a narrow screen.

**A column is 240px below `md`, and it is deliberately narrower than the
measure.** `38b` gave it 288 — the whole 323px `<main>` leaves at 375 — so the
next column showed **23px**, which is 14px of its own padding and 9px of a
letter. The peek was reading as a clipping bug rather than as *there is more to
the side*, which is the one job it has. At 240 it is **71px at 375 and 89px at
393**: the padding, plus enough of the next pile's name to start reading it.
**The number is a legibility floor on the peek, not a fraction of the screen** —
a column that takes the whole measure can only ever show a sliver of the next
one, whatever the screen is. It costs the near column nothing: 212px of card
against the **168px** a laptop column gets `D22`, and that width already works.

**A horizontal strip of steps turns vertical below `md`.** The chain strip
`D27` is six `flex-1` steps; in the 291px a `Card` leaves at 375 that is 48.5px
each, and every label and owner name truncated to about five characters — *No
pr… Reque… Quot… With … Read… Won*. **That is not a narrow arrangement of the
strip, it is the strip's absence**, on the two screens `D70` says a rep opens
standing outside a customer's office. Turned down the page each step takes the
full measure and nothing truncates, so `truncate` is scoped to `md` where it is
a real necessity. Same one-DOM-in-CSS shape as the phone row above: the `<li>`
is a two-column grid below `md` with the rail run spanning both rows, a flex
column above it, and the rail halves swap axis — no prop, no branch, no second
component, no script `D20`.

**This is a fourth clause, and `D55` does not name the screens it lands on.**
Its phone-first list is the waiting list, the log form, the company lookup and
the quotation *request* — not the quotation thread or the project detail, which
are where the strip lives. The strip is fixed anyway: five characters is not
laptop-first, it is broken, and a rule that only reaches screens on a list would
leave it that way. The disagreement between `D55`'s list and this clause's reach
is recorded rather than resolved here.

---

**D74. A control a thumb has to hit is at least 44px on a phone.** Every
button, input, select and native date field; below `md` only — `D22`'s laptop
density is deliberate and stays.

**The number has a source, so it is not argued about later.** It is the
platform minimum on **iOS** (44pt, Human Interface Guidelines) and the nearest
thing on **Android** (48dp, Material) — 44 is the floor both agree is not
enough to go below, and it is taken as a floor rather than a target, so a
control with room takes more. It is also **already FACET's own answer**, in the
one screen a rep uses one-handed: the log form has carried `h-11` on both its
dates and `min-h-11` on its project chips since it was built `D46`.

**It is a floor, not a size** — `min-height` and `min-width`, never `height`.
That is what lets it sit on `Button`'s base rather than on its seven size
variants: 44 simply outranks the `h-6` an `xs` chip already carries, and every
`FilterNav` chip and both pager buttons were `xs` — 24px, the smallest thing a
thumb was asked to hit anywhere in the product.

**A component's own floor IS the floor, and a caller may not pin it.** The ban
above reaches the **call site**, which is the half that went unsaid and was
therefore breached in the one file this rule's number came from: `report-form`
carried a local `touch = "h-11 …"` and applied it to both its dates, overriding
`Input`'s `h-8 max-md:min-h-11` in both directions — 44px on a laptop, where
`D22`'s density is deliberate, and a height where the rule says a minimum. A
component that already carries the floor needs nothing from its caller; a caller
that adds one is either duplicating it or breaking it, and there is no third
case. The same reading covers the `text-base md:text-sm` step below — repeating
its first half locally pins 16px above `md`.

**Two controls in the shell are not `Button`s and were missed by that**, which
is the cost of putting the floor on a base: the bell in `(app)/layout.tsx` and
`ThemeToggle` are bare elements at `size-8`, and both carried 32px until `38c`
found them. Anything hand-rolled has to say the floor itself.

**A checkbox is the exception and needs no growth**, because `checkbox.tsx`
already pairs every one of its call sites with a `<label htmlFor>` and the
label is the target a thumb lands on. Growing the box would break the tick,
which is a background image sized to it.

**Sixteen pixels is the other half and is not this rule.** iOS Safari zooms the
page whenever a focused control renders under 16px, so `Input` and `Textarea`
have carried `text-base md:text-sm` all along; `SelectField` was the one that
did not, and every `<select>` in FACET zoomed on focus until `38a`. That is a
legibility failure with a browser behaviour attached, not a target size.

---

## 16. RTL

**D57.** Logical utilities only — `ms-*` not `ml-*`, `text-start` not
`text-left`, `inset-inline-start` not `left`. Native controls place themselves.
The mini-chain, the silence meter and the pace line are flex rows and need no
`rtl:` override. Every screen is driven in both locales before it is done.

**D73. Direction follows the run, and the test is one question: is there a word
in it?** A run holding a **translated word** takes `dir="auto"`. A run holding a
**bare figure** — a reference, a decimal, a date, a percentage, a count standing
alone — takes `dir="ltr"`. Nothing takes `dir="ltr"` merely because it contains
digits.

**The failure is silent and it changes a number.** European digits are *weak* in
the bidi algorithm, not strong, so `auto` resolves a mixed run off its word and
gets Arabic right. Forcing `dir="ltr"` over *figure · word · figure* reverses
the two figures for an RTL reader: *4 of 13* renders as *13 of 4*. Nothing
throws, nothing fails a check, and the page looks composed. Session `28b`
shipped it.

**`D62` is the same instinct about a stored value** that may hold either script;
this is the rule for a run FACET **composes** out of a translated string and a
figure — `"{count} days"` / `"{count} يوم"`, `"of {target} m²"` /
`"من {target} م²"`. The tell is a `dir` on the container rather than on the
value: a cell, a paragraph or a table column carrying `dir="ltr"` is almost
always covering a word it did not mean to.

---

## 17. What is not built, deliberately

**D58.** No drag-and-drop anywhere. No inline cell editing. No bulk selection.
No saved views. No keyboard command palette. No charts beyond bars and the pace
line. No toasts — the row changing is the feedback. Each of these can be argued
for later; none is argued for now, and each would breach D21.

**D59.** A filter chip carries the current search. A chip linking to a bare
`?type=…` throws the query away and the list silently returns the wrong rows.
This broke three lists. **And a chip's count is over the scope its own click
would produce** — respecting the search it carries and ignoring the filter it
replaces — because a count over the whole scope promises rows the click does not
deliver, while a count inside the active filter would read zero on every chip but
the live one.

**D60.** The empty state sits outside the list card, not inside it. D52 decides
what it says; this decides where. Inside a card with a pagination footer, an
empty list reads as a broken page rather than an empty one.

**D61.** Container-drawn line work assumes a full last row, and an `auto-fit`
grid cannot promise one — the empty track paints as a solid rule. Borders go on
the cells.

**D62.** A value that may hold either script carries `dir="auto"`, wherever it
is entered or displayed — direction is a property of the value, not of the
page. Since S12 and S19 a company or contact name is one field written in
English or Arabic, so an Arabic name must read correctly on an English page.
This is the converse of the `dir="ltr"` rule, which only ever covered LTR
content — references, decimals, dates — inside Arabic.

**D63.** A **repeating entry row** — quotation lines, report signals, handover
buckets — is the one place a form is not a single column `D24`. Its fields are
grouped by the kind of question they ask, separated by a rule and **never by a
section label**: a label repeated on every row is noise, not structure.
Standard values are prefilled, so the row shows what is actually being typed. A
computed value is never an input, and is not shown until the row exists.
