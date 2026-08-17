# FACET CRM — History Extract

Extracted from the exported Claude chat transcripts in `legacy/docs/history/`.
Read-only extraction. Facts only, no recommendations.

---

## Provenance and method

### Sources

| Tag | File | Messages | From user | Date range |
|---|---|---|---|---|
| `dev1` | `Claude-development 1.json` | 50 | 25 | 7 May – 11 May 2026 |
| `audit1` | `Claude-audit 1.json` | 4 | 2 | 12 May 2026 |
| `dev2` | `Claude-development 2.json` | 208 | 104 | 12 May – 6 Jun 2026 |

Citations are `[tag #n]`, where `n` is the zero-based index in that file's `messages`
array. Even indices are user messages, odd indices are assistant messages.

### What counts as business truth

Only the user's own statements. Assistant output is a proposal unless the user agreed
to it in words.

- **Agreement** = "confirmed", "confirm", "worked", "Success", "Done", or a substantive
  answer engaging with the content.
- **Not agreement** = "next phase", "Next", "start phase N", or silence. That work is
  logged in §4.2 *Proposed, not contested* — recorded as delivered, never as agreed.

### Critical gap in the record

The export preserved message text only. **Every file the user attached appears as a bare
`File:` placeholder with no content.** Lost this way:

- `FACET_CRM_CONTEXT.md`, `FACET_CRM_CORRECTED_AUDIT.md`, `md audit.md`, `md proj.md`,
  `FACET_CRM_CONTEXT final.md`
- Every "Pasted content" prompt file `[dev1 #0, #2, #4, #48]`, `[audit1 #0, #2]`,
  `[dev2 #0, #178, #184]`
- The Gemini continuation file `[dev1 #30]` and Gemini response `[dev2 #184]`

The user's two densest business messages are among them: `[dev1 #2]` (7 May 12:34),
which the assistant called "a major business direction correction", and `[dev1 #4]`
(7 May 16:52), the answers to seven clarification questions. **Their content is gone.**
What survives of them is assistant restatement only — collected in §5 as questions.

Consequence: §1 below is what the user typed directly into chat. It is not the whole of
what the user said during the build.

---

## 1. Business rules and decisions stated by the user

### 1.1 Daily submission compliance and absences

All from `[dev2 #36]` (13 May 10:36) unless noted. Spelling is the user's throughout.

**KPI and daily submittal are two different systems.**
> "kpi and daily submitals is 2 diffrent things — kpi is already supposed to be
> clalcuated using normal activits or pipe line of the crm — the daily submital is for
> telling what does the crm doesnt knonw, like ertaininteractions , visit , nots of what
> happened" `[dev2 #36]`

**Live interaction updates and the daily submittal are both mandatory for reps.**
> "the rep we will tell him that its mandatory to livelu update every interaction (even
> sales cooridnators creations of quoation that affect the reps activites) and also
> mandatory to make the daily activies submital" `[dev2 #36]`

**Grace period is one day.** Today's report may be filed today or tomorrow at the latest.
Past that, a notification goes to management and the lateness is registered in the
dashboard.
> "so we give the rep a chance to make todays report today or tomorrow by max , if later
> than that then a notification should be sent to managment and also its registed in the
> dashboard" `[dev2 #36]`

**Weekend does not consume the grace period.** Friday and Saturday are not working days;
Thursday's work may be reported on Sunday.
> "its okay if they made some friday or saturday but the logic says it should past
> tomorrow for todays report" … "(dont calcualte the week end as thursday work can be
> calculated in sunday)" `[dev2 #36]`

**Compliance is reviewed on multiple cadences.**
> "we will check daily or monthly or weakly who is making the interactions daily and who
> late than the required time" `[dev2 #36]`

**Absence system required** — a flexible way to mark a rep unavailable.
> "im thinking of a flexible system for some drops like eid vacation or sick or monthly
> vacation to tell the system this rep is not avialbe" `[dev2 #36]`

**Notification fires automatically when the grace period expires** — not on manual review.
> "q1 , notiifcation fire autmaticlly if the grace period finished" `[dev2 #38]`

**Absences may be approved retroactively.**
> "q2 yes manager can approve that later no problem" `[dev2 #38]`

