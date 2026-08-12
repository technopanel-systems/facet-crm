# FACET — Project Rules

Read this at the start of every session. Keep it short; details live in `docs/`.

## What FACET is

An internal operations platform for **Technopanel**, a Saudi supplier of
cladding / aluminium composite panel (ACP). It covers sales CRM, and later
production, warehouse and marketing.

It does **not** cover finance, invoicing or tax — those live in **SMAC**, the
company's existing ERP, which is staying. FACET grows sideways into new
departments. FACET never grows down into finance.

Current phase and model/skill routing: `docs/05-roadmap.md`.

## Document authority

When sources disagree, higher wins.

**User truth** — stated directly by the founder:
1. `docs/21-phase10a-decisions.md` — latest; follow-ups and notifications.
   A follow-up is a **condition, not a record**, materialising as a notification
   and **never as a task**; five notification types and **no sixth**;
   **persistence belongs only to a type whose condition can clear**; a handover
   raises **one** summary, not one per record; the rep re-includes a dormant
   company while the manager reassigns or archives it; and working days skip
   **Friday and Saturday, globally**
2. `docs/20-phase9-decisions.md` — activity reporting. Knowledge is **company
   property**; a report's visibility **follows its anchor**; compliance is
   **coverage, not submission**; the timeline is **derived, not stored**; and
   every event is attributed to **whoever performed it**
3. `docs/19-phase11-decisions.md` — team, user management and offboarding.
   A handed-over thread **rewrites its raiser**, region on a user is **asked not
   derived**, handover **opens only after deactivation**, nav gates a section by
   **boolean prop**, **self-deactivation is refused**, and **email is editable**
4. `docs/18-slice3-decisions.md` — dispatch, credit splits and targets. Credit
   with no split goes to **the rep on the dispatch**, splits divide **equally
   and are rare**, and **the contributor is withdrawn**
5. `docs/17-product-lookup-decisions.md` — seeds the suppliers, makes **colour
   free text rather than a lookup**, reseeds the thicknesses (2–8 mm, **4 mm the
   only standard row**), and frees the quotation screen from SMAC's layout
6. `docs/16-slice2-decisions.md` — the quotation chain. FACET computes the
   money, VAT defaults to 15%, expiry is a sweep, and **`accepted` is internal
   approval, never a won deal**
7. `docs/15-lookup-decisions.md` — reverses 14 §5's control choice for the city
   field, and makes region derived rather than entered
8. `docs/14-slice1-decisions.md` — corrects 12 §3 and 13 §2's scope rule
9. `docs/12-closing-open-items.md` — corrects 07, 08, 09, 10, 11
10. `docs/11-architectural-decisions.md` §1–3
11. `docs/04-founder-answers.md`
12. `docs/07-phase4-answers.md`
13. `docs/08-quotation-model.md` §A–C

**Settled decisions** — agreed, do not re-litigate:
14. `docs/13-data-model-decisions.md` — §3 is **LOCKED**; §1–2 explain the
    schema, they do not govern it
15. `docs/10-schema-decisions.md`
16. `docs/09-schema-design.md`
17. `docs/03-stack.md`
18. `docs/01-business-model.md`

**Presentation only** — how it looks, never what it does:
19. `docs/22-design-language.md` — the warm-black palette, IBM Plex, the four
    screen archetypes, and the rule that a row says **whose move it is**, not
    what the status is. It governs appearance and **nothing else**; where it
    appears to decide behaviour, every document above outranks it. Its §6 is
    the redesign's own OPEN register

**Reference only** — never authority:
20. `docs/06-strategic-review.md` — proposals, explicitly not truth
21. `docs/00-legacy-findings.md` — audit of the failed v1 (~48 KB, never load
    whole; cite sections)
22. `docs/02-history-extract.md` — mined from old chat transcripts
23. `docs/11-architectural-decisions.md` §4 — known fragilities, not decisions
24. `docs/23-verification-log.md` — what has been verified, not what is true
25. `docs/24-doc-audit.md` — the disagreements between documents, and the
    current OPEN register
26. `legacy/**`

**Later decisions correct earlier ones.** When two documents disagree, the later
one is the answer — no judgement call needed. Each document states its own
reasoning; these are the reversals that still change what gets built, and the
ones most likely to be got wrong from memory:

- `21` **overrules `10 §9`'s self-closing system task.** Follow-ups are computed
  on read — the pattern `16 §3`, `20 §5` and coverage already use — and surface
  as **one digest notification per recipient per day** `[07 E5]`. So **`tasks`
  stays empty and `system_trigger` permanently unused**, kept rather than
  dropped the way `13 §2` keeps `form_factor`.
- `20` **supersedes `04 Q6`'s "activities are private to the rep, without
  exception"** — visibility follows the anchor — **and `07 D6`'s submission
  model with its two-day grace**: nothing is handed in, so nothing can be
  missed, and no working-day arithmetic is needed there. `activities` stays
  permanently empty the way `product_colours` does `[17 §2]`. `20 §8.2` adds
  that **`audit_log` is never read directly for a user-facing view**.
- `16 §8` and `18 §2` **reverse `04 Q10`'s coordinator read-across.** The
  coordinator does **not** see all companies and projects read-only. They see
  **every quotation thread, and behind it company names only** — a name-only
  search, no company, contact or project visibility. Neither document cites
  `04 Q10`, so `01 §2.1` restated it as settled for four days `[24 §1.1]`.
