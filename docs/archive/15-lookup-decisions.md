# 15 — Lookup Decisions (lead sources, cities, region, controls)

Answers given by the founder while preparing Slice 2. Slice 1 shipped with two
lookup tables deliberately empty — `14` recorded that no document listed their
values — and these are the missing decisions, plus the three consequences that
filling them forces.

**Status:** Sections 1–5 and 7 are **[founder]** — user truth. Section 6 is
**[derived]**: it is the schema reading of §2 and §3, not a separate rule.

**Authority:** user truth, alongside `04`, `07`, `08 §A–C`, `11 §1–3`, `12` and
`14`. This is the later statement — where it corrects `14`, this wins.

---

## 1. Lead sources — six values **[founder]**

| English | Arabic |
|---|---|
| Field visit | زيارة ميدانية |
| Direct contact | اتصال مباشر |
| Referral | ترشيح |
| Exhibition | معرض |
| Marketing | تسويق |
| Other | أخرى |

This closes `10 §12`, which accepted the table but named no values, and `14`'s
note that the real lead-source vocabulary was unknown.

---

## 2. "Marketing" is not selectable by a rep **[founder]**

**A lead source can be restricted to some users.** "Marketing" is the first
such value: it means the lead arrived from the marketing team, so a rep
choosing it by hand would be recording something that did not happen.

**This is a flag on the row, not an exception in code.** `lead_sources` gains
`rep_selectable boolean`. The rule is:

- **`can_assign` sees every option.** That is the existing flag for people who
  route work to others — marketing, desk reps, managers, super admin
  (`07 A5`, `12 §2`). No new flag, no role name anywhere.
- **Everyone else sees only `rep_selectable` rows.**

**Enforced on the server, not only in the dropdown.** A hidden option that the
form merely omits is not a rule; a rep who posts the id directly must be
refused. The check therefore lives in the data layer, where it holds for every
caller.

### 2.1 An existing non-selectable value is kept, not lost **[founder]**

A rep who opens a company whose lead source is already "marketing" **keeps
it**. The current value stays in their list and re-saves unchanged; only a
*change* to a non-selectable source is refused.

The alternative — showing the rep a list without "marketing" — silently blanks
the lead source of every marketing-originated company a rep ever edits. FACET
does not lose data to a permission rule.

---

## 3. Cities — the full Saudi list, mapped to regions **[founder]**

`cities` is seeded with the Saudi cities and towns, each with an English and an
Arabic name, and each mapped to one value of the `region` enum. This closes
`09 §3.6` and `07 A7`, which called for "a Saudi city lookup" without listing
one.

**Every city inherits the grouping of its administrative region.** Saudi Arabia
has thirteen official administrative regions and `region` has five values, so
the mapping is stated once, per administrative region — never per city. There
are no individually-assigned cities and therefore no one-off exceptions to
audit later.

| Official region | Arabic | `region` |
|---|---|---|
| Riyadh | الرياض | `center` |
| Al-Qassim | القصيم | `center` |
| Tabuk | تبوك | `north` |
| Ha'il | حائل | `north` |
| Al-Jawf | الجوف | `north` |
| Northern Borders | الحدود الشمالية | `north` |
| Eastern Province | المنطقة الشرقية | `east` |
| Makkah | مكة المكرمة | `west` |
| Al-Madinah | المدينة المنورة | `west` |
| 'Asir | عسير | `south` |
| Jazan | جازان | `south` |
| Najran | نجران | `south` |
| Al-Bahah | الباحة | `south` |

Two consequences worth stating, because they shape every regional figure the
business will later read:

- **`east` is a single administrative region.** Dammam, Dhahran, Al Khobar,
  Jubail, Al Ahsa and Hafar al-Batin all land in one bucket.
- **`north` and `south` are four regions each**, so they spread across many
  more rows than their share of revenue is likely to justify.