**A team-wide holiday feature is required**, in addition to per-rep absences.
> "q3 yes also make entire team holiday feature" `[dev2 #38]`

**The missed-submission notification goes to both the rep and management** — it is a
correction reminder, not only an escalation.
> "notification fired for both (for rep as he forgot to tell the absence reason or he
> told the manager but manager forgot to make it , then its like a remidning system for
> correction)" `[dev2 #40]`

**Holidays must actually excuse the rep.** Reported as broken: adding a holiday left
reports marked missing; only a marked absence produced an excuse.
> "when adding holidays , it doesnt excuse the reps , reports still amrked as missing —
> only when marking as absesne then exucse is shown" `[dev2 #72]`

**Excuses need their own record view.**
> "lets make like amini menu or dahsoard for execuses record as when making execuse it
> didnt showd in the menu (although it reflected to the rep as execuse) + enhancing
> viwing of exeucse for better managmnt" `[dev2 #72]`

**Method constraint on this work:** implement inside the existing phase structure, in
respect of prior and later steps, without breaking existing logic.
> "lets make this whole implemnation in respect with the phasing where we already working
> on to not break the workflow or any logic with repsct with previous steps and alter
> steps (as if this phsae was already in between)" `[dev2 #40]`

### 1.2 Roles, accounts and access

**Public self-registration is to be replaced by a manager-side portal.** The user hit
`Server error: Check if SUPABASE_SERVICE_ROLE_KEY is saved in Vercel` on the register
page and decided the whole section should change.
> "im thinking to complete changie in this to be flexible and more secure like instead of
> registering , there should be a portal in manager view resposible for all of this ,
> creating account , name , email , role .... etc like a complete rechange of this
> section" `[dev2 #72]`

**Account creation must stay simple** — an admin sets a password and hands it over. No
email flow, no approval step.
> "iw ant registrartion be simpple like thesuper admin or manage can create a passwrod
> and give it to the rep or something , no need for complexisty" `[dev2 #74]`

**A super-admin role is required for `jerom@technopanel.com.sa`**, with all views and the
ability to switch its own role for testing without risking lockout.
> "i want a role only for this its like a super admin developer that have all the views ,
> or self changing roles to check and test without interference of roles as im afraid
> currently if i changed my role from manager (onley manager currently) i will go through
> pain to change or recreate my account again from the database which is painful"
> `[dev2 #72]`

**Most CRM members work as sales.** Nearly everyone needs a sales dashboard, registration
and the full workflow, with only small role differences.
> "most if not all the mebers should have a slaes dashboard and registation and
> everything (exept small changes or oles in diffrent team)" `[dev2 #72]`
> "quoations can be assigned to all roles a most of thm works as sales (exept 1 in 2 when
> adding future roles)" `[dev2 #74]`

**Project history visibility:** rep sees their own, manager sees all.
> "reps se heis own history regarding the project and the manger see the history for all
> projects" `[dev2 #74]`

**Manager must see all quotations.**
> "in manager view he doesnt havea quotiaons menu as same to comapnies or prject , any
> quoations is created should be visible by manager for full overview and seeing pipleine
> s of it" `[dev2 #72]`

**Manager cannot see companies or projects they add** — reported as a defect, including
companies added by a rep.
> "in manager crm when addinga company 'i cannot find it' even if rep add a compny , i
> still dont see it — same as for the projects" `[dev2 #72]`

**Quotation visibility inverted** — reported later, still broken:
> "as a super admin or manager cannot see the quoataions / as a coordinator , cannot see
> created quoations yet / as a rep i see the created quoation by the coordinator (which
> is not seen by the rep or manager or super admin)" `[dev2 #164]`

### 1.3 Companies, contacts, projects

**Auto-generated codes must not be visible in the UI.** They are database identifiers,
meaningless to users, and misleading if records are deleted.
> "numbering of proj like Proj-0001 or cust-0002 should not be visible as this is a
> database id , its not meaning any thing to a rep or manager or maybe takes descision
> about numbers if projects in this which which maybe not bee accurte if deleted some
> projects or comapnies" `[dev2 #72]`