- `18` **withdraws `07 D3`'s contributor** and `09 §4.2`'s null percentage with
  it. Credit is fixed to the dispatch, so no past month moves when an owner or a
  rep does.
- `17` **drops `08 B1`'s G, G1 and Y suppliers** for N, K, D, C, and makes
  colour typed rather than looked up, so `colour_id` is always null.
- `12 §7` **supersedes `04 Q8.1`'s "or delete them"** — only redistribution is
  built — and `14` corrects `12 §3`: the executive may edit records.

Never treat `legacy/` code, schema or docs as a specification. v1 failed. It is
kept to understand what was attempted, not what should be built.

## Hard rules

- **Do not read or modify anything under `legacy/`** unless explicitly asked.
- **Do not reopen settled decisions.** If one looks wrong, say so once, in one
  paragraph, and move on. Anything marked **LOCKED** requires new founder input
  in a new user-truth document — re-reading the old text is not new information.
- **Never invent business logic.** If a rule is not in `docs/`, stop and ask.
  Guessing produced v1's dead approval gate and its unused `branches` table.
- **Never add a table, column or entity that no document requires.** List it
  as `PROPOSED — not required by any document` instead.
- **Never mark something as founder-decided unless it appears in a user-truth
  document.** Assistant proposals are proposals until written down.
- **Changes follow the document that asked for them, at the scope it asked
  for.** Correct, harmless structure is left alone (`13 §2`).
- Where something is undecided, write it under `OPEN — not chosen` rather than
  filling the gap.

## Design principles

- **If the system can know it, don't ask a human.** Derive from real events.
  Only ask for what genuinely lives in someone's head.
- **Roles are permission flags in a table**, never hardcoded role names.
  Adding a role must be configuration, not code.
- **One authorization layer**, in application code, in one place. Not database
  policies. v1 had RLS, UI and docs disagreeing about who could do what.
  This governs **who may act**. Data-integrity invariants — what a row may
  contain — belong in the database (`13 §1`).
- **No module invents its own version of a core concept.** Warehouse gets no
  supplier table of its own; finance gets no customer list.
- **Accounts deactivate, never delete.** History must keep pointing at a real
  person.
- **Role and target are separate.** A person has a role (what they may do) and
  optionally a target (what they are measured on). Targets are SQM only.
- **Targets and shares are dated rows, never mutable fields.** Changing one
  must not rewrite history.
- **Sharing is manager-initiated.** Reps request by phone; the manager acts.
  Assignment hands a record over; sharing grants access to a record someone
  else still holds.
- **SMAC owns money; FACET mirrors it.** Where the two disagree, SMAC is
  correct. Reference numbers are typed by humans — assume they can be wrong.
- **The audit log is written by the data layer**, not by each feature.

## Conventions

- **Every user-facing string goes through the translation layer** (EN + AR).
  No hardcoded text, from the first screen.
- **RTL: logical Tailwind utilities only** — `ms-*` not `ml-*`, `text-start`
  not `text-left`. The convention that rots fastest if unenforced.
- Square metres are always **generated**, never hand-entered:
  `quantity_pcs × width_m × length_m`. Quotation lines are sheets; the
  application writes `form_factor = 'sheet'` (`13 §2`).

**The rest of the UI conventions live in the `facet-ui` skill** — the page and
form shapes, the substitution table, `SelectField` vs `Combobox`, server-action
validation, and the pre-flight checklist. Load it for any work under
`src/app` or `src/components` rather than rediscovering them from the code.
The verify-script shape is the `facet-verify` skill.

## Verification

There is **no test harness.** `npm run typecheck` · `lint` · `build` ·
`check:messages`, then `npm run verify:{slice2,slice3,phase9,phase11,phase10a}`
— kept behavioural scripts driven in process against `src/lib`, **development
only**, each needing `db:seed` and `dev:fixtures` first. **`build` is not
optional**: typecheck passed while a client component imported a data module.
**A phase is not done until its screens have been driven over HTTP, in both
locales** — a green suite once sat beside a 500 on every company detail page.
Assert on DOM markers, not translated strings, and replay the real form POSTs.
**Auth bridge** (`11 §4.1`): re-run after any upgrade of `next-auth`,
`@auth/core`, `@auth/drizzle-adapter` or `next` — failure is **silent**, login
works but sessions stop being revocable.

History — what each script asserts, every bug caught, every trap hit, what is
still manual — is `docs/23-verification-log.md`.

## Working style

- Plan mode first for anything structural. Show the plan, wait for approval.
- One task per session. Small, reviewable diffs.
- Show file paths and diffs, not whole-file reprints.
- **Run all four checks, then drive the screens** — see **Verification** above.
  Neither half stands in for the other.
- Commit after every working slice.
- Ask before adding a dependency.
- Host-side `db:*` scripts read `DATABASE_URL` from `.env`; the app container
  builds its own connection from `POSTGRES_*`. They can disagree — and
  `drizzle-kit` reports an auth failure by exiting 1 with no message.

## Stack (settled — see `docs/03-stack.md`)

Next.js + TypeScript · PostgreSQL · Drizzle · Auth.js · Tailwind + shadcn/ui
next-intl (EN/AR, RTL) · Docker on a company Windows PC · Cloudflare Tunnel ·
Synology for backups

No Supabase. No Vercel. No database RLS.
