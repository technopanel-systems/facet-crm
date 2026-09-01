# THE FIXATION — Phase 2: the founder's answers

Session 50, 1 Sep 2026. Five batches, asked in plain business language. His
words are quoted where he gave them; each answer names the rule work it
produces. Nothing below changes code in this session — decisions land in
SPEC/DESIGN with markers, and the sessions that build them are added to
WORKFLOW §4.

## 1 · Chasing while an order is processing → PAUSE

> "The reminder says 'the customer hasn't replied to your quotation.' If a
> dispatch was raised, the customer did reply — they said yes. The reminder
> isn't a judgment call, it's just wrong. … If the dispatch is refused or
> cancelled, the chase comes back. If it's approved and shipped, the
> quotation is won and the chase is finished, not resumed."

He also separated the two reminders: chasing THIS quotation (answered by the
dispatch) is not staying-in-touch generally (the company-quiet threshold, a
different reminder for a different reason). → **New S137 [CHANGE]**; closes
the A2-6 register row and SPEC §16's open chase item.

## 2 · Regular customers → NO DISTINCTION

> "Once you pause while processing, you don't need to tell regulars apart for
> this. Don't build it. … If FACET ever needs this, use 'bought more than
> once' — the system can already see it from dispatches and nobody has to
> maintain it. Not the rep marking them."

His reason, verbatim: "a rep-maintained flag goes stale the moment someone
forgets, and your whole system is built on computed states." → recorded
inside S137 as a refusal clause with the settled derivation.

## 3 · Companies added and never contacted → BOTH halves

> "This is your dumping problem, and both halves do different work. The rep
> reminder changes the behaviour — if dumping 40 companies puts 40 reminders
> on your own list, dumping stops being free. The manager count lets you see
> whether it worked. … If a rep has 40 of these, the reminders shouldn't
> drown the real ones — group or cap them."

→ **New S138 [BUILD]** — a rep reminder some days after creation with no
contact, plus a per-rep never-contacted count where the manager reads the
team; grouped or capped so bulk additions do not drown the list. Closes the
S45-8 register row.

## 4 · The 30/60 silence thresholds → already half-adjustable; keep

He asked for a check before deciding. Checked: the thresholds ARE settings
rows (`followup.quiet_days.qualified` / `.unqualified`), seeded and read at
query time — his belief was right. What does NOT exist is a screen to edit
them: `src/lib/settings.ts` has no writer and no route touches settings. So:
**keep 30/60, storage already done; the manager edit screen is the missing
half and stays on §4 row 37.**

## 5 · Who gets a personal to-do list → ONLY PEOPLE WITH CUSTOMERS

> "A manager or executive CAN hold customers as a rep does — that stays
> possible and nothing should block it. But their dashboard is for
> overseeing, not for their own queue. If a manager has personal customers,
> he sees them where a rep sees them — on the Companies and Follow-ups
> screens — not on his dashboard. The dashboard is: how the company is
> doing, how each rep is doing, what only he can decide, and a way into any
> individual rep. What exactly it shows is a separate conversation I want to
> have."

→ **D64 [CHANGE]**: the waiting list, the counts strip and the personal
greeting render for company-book holders; an overseer's dashboard is the
oversight blocks. The exact overseer dashboard contents are **OPEN — the
dashboard conversation**, recorded in SPEC §16; no session builds more
dashboard until it is had. Resolves A2-8 and the D68/D64 held conflict's
direction.

## 6 · The executives' screen → HOW THE COMPANY IS DOING (for now)

> "Agreed for now, but what a manager and an executive should actually be
> measuring is not settled and I want a proper conversation about it —
> metrics, what's shown, what's worth knowing. Record that as an open
> decision, don't build more dashboard until we've had it."

→ **D68 rewritten**: team table + company target panel; the metrics
conversation is the same OPEN item as above.

## 7 · Export → SUPER ADMIN ONLY

> "Customer data leaving FACET is a super admin act. If a manager or CEO
> needs a file, they ask and it's handed over. Widening it later is one line
> if the pilot shows it's needed."

→ **S8 [CHANGE] rewritten**: `can_export` super admin alone (narrower than
both the old rule and the seed). Closes the AUDIT 1b S8 row.

## 8 · Duplicate detection → BUILD, with a correction