**A per-project change history is wanted**, covering lead changes, assignment, amounts —
with obviously mistaken input tolerated rather than special-cased.
> "lets say a manger opens a project , maybe he find a alist of all steps happened in
> this particualr project from changing leads , assingment , amout , anything (ignoring
> wrong input like if a rep mis choose catalgos sent by won and again back to cataloge
> sent)" `[dev2 #72]`

**Loss reason needs a free-text remark** alongside the dropdown, for later analysis.
> "when chhosing the loss reasong , whatever the loss choosed , i would prefer to add a
> remakr ot nots for additional reference ex if becasue competeitot give a lower price ,
> then it should be safely written here 'for alter analysis'" `[dev2 #72]`

**Company source — rep list:**
> "Field Visit - Direct Contact 'from here another drop down for call , email , whatsapp ,
> other "write what is other"' - Referral - exhibition - other 'also write what is other'"
> `[dev2 #72]`

**Company source — manager list** adds a Marketing branch with channels:
> "visit - direct contact 'same second list of the rep' - refeal - exhibition - markaeting
> 'we want to incluce channels here like social media - website - google - email marketing
> - exhibitions - other "with writing what is other"' later will be expandded in a
> makreting system" `[dev2 #72]`

**`next_follow_up` is to be removed**, replaced by the project's date of addition
(defaulting to today, editable), because notifications will handle reminders.
> "for the next follow up date i dont want it as we will build a system of notifications
> autmatically work , no need for next follow up , instead we can put the date of addition
> of the project 'something like it is autaically today unless the rep chhose another
> date'" `[dev2 #72]`
> "same edits of the project page to the manager view" `[dev2 #72]`

**Project quoted sqm should tie back to the real quotation or invoice.** Posed as an open
question by the user:
> "in projects view in rep crm , the quoted sq.m i want it as refrence to the real
> quotation or the invoice when later made from sales coordinator so what do you think
> best implementation for this ? like the rep but initary number then its corrected
> autmatically or what ?" `[dev2 #72]`

Resolved by the user in favour of automatic update:
> "yes i prefer autmatic update reagrding updating quoations" `[dev2 #74]`

**The activity company field must be a select, not free text** — typeahead to assist, but
the final value must be chosen from assigned companies.
> "when trying to write the company name it doesnt write in the activites — i want it a
> drop down showing the companies assigned + text to help in search but at finaly it must
> be selected not text free" `[dev2 #136]`

**No re-entry of already-registered data, anywhere.** Company type should not be re-asked
at activity time; contact person should be chosen, not retyped; edits happen at the
record's origin.
> "re choosing the type is no need as it should be registered before and if he want t
> change it , he change it from my copnaies page" … "the contact perosn also want to eb
> choosen as we said before we will create contacts for each company or multiple adn since
> choosinga contact no need to re write his details or numbers" … "make sure that rep
> doesnt re enter same registerd detaisl in any step , everyting is already pre regsitered
> and any edit regarding any thing he should go to its origin" `[dev2 #138]`

### 1.4 Quotations

All from `[dev2 #72]` (14 May 10:24) unless noted.

**Per-product fields required**, replacing the single product type:
- colour code — "written numbers only or special case a ral color"
- supplier code dropdown — `N-K-D-C-G-G1-Y`
- width dropdown in metres — `1.24-1.5-2-other "number for refence"`
- length — written number in metres, "as it varaible"
- number of sheets
- thickness dropdown — `(4-5-6)mm`
- **Class** dropdown replacing product type — `Class A - Class B - Class A2G2 - Class A2G1`
- **FR** dropdown — `A2 - B1 - Normal`

> "these will use for later indications and conncting to the stock"

**Multi-product per quotation.**
> "all of these ariables are regarding for only 1 product so i want something like to add
> field to inssert another product"

**Totals.**
> "total sqm. in the quoations is clalcuated by (number of sheets * length * width) (for
> each product)" — "total price (maybe add for refrence ) = (total sq, * price per sq.m )
> (maybe laso for refrence to add *15% of the VAT)"