Neither is a problem to fix — `07 A7` says region is a label, never an access
boundary (`04 Q4`) — but a report that ranks regions is ranking units of very
different size.

---

## 4. Region is derived from the city **[founder]**

Once a city knows its region, asking a human for the region is asking for
something the system already knows — which `CLAUDE.md`'s first design
principle forbids.

- **A city is chosen** → region comes from `cities.region`. The interface shows
  it, read-only. It is not a question any more.
- **No city is chosen** → region stays manually selectable, exactly as before.
  A record can be placed in a region before anyone knows the town.

**This changes `companies.region` and `projects.region` from independent fields
to derived-when-a-city-is-set.** They are not dropped, and this is not a schema
change:

- The column records the region **as written at the time**. If the grouping
  above is ever re-drawn, history keeps saying what it said, which is the same
  reason targets and shares are dated rows rather than mutable fields.
- `10 §7` keeps a region on `users` for the rep's own base, which is a
  different question from where a site is, and is untouched here.

**Derivation happens in the data layer, not in the form.** A form that fills a
field in JavaScript is a suggestion; the rule has to hold for a caller that
never rendered a form.

---

## 5. The city control becomes a searchable combobox **[founder]**

**This reverses `14`'s "native `<select>`, no Radix" decision — for the city
field only.** The reason is §3: a native dropdown of roughly two hundred cities
is unusable. You cannot type ahead reliably, and on a phone it is a scroll
through a list nobody can skim.

**Everywhere else the native select stays.** Categories, lead sources, regions,
warmth, end states and project roles are short lists where `14`'s reasoning
still holds exactly as written — no client state, no hidden-input bridge, no
JavaScript needed to submit, and correct RTL popup placement for free.

Two honest costs, recorded rather than discovered later:

- **The city field now needs JavaScript.** The native select did not. Nothing
  else in the forms does yet.
- **It posts through a hidden input.** The value still arrives at the server
  action as ordinary form data, so no action changed — but the control is no
  longer the browser's.

**No new dependency was added.** `radix-ui` was already in `package.json` for
the direction provider and ships `Popover`; the combobox is built on it.

---

## 6. Schema change required — migration 0004 **[derived]**

Two columns, both additive:

1. **`lead_sources.rep_selectable boolean not null default true`** — §2. The
   default is `true` so the column describes the ordinary case and marketing is
   the single exception, which is what §2 says. A lead source added later is
   selectable unless someone says otherwise.

2. **`cities.region region not null`** — §3. `not null` because §3 maps *every*
   city; a city with no region would be a row §4 cannot derive from. The table
   has never been seeded, so there is nothing to backfill.

Nothing else changes. §4 needs no migration — `companies.region` and
`projects.region` already exist and keep their type; only who decides their
value moves.

---

## 7. `scripts/dev-fixtures.ts` refuses to run outside development **[founder]**

The script creates real, loginable accounts. It must never be runnable against
production, and refusing only when `NODE_ENV=production` is set is the weaker
half of that — it passes whenever the variable is simply absent.

**It now requires `NODE_ENV` to be exactly `development`.** The guard is safe to
make that strict because the two environments genuinely differ:

- `.dockerignore` excludes `.env*`, so `NODE_ENV=development` in a developer's
  `.env` never reaches the image.
- `docker-compose.yml` sets `NODE_ENV: production` on the app container as a
  real environment variable, and `process.loadEnvFile` cannot override one that
  is already set.

So the guard passes on a developer's host and fails in the container, which is
the whole intent.

---

## 8. Still open after this document

- **Cross-script duplicate matching** — unchanged from `14 §6`. Phase 10.
- **When fields become required** — unchanged from `14 §6`. Nothing in this
  document makes a field required that was not.
- **Who maintains lookups.** Cities and lead sources are seeded from the
  repository; no screen edits them, and no document asks for one. Adding a
  lead source is a seed-file change and a deploy. `OPEN — not chosen`.