Decision from the explainer
(https://claude.ai/code/artifact/4553dadf-3a4a-4bcc-b9c4-e57cba654103):
build it, timed before bulk import. His correction, verbatim:

> "Sharing a company does NOT mean sharing its work. Two reps can hold the
> same company, and each keeps his own projects and his own quotations with
> that customer. They see the company; they don't take over each other's
> deals. A dispatch credits the rep whose project and quotation it came
> from — normally one rep, whole. It's only split when the dispatch itself
> is genuinely shared work, and that's the existing credit-split rule, not
> something sharing a company triggers. So 'shared' is about access to the
> customer, not about ownership of the deals."

→ **S22 amended** with the clause; consistent with S30 (membership never
reveals projects) and S78/S80 (credit follows the dispatch).

## 9 · Rep-requested archiving → BUILD, two clauses

> "A rep pressing 'no potential' is a request, never an action — nothing
> leaves his list until the manager rules. And keep the reason required; the
> reason is the point."

→ **S105 amended** with both clauses.

## 10 · Who resolves duplicates and approves archives → the original three

> "Manager, admin, CEO (not employees or reps) decides. If the pilot shows
> he's not keeping up, or the decisions look wrong, it moves — but start
> with the person whose job it is."

→ `can_resolve_duplicate` and `can_approve_delete` keep Executive + Sales
Manager + Super Admin; only export narrowed. S8's rewrite carries all three
flags' final holders.

## 11 · Field order in forms → PROPOSE, THEN CORRECT

> "Propose one form at a time, not all at once. Show me the current order
> and the proposed order side by side so I can see what's changing."

→ The process is the decision; the proposals are their own sessions (one per
form), added to §4. The §6b D24 sort-clause proposal stays declined — his
question was never list sorting.

## 12 · List sorting → AFTER THE PILOT

> "Keep Companies as it is. The others wait until a real rep says 'I can't
> find X'."

→ D24 gains no sort clause; the held §6b proposal closes as declined-for-now.

## 13 · The week strip and Recently → DROP BOTH

> "Dropped. If the dashboard conversation later shows a real gap, they come
> back — but don't carry them as unbuilt debt."

→ **D35 and D36 DELETED** (numbers kept as tombstones).

## 14 · Display: Arabic plurals + dimension zeros → BOTH

Full CLDR Arabic plurals everywhere (يوم / يومان / أيام) and trimmed
dimension factors (109 × 1.5, stored precision untouched — S5 unchanged).
→ **New D75 [CHANGE]**; closes A2-13's founder question and A2-16's
remainder.

## 15 · The one-list rebuild (the waiting list) → PARKED TO THE PILOT

> "Don't retire the one-list idea and don't build toward it. Park it, and
> let the first month of real use decide. If reps navigate fine, it's
> dropped."

→ S86–S95 keep their markers with a PARKED note; no session aims at S87's
single list until the pilot rules.

## 16 · The unbuilt list — verdicts

- **Holiday calendar — KEEP AND WIDEN.** His words: "The calendar is not
  just public holidays. It also needs personal leave — annual leave, sick
  leave, any absence. If a rep is off for two weeks, his pace bar and his
  reminders should know it, otherwise he comes back to a screen telling him
  he's behind and neglecting customers he couldn't have called. Public
  holidays affect everyone; leave affects one person. Both must be
  enterable." → **S94 rewritten** to carry both.
- **Password reset — KEEP** (S11 unchanged).
- **Why-we-lose report — KEEP**, built when the pilot has produced real
  data (S49 unchanged, timing noted).
- **Catalogue-sent labels — DROP.** → **S135 and D71 DELETED** (tombstones).
- **File attachments — DROP.** → **S115 DELETED** (tombstone); the
  `attachments` table loses its rule and becomes a drop candidate for the
  next dead-structure sweep.
- **Product-spec block — DROP.** SPEC §16's open item closes as not needed;
  `product_specifications` likewise becomes a sweep drop candidate.
- **Dispatch money total — KEEP** (S117's remaining half stays on the plan).
- **Category + lead source — KEEP.** His words: "Lead source especially —
  it's how I'd learn where business actually comes from. Make them easy to
  fill and make reps fill them. Check again a month into the pilot: if
  they're still empty, the problem is the form, not the fields." → S16/S17
  unchanged; the pilot+1-month check recorded; prominence belongs to the
  field-order proposals.

## 17 · Has the business changed → NO; the mandate

> "Nothing has changed in the business. But rules have accumulated over a
> year and some now look unclear, wrong, or like they'll cause complexity —
> that's the reason for this whole session. Flag any rule you find that
> seems to work against how things actually run, and ask me. Don't preserve
> a rule just because it's written down."

## The technology list (reported, not asked — nothing looks wrong)

Per the brief: Next.js + TypeScript, PostgreSQL, Drizzle, Tailwind,
next-intl, Docker on a company PC behind Cloudflare Tunnel + Access — all
sound for a fourteen-user internal tool with no ops team. The one watch
item: `next-auth 5.0.0-beta.32` is a beta pinned in production, and the auth
bridge's failure mode is silent — already covered by the standing rule
(re-run verify:routes §30 on any auth-family upgrade), now also a path-scoped
rule that loads whenever package.json is touched. No stack change proposed;
none was made.