**This is not an ERP; sqm is the metric that matters.**
> "again this is not a fully erp system we are just mirroring the situation so match
> numbers for anayltics (prices adn money is not a big concern for the sales deparment as
> all moeny stuff and financaial anayltics is to the fininace dep , what we foucs on is
> the total sqm) (maybe another inegration in the future for financial anaylsis)"

**Services** — nice-to-have, priced per sqm only, chosen per product line.
> "some times we offer services like Cutting or Grooving or Bendinf or CNC 'this doesnt
> have to much details but its better to have and its calcualted by sitatuion randomly ,
> only we need is if we have a certain field product that it might include any of the
> services , we just choose which serve and what price is per sqm only'"

**Revisions and ERP reference.**
> "also there is revision number , i dont now what it is but if you refred this for the
> editng in the quoation , then its better to choose thq quotaiotn itself and make the dit
> then autmaticcaly regsited as revsion and also we need to put a section to write the id
> of the quoation 'used to mirror our realy quoation from erp to easy to get to'"

**Assignment is not rep-only.**
> "when creating the quoation that assignation is not only for th reps , it could be
> assigned to any memnber in the crm"

**Cancelled ≠ Lost.** Cancellation is coordinator-only and requires a written reason; the
rep can only mark lost.
> "for loss or canceleed id dont know maybe to sepate cancel or loss or make cancel doesnt
> registeer as loss but the coordinator must say why cancel in text field (only
> coordiantor can cancel) and in rep he cannot cancel but choose lose it calcualted as
> lost quoations or something" `[dev2 #74]`

### 1.5 Data state and operating constraints

**The system holds no production data and is not in use.** Stated three times, and used
by the user to authorise destructive schema changes.
> "note : the crm is not public or have any data currently , we are auditing before using
> the program" `[dev2 #20]`
> "q5, yes dont worry (crm has no data at all in all aspects)" `[dev2 #38]`
> "as i said the system is completly free from data i dont have a single line so no
> oriblem for me to recreate the whole thing (we already working in another google sheets
> system until this is finished)" `[dev2 #74]`

**No data-compatibility constraint on the source field redesign** — start fresh
`[dev2 #74]`.

**Test accounts were curated by hand.** Other rep emails were deleted as wrong from the
outset; one rep's role was changed temporarily for coordinator testing.
> "you may ask where other emails , i removed them as from first place they where wrong
> and for a.alzaben he was a rep but i changed his role temp for testing coordinators crm"
> `[dev2 #78]`

**Working method:** the user edits files directly in the GitHub web UI and wants
path-plus-change instructions rather than full explanations, to conserve tokens.
> "see im editing by replacing edits and lines in github itself — to reduce the tokens
> just tell me what things to edit in which path" `[dev1 #20]`
> "revert back to th eproject for prcisise fiing without using alot of tokens" `[dev2 #116]`

---

## 2. Decisions the user later reversed

### 2.1 `next_follow_up` on projects

- **First:** added to the schema as "critical for daily task view" `[dev1 #5]`, present in
  the projects list and dashboard.
- **Reversed:** "for the next follow up date i dont want it … no need for next follow up"
  — replaced by project-added date `[dev2 #72]`. Implemented as `project_date` in Phase
  4.5g `[dev2 #103–#107]`.
- **Later:** a `/dashboard/followups` page titled "Follow-ups Due" was built on top of
  `project_date` `[dev2 #177]`. The user did not comment on it. Whether reintroducing a
  follow-up view over the replacement field matches the intent is not resolved in the
  transcript.

### 2.2 Free-text company name in the daily report

- **First:** declared already settled — "Free-text company entry in daily report →
  removed. Dropdown only going forward" `[dev1 #5]`, 7 May.
- **Reality:** still free text on 21 May, re-requested by the user — "i want it a drop
  down showing the companies assigned … at finaly it must be selected not text free"
  `[dev2 #136]`. Implemented in `[dev2 #137]`.

### 2.3 The user's own role

- `manager` at the start `[dev2 #78]`.
- Changed to `super_admin` in Phase 4.5h; SQL confirmed the change `[dev2 #110]`.
- Reverted by the application to `manager` twice — "still manage no super admin"
  `[dev2 #112]`, "still manager" `[dev2 #114]`.
