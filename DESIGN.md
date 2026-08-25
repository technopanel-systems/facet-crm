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
| **Dispatch** | the square metres, mono, large | how much went out? A **submitted request** owes the coordinator (S88); an **approved dispatch** owes nobody. |
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

All five flags named above are columns on `roles` today. None of the six blocks
is built.

**D32. The signature panel is the target with a pace line.** Dispatched square
metres this month as a large mono figure, of the target; a bar filled to
achievement; a **vertical tick at today's position in the month**. Above the
tick is ahead, below is behind. Beside it, small figures: awaiting signature,
last month.

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
against on another. The edit control renders **per row** for `can_set_targets`.
Merging them is what frees the seventh slot for Activity.

**The built rail carries eight, and that is deliberate and temporary.**
Activity and Targets are now on it. **Performance is still there too**, against
this rule's *not top-level*, because merging it into Targets is a screen change
and moving the rail item first would hide attainment from everyone who can
reach it today. It sits **last in *Track***, so deleting it leaves this rule's
order already correct. **Session `28b` merges the two screens, and that is what
takes the rail to seven** (`WORKFLOW §4`, `§5`).

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