- Finally set by hand in the Supabase table editor — "It replied that im nmanager ,
  changed ut to super admin from rable editor and worked" `[dev2 #118]`.

### 2.4 Super-admin role switcher

- **Requested:** "self changing roles to check and test without interference of roles"
  `[dev2 #72]`.
- **Built:** role-switcher dropdown added to the sidebar for `super_admin`
  `[dev2 #111, #115]`.
- **Removed:** "File 1 — components/Sidebar.tsx: Remove the role switcher, replace with
  the static text as shown above" `[dev2 #163]`, on the grounds that layouts check the
  database role rather than a view-as role `[dev2 #159]`. The user did not object, and
  did not agree either; the reply was a bug report `[dev2 #164]`, then "worked , next
  phase" `[dev2 #172]` after a separate quotation fix.

### 2.5 Ahmed Alzaben's role

`rep` → `sales_coordinator` "temp for testing coordinators crm" `[dev2 #78]` → back to
`rep` once Christina Refaat was added as the real coordinator `[dev2 #168]`.

### 2.6 Project `quoted_sqm` ownership

- **First:** manually entered by the rep on the project `[dev1 #5]`.
- **Questioned by the user:** "so what do you think best implementation for this ? like
  the rep but initary number then its corrected autmatically or what ?" `[dev2 #72]`.
- **Reversed:** rep entry becomes an opening estimate, overwritten automatically from
  quotation item totals — "yes i prefer autmatic update reagrding updating quoations"
  `[dev2 #74]`. Trigger built in Phase 4.5m `[dev2 #133]`, confirmed present `[dev2 #134]`.

---

## 3. Requirements discussed but never built

Judged strictly against the transcripts. The record ends mid-project at documentation
generation, so each entry states what is absent from the transcript, not what is absent
from the repository.

**Deletion of the `/register` and `/pending` pages.** The user's decision was a complete
replacement of self-registration `[dev2 #72, #74]`. Phase 4.5i replaced
`app/api/auth/register/route.ts`, added a Create User form to the Team page, and removed
the register link from the login page `[dev2 #119]`. No step in the transcript deletes
either page, and the assistant's own later file inventory still lists
`app/register/page.tsx` and `app/pending/page.tsx` `[dev2 #183]`.

**Excuse-records mini dashboard.** Requested in `[dev2 #72]`. Phase 4.5c fixed the absence
list not refreshing after save `[dev2 #85, #87]`; no dedicated excuse view appears in any
later phase.

**`quotation_revisions` log table.** Proposed as part of revision tracking — "A
quotation_revisions log table stores what changed and when" `[dev2 #73]`. The delivered
schema has a `revision_number` column and a `last_revised_at` timestamp only; the user's
own table check after the quotation redesign returned `quotation_items` and
`quotation_services` and nothing else `[dev2 #128]`.

**Automatic scheduled missing-submission notifications.** The user required automatic
firing on grace-period expiry `[dev2 #38]`. What was built runs lazily when a manager
opens the dashboard — "since you don't have pg_cron set up, here is a simpler and safer
approach that requires no external scheduler … the notification fires lazily"
`[dev2 #39]`. Both proposed automation routes (pg_cron, and n8n "later in Phase 5") remain
listed as future work at the end `[dev2 #183]`.

**Invoice table.** Flagged as a structural gap in the corrected audit `[audit1 #3]` and
still listed as outstanding at the last checkpoint — "one quotation cannot produce
multiple invoices (no invoice table yet)" `[dev2 #183]`.

**Team page role dropdown missing `sales_coordinator` and `marketing`.** Reported fixed in
Phase 1 `[dev2 #17]`, then listed again as an outstanding red-priority item on 31 May
`[dev2 #185]`. No transcript step resolves the contradiction.

**Supabase anon key rotation.** See §4.1 — never confirmed done by the user.

**Deferred by the user themselves,** discussed with an explicit "later" and no build:
- marketing module expansion — "later will be expandded in a makreting system" `[dev2 #72]`
- financial analytics integration — "maybe another inegration in the future for financial
  anaylsis" `[dev2 #72]`

**Listed as future work at the last checkpoint, never started:** Sentry error tracking, a
staging Supabase project and Vercel branch, mobile-first rep redesign, Arabic UI / RTL
toggle, and dropping the legacy `projects.next_follow_up`, `projects.company_name` and
`activities.rep_name` columns `[dev2 #183]`.

---

## 4. UNVERIFIED — assistant assertions the user never confirmed

### 4.1 Asserted as fact, never confirmed

**"Rotated anon key ✅".** Listed as a completed Phase 1 item `[dev2 #17]` and repeated in
the four-phase completion summary — "Supabase anon key rotated" `[dev2 #71]`. The user
never stated they rotated it. The same assistant later contradicts itself, listing
"Rotate Supabase anon key — it's been shared in AI sessions repeatedly" as an immediate
red-priority outstanding item `[dev2 #185]`. The assistant had noted at the outset that
this was a manual step it could not perform `[dev2 #1]`.

**The `@technopanel.com.sa` email restriction on account creation.** Introduced in the
Create User API route — `if (!email.endsWith("@technopanel.com.sa"))` reject with 403
`[dev2 #119]`. The user never stated this rule.

**The full 40-file documentation set** `[dev2 #187]` through `[dev2 #207]`, 5 May 31 –
6 Jun. Across that entire stretch the user's every message was the same sentence: "You
stopped due to limitations, continue from where you stopped" `[dev2 #188, #190, #192,
#194, #196, #198, #200, #202, #204, #206]`. No content in those 40 files was reviewed,
corrected or approved. This includes the claimed "28 numbered rules", the access matrix,
the five workflow documents and the three AI-context files.

**The Phase 6 "current state" document** `[dev2 #183]` — completed-features list, table
inventory, dropdown canonical values, RLS summary, nine-item tech-debt register and
"Instructions for Future AI". Presented as authoritative; the user replied "File: …" with
uploads `[dev2 #184]` and then "STOP ANALYZING. START GENERATING." `[dev2 #186]`. Never
verified.

**The audit reconciliation table** `[dev2 #185]` — nine audit findings marked "already
fixed" against specific phases. Never verified by the user, and it contains the anon-key
self-contradiction above.

**Assistant-chosen vocabularies with no user statement behind them.** The user specified
company type, source, class, FR, supplier code, thickness, width and services. These
others appear only in assistant output:
- branch seed list — Riyadh (Central), Eastern Branch (East), Southern Branch (South)
  `[dev1 #5]`
- region list — Central, West, East, North, South, Foreign `[dev2 #183]`
- interaction types — Visit, Call, WhatsApp, Email, Meeting, Site Visit `[dev2 #183]`
- loss reasons — Price, Competitor, Timeline, No Budget, Specification Mismatch, No
  Response, Other `[dev2 #183]`
- quotation statuses — pending, submitted, won, lost, expired, cancelled `[dev1 #5]`
- project stages as an eight-value list `[dev2 #24]` (the user did quote this list back
  from the database, but as a query result, not as a decision)
- junction roles `primary` / `shared` `[dev1 #5]`
- notification `type` enum values `[dev1 #5]`
- the 14-day staleness threshold in `stale_projects` `[dev2 #24]`
- `language_pref` on `reps` `[dev1 #5]`

**"super_admin = manager access, cannot be changed via UI"** `[dev2 #183]` — stated as a
rule for future work. The user asked for the opposite capability (self role-switching)
`[dev2 #72]`.

### 4.2 Proposed, not contested

Delivered work the user neither verified nor objected to. The user's next message is
given verbatim.

| Work | Delivered | User's next message |
|---|---|---|
| Phase 1.1–1.7 — the seven "critical fixes" | `[dev2 #1–#17]` | "next phase" / "start phase 2" |
| Phase 3.1f — holiday & absence UI on the Team page | `[dev2 #51]` | "next phase" `[dev2 #52]` — later reported broken `[dev2 #72]` |
| Phase 4.1 — schema updates | `[dev2 #65]` | "next phase" `[dev2 #66]` |
| Phase 4.5d — hide auto-numbering codes from the UI | `[dev2 #89]` | "Next phase" `[dev2 #90]` |
| Phase 4.5j — project history UI | `[dev2 #125]` | "Next" `[dev2 #132]` |
| Phase 5b — manager activities rework | `[dev2 #173]` | "next phase" `[dev2 #174]` |
| Phase 5c — `/dashboard/performance` | `[dev2 #175]` | "next phase" `[dev2 #176]` |
| Phase 5d — `/dashboard/followups` | `[dev2 #177]` | file upload about an unrelated Gemini build fix `[dev2 #178]`, then "Next phase" `[dev2 #180]` |
| Phase 5e — bulk company CSV import | `[dev2 #181]` | "next phase" `[dev2 #182]` |
| Phase 6 — schema cleanup SQL + context rewrite | `[dev2 #183]` | file uploads `[dev2 #184]`, then "STOP ANALYZING. START GENERATING." `[dev2 #186]` |

For contrast, the phases the user *did* confirm in words: 2.4 `[dev2 #30]`, 3.1a
`[dev2 #42]`, 3.1b `[dev2 #44]`, 3.1c `[dev2 #46]` (pasted the function body back), 3.1d
`[dev2 #48]`, 3.1e `[dev2 #50]`, 4.5b `[dev2 #84]`, 4.5c `[dev2 #88]`, 4.5h `[dev2 #118]`
"worked", 4.5j table `[dev2 #122]` "Success", 4.5k `[dev2 #124]` "Success", 4.5l
`[dev2 #130]` "Done", RLS insert fixes `[dev2 #156]` "worked", quotation visibility
`[dev2 #172]` "worked".

---

## 5. Assistant restatements of unrecoverable user input

The content below derives from real user input — the attachments at `[dev1 #2]`,
`[dev1 #4]` and `[audit1 #2]` — that the export did not preserve. It ranks above ordinary
assistant output because the user did say something here, but the wording is the
assistant's and cannot be checked. Each item is a yes/no question.

**Architecture and naming**

1. Was renaming the `customers` table to `companies` your decision? `[dev1 #5]`
2. Is COMPANY the root entity, with contacts, projects, activities and quotations all
   hanging off it? `[dev1 #3]`
3. Did you ask for the `shared_with` text column to be replaced by `company_reps` /
   `project_reps` junction tables? `[dev1 #3]`
4. Are the three branches Riyadh (Central), Eastern (East) and Southern (South)?
   `[dev1 #5]`
5. Did you correct the company-type values "Real State" → "Real Estate" and "Station
   Managment" → "Station Management"? `[dev1 #5]`

**Access and ownership**

6. Is a rep's activity always private to that rep, even on a company shared with another
   rep? `[dev1 #5]`
7. On a shared company, do both reps see the company record itself? `[dev1 #5]`
8. Are deletes of companies, contacts and projects restricted to the manager — with reps
   able to edit but never delete? `[dev1 #5]`
9. Does `marketing` register leads but never see activities, quotations or other reps'
   data? `[dev1 #3]`
10. Does `sales_coordinator` see all companies and projects read-only, but not rep
    activity detail? `[dev1 #3]`
11. When a rep registers a company, do they automatically become its primary rep?
    `[dev1 #5]`

**Quotations and invoices**

12. Is `sales_coordinator` the only role that may *create* quotations, with reps
    read-only? `[audit1 #3]`
13. Do coordinators also enter invoice records? `[audit1 #3]`

**Daily report**

14. Do reps manually enter `sqm_done` and `sqm_expected` on the daily report by design,
    rather than having them derived? `[audit1 #3]`
15. Should activity SQM and invoiced SQM always be treated as separate metrics and never
    combined? `[dev2 #183]`

**Operations**

16. Are Friday and Saturday the weekend for all scheduling logic? `[dev1 #5]`
17. Are all notifications in-app only, with no WhatsApp or email? `[dev1 #5]`
18. Is `loss_reason` meant to be *required* whenever a project stage is set to Lost?
    `[audit1 #3]`
19. Should marketing-registered companies require manager approval before becoming
    active? `[audit1 #3]`
20. Is the CRM meant to stay a sales-operations tool rather than grow into an ERP —
    "a focused sales operations CRM with scalable bones, not a premature ERP"?
    `[dev1 #3]`
