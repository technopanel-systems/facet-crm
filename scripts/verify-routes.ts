/**
 * Verification scaffolding for the SCREENS — NOT a feature.
 *
 * Every other `verify:*` script drives `src/lib` in process. This one is the
 * other half, and the half `23` records as the one that keeps finding things:
 * it drives every `(app)` route over **HTTP**, as three identities, in both
 * locales, in both themes.
 *
 *   1. Login works, and an anonymous request is redirected.
 *   2. Every route answers 200 for an identity that may see it — and the
 *      identities that may not get 404, not 500.
 *   3. Every archetype's DOM markers are present.
 *   4. Both locales render, and Arabic is `dir="rtl"`.
 *   5. The theme cookie flips the `dark` class, and an unknown value is dark.
 *   6. The 404 screen, and the handover gate behind one.
 *   7. Marking a project lost replays, in both locales `S29` `S43` — the form
 *      POST whose writer and whose database CHECK shipped in one pass, and
 *      which nothing else drives.
 *   8. The chain strip `D27` `D29` renders on a quotation thread AND on the
 *      project behind it, in both locales.
 *   9. The comment box `S114` `D48` posts for real, on a project this section
 *      registers, and its cap refuses rather than 500s — the one assertion of
 *      `readFields`' shape validation anywhere, because no in-process script
 *      crosses the action boundary. `walkRecords` asserts the other half: the
 *      two screens that take a comment offer the box and the three that no
 *      longer do render none.
 *  10. The sharing panel `S96` `S99` `S100` grants and revokes for real, and
 *      the rep who may not share is not offered the form.
 *  11. The next follow-up date `D34` `25 §18` is set and cleared for real, over
 *      HTTP, in both locales — the manual date that outranks the automatic
 *      clock, replayed the same way section 7 replays a lost project. Section
 *      19 drives the same act from a waiting-list row.
 *  12. No screen renders anything shaped like an unresolved message key.
 *  13. Registering a company replays `S13`, `S14`, `S15`: a POST with no phone
 *      is refused as a message rather than a 500; no form asks for a region at
 *      all; and the same payload sent twice — differing only in country — is
 *      REFUSED for Saudi Arabia, which needs a city, and accepted with neither
 *      city nor region for anywhere else.
 *  14. `S50` and `S74`, end to end: a quotation is raised **creating its
 *      project as part of raising**, which puts the quotation's company on
 *      that project as a participant `S27` carrying a dispatched figure `S26`
 *      once it is dispatched. A raise naming NEITHER a project nor a name is
 *      refused as a message — 303 is no longer the answer. Then the same
 *      company's second quotation, raised **onto that existing project**, which
 *      is the other half of `S50`. Dispatching takes the project the quotation
 *      already names, and naming a different one is refused as a message.
 *      `S118` rides along on the same form: the stock is posted, refused when
 *      cleared, and read back off the detail screen in both locales.
 *
 *      It also drives `S73`'s **cancellation** and `S62`'s **rejection with a
 *      reason**, both of which are POSTs no in-process script can reach: the
 *      empty-reason path must answer 200 with a field error rather than a 500,
 *      the reason must round-trip onto the record, and a cancelled dispatch
 *      must offer nothing further — *never revived*.
 *
 *      Since `S126` the thread is **issued** in the middle of that chain, and
 *      the POST that used to work before it is driven as a refusal instead —
 *      a paid but unissued quotation is not offered, and a hand-made POST
 *      naming it comes back as a message on the quotation field. `S116` rides
 *      along too: the form posts real product lines and offers no square-metre
 *      input at all, and the dispatch screen renders the lines it landed.
 *
 *  15. `S76` on the screens: the coordinator's `/projects` and `/contacts` are
 *      no longer empty, and neither carries a control they may not use — no
 *      New button, no edit link, no composer, no follow-up panel. Every one of
 *      those is asserted against the manager on the same path, so a screen
 *      that failed to render its own controls cannot pass as a permission
 *      working. Sections 2 and 3 carry the route half: the two `new` forms and
 *      the two edit routes answer 404 for that identity and 200 for the others.
 *
 *  17. **Every `useActionState` form answers a raw POST at all**
 *      (`WORKFLOW §5`). Eight of them wrote their row and then never sent
 *      response headers — 303 seconds and no reply on the one measured to the
 *      end. Every other section asserts what a POST *did*, which is why this
 *      survived from session 4: the write always landed. Each POST here
 *      carries an abort, so a hang is a named failure rather than a stalled
 *      run, and each takes the refusal path where the form has one, so a
 *      stall cannot be blamed on a successful write.
 *  19. **The dashboard** — `D33`'s four tiles over six conditions, linked by
 *      group so a tile showing N lands on a list of N; `D34`'s two sections,
 *      its kind mark and its Plan control, driven for real from a row and then
 *      cleared so the walk leaves the dataset where it found it; and `D65`'s
 *      Requests block asserted ABSENT for the rep and the manager and present
 *      with both columns for the coordinator. Walked as all three identities
 *      in both locales, because a flag-gated block is only ever wrong for the
 *      identity nobody drove.
 *
 *  22. **The projects board** `D28` `D29` — `/projects` with no parameter is
 *      the board and `?view=table` the table; all six chain positions render
 *      in `CHAIN_COLUMNS` order, **read out of `src/lib/chain.ts` rather than
 *      copied here**, with an empty one still drawing its zero; the column
 *      counts add up to the board's own total and **every card is in the DOM**,
 *      which is what separates `D29`'s scrolling column from `D70`'s cap;
 *      nothing carries a drag affordance and the card texture is worn six
 *      times, once per column, never by an item `D21`; the view chip carries
 *      the search `D59`; the table's stale rows come first `D25`; the owner
 *      column is absent for a rep and present for a manager `D2`; and in
 *      Arabic the DOM order is **identical** to English, because the mirror is
 *      CSS `D57`.
 *
 *  24. **The dispatches list and detail** `D25` `D26` `D66` `S77` — the list
 *      is grouped into `DISPATCH_GROUPS`' three piles, **read out of
 *      `src/lib/dispatches.ts` rather than copied here**; each pile is a
 *      contiguous run, its header's count is the whole scope's and the three
 *      sum to the card's own total; every row's `data-status` agrees with the
 *      pile it landed in, which is what catches the one map that orders the SQL
 *      drifting from the one that labels the row. No refused request is in the
 *      working list `S122` and the archive chip reaches them. The lead cell is
 *      asserted **by position** — `data-lead="sqm"` is the first `<td>` of
 *      every row `D26` — and the difference badge is asserted **absent**
 *      `D66`. One linked dispatch and one free entry are picked off the list by
 *      their own marker and driven **together**: the comparison card renders on
 *      the first and is absent on the second, because a card that never
 *      rendered would pass the absence check alone. The payment sentence on an
 *      unapproved request `S73`, the rep column blank on the reader's own rows
 *      `D2`, and in Arabic the DOM order is identical to English `D57`.
 *
 *  25. **The stream** `D45` `D30` `D3` — `/activity` with no parameter is
 *      the stream; `?view=by-rep` is the same events counted. The three kinds
 *      partition it exactly, which is the one assertion that can tell *one
 *      query, three arrangements* from three screens that agree by accident.
 *      A field note is found IN it, which is what closes `D3`.
 *
 *  26. **Auto-refresh** `D72` `D20` `D73` — the notice's transport is on the
 *      five screens that carry one, in both locales, and **no line is drawn**,
 *      because this walk executes no script. The count route is then driven
 *      directly and bracketed: a `since` in the future answers 0, and a `since`
 *      at the epoch answers **the screen's own stated total** — which is what
 *      proves the route's `where` is the list's `where`, and the one assertion
 *      that fires on a stamp resolving against the wrong table (`CLAUDE.md`:
 *      returns zero, raises nothing). The coordinator's two columns carry two
 *      different narrowings and each narrows the count. Then one real arrival,
 *      end to end, because neither bracket can tell a correct stamp from a
 *      wrong column that happens to be non-null. `D73`'s five corrected runs
 *      are asserted on the `dir` attribute, which is the same marker in both
 *      locales where the words are not.
 *
 *  29. **The bell carries news only** `S91` `S92` — the two cards the tier
 *      split rendered are asserted ABSENT on `/notifications`, and so is any
 *      entry linking into `/follow-ups`, which was the daily digest's own link
 *      and the one thing on that screen that ever pointed at WORK. Every
 *      negative is guarded on a non-empty read of
 *      `data-slot="notification-entry"` against the card's `data-total`, and
 *      prints what it saw: *no digest card* means nothing on a page that
 *      rendered nothing. This is the `NOT_COMMENTABLE` shape `27b` used for
 *      the screens `S114` narrowed, at a second address — a deletion that
 *      nothing asserts is a deletion that comes back.
 *
 *  23. **Operability** `D20` — for every form this walk reaches, in either
 *      locale, as any of the three identities: each field the screen says its
 *      action requires is present as a **native, focusable control carrying
 *      that name**. A `type="hidden"` input left empty, an `aria-hidden` one,
 *      a `tabindex="-1"` one, a disabled one, or a `role="checkbox"` /
 *      `role="combobox"` element standing where the name should be is a named
 *      failure; every non-required one is printed as a note and becomes a
 *      `WORKFLOW §5` row owned by its screen's session. `§17` already replays
 *      the POST, but it writes the body itself, so it proves the action
 *      answers and never that a person could have produced the body. This is
 *      that second half, and it is why the two fixes beside it — the checkbox
 *      primitive and the city field — had to land in the same slice.
 *
 * Section 18 — `D69`'s two controls and `D32`'s panel — is in the code and was
 * never in this list either; 19 is listed the day it is written. Sections 20
 * and 21 — the companies list and the company detail — are the same omission;
 * 22 is listed the day it is written.
 *
 * This was 11 sections until feature slice 6: the old item 11 (the
 * message-key scan) is now section 12, and section 11 above — the
 * follow-up-date replay — existed in the code for a phase but was never
 * added to this list. Not a renumbering; a correction `[26 §4]`.
 *
 * Section 16 — a rep raising a dispatch and the coordinator refusing it — is
 * likewise in the code and not in this list. 17 is listed the day it is
 * written; 16 belongs to whoever next touches it.
 *
 * **Sections 13 and 14 sit after the key scan.** Section 12 is written to
 * cover everything fetched before it, and section 12 keeps the number
 * `CLAUDE.md` gives it. Every string 13 renders is already on a page sections
 * 2 and 3 fetched, so nothing is lost there. Section 14 is not in that
 * position — the project picker and its two hints render only for a
 * project-less quotation, which no earlier section can reach — so it scans
 * for itself, asserting that the leak map it inherited has not grown by the
 * time it finishes.
 *
 * Section 0 runs before all of them, and refuses a server that booted before
 * the build — the hole every one of the above passed straight through `[23]`.
 *
 * **Section 30 is the one section that is not pure HTTP**, and it is the only
 * check in the tree that touches the auth bridge `CLAUDE.md`. It signs in as a
 * throwaway account it creates, reads the `sessions` row its cookie names,
 * proves the live session renders a real page, deactivates through the real
 * screen, and asserts the very next request is refused `S101`. Two SELECTs;
 * every write goes over HTTP. See the note at the `@/db` import for why the
 * black-box property was spent, and `WORKFLOW §5` `S44-1` for what it replaces.
 *
 * **It replaces a script stage 1 wrote and threw away** `[23]`. A restyle that
 * 500s a screen is the redesign's failure mode, and the four checks cannot see
 * it: `typecheck` passed while a client component imported a data module, and
 * a green suite once sat beside a 500 on every company detail page.
 *
 * Usage:
 *   npm run build && npm run start          # production build, NOT `next dev`
 *   DEV_FIXTURE_PASSWORD=… npm run verify:routes
 *
 * Needs `npm run db:seed` and `npm run dev:fixtures` first. Point it elsewhere
 * with `VERIFY_BASE_URL`. **`DATABASE_URL` must name the same database the
 * server is using** — section 30 reads the `sessions` table the login it just
 * performed wrote to, so two different databases would fail it for a reason
 * that is not the bridge.
 *
 * **Assert on DOM markers, never on translated strings** `[23]`: next-intl
 * ships the whole catalogue to every page, so a string grep proves nothing —
 * it matches the message bundle whether or not the screen rendered it.
 *
 * **Assert the 200, not merely the absence of a 500** `[23]`. Two of stage
 * 1's "failures" were wrong expectations rather than bugs: a manager 404s on
 * a report's edit screen, because only the author may edit `S39`; and a rep's
 * empty lists yield no id to follow, which is a legitimate empty state rather
 * than a broken link. The third — `/dispatches/new` 404ing for a rep and a
 * manager — **stopped being true with `S72`**, which is now `FORBIDDEN`'s own
 * note.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";

/**
 * **This script was pure black-box HTTP, and §30 breaks that deliberately.**
 *
 * Every other section reaches the app the way a browser does and imports
 * nothing from `@/`. §30 asks a question no browser can answer — *did signing
 * in create a database session row?* — and that is the bridge itself rather
 * than a proxy for it. A cookie that merely LOOKS like a uuid is the proxy;
 * the row is the thing `CLAUDE.md`'s auth-bridge clause is about.
 *
 * **Four names, and the boundary is deliberate.** `db` is used for two SELECTs
 * and nothing else — §30 does every WRITE over HTTP, through the real
 * `/users/new` and `/users/[id]` forms, so the walk still drives screens.
 * `@/lib/authz` is NOT imported: `createUser` and `deactivateUser` would have
 * pulled the whole data layer in and skipped the screens a manager actually
 * uses `S101`.
 *
 * **What it costs at module scope: nothing, and that was run rather than
 * read.** `@/env`'s variables are lazy getters and `@/db` opens its pool on
 * first use, so importing these with BOTH `AUTH_SECRET` and `DATABASE_URL`
 * absent loads the graph, throws nothing and opens no connection — measured
 * before this was written. `@/db` never reaches `src/auth/index.ts`, so no
 * secret is demanded. What is spent is the property, not startup behaviour.
 */
import { eq } from "drizzle-orm";

import { closeDatabase, db } from "@/db";
import { sessions, users } from "@/db/schema";

process.loadEnvFile(".env");

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const PASSWORD = process.env.DEV_FIXTURE_PASSWORD;

let failures = 0;
let checks = 0;

function check(label: string, condition: boolean, detail = ""): void {
  checks += 1;
  if (condition) {
    console.log(`  ok    ${label}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
}

/* ── Nothing may read like a key that failed to resolve ───────────────────── */

/**
 * **This is not asserting on translated strings.** The rule stands: next-intl
 * ships the whole catalogue to every page, so grepping for *"Quotation
 * requested"* proves the message bundle exists and nothing about whether the
 * screen rendered it `[23]`, `S113`. Nothing here looks for a translation.
 *
 * It looks for the **shape of an unresolved key** — `chain.step.new`,
 * `projects.chain.title`, `common.none` as *visible text* — which is what
 * next-intl renders when a lookup fails, and which is exactly what a stale
 * server produced while every marker assertion passed. A marker assertion
 * cannot see it: `data-slot="chain-strip"` was correct on a page whose six
 * labels were raw keys.
 *
 * **The pattern is built from the catalogue's own top-level keys**, not
 * guessed, so it cannot drift from the namespaces that exist. A word that is
 * not a namespace cannot begin a match, and a namespace needs a dot and a
 * segment straight after it — so ordinary prose ("…on the team. Next…", with
 * its space) never matches.
 */
const NAMESPACES = Object.keys(
  JSON.parse(readFileSync("messages/en.json", "utf8")) as Record<
    string,
    unknown
  >,
);
const KEY_SHAPE = new RegExp(
  `\\b(?:${NAMESPACES.join("|")})(?:\\.[A-Za-z0-9_]+)+`,
  "g",
);

/** Every key-shaped string seen as visible text, against where it first was. */
const leaked = new Map<string, string>();

function scanForUnresolvedKeys(path: string, body: string): void {
  if (!body.includes("<html")) return;
  const visible = body
    // **Script blocks go first, whole.** The flight payload carries the entire
    // message catalogue as JSON — every key in the file, in a string — so a
    // scan that only stripped tags would match all 699 of them on every page.
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    // A space, not nothing: `<b>team</b>.<i>x</i>` must not become `team.x`.
    .replace(/<[^>]+>/g, " ");

  for (const [match] of visible.matchAll(KEY_SHAPE)) {
    if (!leaked.has(match)) leaked.set(match, path);
  }
}

/* ── D20's operability scan ───────────────────────────────────────────────── */

/**
 * **Can a person actually produce the body this form posts?**
 *
 * `D20`'s enforcement paragraph. Every one of this walk's other checks is
 * already a scripts-off check — it fetches HTML and executes nothing — so the
 * half that was missing was never *rendering*, it was **operability**: a
 * control can render and do nothing. `§17` replays each POST, but it writes
 * the body itself, so it proves the action answers and never that a person
 * could have produced the body. This is that second half.
 *
 * **The test, per form, per field name.** A field is operable when something
 * carrying that `name` is a native control a person can reach: an `<input>`
 * whose type is not `hidden`, a `<select>` or a `<textarea>`, not `disabled`,
 * not `aria-hidden`, not at `tabindex="-1"`.
 *
 * **Two things are deliberately NOT failures.**
 *
 *  - **A hidden input carrying a real value.** That value is the server's, not
 *    the person's — a company handed in by URL and shown as text rather than
 *    asked for — and there is nothing for anybody to fill. What fails is a
 *    hidden input that is **empty**, because then the field cannot be given a
 *    value at all. That is exactly the `Combobox` shape session 40 deleted,
 *    and exactly `S15`'s unregisterable Saudi company.
 *  - **A role attribute by itself.** `role="checkbox"` / `role="combobox"` is
 *    not a defect; a native control may legitimately carry one. It is named in
 *    the detail only where a role-bearing element is among the ONLY things
 *    carrying that field's name, which is when it is standing in for it.
 *
 * **What counts as required is the screen's own declaration**, not the
 * action's signature: `FormField` emits `data-required` beside `data-field`,
 * and a native carrier may say `required` itself. A required field that fails
 * is a **named failure**; every other failing field is printed as a **note**
 * and becomes a `WORKFLOW §5` row owned by its screen's session. A form built
 * without `FormField` is still scanned — the name-carrier test needs no marker
 * — but nothing in it can be *required*, so its findings are notes.
 *
 * Hooked into `get()`, the one choke point `scanForUnresolvedKeys` already
 * uses, so every page the walk reaches is covered at no extra fetch.
 */
type Operability = {
  route: string;
  form: string;
  field: string;
  detail: string;
  required: boolean;
};

const operability = new Map<string, Operability>();
let formsScanned = 0;
let routesScanned = 0;

/** `/en/projects/<uuid>/edit` → `/:locale/projects/:id/edit`, so one defect on
 *  one screen is one finding rather than one per identity per locale. */
function routeShape(path: string): string {
  return path
    .replace(/\?.*$/, "")
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ":id")
    .replace(/^\/(en|ar)(?=\/|$)/, "/:locale");
}

function attrIn(tag: string, name: string): string | null {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? null;
}

/**
 * A boolean attribute — `disabled`, `required` — by NAME, with every attribute
 * VALUE stripped first.
 *
 * **Not a plain search over the tag**, which is what this was for one run and
 * why 16 of its notes were wrong: `checkbox.tsx` carries the Tailwind class
 * `group-has-disabled/field:opacity-50`, so a scan of the whole tag found
 * `disabled` inside the class string and read every checkbox in the product as
 * a disabled control — burying the ONE genuinely disabled control on the walk
 * under fifteen inventions of it. Stripping `="…"` leaves attribute names
 * only, and the lookahead stops `data-disabled` passing for `disabled`.
 */
function hasFlag(tag: string, name: string): boolean {
  const names = tag.replace(/="[^"]*"/g, "=");
  return new RegExp(`(?:^|\\s)${name}(?=[\\s=>/]|$)`).test(names);
}

function scanOperability(path: string, body: string): void {
  if (!body.includes("<html")) return;
  const route = routeShape(path);
  routesScanned += 1;

  for (const [index, match] of [
    ...body.matchAll(/<form\b[\s\S]*?<\/form>/g),
  ].entries()) {
    const form = match[0];
    const open = form.slice(0, form.indexOf(">") + 1);
    formsScanned += 1;
    const formKey =
      attrIn(open, "data-act") ?? attrIn(open, "data-slot") ?? `form-${index}`;

    // `FormField`'s markers: which fields this screen says its action needs.
    const declaredRequired = new Set<string>();
    for (const field of form.matchAll(/<div[^>]*\bdata-field="([^"]+)"[^>]*>/g)) {
      if (hasFlag(field[0], "data-required")) {
        declaredRequired.add(field[1]);
      }
    }

    // Every element carrying a posted name, grouped by that name.
    const carriers = new Map<string, string[]>();
    for (const tag of form.matchAll(/<[a-z]+\b[^>]*\bname="[^"]*"[^>]*>/gi)) {
      const name = attrIn(tag[0], "name");
      // The server-action envelope is not a field anybody fills.
      if (!name || name.startsWith("$ACTION")) continue;
      carriers.set(name, [...(carriers.get(name) ?? []), tag[0]]);
    }

    const record = (field: string, detail: string, required: boolean): void => {
      const key = `${route}|${formKey}|${field}`;
      if (operability.has(key)) return;
      operability.set(key, { route, form: formKey, field, detail, required });
    };

    for (const [field, tags] of carriers) {
      const usable = tags.some((tag) => {
        const element = tag.match(/^<([a-z]+)/i)?.[1].toLowerCase() ?? "";
        if (!["input", "select", "textarea"].includes(element)) return false;
        if ((attrIn(tag, "type") ?? "").toLowerCase() === "hidden") return false;
        if (/\baria-hidden="?true"?/.test(tag)) return false;
        if (attrIn(tag, "tabindex") === "-1") return false;
        if (hasFlag(tag, "disabled")) return false;
        return true;
      });
      if (usable) continue;

      // A hidden input carrying a real value is the server's answer, not a
      // question anybody was asked. Empty is the broken case.
      const filled = tags.some(
        (tag) =>
          (attrIn(tag, "type") ?? "").toLowerCase() === "hidden" &&
          (attrIn(tag, "value") ?? "") !== "",
      );
      if (filled) continue;

      const detail = tags
        .map((tag) => {
          const element = tag.match(/^<([a-z]+)/i)?.[1].toLowerCase() ?? "?";
          const role = attrIn(tag, "role");
          if (role) return `<${element} role="${role}">`;
          if ((attrIn(tag, "type") ?? "").toLowerCase() === "hidden") {
            return `<input type="hidden" value="">`;
          }
          if (/\baria-hidden="?true"?/.test(tag)) return `<${element} aria-hidden>`;
          if (attrIn(tag, "tabindex") === "-1") return `<${element} tabindex="-1">`;
          if (hasFlag(tag, "disabled")) return `<${element} disabled>`;
          return `<${element}>`;
        })
        .join(" + ");

      record(
        field,
        detail,
        declaredRequired.has(field) ||
          tags.some((tag) => hasFlag(tag, "required")),
      );
    }

    // A field the screen says the action needs, that NOTHING posts at all.
    for (const field of declaredRequired) {
      if (carriers.has(field)) continue;
      record(field, "no element carries this name", true);
    }
  }
}

/* ── A cookie jar, because a session is a cookie ──────────────────────────── */

type Jar = Map<string, string>;

function store(jar: Jar, response: Response): void {
  // `getSetCookie` keeps the headers separate; a joined `get` would split a
  // cookie whose value contains a comma.
  for (const raw of response.headers.getSetCookie()) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    if (eq < 1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (value === "" || /expires=Thu, 01 Jan 1970/i.test(raw)) {
      jar.delete(name);
      continue;
    }
    jar.set(name, value);
  }
}

function header(jar: Jar): string {
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function get(
  jar: Jar,
  path: string,
): Promise<{ status: number; body: string; url: string }> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { cookie: header(jar) },
    redirect: "manual",
  });
  store(jar, response);

  // Follow one redirect by hand so the final status is the page's, not 307's.
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (location) {
      const next = location.startsWith("http")
        ? location.slice(BASE.length)
        : location;
      const followed = await fetch(`${BASE}${next}`, {
        headers: { cookie: header(jar) },
        redirect: "manual",
      });
      store(jar, followed);
      const body = await followed.text();
      scanForUnresolvedKeys(next, body);
      scanOperability(next, body);
      return { status: followed.status, body, url: next };
    }
  }
  const body = await response.text();
  // **Every page this script touches is scanned**, rather than a chosen few:
  // the fetch is the one choke point, and the failure it guards against does
  // not announce itself on the screen you thought to check.
  scanForUnresolvedKeys(path, body);
  scanOperability(path, body);
  return { status: response.status, body, url: path };
}

/* ── Login ────────────────────────────────────────────────────────────────── */

/**
 * The credentials callback, not the login screen's server action.
 *
 * The action is reachable too, but it needs the `$ACTION_` envelope scraped
 * off the page — and those inputs carry **no `value` attribute** `[23]`, so a
 * scraper that requires one drops them and Next answers "Failed to find Server
 * Action". The callback endpoint needs only the CSRF token.
 */
async function login(email: string): Promise<Jar> {
  const jar: Jar = new Map();

  const csrfResponse = await fetch(`${BASE}/api/auth/csrf`);
  store(jar, csrfResponse);
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };

  const response = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: header(jar),
    },
    body: new URLSearchParams({
      csrfToken,
      email,
      password: PASSWORD as string,
      callbackUrl: `${BASE}/en`,
    }),
    redirect: "manual",
  });
  store(jar, response);
  return jar;
}

/* ── Routes ───────────────────────────────────────────────────────────────── */

/** Every `(app)` route that needs no id. */
const STATIC_ROUTES = [
  "/",
  "/companies",
  "/companies/new",
  "/contacts",
  "/contacts/new",
  "/projects",
  "/projects/new",
  "/quotations",
  "/quotations/new",
  "/dispatches",
  "/dispatches/new",
  // `/reports` went with `D45` in session 27 — *"what happened" is one
  // stream*, and `/activity` is it. `/reports/new` and `/reports/[id]` stay:
  // they are `S32`'s log form and `D47`'s note, not a list.
  "/reports/new",
  "/activity",
  "/follow-ups",
  "/notifications",
  "/targets",
  "/users",
  "/users/new",
] as const;

/**
 * Routes a given role legitimately does NOT have. Asserting only the 404 would
 * pass on a broken route, so every one of these is asserted as a 200 by the
 * identity that does hold it.
 */
const FORBIDDEN: Record<string, readonly string[]> = {
  // **`/dispatches/new` came off both of these lists** `S72`. *A rep requests
  // a dispatch* — the screen used to 404 for everyone without `can_dispatch`,
  // which was the whole act being behind the flag. What is behind it now is
  // approving, which lives on a request's own screen and is asserted in §15.
  "rep-a@example.test": ["/users", "/users/new"],
  "manager@example.test": [],
  // **`/projects/new` and `/contacts/new` came off this list**, and the reason
  // is the same one section 15 records at the New button. Both records need a
  // company `S27` `[07 A2]`, so the form 404s for an identity holding none —
  // which every coordinator was, until `seed:demo` gave her the book `S9`
  // names her as a recipient of and `S127` needs her to have. The 404 was a
  // property of the fixtures, never of the role, and asserting it here made a
  // rule-legal dataset read as a broken screen. The walk now asserts the 200,
  // and section 15 asserts the button and the route agree either way.
  //
  // `S76` is untouched by this: it says she may not **edit** a project or a
  // contact, and the READ_ONLY walk below still holds her to that on every
  // record she can see.
  "coordinator@example.test": ["/users", "/users/new"],
};

/**
 * Records an identity may READ but not act on `S76`.
 *
 * The coordinator sees every project and contact and writes to neither, so on
 * those two sections the edit route answers 404 and no composer is offered.
 * Keyed by email like `FORBIDDEN` above, and for the same reason: the other
 * two identities assert the 200 and the composer on the very same paths, so
 * neither half of the claim can pass on its own.
 */
const READ_ONLY: Record<string, readonly string[]> = {
  "coordinator@example.test": ["projects", "contacts"],
};

/** The first id a list page links to, or null when the list is empty. */
function firstId(body: string, section: string): string | null {
  const pattern = new RegExp(
    `href="/(?:en|ar)/${section}/([0-9a-f-]{36})"`,
    "i",
  );
  return body.match(pattern)?.[1] ?? null;
}

/**
 * The archetype markers.
 *
 * **Asserted for the manager only.** `sees_all_reps` is the one identity with
 * rows on every list, and a list card absent for someone else is the empty
 * state working rather than a missing frame — asserting it for everyone turns
 * a correct screen into a red line.
 *
 * `S76` moved the coordinator's line without erasing it: they read projects
 * and contacts in full, so `/projects` and `/contacts` are not empty for them
 * — section 14 asserts that directly.
 *
 * **This note used to say `/companies` still was empty for them, and that is
 * no longer true.** `S9` assigns a company to *a rep, a desk rep, marketing,
 * or the coordinator*, and `S18` makes whoever registers one its primary rep;
 * `seed:demo` exercises that so no `company_reps.origin` is unreachable, and
 * the coordinator holds four. The claim predated that seed. **Section 20
 * asserts the live shape** — scoped, not empty and not everything — so this
 * stays a note about which identity the markers are asserted for, and nothing
 * more.
 */
const MARKERS: Record<string, readonly string[]> = {
  // `D69`'s row renders for everyone whatever flags they hold, so the marker
  // identity is a valid prober for it. The target panel is NOT here: it appears
  // only where a target row exists `D64`, and section 18 asserts it as the rep.
  // `D69`'s row, `D33`'s strip and `D34`'s list all render for everyone
  // whatever flags they hold, so the marker identity is a valid prober for
  // each. `today-queue` and `today-waiting` were the flat queue and the
  // notifications card `D64` called out; both are gone. `today-requests` is
  // deliberately NOT here — `D65`'s block is flag-gated, and section 19
  // asserts it appears for exactly one of the three identities.
  "/": [
    'data-slot="today-counts"',
    'data-slot="today-waiting-list"',
    'data-slot="today-shortcuts"',
  ],
  "/companies": ['data-slot="list-card"', 'data-slot="table-head"'],
  // `D25` — grouped, never flat, and `D26`'s lead cell. `quotation-group` is
  // the header row; `turn` is the lead cell. Both are new in session 26 and a
  // flat list would fail here rather than merely look wrong.
  "/quotations": [
    'data-slot="list-card"',
    'data-slot="quotation-group"',
    'data-slot="turn"',
    // `D24`'s own marker must survive the raiser column — see the note at that
    // `TableHead`. Asserting it here is what would catch a `data-slot` prop
    // overriding the shared component's.
    'data-slot="table-head"',
  ],
  // One name field `S12` — the input is `name`, not a locale-suffixed pair.
  // `countryId` is `S14`; section 13 asserts it sits before the city.
  "/companies/new": [
    'data-slot="form-shell"',
    'name="name"',
    'name="countryId"',
  ],
  "/reports/new": ['data-slot="form-shell"'],
  // `D45` — the filter column, and `D24`'s day groups. Section 25 does the
  // arithmetic; these are the frame.
  "/activity": ['data-slot="stream-filters"', 'data-slot="stream-day"'],
  // `D49` — Targets absorbed `/performance` in `28b`. Three markers became
  // two, and both are claims the merge has to keep true:
  //
  //  - `attainment` is the screen itself. The route survived and the other one
  //    was deleted, so a 200 alone would pass on the wrong one of the two.
  //  - `target-edit` is `AD20`'s answer. `D58` sends the control out of the
  //    cell and `D49` still asks for one PER ROW, so the disclosure must be in
  //    the markup for `can_set_targets`. §23 sees its field with scripts off
  //    and **§17 POSTs the form**, which is the half a marker cannot prove.
  //
  // `data-slot="turn"` went with the coverage table `S88`; §11, §22 and §24
  // assert the turn cell on the three lists that still render one.
  "/targets": ['data-slot="attainment"', 'data-slot="target-edit"'],
};

const MARKER_IDENTITY = "manager@example.test";

async function walk(jar: Jar, email: string, locale: string): Promise<void> {
  const forbidden = new Set(FORBIDDEN[email] ?? []);

  for (const route of STATIC_ROUTES) {
    const path = `/${locale}${route === "/" ? "" : route}`;
    const { status, body } = await get(jar, path || `/${locale}`);
    const expected = forbidden.has(route) ? 404 : 200;
    check(
      `${email} ${locale} ${route} → ${expected}`,
      status === expected,
      `got ${status}`,
    );

    if (status !== 200) continue;

    if (email === MARKER_IDENTITY) {
      for (const marker of MARKERS[route] ?? []) {
        check(`  ${locale} ${route} renders ${marker}`, body.includes(marker));
      }
    }
    if (locale === "ar") {
      check(`  ar ${route} is dir="rtl"`, body.includes('dir="rtl"'));
    }
  }
}

/** The id-bearing routes, discovered from the lists rather than hard-coded. */
/**
 * The two kinds `comments_record_type` admits, by list section — and the three
 * it refuses.
 *
 * **This was five until `27b`.** `S114` and `D48` put comments on quotation
 * threads and projects ONLY; the CHECK, the screens and this walk all admitted
 * five, and all three narrowed in that slice.
 *
 * **`NOT_COMMENTABLE` is not decoration.** Deleting the three from
 * `COMMENTABLE` and stopping there would leave the narrowing untested: putting
 * `CommentBox` back on the company screen would go green. Every detail screen
 * is now asserted either way, so the rule is enforced from both sides.
 *
 * `reports` and `users` are absent from both because they are not records a
 * comment could ever hang on — a report is already somebody's words, and a
 * colleague is not a record. Asserting their absence would be asserting the
 * `record_type` enum, which `verify:schema25` §13 already owns.
 */
const COMMENTABLE = new Set(["projects", "quotations"]);
const NOT_COMMENTABLE = new Set(["companies", "contacts", "dispatches"]);

/**
 * Where a section's ids are found, when that is not `/<section>`.
 *
 * `reports` has no list of its own since session 27 `D45`. The stream carries
 * `/reports/<id>` on every typed row — `timeline.tsx`'s `hrefFor` — so it is
 * where a report id comes from now, and `firstId`'s pattern is unchanged.
 */
const LIST_ROUTE: Record<string, string> = { reports: "activity" };

async function walkRecords(jar: Jar, email: string): Promise<void> {
  // `/users/[id]/handover` is deliberately absent: `19 §3` opens it only AFTER
  // deactivation, and `team.ts:141` returns null for a user who is still
  // active, so an active colleague's handover is a 404 by design. It is
  // asserted as such in its own section below rather than walked here.
  const sections: [string, string[]][] = [
    ["companies", ["", "/edit", "/timeline"]],
    ["contacts", ["", "/edit"]],
    ["projects", ["", "/edit", "/timeline"]],
    ["quotations", [""]],
    ["dispatches", [""]],
    ["reports", [""]],
    ["users", ["", "/edit"]],
  ];

  for (const [section, suffixes] of sections) {
    const list = await get(jar, `/en/${LIST_ROUTE[section] ?? section}`);
    if (list.status !== 200) continue;
    const id = firstId(list.body, section);
    if (id === null) {
      // A legitimate empty state, not a broken link `[23]`.
      console.log(`  skip  ${email} /${section} is empty for this identity`);
      continue;
    }
    const readOnly = (READ_ONLY[email] ?? []).includes(section);
    for (const suffix of suffixes) {
      const path = `/en/${section}/${id}${suffix}`;
      const { status, body } = await get(jar, path);
      // Reading is not editing `S76`: the edit route is a 404 for an identity
      // that may only read, which is `D53`'s answer everywhere else too.
      const expected = readOnly && suffix === "/edit" ? 404 : 200;
      check(
        `${email} ${path} → ${expected}`,
        status === expected,
        `got ${status}`,
      );
      if (status === 200 && suffix === "") {
        check(`  ${path} renders a fact grid`, body.includes('data-slot="facts"'));
        // Every thread has a chain position — a closed one included, which
        // draws the strip stopped where it got to `D27`.
        if (section === "quotations") {
          check(
            `  ${path} renders the chain strip`,
            body.includes('data-slot="chain-strip"'),
          );
        }
        // The two screens that take a comment offer the box; the three that
        // no longer do must not render one `S114` `D48`. The fact-grid
        // assertion above is this negative's guard: it proves the page
        // rendered at all, so an absent composer is an absent composer and
        // not an absent page.
        const offered =
          body.includes('data-slot="comment-composer"') &&
          body.includes('name="body"');
        if (COMMENTABLE.has(section)) {
          check(
            readOnly
              ? `  ${path} offers NO comment box — read, not write [S76] [D51]`
              : `  ${path} offers the comment box [S114] [D48]`,
            readOnly ? !offered : offered,
          );
        }
        if (NOT_COMMENTABLE.has(section)) {
          check(
            `  ${path} renders NO comments card — S114 forbids one here [S114] [D48]`,
            !offered,
          );
        }
      }
    }
  }
}

/* ── The startup guard ────────────────────────────────────────────────────── */

/**
 * **Refuse to measure the wrong server.**
 *
 * Twice in one session a whole green run was taken against a process that was
 * already holding the port `[23]`: once a `next dev` left over from the
 * morning, which compiled the new component from source but served the message
 * catalogue it had imported at boot — so screens rendered `chain.step.new` as
 * literal text while 296 marker assertions passed — and once a `next start`
 * that a `kill %1` from a different shell had failed to stop, so a fresh
 * build's changes never reached the server they were being asserted against.
 *
 * **The condition is "this server did not start from this run"**, and the
 * symptom is stale content. `/api/health` reports `bootedAt`, stamped at module
 * scope, so the condition is directly checkable: a server that booted **before
 * `.next/BUILD_ID` was written** is running code older than the build on disk,
 * whatever it happens to be serving.
 *
 * That is stricter than an occupied-port check in the way that matters — it
 * still fires after the operator restarts against a stale build — and looser
 * only where looseness is right: a server started from *this* build by an
 * earlier command is a valid thing to verify against, and running the suite
 * twice must not be an error.
 *
 * It cannot catch code edited and never rebuilt. Nothing served over HTTP can.
 */
async function assertServerIsThisBuild(health: Response): Promise<void> {
  let builtAt: Date;
  try {
    builtAt = statSync(".next/BUILD_ID").mtime;
  } catch {
    console.error(
      "No .next/BUILD_ID — there is no build to verify against.\n" +
        "  Run `npm run build && npm run start` first.",
    );
    process.exit(1);
  }

  const body = (await health.json().catch(() => ({}))) as {
    bootedAt?: string;
  };
  if (!body.bootedAt) {
    // The field is served by `src/app/api/health/route.ts`. Absent means the
    // server predates it — which is itself a server older than this build.
    console.error(
      `The server at ${BASE} reports no bootedAt.\n` +
        "  /api/health has carried it since the chain-strip slice, so this\n" +
        "  process is older than the build you mean to drive. Stop it — by\n" +
        "  PID, not by job spec — and start it again from this build.",
    );
    process.exit(1);
  }

  const bootedAt = new Date(body.bootedAt);
  if (bootedAt.getTime() >= builtAt.getTime()) {
    console.log(
      `\n0. The server at ${BASE} booted ${describeGap(builtAt, bootedAt)} the build it is being driven against.`,
    );
    return;
  }

  const port = new URL(BASE).port || "80";
  console.error(
    `\nThe server at ${BASE} did not start from this run.\n` +
      `  It booted   ${bootedAt.toISOString()}\n` +
      `  The build is ${builtAt.toISOString()}\n\n` +
      "  Something was already listening on that port, so `next start` never\n" +
      "  bound and every check below would have been measured against stale\n" +
      "  code. Read the start log for EADDRINUSE, then stop the holder BY PID\n" +
      "  — a `kill %1` only reaches a job of the shell that started it:\n\n" +
      `    Get-NetTCPConnection -LocalPort ${port} -State Listen |\n` +
      "      Select-Object -Unique OwningProcess |\n" +
      "      ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }\n\n" +
      "  Then `npm run build && npm run start`, and check it says Ready.",
  );
  process.exit(1);
}

/** "42s after" / "2m before" — the shape of the gap, for the passing line. */
function describeGap(from: Date, to: Date): string {
  const seconds = Math.round((to.getTime() - from.getTime()) / 1000);
  const magnitude =
    Math.abs(seconds) < 90
      ? `${Math.abs(seconds)}s`
      : `${Math.round(Math.abs(seconds) / 60)}m`;
  return `${magnitude} after`;
}

/* ── Main ─────────────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== "development") {
    console.error(
      "verify:routes refuses to run outside development.\n" +
        `  NODE_ENV is ${process.env.NODE_ENV ?? "unset"}, and must be "development".`,
    );
    process.exit(1);
  }
  if (!PASSWORD) {
    console.error(
      "Set DEV_FIXTURE_PASSWORD — the same value `npm run dev:fixtures` used.",
    );
    process.exit(1);
  }

  const health = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!health?.ok) {
    console.error(
      `Nothing answering at ${BASE}. Run \`npm run build && npm run start\` —\n` +
        "  the production build, not `next dev`: stage 1 drove the build, and a\n" +
        "  dev-only difference is exactly what this script must not hide.",
    );
    process.exit(1);
  }
  await assertServerIsThisBuild(health);

  console.log("\n1. Anonymous requests are turned away");
  {
    const jar: Jar = new Map();
    const { url } = await get(jar, "/en/companies");
    check("an anonymous /companies lands on /login", url.includes("/login"), url);
  }

  console.log("\n2. Every route, three identities, both locales");
  const jars: Record<string, Jar> = {};
  for (const email of [
    "rep-a@example.test",
    "manager@example.test",
    "coordinator@example.test",
  ]) {
    const jar = await login(email);
    jars[email] = jar;
    const home = await get(jar, "/en");
    check(`${email} signed in`, home.status === 200, `got ${home.status}`);
    // The rail lights the current section — a DOM marker, not a string `[23]`.
    check(
      `  ${email} sees the rail`,
      home.body.includes('aria-current="page"'),
    );
    for (const locale of ["en", "ar"]) {
      // `D49`'s two items the rail used to lack. Asserted as locale-prefixed
      // hrefs, never as labels: a translated string would pass while pointing
      // at the wrong route, and the exact `href="…"` cannot match a detail
      // page under the same section.
      const rail = await get(jar, `/${locale}`);
      for (const item of ["/activity", "/targets"] as const) {
        check(
          `  ${email} ${locale} rail carries ${item}`,
          rail.body.includes(`href="/${locale}${item}"`),
        );
      }
      // `D50`'s half: the link is hidden by a boolean the layout computes.
      // `FORBIDDEN` above asserts the other half on the same path — the route
      // answers 404 `D53` — so neither claim can pass on its own, and the
      // identity that DOES hold it asserts the link is present.
      const holdsUsers = !(FORBIDDEN[email] ?? []).includes("/users");
      check(
        `  ${email} ${locale} rail ${holdsUsers ? "shows" : "hides"} /users`,
        rail.body.includes(`href="/${locale}/users"`) === holdsUsers,
      );
      // **`D49`'s count, asserted rather than described.** Seven — Today, four
      // under *Sell*, two under *Track* — plus user management for those who
      // hold it `D50`. The rail carried eight until `28b` deleted
      // `/performance`, and a rule whose whole content is a number is one
      // nothing was checking: the eighth item could have come back and every
      // check above would still be green.
      //
      // Counted off the `<nav>` alone, so the header, the footer and the
      // page's own links cannot inflate it. Today is `href="/en"` with no
      // trailing segment, which is why the segment is optional in the pattern.
      const nav = rail.body.slice(
        rail.body.indexOf("<nav"),
        rail.body.indexOf("</nav>"),
      );
      const railItems = (
        nav.match(new RegExp(`href="/${locale}(/[a-z-]+)?"`, "g")) ?? []
      ).length;
      const expected = holdsUsers ? 8 : 7;
      check(
        `  ${email} ${locale} rail carries ${expected} items [D49]`,
        railItems === expected,
        `got ${railItems}`,
      );
      check(
        `  ${email} ${locale} rail has no /performance [D49]`,
        !rail.body.includes(`href="/${locale}/performance"`),
      );
      // **`D56`'s bottom sheet, and the ONE thing a scripts-off walk can prove
      // about it** `38a`. This fetches HTML and executes nothing, so it cannot
      // see a breakpoint, a fixed position or a 44px target — those are the
      // founder's eye check at 375. What it CAN prove is the half that would
      // silently regress: the sheet is a native `<details>` with a `<summary>`,
      // so there is no client state behind it `D20`, and the nav is its
      // SIBLING rather than its child — which is what keeps `D49`'s seven
      // links in the markup at every width. The count above is off the `<nav>`
      // alone and would fall to zero if the nav were ever nested inside a
      // closed `<details>` and dropped, so the two assertions hold each other
      // up.
      const sheet = rail.body.indexOf('data-slot="rail-sheet"');
      check(
        `  ${email} ${locale} the rail is a native <details> sheet [D56], [D20]`,
        sheet !== -1 && rail.body.includes('data-slot="rail-sheet-bar"'),
      );
      check(
        `  ${email} ${locale} the sheet's bar is a <summary> [D20]`,
        /<details[^>]*data-slot="rail-sheet"[^>]*>\s*<summary/.test(rail.body),
      );
      // The nav opens AFTER the details closes — a peer, never a child. If it
      // were nested this index comparison would still pass, so the closing tag
      // is what is asserted: `</details>` must come before `<nav`.
      check(
        `  ${email} ${locale} the nav is the sheet's peer, not its child [D56]`,
        sheet !== -1 &&
          rail.body.indexOf("</details>", sheet) < rail.body.indexOf("<nav"),
      );
      await walk(jar, email, locale);
    }
  }

  console.log("\n3. Detail, edit and timeline screens, by discovered id");
  for (const [email, jar] of Object.entries(jars)) {
    await walkRecords(jar, email);
  }

  console.log("\n4. Both themes — a token defined in only one hides in the default");
  {
    const jar = jars["manager@example.test"];
    const dark = await get(jar, "/en");
    check("no cookie renders dark", /<html[^>]*class="[^"]*\bdark\b/.test(dark.body));

    jar.set("facet-theme", "light");
    const light = await get(jar, "/en");
    check(
      "facet-theme=light drops the dark class",
      !/<html[^>]*class="[^"]*\bdark\b/.test(light.body),
    );
    // Every shared route again, so a light-only gap cannot hide behind dark.
    for (const route of STATIC_ROUTES) {
      const path = `/en${route === "/" ? "" : route}`;
      const { status } = await get(jar, path || "/en");
      const expected = (FORBIDDEN["manager@example.test"] ?? []).includes(route)
        ? 404
        : 200;
      check(`light ${route} → ${expected}`, status === expected, `got ${status}`);
    }

    jar.set("facet-theme", "chartreuse");
    const unknown = await get(jar, "/en");
    check(
      "an unknown cookie value falls back to dark",
      /<html[^>]*class="[^"]*\bdark\b/.test(unknown.body),
    );
    jar.delete("facet-theme");
  }

  console.log("\n5. The theme form POSTs, with no JavaScript");
  {
    const jar = jars["manager@example.test"];
    const page = await get(jar, "/en");
    // A BOUND action renders `$ACTION_REF_n` + `$ACTION_n:0`, an unbound one
    // `$ACTION_ID_…`, and NEITHER carries a `value` attribute `[23]`. Match on
    // the name alone; requiring a value drops them and Next answers "Failed to
    // find Server Action".
    const form = page.body.match(
      /<form[^>]*>(?:(?!<\/form>)[\s\S])*?name="theme"[\s\S]*?<\/form>/,
    )?.[0];
    check("the theme toggle is a real form", Boolean(form));

    if (form) {
      // `$ACTION_ID_<id>` carries NO `value` attribute `[23]` — a scraper that
      // requires one drops it and Next answers "Failed to find Server Action".
      const fields = new FormData();
      for (const input of form.matchAll(/<input[^>]*>/g)) {
        const name = input[0].match(/name="([^"]+)"/)?.[1];
        if (!name) continue;
        fields.set(name, input[0].match(/value="([^"]*)"/)?.[1] ?? "");
      }
      const names = [...fields.keys()];
      check("  it carries an action envelope", names.some((k) => k.startsWith("$ACTION_")));
      check("  it carries the next theme", fields.get("theme") === "light");

      // **The form declares `encType="multipart/form-data"`, and Next means
      // it.** This is the no-JavaScript path, so the request must be the one a
      // browser would send: a urlencoded body 404s, and looks for all the
      // world like a missing route. Passing a `FormData` lets fetch set the
      // boundary, so no `content-type` is written by hand — and no
      // `Next-Action` header either, because the id is in the body.
      const posted = await fetch(`${BASE}/en`, {
        method: "POST",
        headers: { cookie: header(jar) },
        body: fields,
        redirect: "manual",
      });
      store(jar, posted);
      check(
        "  POSTing it sets facet-theme=light",
        jar.get("facet-theme") === "light",
        `status ${posted.status}, jar has ${jar.get("facet-theme") ?? "nothing"}`,
      );
      jar.delete("facet-theme");
    }
  }

  console.log("\n6. The 404 screen, and the handover gate behind one");
  {
    const jar = jars["manager@example.test"];
    const { status, body } = await get(
      jar,
      "/en/companies/00000000-0000-0000-0000-000000000000",
    );
    check("an unknown id 404s", status === 404, `got ${status}`);
    // `not-found.tsx`'s own shape, which is the only thing this can prove:
    // Next replaces the whole `(app)` subtree — LAYOUT INCLUDED — with the
    // boundary, so the rail is absent here and always has been. Asserting the
    // rail would be asserting a Next.js behaviour FACET does not choose.
    check(
      "  and renders (app)/not-found.tsx, not a bare Next page",
      body.includes("max-w-2xl") && body.includes("items-start"),
    );

    // `19 §3` — handover opens only AFTER deactivation, and `team.ts:141`
    // returns null while the user is still active. A 404 is how the screen
    // says so, and hidden and non-existent look identical `[facet-ui]`.
    const list = await get(jar, "/en/users");
    const id = firstId(list.body, "users");
    if (id) {
      const { status: handover } = await get(jar, `/en/users/${id}/handover`);
      check(
        "an ACTIVE user's handover 404s [S103]",
        handover === 404,
        `got ${handover}`,
      );

      /* **`S123`'s two figures, on the page they moved to in `28b`.**
       *
       * *Two questions, two figures, and a screen showing both must say which
       * is which.* `data-fact` is the handle, never the label: the label is a
       * translated string next-intl ships to every page whether it rendered or
       * not, so asserting on it would pass on a page that rendered neither.
       *
       * **Both, in one check that fails if either is missing.** They were three
       * columns in one row until this session and the founder's call was that
       * figures which cannot be combined must not share a heading — reduced to
       * one, the block would be back to a single number with no second question
       * beside it, which is the shape `S123` forbids.
       *
       * Driven in both locales because the fraction interpolates two numbers
       * into a translated string, and a `{part} of {whole}` that lost a
       * placeholder in Arabic renders silently wrong rather than failing. */
      for (const locale of ["en", "ar"]) {
        const { body: detail } = await get(jar, `/${locale}/users/${id}`);
        check(
          `  ${locale} a user detail carries both S123 figures [S123]`,
          detail.includes('data-fact="origin-raised-for-them"') &&
            detail.includes('data-fact="origin-edited-by-another"'),
        );
      }
    }
  }

  console.log("\n7. Marking a project lost, over HTTP, in both locales");
  {
    // **The one form POST whose writer and whose CHECK shipped together.**
    // `25 §5` turned the loss reason into a reason plus its detail, and
    // `projects_loss_detail` refuses the free text `projects.ts` used to write
    // alone. Zero projects were lost when the constraint landed, so the
    // migration applied cleanly and the defect would have waited for the first
    // rep to mark one — which is exactly the class of thing sections 1–6 exist
    // to catch, and none of them touched this form.
    //
    // `verify:schema25` drives `createProject` and `updateProject` in process.
    // This is the other half: the real browser POST, through `readFields` and
    // the action, which no in-process script can reach — including feature
    // slice 5's own trap: a rep who picks `other`, types the detail, then
    // picks a real reason, replayed below as a second POST rather than a
    // client-only claim.
    for (const locale of ["en", "ar"] as const) {
      const jar = jars["rep-a@example.test"];
      const list = await get(jar, `/${locale}/projects`);
      const id = firstId(list.body, "projects");
      if (!id) {
        // A rep's empty list is a legitimate empty state `[23]`, not a failure.
        console.log(`  --    ${locale}: rep-a owns no project to drive`);
        continue;
      }

      const page = await get(jar, `/${locale}/projects/${id}/edit`);
      check(`${locale}: the edit screen renders`, page.status === 200, `got ${page.status}`);
      // The picker is hidden until the end state is `lost`, but it is in the
      // markup — `hidden`, not conditionally rendered — so this asserts the
      // marker rather than a translated label `[23]`. The free-text detail
      // field is NOT asserted here the same way: it is genuinely conditional
      // on the current pick being `other`, unmounted otherwise on purpose
      // `S29`, so its presence depends on the fixture project's current
      // state rather than being a fixed structural fact about this screen.
      check(
        `${locale}: it carries the loss-reason picker`,
        page.body.includes('name="lostReasonId"'),
      );

      const form = page.body.match(
        /<form[^>]*>(?:(?!<\/form>)[\s\S])*?name="endState"[\s\S]*?<\/form>/,
      )?.[0];
      check(`${locale}: the project form is a real form`, Boolean(form));
      if (!form) continue;

      // The picker's `<option>` carries `data-code` — a DOM marker, not a
      // translated string `[23]` — precisely so this black-box script can
      // find the `other` row without a DB import of its own. `"other"` here
      // is the literal `OTHER_LOSS_REASON_CODE` in `src/lib/enums.ts`; this
      // file never imports `src/`, so it is repeated rather than shared.
      const otherReasonId = form.match(
        /<option value="([^"]+)"[^>]*data-code="other"/,
      )?.[1];
      const nonOtherReasonId = [
        ...form.matchAll(/<option value="([^"]+)"[^>]*data-code="([^"]+)"/g),
      ].find((match) => match[2] !== "other")?.[1];
      check(`${locale}: the picker offers the 'other' reason`, Boolean(otherReasonId));
      check(
        `${locale}: the picker offers a non-'other' reason`,
        Boolean(nonOtherReasonId),
      );
      // The project form asks for no region either, and for the same reason the
      // company form does not: `regionForCity` has no fallback, so a control
      // here would take input nothing stores `D51`. Its CITY control stays and
      // is deliberately not asserted absent — what a rep picks there IS written.
      check(
        `${locale}: *** the project form asks for NO region *** [D51]`,
        !form.includes('name="region"'),
      );
      check(
        `${locale}: …and still offers a city, which is stored`,
        form.includes('name="cityId"'),
      );

      // **Nothing hand-sets won, at the boundary a rep actually reaches**
      // `S31`. A project is won when a dispatch against it is approved — a
      // real event — so the end-state select must not offer it. The data layer
      // and the enum both refuse it too; this is the assertion that would
      // catch a screen putting the option back by hand.
      check(
        `${locale}: *** the end-state select offers NO way to claim a win *** [S31]`,
        !form.includes('value="won"'),
      );
      // And the rep's own judgement IS offered, beside it rather than in it
      // `S29` — a committed project is still moving, so it is not an end state.
      check(
        `${locale}: …while committed is offered as its own control [S29]`,
        form.includes('name="committed"'),
      );

      if (!otherReasonId || !nonOtherReasonId) continue;

      /** The action envelope plus the fields a browser would send.
       *
       *  `committed` is a checkbox, so it is appended only when set — an
       *  unchecked box sends nothing, which is how a rep withdraws it `S29`.
       */
      const fieldsFor = (
        endState: string,
        lostReasonId: string,
        lossReason: string,
        committed = false,
      ): FormData => {

        const fields = new FormData();
        for (const input of form.matchAll(/<input[^>]*>/g)) {
          const name = input[0].match(/name="([^"]+)"/)?.[1];
          if (!name?.startsWith("$ACTION")) continue;
          // **The values must be HTML-UNESCAPED** `[23]`. A bound action's
          // `$ACTION_n:1` carries JSON, so its quotes arrive as `&quot;`;
          // replaying them verbatim makes Next answer *"Failed to find Server
          // Action"*, which reads like a stale deployment and is not one. The
          // theme toggle above never hit this because its envelope has no JSON.
          fields.append(
            name,
            unescapeHtml(input[0].match(/value="([^"]*)"/)?.[1] ?? ""),
          );
        }
        // `readFields` requires the project's `name` and nothing else here.
        // One field `S26`, the shape `S12` and `S19` already gave a company and
        // a contact. The rest are sent empty, exactly as an untouched form
        // would send them.
        fields.set("name", nameOf(page.body) ?? "Project");
        fields.set("sqmExpected", "");
        fields.set("cityId", "");
        // No `region`: the project form no longer renders one, so an untouched
        // form sends none `D51`. The city is still sent, because that control
        // is still there and what it posts is still stored.
        fields.set("endState", endState);
        fields.set("lostReasonId", lostReasonId);
        fields.set("lossReason", lossReason);
        if (committed) fields.set("committed", "on");
        return fields;
      };

      const post = async (body: FormData): Promise<number> => {
        const response = await fetch(`${BASE}/${locale}/projects/${id}/edit`, {
          method: "POST",
          headers: { cookie: header(jar), origin: BASE },
          body,
          redirect: "manual",
        });
        store(jar, response);
        return response.status;
      };

      const lost = await post(
        fieldsFor("lost", otherReasonId, `lost via ${locale}`),
      );
      check(
        `${locale}: *** POSTing endState=lost answers 303, not 500 *** [S29]`,
        lost === 303,
        `got ${lost}`,
      );

      // The sequence a real rep produces: pick `other`, type the detail, then
      // decide it is actually a real reason. The client unmounts the stale
      // detail field on that switch, but only a real browser POST through
      // `readFields` proves the SERVER accepts the correction on its own
      // terms — no in-process script crosses that boundary `S43`.
      const corrected = await post(
        fieldsFor("lost", nonOtherReasonId, ""),
      );
      check(
        `${locale}: switching from 'other' to a real reason still answers 303 [S43]`,
        corrected === 303,
        `got ${corrected}`,
      );

      const detail = await get(jar, `/${locale}/projects/${id}`);
      check(
        `${locale}: the detail screen still renders once lost`,
        detail.status === 200,
        `got ${detail.status}`,
      );

      // Put it back: the three loss columns must clear together, or
      // `projects_loss_state` refuses the row — the case a rep hits the first
      // time he changes his mind. It also leaves the fixture as it was found.
      const reopened = await post(fieldsFor("", "", ""));
      check(
        `${locale}: re-opening it answers 303, so all three columns cleared`,
        reopened === 303,
        `got ${reopened}`,
      );

      // **The rep's own judgement, over HTTP** `S29` `S31`. Set it, then read
      // it back off the detail screen — the assertion is the DOM marker the
      // Fact renders, never the translated word, so this passes in both
      // locales without either catalogue being repeated here.
      const marked = await post(fieldsFor("", "", "", true));
      check(
        `${locale}: *** POSTing committed answers 303, not 500 *** [S29]`,
        marked === 303,
        `got ${marked}`,
      );
      const afterCommit = await get(jar, `/${locale}/projects/${id}`);
      check(
        `${locale}: …and the edit form comes back with the box checked [S29]`,
        (
          await get(jar, `/${locale}/projects/${id}/edit`)
        ).body.match(/name="committed"[^>]*/)?.[0].includes("checked") === true,
      );
      // The project is still its owner's move, which is `D2`: a commitment is
      // a status beside the turn line and never the turn line itself. The turn
      // panel is the marker, and it is still there.
      check(
        `${locale}: a committed project still owes its owner the next move [D2]`,
        afterCommit.status === 200 &&
          afterCommit.body.includes('data-slot="turn-panel"'),

        `got ${afterCommit.status}`,
      );

      // And withdrawn, leaving the fixture as it was found.
      const withdrawn = await post(fieldsFor("", "", ""));
      check(
        `${locale}: the rep clears their own commitment [S29]`,
        withdrawn === 303,
        `got ${withdrawn}`,
      );
    }
  }

  console.log("\n8. The chain, on the three screens that draw it [S132] [D27]");
  {
    // **Three readers of one ladder, paired against each other.** `D27` makes
    // `chain.ts` the single definition and `S132` says a project's position is
    // the furthest of its live threads — so the only assertion worth making is
    // that two screens reading the same rule return the same answer. A section
    // that asks one screen whether it drew *something* is a section that can
    // only pass.
    //
    // **That is what this used to be.** The project half asserted
    // `projectStrip !== null || many` — a strip for one live thread, `25 §22`'s
    // flag for more. Session 28 removed the flag, so every project draws a
    // strip and that disjunction became true by construction: it would have
    // gone green over a project reading `new` while its threads were `won`.
    //
    // The three pairings, in the order they are made:
    //
    //  **A. the quotations list ↔ each thread's own strip.** Unchanged, and
    //  the shape the two below copy. `/quotations` passed no dispatch flag
    //  before session 26, so a shipped thread read *with the customer* on the
    //  list and *won* on its own page — one function, two screens, two
    //  answers, and nothing failed.
    //
    //  **B. the board's column ↔ the project's own strip.** Both read
    //  `chainByProject`, one through `listProjectBoard` and one through
    //  `getProject`, and until session 28 the second did not exist — the screen
    //  built its own answer from ONE thread plus two dispatch reads. A project
    //  won by the direct route `S75`, or by a dispatch against a second thread,
    //  was won on the board and blank on its own page. This is the pairing that
    //  would have caught it, and it is `§24`'s shape exactly.
    //
    //  **C. the project's strip ↔ the furthest of its threads.** `S132` in so
    //  many words, and it is drivable because `?projectId=` exists as of the
    //  same slice. `won` and `readyToShip` are the two rungs a DISPATCH can
    //  supply with no thread reaching them, so those two are asserted as
    //  at-least rather than equal and the gap is printed as a note.
    const jar = jars["manager@example.test"];
    const PAGES = 4;
    // How many projects to pair per locale. The board is unpaginated and this
    // database carries 49; pairing every one twice over is 98 fetches to prove
    // what a spread across the six columns already proves. Coverage is printed
    // rather than assumed, so a column this run never reached says so.
    const PROJECT_SAMPLE = 12;
    const shapes = new Set<string>();
    const seen = { closed: 0, dispatchAhead: 0 };

    for (const locale of ["en", "ar"] as const) {
      /* ── A. the list and each thread ─────────────────────────────────── */
      let found = 0;
      const projectIds = new Set<string>();

      for (let page = 1; page <= PAGES; page += 1) {
        const list = await get(jar, `/${locale}/quotations?page=${page}`);
        const ids = [
          ...new Set(
            [
              ...list.body.matchAll(
                /href="\/(?:en|ar)\/quotations\/([0-9a-f-]{36})"/gi,
              ),
            ].map((match) => match[1]),
          ),
        ];
        if (ids.length === 0) break;
        found += ids.length;

        // **The list's own answer, per row.** `D27` makes `chain.ts` the one
        // ladder; this is what proves the two readers of it agree.
        const listed = new Map(
          [
            ...list.body.matchAll(
              /data-slot="quotation-row"[^>]*data-id="([0-9a-f-]{36})"[^>]*data-position="([a-zA-Z]+)"/gi,
            ),
          ].map((match) => [match[1], match[2]]),
        );
        check(
          `${locale} page ${page}: every listed row carries its position`,
          listed.size === ids.length,
          `${listed.size} marked, ${ids.length} linked`,
        );

        for (const id of ids) {
          const thread = await get(jar, `/${locale}/quotations/${id}`);
          const strip = stripOf(thread.body);
          if (!strip) {
            // Every thread has a chain position, so this is a real failure
            // rather than a shape not worth repeating.
            check(
              `${locale} ${id.slice(0, 8)}: the quotation draws the strip`,
              false,
            );
            continue;
          }
          if (listed.has(id)) {
            check(
              `${locale} ${id.slice(0, 8)}: list and detail agree on position`,
              listed.get(id) === strip.position,
              `list ${listed.get(id)}, detail ${strip.position}`,
            );
          }
          if (strip.position === "closed") seen.closed += 1;

          // The project this thread names, banked for B and C. A thread reached
          // through a share renders its project as plain text where the reader
          // may not open it `S30`, and there is nothing to follow.
          const projectId = firstId(thread.body, "projects");
          if (projectId) projectIds.add(projectId);

          const shape = `${locale} ${strip.position}`;
          if (shapes.has(shape)) continue;
          shapes.add(shape);

          const label = `${shape} (${id.slice(0, 8)})`;
          // Six nodes, one per `S132` position. A dropped column fails here.
          check(
            `${label}: six steps`,
            strip.steps.length === 6,
            `got ${strip.steps.length}`,
          );
          // **A node is ringed only while someone owes it** — so a won thread
          // rings none, and a closed one rings none either, showing instead
          // where it stopped.
          const now = strip.steps.filter((state) => state === "now").length;
          const owed = strip.position !== "closed" && strip.position !== "won";
          check(
            `  it rings ${owed ? "one" : "no"} node`,
            now === (owed ? 1 : 0),
            `got ${now}`,
          );
          if (strip.position === "closed") {
            check(
              "  a closed thread has done nodes but no current one",
              strip.steps.includes("done") && now === 0,
              strip.steps.join(" "),
            );
          }
          check(
            "  the turn panel sits with it",
            thread.body.includes('data-slot="turn-panel"'),
          );
        }
      }

      if (found === 0) {
        // `verify:slice2` is what creates threads; without it there is nothing
        // to walk, and that is a missing precondition rather than a failure.
        console.log(`  skip  ${locale}: no quotation thread to drive`);
      }

      /* ── B and C. the board, each project, and its threads ────────────── */

      // **The order comes from the product, not from a copy of it here.**
      // `verify:routes` may not import `src/` (`CLAUDE.md`), so a restatement
      // of the six position names would be a second definition of the very
      // thing `D27` exists to keep single. The board renders `CHAIN_COLUMNS` in
      // order, so reading its headers off the page IS the order — and asserting
      // there are six of them is `D29` at the same time.
      const board = await get(jar, `/${locale}/projects`);
      const order = [
        ...board.body.matchAll(/data-slot="board-column"[^>]*data-column="([a-zA-Z]+)"/g),
      ].map((match) => match[1]);
      check(
        `${locale}: the board draws S132's six columns [D29]`,
        order.length === 6,
        `got ${order.length}: ${order.join(" ")}`,
      );
      if (order.length !== 6) continue;

      // Each card's column. `split` cuts the body at every column marker, so a
      // part holds that column's cards and no other's — a regex spanning from
      // one column to the next would have to guess where the section ends.
      const columnOf = new Map<string, string>();
      for (const part of board.body.split('data-slot="board-column"').slice(1)) {
        const column = part.match(/^[^>]*data-column="([a-zA-Z]+)"/)?.[1];
        if (!column) continue;
        for (const card of part.matchAll(
          /data-slot="board-card"[^>]*data-id="([0-9a-f-]{36})"/g,
        )) {
          columnOf.set(card[1], column);
        }
      }
      check(
        `${locale}: the board's cards carry their id`,
        columnOf.size > 0 || board.body.includes('data-slot="projects-empty"'),
        `${columnOf.size} card(s) marked`,
      );

      // A spread across the columns first, then whatever the threads reached,
      // so a sample of twelve is not twelve projects from one pile.
      const byColumn = new Map<string, string[]>();
      for (const [projectId, column] of columnOf) {
        byColumn.set(column, [...(byColumn.get(column) ?? []), projectId]);
      }
      const sample = [
        ...new Set([
          ...order.flatMap((column) => byColumn.get(column)?.slice(0, 2) ?? []),
          ...[...projectIds].filter((projectId) => columnOf.has(projectId)),
        ]),
      ].slice(0, PROJECT_SAMPLE);

      const reachedColumns = new Set<string>();

      for (const projectId of sample) {
        const short = projectId.slice(0, 8);
        const column = columnOf.get(projectId)!;
        const project = await get(jar, `/${locale}/projects/${projectId}`);
        const strip = stripOf(project.body);

        // **B.** `S134` — a position is derived, so two screens deriving it
        // from one function may not disagree.
        check(
          `${locale} ${short}: the project draws its strip`,
          strip !== null,
          `status ${project.status}`,
        );
        if (!strip) continue;
        reachedColumns.add(strip.position);
        check(
          `  board column and the project's own strip agree`,
          strip.position === column,
          `board ${column}, project ${strip.position}`,
        );
        check(
          "  the turn panel sits with it",
          project.body.includes('data-slot="turn-panel"'),
        );
        // The strip is six nodes on this screen too, and a project is never
        // `closed` — `chainByProject` skips closed threads, which is what lets
        // the screen pass `reached: position` honestly rather than inventing a
        // field.
        check(
          "  six steps there too",
          strip.steps.length === 6,
          `got ${strip.steps.length}`,
        );
        check(
          "  a project is never closed",
          strip.position !== "closed",
          strip.position,
        );

        // **C.** Every thread on this project the reader can see, from the
        // scope `D70` made the quotations card link to.
        const threads = await get(
          jar,
          `/${locale}/quotations?projectId=${projectId}`,
        );
        const positions = [
          ...threads.body.matchAll(
            /data-slot="quotation-row"[^>]*data-position="([a-zA-Z]+)"/g,
          ),
        ].map((match) => match[1]);
        // `listQuotationThreads` pages at 25. No project in this database comes
        // near it, and a run that did would be measuring a truncated set — so
        // it says so rather than asserting over half the threads.
        if (positions.length >= 25) {
          console.log(`  --    NOTE: ${short} filled a page of threads; C skipped`);
          continue;
        }
        // A closed thread is not one of them `S132`.
        const live = positions.filter((position) => position !== "closed");
        const expected = live.reduce(
          (furthest, position) =>
            order.indexOf(position) > order.indexOf(furthest)
              ? position
              : furthest,
          "new",
        );
        const ahead = order.indexOf(strip.position) - order.indexOf(expected);
        check(
          `  its position is at least the furthest of its ${live.length} live thread(s) [S132]`,
          ahead >= 0,
          `project ${strip.position}, threads reach ${expected}`,
        );
        if (ahead > 0) {
          // The only honest explanation: `won` and `readyToShip` are facts
          // about a DISPATCH against the project `S31` `S74`, which a thread
          // need not name at all `S75`. Anything else ahead of its threads is
          // a position nothing produced.
          seen.dispatchAhead += 1;
          check(
            "    and anything beyond that is a dispatch rung [S31] [S74]",
            strip.position === "won" || strip.position === "readyToShip",
            `${strip.position} is ahead of ${expected} and no dispatch supplies it`,
          );
        }
      }

      console.log(
        `  --    ${locale}: paired ${sample.length} project(s) across ` +
          `${reachedColumns.size} of 6 position(s)`,
      );
      for (const column of order) {
        if (!reachedColumns.has(column)) {
          console.log(
            `  --    NOTE: no project reached ${column} — that column is unproven by this run.`,
          );
        }
      }
    }

    // **No silent coverage.** Which shapes exist at all depends on the fixture
    // data, so what was actually reached is printed rather than assumed.
    console.log(
      `  --    reached ${seen.closed} closed thread(s), ` +
        `${seen.dispatchAhead} project(s) ahead of their threads`,
    );
    if (seen.closed === 0) {
      console.log(
        "  --    NOTE: this data never reached a closed thread — that branch is unproven by this run.",
      );
    }
    if (seen.dispatchAhead === 0) {
      console.log(
        "  --    NOTE: no project took its position from a dispatch rather than a thread —" +
          " S75's direct route is unproven by this run.",
      );
    }
  }

  // `S114` and `D48` govern, and since `27b` the screens agree with them —
  // see the note above COMMENTABLE.
  console.log("\n9. The comment box, posted for real [S114] [D48]");
  {
    // **`verify:comments` drives `addComment`; this drives the FORM.** The two
    // do not overlap: the in-process script never touches `readFields`, the
    // action, the chip picker's repeated `mentions` values or the body cap —
    // and the cap is shape validation, so the action is the only place it
    // lives. That boundary is where slices 2 and 3 replayed a POST by hand and
    // threw the replay away `[23]`; this one is kept.
    //
    // **It posted on a COMPANY until `27b`.** `S114` takes the comment off a
    // company, so this registers a run-stamped company AND a project on it, and
    // posts there. Every assertion below is the one that stood before; only the
    // anchor moved.
    //
    // **The scratch records are this section's own, registered over HTTP.** It
    // used to comment on whichever company rep-a held first, which on a seeded
    // database is a real demo record — and `S107` means nothing can ever take
    // a comment off again, so eighteen of them had settled onto two of them.
    // Both records below carry a run stamp, so the unremovable row lands on
    // records nobody reads as data.
    //
    // **New residue, recorded here rather than discovered later: this section
    // now leaves ONE PROJECT per run behind where it left none.** That is a
    // real cost and it is the cheaper of the two options — the alternative is
    // commenting on a seeded project, which `S107` then marks for ever.
    //
    // **The project is created through `/projects/new` WITH its participant**,
    // never by a direct insert. `WORKFLOW §5` records 11 projects carrying no
    // live participant and names the verify scripts that inserted into
    // `projects` directly as how they got there; `S27` says a project keeps at
    // least one. Posting the form is also what `createProject` gates on, so a
    // project this script leaves behind is one the product could have made.
    //
    // Abroad, for §13's old reason: the city was a `Combobox` in a portal, so
    // this script has no city id to post, and `S15` refuses a Saudi company
    // without one. Registered ONCE rather than per locale — `S18` makes rep-a
    // the primary rep, and that is what puts the composer on the screen in
    // both. **§21 is deliberately not moved with it**: its assertions are
    // about an established company's clock and its capped timeline, and a
    // company registered seconds ago has nothing for either to measure.
    const jar = jars["rep-a@example.test"];
    const stamp = `${Date.now()}`.slice(-7);

    const blank = await get(jar, "/en/companies/new");
    // `data-code` is a DOM marker, not a translated string `[23]`. `"SA"` is
    // the literal `SAUDI_CODE` in `src/lib/enums.ts`, repeated rather than
    // imported for the reason §13 records.
    const countrySelect =
      blank.body.match(/<select[^>]*name="countryId"[\s\S]*?<\/select>/)?.[0] ??
      "";
    const foreignId = [
      ...countrySelect.matchAll(
        /<option value="([0-9a-f-]{36})"[^>]*data-code="([A-Z]{2})"/g,
      ),
    ].find((option) => option[2] !== "SA")?.[1];
    check(
      "the register form offers a country outside Saudi Arabia [S14]",
      Boolean(foreignId),
    );

    const registration = envelopeOf(blank.body);
    registration.set("name", `comments-${stamp}`);
    // `S13` makes the phone mandatory and `S23` matches companies on it, so it
    // is this run's alone — a fixed literal would make every run a duplicate.
    registration.set("phone", `+9665${stamp}0`);
    registration.set("countryId", foreignId ?? "");
    // The rest empty, exactly as an untouched form would send them. No region
    // is set, because the form offers no such field `S15`.
    for (const empty of ["cityId", "categoryId", "leadSourceId", "notes"]) {
      registration.set(empty, "");
    }
    const registered = await fetch(`${BASE}/en/companies/new`, {
      method: "POST",
      headers: { cookie: header(jar), origin: BASE },
      body: registration,
      redirect: "manual",
    });
    store(jar, registered);
    const companyLocation = registered.headers.get("location") ?? "";
    const companyId = companyLocation.match(/\/companies\/([0-9a-f-]{36})/)?.[1];
    check(
      "*** this section registers the company the project hangs on *** [S13], [S18]",
      registered.status === 303 && Boolean(companyId),
      `got ${registered.status} ${companyLocation}`,
    );

    /* --- the project, and the participant `S27` will not let it lose ---- */

    let id: string | undefined;
    if (companyId) {
      const projectForm = await get(jar, "/en/projects/new");
      const creation = envelopeOf(projectForm.body);
      creation.set("name", `comments-${stamp}`);
      // The participant rows arrive as repeated `companyId` inputs `S27`.
      creation.set("companyId", companyId);
      // The rest as an untouched form sends them. An empty `endState` is an
      // OPEN project, which is what `S29` calls one that has not closed.
      for (const empty of [
        "sqmExpected",
        "cityId",
        "region",
        "endState",
        "lostReasonId",
        "lossReason",
      ]) {
        creation.set(empty, "");
      }
      const created = await fetch(`${BASE}/en/projects/new`, {
        method: "POST",
        headers: { cookie: header(jar), origin: BASE },
        body: creation,
        redirect: "manual",
      });
      store(jar, created);
      const location = created.headers.get("location") ?? "";
      id = location.match(/\/projects\/([0-9a-f-]{36})/)?.[1];
      check(
        "*** …and the project it comments on, carrying that participant *** [S27], [S50]",
        created.status === 303 && Boolean(id),
        `got ${created.status} ${location}`,
      );
    }

    for (const locale of ["en", "ar"] as const) {
      if (!id) break;

      const page = await get(jar, `/${locale}/projects/${id}`);
      check(
        `${locale}: the project screen carries the composer [S114] [D48]`,
        page.body.includes('data-slot="comment-composer"'),
      );

      const form = page.body.match(
        /<form[^>]*data-slot="comment-composer"[\s\S]*?<\/form>/,
      )?.[0];
      check(`${locale}: the composer is a real form`, Boolean(form));
      if (!form) continue;

      // The chip picker posts repeated `mentions` values. `OPEN — no rule`:
      // no S or D number covers @mentions; archived as `[25 §11]`. Asserting
      // the marker rather than a name: the list is whoever is active.
      check(
        `${locale}: it offers people to tag [OPEN — no rule]`,
        form.includes('name="mentions"'),
      );

      const post = async (body: FormData): Promise<number> => {
        const response = await fetch(`${BASE}/${locale}/projects/${id}`, {
          method: "POST",
          headers: { cookie: header(jar), origin: BASE },
          body,
          redirect: "manual",
        });
        store(jar, response);
        return response.status;
      };

      const good = envelopeOf(form);
      good.set("body", `verify-routes ${locale} comment`);
      const posted = await post(good);
      check(
        `${locale}: *** posting a comment answers 200, not 500 *** [S114]`,
        posted === 200,
        `got ${posted}`,
      );

      const landed = await get(jar, `/${locale}/projects/${id}`);
      check(
        `${locale}: the comment is on the record's thread [S114]`,
        landed.body.includes('data-slot="comment"'),
      );

      // **The cap** `S114`. It is `readFields` shape validation, so nothing
      // in process crosses it — this is the only assertion of it anywhere. A
      // 200 carrying the error is the correct answer; a 500 is the defect.
      const tooLong = envelopeOf(form);
      tooLong.set("body", "x".repeat(5001));
      const capped = await post(tooLong);
      check(
        `${locale}: an over-long comment is refused, not a 500 [S114]`,
        capped === 200,
        `got ${capped}`,
      );
    }
  }

  console.log("\n10. The sharing panel, granted and revoked for real [S96] [S99] [S100]");
  {
    // **`verify:sharing` drives `grantShare`; this drives the FORM.** The two
    // do not overlap: the in-process script never touches `readFields`, the
    // bound `$ACTION` envelope, or the per-row revoke binding — and the binding
    // is the part with no analogue in the data layer at all, because there the
    // share id is an argument rather than something a page had to carry.
    for (const locale of ["en", "ar"] as const) {
      const jar = jars["manager@example.test"];
      const list = await get(jar, `/${locale}/companies`);
      const id = firstId(list.body, "companies");
      if (!id) {
        console.log(`  --    ${locale}: the manager sees no company to share`);
        continue;
      }

      const page = await get(jar, `/${locale}/companies/${id}`);
      check(
        `${locale}: the company screen carries the sharing panel [S96]`,
        page.body.includes('data-slot="sharing-panel"'),
      );

      const grantForm = page.body.match(
        /<form[^>]*data-slot="sharing-grant"[\s\S]*?<\/form>/,
      )?.[0];
      check(
        `${locale}: can_share is offered the grant form [S96]`,
        Boolean(grantForm),
      );
      if (!grantForm) continue;
      check(
        `${locale}: it names a person to share with`,
        grantForm.includes('name="sharedWithUserId"'),
      );

      // The envelope scraper of section 9, for the reason recorded there: a
      // bound action's inputs carry no `value` attribute, and its JSON must be
      // HTML-unescaped or the replay reads as a stale deployment `[23]`.
      const post = async (body: FormData): Promise<number> => {
        const response = await fetch(`${BASE}/${locale}/companies/${id}`, {
          method: "POST",
          headers: { cookie: header(jar), origin: BASE },
          body,
          redirect: "manual",
        });
        store(jar, response);
        return response.status;
      };

      // **The row this walk grants must be the row it revokes.** `ShareEntry`
      // carries no id — it renders `sharedWithName` and a bound revoke action
      // — so the recipient's NAME is the only handle on a single row, and the
      // picker supplies it: `<option value="{id}">{name}</option>`. Safe as a
      // key because `GrantForm` only lists people who do not already hold the
      // record, so the name cannot collide with a row that was already live.
      //
      // Taking whoever sorts first instead, and then asserting the list is
      // empty, is what made this section pass or fail by run order:
      // `verify:sharing` deliberately leaves live shares behind, and against
      // those the old walk revoked somebody else's row and then failed on its
      // own grant still being there.
      const offered = grantForm.match(
        /<option value="([0-9a-f-]{36})"[^>]*>([^<]*)</i,
      );
      const recipient = offered?.[1];
      const recipientName = unescapeHtml(offered?.[2] ?? "").trim();
      check(
        `${locale}: the picker offers somebody to share with`,
        Boolean(recipient) && recipientName.length > 0,
      );
      if (!recipient || !recipientName) continue;

      // Every `share-row` on the page, as its own block. No `<li>` nests
      // inside another, so the non-greedy close is the right one.
      const shareRows = (body: string): string[] =>
        [...body.matchAll(/<li[^>]*data-slot="share-row"[\s\S]*?<\/li>/g)].map(
          (match) => match[0],
        );

      // `page` is this record as it stood before the grant — the baseline the
      // revoke has to return to, whatever `verify:sharing` left live on it.
      // Reported, because a baseline of zero would make the two assertions
      // below agree with the broken ones they replaced, and a reader should
      // be able to see which case this run actually exercised.
      const before = shareRows(page.body);
      console.log(`  --    ${locale}: ${before.length} live share(s) before the grant`);

      const grant = envelopeOf(grantForm);
      grant.set("sharedWithUserId", recipient);
      const granted = await post(grant);
      check(
        `${locale}: *** granting a share answers 200, not 500 *** [S99]`,
        granted === 200,
        `got ${granted}`,
      );

      const afterGrant = await get(jar, `/${locale}/companies/${id}`);
      const grantedRow = shareRows(afterGrant.body).find((row) =>
        row.includes(recipientName),
      );
      check(
        `${locale}: the record now lists WHO holds it, by name [S96]`,
        Boolean(grantedRow),
        `no share row names ${recipientName}`,
      );
      if (!grantedRow) continue;

      const revokeForm = grantedRow.match(/<form[\s\S]*?<\/form>/)?.[0];
      check(
        `${locale}: that row carries a revoke control [S100]`,
        Boolean(revokeForm),
      );
      if (!revokeForm) continue;

      const revoked = await post(envelopeOf(revokeForm));
      check(
        `${locale}: *** revoking answers 200, not 500 *** [S100]`,
        revoked === 200,
        `got ${revoked}`,
      );

      // Both halves, and neither is the list being empty: the row it revoked
      // is gone, and every row it did NOT revoke survives. The second is what
      // proves it revoked the right one `S100`.
      const after = shareRows((await get(jar, `/${locale}/companies/${id}`)).body);
      check(
        `${locale}: the row it revoked leaves the live list [S100]`,
        !after.some((row) => row.includes(recipientName)),
      );
      check(
        `${locale}: shares it did not revoke are untouched [S100]`,
        after.length === before.length,
        `${before.length} live before the grant, ${after.length} after the revoke`,
      );
    }

    // The negative half, and the one that matters: a rep holds no `can_share`,
    // so the control is simply not rendered `[facet-ui]`. The data layer
    // refuses regardless — `verify:sharing` §2 is where that is asserted.
    const repJar = jars["rep-a@example.test"];
    const repList = await get(repJar, "/en/companies");
    const repCompany = firstId(repList.body, "companies");
    if (repCompany) {
      const repPage = await get(repJar, `/en/companies/${repCompany}`);
      check(
        "a rep is NOT offered the grant form — no can_share [S96]",
        !repPage.body.includes('data-slot="sharing-grant"'),
      );
    } else {
      console.log("  --    rep-a holds no company to check the gate on");
    }
  }

  // **No longer `OPEN — no rule`.** `D34` names the act — *Plan sets a
  // follow-up date and moves the row into a day* — so the date has a design
  // rule behind it now, even though `SPEC.md` still does not say it, which
  // `D34` states about itself. This section drives the PANEL; section 19
  // drives the waiting-list row. `S91` may still delete the machinery.
  console.log(
    "\n11. The next follow-up date, set and cleared for real [D34], [25 §18]",
  );
  {
    // **`verify:followups` drives `setNextFollowUp`; this drives the FORM.**
    // The two do not overlap: the in-process script never touches
    // `readFields`, the bound `$ACTION` envelope, or the native date input —
    // and the panel is on three screens, so a marker check on each is the only
    // thing that catches one wired up wrong.
    const jar = jars["manager@example.test"];

    // The panel hangs on all three anchors `25 §18` names, so all three are
    // walked rather than one standing in for the others.
    const anchors = [
      { section: "companies", label: "company" },
      { section: "projects", label: "project" },
      { section: "quotations", label: "quotation thread" },
    ] as const;

    for (const locale of ["en", "ar"] as const) {
      for (const anchor of anchors) {
        const list = await get(jar, `/${locale}/${anchor.section}`);
        const id = firstId(list.body, anchor.section);
        if (!id) {
          console.log(`  --    ${locale}: no ${anchor.label} to date`);
          continue;
        }

        const path = `/${locale}/${anchor.section}/${id}`;
        const page = await get(jar, path);
        check(
          `${locale}: the ${anchor.label} screen carries the panel [OPEN — no rule]`,
          page.body.includes('data-slot="next-follow-up"'),
        );

        const setForm = page.body.match(
          /<form[^>]*data-slot="next-follow-up-set"[\s\S]*?<\/form>/,
        )?.[0];
        check(
          `${locale}: the ${anchor.label} panel offers the date field`,
          Boolean(setForm?.includes('name="nextFollowUpAt"')),
        );
        if (!setForm) continue;

        const post = async (body: FormData): Promise<number> => {
          const response = await fetch(`${BASE}${path}`, {
            method: "POST",
            headers: { cookie: header(jar), origin: BASE },
            body,
            redirect: "manual",
          });
          store(jar, response);
          return response.status;
        };

        // Far enough ahead that it cannot be today's date by accident, which
        // would make the "it is set" assertion pass on an empty write.
        const future = new Date(Date.now() + 30 * 86_400_000)
          .toISOString()
          .slice(0, 10);
        const set = envelopeOf(setForm);
        set.set("nextFollowUpAt", future);
        const stored = await post(set);
        check(
          `${locale}: *** dating a ${anchor.label} answers 200, not 500 *** [OPEN — no rule]`,
          stored === 200,
          `got ${stored}`,
        );

        const afterSet = await get(jar, path);
        check(
          `${locale}: the ${anchor.label} panel now names who set it [OPEN — no rule]`,
          afterSet.body.includes('data-slot="next-follow-up-set-by"'),
        );

        // A past date is a `RuleError` through `ruleErrorState`, so the right
        // answer is a 200 carrying the message. A 500 is the defect.
        const past = envelopeOf(setForm);
        past.set("nextFollowUpAt", "2020-01-01");
        const refused = await post(past);
        check(
          `${locale}: a past date on a ${anchor.label} is refused, not a 500`,
          refused === 200,
          `got ${refused}`,
        );

        const clearForm = afterSet.body.match(
          /<form[^>]*data-slot="next-follow-up-clear"[\s\S]*?<\/form>/,
        )?.[0];
        check(
          `${locale}: a dated ${anchor.label} offers the clear`,
          Boolean(clearForm),
        );
        if (!clearForm) continue;

        const cleared = await post(envelopeOf(clearForm));
        check(
          `${locale}: *** clearing answers 200, not 500 *** [OPEN — no rule]`,
          cleared === 200,
          `got ${cleared}`,
        );

        const afterClear = await get(jar, path);
        check(
          `${locale}: cleared, the ${anchor.label} names nobody`,
          !afterClear.body.includes('data-slot="next-follow-up-set-by"'),
        );
      }
    }
  }

  console.log("\n12. Nothing reads like a message key that failed to resolve");
  {
    // Accumulated by `scanForUnresolvedKeys` over every page fetched above —
    // so this covers all three identities, both locales, both themes and every
    // record screen, without a line of its own in any of them.
    check(
      `no visible text is <namespace>.<key> — ${NAMESPACES.length} namespaces watched`,
      leaked.size === 0,
      `${leaked.size} found`,
    );
    for (const [key, path] of leaked) {
      console.log(`        ${key}   first seen on ${path}`);
    }
    if (leaked.size > 0) {
      console.log(
        "\n  A key rendering as text means next-intl found no message for it.\n" +
          "  Check `npm run check:messages` — and if that is green, the server\n" +
          "  is serving a catalogue older than the file. See section 0.",
      );
    }
  }

  console.log(
    "\n13. Registering a company, posted for real [S13], [S14], [S15]",
  );
  {
    // **Deliberately after the key sweep**, unlike every other replay section.
    // Section 12 is written to scan everything fetched before it, and every
    // string this section renders — `common.country` on the form and on the
    // detail screen — is already on `/companies/new` and on a company detail
    // that sections 2 and 3 fetched. Nothing is lost, and section 12 keeps the
    // number `CLAUDE.md` gives it.
    //
    // A rep, not the manager: `S18` makes the creating rep the primary rep, and
    // registering a company is the rep's screen `D55`.
    //
    // **The city IS in reach now, and that is session 40's point.** It was a
    // `Combobox` in a Radix portal, so its options were not in the server HTML
    // and this script had no city id to post; under the rewritten `D20` that
    // was not an inconvenience for the walk, it was `S15`'s registration being
    // impossible for a person with scripts off. It is a native `<select>`
    // grouped by region, so the ids are in the markup.
    //
    // **What that adds here is the reachability half**, below: the city select
    // offers real uuid options, which is the difference between a POST this
    // script can write and a body a PERSON could have produced. The refusal
    // this section drives is unchanged and is still the EMPTY-city path, so
    // this section still writes no Saudi company — `§14` owns the accepted
    // path, and `WORKFLOW §5` counts what every run writes.
    //
    // **This section used to assert the defect it was creating** `[AUDIT 1 F3]`.
    // It posted `region=center` with an empty `cityId` and then checked that
    // the region had been KEPT — which is exactly what `S15` forbids, and it
    // was the sole writer of all 50 companies that carried a hand-typed region.
    // Its comment cited `15 §4`, an archive document, which `CLAUDE.md` says is
    // never authority. The rule was `S15` all along.
    //
    // So both halves invert. No region is posted, because no form offers one;
    // and the payload that used to be ACCEPTED for Saudi Arabia must now be
    // REFUSED, because a Saudi company needs a city and this script cannot
    // supply one. The abroad half is unchanged and is what keeps the pair
    // honest: the two POSTs still differ in nothing but the country, and they
    // must still end differently.
    const jar = jars["rep-a@example.test"];
    const stamp = `${Date.now()}`.slice(-7);
    let phoneSeq = 0;

    for (const locale of ["en", "ar"] as const) {
      const form = await get(jar, `/${locale}/companies/new`);
      check(
        `${locale}: the register form asks country BEFORE city [S14]`,
        form.body.includes('name="countryId"') &&
          form.body.indexOf('name="countryId"') <
            form.body.indexOf('name="cityId"'),
      );

      // `data-code` is a DOM marker, not a translated string `[23]`, exactly so
      // this black-box script can find Saudi Arabia. `"SA"` here is the literal
      // `SAUDI_CODE` in `src/lib/enums.ts`; this file never imports `src/`, so
      // it is repeated rather than shared — the same trade as section 7's
      // `"other"`.
      const countrySelect = form.body.match(
        /<select[^>]*name="countryId"[\s\S]*?<\/select>/,
      )?.[0];
      const optionFor = (code: string) =>
        countrySelect?.match(
          new RegExp(`<option value="([0-9a-f-]{36})"[^>]*data-code="${code}"`),
        )?.[1];
      const saudiId = optionFor("SA");
      const foreignId = countrySelect
        ? [
            ...countrySelect.matchAll(
              /<option value="([0-9a-f-]{36})"[^>]*data-code="([A-Z]{2})"/g,
            ),
          ].find((match) => match[2] !== "SA")?.[1]
        : undefined;
      check(
        `${locale}: the country select offers Saudi Arabia and somewhere else [S14]`,
        Boolean(saudiId) && Boolean(foreignId),
        `SA ${saudiId ?? "missing"}, other ${foreignId ?? "missing"}`,
      );
      if (!saudiId || !foreignId) continue;

      // Saudi is preselected `S14`, which is why the city field is on the page
      // at all before a rep touches anything.
      check(
        `${locale}: Saudi Arabia is preselected, so the city field is rendered`,
        form.body.includes('name="cityId"'),
      );
      // **The assertion this section exists for now.** `S15` — the rep is never
      // asked for a region, so no control carries that name in any state.
      // `FormField`'s own `name` becomes a `for=` and an error `id`, never a
      // posted field, so this string appears in the HTML only if a real input
      // or select is back.
      check(
        `${locale}: *** the register form asks for NO region *** [S15]`,
        !form.body.includes('name="region"'),
      );

      // **`D20`'s operability half, at the one field that proves it.** `S15`
      // makes a city mandatory for a Saudi company, so if the control cannot
      // offer one the record cannot be created at all with scripts off. This
      // asserts the ids are in the markup a browser receives — the very thing
      // the `Combobox` did not do, and the reason section 40 exists. §23
      // asserts the control's SHAPE; this asserts it has something to say.
      const citySelect = form.body.match(
        /<select[^>]*name="cityId"[\s\S]*?<\/select>/,
      )?.[0];
      const cityOptions = citySelect
        ? [...citySelect.matchAll(/<option value="([0-9a-f-]{36})"/g)].length
        : 0;
      check(
        `${locale}: *** the city is a native select offering real cities *** [S15], [D20]`,
        cityOptions > 0,
        `${cityOptions} option(s)`,
      );
      // Grouped by region `S15` — the relationship the city already carries,
      // and what makes 171 rows navigable in one control.
      check(
        `${locale}: the city select is grouped by region [S15]`,
        (citySelect?.match(/<optgroup/g) ?? []).length > 1,
      );

      /**
       * The action envelope plus what a browser would send.
       *
       * **The phone is set here, not by each caller.** It was a caller's job
       * for one revision, and the abroad POST was written without one — which
       * the action then refused with a 200, exactly as `S13` says it should.
       * The check that caught it was reading the country, so a real defect in
       * this section's own fixture looked like a defect in `placeForCountry`.
       * One place sets it; the no-phone case clears it deliberately.
       */
      const fieldsFor = (country: string, label: string): FormData => {
        const fields = new FormData();
        for (const input of form.body.matchAll(/<input[^>]*>/g)) {
          const name = input[0].match(/name="([^"]+)"/)?.[1];
          if (!name?.startsWith("$ACTION")) continue;
          fields.append(
            name,
            unescapeHtml(input[0].match(/value="([^"]*)"/)?.[1] ?? ""),
          );
        }
        fields.set("name", `routes-${stamp}-${locale}-${label}`);
        // Distinct per run and per company: `S23` makes the phone the matching
        // key, and this script keeps its rows `[12 §7]`, so a fixed literal
        // would make every run's companies duplicates of the last run's.
        fields.set("phone", `+9665${stamp}${phoneSeq++}`);
        fields.set("countryId", country);
        // **No region is set.** The form offers no such field `S15`, so an
        // untouched form sends none, and a payload that invented one would be
        // testing a control that does not exist.
        //
        // The rest, empty, exactly as an untouched form would send them —
        // `cityId` included, which is what makes the Saudi POST below the
        // no-city case.
        for (const empty of [
          "cityId",
          "categoryId",
          "leadSourceId",
          "notes",
        ]) {
          fields.set(empty, "");
        }
        return fields;
      };

      const post = async (body: FormData) => {
        const response = await fetch(`${BASE}/${locale}/companies/new`, {
          method: "POST",
          headers: { cookie: header(jar), origin: BASE },
          body,
          redirect: "manual",
        });
        store(jar, response);
        return {
          status: response.status,
          location: response.headers.get("location") ?? "",
        };
      };

      /* --- S13: no phone is refused, and refused as a MESSAGE --------- */

      // `required` on the input is the browser's, and a POST skips it entirely.
      // This is the only proof the SERVER refuses on its own terms — and that
      // it refuses with a field error rather than letting the NOT NULL surface
      // as a 500. `useActionState` re-renders the form, so 200, not 303.
      const noPhone = fieldsFor(saudiId, "nophone");
      noPhone.set("phone", "");
      const refused = await post(noPhone);
      check(
        `${locale}: *** registering with no phone answers 200, not 303 or 500 *** [S13]`,
        refused.status === 200,
        `got ${refused.status} ${refused.location}`,
      );

      /* --- S15: Saudi needs a city, abroad has none ------------------- */

      // **Refused, where this used to be accepted.** `S15` derives the region
      // from the city, so a Saudi company without one has nothing to derive
      // from — `placeForCountry` raises `validation.required` against `cityId`
      // and `useActionState` re-renders the form, so 200, not 303. The same
      // shape as the no-phone case above, and for the same reason: this is the
      // only proof the SERVER refuses on its own terms rather than the browser
      // doing it, since a POST skips `required` entirely.
      const refusedCity = await post(fieldsFor(saudiId, "saudi"));
      check(
        `${locale}: *** registering a Saudi company with NO city answers 200, not 303 *** [S15]`,
        refusedCity.status === 200,
        `got ${refusedCity.status} ${refusedCity.location}`,
      );

      // **The assertion that matters, and the reason both POSTs are still
      // sent.** A refusal proves nothing on its own: a `placeForCountry` whose
      // Saudi token never matched would refuse nothing and a broken one that
      // refused everything would pass the check above. Only the PAIR says which
      // branch was taken, because the two payloads differ in nothing but the
      // country — and it catches the token being wrong in either direction.
      const abroad = await post(fieldsFor(foreignId, "abroad"));
      check(
        `${locale}: registering a company outside Saudi Arabia answers 303 [S14]`,
        abroad.status === 303,
        `got ${abroad.status}`,
      );
      if (abroad.status !== 303) continue;

      const abroadPath = abroad.location.replace(BASE, "");
      const abroadDetail = await get(jar, abroadPath);
      check(
        `${locale}: *** a company abroad stores NO city *** [S15]`,
        factOf(abroadDetail.body, "city") === DASH,
        `city reads "${factOf(abroadDetail.body, "city")}"`,
      );
      check(
        `${locale}: *** …and NO region, because it has no city to imply one *** [S15]`,
        factOf(abroadDetail.body, "region") === DASH,
        `region reads "${factOf(abroadDetail.body, "region")}"`,
      );
      check(
        `${locale}: …and its country reads back, and is not Saudi Arabia [S14]`,
        factOf(abroadDetail.body, "country") !== DASH,
        `country reads "${factOf(abroadDetail.body, "country")}"`,
      );

      // The edit screen drops the city abroad — the form half of the same
      // rule — and asks for a region on neither screen `S15`. Asserted AFTER
      // the stored values, never instead of them: this branch is computed in
      // the browser from the same constant, so it would agree with a
      // `placeForCountry` that had the token wrong.
      //
      // There is no Saudi EDIT screen asserted beside it any more, and that is
      // a consequence rather than an omission: this section can no longer
      // create a Saudi company over HTTP, so it owns none to open. The positive
      // side of the same `isSaudi` branch is asserted on `/companies/new`
      // above — the identical component, with Saudi preselected.
      const edit = await get(jar, `${abroadPath}/edit`);
      check(
        `${locale}: the edit form drops the city abroad [S15]`,
        !edit.body.includes('name="cityId"'),
      );
      check(
        `${locale}: *** …and asks for no region there either *** [S15]`,
        !edit.body.includes('name="region"'),
      );
    }
  }

  console.log(
    "\n14. A quotation creates its project, then attaches to it [S50], [S74]",
  );
  {
    // **The one chain no in-process script can drive.** `verify:slice3` §15
    // proves S74's rules against the data layer; this proves the SCREENS —
    // that a rep raising a quotation creates its project in the same act, that
    // raising with neither a project nor a name is refused rather than
    // redirecting, that the same company's next quotation can be raised ONTO
    // that project, and that the project reads back on three screens: the
    // quotation, the dispatch, and the project's own participants.
    //
    // That last one is why this section exists at all. `S26`'s derived figure
    // has never been asserted over HTTP, because no route-suite identity owned
    // a project with a participant that had dispatched. This gives rep-a one.
    //
    // **The thread IS issued here, and that is `S126`.** It deliberately was
    // not until this slice — nothing in `S73` or `S74` depends on a SMAC
    // reference, so the walk saved a POST and drove the null-reference label
    // on the way past. `S126` makes an issued version the condition of
    // dispatching at all, so the issue form is now part of this chain, and the
    // POST that used to work before it is asserted as a refusal instead.
    const leakedBefore = leaked.size;
    const stamp = `${Date.now()}`.slice(-7);
    let phoneSeq = 0;
    /** `S118`'s rendered stock label per locale — compared after the loop. */
    const stockLabels = new Map<string, string>();

    for (const locale of ["en", "ar"] as const) {
      const repJar = jars["rep-a@example.test"];
      const coordJar = jars["coordinator@example.test"];

      /** Every `$ACTION…` input of one form, unescaped, as a browser sends it. */
      const envelope = (form: string): FormData => {
        const fields = new FormData();
        for (const input of form.matchAll(/<input[^>]*>/g)) {
          const name = input[0].match(/name="([^"]+)"/)?.[1];
          if (!name?.startsWith("$ACTION")) continue;
          fields.append(
            name,
            unescapeHtml(input[0].match(/value="([^"]*)"/)?.[1] ?? ""),
          );
        }
        return fields;
      };

      /**
       * The body is returned as well as the status, which this helper used to
       * discard. A refusal answers 200 and re-renders the form, so the ONLY
       * evidence of which rule refused is in that markup.
       */
      const post = async (jar: Jar, path: string, body: FormData) => {
        // **Bounded, so a stall is a named failure rather than a hung run.**
        // This chain used to carry a second helper that posted and declined to
        // wait, because two of its forms never answered at all; section 17 now
        // asserts that they do, and nothing here may quietly tolerate silence
        // again. `status: 0` is the sentinel — no call site expects it, so
        // every one of them fails on it with the status printed.
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), 8000);
        try {
          const response = await fetch(`${BASE}${path}`, {
            method: "POST",
            headers: { cookie: header(jar), origin: BASE },
            body,
            redirect: "manual",
            signal: abort.signal,
          });
          store(jar, response);
          return {
            status: response.status,
            location: response.headers.get("location") ?? "",
            body: await response.text(),
          };
        } catch {
          return { status: 0, location: "", body: "" };
        } finally {
          clearTimeout(timer);
        }
      };

      /* --- a company of its own, so the participant is genuinely new ---- */

      // Not one of rep-a's existing companies: those are already participants
      // of the fixture project, and "the company joined the project" would
      // then be true before the dispatch ran. Registered through the form
      // section 13 just proved, so this costs no new assertion.
      const newCompany = await get(repJar, `/${locale}/companies/new`);
      const companyForm = newCompany.body.match(
        /<form[^>]*data-slot="form-shell"[\s\S]*?<\/form>/,
      )?.[0];
      const saudiId = newCompany.body
        .match(/<select[^>]*name="countryId"[\s\S]*?<\/select>/)?.[0]
        ?.match(/<option value="([0-9a-f-]{36})"[^>]*data-code="SA"/)?.[1];
      // `S15` — a Saudi company needs a city. It used to be taken from the
      // database in raw SQL, because the `Combobox` put no option in the HTML;
      // the control is a native `<select>` now `D20`, so the id comes off the
      // very form this POST is filling, the way every other field here does.
      // That deletes this file's only reach past HTTP. Section 13 owns both
      // halves of the rule; this section only needs a company.
      const cityId = newCompany.body
        .match(/<select[^>]*name="cityId"[\s\S]*?<\/select>/)?.[0]
        ?.match(/<option value="([0-9a-f-]{36})"/)?.[1];
      if (!companyForm || !saudiId || !cityId) {
        check(`${locale}: the company form is reachable`, false);
        continue;
      }
      const companyFields = envelope(companyForm);
      companyFields.set("name", `s74-${stamp}-${locale}`);
      companyFields.set("phone", `+9665${stamp}${phoneSeq++}`);
      companyFields.set("countryId", saudiId);
      companyFields.set("cityId", cityId);
      for (const empty of [
        "categoryId",
        "leadSourceId",
        "notes",
      ]) {
        companyFields.set(empty, "");
      }
      const registered = await post(
        repJar,
        `/${locale}/companies/new`,
        companyFields,
      );
      if (registered.status !== 303) {
        check(
          `${locale}: the fixture company registered`,
          false,
          `got ${registered.status}`,
        );
        continue;
      }
      const companyId = registered.location.match(/[0-9a-f-]{36}/)?.[0];

      /* --- 1. raised, creating its project in the same act [S50] -------- */

      const newQuotation = await get(repJar, `/${locale}/quotations/new`);
      const quotationForm = newQuotation.body.match(
        /<form[^>]*data-slot="form-shell"[\s\S]*?<\/form>/,
      )?.[0];
      check(
        `${locale}: the quotation form renders`,
        Boolean(quotationForm) && newQuotation.status === 200,
      );
      if (!quotationForm || !companyId) continue;

      // `S50` — the company is the FIRST field now, and the projects offered
      // narrow to it. The company registered a moment ago holds none, so what
      // the form must offer is the new-project branch: that it is IN the
      // markup, and that the marker says which branch is showing.
      check(
        `${locale}: the new company is offered as the first field [S50]`,
        quotationForm.includes(`value="${companyId}"`),
      );
      check(
        `${locale}: *** and the project defaults to a NEW one *** [S50]`,
        quotationForm.includes('data-project-mode="new"'),
        "no data-project-mode marker on the raise form",
      );
      check(
        `${locale}: …with a name input beside it, not a bare picker [S50]`,
        quotationForm.includes('name="newProjectName"'),
      );

      /** The first real option of a named `<select>` — never the placeholder. */
      const optionOf = (name: string) =>
        quotationForm
          .match(new RegExp(`<select[^>]*name="${name}"[\\s\\S]*?</select>`))?.[0]
          ?.match(/<option value="([0-9a-f-]{36})"/)?.[1];

      const line = {
        supplierId: optionOf("supplierId"),
        classId: optionOf("classId"),
        fireRatingId: optionOf("fireRatingId"),
        thicknessId: optionOf("thicknessId"),
      };
      if (Object.values(line).some((id) => !id)) {
        // `npm run db:seed` has not run. A missing precondition, not a defect.
        console.log(`  skip  ${locale}: the product lookups are not seeded`);
        continue;
      }

      // `S116` — one dispatch line, posted through the same repeated inputs
      // `LineFields` renders on both forms. **Different from the quotation's**
      // on purpose: half the pieces at a different price, which is `S75`'s
      // middle route and what `S120` will later have to see as a gap.
      const dispatchLine: Record<string, string> = {
        supplierId: line.supplierId as string,
        classId: line.classId as string,
        fireRatingId: line.fireRatingId as string,
        thicknessId: line.thicknessId as string,
        customColour: "168",
        widthM: "1.2",
        lengthM: "2.4",
        quantityPcs: "5",
        unitPrice: "88",
      };

      // `S57` — the input is gone from the markup, not merely ignored by
      // the action. A field the form still renders is a field a rep can still
      // fill. It moved here when `S67` took the section that used to carry it:
      // this one already has the form in hand, in both locales.
      check(
        `${locale}: the line form offers NO VAT rate input [S57]`,
        !quotationForm.includes('name="vatRate"'),
      );

      const quotationFields = envelope(quotationForm);
      // **The project id is sent EMPTY and a NAME is sent beside it**, exactly
      // as an untouched form sends it: the empty value of the `<select>` IS
      // the new-project branch, and the name input under it carries what the
      // project is called. This is the POST `S50` exists for.
      const newProjectName = `${stamp}-${locale} project`;
      quotationFields.set("projectId", "");
      quotationFields.set("newProjectName", newProjectName);
      quotationFields.set("companyId", companyId);
      quotationFields.set("contactId", "");
      for (const empty of ["paymentMethod", "shipmentTerms"]) {
        quotationFields.set(empty, "");
      }
      // `S118` — the rep chooses one stock when raising. `verify:slice2` §14
      // proves the value round-trips and survives a revision; what belongs
      // here is that the form asks for it and the action refuses without it.
      quotationFields.set("stock", "riyadh");
      for (const [name, value] of Object.entries(line)) {
        quotationFields.set(name, value as string);
      }
      quotationFields.set("customColour", "168");
      quotationFields.set("widthM", "1.2");
      quotationFields.set("lengthM", "2.4");
      quotationFields.set("quantityPcs", "10");
      quotationFields.set("unitPrice", "95");
      // **No VAT field is posted, because the form offers none** `S57`.
      // This used to scrape the form's own default. Section 12 below
      // asserts the input is gone rather than trusting that it is.

      // `S118` — the same POST with the stock cleared, sent BEFORE the good
      // one so it cannot be mistaken for a duplicate-submission refusal.
      //
      // **"It did not answer 303" is not the assertion.** A POST whose
      // `$ACTION` envelope never matched — the HTML-escaped `&quot;` trap the
      // `envelope` helpers above exist to avoid — also fails to redirect, and
      // would score as a pass with nothing validated at all. So what is
      // asserted is that the action RAN AND REFUSED: 200 (`useActionState`
      // re-renders, so never 303 and never 500), carrying the marker
      // `FormField` emits only when `errors.stock` is set. A form-wide error
      // does not produce it and an unmatched action cannot.
      const stockless = new FormData();
      for (const [name, value] of quotationFields.entries()) {
        stockless.append(name, name === "stock" ? "" : value);
      }
      const refusedStock = await post(
        repJar,
        `/${locale}/quotations/new`,
        stockless,
      );
      check(
        `${locale}: *** raising a quotation with NO stock answers 200, not 303 or 500 *** [S118]`,
        refusedStock.status === 200,
        `got ${refusedStock.status} ${refusedStock.location}`,
      );
      check(
        `${locale}: …and the error comes back ON the stock field [S118]`,
        refusedStock.body.includes('id="stock-error"'),
        "no stock-error marker in the re-rendered form",
      );

      // **`S50`'s own refusal, and 303 is no longer the answer.** Neither a
      // project nor a name is what the old form sent every time; it must now
      // come back as a message on the field. Sent BEFORE the good one so it
      // cannot be mistaken for a duplicate-submission refusal, and asserted
      // the way the stockless POST above is: the action RAN and REFUSED.
      const nameless = new FormData();
      for (const [name, value] of quotationFields.entries()) {
        nameless.append(name, name === "newProjectName" ? "" : value);
      }
      const refusedProject = await post(
        repJar,
        `/${locale}/quotations/new`,
        nameless,
      );
      check(
        `${locale}: *** raising with NO project and no name answers 200, not 303 *** [S50]`,
        refusedProject.status === 200,
        `got ${refusedProject.status} ${refusedProject.location}`,
      );
      check(
        `${locale}: …and the error comes back ON the project field [S50]`,
        refusedProject.body.includes('id="projectId-error"'),
        "no projectId-error marker in the re-rendered form",
      );

      const raised = await post(
        repJar,
        `/${locale}/quotations/new`,
        quotationFields,
      );
      check(
        `${locale}: *** raising a quotation that CREATES its project answers 303 *** [S50]`,
        raised.status === 303,
        `got ${raised.status} ${raised.location}`,
      );
      if (raised.status !== 303) continue;

      const threadPath = raised.location.replace(BASE, "");
      const threadId = threadPath.match(/[0-9a-f-]{36}/)?.[0] as string;

      /* --- 2. and the project it made is ON the quotation --------------- */

      const thread = await get(repJar, threadPath);
      check(
        `${locale}: *** the quotation names the project it created *** [S50]`,
        factOf(thread.body, "project") === newProjectName,
        factOf(thread.body, "project"),
      );
      // Neither of the two shapes an absent value takes. The `Absent` marker
      // is what a project-less quotation used to render and no longer can;
      // the em-dash is what every other empty value renders as.
      check(
        `${locale}: …not as absent and not as the em-dash [S50]`,
        !factHtmlOf(thread.body, "project").includes('data-slot="fact-absent"') &&
          factOf(thread.body, "project") !== DASH,
        factHtmlOf(thread.body, "project"),
      );
      const projectId = thread.body.match(
        /href="\/(?:en|ar)\/projects\/([0-9a-f-]{36})"/i,
      )?.[1] as string;
      check(
        `${locale}: …and links it, so the rep owns what he just made [S30]`,
        Boolean(projectId),
        "no project link on the quotation the rep raised",
      );
      if (!projectId) continue;

      // `S118` — the stock reads on the screen, through the translation layer.
      // The rendered text is recorded rather than compared to a literal: an
      // assertion on "Riyadh" would be an assertion on a translated string,
      // which this script may not make. What it may say is that the cell is
      // filled and is not an empty value; the two locales are compared to each
      // other after the loop, which proves the label was looked up.
      const stockFact = factOf(thread.body, "stock");
      stockLabels.set(locale, stockFact);
      check(
        `${locale}: the version says which stock it is drawn from [S118]`,
        stockFact.length > 0 && stockFact !== DASH,
        `got "${stockFact}"`,
      );

      /* --- 3. the strip draws the position it is really in [S132] ------ */

      // **The payment drive lived here and is gone** `S133`. It filled the
      // `confirmedOn` form, waited for the POST, then asserted the strip read
      // `paid`. There is no such form, no such act and no such rung: `S70`
      // records payment on the dispatch and `S73` makes a method a condition
      // of approving one, so nothing sits between accepted and dispatched.
      //
      // What replaces it is the claim the old block was really making - that
      // the strip reads the thread's real position and not a hopeful one.
      // This thread is raised and not yet issued, so `S132` puts it at
      // `requested`, owed by the coordinator.
      check(
        `${locale}: *** the strip reads requested before it is issued *** [S132]`,
        stripOf(thread.body)?.position === "requested",
        `chain reads ${stripOf(thread.body)?.position ?? "nothing"}`,
      );
      check(
        `${locale}: …and no payment form is offered anywhere on it [S133]`,
        !thread.body.includes('name="confirmedOn"') &&
          !thread.body.includes('data-act="confirm-payment"'),
        "a payment form is still rendered",
      );

      /* --- 3b. it must be ISSUED before it is dispatchable [S126] ------ */

      // The picker is the first half of the rule: what the action refuses is
      // never offered. `S126` narrowed `listDispatchableThreads` from the live
      // version to the issued one, so a thread still being edited `S61` drops
      // out of it.
      const beforeIssue = await get(coordJar, `/${locale}/dispatches/new`);
      check(
        `${locale}: *** an UNISSUED quotation is not offered *** [S126]`,
        !new RegExp(`<option[^>]*value="${threadId}"`).test(beforeIssue.body),
        "the form offers what the action refuses",
      );

      // And the second half, past the picker. A hand-made POST is the only way
      // to reach it, which is the point: the rule lives in the data layer, not
      // in the dropdown. **The lines are sent in full** so the refusal is
      // `S126`'s and not the line reader's — "it did not 303" is not the
      // assertion, the error landing ON the quotation field is.
      const earlyForm = beforeIssue.body.match(
        /<form[^>]*data-slot="form-shell"[\s\S]*?<\/form>/,
      )?.[0];
      if (earlyForm) {
        const early = envelope(earlyForm);
        early.set("quotationThreadId", threadId);
        early.set("projectId", "");
        early.set("dispatchDate", "2026-08-18");
        // `S130` `S119` — the form asks for both, so the POST sends both. Left
        // out, this would 200 on a missing-field error and the assertion below
        // would pass for the wrong reason instead of on `S126`.
        early.set("stock", "riyadh");
        early.set("shipment", "ct");
        for (const [name, value] of Object.entries(dispatchLine)) {
          early.set(name, value as string);
        }
        const refusedUnissued = await post(
          coordJar,
          `/${locale}/dispatches/new`,
          early,
        );
        check(
          `${locale}: *** dispatching an unissued quotation answers 200, not 303 *** [S126]`,
          refusedUnissued.status === 200,
          `got ${refusedUnissued.status} ${refusedUnissued.location}`,
        );
        check(
          `${locale}: …and the error comes back ON the quotation field [S126]`,
          refusedUnissued.body.includes('id="quotationThreadId-error"'),
          "no quotationThreadId-error marker in the re-rendered form",
        );
      } else {
        check(`${locale}: the dispatch form renders before issue`, false);
      }

      /* --- 3c. the coordinator issues it [S126] ------------------------- */

      const beforeIssueThread = await get(coordJar, threadPath);
      const issueForm = beforeIssueThread.body.match(
        /<form[^>]*>(?:(?!<\/form>)[\s\S])*?name="smacReference"[\s\S]*?<\/form>/,
      )?.[0];
      check(
        `${locale}: the issue form is on the coordinator's screen`,
        Boolean(issueForm),
      );
      if (!issueForm) continue;
      const issueFields = envelope(issueForm);
      issueFields.set("smacReference", `${stamp}-${locale}`);
      issueFields.set("verification", "unverified");
      // Waited for, as every real POST in this walk is `WORKFLOW §5`.
      const issuePost = await post(coordJar, threadPath, issueFields);
      check(
        `${locale}: the issue POST answers [WORKFLOW §5]`,
        issuePost.status === 200,
        issuePost.status === 0
          ? "NO REPLY within 8s — the hang is back"
          : `got ${issuePost.status}`,
      );

      /* --- 4. the coordinator's form offers it, and asks for no project -- */

      const dispatchNew = await get(coordJar, `/${locale}/dispatches/new`);
      const option = dispatchNew.body.match(
        new RegExp(`<option[^>]*value="${threadId}"[^>]*>`),
      )?.[0];
      check(
        `${locale}: the issued quotation is offered for dispatch [S74]`,
        Boolean(option),
        "not in the list — did the issue POST fail?",
      );
      // `S50` took the picker off this form: the project comes from the
      // quotation, so a control here would be a value the coordinator could
      // only get wrong. That the INPUT is gone is the assertion — a field the
      // form still renders is a field somebody can still fill.
      check(
        `${locale}: *** and the form offers NO project picker *** [S74], [S50]`,
        !dispatchNew.body.includes('name="projectId"'),
        "the dispatch form still renders a project input",
      );

      /* --- 5. dispatched, taking the project the quotation names [S74] -- */

      // A second project of rep-a's, for the disagreement refusal in block 10.
      // It is only ever posted by hand: no form offers it any more.
      const projectsList = await get(repJar, `/${locale}/projects`);
      const otherIds = [
        ...new Set(
          [
            ...projectsList.body.matchAll(
              /href="\/(?:en|ar)\/projects\/([0-9a-f-]{36})"/gi,
            ),
          ].map((match) => match[1]),
        ),
      ].filter((id) => id !== projectId);

      const dispatchForm = dispatchNew.body.match(
        /<form[^>]*data-slot="form-shell"[\s\S]*?<\/form>/,
      )?.[0];
      if (!dispatchForm) {
        check(`${locale}: the dispatch form renders`, false);
        continue;
      }
      // `S74` — the project is only ever posted by hand now, to reach the
      // refusal. An empty string is what the real form sends, because it sends
      // no project field at all.
      const dispatchFields = (project: string): FormData => {
        const fields = envelope(dispatchForm);
        fields.set("quotationThreadId", threadId);
        fields.set("projectId", project);
        // `S116` — **no `sqm` field is posted, because the form offers none.**
        // The square metres are the lines', generated by the database. Section
        // 12 asserts the input is gone rather than trusting that it is.
        fields.set("dispatchDate", "2026-08-18");
        // `S130` `S119` — the rep's two choices, with Cargo's destination
        // deliberately absent: it is optional, and the form only renders it
        // when Cargo is chosen.
        fields.set("stock", "riyadh");
        fields.set("shipment", "ct");
        for (const [name, value] of Object.entries(dispatchLine)) {
          fields.set(name, value);
        }
        return fields;
      };

      const dispatched = await post(
        coordJar,
        `/${locale}/dispatches/new`,
        dispatchFields(""),
      );
      check(
        `${locale}: *** dispatching it answers 303 *** [S74]`,
        dispatched.status === 303,
        `got ${dispatched.status} ${dispatched.location}`,
      );
      if (dispatched.status !== 303) continue;

      const dispatchPath = dispatched.location.replace(BASE, "");
      const dispatchPage = await get(coordJar, dispatchPath);

      // `S72` — what landed is a **request**, not a dispatch. The screen says
      // so with a status marker rather than a translated word, and the turn
      // panel names whose move it is `D2`.
      check(
        `${locale}: *** posting the form raises a REQUEST, not a dispatch *** [S72]`,
        dispatchPage.body.includes('data-status="draft"'),
        factOf(dispatchPage.body, "status"),
      );
      check(
        `${locale}: …and the screen says whose move it is [D2], [S86]`,
        dispatchPage.body.includes('data-slot="turn-panel"'),
      );
      // Not approved yet, so there is no approver and no credit table.
      check(
        `${locale}: an unapproved request names no approver [S72]`,
        factOf(dispatchPage.body, "approvedBy") === DASH,
        factOf(dispatchPage.body, "approvedBy"),
      );

      // `S116` — the lines landed and the screen shows them. A DOM marker,
      // never the rendered numbers: what is asserted is that the dispatch
      // carries its own lines, and one row is one line.
      //
      // **Scoped to `data-slot="dispatch-lines"`**, and it has to be since
      // `S120`: a flagged dispatch renders the quotation version's lines in a
      // second card beside them, with `data-line` markers of their own. An
      // unscoped count over the page would read those as the dispatch's and
      // report two lines where one went out.
      const linesFrom = dispatchPage.body.indexOf('data-slot="dispatch-lines"');
      const linesTo = dispatchPage.body.indexOf('data-slot="quoted-lines"');
      const own = dispatchPage.body.slice(
        linesFrom,
        linesTo > linesFrom ? linesTo : undefined,
      );
      const lineRows = [...own.matchAll(/data-line="[0-9a-f-]{36}"/g)];
      check(
        `${locale}: *** the dispatch carries its own lines *** [S116]`,
        dispatchPage.body.includes('data-slot="dispatch-lines"') &&
          lineRows.length === 1,
        `${lineRows.length} line row(s)`,
      );
      // The figure is the lines', so it cannot be blank and cannot be the
      // em-dash an absent value takes.
      check(
        `${locale}: …and its square metres are derived from them [S116]`,
        factOf(dispatchPage.body, "sqm").length > 0 &&
          factOf(dispatchPage.body, "sqm") !== DASH,
        factOf(dispatchPage.body, "sqm"),
      );
      // `S116` — the input is gone from the markup, not merely ignored, which
      // is the same claim section 12 makes of the VAT rate on a quotation line.
      check(
        `${locale}: and the dispatch form offers NO square-metre input [S116]`,
        !dispatchForm.includes('name="sqm"'),
      );
      check(
        `${locale}: the dispatch names a project of its own [S74]`,
        factOf(dispatchPage.body, "project") !== DASH &&
          !factHtmlOf(dispatchPage.body, "project").includes("fact-absent"),
        factOf(dispatchPage.body, "project"),
      );
      // `S76` on the screen it was written for: the project a dispatch carries
      // is a LINK for the coordinator who recorded it, not plain text. This
      // page is fetched as the coordinator, so the href IS the assertion.
      check(
        `${locale}: *** and the coordinator may open it — the name is a link *** [S76]`,
        dispatchPage.body.includes(`/projects/${projectId}"`),
      );

      /* --- 6. the request took the quotation's project, unasked [S74] --- */

      // The block that stood here proved a write-back had not fired yet. There
      // is no write-back: what a request must do instead is arrive already
      // carrying the quotation's project, with nobody having chosen it.
      check(
        `${locale}: *** the request carries the quotation's project, unchosen *** [S74]`,
        dispatchPage.body.includes(`/projects/${projectId}"`),
        factOf(dispatchPage.body, "project"),
      );

      /* --- 7. submit, then approve, through the real controls ---------- */

      // The two acts as forms, scraped and posted like any other — `data-act`
      // is the marker, because a translated button label proves nothing.
      const actForm = (body: string, act: string): string | undefined =>
        body.match(
          new RegExp(`<form[^>]*data-act="${act}"[\\s\\S]*?</form>`),
        )?.[0];

      const submitForm = actForm(dispatchPage.body, "submit");
      if (!submitForm) {
        check(`${locale}: the submit control renders on a draft [S72]`, false);
        continue;
      }
      const submitted = await post(
        coordJar,
        dispatchPath,
        envelope(submitForm),
      );
      check(
        `${locale}: submitting answers 200 and does not redirect [S72]`,
        submitted.status === 200,
        `got ${submitted.status} ${submitted.location}`,
      );
      const waiting = await get(coordJar, dispatchPath);
      check(
        `${locale}: *** the request is now waiting on the coordinator *** [S72], [S88]`,
        waiting.body.includes('data-status="submitted"'),
        factOf(waiting.body, "status"),
      );
      // **The rep may not approve it, and is not offered the control.** The
      // 404-shaped rule `D53` applied to a button: an unavailable act is not
      // rendered, and the action refuses it anyway `S109`.
      const repView = await get(repJar, dispatchPath);
      check(
        `${locale}: *** the rep is offered no approve control *** [S72], [D53]`,
        repView.status === 200 && !actForm(repView.body, "approve"),
        `status ${repView.status}`,
      );
      check(
        `${locale}: …nor a refuse control [S124]`,
        !actForm(repView.body, "refuse"),
      );
      // And the rep cannot edit it any more either `S125`.
      check(
        `${locale}: *** and after submitting, the edit route 404s for the rep *** [S125]`,
        (await get(repJar, `${dispatchPath}/edit`)).status === 404,
      );
      check(
        `${locale}: …while it opens for the coordinator [S125], [S62]`,
        (await get(coordJar, `${dispatchPath}/edit`)).status === 200,
      );

      const approveForm = actForm(waiting.body, "approve");
      if (!approveForm) {
        check(`${locale}: the approve control renders [S72]`, false);
        continue;
      }
      // `S73` — **the approval carries the payment method**, so this envelope
      // is no longer empty. Posting it without one is asserted below.
      const approveEnvelope = envelope(approveForm);
      const noMethod = await post(coordJar, dispatchPath, approveEnvelope);
      check(
        `${locale}: *** approving with no payment method answers 200, not 303 *** [S73]`,
        noMethod.status === 200,
        `got ${noMethod.status} ${noMethod.location}`,
      );
      check(
        `${locale}: …and it is still submitted, not half-approved [S73]`,
        (await get(coordJar, dispatchPath)).body.includes(
          'data-status="submitted"',
        ),
      );
      approveEnvelope.set("paymentMethod", "bank_transfer_full");
      approveEnvelope.set("paymentNote", "half now, half on delivery");
      const approved = await post(
        coordJar,
        dispatchPath,
        approveEnvelope,
      );
      check(
        `${locale}: *** approving answers 200 *** [S72]`,
        approved.status === 200,
        `got ${approved.status} ${approved.location}`,
      );
      const live = await get(coordJar, dispatchPath);
      check(
        `${locale}: *** the payment method is recorded on the dispatch *** [S70], [S71]`,
        factHtmlOf(
          (await get(coordJar, dispatchPath)).body,
          "payment",
        ).includes('data-payment="bank_transfer_full"'),
        factOf((await get(coordJar, dispatchPath)).body, "payment"),
      );
      check(
        `${locale}: *** the request is approved, and names its approver *** [S72]`,
        live.body.includes('data-status="approved"') &&
          factOf(live.body, "approvedBy") !== DASH,
        factOf(live.body, "approvedBy"),
      );
      // **Credit is a consequence of approval** `S72`, so the card that shows
      // it appears at this moment and not before. Asserted both ways: absent
      // on the request above, present now.
      check(
        `${locale}: *** and only NOW does it carry a credit table *** [S72], [S78]`,
        !dispatchPage.body.includes('data-slot="credit"') &&
          live.body.includes('data-slot="credit"'),
      );
      check(
        `${locale}: …nothing is waiting on anyone any more [D26], [S86]`,
        !live.body.includes('data-slot="turn-panel"') &&
          !actForm(live.body, "approve"),
      );

      /* --- 7b. approved, THEN numbered [S121] ------------------------- */

      // `S121` — *it is not a condition of approval; a dispatch is approved,
      // then numbered.* The control appears only once it is approved, and only
      // for her: `D53` says an unavailable act is not rendered at all.
      const numberedPage = await get(coordJar, dispatchPath);
      const smacForm = actForm(numberedPage.body, "smac-number");
      check(
        `${locale}: the SMAC number control renders on an approved dispatch [S121]`,
        Boolean(smacForm),
      );
      check(
        `${locale}: …and not for the rep [S121], [D53]`,
        !actForm((await get(repJar, dispatchPath)).body, "smac-number"),
      );
      if (smacForm) {
        const numberFields = envelope(smacForm);
        numberFields.set("smacDispatchNumber", `DN-${locale}-${stamp}`);
        const numbered = await post(coordJar, dispatchPath, numberFields);
        check(
          `${locale}: *** writing the SMAC number answers 200 *** [S121]`,
          numbered.status === 200,
          `got ${numbered.status} ${numbered.location}`,
        );
        // The header reference is the dispatch's OWN number now, not the
        // quotation's. Asserted as markup rather than as a translated label.
        check(
          `${locale}: *** and the dispatch carries it *** [S121]`,
          (await get(coordJar, dispatchPath)).body.includes(
            `DN-${locale}-${stamp}`,
          ),
        );
      }

      /* --- 7c. South stock cannot be TT, over HTTP [S119] -------------- */

      // The rule is a CHECK and a `RuleError`; this asserts the third surface,
      // which is the one a rep meets — the form comes back 200 with the error
      // on the shipment field, never a 303 that wrote a row the database would
      // then have to refuse.
      const ctForm = await get(coordJar, `/${locale}/dispatches/new`);
      const ctShell = ctForm.body.match(
        /<form[^>]*data-slot="form-shell"[\s\S]*?<\/form>/,
      )?.[0];
      if (ctShell) {
        const ctFields = envelope(ctShell);
        ctFields.set("quotationThreadId", threadId);
        ctFields.set("projectId", projectId);
        ctFields.set("dispatchDate", "2026-08-18");
        ctFields.set("stock", "south");
        ctFields.set("shipment", "tt");
        for (const [name, value] of Object.entries(dispatchLine)) {
          ctFields.set(name, value);
        }
        const refusedCt = await post(
          coordJar,
          `/${locale}/dispatches/new`,
          ctFields,
        );
        check(
          `${locale}: *** South stock as TT answers 200, not 303 *** [S119]`,
          refusedCt.status === 200,
          `got ${refusedCt.status} ${refusedCt.location}`,
        );
        check(
          `${locale}: …and the error lands ON the shipment field [S119], [D24]`,
          refusedCt.body.includes('id="shipment-error"'),
        );
      }

      /* --- 8. and approval changed nothing about the project [S74] ----- */

      // The write-back fired here. `S50` deleted it, so what has to be true
      // now is the opposite: approving an APPROVED dispatch leaves the
      // quotation naming exactly the project it was raised with.
      const rewritten = await get(repJar, threadPath);
      check(
        `${locale}: *** the quotation still names the project it was raised with *** [S74], [S50]`,
        factOf(rewritten.body, "project") === newProjectName,
        factOf(rewritten.body, "project"),
      );
      check(
        `${locale}: …and it is the one the dispatch took`,
        rewritten.body.includes(`/projects/${projectId}"`),
      );

      /* --- 9. the company is a participant, with the derived figure ----- */

      const project = await get(repJar, `/${locale}/projects/${projectId}`);
      // `S27` — the raise linked it, in the same act that made the project.
      // `S74`'s write-back used to be what put it here.
      check(
        `${locale}: *** the quotation's company is on the project it made *** [S50], [S27]`,
        project.body.includes(`data-participant="${companyId}"`),
      );
      // **The point of the whole section.** `S26`'s figure is derived in SQL
      // from `dispatches.project_id`, and until now no identity in this suite
      // owned a project with a participant that had dispatched — so it had
      // never once been rendered on a real screen.
      check(
        `${locale}: *** and carries its dispatched square metres *** [S26]`,
        project.body.includes(`data-dispatched="${companyId}"`),
      );

      /* --- 9b. the SAME company's next quotation attaches to it [S50] --- */

      // `S50`'s two branches: the first quotation made the project, and the
      // next one is raised onto it. The company is seeded through the query
      // string — the deep link `reports/[id]/edit` uses — because the project
      // list narrows to the chosen company `[16 §6]` and a server-rendered
      // form has no company chosen until one is.
      //
      // **The `existing` half of `data-project-mode` is not asserted, and that
      // is deliberate.** It is rendered only after somebody picks, so a walk
      // with no JavaScript can never see it. What the marker is here to prove
      // is `S50`'s *"the default is the new project"*, which is the state the
      // server renders — and the branch itself is proved by the POST below.
      const seeded = await get(
        repJar,
        `/${locale}/quotations/new?companyId=${companyId}`,
      );
      const seededForm = seeded.body.match(
        /<form[^>]*data-slot="form-shell"[\s\S]*?<\/form>/,
      )?.[0];
      check(
        `${locale}: a company can be seeded into the raise form [S50]`,
        Boolean(seededForm) && seeded.status === 200,
        `got ${seeded.status}`,
      );
      if (seededForm) {
        check(
          `${locale}: *** and its own project is then offered *** [S50], [16 §6]`,
          seededForm.includes(`value="${projectId}"`),
          "the seeded company's project is not in the project select",
        );
        const attachFields = envelope(seededForm);
        for (const [name, value] of quotationFields.entries()) {
          if (
            !["projectId", "newProjectName", "companyId", "$ACTION_ID"].some(
              (skip) => name.startsWith(skip),
            )
          ) {
            attachFields.set(name, value);
          }
        }
        attachFields.set("companyId", companyId);
        attachFields.set("projectId", projectId);
        attachFields.set("newProjectName", "");
        const attached = await post(
          repJar,
          `/${locale}/quotations/new`,
          attachFields,
        );
        check(
          `${locale}: *** raising ONTO an existing project answers 303 *** [S50]`,
          attached.status === 303,
          `got ${attached.status} ${attached.location}`,
        );
        if (attached.status === 303) {
          const attachedThread = await get(
            repJar,
            attached.location.replace(BASE, ""),
          );
          check(
            `${locale}: …and it names that project, not a second one [S50]`,
            attachedThread.body.includes(`/projects/${projectId}"`),
            factOf(attachedThread.body, "project"),
          );
        }
      }

      /* --- 10. dispatching it again takes the same project [S74] -------- */

      // The "shown, not chosen" half of the rule, on a thread that has carried
      // its project from the moment it was raised.
      const again = await post(
        coordJar,
        `/${locale}/dispatches/new`,
        dispatchFields(""),
      );
      check(
        `${locale}: requesting against it again takes the project it gained [S74]`,
        again.status === 303,
        `got ${again.status}`,
      );
      if (again.status === 303) {
        const second = await get(coordJar, again.location.replace(BASE, ""));
        check(
          `${locale}: …the same project, not another`,
          second.body.includes(`/projects/${projectId}"`) ||
            factOf(second.body, "project") ===
              factOf(dispatchPage.body, "project"),
          factOf(second.body, "project"),
        );
      }

      // And a project that disagrees with the quotation's is refused. **As a
      // message**: `useActionState` re-renders the form, so 200 — never a 303
      // that wrote it anyway, and never a 500 from the rule throwing. WHICH
      // rule refused is `verify:slice3` §15's assertion; this is the boundary
      // that no in-process script crosses.
      //
      // It is a refusal from the moment the quotation exists now: `S50` means
      // there was never a window in which any visible project was lawful.
      const otherId = otherIds[0] ?? "00000000-0000-0000-0000-000000000000";
      console.log(
        otherIds[0]
          ? `  --    ${locale}: refusal driven with a second real project`
          : `  --    ${locale}: rep-a owns one project, so the refusal uses an unknown id`,
      );
      const refused = await post(
        coordJar,
        `/${locale}/dispatches/new`,
        dispatchFields(otherId),
      );
      check(
        `${locale}: *** a project that is not the quotation's is refused *** [S74]`,
        refused.status === 200,
        `got ${refused.status} ${refused.location}`,
      );

      /* --- 11. cancelling an approved dispatch [S73], [S128] ----------- */

      /**
       * `S73` — *approval is final; if something is wrong afterwards the
       * dispatch is cancelled, never un-approved*, and *never revived*.
       *
       * **Driven on the SECOND dispatch, not the one section 7 approved.**
       * Sections 8 and 9 read that one: `S74`'s write-back and `S26`'s derived
       * `data-dispatched` figure both hang off it, and cancelling it would
       * empty the figure section 9 exists to render for the first time.
       *
       * **The telling is not asserted here.** `again` was posted by the
       * coordinator, so she is the raiser, and `cancelDispatch` drops a
       * self-directed row. Who is told is `verify:slice3` §29's — including
       * the co-credited rep, which no HTTP walk can reach. What belongs here
       * is the boundary no in-process script crosses: the form renders for
       * her and not for the rep, the reason round-trips, and the empty-reason
       * path comes back as a message rather than a 500.
       */
      if (again.status === 303) {
        const secondPath = again.location.replace(BASE, "");
        const secondDraft = await get(coordJar, secondPath);
        const secondSubmit = actForm(secondDraft.body, "submit");
        if (secondSubmit) {
          await post(coordJar, secondPath, envelope(secondSubmit));
          const secondSubmitted = await get(coordJar, secondPath);
          const secondApprove = actForm(secondSubmitted.body, "approve");
          if (secondApprove) {
            const secondApproveFields = envelope(secondApprove);
            secondApproveFields.set("paymentMethod", "cash_in_office");
            secondApproveFields.set("paymentNote", "");
            await post(coordJar, secondPath, secondApproveFields);
          }
        }

        const approvedSecond = await get(coordJar, secondPath);
        const cancelForm = actForm(approvedSecond.body, "cancel");
        check(
          `${locale}: the cancel control renders on an APPROVED dispatch [S73]`,
          approvedSecond.body.includes('data-status="approved"') &&
            Boolean(cancelForm),
          `status markup ${approvedSecond.body.includes('data-status="approved"')}`,
        );
        // `D53` — an unavailable act is not rendered. The rep may not cancel;
        // the founder's decision is that only internal sales may.
        check(
          `${locale}: …and not for the rep, who may not cancel [S73], [D53]`,
          !actForm((await get(repJar, secondPath)).body, "cancel"),
        );

        if (cancelForm) {
          // **The empty-reason path first**, and it is the one that matters:
          // `S128` needs a reason to carry, and a cancellation with none must
          // come back as a message on the field rather than a 500 from the
          // rule throwing, or a 303 that wrote a row the database would then
          // refuse. This is the only assertion of that shape anywhere — no
          // in-process script crosses the action boundary.
          const empty = envelope(cancelForm);
          empty.set("reason", "   ");
          const refusedCancel = await post(coordJar, secondPath, empty);
          check(
            `${locale}: *** a cancellation with no reason answers 200, not 303 or 500 *** [S73], [S128]`,
            refusedCancel.status === 200,
            `got ${refusedCancel.status} ${refusedCancel.location}`,
          );
          check(
            `${locale}: …and the dispatch is still approved, not half-cancelled [S73]`,
            (await get(coordJar, secondPath)).body.includes(
              'data-status="approved"',
            ),
          );

          const reason = `${locale}-${stamp} finance refused the transfer`;
          const cancelFields = envelope(cancelForm);
          cancelFields.set("reason", reason);
          const cancelled = await post(coordJar, secondPath, cancelFields);
          check(
            `${locale}: *** cancelling answers 200 *** [S73]`,
            cancelled.status === 200,
            `got ${cancelled.status} ${cancelled.location}`,
          );

          const afterCancel = await get(coordJar, secondPath);
          check(
            `${locale}: *** the dispatch reads cancelled *** [S73]`,
            afterCancel.body.includes('data-status="cancelled"'),
          );
          // `S73` — *it stays visible on the record it belonged to, carries a
          // reason*. Read back off the screen, in both locales, which is what
          // makes it the rep's copy rather than a column.
          check(
            `${locale}: *** and carries its reason, on the record *** [S73], [S128]`,
            afterCancel.body.includes("data-cancellation-reason") &&
              afterCancel.body.includes(reason),
          );
          // *Never revived*: nothing is offered on it to anybody, which is the
          // screen half of the five refusals `verify:slice3` §29 drives.
          check(
            `${locale}: …and offers NOTHING further — never revived [S73], [D53]`,
            !afterCancel.body.includes('data-slot="request-actions"'),
          );
          // `D6` — colour describes elapsed time, never outcome. A cancelled
          // dispatch is a state of a record, not a warning, so the card
          // carrying its reason draws no destructive tone at all.
          check(
            `${locale}: …and the reason card is not coloured as a warning [D6]`,
            (afterCancel.body.match(
              /<div[^>]*data-slot="cancellation"[\s\S]*?data-cancellation-reason/,
            )?.[0] ?? "").includes("destructive") === false,
          );
        }
      }

      /* --- 12. rejecting a quotation, with a reason [S62], [S128] ------ */

      /**
       * `S62` — *rejecting requires a written reason, which becomes a comment
       * on the thread*, and until this slice `rejectThread` took none at all:
       * no parameter, no column, no control. It was the one of `S62`'s three
       * acts with nothing behind it.
       *
       * **A thread of its own**, because the one above is accepted and every
       * end state is final. Raised from the same form fields section 1 built,
       * so this costs one POST.
       */
      const rejectRaise = await post(
        repJar,
        `/${locale}/quotations/new`,
        quotationFields,
      );
      if (rejectRaise.status === 303) {
        const rejectPath = rejectRaise.location.replace(BASE, "");
        const rejectPage = await get(coordJar, rejectPath);
        const rejectForm = actForm(rejectPage.body, "reject");
        check(
          `${locale}: the reject control asks for a reason now [S62], [S128]`,
          Boolean(rejectForm) &&
            (rejectForm ?? "").includes('name="rejectionReason"'),
        );

        if (rejectForm) {
          const emptyReject = envelope(rejectForm);
          emptyReject.set("rejectionReason", "   ");
          const refusedReject = await post(coordJar, rejectPath, emptyReject);
          check(
            `${locale}: *** a rejection with no reason answers 200, not 303 or 500 *** [S62]`,
            refusedReject.status === 200,
            `got ${refusedReject.status} ${refusedReject.location}`,
          );
          check(
            `${locale}: …and the quotation is still open, not half-rejected [S62]`,
            !(await get(coordJar, rejectPath)).body.includes("data-end-state="),
          );

          const rejectReason = `${locale}-${stamp} the customer went elsewhere`;
          const rejectFields = envelope(rejectForm);
          rejectFields.set("rejectionReason", rejectReason);
          const rejected = await post(coordJar, rejectPath, rejectFields);
          check(
            `${locale}: *** rejecting answers 200 *** [S62]`,
            rejected.status === 200,
            `got ${rejected.status} ${rejected.location}`,
          );

          const afterReject = await get(repJar, rejectPath);
          check(
            `${locale}: *** the thread reads rejected *** [S62]`,
            afterReject.body.includes('data-end-state="rejected"'),
          );
          // `S62` — *which becomes a comment on the thread*. The rep opens
          // this screen and the reason is in the conversation, which is the
          // half `AUDIT 1` found missing on two of the three acts.
          check(
            `${locale}: *** and the reason is on the thread as a comment *** [S62], [S128]`,
            afterReject.body.includes('data-slot="comment"') &&
              afterReject.body.includes(rejectReason),
          );
        }
      }
    }

    // `S118` — the same stock, rendered in both locales, must read
    // differently. This is what replaces an assertion on "Riyadh": a value
    // printed raw would be identical in both, so a difference proves the
    // screen went through the translation layer, and it says so without this
    // script ever reading a translated string. Section 12 covers the other
    // failure — a label that did not resolve at all.
    const [enStock, arStock] = [stockLabels.get("en"), stockLabels.get("ar")];
    check(
      "*** the stock label is translated, not printed raw *** [S118] [S113]",
      Boolean(enStock) && Boolean(arStock) && enStock !== arStock,
      `en "${enStock}" vs ar "${arStock}"`,
    );

    // Section 12 has already run, and every screen above is one it could not
    // reach: the picker and its hints exist only for a project-less quotation.
    // So this section carries its own half of that assertion.
    check(
      "no screen in this section rendered an unresolved message key [S113]",
      leaked.size === leakedBefore,
      [...leaked.keys()].slice(leakedBefore).join(", "),
    );
  }

  console.log(
    "\n15. The coordinator's projects and contacts, read and no further [S76]",
  );
  {
    // **Both halves on every check.** The coordinator reaching a screen proves
    // `S76`; the manager reaching the control the coordinator does not proves
    // the screen was not simply broken for everybody. A one-sided assertion
    // here would pass on an empty database and on a page that failed to render
    // its own edit button.
    const coordJar = jars["coordinator@example.test"];
    const managerJar = jars["manager@example.test"];

    for (const section of ["projects", "contacts"] as const) {
      const list = await get(coordJar, `/en/${section}`);
      // **`/projects` defaults to the board since `D28` shipped**, so the
      // marker that says "not empty" differs by screen. The claim is unchanged
      // — `S76` gives her sight of every project — and the board is the
      // stronger witness of it, because `data-total` is the whole scope rather
      // than one page.
      const marker =
        section === "projects" ? "project-board" : "list-card";
      check(
        `the coordinator's /${section} is no longer empty [S76]`,
        list.body.includes(`data-slot="${marker}"`) &&
          Number(attrOf(list.body, marker, "data-total")) > 0,
        `status ${list.status}`,
      );
      // `D51` — **a New button that always fails is not rendered**, which is a
      // claim about the button AGREEING with the route rather than about the
      // button being absent. Both records need a company, so what decides it
      // is whether this identity holds one.
      //
      // **It used to be asserted as absent, and that was a fact about the
      // fixtures rather than about the rule.** No coordinator had ever held a
      // company, so the button never rendered and the route always 404'd.
      // `S9` names the coordinator as one of the four an assignment may hand a
      // company to, `companyBookHolderFilter` admits the role, and `S127` lets
      // her raise and approve a dispatch **against her own company** — so a
      // coordinator with a book is the rule working, not the fixture drifting,
      // and `seed:demo` gives her one. Asserted as the biconditional now, so
      // it holds whether or not she happens to hold a company.
      const newOffered = list.body.includes(`/en/${section}/new"`);
      const newReachable =
        (await get(coordJar, `/en/${section}/new`)).status === 200;
      check(
        `…and the New button agrees with the route [D51]`,
        newOffered === newReachable,
        `button ${newOffered ? "offered" : "absent"}, route ${
          newReachable ? "200" : "404"
        }`,
      );
      const managerList = await get(managerJar, `/en/${section}`);
      check(
        `…while the manager, who holds companies, is offered one [D51]`,
        managerList.body.includes(`/en/${section}/new"`),
      );

      // The edit CONTROL, for the same reason: section 3 walks the route and
      // finds the 404, and neither of them proves the button is gone.
      const id = firstId(list.body, section);
      if (!id) {
        console.log(`  --    no ${section} row to open`);
        continue;
      }
      const detail = await get(coordJar, `/en/${section}/${id}`);
      check(
        `…and its detail carries no edit control [S76], [D51]`,
        detail.status === 200 &&
          !detail.body.includes(`/en/${section}/${id}/edit"`),
        `status ${detail.status}`,
      );
      const managerDetail = await get(managerJar, `/en/${section}/${id}`);
      check(
        `…while the manager's does — the control is not simply gone`,
        managerDetail.body.includes(`/en/${section}/${id}/edit"`),
      );
    }

    // The project screen carries two more controls a reader may not use, and
    // one it may: the participants are exactly what `S76` gave them.
    const projectId = firstId(
      (await get(coordJar, "/en/projects")).body,
      "projects",
    );
    if (projectId) {
      const asCoordinator = await get(coordJar, `/en/projects/${projectId}`);
      const asManager = await get(managerJar, `/en/projects/${projectId}`);
      check(
        "no follow-up panel for a reader who may not set one [S76], [D51]",
        !asCoordinator.body.includes('data-slot="next-follow-up"'),
      );
      check(
        "…while the manager has it — the panel is not simply gone",
        asManager.body.includes('data-slot="next-follow-up"'),
      );
      check(
        "…and the manager keeps the edit control the coordinator lacks",
        asManager.body.includes(`/en/projects/${projectId}/edit"`),
      );
      /**
       * **The participants, on a project that HAS participants.**
       *
       * This used to read `data-participant=` off whatever `firstId` returned,
       * which made it a lottery: `S50` allows a project with no live company
       * link, `verify:slice3` and `verify:phase10a` each leave several behind,
       * and `/projects` used to be newest-first — so the residue of any other
       * verify script sorted to the top and the check failed on a screen that
       * was correct. Measured: 11 such projects, all from one afternoon's runs.
       * `D25` reordered it by when a project last moved, which does not make
       * the hazard go away: residue is created recently and never moves again,
       * so it now sorts by its own age instead. The subject is still chosen by
       * what it carries rather than by where it sits.
       *
       * **The subject is chosen from the MANAGER's view**, never the
       * coordinator's, or the choice would presuppose what is being asserted.
       * The claim is then the biconditional `S76` actually makes — she reads
       * every project *in full* — so it is the same COUNT, not merely
       * non-empty.
       */
      const candidates = [
        ...new Set(
          [
            ...(await get(coordJar, "/en/projects")).body.matchAll(
              /href="\/en\/projects\/([0-9a-f-]{36})"/gi,
            ),
          ].map((m) => m[1]),
        ),
      ].slice(0, 8);

      let withParticipants: { id: string; manager: number } | null = null;
      for (const id of candidates) {
        const seen = (
          (await get(managerJar, `/en/projects/${id}`)).body.match(
            /data-participant=/g,
          ) ?? []
        ).length;
        if (seen > 0) {
          withParticipants = { id, manager: seen };
          break;
        }
      }

      if (!withParticipants) {
        console.log(
          "  note  no project among the first 8 carries a participant",
        );
      } else {
        const seen = (
          (await get(coordJar, `/en/projects/${withParticipants.id}`)).body.match(
            /data-participant=/g,
          ) ?? []
        ).length;
        check(
          "the coordinator reads every participant the manager does — what S76 is for [S26], [S76]",
          seen === withParticipants.manager,
          `manager ${withParticipants.manager} · coordinator ${seen}`,
        );
      }
    }
  }

  console.log(
    "\n16. A rep raises one and the coordinator refuses it, over HTTP [S72], [S124], [S122]",
  );
  {
    // **The half section 14 cannot make.** Section 14 drives the whole chain as
    // the coordinator, which is lawful `S127` but says nothing about the rule
    // `S72` exists for: that a rep raises a request *with no flag at all*. This
    // section is the rep's path, and the refusal at the end of it.
    const repJar = jars["rep-a@example.test"];
    const coordJar = jars["coordinator@example.test"];

    /** The same shape section 14 uses. Block-scoped, so neither leaks. */
    const post = async (jar: Jar, path: string, body: FormData) => {
      const response = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { cookie: header(jar), origin: BASE },
        body,
        redirect: "manual",
      });
      store(jar, response);
      return {
        status: response.status,
        location: response.headers.get("location") ?? "",
        body: await response.text(),
      };
    };

    for (const locale of ["en", "ar"] as const) {
      /** Every `$ACTION…` input of one form, unescaped, as a browser sends it. */
      const envelope = (form: string): FormData => {
        const fields = new FormData();
        for (const input of form.matchAll(/<input[^>]*>/g)) {
          const name = input[0].match(/name="([^"]+)"/)?.[1];
          if (!name?.startsWith("$ACTION")) continue;
          fields.append(
            name,
            unescapeHtml(input[0].match(/value="([^"]*)"/)?.[1] ?? ""),
          );
        }
        return fields;
      };
      const actForm = (body: string, act: string): string | undefined =>
        body.match(
          new RegExp(`<form[^>]*data-act="${act}"[\\s\\S]*?</form>`),
        )?.[0];

      /* --- 1. the screen opens for a rep at all [S72] ------------------ */

      const form = await get(repJar, `/${locale}/dispatches/new`);
      check(
        `${locale}: *** /dispatches/new opens for a rep, with no flag *** [S72]`,
        form.status === 200,
        `got ${form.status}`,
      );
      const shell = form.body.match(
        /<form[^>]*data-slot="form-shell"[\s\S]*?<\/form>/,
      )?.[0];
      if (!shell) {
        console.log(`  --    ${locale}: rep-a has no issued quotation to offer`);
        continue;
      }

      // `data-project` is gone with `S50`: every option carries a project, so
      // the marker separated nothing and any option will do.
      const option = shell.match(/<option value="([0-9a-f-]{36})"/);
      if (!option) {
        console.log(`  --    ${locale}: no quotation to request against`);
        continue;
      }

      /* --- 2. the rep raises one ------------------------------------- */

      /** The first real option of a named `<select>` — never the placeholder. */
      const optionOf = (name: string) =>
        shell
          .match(new RegExp(`<select[^>]*name="${name}"[\\s\\S]*?</select>`))?.[0]
          ?.match(/<option value="([0-9a-f-]{36})"/)?.[1];
      const lookups = {
        supplierId: optionOf("supplierId"),
        classId: optionOf("classId"),
        fireRatingId: optionOf("fireRatingId"),
        thicknessId: optionOf("thicknessId"),
      };
      if (Object.values(lookups).some((id) => !id)) {
        console.log(`  skip  ${locale}: the product lookups are not seeded`);
        continue;
      }

      const fields = envelope(shell);
      fields.set("quotationThreadId", option[1]);
      fields.set("dispatchDate", "2026-08-19");
      // `S130` `S119` — the three the rep now chooses. Riyadh and TT together
      // are the pair `dispatches_stock_shipment` allows and South could not,
      // so posting them proves the form carries both fields rather than one.
      fields.set("stock", "riyadh");
      fields.set("shipment", "tt");
      // `S116` — the rep prices every line before submitting, so the price is
      // posted like any other field and an empty one would be refused.
      for (const [name, value] of Object.entries({
        ...lookups,
        customColour: "168",
        widthM: "1.2",
        lengthM: "2.4",
        quantityPcs: "5",
        unitPrice: "88",
      })) {
        fields.set(name, value as string);
      }
      const raised = await post(repJar, `/${locale}/dispatches/new`, fields);
      check(
        `${locale}: *** a rep posts the form and it answers 303 *** [S72]`,
        raised.status === 303,
        `got ${raised.status} ${raised.location}`,
      );
      if (raised.status !== 303) continue;
      const path = raised.location.replace(BASE, "");
      const draft = await get(repJar, path);
      check(
        `${locale}: it lands as a draft, waiting on the rep [S72], [S86]`,
        draft.body.includes('data-status="draft"'),
        factOf(draft.body, "status"),
      );
      check(
        `${locale}: …and the rep is offered edit and submit, and nothing else [S125], [D53]`,
        Boolean(actForm(draft.body, "submit")) &&
          !actForm(draft.body, "approve") &&
          !actForm(draft.body, "refuse"),
      );
      check(
        `${locale}: the rep may open their own edit route [S125]`,
        (await get(repJar, `${path}/edit`)).status === 200,
      );

      /* --- 3. and submits it ---------------------------------------- */

      const submit = actForm(draft.body, "submit");
      if (!submit) continue;
      await post(repJar, path, envelope(submit));
      const sitting = await get(coordJar, path);
      check(
        `${locale}: *** the request waits on the coordinator *** [S72], [S88]`,
        sitting.body.includes('data-status="submitted"'),
        factOf(sitting.body, "status"),
      );

      /* --- 3b. she edits it, and the flag says it was HER [S120] ----- */

      // `S120` — *the flag records who made each difference — the rep before
      // submitting, or the coordinator after*. `verify:slice3` drives every
      // case of that through the data layer; what only this file can claim is
      // that the two SCREENS render it, in both locales, off a real form POST.
      //
      // The colour is changed rather than a quantity, because that is the case
      // `S120` names outright: *a colour swapped at the same price and quantity
      // counts*. And it is a colour no fixture uses, so the difference is
      // certain rather than inherited from whatever the quotation happened to
      // carry.
      const editPage = await get(coordJar, `${path}/edit`);
      const editShell = editPage.body.match(
        /<form[^>]*data-slot="form-shell"[\s\S]*?<\/form>/,
      )?.[0];
      if (!editShell) {
        check(`${locale}: the coordinator's edit form renders [S125]`, false);
        continue;
      }
      const editFields = envelope(editShell);
      editFields.set("dispatchDate", "2026-08-19");
      editFields.set("stock", "riyadh");
      editFields.set("shipment", "tt");
      for (const [name, value] of Object.entries({
        ...lookups,
        customColour: `RV-${locale}-9999`,
        widthM: "1.2",
        lengthM: "2.4",
        quantityPcs: "5",
        unitPrice: "88",
      })) {
        editFields.set(name, value as string);
      }
      const editedBy = await post(coordJar, `${path}/edit`, editFields);
      check(
        `${locale}: *** the coordinator edits a submitted request *** [S125], [S62]`,
        editedBy.status === 303,
        `got ${editedBy.status} ${editedBy.location}`,
      );

      const flagged = await get(coordJar, path);
      check(
        `${locale}: *** the dispatch is flagged as differing from its quotation *** [S120]`,
        flagged.body.includes('data-differs="yes"'),
        factOf(flagged.body, "difference"),
      );
      check(
        `${locale}: …and the version's own lines render beside the dispatched ones [S120], [S77]`,
        flagged.body.includes('data-slot="quoted-lines"'),
      );
      check(
        `${locale}: …with the three figures S77 compares [S77]`,
        flagged.body.includes('data-fact="quotedSqm"') &&
          flagged.body.includes('data-fact="dispatchedAgainstVersion"') &&
          flagged.body.includes('data-fact="thisDispatchSqm"'),
      );

      // And on the row, which is the signal the coordinator's queue had none
      // of: at 12–15 requests a day she opened every screen to find the three
      // that needed reading.
      // **Paged to, not assumed on page one.** The submitted scope is the
      // coordinator's queue and a queue is oldest first `S87`, so a request
      // raised now sits on the LAST page of a database this suite has been
      // adding to. Walking is also the stronger claim: the marker is resolved
      // in SQL before pagination `CLAUDE.md`, so it must be on the row
      // wherever the row happens to fall.
      const flagId = path.split("/").pop() as string;
      let row = "";
      for (let page = 1; page <= 60; page += 1) {
        const queue = await get(coordJar, `/${locale}/dispatches?page=${page}`);
        const at = queue.body.indexOf(`/dispatches/${flagId}"`);
        if (at !== -1) {
          row = queue.body.slice(at, queue.body.indexOf("</tr>", at));
          break;
        }
        // An empty page is the end of the queue, whatever the footer says.
        if (!/\/dispatches\/[0-9a-f-]{36}"/.test(queue.body)) break;
      }
      /*
       * **This assertion is inverted, and the inversion is the point** `D66`.
       *
       * It used to require `data-differs="yes"` on the row: session 15 put the
       * marker on the coordinator's queue so she could see which requests
       * needed reading. `D66` was written afterwards and takes it back — *a
       * dispatch's difference from its quotation is recorded, never flagged to
       * her*, because a warning that fires on a large share of rows is one
       * people learn to click past. So the row must NOT carry it.
       *
       * **The walk to find the row is kept**, and it still earns its place: it
       * proves the row is reachable by paging, which is what `?status=submitted`
       * used to guarantee and the pile order now does. It also keeps the
       * absence honest — a marker missing from a row that never rendered would
       * prove nothing, which is why `row === ""` is a failure and not a skip.
       *
       * Where the difference IS stated is asserted in section 24, on the
       * record, both halves.
       */
      check(
        `${locale}: the differing request is reachable on the coordinator's list [D25]`,
        row !== "",
        "the row is not on the list at all",
      );
      check(
        `${locale}: *** …and the LIST row does NOT flag the difference *** [D66]`,
        row !== "" && !row.includes('data-differs="'),
        row === "" ? "no row to read" : "the marker is still on the row",
      );

      /* --- 4. she refuses it, with a reason [S124] ------------------- */

      const refuseForm = actForm(sitting.body, "refuse");
      if (!refuseForm) {
        check(`${locale}: the refuse control renders [S124]`, false);
        continue;
      }
      // **The reason is required, and the empty post proves it.** 200 with the
      // form re-rendered, never a 303 that archived it with nothing to read.
      const noReason = envelope(refuseForm);
      noReason.set("reason", "   ");
      const empty = await post(coordJar, path, noReason);
      check(
        `${locale}: *** a refusal with no reason is refused *** [S124]`,
        empty.status === 200,
        `got ${empty.status} ${empty.location}`,
      );
      check(
        `${locale}: …and the request is still submitted, not archived`,
        (await get(coordJar, path)).body.includes('data-status="submitted"'),
      );

      const withReason = envelope(refuseForm);
      const REASON = `verify-routes ${locale} colour unavailable`;
      withReason.set("reason", REASON);
      const done = await post(coordJar, path, withReason);
      check(
        `${locale}: *** refusing it answers 200 *** [S124]`,
        done.status === 200,
        `got ${done.status} ${done.location}`,
      );

      /* --- 5. archived, out of the working list, reason readable ----- */

      const archivedPage = await get(repJar, path);
      check(
        `${locale}: *** the rep can still open it, and read WHY *** [S122], [S124]`,
        archivedPage.status === 200 &&
          archivedPage.body.includes("data-refusal-reason") &&
          archivedPage.body.includes(REASON),
        `status ${archivedPage.status}`,
      );
      const id = path.split("/").pop() as string;
      const working = await get(coordJar, `/${locale}/dispatches`);
      check(
        `${locale}: *** and it is OUT of the working list *** [S122]`,
        !working.body.includes(`/dispatches/${id}"`),
      );
      // `?archive=1`, not `?status=refused` — the five status chips became
      // `D25`'s three piles and the one scope a pile cannot express kept a chip
      // of its own. **The `D28` citation is dropped rather than carried over**:
      // `AD31` recorded that `D28` is specifically `?view=` on Projects and
      // Quotations and states no general principle about query parameters, so
      // it never backed this assertion. `S122` alone does.
      const archive = await get(coordJar, `/${locale}/dispatches?archive=1`);
      check(
        `${locale}: …and reachable in the archive [S122]`,
        archive.body.includes(`/dispatches/${id}"`),
      );

      /* --- 6. only she may revive it, and it returns to the rep ------ */

      const repOnRefused = await get(repJar, path);
      check(
        `${locale}: *** the rep is offered no revive control *** [S122], [D53]`,
        !actForm(repOnRefused.body, "revive"),
      );
      const coordOnRefused = await get(coordJar, path);
      const reviveForm = actForm(coordOnRefused.body, "revive");
      if (!reviveForm) {
        check(`${locale}: the revive control renders for her [S122]`, false);
        continue;
      }
      await post(coordJar, path, envelope(reviveForm));
      const back = await get(repJar, path);
      check(
        `${locale}: *** a revived request returns to the rep, unsubmitted *** [S122]`,
        back.body.includes('data-status="draft"') &&
          !back.body.includes("data-refusal-reason"),
        factOf(back.body, "status"),
      );
      check(
        `${locale}: …and the rep may edit and submit it as a new one [S122], [S125]`,
        (await get(repJar, `${path}/edit`)).status === 200 &&
          Boolean(actForm(back.body, "submit")),
      );
    }
  }

  console.log(
    "\n17. Every `useActionState` form ANSWERS a raw POST [WORKFLOW §5]",
  );
  {
    // **The assertion is that a reply arrives at all.** Eight forms in this app
    // wrote their row and then never sent response headers: the request sat
    // open until the client gave up — 303 seconds on the one measured to the
    // end, with no status and no body, ever. Nothing in the suite could see it,
    // because every other section asserts what a POST *did*, and this is a
    // defect in what it *answers*. That is how it survived from session 4.
    //
    // The cause is the **bind site**, measured rather than argued: a form whose
    // `.bind()` is evaluated by the same component that calls `useActionState`
    // hangs; bound one level up, at the call site, and passed in as a prop, the
    // same form answers in about 150ms. Hoisting the `.bind()` to a `const`
    // inside the hook's own component was measured too, and still hung — so it
    // is not the inline expression, it is which component evaluates it. Why
    // that is so is **not** established; only which shape answers.
    //
    // **A form that answers today is not proof the shape is sound.** The
    // service-line remove answered while it was the only such row on the page,
    // and hung on every attempt once a second row rendered — 7 of 8, then 3 of
    // 4. So this drives the repeated-row case too: a participant row is offered
    // only where a project has two or more `S27`, which makes
    // `remove-participant` the multi-row shape by construction.
    //
    // Timeouts, not bare `await`: a hang would otherwise stall the whole run,
    // so every POST here carries an abort and a missed reply is a named failure
    // carrying its elapsed time.
    const repJar = jars["rep-a@example.test"];
    const coordJar = jars["coordinator@example.test"];
    const managerJar = jars["manager@example.test"];

    /** Every id a list page links to, in document order. */
    const idsOf = (body: string, section: string, locale: string): string[] => [
      ...new Set(
        [
          ...body.matchAll(
            new RegExp(`href="/${locale}/${section}/([0-9a-f-]{36})"`, "g"),
          ),
        ].map((match) => match[1]),
      ),
    ];

    /** Every `$ACTION…` input of one form, unescaped, as a browser sends it. */
    const envelope = (form: string): FormData => {
      const fields = new FormData();
      for (const input of form.matchAll(/<input[^>]*>/g)) {
        const name = input[0].match(/name="([^"]+)"/)?.[1];
        if (!name?.startsWith("$ACTION")) continue;
        fields.append(
          name,
          unescapeHtml(input[0].match(/value="([^"]*)"/)?.[1] ?? ""),
        );
      }
      return fields;
    };

    const actForm = (body: string, act: string): string | undefined =>
      body.match(new RegExp(`<form[^>]*data-act="${act}"[\\s\\S]*?</form>`))?.[0];

    /** How many participant rows a project detail page renders. */
    const participantCount = (body: string): number =>
      [...body.matchAll(/data-participant="/g)].length;

    /** The one `RecordRow` belonging to a company — its remove form is inside. */
    const rowFor = (body: string, companyId: string): string =>
      body
        .split("<li")
        .find((chunk) => chunk.includes(`data-participant="${companyId}"`)) ?? "";

    /**
     * POST and insist on a reply. `null` is the hang this section exists for.
     *
     * 8 seconds is far outside the ~150ms each of these takes when it is well,
     * and far inside the 303 a real hang costs.
     */
    const answered = async (
      jar: Jar,
      path: string,
      body: FormData,
    ): Promise<{ status: number; body: string; ms: number } | null> => {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 8000);
      const started = Date.now();
      try {
        const response = await fetch(`${BASE}${path}`, {
          method: "POST",
          headers: { cookie: header(jar), origin: BASE },
          body,
          redirect: "manual",
          signal: abort.signal,
        });
        const text = await response.text();
        store(jar, response);
        return { status: response.status, body: text, ms: Date.now() - started };
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    };

    /** One form, one assertion: it replied, with the status a re-render has. */
    const drives = async (
      label: string,
      jar: Jar,
      path: string,
      form: string,
      fields: Record<string, string> = {},
    ): Promise<void> => {
      const body = envelope(form);
      for (const [name, value] of Object.entries(fields)) body.set(name, value);
      const result = await answered(jar, path, body);
      check(
        `${label} answers a raw POST [WORKFLOW §5]`,
        result !== null && result.status === 200,
        result === null
          ? "NO REPLY within 8s — the hang is back"
          : `got ${result.status} in ${result.ms}ms`,
      );
    };

    for (const locale of ["en", "ar"] as const) {
      /* --- the payment tick that used to lead this section ------------- */

      // **Gone with `S133`.** This drove `confirm-payment` on its empty-date
      // path - the write-nothing path, which is where the hang reproduced -
      // and it was the first of the four forms this section guards. The form,
      // its action and the column behind it left together, so there is
      // nothing here to drive and the check that an unpaid quotation was
      // reachable has nothing to be reachable for.
      //
      // **This closes two of `WORKFLOW §5`'s ten §17 preconditions**: both
      // *an unpaid quotation is reachable for the payment form* checks, one
      // per locale, were among the ten that go red once residue displaces a
      // seeded fixture off page one. Eight remain, and the six-runs-per-seed
      // count that row measured is unchanged - the same four threads per run
      // still displace the same page-one slots.

      /* --- the participant forms, added then taken back off ------------ */

      // Add and remove in one pass, on the same row, so the fixtures end where
      // they started. A participant removed and never replaced would eventually
      // leave a project down to the one company `S27` will not remove, the row
      // would stop rendering, and this assertion would decay into a silent skip
      // — the way three of `verify-slice3`'s did.
      let participantsDriven = false;
      const projects = await get(repJar, `/${locale}/projects`);
      for (const projectId of idsOf(projects.body, "projects", locale)) {
        const path = `/${locale}/projects/${projectId}`;
        const page = await get(repJar, path);
        const add = actForm(page.body, "add-participant");
        if (!add) continue;

        const before = participantCount(page.body);
        await drives(
          `${locale}: *** addProjectCompany, no company ***`,
          repJar,
          path,
          add,
          { companyId: "" },
        );

        // A real one now, so the removal below has a row of its own to take off
        // and the count comes back to where it started `S27`.
        const companyId = add.match(/<option value="([0-9a-f-]{36})"/)?.[1];
        if (!companyId) {
          check(`${locale}: the add form offers a company`, false);
          break;
        }
        await drives(
          `${locale}: *** addProjectCompany, a real one ***`,
          repJar,
          path,
          add,
          { companyId },
        );
        const grown = await get(repJar, path);
        check(
          `${locale}: …and the participant landed [S27]`,
          participantCount(grown.body) === before + 1,
          `${before} → ${participantCount(grown.body)}`,
        );

        // The remove row is offered only where there are two or more `S27`, so
        // this is the repeated-component case by construction.
        const remove = actForm(rowFor(grown.body, companyId), "remove-participant");
        if (!remove) {
          check(`${locale}: the new participant's row offers removal [S27]`, false);
          break;
        }
        await drives(
          `${locale}: *** removeProjectCompany ***`,
          repJar,
          path,
          remove,
        );
        const shrunk = await get(repJar, path);
        check(
          `${locale}: …and the count is back where it started [S27]`,
          participantCount(shrunk.body) === before,
          `${before} → ${participantCount(shrunk.body)}`,
        );
        participantsDriven = true;
        break;
      }
      check(
        `${locale}: a project with an add-participant form is reachable`,
        participantsDriven,
      );

      /* --- the target editor, moved out of its cell in `28b` ----------- */

      // **`AD20`'s answer, driven rather than assumed.** `D58` sent this
      // control out of the `<TableCell>` and into a `<details>` in a row of
      // its own, and `D49` still asks for one PER ROW — so `/targets` renders
      // one bound action per measured person, which is precisely the
      // repeated-row shape this section exists for. The bind is at the call
      // site, in `AttainmentTable`; the `useActionState` is one level down in
      // `TargetRow`. Moving markup is exactly the edit that quietly moves a
      // `.bind()`, so the form is driven at its new address.
      //
      // The manager, because the control is gated by `can_set_targets` and
      // nobody else renders it at all. An empty `sqm`, so the POST is a
      // refusal that writes nothing: `setTargetAction` always INSERTS a
      // superseding row `S84`, and a suite that set a real target would move
      // every attainment percentage §18 and §4401 read.
      const targetsPage = await get(managerJar, `/${locale}/targets`);
      const setTarget = actForm(targetsPage.body, "set-target");
      check(
        `${locale}: /targets offers a per-row target editor [D49], [D58]`,
        setTarget !== undefined,
        "no form carries data-act=\"set-target\"",
      );
      if (setTarget) {
        await drives(
          `${locale}: *** setTarget, out of the cell ***`,
          managerJar,
          `/${locale}/targets`,
          setTarget,
          { sqm: "" },
        );
      }

      /* --- the coordinator's three, and the line rows ------------------ */

      // Empty required fields throughout: each of these is a refusal that
      // writes nothing, so a stall cannot be blamed on what the action did.
      //
      // **The four that used to be asserted ABSENT are driven here now.**
      // `WORKFLOW §5` row 226 kept them exempt from the call-site binding on
      // the grounds that none reached the HTML, so the hang could not be
      // reproduced against them. Session 28 made them render `D20`, which is
      // what turns that exemption into a requirement — so they join the list
      // they were the exception to. One empty required field each, so every
      // POST is a refusal that writes nothing and a stall cannot be blamed on
      // what the action did. The three line acts come BEFORE `remove-line`,
      // which really removes one `S60`.
      const wanted: Array<[string, Record<string, string>]> = [
        ["issue", { smacReference: "", verification: "unverified" }],
        ["cancel", { cancellationReason: "" }],
        ["return", { reason: "" }],
        ["add-line", { quantityPcs: "" }],
        ["update-line", { quantityPcs: "" }],
        ["add-service", { serviceQuantity: "" }],
        ["remove-line", {}],
      ];
      const driven = new Set<string>();
      let exceptionsChecked = false;
      const coordThreads = await get(coordJar, `/${locale}/quotations`);
      for (const threadId of idsOf(coordThreads.body, "quotations", locale)) {
        const path = `/${locale}/quotations/${threadId}`;
        const page = await get(coordJar, path);
        for (const [act, fields] of wanted) {
          if (driven.has(act)) continue;
          const form = actForm(page.body, act);
          if (!form) continue;
          driven.add(act);
          await drives(`${locale}: *** ${act} ***`, coordJar, path, form, fields);
        }

        // **The same four, asserted PRESENT — this is that row inverted.**
        // It read *stays behind client state*, and passing meant the act did
        // not exist with scripts off: a rep could read a quotation and not add
        // a line to one, which the rewritten `D20` calls enablement. What is
        // asserted now is the opposite fact, on the same markers, so the row
        // cannot quietly regress in either direction.
        //
        // The page reached here is editable by construction — `remove-line` is
        // offered nowhere else — so the editors WOULD be rendering if they
        // rendered at all.
        // Its own flag, deliberately NOT a member of `driven`: that set's size
        // is the loop's break condition, and another member would end the scan
        // before a service line is looked for.
        if (actForm(page.body, "remove-line") && !exceptionsChecked) {
          exceptionsChecked = true;
          const inHtml: Array<[string, boolean]> = [
            ["addQuotationLine", page.body.includes('"new-line-supplierId"')],
            ["addServiceLine", page.body.includes('"new-service-serviceTypeId"')],
            [
              "updateQuotationLine",
              /id="line-[0-9a-f-]{36}-supplierId"/.test(page.body),
            ],
          ];
          for (const [name, present] of inHtml) {
            check(
              `${locale}: ${name}'s form renders server-side [D20]`,
              present,
              "it is behind client state — with scripts off the act does not exist",
            );
          }
          // **The disclosure is the browser's, not a scripted toggle.** A
          // `<details>` keeps its contents in the markup whether it is open or
          // shut, which is the whole reason §23 above can see nine fields it
          // could not see before.
          for (const slot of ["edit-line", "add-line-disclosure"]) {
            check(
              `${locale}: ${slot} is a native <details> [D20]`,
              new RegExp(`<details[^>]*data-slot="${slot}"`).test(page.body),
            );
          }
          // `updateServiceLine` is not in the list above: its editor renders
          // only where the thread carries a service line, so asserting it on
          // every editable thread would be a permanent red line rather than a
          // regression guard. It is driven below, where one exists.
        }

        // The two service-row forms are driven where the fixtures happen to
        // carry one. **Not a failure when they do not**: a service line is
        // optional `S59` and nothing this script posts creates one — every POST
        // it makes is a deliberate refusal — so asserting their presence on
        // every thread would be a permanent red line rather than a regression
        // guard. Said out loud below rather than skipped in silence.
        for (const [act, fields] of [
          ["remove-service", {}],
          ["update-service", { serviceQuantity: "" }],
        ] as Array<[string, Record<string, string>]>) {
          if (driven.has(act)) continue;
          const service = actForm(page.body, act);
          if (!service) continue;
          driven.add(act);
          await drives(`${locale}: *** ${act} ***`, coordJar, path, service, fields);
        }
        if (driven.size === wanted.length + 2) break;
      }
      for (const [act] of wanted) {
        check(
          `${locale}: the ${act} form is reachable for the coordinator`,
          driven.has(act),
        );
      }
      check(
        `${locale}: an editable thread was reached, so the editors were checked [D20]`,
        exceptionsChecked,
      );
      for (const act of ["remove-service", "update-service"]) {
        if (!driven.has(act)) {
          console.log(
            `  note  ${locale}: no thread carried a service line — ${act} not driven`,
          );
        }
      }
    }
  }

  console.log(
    "\n18. The top of the dashboard — whole square metres, the pace tick, the shortcuts row [D32], [D69]",
  );
  {
    const rep = jars["rep-a@example.test"];

    for (const locale of ["en", "ar"]) {
      const { body } = await get(rep, `/${locale}`);

      /* `D69` — the first element, two controls, nothing new behind either. */
      check(
        `${locale}: the search posts to THIS locale's companies list [D69]`,
        body.includes(`action="/${locale}/companies"`),
        // An unprefixed action is the failure this asserts: `localePrefix:
        // "always"` sends a bare `/companies` to the English list.
        body.match(/action="[^"]*companies[^"]*"/)?.[0] ?? "no action",
      );
      check(
        `${locale}: the field is the companies list's own \`q\` [D69]`,
        /<input[^>]*name="q"[^>]*>/.test(body) &&
          /<input[^>]*type="search"[^>]*>/.test(body),
      );
      check(
        `${locale}: the Log button opens the report form with NO record [D69]`,
        // `?companyId=` here would be the company-page button's job `S32`.
        body.includes(`href="/${locale}/reports/new"`),
      );

      /* `D32` — the panel, and the figure that used to read `674.8080`. */
      check(
        `${locale}: the target panel renders for the rep [D32]`,
        body.includes('data-slot="today-target"'),
      );

      // **The positive assertion, scoped to a marker and anchored at both
      // ends.** "the body contains 800" would pass against `800.0000`, which is
      // the exact defect this slice fixes, so the shape is what is asserted:
      // digits and separators, no decimal point, nothing else.
      for (const slot of ["today-achieved", "today-target-sqm"] as const) {
        const value = attrOf(body, slot, "data-sqm");
        check(
          `${locale}: ${slot} is whole square metres [D32]`,
          value !== null && /^\d{1,3}(,\d{3})*$/.test(value),
          value === null ? "marker absent" : value,
        );
      }

      const pct = attrOf(body, "today-pace", "data-pct");
      const gap = attrOf(body, "today-pace", "data-gap");
      check(
        `${locale}: the pace line reports a percentage of the month [D32]`,
        pct !== null && /^\d{1,3}$/.test(pct) && Number(pct) <= 100,
        pct ?? "absent",
      );
      check(
        `${locale}: …and the distance in whole square metres [D32]`,
        gap !== null && /^\d{1,3}(,\d{3})*$/.test(gap),
        gap ?? "absent",
      );
      // **The derived figure asserted at the reader that draws it.** The tick's
      // position and the percentage the line reports are one number; drawn from
      // two, the panel would say 82% and point somewhere else.
      //
      // Since `D32`'s overage rule the track's scale is the target **or** the
      // achievement, whichever is larger, and the tick divides by it — so this
      // reads the scale the bar published rather than assuming 100. A rep at
      // 102% whose tick still sat at a bare 82% is the regression it catches.
      const scale = attrOf(body, "today-bar", "data-scale");
      const tick = body.match(
        /data-slot="today-tick"[^>]*calc\(([\d.]+)% - 1px\)/,
      )?.[1];
      check(
        `${locale}: the tick divides by the bar's own scale [D32]`,
        pct !== null &&
          scale !== null &&
          tick !== undefined &&
          Math.abs(Number(tick) - (Number(pct) / Number(scale)) * 100) < 1e-9,
        `pace ${pct}% · scale ${scale} · tick ${tick ?? "absent"}`,
      );
      // **The legend's end is the TARGET, whatever the scale is.** It read the
      // achievement for one commit after the overage landed, so an
      // overachieving rep saw `963` under a bar of 963 — every rep exactly on
      // target and none ahead, which is the defect the rescale existed to fix.
      const legendEnd = (
        body.match(
          /<span[^>]*data-slot="today-legend-end"[^>]*>([^<]*)</,
        )?.[1] ?? ""
      ).trim();
      check(
        `${locale}: the bar's legend ends at the target, not at the scale [D32]`,
        legendEnd !== "" &&
          legendEnd === attrOf(body, "today-target-sqm", "data-sqm"),
        `legend ${legendEnd} · target ${attrOf(body, "today-target-sqm", "data-sqm")}`,
      );
      check(
        `${locale}: both side figures render [D32]`,
        body.includes('data-slot="today-side"'),
      );
    }

    /* **The rounding asserted at every reader, not one** (`CLAUDE.md`). A
       four-decimal text node is what a raw `numeric(14,4)` renders as. */
    const RAW_SQM = />\s*\d+\.\d{4}\s*</;
    for (const route of ["/", "/targets", "/dispatches"]) {
      const { body } = await get(rep, `/en${route === "/" ? "" : route}`);
      check(
        `${route} carries no raw four-decimal figure [D32]`,
        !RAW_SQM.test(body),
        body.match(RAW_SQM)?.[0] ?? "",
      );
    }

    /* **And the other half of the same claim.** A sweep that rounded every m²
       figure would pass the four checks above and quietly break a document
       line, which reconciles against what SMAC issued `S5`. So a dispatch's
       LINES must still carry their decimals. */
    const list = await get(rep, "/en/dispatches");
    const id = firstId(list.body, "dispatches");
    if (!id) {
      console.log("  note  the rep sees no dispatch — line decimals not driven");
    } else {
      const detail = await get(rep, `/en/dispatches/${id}`);
      check(
        "a dispatch's LINES keep their four decimals [S5], [S116]",
        RAW_SQM.test(detail.body),
      );
    }
  }

  console.log(
    "\n19. The dashboard — D33's strip, D34's two sections, D65's block",
  );
  {
    /**
     * **The two changes that are about who sees what are walked as all three
     * identities**, because a flag-gated block is only ever wrong for the
     * identity nobody drove. `can_approve_quotation` and `can_dispatch` are
     * held by the Sales Coordinator alone today, so she is the positive case
     * and the rep and the manager are the negative ones.
     */
    const IDENTITIES = [
      { email: "rep-a@example.test", requests: false },
      { email: "coordinator@example.test", requests: true },
      { email: "manager@example.test", requests: false },
    ] as const;

    for (const who of IDENTITIES) {
      const jar = jars[who.email];
      const label = who.email.split("@")[0];

      for (const locale of ["en", "ar"] as const) {
        const { body } = await get(jar, `/${locale}`);

        /* `D33` — four tiles over six conditions, inside ONE card. */
        const tiles = [
          ...body.matchAll(/<a[^>]*data-slot="today-count"[^>]*>/g),
        ].map((m) => m[0]);
        check(
          `${label} ${locale}: the counts strip is four tiles, not six [D33] [D21]`,
          tiles.length === 4,
          `${tiles.length} tiles`,
        );
        check(
          `${label} ${locale}: they sit inside one card, not four [D33]`,
          (body.match(/data-slot="today-counts"/g) ?? []).length === 1,
        );
        // **`?group=`, never `?kind=`** — two of the four cover two kinds, so
        // a tile showing 9 that linked by kind would land on a shorter list.
        check(
          `${label} ${locale}: every tile links into the list by GROUP [D33]`,
          tiles.length === 4 &&
            tiles.every((tile) =>
              /href="\/(?:en|ar)\/follow-ups\?group=\w+"/.test(tile),
            ),
        );

        /* `D34` — two sections, and both of them always. */
        for (const slot of ["today-planned", "today-slipping"] as const) {
          check(
            `${label} ${locale}: ${slot} renders [D34]`,
            body.includes(`data-slot="${slot}"`),
          );
        }

        /* `D34` — the mark is C, P or Q. `D` waits for `S86`'s anchor. */
        const marks = [
          ...body.matchAll(/data-slot="waiting-mark"[^>]*data-mark="([^"]*)"/g),
        ].map((m) => m[1]);
        check(
          `${label} ${locale}: every row's kind mark is one of C P Q [D34]`,
          marks.every((mark) => ["C", "P", "Q"].includes(mark)),
          [...new Set(marks)].join(",") || "no rows",
        );

        /* `D6` — **colour is elapsed time, and zero has not elapsed.** The
           three-tone scale gives `soon` at zero, not `late`: a date that
           arrived today is due, not overdue. Asserted against `data-when`, the
           number the colour was chosen from, so this is a claim about the
           derivation rather than about the words "Due today" — and it holds in
           Arabic, where those words are not those words. */
        const elapsed = [
          ...body.matchAll(
            /<span[^>]*data-when="(\d+)"[^>]*class="([^"]*)"/g,
          ),
        ].map((m) => ({ age: Number(m[1]), cls: m[2] }));
        const zero = elapsed.filter((e) => e.age === 0);
        check(
          `${label} ${locale}: no row at zero days elapsed is painted late [D6]`,
          zero.every((e) => !e.cls.includes("text-tone-red-fg")),
          `${zero.length} row(s) at zero`,
        );
        check(
          `${label} ${locale}: …and every row past zero is [D6]`,
          elapsed
            .filter((e) => e.age > 0)
            .every((e) => e.cls.includes("text-tone-red-fg")),
          `${elapsed.filter((e) => e.age > 0).length} row(s) past zero`,
        );

        /* `D34` — Plan is offered on Slipping and on nothing else. */
        check(
          `${label} ${locale}: the planned section offers no Plan control [D34]`,
          !between(body, "today-planned", "today-slipping").includes(
            'data-slot="today-plan-form"',
          ),
        );

        /* `D64`, `D65` — the block appears exactly on the flags. */
        check(
          `${label} ${locale}: the Requests block ${
            who.requests ? "renders" : "is ABSENT"
          } [D64] [D65]`,
          body.includes('data-slot="today-requests"') === who.requests,
        );
        if (who.requests) {
          for (const slot of [
            "today-requests-quotations",
            "today-requests-dispatches",
          ] as const) {
            check(
              `${label} ${locale}: ${slot} renders [D65]`,
              body.includes(`data-slot="${slot}"`),
            );
          }
        }
        // The notifications card `D64` called out is gone from every screen.
        check(
          `${label} ${locale}: no notifications list stands under a heading [D64]`,
          !body.includes('data-slot="today-waiting"'),
        );

        /* `D32` — the overage, as a biconditional, so the identity that must
           NOT have one is asserted as hard as the one that must. */
        if (body.includes('data-slot="today-target"')) {
          const scale = Number(attrOf(body, "today-bar", "data-scale"));
          check(
            `${label} ${locale}: the overage renders exactly when the bar outgrew the target [D32]`,
            body.includes('data-slot="today-overage"') === scale > 100,
            `scale ${scale}`,
          );
        }
      }
    }

    /* **A tile showing N lands on a list of N** — the whole reason the link
       carries a group and not a kind. Driven on the largest tile. */
    {
      const jar = jars["rep-a@example.test"];
      const { body } = await get(jar, "/en");
      const tiles = [
        ...body.matchAll(
          /data-slot="today-count"[^>]*data-group="([^"]*)"[^>]*data-count="([^"]*)"/g,
        ),
      ].map((m) => ({ group: m[1], count: Number(m[2]) }));
      const biggest = tiles.sort((a, b) => b.count - a.count)[0];
      if (!biggest || biggest.count === 0) {
        console.log("  --    rep-a has no follow-up to land on");
      } else {
        const list = await get(jar, `/en/follow-ups?group=${biggest.group}`);
        // One header row, then the page. `FOLLOW_UP_PAGE_SIZE` is 25.
        const rows =
          (list.body.match(/data-slot="table-row"/g) ?? []).length - 1;
        check(
          `the "${biggest.group}" tile lands on a list of its own size [D33]`,
          rows === Math.min(25, biggest.count),
          `tile ${biggest.count} · list ${rows}`,
        );
      }
    }

    /* **Plan, driven for real, and then put back.**
     *
     * `D34` says Plan *moves the row into a day*. The day that can be asserted
     * on this request is **today**: `25 §18` suppresses an anchor whose date
     * is still ahead, so a future date would make the row vanish rather than
     * cross, and *"it is no longer in Slipping"* would then pass on a row that
     * had simply gone. Today's date is the one value that makes `manualDateDue`
     * raise it and step 3 supersede the automatic kind — a row in the planned
     * section, which is the claim `D34` actually makes.
     *
     * It then **clears the date from the record's own panel**, so the walk
     * leaves the dataset where it found it. That is `project-links`'
     * add-then-remove shape and it is here for the reason `WORKFLOW §5`
     * records against §17: a section that eats its own precondition passes
     * once per database and then fails for ever.
     */
    {
      const jar = jars["rep-a@example.test"];
      const before = await get(jar, "/en");
      const firstRow = after(before.body, "today-slipping").match(
        /<li[^>]*>[\s\S]*?<\/li>/,
      )?.[0];
      const href = firstRow?.match(/href="([^"]*)"/)?.[1];
      const form = firstRow?.match(
        /<form[^>]*data-slot="today-plan-form"[\s\S]*?<\/form>/,
      )?.[0];

      if (!firstRow || !href || !form) {
        console.log("  --    rep-a has no slipping row to plan");
      } else {
        check(
          "a slipping row carries the Plan form and its date field [D34]",
          form.includes('name="nextFollowUpAt"'),
        );
        // The control refuses a past date rather than offering one the server
        // will reject — the visible half of `25 §18`'s refusal.
        check(
          "…and cannot offer a date the server would refuse [D34], [25 §18]",
          /min="\d{4}-\d{2}-\d{2}"/.test(form),
          form.match(/min="[^"]*"/)?.[0] ?? "no min",
        );

        const envelope = envelopeOf(form);
        check(
          "…and it carries a bound action envelope, with no client JS [D20]",
          [...envelope.keys()].some((key) => key.startsWith("$ACTION")),
        );

        // The calendar day in Riyadh, which is what the server compares to.
        envelope.set(
          "nextFollowUpAt",
          new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Riyadh",
            dateStyle: "short",
          }).format(new Date()),
        );

        const posted = await fetch(`${BASE}/en`, {
          method: "POST",
          headers: { cookie: header(jar), origin: BASE },
          body: envelope,
          redirect: "manual",
        });
        store(jar, posted);
        check(
          "the Plan POST is answered [D20]",
          posted.status === 200 || posted.status === 303,
          String(posted.status),
        );

        const moved = await get(jar, "/en");
        check(
          "the planned row crossed into Today · you planned this [D34]",
          between(moved.body, "today-planned", "today-slipping").includes(
            `href="${href}"`,
          ),
        );
        check(
          "…and left Slipping [D34]",
          !after(moved.body, "today-slipping").includes(`href="${href}"`),
        );

        /* Put it back, from the record's own panel. */
        const clear = (await get(jar, href)).body.match(
          /<form[^>]*data-slot="next-follow-up-clear"[\s\S]*?<\/form>/,
        )?.[0];
        if (!clear) {
          console.log(`  note  no clear form — the date is LEFT SET on ${href}`);
        } else {
          const undo = await fetch(`${BASE}${href}`, {
            method: "POST",
            headers: { cookie: header(jar), origin: BASE },
            body: envelopeOf(clear),
            redirect: "manual",
          });
          store(jar, undo);
          check(
            "clearing the date returns the row to Slipping [D34], [25 §18]",
            after((await get(jar, "/en")).body, "today-slipping").includes(
              `href="${href}"`,
            ),
          );
        }
      }
    }
  }
  console.log(
    "\n20. The companies list — ordered by attention, grouped, and its lead cell [D25], [D26], [D2]",
  );
  {
    /* **The order is the claim, and it is asserted ACROSS the page boundary.**
     *
     * A screen that orders its rows after fetching them looks right on page
     * one and is wrong everywhere else — silently, which is the failure
     * `CLAUDE.md` records shipping once already. So this walks page one, takes
     * the last row's silence, walks page two, and takes the first: if the
     * order were applied per page, page two would restart at the top of the
     * scale and this is where it shows.
     *
     * It asserts on `data-days` off `data-slot="silence-meter"` — a DOM marker
     * carrying the number the colour was chosen from, never a translated
     * string.
     */
    for (const locale of ["en", "ar"] as const) {
      const jar = jars["rep-a@example.test"];

      const days = (body: string): (number | "never")[] =>
        [
          ...body.matchAll(/data-slot="silence-meter"[^>]*data-days="([^"]*)"/g),
        ].map((m) => (m[1] === "never" ? "never" : Number(m[1])));

      const one = await get(jar, `/${locale}/companies`);
      const two = await get(jar, `/${locale}/companies?page=2`);

      const meters = days(one.body).length;
      const headers = (one.body.match(/data-slot="company-group"/g) ?? []).length;
      /* **A group header is not a record row.** `TableRow` spreads its props
       * after its own `data-slot`, so `data-slot="company-group"` replaces
       * `table-row` rather than joining it — which is the semantics wanted:
       * anything counting `table-row` to mean *records* then counts records.
       * So the only non-record `table-row` left is the one in `TableHeader`,
       * and that is the single subtraction. */
      const bodyRows =
        (one.body.match(/data-slot="table-row"/g) ?? []).length - 1;
      check(
        `${locale}: every row leads with D26's silence meter [D26]`,
        meters > 0 && meters === bodyRows,
        `${meters} meters · ${bodyRows} rows`,
      );
      check(
        `${locale}: a group header does not count as a record row [D24]`,
        headers > 0 &&
          !/data-slot="company-group"[^>]*data-slot="table-row"/.test(one.body),
        `${headers} headers`,
      );

      /* `silentDays` is what the order is built on and `data-days` is what a
       * person reads — they part company on a never-logged row, which shows
       * "never" and still sorts by its age. So the monotonic assertion runs
       * over the quiet flag first and the figure second, and skips `never`
       * rather than coercing it to a number the screen never showed. */
      const quietFlags = [
        ...one.body.matchAll(
          /data-slot="silence-meter"[^>]*data-quiet="([^"]*)"/g,
        ),
      ].map((m) => m[1]);
      check(
        `${locale}: the quiet rows come first [D25]`,
        quietFlags.join(",") === [...quietFlags].sort().reverse().join(","),
        quietFlags.join(","),
      );

      const tail = days(one.body)
        .filter((d): d is number => d !== "never")
        .at(-1);
      const head = days(two.body).filter((d): d is number => d !== "never")[0];
      if (tail === undefined || head === undefined) {
        console.log(`  --    ${locale}: rep-a has no second page to cross`);
      } else {
        check(
          `${locale}: attention order holds ACROSS the page boundary [D25]`,
          head <= tail,
          `page1 ends ${tail} · page2 starts ${head}`,
        );
      }

      /*
       * `D24` — a group header carries its count, and the count is the whole
       * scope's.
       *
       * **This asserted `header >= quietOnPage` until `S45-4`, and that could
       * not fail on the defect its own comment claimed to catch.** A header
       * counting the PAGE reads *exactly* `quietOnPage` — rep-a's page one is
       * 25 quiet rows under a header reading 37, and a page-local count would
       * read 25, so the assertion compared `25 >= 25` and went green. It was
       * green on the defect and green on the correct screen alike, and had
       * never been seen to fail. **Measured, not argued:** with the count
       * folded off the page's own rows the old line stayed green while the
       * four below went red. That is `CLAUDE.md`'s *an assertion that reads
       * nothing*, the eleventh sighting — the same named shape, not a new one.
       *
       * The shape below is `§24`'s, deliberately not a second one.
       *
       * **`/companies`' two piles PARTITION the scope** — `companies.ts`
       * returns `touched: total - quiet` off one filtered aggregate — so the
       * sum-to-total assertion applies here exactly as it does on
       * `/dispatches`, rather than being forced onto a screen it does not fit.
       *
       * **Cost, chosen and not overlooked:** one GET per page per locale, 8 at
       * rep-a's 180 companies, growing with verify residue. Pages one and two
       * are already in hand above, so the walk pays for `lastPage - 2` of them.
       */
      const pageSize = Number(
        readFileSync("src/lib/companies.ts", "utf8").match(
          /const PAGE_SIZE = (\d+);/,
        )?.[1] ?? "0",
      );
      const totalOf = (body: string) =>
        Number(
          body.match(/data-slot="list-card"[^>]*data-total="(\d+)"/)?.[1] ??
            "-1",
        );
      const scopeTotal = totalOf(one.body);

      // **Setup reported apart from the claim** `CLAUDE.md`. A scope that fits
      // one page cannot show the difference between a scope count and a page
      // count, so it is NOT MEASURED — never a quiet `ok`.
      if (!pageSize || scopeTotal < 0) {
        console.log(
          `  SETUP FAILED at ${
            !pageSize ? "PAGE_SIZE in src/lib/companies.ts" : "data-total"
          } — ${locale}: the group counts are NOT MEASURED`,
        );
      } else if (scopeTotal <= pageSize) {
        console.log(
          `  --    ${locale}: one page of ${scopeTotal} at ${pageSize}/page — scope-vs-page NOT MEASURED`,
        );
      } else {
        const lastPage = Math.ceil(scopeTotal / pageSize);
        const seen = new Map<string, Set<number>>();
        const totals = new Set<number>();
        let rowsWalked = 0;
        let outran = "";
        for (let p = 1; p <= lastPage; p += 1) {
          const body =
            p === 1 ? one.body : p === 2 ? two.body : (
              await get(jar, `/${locale}/companies?page=${p}`)
            ).body;
          totals.add(totalOf(body));
          // A row's pile is its `data-quiet` flag — the same marker the order
          // assertions above read, so a run and a header cannot disagree about
          // what a pile is.
          const flags = [
            ...body.matchAll(
              /data-slot="silence-meter"[^>]*data-quiet="([^"]*)"/g,
            ),
          ].map((m) => m[1]);
          rowsWalked += flags.length;
          const headerTags = [...body.matchAll(/<tr\b[^>]*>/g)]
            .map((m) => m[0])
            .filter((tag) => tag.includes('data-slot="company-group"'));
          for (const tag of headerTags) {
            const group = tag.match(/data-group="([^"]*)"/)?.[1] ?? "";
            const stated = Number(tag.match(/data-count="([^"]*)"/)?.[1] ?? "-1");
            const counts = seen.get(group) ?? new Set<number>();
            counts.add(stated);
            seen.set(group, counts);
            const run = flags.filter(
              (f) => (group === "quiet") === (f === "true"),
            ).length;
            if (!outran && stated > run) {
              outran = `${group} read ${stated} over a run of ${run} on page ${p}`;
            }
          }
        }
        const read = [...seen]
          .map(([group, counts]) => `${group} ${[...counts].join("|")}`)
          .join(" · ");
        const summed = [...seen.values()].reduce(
          (n, counts) => n + Math.max(...counts),
          0,
        );

        // **The read goes in the LABEL, not `detail`** — `check()` prints
        // `detail` only on failure, so a number parked there is invisible
        // exactly when the check claims to have worked `CLAUDE.md`.
        check(
          `${locale}: the walk read every row of the scope — walked ${rowsWalked} of ${scopeTotal} over ${lastPage} pages [D24]`,
          seen.size > 0 && rowsWalked === scopeTotal,
          `${seen.size} groups`,
        );
        // **The positive control, and the whole reason for `S45-4`.** A
        // page-local count is `count === run` on every page and can never
        // outrun its own page; a scope count does, the moment a group is cut
        // by the page boundary. `>=` could not tell those apart.
        check(
          `${locale}: *** a header outruns its page — the count is the SCOPE's, not the page's — saw ${
            outran || "nothing outran its page"
          } *** [D24]`,
          rowsWalked > 0 && outran !== "",
          `over ${lastPage} pages`,
        );
        check(
          `${locale}: *** a group's count is the same on every page it appears on — saw ${
            read || "no group header rendered"
          } *** [D24]`,
          seen.size > 0 && [...seen.values()].every((c) => c.size === 1),
          `over ${lastPage} pages`,
        );
        check(
          `${locale}: *** the group counts sum to the card's own total, over the whole scope — saw ${read} = ${summed} of ${scopeTotal} *** [D24]`,
          seen.size > 0 && summed === scopeTotal,
          `over ${lastPage} pages`,
        );
        check(
          `${locale}: the card's own total does not move between pages — saw ${[
            ...totals,
          ].join("|")} over ${lastPage} pages [D24]`,
          totals.size === 1,
          `${seen.size} groups`,
        );
      }

      /* QUALIFIED lost its column `D2`. The mark is what replaced it, and an
       * unqualified row carries nothing at all — absent, not a dash. */
      const marks = (one.body.match(/data-slot="company-qualified"/g) ?? [])
        .length;
      check(
        `${locale}: qualification is a mark, on some rows and not all [D2]`,
        marks > 0 && marks < meters,
        `${marks} of ${meters}`,
      );

      /* `D62` — `dir="auto"` on the NAME, never on a wrapper that also holds a
       * label or a number. The group header is exactly such a wrapper, and the
       * dashboard shipped this defect once. */
      const groupHeaders = [
        ...one.body.matchAll(/<tr[^>]*data-slot="company-group"[^>]*>/g),
      ].map((m) => m[0]);
      check(
        `${locale}: no group header carries dir="auto" [D62]`,
        groupHeaders.every((h) => !h.includes('dir="auto"')),
        `${groupHeaders.length} headers`,
      );

      /* The two other sorts, and the property that must survive both: a sort
       * never removes a row. Groups go with them — under name or recency the
       * groups would interleave and a header would be a lie. */
      for (const sort of ["name", "recent"]) {
        const sorted = await get(jar, `/${locale}/companies?sort=${sort}`);
        check(
          `${locale}: ?sort=${sort} keeps the list non-empty [D25]`,
          days(sorted.body).length > 0,
        );
        check(
          `${locale}: ?sort=${sort} drops D25's group headers`,
          !sorted.body.includes('data-slot="company-group"'),
        );
      }

      /* An unknown sort is a display preference in a URL people edit, so it
       * falls back rather than 404ing. */
      const bogus = await get(jar, `/${locale}/companies?sort=nonsense`);
      check(
        `${locale}: an unknown ?sort= falls back to the default`,
        bogus.status === 200 && bogus.body.includes('data-slot="company-group"'),
        String(bogus.status),
      );

      /* `D52` — the two empty states are different messages and the filtered
       * one offers a way back. Asserted on the marker and on a link to the
       * bare list, never on the translated sentence. */
      const none = await get(
        jar,
        `/${locale}/companies?q=zzzzznosuchcompanyzzzzz`,
      );
      check(
        `${locale}: a search with no match renders the FILTERED empty state [D52]`,
        attrOf(none.body, "companies-empty", "data-filtered") === "true",
        String(attrOf(none.body, "companies-empty", "data-filtered")),
      );
      check(
        `${locale}: …and offers a way back to the unfiltered list [D52]`,
        after(none.body, "companies-empty").includes(
          `href="/${locale}/companies"`,
        ),
      );
      check(
        `${locale}: the empty state sits OUTSIDE the list card [D60]`,
        !none.body.includes('data-slot="list-card"'),
      );

      /* Emptiness is judged on `q` alone — a sort must never reach the empty
       * state at all. */
      const sortedFull = await get(jar, `/${locale}/companies?sort=name`);
      check(
        `${locale}: a sort never empties the list [D52]`,
        !sortedFull.body.includes('data-slot="companies-empty"'),
      );
    }

    /* **The coordinator's list is NOT empty**, and the note above the archetype
     * markers said it was. `S9` lets a company be assigned to the coordinator
     * and `S18` makes whoever registers one its primary rep — `seed:demo`
     * exercises that so no `company_reps.origin` is unreachable, and they hold
     * four. The old claim predates that seed. Their scope is still their own:
     * what is asserted is that they see *some* and not *every*. */
    {
      const coordinator = jars["coordinator@example.test"];
      const manager = jars["manager@example.test"];
      const countRows = (body: string) =>
        (body.match(/data-slot="silence-meter"/g) ?? []).length;

      const theirs = countRows((await get(coordinator, "/en/companies")).body);
      const all = countRows((await get(manager, "/en/companies")).body);
      check(
        "the coordinator's /companies is scoped — not empty, not everything [S9], [S18]",
        theirs > 0 && theirs < all,
        `coordinator ${theirs} · manager ${all}`,
      );
    }
  }

  console.log(
    "\n21. The company detail — its turn panel, and D70's block sizing [D2], [D24], [D70]",
  );
  {
    /*
     * **The probe this section was built around is GONE, and what it proved is
     * no longer provable here.** Recording that plainly, because a check that
     * quietly stops existing is worse than one that fails.
     *
     * What it caught: the turn panel took its elapsed figure from the newest
     * TIMELINE event — the most recent of seven kinds, a comment and a dispatch
     * among them — while the red band beside it came from the interaction
     * clock. `20 §2` says why those differ: a field note is anchored to nobody
     * and cannot be evidence a customer was contacted, and neither can a
     * comment. So posting a comment reset the number to zero and left the
     * colour alone, and the page printed "Nothing recorded for 0 days" inside a
     * red band next to a Gone quiet badge. On this database it understated 20
     * of one rep's 59 logged companies, by 36 days on average and 118 at worst.
     *
     * How it was proved: a screen cannot be asked whether it read the right
     * column, but it CAN be asked whether its number moves when something that
     * is not an interaction happens. This section posted a comment on the
     * company and bracketed the meter with a before and an after.
     *
     * **`S114` removed the instrument in `27b`.** A comment can no longer land
     * on a company, and the company screen is the only one carrying a
     * `silence-meter` — so there is no longer a non-interaction event a rep can
     * add to a company timeline over HTTP from inside this section.
     *
     * **What is therefore NOT proven any more, stated rather than left
     * implied:** that the panel's figure is unmoved by a DERIVED company event
     * — a quotation raised, a version issued, a dispatch. Those are still on
     * the timeline and the panel could still, in principle, read one. What has
     * changed is that the specific defect this section caught is structurally
     * unreachable rather than merely untested: the event kind that caused it
     * cannot exist on a company any more.
     *
     * Re-pointing this at raising a quotation was considered and declined by
     * founder decision — it drags §14's machinery into a section that does not
     * own it, to guard a case no rule says is at risk. `coverage.ts` states in
     * place that the figure comes from `companySilence` and nothing else, which
     * is the claim, and `verify:phase9` §11 is where that function is measured.
     */
    const jar = jars["rep-a@example.test"];
    const list = await get(jar, "/en/companies");
    const id = firstId(list.body, "companies");

    if (!id) {
      console.log("  --    rep-a holds no company; section skipped");
    } else {
      const path = `/en/companies/${id}`;
      const before = await get(jar, path);
      check(
        "the company detail answers 200 for its holder",
        before.status === 200,
        `got ${before.status}`,
      );

      /** The meter's figure, read from inside the turn panel and nowhere else —
       *  `/companies` renders the same marker in every row. */
      const daysOf = (body: string) =>
        attrOf(after(body, "turn-panel"), "silence-meter", "data-days");

      const figureBefore = daysOf(before.body);
      check(
        "the turn panel carries D26's meter [D24], [D26]",
        figureBefore !== null,
        `data-days ${figureBefore}`,
      );

      // **The composer's ABSENCE is what this screen now asserts** `S114`
      // `D48`. It is the same read the probe opened with, inverted: the page
      // rendered — the meter above proves that — and it carries no composer.
      // `walkRecords` asserts the same thing over every company id it finds;
      // this one stands because §21 already has the page in hand and the claim
      // belongs beside the paragraph explaining what left with it.
      check(
        "no comment composer on the company screen [S114], [D48]",
        !before.body.includes('data-slot="comment-composer"'),
      );

      const detail = await get(jar, path);

      /*
       * **The avatar names the HOLDER, not the finder** `S18` `S123`.
       *
       * `created_by` never moves; primacy moves on handover `S103` and on
       * dormancy reassignment, so the panel's old `createdByName` was the wrong
       * answer to `D2` on every company that has changed hands. The initials
       * are decorative and `aria-hidden`, so what is asserted is that they are
       * there at all — the name itself is in the line beside them.
       */
      check(
        "the panel renders an avatar for whoever holds the company [S18], [D2]",
        /aria-hidden/.test(after(detail.body, "turn-panel")),
      );

      /* `D70` — a long list caps and states its total. */
      const timelineEvents = (
        after(detail.body, "timeline").match(/data-timeline-event/g) ?? []
      ).length;
      check(
        "the timeline card holds at most 8 entries [D70]",
        timelineEvents <= 8,
        `${timelineEvents} rendered`,
      );

      const cards = detail.body.match(/data-slot="related-card"[^>]*/g) ?? [];
      check(
        "quotations, projects, dispatches and contacts all render [22 §3], [D26]",
        cards.length === 4,
        `${cards.length} related cards`,
      );
      check(
        "every related card states its total [D70]",
        cards.length > 0 && cards.every((card) => /data-total="\d+"/.test(card)),
        cards.join(" | "),
      );

      /* `D70` — an empty block is absent, not an empty shell. The dormancy
       * history used to render a heading over "No decisions recorded yet". */
      const decisions = (
        after(detail.body, "dormancy-history").match(/<li/g) ?? []
      ).length;
      check(
        "the dormancy history renders only when there is one [D70]",
        !detail.body.includes('data-slot="dormancy-history"') || decisions > 0,
        `history block present with ${decisions} decisions`,
      );

      /* `D70` — and it moved last. Positional, so it is asserted positionally:
       * wherever the dormancy block is, it begins after the last related card. */
      const lastCard = detail.body.lastIndexOf('data-slot="related-card"');
      const dormancy = detail.body.indexOf('data-slot="dormancy-history"');
      if (dormancy >= 0) {
        check(
          "the dormancy block sits after the related cards [D70]",
          dormancy > lastCard,
          `${dormancy} vs ${lastCard}`,
        );
      }

      /* The facts grid keeps the three handles section 13 asserts on, gains a
       * lead, and loses the two that no longer belong. */
      check(
        "phone leads the facts grid [D70], [S13], [S23]",
        factHtmlOf(detail.body, "phone").includes('data-lead="true"'),
      );
      check(
        "the place triple keeps its handles [S14], [S15]",
        ["country", "region", "city"].every(
          (name) => factHtmlOf(detail.body, name) !== "",
        ),
      );
      check(
        "category left the grid — the header already carries it [D70]",
        factHtmlOf(detail.body, "category") === "",
      );
      check(
        "and no VAT number fact survives [0028]",
        !detail.body.includes("vatNumber"),
      );

      /* `S32` — the Log button is the main entry point, so it is in the header
       * and not in the fourth card down. Asserted as *exactly one*: two would
       * be two controls doing one thing. */
      // **Anchors only, and no regex escaping.** Counting the raw substring
      // also finds the RSC flight payload Next.js serialises into the same
      // document, which is not a control anybody can click — it read 2 for
      // one rendered button. A company id is a uuid and the href is fixed,
      // so this is a plain string test over every anchor rather than a
      // pattern with a `?` in it to escape.
      const logHref = `/reports/new?companyId=${id}`;
      const logLinks = (detail.body.match(/<a[^>]*>/g) ?? []).filter((tag) =>
        tag.includes(logHref),
      ).length;
      check(
        "exactly one Log button, and it is above the fold [S32], [D46]",
        logLinks === 1,
        `${logLinks} anchor(s)`,
      );
    }

    /*
     * **The coordinator holds four companies and is refused the rest** `S9`.
     *
     * NOT the flat 404 an earlier reading predicted: `S76` opens projects and
     * contacts to the coordinator and says nothing about companies, while `S9`
     * lets one be assigned to them — and `seed:demo` exercises that so no
     * `company_reps.origin` is unreachable. So their company scope is an
     * ordinary membership scope. Both halves are asserted, because a screen
     * that 404s for everybody and one that opens for everybody each pass a
     * one-sided check.
     */
    {
      const coordinator = jars["coordinator@example.test"];
      const theirs = firstId(
        (await get(coordinator, "/en/companies")).body,
        "companies",
      );
      if (theirs) {
        const held = await get(coordinator, `/en/companies/${theirs}`);
        check(
          "the coordinator opens a company they hold [S9], [S18]",
          held.status === 200,
          `got ${held.status}`,
        );
      }
      const managerFirst = firstId(
        (await get(jars["manager@example.test"], "/en/companies")).body,
        "companies",
      );
      if (managerFirst && managerFirst !== theirs) {
        const refused = await get(coordinator, `/en/companies/${managerFirst}`);
        check(
          "…and gets 404, not 500, on one they do not [D53]",
          refused.status === 404,
          `got ${refused.status}`,
        );
      }
    }

    /*
     * Arabic, and the empty-card sentence.
     *
     * A card can be empty for a RULE rather than for want of data: a rep
     * holding a company through a share sees no projects `[04 Q7]` and no
     * quotations, because neither filter consults company membership. A blank
     * card and a card empty by rule are the same picture, so what is asserted
     * is that an empty one still renders a sentence `D52` `D70`.
     */
    {
      const arabic = await get(jar, "/ar/companies");
      const anyId = firstId(arabic.body, "companies");
      if (anyId) {
        const page = await get(jar, `/ar/companies/${anyId}`);
        check(
          "ar: the detail renders with its cards [D57]",
          page.status === 200 && page.body.includes('data-slot="related-card"'),
          `got ${page.status}`,
        );
        const empties =
          page.body.match(/data-slot="related-card" data-total="0"/g) ?? [];
        check(
          "ar: an empty related card carries a sentence, not a blank [D52], [D70]",
          empties.length === 0 ||
            /data-total="0"[\s\S]{0,600}?<p class="[^"]*text-start/.test(
              page.body,
            ),
          `${empties.length} empty card(s)`,
        );
      }
    }
  }
  console.log(
    "\n22. The projects board — six columns, nothing draggable, and the table beside it [D28], [D29], [D25]",
  );
  {
    /*
     * **The board's columns are read out of `src/lib/chain.ts`, not typed
     * here.** `CHAIN_COLUMNS` is the one definition `D27` and `D29` both point
     * at, and a copy of a list in an assertion goes stale in silence — the same
     * device `NAMESPACES` uses at the top of this file to build its pattern
     * from the catalogue rather than from memory. This file still imports
     * nothing from `src/`.
     */
    const columns = (
      readFileSync("src/lib/chain.ts", "utf8")
        .match(/export const CHAIN_COLUMNS = \[([\s\S]*?)\] as const;/)?.[1] ??
      ""
    )
      .split(",")
      .map((entry) => entry.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);

    check(
      "the six columns were read from chain.ts, not copied into this script",
      columns.length === 6,
      `${columns.length} found`,
    );

    for (const locale of ["en", "ar"] as const) {
      const jar = jars["rep-a@example.test"];

      /* ── D28: the default view, and the other one ────────────────────── */

      const board = await get(jar, `/${locale}/projects`);
      check(
        `${locale}: *** /projects with no parameter is the BOARD *** [D28]`,
        board.body.includes('data-slot="project-board"'),
        `status ${board.status}`,
      );
      check(
        `${locale}: …and it is not also rendering the table`,
        !board.body.includes('data-slot="list-card"'),
      );

      const table = await get(jar, `/${locale}/projects?view=table`);
      check(
        `${locale}: ?view=table is the table [D28]`,
        table.body.includes('data-slot="list-card"') &&
          !table.body.includes('data-slot="project-board"'),
        `status ${table.status}`,
      );
      // An unknown value is a display preference in a URL people edit, not a
      // record — it falls back rather than 404ing, as `?sort=` does.
      const nonsense = await get(jar, `/${locale}/projects?view=chartreuse`);
      check(
        `${locale}: an unknown ?view= falls back to the board, never a 404`,
        nonsense.status === 200 &&
          nonsense.body.includes('data-slot="project-board"'),
        `status ${nonsense.status}`,
      );

      /* ── D29: six columns, in the chain's own order ──────────────────── */

      const rendered = [
        ...board.body.matchAll(/data-slot="board-column" data-column="([a-zA-Z]+)"/g),
      ].map((match) => match[1]);
      check(
        `${locale}: *** all six chain positions render, in CHAIN_COLUMNS order *** [D29]`,
        rendered.join(",") === columns.join(","),
        `got ${rendered.join(",") || "none"}`,
      );

      const counts = [
        ...board.body.matchAll(/data-slot="board-column"[^>]*data-count="(\d+)"/g),
      ].map((match) => Number(match[1]));
      const total = Number(attrOf(board.body, "project-board", "data-total"));
      check(
        `${locale}: the column counts add up to the board's own total`,
        counts.length === 6 && counts.reduce((a, b) => a + b, 0) === total,
        `${counts.join("+")} against ${total}`,
      );

      /*
       * **The column scrolls; it does not truncate.** `D29` takes the scroll
       * answer over `D70`'s cap, and the difference between the two is exactly
       * whether every card is in the DOM. A cap would put fewer cards here than
       * the counts claim, which is the failure a reader could not see.
       */
      const cards = (board.body.match(/data-slot="board-card"/g) ?? []).length;
      check(
        `${locale}: *** every card is rendered — the column scrolls, it does not cap *** [D29]`,
        cards === total,
        `${cards} rendered against ${total} counted`,
      );

      // A column with nothing in it still renders `D29` — the board is the six
      // positions, not however many happen to be occupied.
      check(
        `${locale}: an empty column still renders, with its zero [D29], [D24]`,
        rendered.length === 6,
        `${rendered.length} column(s)`,
      );

      /* ── D29 + D58: nothing that reads as draggable ──────────────────── */

      /*
       * **The flight payload is stripped first.** Next embeds the RSC payload
       * in `<script>` tags that repeat every className as JSON, so a raw count
       * of `card-face` reads six columns as twelve — the same reason section
       * 12's key scanner strips `<script>` blocks whole before it looks at
       * anything. What is left is what a person actually sees.
       */
      const boardMarkup = after(board.body, "project-board").replace(
        /<script[\s\S]*?<\/script>/g,
        "",
      );
      check(
        `${locale}: *** nothing on the board is draggable, and nothing looks it *** [D29], [D58]`,
        !/draggable|cursor-grab|cursor-move|hover:-translate|hover:scale|hover:shadow/.test(
          boardMarkup,
        ),
        "a drag affordance is present",
      );
      // `D21` forbids a nested card. The column wears the card texture; the
      // items inside it are rows, which is what removes the affordance rather
      // than suppressing it.
      // Counted against the columns rather than against six: Next embeds the
      // flight payload in a `<script>`, which repeats every className, so both
      // sides double together and the ratio is what carries the claim. An item
      // wearing the texture would push the surfaces above the columns.
      const surfaces = (boardMarkup.match(/card-face/g) ?? []).length;
      const columnTags = (
        boardMarkup.match(/data-slot="board-column"/g) ?? []
      ).length;
      check(
        `${locale}: the column is the card and the items are rows [D21], [D14]`,
        surfaces === columnTags &&
          !/data-slot="board-card"[^>]*card-face/.test(boardMarkup),
        `${surfaces} surfaces against ${columnTags} columns`,
      );

      /* ── D29: the header names the pile, and never a person ──────────── */

      check(
        `${locale}: every column of the ladder renders its own header [D29]`,
        columns.every((column) => board.body.includes(`data-column="${column}"`)),
      );
      /*
       * **`D29` as amended, asserted as an ABSENCE.** The board named a person
       * under each column title until `S132` — `chainOwner`, through
       * `chain.by.*` — and the rule now says why that was wrong: a header
       * describing a person makes the person the subject, and the subject is
       * the project. `D2` is answered by the pile's own definition instead.
       *
       * **Asserted structurally, not by string.** This file may not compare a
       * translated value, so it counts what a header CONTAINS: exactly one
       * paragraph, the name and the count. A second line coming back fails it
       * whatever language it is written in, which is the whole point.
       */
      const headerBlocks = [
        ...boardMarkup.matchAll(/<header[^>]*>([\s\S]*?)<\/header>/g),
      ].map((match) => match[1]);
      check(
        `${locale}: every column renders exactly one header [D29]`,
        headerBlocks.length === columns.length,
        `${headerBlocks.length} header(s) for ${columns.length} columns`,
      );
      check(
        `${locale}: *** no column header names a person *** [D29], [D24]`,
        headerBlocks.every(
          (block) => (block.match(/<p[\s>]/g) ?? []).length === 1,
        ),
        headerBlocks
          .map((block) => (block.match(/<p[\s>]/g) ?? []).length)
          .join(","),
      );

      /* ── D59: the view chips carry the search ────────────────────────── */

      const searched = await get(jar, `/${locale}/projects?q=a`);
      check(
        `${locale}: *** the view chip carries the current search *** [D59]`,
        /href="[^"]*\/projects\?q=a&(?:amp;)?view=table"/.test(searched.body),
        "the table chip drops ?q=",
      );

      /* ── D25: ordered by attention, and the chain cell that says so ──── */

      check(
        `${locale}: the table says whose move it is, not only the state [D2]`,
        table.body.includes('data-slot="turn"') &&
          table.body.includes('data-slot="project-moved"'),
      );
      const moved = [
        ...table.body.matchAll(/data-slot="project-moved"[^>]*data-stale="(true|false)"/g),
      ].map((match) => match[1]);
      check(
        `${locale}: …and every row carries the figure the order is built on [D25]`,
        moved.length > 0,
        `${moved.length} row(s)`,
      );
      // Oldest first `D25`, so a stale row can never sit below a fresh one.
      check(
        `${locale}: *** stale rows come first — the list is ordered by attention *** [D25]`,
        moved.indexOf("false") === -1 ||
          moved.lastIndexOf("true") < moved.indexOf("false"),
        `order was ${moved.join(",")}`,
      );

      /* ── D2: the owner column earns its place ────────────────────────── */

      check(
        `${locale}: *** rep-a's own list does NOT repeat his name in a column *** [D2]`,
        !table.body.includes('data-slot="project-owner"'),
        "the owner column rendered for a single-owner list",
      );

      const wide = await get(
        jars["manager@example.test"],
        `/${locale}/projects?view=table`,
      );
      check(
        `${locale}: …while a reader who sees more than one person's work gets it [D2]`,
        wide.body.includes('data-slot="project-owner"'),
      );

      /* ── D2: and the cell is BLANK where the reader owns it ───────────
       *
       * **The two checks above pass for the rule this replaced.** They test
       * whether the column renders, and `ownerCount > 1` and
       * `foreignOwnerCount > 0` give the same answer on this fixture — so
       * presence alone is not evidence about which rule is in force. What
       * separates them is the cell: the reader's own rows are blank, and blank
       * means *mine*.
       *
       * Driven as the COORDINATOR, who is the only identity that reads a wide
       * list AND owns something in it — `S127` lets her hold a company like any
       * rep. A manager owns nothing here, so every cell would be filled and the
       * blank half would go undriven. */
      const hers = await get(
        jars["coordinator@example.test"],
        `/${locale}/projects?view=table`,
      );
      const ownerCells = [...hers.body.matchAll(/data-owner="(self|other)"/g)].map(
        (m) => m[1],
      );
      check(
        `${locale}: the coordinator's own projects are on the page — the blank half is driven [S127]`,
        ownerCells.includes("self"),
        `cells were ${ownerCells.join(",") || "none"}`,
      );
      check(
        `${locale}: *** …and her own row's owner cell is EMPTY — blank means mine *** [D2]`,
        /data-owner="self"[^>]*><\/td>/.test(hers.body),
        "a self-owned row printed the reader's own name",
      );
      check(
        `${locale}: …while somebody else's row names them [D2]`,
        /data-owner="other"[^>]*>\s*<span[^>]*>[^<]+<\/span>/.test(hers.body),
        "a foreign-owned row rendered no name",
      );

      /* ── D57: RTL mirrors by CSS, never by reordering the DOM ────────── */

      if (locale === "ar") {
        const english = await get(jar, "/en/projects");
        const order = (body: string) =>
          [...body.matchAll(/data-column="([a-zA-Z]+)"/g)]
            .map((m) => m[1])
            .join(",");
        check(
          "ar: *** the DOM order is identical to English — the mirror is CSS *** [D57]",
          order(board.body) === order(english.body),
          "the columns were reordered in markup",
        );
        check(
          "ar: …and no rtl: override or flex-row-reverse was needed [D57]",
          !/flex-row-reverse|rtl:/.test(boardMarkup),
        );
      }
    }

    /*
     * **The two views are two arrangements of one query** `D28`, and the
     * cheapest proof of that is that they count the same records. The board
     * subtracts the lost `D29` and states how many — a silent subtraction is
     * the thing `D70` and `D59` both exist to stop — so board + lost is the
     * table's own total.
     */
    {
      const jar = jars["manager@example.test"];
      const board = await get(jar, "/en/projects");
      const table = await get(jar, "/en/projects?view=table");
      const onBoard = Number(attrOf(board.body, "project-board", "data-total"));
      const lost = Number(attrOf(board.body, "board-off", "data-lost") ?? "0");
      // `data-total` on the list card, not the footer's sentence — the count
      // is prose in two locales and this file never reads a translation.
      const showing = Number(attrOf(table.body, "list-card", "data-total"));
      check(
        "*** the board states what it is not showing, rather than dropping it *** [D29], [D70]",
        lost === 0 || board.body.includes('data-slot="board-off"'),
        `${lost} lost with no line saying so`,
      );
      check(
        "the board and the table are two arrangements of one query [D28]",
        onBoard + lost === showing,
        `board ${onBoard} + lost ${lost} against table ${showing}`,
      );
    }
  }

  /* ── 24 ──────────────────────────────────────────────────────────────── */

  console.log(
    "\n24. The dispatches list and detail — three piles, the lead cell, and where the difference lives [D25], [D26], [D66], [S77]",
  );
  {
    /*
     * **The piles are read out of `src/lib/dispatches.ts`, not typed here** —
     * the device section 22 uses for `CHAIN_COLUMNS`, and for the same reason:
     * a copy of a list in an assertion goes stale in silence. This file still
     * imports nothing from `src/`.
     */
    const groups = (
      readFileSync("src/lib/dispatches.ts", "utf8")
        .match(/export const DISPATCH_GROUPS = \[([\s\S]*?)\] as const;/)?.[1] ??
      ""
    )
      .split(",")
      .map((entry) => entry.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);

    check(
      "the three piles were read from dispatches.ts, not copied into this script",
      groups.length === 3,
      `${groups.length} found`,
    );

    for (const locale of ["en", "ar"] as const) {
      /* ── D25: grouped by whose move, and the counts are the SCOPE's ──── */

      // The coordinator, because this is her screen — `S72` makes her the one
      // who checks and approves, and `D65` lands her here from her dashboard.
      const jar = jars["coordinator@example.test"];
      const list = await get(jar, `/${locale}/dispatches`);
      check(`${locale}: /dispatches answers 200`, list.status === 200);

      /*
       * **Parsed by element, never by attribute ORDER.** The first version of
       * this section matched `data-slot="…" data-group="…" data-count="…"` as
       * one literal sequence and found nothing, while the row check beside it —
       * same markup, different attribute order — passed. A black-box script
       * that depends on the order JSX happens to emit is asserting on the
       * renderer rather than on the screen.
       */
      const attr = (tag: string, name: string) =>
        tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? "";
      const tags = (body: string, slot: string) =>
        [...body.matchAll(/<tr\b[^>]*>/g)]
          .map((m) => m[0])
          .filter((tag) => tag.includes(`data-slot="${slot}"`));

      const rendered = [...list.body.matchAll(/data-group="(\w+)"/g)].map(
        (m) => m[1],
      );
      const headers = tags(list.body, "dispatch-group").map(
        (tag) =>
          [tag, attr(tag, "data-group"), attr(tag, "data-count")] as const,
      );
      check(
        `${locale}: *** the list is GROUPED, not flat *** [D25]`,
        headers.length > 0,
        "no pile header rendered",
      );
      // **Guarded on there being something to read.** `every()` over an empty
      // array is `true`, so this and the two below would all have gone green on
      // a 500 — which is exactly what happened on the first run of this
      // section, beside four honest failures. `B1`–`B4` in `WORKFLOW §5` are
      // the same shape: an assertion that passes without reading anything.
      check(
        `${locale}: every pile it renders is one of the three [D25]`,
        headers.length > 0 && headers.every(([, group]) => groups.includes(group)),
        headers.map(([, g]) => g).join(",") || "nothing rendered",
      );
      // A pile is a contiguous run, or the header lies about what follows it.
      const order = rendered.filter((g) => groups.includes(g));
      const ranked = order.map((g) => groups.indexOf(g));
      check(
        `${locale}: *** each pile is a contiguous run — resolved in SQL, not re-sorted *** [D25]`,
        ranked.length > 0 &&
          ranked.every((rank, i) => i === 0 || rank >= ranked[i - 1]),
        `order was ${order.join(",") || "nothing rendered"}`,
      );
      /*
       * `D24` — a group header states its count, and the count is the whole
       * SCOPE's, never the page's.
       *
       * **This asserted the wrong thing until `S45-1`.** It summed ONE page's
       * headers against the card's own total and required equality — which
       * only holds while every pile fits on page one. A pile with no row on
       * this page renders no header at all (`dispatches/page.tsx`, `D70`), so
       * at 25 rows a page over a scope of 179 the readable headers were
       * `coordinator + rep = 60` against a card reading `179`, and the check
       * went red on a screen that was already correct — the counts had been
       * whole-scope SQL aggregates all along (`dispatches.ts`, one statement,
       * before the `limit`). That is the tenth wrong-reason sighting in
       * `CLAUDE.md` and the first of the MIRROR shape: a check that FAILS for
       * the wrong reason rather than passing for one. It cost a founder
       * decision to rewrite working code.
       *
       * So the claim is asserted ACROSS the pages. **Cost, chosen and not
       * overlooked:** one GET per page per locale — 8 at today's 179 rows —
       * and it grows with verify residue. Summing one page is the thing this
       * replaced; only the whole walk proves the sum, and the sum is the claim.
       *
       * `D70` is deliberately no longer cited here: its *cap and state its
       * total* governs a block on a DETAIL page, and this list card's footer
       * total is `D24`'s *pagination in the footer*.
       */
      const pageSize = Number(
        readFileSync("src/lib/dispatches.ts", "utf8").match(
          /const PAGE_SIZE = (\d+);/,
        )?.[1] ?? "0",
      );
      const cardTotalOf = (body: string) =>
        Number(
          body.match(/data-slot="list-card"[^>]*data-total="(\d+)"/)?.[1] ??
            "-1",
        );
      const cardTotal = cardTotalOf(list.body);

      // **Setup is reported apart from the claim** `CLAUDE.md`. A scope that
      // fits on one page cannot show the difference between a scope count and
      // a page count, so it is NOT MEASURED — never a quiet `ok`, which is the
      // failure this whole section was rewritten out of.
      if (!pageSize || cardTotal < 0) {
        console.log(
          `  SETUP FAILED at ${
            !pageSize ? "PAGE_SIZE in src/lib/dispatches.ts" : "data-total"
          } — ${locale}: the pile counts are NOT MEASURED`,
        );
      } else if (cardTotal <= pageSize) {
        console.log(
          `  --    ${locale}: one page of ${cardTotal} at ${pageSize}/page — scope-vs-page NOT MEASURED`,
        );
      } else {
        const lastPage = Math.ceil(cardTotal / pageSize);
        const seen = new Map<string, Set<number>>();
        const totals = new Set<number>();
        let rowsWalked = 0;
        let outran = "";
        for (let p = 1; p <= lastPage; p++) {
          const body =
            p === 1
              ? list.body
              : (await get(jar, `/${locale}/dispatches?page=${p}`)).body;
          totals.add(cardTotalOf(body));
          const pageRows = tags(body, "dispatch-row").map((tag) =>
            attr(tag, "data-group"),
          );
          rowsWalked += pageRows.length;
          for (const tag of tags(body, "dispatch-group")) {
            const group = attr(tag, "data-group");
            const count = Number(attr(tag, "data-count"));
            const counts = seen.get(group) ?? new Set<number>();
            counts.add(count);
            seen.set(group, counts);
            const run = pageRows.filter((g) => g === group).length;
            if (!outran && count > run) {
              outran = `${group} read ${count} over a run of ${run} on page ${p}`;
            }
          }
        }
        const read = [...seen]
          .map(([group, counts]) => `${group} ${[...counts].join("|")}`)
          .join(" · ");
        const summed = [...seen.values()].reduce(
          (n, counts) => n + Math.max(...counts),
          0,
        );

        /*
         * **The read goes in the LABEL, not the detail** — `check()` prints
         * `detail` only on failure, so a number parked there is invisible on
         * the pass and the green line says nothing a reader can re-derive.
         * `CLAUDE.md`: *an assertion prints what it read*. The first cut of
         * this block put all four numbers in `detail` and every one of them
         * vanished into `ok`.
         */

        // The walk read what it says it read. The three below guard on this
        // rather than on an empty page.
        check(
          `${locale}: the walk read every row of the scope — walked ${rowsWalked} of ${cardTotal} over ${lastPage} pages [D24]`,
          seen.size > 0 && rowsWalked === cardTotal,
          `${seen.size} piles`,
        );
        // **The positive control.** A page-local count is `count === run` on
        // every page and can never outrun its own page; a scope count does, the
        // moment a pile is cut by the page boundary. This is what the old sum
        // was reaching for, and it fires on page one.
        check(
          `${locale}: *** a header outruns its page — the count is the SCOPE's, not the page's — saw ${
            outran || "nothing outran its page"
          } *** [D24]`,
          rowsWalked > 0 && outran !== "",
          `over ${lastPage} pages`,
        );
        check(
          `${locale}: *** a pile's count is the same on every page it appears on — saw ${
            read || "no pile header rendered"
          } *** [D24]`,
          seen.size > 0 && [...seen.values()].every((c) => c.size === 1),
          `over ${lastPage} pages`,
        );
        check(
          `${locale}: *** the pile counts sum to the card's own total, over the whole scope — saw ${read} = ${summed} of ${cardTotal} *** [D24]`,
          seen.size > 0 && summed === cardTotal,
          `over ${lastPage} pages`,
        );
        check(
          `${locale}: the card's own total does not move between pages — saw ${[
            ...totals,
          ].join("|")} over ${lastPage} pages [D24]`,
          totals.size === 1,
          `${seen.size} piles`,
        );
      }
      // The pile a row landed in is the pile the row says it is in. One map
      // orders the SQL and labels the row `[dispatchGroup]`; this is what
      // catches them drifting apart.
      const rows = tags(list.body, "dispatch-row").map(
        (tag) =>
          [tag, attr(tag, "data-status"), attr(tag, "data-group")] as const,
      );
      const EXPECTED: Record<string, string> = {
        submitted: "coordinator",
        draft: "rep",
        approved: "none",
        cancelled: "none",
        refused: "none",
      };
      check(
        `${locale}: *** every row's status agrees with the pile it is in *** [S72], [D25]`,
        rows.length > 0 && rows.every(([, s, g]) => EXPECTED[s] === g),
        rows
          .filter(([, s, g]) => EXPECTED[s] !== g)
          .map(([, s, g]) => `${s} in ${g}`)
          .join(", ") || `${rows.length} rows`,
      );
      // `S122` — a refusal is out of the working list, and reachable.
      check(
        `${locale}: *** no refused request is in the working list *** [S122]`,
        rows.length > 0 && !rows.some(([, status]) => status === "refused"),
        rows.length === 0 ? "nothing rendered" : "a refusal was in the working list",
      );
      const archive = await get(jar, `/${locale}/dispatches?archive=1`);
      check(
        `${locale}: …and the archive chip reaches them [S122], [D59]`,
        archive.status === 200 &&
          (archive.body.includes('data-status="refused"') ||
            archive.body.includes('data-slot="dispatches-empty"')),
      );
      // `D59` — a chip carries the current search, or the list silently
      // returns the wrong rows. This broke three lists.
      const searched = await get(jar, `/${locale}/dispatches?q=zzz`);
      check(
        `${locale}: the archive and direct chips carry the search [D59]`,
        /q=zzz&(amp;)?archive=1/.test(searched.body) &&
          /q=zzz&(amp;)?direct=1/.test(searched.body),
        "a chip dropped the query",
      );

      /* ── D26: the lead cell, and D66: what is NOT on the row ──────────── */

      // **The lead cell is asserted by POSITION, not by class.** `D26` says
      // each object type's FIRST column is the visual answering its question,
      // and for a dispatch that is the square metres — so the check is that
      // `data-lead="sqm"` is the first `<td>` of a row, which a restyle cannot
      // quietly satisfy by putting the marker somewhere else.
      const leadFirst = [
        ...list.body.matchAll(/data-slot="dispatch-row"[^>]*>(<td[^>]*>)/g),
      ].map((m) => m[1]);
      check(
        `${locale}: *** the lead cell is the square metres, not the date *** [D26]`,
        leadFirst.length > 0 &&
          leadFirst.every((td) => td.includes('data-lead="sqm"')),
        `${leadFirst.filter((td) => !td.includes('data-lead="sqm"')).length} row(s) lead with something else`,
      );
      // Guarded the same way: an absence check on a page that did not render
      // is not evidence about the absence.
      check(
        `${locale}: *** the difference badge is NOT on the list *** [D66]`,
        rows.length > 0 && !list.body.includes('data-differs="yes"'),
        rows.length === 0
          ? "nothing rendered"
          : "the list still flags a difference to the coordinator",
      );

      /* ── D2: the rep column, and the blank half ───────────────────────── */

      const repCells = [...list.body.matchAll(/data-rep="(self|other)"/g)].map(
        (m) => m[1],
      );
      if (repCells.includes("self")) {
        check(
          `${locale}: *** a row crediting the reader leaves the rep cell EMPTY *** [D2]`,
          /data-rep="self"[^>]*><\/td>/.test(list.body),
          "the reader's own name was printed back at them",
        );
      } else {
        console.log(
          `  --    ${locale}: no row on page 1 credits the coordinator — blank half not driven`,
        );
      }
      const repA = await get(jars["rep-a@example.test"], `/${locale}/dispatches`);
      check(
        `${locale}: …and a rep whose every dispatch is his own gets no column at all [D2]`,
        repA.body.includes('data-slot="dispatch-row"') &&
          !repA.body.includes('data-column="rep"'),
        repA.body.includes('data-slot="dispatch-row"')
          ? "the rep column rendered on a single-rep list"
          : "rep-a's list rendered no rows at all",
      );

      /* ── S77: the comparison, on the detail, and absent on a free entry ─ */

      /*
       * **Both sides, or neither proves anything.** A card that never rendered
       * would pass an "absent on a free entry" check on its own, which is the
       * `B1`–`B4` shape `WORKFLOW §5` already records: an assertion that can
       * pass without reading anything. So one linked dispatch and one free
       * entry are picked off the list by their own marker and driven together.
       */
      // Split on the row boundary rather than matching across it — one row's
      // cells cannot then be read as the next row's.
      const chunks = list.body.split('data-slot="dispatch-row"').slice(1);
      const idOf = (source: "linked" | "direct") =>
        chunks
          .find((chunk) => chunk.includes(`data-source="${source}"`))
          ?.match(/data-id="([0-9a-f-]{36})"/)?.[1];

      const linkedId = idOf("linked");
      const freeId = idOf("direct");
      check(
        `${locale}: the list offers both a linked dispatch and a free entry to drive [S75]`,
        Boolean(linkedId) && Boolean(freeId),
        `linked=${Boolean(linkedId)} free=${Boolean(freeId)}`,
      );

      if (linkedId) {
        const detail = await get(jar, `/${locale}/dispatches/${linkedId}`);
        check(`${locale}: a dispatch detail answers 200`, detail.status === 200);

        /*
         * **The dispatch date carries NO `dir`, and the absence is the
         * assertion** `D62`.
         *
         * `Intl` formats an `ar` date as `29<U+200F>/08<U+200F>/2026` — it
         * embeds RIGHT-TO-LEFT MARKs so the segments land correctly inside an
         * RTL run. `dir="ltr"` fights them: the digits resolve to three
         * different embedding levels and the day jumps to the front. This cell
         * shipped `292026/08/` in Arabic while the header two elements up, with
         * no `dir` at all, rendered `2026/08/29` from the same formatter.
         *
         * **No script can see the defect** — bidi reordering happens at render
         * and this file executes none — so what is asserted is the MARKUP that
         * causes it, which is the attribute's absence.
         *
         * **Guarded on a non-empty read**, and it prints what it saw. A bare
         * `!includes('dir="ltr"')` would pass just as well on a cell that never
         * rendered, which is the shape `WORKFLOW §5` carries four rows about.
         */
        const dateCell = factHtmlOf(detail.body, "dispatchDate");
        check(
          `${locale}: the dispatch date cell rendered at all [D62]`,
          /[0-9]{4}/.test(dateCell),
          `saw ${JSON.stringify(factOf(detail.body, "dispatchDate"))}`,
        );
        check(
          `${locale}: *** …and carries no dir="ltr", which would scramble it *** [D62]`,
          Boolean(dateCell) && !dateCell.includes('dir="ltr"'),
          `saw ${JSON.stringify(dateCell.slice(0, 160))}`,
        );
        check(
          `${locale}: *** S77's comparison card renders on a linked dispatch *** [S77]`,
          detail.body.includes('data-slot="against-quotation"'),
          "the card the founder most wants is missing",
        );
        // Three figures, not two — `S77` says two would read a lawful partial
        // dispatch as a deviation nobody made.
        for (const figure of [
          "quotedSqm",
          "dispatchedAgainstVersion",
          "thisDispatchSqm",
        ]) {
          check(
            `${locale}: …and it carries ${figure} [S77]`,
            detail.body.includes(`data-fact="${figure}"`),
            "the fact did not render",
          );
        }
        // `D66` — the difference is recorded HERE, which is the other half of
        // taking it off the list.
        check(
          `${locale}: *** the difference is recorded on the record *** [D66], [S120]`,
          detail.body.includes('data-differs="yes"') ||
            detail.body.includes('data-differs="no"'),
          "neither differs nor matches was stated",
        );
      }

      if (freeId) {
        const detail = await get(jar, `/${locale}/dispatches/${freeId}`);
        check(
          `${locale}: *** a free entry has NO comparison card — absent, not an empty shell *** [S75], [D70]`,
          detail.status === 200 &&
            !detail.body.includes('data-slot="against-quotation"'),
          "a dispatch with no quotation rendered a comparison against one",
        );
        check(
          `${locale}: …and it states neither differs nor matches [S120]`,
          !detail.body.includes('data-differs="'),
          "a free entry was marked as differing from a quotation it does not have",
        );
      }

      /* ── S73 / D52's instinct: payment says not-yet-asked, never a dash ─ */

      const pending = rows.find(([, status]) =>
        status === "draft" || status === "submitted",
      );
      if (pending) {
        const id = list.body.match(
          new RegExp(
            `data-slot="dispatch-row" data-id="([0-9a-f-]{36})"[^>]*data-status="${pending[1]}"`,
          ),
        );
        if (id) {
          const detail = await get(jar, `/${locale}/dispatches/${id[1]}`);
          check(
            `${locale}: *** an unapproved dispatch says payment is not yet asked, not "—" *** [S73], [D52]`,
            detail.body.includes('data-payment="none"'),
            "the payment fact rendered a dash",
          );
        }
      } else {
        console.log(
          `  --    ${locale}: no unapproved dispatch on page 1 — the payment sentence not driven`,
        );
      }

      /* ── D57: RTL mirrors by CSS, never by reordering the DOM ─────────── */

      if (locale === "ar") {
        const english = await get(jar, "/en/dispatches");
        const cols = (body: string) =>
          [...body.matchAll(/data-column="([a-zA-Z]+)"/g)].map((m) => m[1]).join(",");
        const piles = (body: string) =>
          [...body.matchAll(/data-slot="dispatch-group" data-group="(\w+)"/g)]
            .map((m) => m[1])
            .join(",");
        check(
          "ar: *** the DOM order is identical to English — the mirror is CSS *** [D57]",
          cols(list.body) === cols(english.body) &&
            piles(list.body) === piles(english.body),
          `ar ${piles(list.body)} vs en ${piles(english.body)}`,
        );
      }
    }
  }

  /* ── 25 ──────────────────────────────────────────────────────────────── */

  console.log(
    "\n25. The stream — one query, three arrangements, and a field note that is finally read [D45], [D30], [D3]",
  );
  {
    const jar = jars["manager@example.test"];

    // `D70`'s *states its total*, made assertable: `ListCard` carries it, so a
    // filtered stream can be compared against an unfiltered one without
    // counting rows that a page may have cut off. `attrOf` reads the attribute
    // off the tag carrying the slot — never `after()`, which takes the slot
    // NAME and builds `data-slot="…"` itself, so handing it the whole
    // attribute searches for a nested one, finds nothing and answers -1 for
    // every page alike. That failure is silent in the direction that matters:
    // -1 <= -1 is true, so a comparison between two of them PASSES.
    const totalOf = (body: string) =>
      Number(attrOf(body, "list-card", "data-total") ?? "-1");
    const count = (body: string, marker: string) =>
      body.split(marker).length - 1;

    for (const locale of ["en", "ar"]) {
      const base = await get(jar, `/${locale}/activity`);
      check(
        `${locale}: /activity is the stream with no parameter [D30]`,
        base.status === 200 &&
          base.body.includes('data-slot="stream-day"') &&
          base.body.includes('data-slot="stream-filters"'),
        `status ${base.status}`,
      );
      check(
        `${locale}: the old /reports list is gone [D45]`,
        (await get(jar, `/${locale}/reports`)).status === 404,
      );
      check(
        `${locale}: but the log form and a report's own page are not`,
        (await get(jar, `/${locale}/reports/new`)).status === 200,
      );

      const all = totalOf(base.body);
      check(`${locale}: the stream has rows to reason about`, all > 0, `${all}`);

      /*
       * **The default stream holds every kind, not most of them** `S45-7`.
       * `companyAddedEvents` used to return nothing unless scoped or ranged, so
       * `/activity` silently dropped a whole source — and nothing here could
       * see it, because `D45`'s three kinds fold five of the six into
       * `observed` and the partition below balances either way.
       *
       * **Asserted as a SET against the ranged read, not as a presence test.**
       * `company_added` is there is a boolean that goes green again the day a
       * guard comes back for a different kind; *unranged holds what ranged
       * holds* keeps working whichever source goes missing. `data-event-kind`
       * exists on the row for this.
       */
      /**
       * The kinds present over the first few pages of a query.
       *
       * **Sampled over pages, not read off page one.** The first cut read page
       * one alone and printed `[comment,dispatched]` — a green line stating
       * that the stream holds two kinds, which is false and which a reader
       * would have re-derived wrongly. `CLAUDE.md` says to read your own
       * passing output; this is what that caught.
       */
      const SAMPLE_PAGES = 6;
      const kindsOver = async (query: string) => {
        const found = new Set<string>();
        for (let page = 1; page <= SAMPLE_PAGES; page += 1) {
          const { body } = await get(
            jar,
            `/${locale}/activity${query}${query ? "&" : "?"}page=${page}`,
          );
          const seen = [...body.matchAll(/data-event-kind="([^"]+)"/g)];
          if (seen.length === 0) break;
          for (const m of seen) found.add(m[1]);
        }
        return [...found].sort();
      };
      const RANGE = "?from=2000-01-01&to=2099-12-31";
      const ranged = await get(jar, `/${locale}/activity${RANGE}`);
      const rangedTotal = totalOf(ranged.body);
      const unrangedKinds = await kindsOver("");
      const rangedKinds = await kindsOver(RANGE);
      check(
        `${locale}: *** the default stream holds every kind an all-time range holds — saw ${all} over [${unrangedKinds.join(",")}] against ranged ${rangedTotal} over [${rangedKinds.join(",")}], ${SAMPLE_PAGES} pages each *** [D45]`,
        unrangedKinds.length > 0 &&
          unrangedKinds.join(",") === rangedKinds.join(",") &&
          all === rangedTotal,
        "a source arriving only when ranged is invisible to the three-kind partition",
      );
      check(
        `${locale}: …and company_added is one of them — saw [${unrangedKinds.join(",")}] [D45], [S41]`,
        unrangedKinds.includes("company_added"),
        `${unrangedKinds.length} kind(s) over ${SAMPLE_PAGES} pages — re-run \`npm run seed:demo\` if the fixture is thin`,
      );

      /*
       * **The one assertion that separates one query from three that agree.**
       * `D45` gives the stream three kinds and `D30` three arrangements of ONE
       * query; if typed + observed + said does not equal the unfiltered total,
       * either a kind is being dropped or an event is being counted twice, and
       * no amount of the screen looking right would show it.
       */
      const kinds = ["typed", "observed", "said"] as const;
      const perKind: number[] = [];
      for (const kind of kinds) {
        const body = (await get(jar, `/${locale}/activity?kind=${kind}`)).body;
        const total = totalOf(body);
        perKind.push(total);
        check(
          `  ${locale}: ?kind=${kind} renders only that kind`,
          total === 0 ||
            count(body, 'data-stream-kind="') ===
              count(body, `data-stream-kind="${kind}"`),
          `${count(body, 'data-stream-kind="')} rows, ${count(body, `data-stream-kind="${kind}"`)} of them ${kind}`,
        );
      }
      check(
        `*** ${locale}: the three kinds PARTITION the stream — one query, not three [D45] ***`,
        perKind.reduce((sum, n) => sum + n, 0) === all,
        `${perKind.join(" + ")} against ${all}`,
      );

      /*
       * `D3` — *a field note reaches no timeline*. `S33` allows an entry
       * anchored to nobody and `timeline.ts` scoped reports by company or
       * project, so the work was logged and read by nobody. The stream is
       * unscoped, so it is the one place a field note lands.
       */
      const typed = (await get(jar, `/${locale}/activity?kind=typed`)).body;
      check(
        `  ${locale}: an interaction is on the first page of typed entries`,
        typed.includes('data-entry-type="interaction"'),
      );
      check(
        `  ${locale}: a typed row links to the report it came from`,
        new RegExp(`href="/${locale}/reports/[0-9a-f-]{36}"`).test(typed),
      );

      /*
       * **Paged, with a stated cap, and it is not caution.** Every verify
       * script writes reports dated TODAY and the stream is newest-first, so
       * page one of typed entries is residue on any database this suite has
       * run against more than once — the wall `§17` already hit from the other
       * end and `§5` counts. `seed:demo`'s field notes are dated in the past,
       * so a one-page check would go green on a fresh seed and red for ever
       * after, which is a check nobody would trust the second time. Six pages
       * is 150 typed entries against the seed's 129 reports; if it is not
       * found in those, the count is REPORTED rather than the check quietly
       * passing on the last page it managed to read.
       */
      const FIELD_NOTE_PAGES = 6;
      let foundOn = 0;
      for (let page = 1; page <= FIELD_NOTE_PAGES && foundOn === 0; page++) {
        const body = (
          await get(jar, `/${locale}/activity?kind=typed&page=${page}`)
        ).body;
        if (body.includes('data-entry-type="field_note"')) foundOn = page;
        if (!body.includes('data-entry-type="')) break;
      }
      check(
        `*** ${locale}: a field note is IN the stream — D3 closes here [D3], [S33] ***`,
        foundOn > 0,
        `not found in the first ${FIELD_NOTE_PAGES} pages of typed entries — re-run \`npm run seed:demo\``,
      );

      /*
       * An outcome and a signal belong to a typed event, so each narrows
       * WITHIN typed and never past it. The screen says so in its own line;
       * this asserts the line is telling the truth.
       */
      const outcomeBody = (
        await get(jar, `/${locale}/activity?outcome=catalogue_sent`)
      ).body;
      check(
        `  ${locale}: ?outcome narrows within typed and says so`,
        totalOf(outcomeBody) >= 0 &&
          totalOf(outcomeBody) <= perKind[0] &&
          outcomeBody.includes('data-slot="stream-typed-only"') &&
          count(outcomeBody, 'data-stream-kind="observed"') === 0,
        `${totalOf(outcomeBody)} against typed ${perKind[0]}`,
      );

      /*
       * `D59` — a chip that drops the rest of the narrowing sends the reader
       * to a list that silently holds other rows. Every control here is a link
       * or a GET form and all of them must carry what is already set.
       */
      const narrowed = await get(
        jar,
        `/${locale}/activity?kind=typed&outcome=catalogue_sent`,
      );
      check(
        `  ${locale}: the view chips carry the current filters [D59]`,
        narrowed.body.includes("kind=typed") &&
          narrowed.body.includes("outcome=catalogue_sent") &&
          narrowed.body.includes("view=by-rep"),
      );

      /*
       * `D30` — *by-rep* is an ARRANGEMENT of the same query. It renders the
       * counts table and no stream rows, and its per-person link is the
       * stream's own `who` filter rather than a second screen underneath it.
       */
      const byRep = await get(jar, `/${locale}/activity?view=by-rep`);
      check(
        `${locale}: ?view=by-rep is the counts table and not the stream [D30]`,
        byRep.status === 200 &&
          !byRep.body.includes('data-slot="stream-day"') &&
          byRep.body.includes('data-slot="list-card"'),
        `status ${byRep.status}`,
      );
      check(
        `*** ${locale}: a rep's row leads back INTO the stream, not to a second screen [D45] ***`,
        /href="[^"]*activity\?[^"]*who=[0-9a-f-]{36}/.test(byRep.body),
      );
      check(
        `  ${locale}: a person who did nothing still has a row [S42]`,
        totalOf(byRep.body) > 1,
        `${totalOf(byRep.body)} rows`,
      );

      /*
       * `D52` and `D60` — an empty list says what would make it non-empty and
       * offers the action, and it sits OUTSIDE the card, where a pagination
       * footer would make it read as a broken page rather than an empty one.
       * A search nothing can match is the only way to reach that state on a
       * seeded database, and a state nothing drives is a state nobody has
       * seen.
       */
      const empty = await get(
        jar,
        `/${locale}/activity?q=zzzz-nothing-matches-this`,
      );
      check(
        `  ${locale}: a search that matches nothing renders the empty state [D52]`,
        empty.status === 200 &&
          !empty.body.includes('data-slot="list-card"') &&
          !empty.body.includes('data-slot="stream-day"'),
        `status ${empty.status}`,
      );
      check(
        `  ${locale}: …outside the card, and it offers the way out [D52], [D60]`,
        empty.body.includes(`href="/${locale}/reports/new"`) &&
          empty.body.includes('data-slot="stream-filters"'),
      );

      /*
       * `?view=calendar` is `D31`'s *only if someone asks twice* and is not
       * built. It must fall back to the stream rather than 404 or render an
       * empty frame — an unknown `?view=` is a typo, not a missing screen.
       */
      const calendar = await get(jar, `/${locale}/activity?view=calendar`);
      check(
        `  ${locale}: an unbuilt ?view falls back to the stream [D31]`,
        calendar.status === 200 &&
          calendar.body.includes('data-slot="stream-day"'),
        `status ${calendar.status}`,
      );
    }

    /*
     * **Scoped, never gated** — and the shape is not the obvious one. The
     * coordinator is not `sees_all_reps`, so `visibleRepReportsFilter` gives
     * her only her own reports and those on the four companies `S9` gave her;
     * but `can_approve_quotation` and `can_dispatch` widen the quotation and
     * dispatch sources to every row. So her stream is nearly all OBSERVED and
     * almost no TYPED, which is `S76` behaving correctly and reads as a bug to
     * anyone who has not been told.
     */
    const rep = jars["rep-a@example.test"];
    const coordinator = jars["coordinator@example.test"];
    const totalFor = async (target: Jar, query: string) =>
      totalOf((await get(target, `/en/activity${query}`)).body);

    const managerAll = await totalFor(jar, "");
    const repAll = await totalFor(rep, "");
    check(
      "*** a rep's stream is a subset of the manager's — scoped, not gated [D53] ***",
      repAll > 0 && repAll < managerAll,
      `rep ${repAll} of manager ${managerAll}`,
    );
    check(
      "the rep's own filter narrows their stream further [D30]",
      (await totalFor(rep, "?kind=said")) <= repAll,
    );
    const coordinatorTyped = await totalFor(coordinator, "?kind=typed");
    const coordinatorObserved = await totalFor(coordinator, "?kind=observed");
    check(
      "*** the coordinator reads the records and not what the reps wrote — observed >> typed [S76] ***",
      coordinatorObserved > coordinatorTyped,
      `observed ${coordinatorObserved}, typed ${coordinatorTyped}`,
    );
  }

  /* ── 26 ──────────────────────────────────────────────────────────────── */

  console.log(
    "\n26. Auto-refresh — the line is absent with scripts off, and the count route runs the screen's own query [D72], [D20], [D73]",
  );
  {
    /**
     * **This walk executes no script, so every check below is a scripts-off
     * check** — which makes it the whole of `D20`'s half of `D72`. What it can
     * see is the markup the server sent: the transport the notice needs, and
     * the fact that no line was drawn.
     *
     * **The count route is then driven directly**, which is the only way a
     * black-box script can reach it at all. Two `since` values bracket it:
     *
     * - `since` **in the future** must answer `0`. That proves the comparison
     *   runs in the direction the rule needs.
     * - `since` at the **epoch** must answer the screen's own total, because
     *   every row has moved after 1970. That is the assertion this slice needs:
     *   it proves the route's `where` is the list's `where` — the drift the
     *   shared builders exist to prevent — and it fires on the exact failure
     *   `CLAUDE.md` records twice, a stamp resolving against the wrong table
     *   and returning zero with no error.
     *
     * Then one real arrival, end to end, because neither bracket can tell a
     * correct stamp from a wrong column that happens to be non-null.
     */
    const manager = jars["manager@example.test"];
    const rep = jars["rep-a@example.test"];

    const EPOCH = "1970-01-01T00:00:00.000Z";
    const FUTURE = "2999-01-01T00:00:00.000Z";

    type Notice = {
      scope: string;
      since: string;
      query: string;
      count: string;
    };

    /** Every notice on a page, in document order. */
    const noticesIn = (body: string): Notice[] =>
      [
        ...body.matchAll(
          /<[a-z]+[^>]*data-slot="refresh-notice"[^>]*>/g,
        ),
      ].map((tag) => ({
        scope: attrIn(tag[0], "data-scope") ?? "",
        since: attrIn(tag[0], "data-since") ?? "",
        // React escapes `&` in an attribute, and a two-filter query has one.
        query: unescapeHtml(attrIn(tag[0], "data-query") ?? ""),
        count: attrIn(tag[0], "data-count") ?? "",
      }));

    const ask = async (
      jar: Jar | null,
      notice: Notice,
      since: string,
    ): Promise<{ status: number; count: number }> => {
      const params = new URLSearchParams(notice.query);
      params.set("scope", notice.scope);
      params.set("since", since);
      const response = await fetch(`${BASE}/api/updates?${params}`, {
        headers: jar ? { cookie: header(jar) } : {},
        redirect: "manual",
      });
      if (response.status !== 200) {
        return { status: response.status, count: -1 };
      }
      const body = (await response.json()) as { count?: unknown };
      return {
        status: response.status,
        count: typeof body.count === "number" ? body.count : -1,
      };
    };

    /* — The five screens `D72` names and this slice builds — */

    const screens: {
      path: string;
      scope: string;
      /** Where the screen states its own whole-scope total. */
      totalSlot: string;
    }[] = [
      { path: "/quotations", scope: "quotations", totalSlot: "list-card" },
      { path: "/dispatches", scope: "dispatches", totalSlot: "list-card" },
      { path: "/projects", scope: "projects", totalSlot: "project-board" },
      {
        path: "/projects?view=table",
        scope: "projects",
        totalSlot: "list-card",
      },
      { path: "/activity", scope: "stream", totalSlot: "list-card" },
    ];

    for (const locale of ["en", "ar"] as const) {
      for (const screen of screens) {
        const page = await get(manager, `/${locale}${screen.path}`);
        const [notice] = noticesIn(page.body);

        check(
          `${locale}: ${screen.path} carries the notice's transport [D72]`,
          Boolean(notice) && notice.scope === screen.scope,
          `scope ${notice?.scope ?? "ABSENT"}`,
        );
        if (!notice) continue;

        // **The whole of `D20` for this feature.** No script ran, so no poll
        // answered, so there is no line — and the page above it is the page it
        // always was.
        check(
          `${locale}: ${screen.path} draws NO line with scripts off [D20], [D72]`,
          notice.count === "0" &&
            !page.body.includes('data-slot="refresh-line"'),
          `data-count="${notice.count}"`,
        );
        check(
          `${locale}: ${screen.path}'s render moment is an instant, and its query carries no page [D72]`,
          !Number.isNaN(Date.parse(notice.since)) &&
            !new URLSearchParams(notice.query).has("page"),
          `since="${notice.since}" query="${notice.query}"`,
        );

        const total = Number(
          attrOf(page.body, screen.totalSlot, "data-total") ?? "-1",
        );
        const fresh = await ask(manager, notice, notice.since);
        const everything = await ask(manager, notice, EPOCH);
        const ahead = await ask(manager, notice, FUTURE);

        check(
          `${locale}: ${screen.path} — nothing has arrived since it rendered [D72]`,
          fresh.count === 0,
          `answered ${fresh.count}`,
        );
        check(
          `${locale}: ${screen.path} — a future moment answers nothing [D72]`,
          ahead.count === 0,
          `answered ${ahead.count}`,
        );
        // The one that would have caught a stamp resolving against the wrong
        // table: that returns zero and raises nothing `CLAUDE.md`.
        check(
          `*** ${locale}: ${screen.path} — since the epoch, the count IS the screen's own total *** [D72]`,
          total > 0 && everything.count === total,
          `route ${everything.count}, screen ${total}`,
        );
      }
    }

    /* — The narrowing travels, and the scope is the reader's — */

    const dashboard = await get(manager, "/en");
    check(
      "a rep-and-manager dashboard has no Requests block, so it polls nothing [D64], [D72]",
      noticesIn(dashboard.body).length === 0,
      `${noticesIn(dashboard.body).length} notice(s)`,
    );

    const coordinator = jars["coordinator@example.test"];
    const coordinatorHome = await get(coordinator, "/en");
    const columns = noticesIn(coordinatorHome.body);
    check(
      "*** the coordinator's Requests block polls its two columns separately, each with its own narrowing *** [D65], [D72]",
      columns.length === 2 &&
        columns[0].query === "awaitingIssue=1" &&
        columns[1].query === "status=submitted",
      columns.map((one) => `${one.scope}?${one.query}`).join(" · ") || "none",
    );
    check(
      "…and both are silent with scripts off [D20]",
      columns.every((one) => one.count === "0") &&
        !coordinatorHome.body.includes('data-slot="refresh-line"'),
    );

    if (columns.length === 2) {
      // Each column states its own total; the epoch count must be that total
      // and not the unnarrowed list's, or the narrowing did not travel.
      const issuing = Number(
        attrOf(
          between(
            coordinatorHome.body,
            "today-requests-quotations",
            "today-requests-dispatches",
          ),
          "refresh-notice",
          "data-count",
        ) ?? "-1",
      );
      check(
        "the issuing column's notice is inside the issuing column [D72]",
        issuing === 0,
        `read ${issuing}`,
      );

      const wide = await ask(coordinator, { ...columns[0], query: "" }, EPOCH);
      const narrow = await ask(coordinator, columns[0], EPOCH);
      check(
        "*** `awaitingIssue` narrows the count route exactly as it narrows the block *** [D65], [D72]",
        narrow.count > 0 && narrow.count < wide.count,
        `narrowed ${narrow.count} of ${wide.count}`,
      );
    }

    // Scoped, not global — the same question, two identities, two answers.
    const asDispatches = { scope: "dispatches", since: "", query: "", count: "" };
    const repSees = await ask(rep, asDispatches, EPOCH);
    const coordinatorSees = await ask(coordinator, asDispatches, EPOCH);
    check(
      "*** the count route is scoped by the reader, never global *** [S109], [D72]",
      repSees.count > 0 && repSees.count < coordinatorSees.count,
      `rep ${repSees.count} of coordinator ${coordinatorSees.count}`,
    );

    /* — What it refuses — */

    check(
      "an anonymous poll is refused, and not with a login page to parse as JSON [D72]",
      (await ask(null, asDispatches, EPOCH)).status === 401,
    );
    check(
      "an unknown scope is refused",
      (await ask(manager, { ...asDispatches, scope: "companies" }, EPOCH))
        .status === 400,
    );
    check(
      "a `since` that is not an instant is refused",
      (await ask(manager, asDispatches, "yesterday")).status === 400,
    );
    check(
      "…and so is no `since` at all",
      (
        await fetch(`${BASE}/api/updates?scope=dispatches`, {
          headers: { cookie: header(manager) },
        })
      ).status === 400,
    );

    /* — One real arrival, end to end — */

    {
      /**
       * **Neither bracket above can tell a correct stamp from a wrong column
       * that happens to be non-null**, so one row is made to arrive for real:
       * `/activity` is read, a company is registered over HTTP, and the same
       * notice is polled again with the `since` the page carried.
       *
       * A registration is `companyAddedEvents`, whose `at` is
       * `companies.created_at` — a `typed`-adjacent arrival on the stream the
       * manager is watching. The company carries a run stamp, for §9's reason:
       * an unremovable fixture row must land somewhere nobody reads as data.
       */
      const stamp = `${Date.now()}`.slice(-7);
      // **A ranged stream, and the range is not decoration.**
      // `companyAddedEvents` is the one of `gather`'s six sources that returns
      // nothing at all without a range — *"a project timeline never shows this
      // event; the range form is the daily view"* — so an unranged stream would
      // never see the arrival below however correct the count route was. It
      // also puts a two-parameter narrowing through `data-query`, which is the
      // shape a hand-built query string is most likely to get wrong.
      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Riyadh",
      });
      const before = await get(
        manager,
        `/en/activity?from=${today}&to=${today}`,
      );
      const [notice] = noticesIn(before.body);
      check(
        "the range travels into the notice's own query [D72]",
        notice?.query.includes(`from=${today}`) === true &&
          notice.query.includes(`to=${today}`),
        notice?.query ?? "no notice",
      );
      const quiet = notice ? await ask(manager, notice, notice.since) : null;
      check(
        "the stream is quiet at the moment it renders [D72]",
        quiet?.count === 0,
        `answered ${quiet?.count ?? "no notice"}`,
      );

      const blank = await get(rep, "/en/companies/new");
      const countrySelect =
        blank.body.match(
          /<select[^>]*name="countryId"[\s\S]*?<\/select>/,
        )?.[0] ?? "";
      // Abroad, for §9's and §13's reason: the city is a `Combobox` in a
      // portal, so this script has no city id, and `S15` refuses a Saudi
      // company without one. `"SA"` is `SAUDI_CODE`, repeated rather than
      // imported — this file imports nothing from `src/`.
      const foreignId = [
        ...countrySelect.matchAll(
          /<option value="([0-9a-f-]{36})"[^>]*data-code="([A-Z]{2})"/g,
        ),
      ].find((option) => option[2] !== "SA")?.[1];

      const registration = envelopeOf(blank.body);
      registration.set("name", `refresh-${stamp}`);
      registration.set("phone", `+9665${stamp}1`);
      registration.set("countryId", foreignId ?? "");
      for (const empty of ["cityId", "categoryId", "leadSourceId", "notes"]) {
        registration.set(empty, "");
      }
      const registered = await fetch(`${BASE}/en/companies/new`, {
        method: "POST",
        headers: { cookie: header(rep), origin: BASE },
        body: registration,
        redirect: "manual",
      });
      store(rep, registered);
      check(
        "this section registers the company it watches arrive [S13]",
        registered.status === 303,
        `got ${registered.status}`,
      );

      const after = notice ? await ask(manager, notice, notice.since) : null;
      check(
        "*** a row that arrived AFTER the render is counted, and the page was never reloaded *** [D72]",
        after?.count === 1,
        `answered ${after?.count ?? "no notice"}`,
      );
      // `D72`: *what it may update is the number in that line, and whether the
      // line is there at all. Nothing beneath it.* The screen is still the one
      // the server sent, which is what makes that true by construction.
      check(
        "…and the rendered page still holds exactly what it held [D72]",
        !before.body.includes('data-slot="refresh-line"'),
      );
    }

    /* — `D73`, on the five runs this slice corrected — */

    {
      /**
       * A run of *figure · translated word* must resolve off its own word.
       * Asserted as markup rather than as rendered text: the words differ by
       * locale and `CLAUDE.md` forbids asserting on a translated string, but
       * the `dir` attribute is the same marker in both.
       */
      const holds = (region: string) =>
        region.includes('dir="auto"') && !region.includes('dir="ltr"');

      for (const locale of ["en", "ar"] as const) {
        const quotations = await get(manager, `/${locale}/quotations`);
        check(
          `${locale}: /quotations' elapsed figure resolves off its own word [D73]`,
          holds(between(quotations.body, "turn", "quotation-row").slice(0, 400)),
        );

        const dispatches = await get(manager, `/${locale}/dispatches`);
        check(
          `${locale}: /dispatches' elapsed figure does too [D73]`,
          dispatches.body.includes(
            '<span class="num text-faint text-xs font-semibold" dir="auto">',
          ),
        );

        // Scoped to the age cell by its own handle: the cell beside it holds a
        // bare date and correctly keeps `dir="ltr"`, so asserting over the
        // whole table would be asserting the wrong thing about both.
        const followUps = await get(manager, `/${locale}/follow-ups`);
        const ageCells = [
          ...followUps.body.matchAll(/<td[^>]*data-column="age"[^>]*>/g),
        ].map((cell) => cell[0]);
        check(
          `${locale}: /follow-ups' age cell does too [D73]`,
          ageCells.length > 0 && ageCells.every(holds),
          `${ageCells.length} age cell(s)`,
        );

        const home = await get(rep, `/${locale}`);
        const target = between(home.body, "today-target-sqm", "today-pace");
        check(
          `${locale}: the target's *of N m²* resolves off its own word [D73]`,
          target === "" || holds(target),
          target === "" ? "no target panel for this identity" : "",
        );
      }
    }
  }

  /* ── 27 ──────────────────────────────────────────────────────────────── */

  console.log(
    "\n27. The phone row — the kept set, per list [D56], [D26], [D55]",
  );
  {
    // **What this can and cannot see.** The harness fetches HTML and executes
    // nothing, so it cannot see a breakpoint, a grid track or a 375px
    // viewport — those are the founder's eye check, exactly as the bottom
    // sheet's own note in section 2 records for `38a`.
    //
    // What it CAN see is the whole of `D56`'s contract, because `38b` is one
    // DOM at every width: the arrangement is CSS and the *kept set* is markup.
    // A cell says which slot it fills, so this reads the same annotations the
    // stylesheet reads, and a list that quietly grew a second kept column
    // fails here rather than colliding on somebody's phone.
    const tbodyOf = (body: string) =>
      body.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)?.[1] ?? "";
    const slotsOf = (row: string) =>
      [...row.matchAll(/data-phone="([a-z]+)"/g)].map((slot) => slot[1]);
    const count = (slots: string[], slot: string) =>
      slots.filter((one) => one === slot).length;

    // **The section proves itself before it is believed** — `§23`'s
    // precedent. A check that has only ever been green has not been shown to
    // fail, and the whole value of this one is catching a list that quietly
    // grew a second kept column, which is the shape that would collide on a
    // phone and read as a rendering bug rather than as a rule breach.
    const twoKept = slotsOf(
      '<td data-phone="lead"></td><td data-phone="name"></td>' +
        '<td data-phone="keep"></td><td data-phone="action"></td>',
    );
    check(
      "the slot scan catches a row with TWO kept columns [D56]",
      count(twoKept, "keep") + count(twoKept, "action") === 2,
      `read ${twoKept.join(" ")}`,
    );
    const noName = slotsOf(
      '<td data-phone="lead"></td><td data-phone="keep"></td>',
    );
    check(
      "…and a row that lost its name [D56]",
      count(noName, "name") === 0 &&
        count(noName, "keep") + count(noName, "action") === 1,
      `read ${noName.join(" ")}`,
    );
    // The table's own opt-in attribute sits one hyphen away from a slot name.
    // If the scan read it as one, every table would report a phantom slot and
    // the counts above would be measuring the wrong thing.
    check(
      "…and it does not read `data-phone-rows` as a slot",
      slotsOf('<table data-slot="table" data-phone-rows="">').length === 0,
    );

    // `sees_all_reps` — the one identity with rows on every list, the same
    // reason `MARKER_IDENTITY` picks it.
    const manager = jars["manager@example.test"];

    // `lead: false` is `/contacts`, where the lead cell IS the name `D26` — a
    // row fills two slots, not three, and `D56` says so outright rather than
    // leaving it to be re-argued here.
    const LISTS = [
      { path: "/companies", lead: true, groups: true },
      { path: "/projects?view=table", lead: true, groups: false },
      { path: "/quotations", lead: true, groups: true },
      { path: "/dispatches", lead: true, groups: true },
      { path: "/contacts", lead: false, groups: false },
      { path: "/follow-ups", lead: true, groups: false },
    ] as const;

    for (const locale of ["en", "ar"] as const) {
      for (const list of LISTS) {
        const page = await get(manager, `/${locale}${list.path}`);
        if (page.status !== 200) {
          console.log(`  skip  ${locale}: ${list.path} returned ${page.status}`);
          continue;
        }

        check(
          `${locale}: ${list.path} opts into the phone row [D56]`,
          page.body.includes("data-phone-rows"),
          "the table is not annotated at all",
        );

        const rows = tbodyOf(page.body)
          .split(/<tr\b/)
          .slice(1)
          .map(slotsOf);
        // `every()` over an empty array is `true`, so an empty list — or a
        // 500 — would take every assertion below green without reading a row.
        const bodyRows = rows.filter((slots) => !slots.includes("group"));
        const groupRows = rows.filter((slots) => slots.includes("group"));

        check(
          `${locale}: ${list.path} returned rows to measure`,
          bodyRows.length > 0,
          `${rows.length} row(s) in the tbody`,
        );

        check(
          `${locale}: ${list.path} — every row keeps its name [D56]`,
          bodyRows.length > 0 &&
            bodyRows.every((slots) => count(slots, "name") === 1),
          `${bodyRows.filter((slots) => count(slots, "name") !== 1).length} row(s) wrong`,
        );

        check(
          `${locale}: ${list.path} — every row keeps ${
            list.lead ? "its lead cell" : "NO lead cell, the name IS it"
          } [D26]`,
          bodyRows.length > 0 &&
            bodyRows.every(
              (slots) => count(slots, "lead") === (list.lead ? 1 : 0),
            ),
          `${
            bodyRows.filter(
              (slots) => count(slots, "lead") !== (list.lead ? 1 : 0),
            ).length
          } row(s) wrong`,
        );

        // **The one column, counted.** `keep` and `action` are one grid slot,
        // so two of them would overlap on a phone and neither would be
        // readable. This is the assertion that catches it before a person does.
        check(
          `${locale}: ${list.path} — *** exactly ONE column beside them *** [D56]`,
          bodyRows.length > 0 &&
            bodyRows.every(
              (slots) => count(slots, "keep") + count(slots, "action") === 1,
            ),
          `${
            bodyRows.filter(
              (slots) => count(slots, "keep") + count(slots, "action") !== 1,
            ).length
          } row(s) wrong`,
        );

        if (list.groups) {
          check(
            `${locale}: ${list.path} — every group header survives the collapse [D24]`,
            groupRows.length > 0 &&
              groupRows.every((slots) => slots.length === 1),
            `${groupRows.length} group header(s)`,
          );
        }
      }

      // **The three that decline it, asserted as declining rather than as
      // missed.** `D55` makes them laptop-first, and an unannotated table and
      // a deliberately unannotated one are identical in the markup — so the
      // claim this makes is the negative one, and `WORKFLOW §5` carries why.
      for (const path of ["/users", "/targets", "/activity?view=by-rep"]) {
        const page = await get(manager, `/${locale}${path}`);
        if (page.status !== 200) {
          console.log(`  skip  ${locale}: ${path} returned ${page.status}`);
          continue;
        }
        check(
          `${locale}: ${path} keeps its columns, laptop-first [D55]`,
          page.body.includes("data-slot=\"table\"") &&
            !page.body.includes("data-phone-rows"),
          "a laptop-first list opted into the phone row",
        );
      }

      // A detail line table is genuinely wide and carries its own scroller;
      // it is not a list of records and `D56` does not reach it.
      const dispatches = await get(manager, `/${locale}/dispatches`);
      const dispatchId = firstId(dispatches.body, "dispatches");
      if (dispatchId) {
        const detail = await get(manager, `/${locale}/dispatches/${dispatchId}`);
        check(
          `${locale}: a dispatch's line table is untouched by D56`,
          detail.status === 200 && !detail.body.includes("data-phone-rows"),
          `status ${detail.status}`,
        );
      } else {
        console.log(`  skip  ${locale}: no dispatch to open`);
      }
    }
  }

  /* ── 28 ──────────────────────────────────────────────────────────────── */

  console.log(
    "\n28. The phone three — the log form's order, the strip's axis, the shell [D46], [D56], [D74], [D20]",
  );
  {
    // **What this can and cannot see**, the same admission `§27` makes: the
    // harness fetches HTML and executes nothing, so a breakpoint, a grid track
    // and a 375px viewport are the founder's eye check. What it CAN see is
    // every part of `38c` that is markup rather than arrangement — and one of
    // those, the `D20` hole below, was shipping on every device.
    const rep = jars["rep-a@example.test"];

    // **Written out rather than imported.** This script is black-box and may
    // not reach into `src/` — the same reason `Fact` carries a `data-fact`
    // handle. So the two lists are restated here, and a value added to
    // `enums.ts` without one added here fails the count rather than passing
    // silently over a shorter list. `S43` is the rule behind both.
    const SIGNALS = [
      "price_too_high",
      "competitor_cheaper",
      "colour_unavailable",
      "lead_time_too_long",
      "quality_concern",
      "payment_terms",
      "specification_unavailable",
      "project_delayed",
      "other",
    ] as const;
    const WITH_REFERENCE = [
      "competitor_cheaper",
      "colour_unavailable",
      "specification_unavailable",
      "other",
    ] as const;

    // ── the log form's order `S32` `D46` ────────────────────────────────
    //
    // *"Three taps and a text box."* The claim is an ORDER, so it is read as
    // one: `data-field` in DOM order, which `FormField` already emits for
    // `§23` and which no translated string is involved in.
    for (const locale of ["en", "ar"] as const) {
      const form = await get(rep, `/${locale}/reports/new`);
      const fields = [...form.body.matchAll(/data-field="([A-Za-z]+)"/g)].map(
        (one) => one[1],
      );

      check(
        `${locale}: the log form's three taps come first [S32], [D46]`,
        fields.slice(0, 3).join(",") === "companyId,channel,outcome",
        `read ${fields.slice(0, 3).join(",") || "nothing"}`,
      );
      check(
        `${locale}: …and the text box is next, above everything optional [S32]`,
        fields[3] === "narrative",
        `read ${fields[3] ?? "nothing"}`,
      );
      // The regression this guards is the shape the form shipped in: the note
      // sixth, under the optional context, so at 375 it started below the
      // fold. Asserting *narrative is present* would have been green then.
      check(
        `${locale}: …and both dates come after it, not before [D46], [S37]`,
        fields.indexOf("reportDate") > fields.indexOf("narrative") &&
          fields.indexOf("onHoldUntil") === fields.indexOf("reportDate") + 1,
        `read ${fields.join(",")}`,
      );

      // ── the signals, and the `D20` hole `38c` closed ──────────────────
      //
      // **This is the assertion that matters most in the section.** The four
      // reference inputs rendered on client state, so with scripts off a rep
      // could not record a competitor's name at all — and `§23` could not see
      // it, because a field gated on `useState` is not in the HTML for a scan
      // of the HTML to fail on. `WORKFLOW §5` carries the shape. What closes
      // it is that the fields are HERE, in a response that ran no script.
      check(
        `${locale}: the signals are a native <details> [D46], [D20]`,
        /<details[^>]*data-slot="report-signals"/.test(form.body),
      );
      const shut = !/<details[^>]*data-slot="report-signals"[^>]*\sopen/.test(
        form.body,
      );
      check(
        `${locale}: …shut on a form with no signals raised [D46]`,
        shut,
        "it rendered open with nothing in it",
      );
      const boxes = SIGNALS.filter((signal) =>
        new RegExp(`name="signals"[^>]*value="${signal}"`).test(form.body),
      );
      check(
        `${locale}: …with all nine checkboxes in the markup while it is shut [D20]`,
        boxes.length === SIGNALS.length,
        `${boxes.length} of ${SIGNALS.length}`,
      );
      const references = WITH_REFERENCE.filter((signal) =>
        form.body.includes(`name="signalReference.${signal}"`),
      );
      check(
        `${locale}: …and all four reference inputs too — the D20 hole [D20]`,
        references.length === WITH_REFERENCE.length,
        `${references.length} of ${WITH_REFERENCE.length} — ` +
          "a reference behind client state cannot be typed with scripts off",
      );
      // A field that is in the DOM but permanently invisible is the same
      // defect wearing a different hat, so the reveal is asserted as the
      // sibling selector it is rather than trusted.
      check(
        `${locale}: …revealed by the checkbox itself, not by script [D20]`,
        // Read off the whole tag, not forward from `name=`: `Input` spreads
        // its caller's props AFTER `className`, so the class attribute is
        // emitted first and a forward-only match sees nothing. That is the
        // check failing for a reason unrelated to the claim, which is the
        // shape this section exists to avoid.
        [...form.body.matchAll(/<input[^>]*>/g)]
          .filter((tag) => /name="signalReference\./.test(tag[0]))
          .every((tag) => tag[0].includes("peer-checked:block")),
      );

      // ── `D74` — the label IS the target, not a 44px box around it ──────
      const labels = [
        ...form.body.matchAll(/<label[^>]*for="signal-[a-z_]+"[^>]*>/g),
      ].map((one) => one[0]);
      check(
        `${locale}: every signal label carries the 44px floor itself [D74]`,
        labels.length === SIGNALS.length &&
          labels.every((label) => label.includes("max-md:min-h-11")),
        `${labels.filter((one) => one.includes("max-md:min-h-11")).length} of ` +
          `${labels.length} labels`,
      );
      // `D74` as amended: a component's own floor is the floor, and a caller
      // may not pin it. `h-11` is a HEIGHT and the rule says never — it is the
      // class the deleted `touch` constant put on both dates, at every width.
      // `min-h-11` is deliberately not matched.
      check(
        `${locale}: …and no caller pins a height over it [D74]`,
        !/[\s"](?:max-md:|md:)?h-11[\s"]/.test(form.body),
        "a control carries h-11 — a height where the rule says a floor",
      );
    }

    // ── the chain strip's axis `D56` ────────────────────────────────────
    //
    // The arrangement is CSS and invisible here; what is markup is that all
    // six steps still carry both lines. The defect was that they carried them
    // and truncated them to five characters, which no fetch can see — so the
    // thing worth asserting is that `truncate` is scoped to `md`, because an
    // unscoped one is the defect returning.
    for (const locale of ["en", "ar"] as const) {
      const quotations = await get(rep, `/${locale}/quotations`);
      const threadId = firstId(quotations.body, "quotations");
      if (!threadId) {
        console.log(`  skip  ${locale}: no quotation thread to open`);
        continue;
      }
      const thread = await get(rep, `/${locale}/quotations/${threadId}`);
      const strip = between(thread.body, "chain-strip", "facts");
      const steps = [...strip.matchAll(/<li[^>]*data-state="[a-z]+"/g)];
      check(
        `${locale}: the strip draws six steps [D27], [S132]`,
        steps.length === 6,
        `${steps.length} steps`,
      );
      check(
        `${locale}: …and truncates only at md, so a phone reads the labels [D56]`,
        strip.length > 0 && !/[\s"]truncate[\s"]/.test(strip),
        "an unscoped truncate is back — six labels at 40px is five characters",
      );
    }

    // ── the shell `D74`, and Sign out's new home ────────────────────────
    for (const locale of ["en", "ar"] as const) {
      const home = await get(rep, `/${locale}`);
      // Three controls, counted rather than trusted: the whole of the header
      // change is a NUMBER, and `D49`'s seven rail items went unchecked for
      // exactly this reason until `28b` counted them.
      const head = home.body.slice(
        home.body.indexOf("<header"),
        home.body.indexOf("</header>"),
      );
      const controls = [...head.matchAll(/<(?:a|button)\s/g)].length;
      check(
        `${locale}: the header carries three controls, not five [D74]`,
        controls === 3,
        `${controls} control(s) — the row needs ~324px EN / ~346px AR at five`,
      );
      check(
        `${locale}: …and Sign out is in the rail footer instead`,
        home.body.includes('data-slot="rail-sign-out"'),
      );
      // Neither is a `Button`, so `38a`'s floor on the base could not reach
      // either of them — which is why both were still 32px.
      check(
        `${locale}: the bell and the theme toggle carry D74's floor [D74]`,
        (head.match(/max-md:size-11/g) ?? []).length === 2,
        `${(head.match(/max-md:size-11/g) ?? []).length} of 2`,
      );
    }

    // ── the board's column measure `D56` ────────────────────────────────
    //
    // A utility class is a coarser handle than a `data-` marker, and is used
    // here only because the rule's content IS the number: `D56` now says 240
    // and says why, and a clause carrying a figure nothing reads is how the
    // *current column* clause survived with no referent. If the measure ever
    // moves to a custom property this goes red and gets updated, which is the
    // right outcome — it is not asserting a style, it is asserting the rule.
    for (const locale of ["en", "ar"] as const) {
      const board = await get(rep, `/${locale}/projects?view=board`);
      const columns = [
        ...board.body.matchAll(/<section[^>]*data-slot="board-column"[^>]*>/g),
      ].map((one) => one[0]);
      check(
        `${locale}: every board column takes the phone measure [D56]`,
        columns.length === 6 &&
          columns.every((column) => column.includes("min-w-60")),
        `${columns.filter((one) => one.includes("min-w-60")).length} of ` +
          `${columns.length} columns at 240px`,
      );
    }
  }

  /* ── 29 ──────────────────────────────────────────────────────────────── */

  console.log(
    "\n29. The bell carries news only — S91's machinery asserted ABSENT [S91], [S92]",
  );
  {
    /**
     * **A removal that nothing guards is a removal that comes back.** Session
     * 24 took the two tiers, the daily digest and the per-anchor resolution
     * conditions off `/notifications` `S91`; re-adding any of them would go
     * green everywhere, because every other check on this screen asks what is
     * present. So this asks what is not — the `NOT_COMMENTABLE` shape `27b`
     * used for the screens `S114` narrowed.
     *
     * **Every negative here is guarded on a non-empty read** `CLAUDE.md`, and
     * prints what it saw. `data-slot="notification-entry"` is the handle and
     * `data-total` on the card is the scope, so *no digest card* cannot pass
     * on a page that rendered nothing at all — which is the failure mode four
     * of this suite's page-one reads shipped with.
     */
    const rep = jars["rep-a@example.test"];
    for (const locale of ["en", "ar"] as const) {
      const { body, status } = await get(rep, `/${locale}/notifications`);
      check(`${locale}: /notifications answers 200`, status === 200, `got ${status}`);

      const entries = (body.match(/data-slot="notification-entry"/g) ?? []).length;
      const total = Number(attrOf(body, "notifications-news", "data-total") ?? "0");
      check(
        `${locale}: the bell has news to look at — saw ${entries} of ${total}`,
        entries > 0 && total >= entries,
        `${entries} entries, data-total ${total}`,
      );
      if (entries === 0) {
        console.log(`  --    ${locale}: nothing on the bell; the negatives are skipped`);
        continue;
      }

      // The two cards the tier split rendered. `07 E5` put act-now on the wide
      // side and the digest on the narrow one; `S91` leaves one kind of thing.
      for (const slot of ["notifications-act-now", "notifications-digest"]) {
        check(
          `${locale}: no ${slot} card — saw ${entries} entries to hold one [S91]`,
          !body.includes(`data-slot="${slot}"`),
        );
      }
      check(
        `${locale}: one news card holds all ${entries} entries [S92]`,
        (body.match(/data-slot="notifications-news"/g) ?? []).length === 1,
      );

      // **The digest's own link, which is the sharpest marker of the three.**
      // A digest row rendered *"{total} follow-ups on {date}"* with a link into
      // `/follow-ups` — the one thing on this screen that ever pointed at WORK.
      // `S92` is *news only, never work*, so a bell that links into the working
      // list has grown the thing this rule removed, whatever the card is called.
      //
      // **Scanned over the WHOLE page, not from the news card onward**, and
      // that is the second version. The first sliced the body at
      // `data-slot="notifications-news"`, which made it blind to anything
      // rendered ABOVE that card — and when this section was fed its defect,
      // two of the three negatives went red and this one stayed green on a
      // planted `/follow-ups` link sitting in a planted act-now card. The rail
      // carries no such link (`D49`: not a rail item), so the whole body is
      // both safe to scan and the only scope that cannot be walked around.
      check(
        `${locale}: nothing on the bell links into the working list — saw ${entries} entries [S92]`,
        !/href="\/(?:en|ar)\/follow-ups"/.test(body),
      );
    }
  }

  /* ── 30 ──────────────────────────────────────────────────────────────── */

  console.log(
    "\n30. *** The auth bridge: a real login, then revoked, over HTTP *** [S101]",
  );
  {
    /**
     * **The check `verify:phase11` §6 cannot be.**
     *
     * §6 hand-inserts a `sessions` row with a made-up token, calls
     * `deactivateUser` and asserts the row is gone — so it inserted the very
     * row it then watches disappear. It proves the `DELETE` fires, which was
     * never the risk. The risk `CLAUDE.md`'s auth-bridge clause names is the
     * `jwt.encode` override in `src/auth/index.ts` silently ceasing to mint a
     * database session: the cookie then carries a JWT that no deactivation can
     * revoke, login still works, and **§6 stays green** because it never
     * signed in. `WORKFLOW §5` `S44-1` — the ninth sighting of a check passing
     * for the wrong reason, and the first on the gate deciding whether a
     * sacked employee is still logged in.
     *
     * So this signs in for real and asks whether the very next request after a
     * deactivation is dead.
     *
     * **Setup is reported apart from the claim, deliberately.** Creating the
     * account and signing in are preconditions, not evidence. A `/users/new`
     * failure has nothing to do with the bridge, and a red that reads as *"the
     * bridge is broken"* when the fixture broke teaches the wrong thing — the
     * same class of defect as a missing control. `setup()` carries its own
     * prefix, and any setup failure abandons the section with **the bridge was
     * NOT measured** rather than asserting on a broken fixture.
     *
     * **Nothing here touches the nine real accounts.** The subject is created
     * for this run, is named `verifyroutes-<epoch>-bridge@example.test` so
     * `cleanup:verify`'s pattern sweeps it, and ends deactivated `S111`.
     */
    const manager = jars["manager@example.test"];
    const bridgeStamp = `verifyroutes-${Date.now()}`;
    const bridgeEmail = `${bridgeStamp}-bridge@example.test`;
    let victimId = "";

    /**
     * A precondition, reported as one. It still fails the run — a setup that
     * silently skipped the claim would be a section that reads nothing, which
     * is the other half of `CLAUDE.md`'s wrong-reason rule.
     */
    let setupBroke = "";
    const setup = (step: string, ok: boolean, detail = ""): boolean => {
      checks += 1;
      if (ok) {
        console.log(`  setup ${step}`);
        return true;
      }
      failures += 1;
      setupBroke = step;
      console.log(`  SETUP FAILED at ${step}${detail ? ` — ${detail}` : ""}`);
      return false;
    };
    const notMeasured = (why: string): void => {
      console.log(
        `  ----  THE BRIDGE WAS NOT MEASURED — ${why}. The assertions below did` +
          " not run; this is not evidence about the bridge either way.",
      );
    };

    /**
     * **A database that cannot be reached is a broken fixture, never a broken
     * bridge.** Without this, an unreachable database throws inside the
     * `sessions` read and the section either crashes mid-claim or — worse —
     * reports *"saw 0 rows, the bridge is DOWN"*, which is a live security
     * verdict drawn from a connection error. Both SELECTs go through here so
     * the failure can only ever be reported as setup.
     */
    const query = async <T>(
      what: string,
      run: () => Promise<T>,
    ): Promise<T | null> => {
      try {
        return await run();
      } catch (error) {
        setup(`${what} — the database is unreachable`, false, String(error));
        return null;
      }
    };

    const measure = async (): Promise<void> => {
      /* --- setup: a throwaway subject, created through the real form ---- */

      // The subject takes rep-a's OWN `role_id` rather than a role matched by
      // name: it is deterministic, needs no `roles` import, and guarantees the
      // subject is exactly as privileged as the rep whose screens this walk
      // already drives. One of the two SELECTs this section is allowed.
      const repRow = await query("read rep-a's role", async () => {
        const [row] = await db
          .select({ roleId: users.roleId })
          .from(users)
          .where(eq(users.email, "rep-a@example.test"))
          .limit(1);
        return row;
      });
      if (repRow === null) return;
      if (!setup("read rep-a's role", Boolean(repRow?.roleId))) return;

      const form = await get(manager, "/en/users/new");
      if (!setup("GET /en/users/new", form.status === 200, `got ${form.status}`))
        return;

      const creation = envelopeOf(form.body);
      creation.set("name", `${bridgeStamp} Bridge Subject`);
      creation.set("email", bridgeEmail);
      creation.set("roleId", repRow.roleId);
      // The fixture password, so the existing `login()` helper works unchanged.
      creation.set("password", PASSWORD as string);
      creation.set("region", "");
      const created = await fetch(`${BASE}/en/users/new`, {
        method: "POST",
        headers: { cookie: header(manager), origin: BASE },
        body: creation,
        redirect: "manual",
      });
      store(manager, created);
      const createdAt = created.headers.get("location") ?? "";
      victimId = createdAt.match(/\/users\/([0-9a-f-]{36})/)?.[1] ?? "";
      if (
        !setup(
          "POST /en/users/new",
          created.status === 303 && Boolean(victimId),
          `got ${created.status} ${createdAt}`,
        )
      )
        return;

      const jar = await login(bridgeEmail);
      const cookieToken =
        jar.get("__Secure-authjs.session-token") ??
        jar.get("authjs.session-token") ??
        "";
      if (!setup("sign in over HTTP", cookieToken.length > 0, "no session cookie"))
        return;

      /* --- THE BRIDGE: is the cookie a database session row? ------------ */

      // The second and last SELECT. **This is the bridge**, and it is why the
      // zero-`@/` property was spent: a cookie that merely LOOKS like a uuid
      // is a proxy for the claim, and the row is the claim.
      const rows = await query("read the sessions table", () =>
        db
          .select({ token: sessions.sessionToken })
          .from(sessions)
          .where(eq(sessions.userId, victimId)),
      );
      if (rows === null) {
        notMeasured("the sessions table could not be read");
        return;
      }
      check(
        `*** signing in wrote a database session row — saw ${rows.length} *** [S101]`,
        rows.length === 1,
        `${rows.length} rows — 0 means the jwt.encode bridge is DOWN and ` +
          "sessions are not revocable",
      );
      check(
        "*** ...and the cookie carries THAT row's token, not a JWT ***",
        rows.some((row) => row.token === cookieToken),
        `cookie ${cookieToken.length} chars — a uuid is 36, a JWT is far ` +
          "longer and carries two dots",
      );

      /* --- THE CONTROL --------------------------------------------------- */

      /**
       * **The 200 is what makes the 307 below mean anything, and it must stay
       * here.** A server refusing everything for the wrong reason — a dead
       * port, a wrong base URL, a container that never booted — answers the
       * post-deactivation request with a redirect too, and without this the
       * section reads that clean sweep of refusals as a pass.
       *
       * **Same run, same server, same account, moments apart.** A 200 observed
       * by an earlier section, or against a different container, does not
       * license the conclusion: the only thing that changes between this and
       * the assertion below is the deactivation. Do not "tidy" this out as
       * redundant with §2's sign-in check — that is a different identity on a
       * different jar at a different time.
       *
       * The fetch is wrapped so a connection error becomes a CONTROL failure
       * rather than a crash: the section must be able to SAY the control did
       * not hold.
       */
      const request = async (
        path: string,
      ): Promise<{ status: number; location: string; bytes: number; error: string }> => {
        try {
          const response = await fetch(`${BASE}${path}`, {
            headers: { cookie: header(jar) },
            redirect: "manual",
          });
          const body = await response.text();
          return {
            status: response.status,
            location: response.headers.get("location") ?? "",
            bytes: body.length,
            error: "",
          };
        } catch (error) {
          return { status: 0, location: "", bytes: 0, error: String(error) };
        }
      };

      let controlHeld = true;
      for (const locale of ["en", "ar"] as const) {
        const seen = await request(`/${locale}`);
        const held = seen.status === 200 && seen.bytes > 1000;
        if (!held) controlHeld = false;
        check(
          `CONTROL ${locale}: the live session renders a real page — saw ` +
            `${seen.status}, ${seen.bytes} bytes`,
          held,
          seen.error || `got ${seen.status} ${seen.location}`,
        );
      }
      if (!controlHeld) {
        notMeasured("the control did not hold, so a refusal below proves nothing");
        return;
      }

      /* --- revoke, through the screen a manager actually uses ----------- */

      const detail = await get(manager, `/en/users/${victimId}`);
      // **By its `data-slot`, never by position or count.** The page renders
      // three forms — Sign out, the theme toggle and this one — and the
      // reactivation occupies the very same slot once the account is off, so
      // "the only form" and "the last form" both eventually post the wrong
      // thing. The first draft of this section counted, saw 3 where it
      // expected 1, and stopped: that is why the marker exists.
      const deactivateForm = accountForm(detail.body, "account-deactivate");
      if (!setup("find the deactivate form by data-slot", Boolean(deactivateForm)))
        return;

      const revoked = await fetch(`${BASE}/en/users/${victimId}`, {
        method: "POST",
        headers: { cookie: header(manager), origin: BASE },
        body: envelopeOf(deactivateForm as string),
        redirect: "manual",
      });
      store(manager, revoked);
      if (
        !setup(
          "POST the deactivation",
          revoked.status === 200 || revoked.status === 303,
          `got ${revoked.status}`,
        )
      )
        return;

      /* --- THE VERY NEXT REQUEST ---------------------------------------- */

      /**
       * **Two halves that prove different things, in an order that matters.
       * This section learned both the hard way, by being fed its own defect.**
       *
       * Fed the `tx.delete(sessions)` in `deactivateUser` commented out, the
       * redirect assertion below **stayed green**: `getSession` re-reads
       * `is_active` on every request and refuses an inactive user whether or
       * not the row died. So the redirect proves *the person is locked out*,
       * never *the session was revoked*.
       *
       * **And the row count only proves it if it is read FIRST.**
       * `authz.ts:222` deletes the user's sessions itself the moment it sees
       * an inactive account — so a row count taken after the victim's next
       * request measures that cleanup, not `deactivateUser`, and the second
       * draft of this section went green on the defect for exactly that
       * reason. The read below happens before the victim's jar touches the
       * server again; the manager's POST does not disturb it, because
       * `getSession` ran for the manager.
       *
       * Both are kept, in this order: the row is the cause, the redirect is
       * the outcome a person experiences. **Do not collapse them into one
       * assertion, and do not reorder them** — each half was watched going
       * green on a live defect, so either half alone is a false green, and the
       * row read after the redirect is a third.
       */
      const left = await query("re-read the sessions table", () =>
        db
          .select({ token: sessions.sessionToken })
          .from(sessions)
          .where(eq(sessions.userId, victimId)),
      );
      if (left === null) {
        notMeasured("the sessions table could not be re-read");
        return;
      }
      check(
        `*** deactivation revoked the row that real login wrote — saw ` +
          `${left.length} of ${rows.length} *** [S101]`,
        left.length === 0,
        `${left.length} row(s) survived deactivation — the session was NOT ` +
          "revoked, only the account flag was flipped",
      );

      // `S101` says *immediately*. `/en` is the very next request this jar
      // makes after the deactivation; `/ar` follows it and additionally shows
      // the refusal is locale-aware rather than a bare `/login`.
      for (const locale of ["en", "ar"] as const) {
        const seen = await request(`/${locale}`);
        check(
          `${locale}: the very next request is refused — saw ${seen.status} ` +
            `${seen.location || "(no location)"} [S101]`,
          (seen.status === 302 || seen.status === 303 || seen.status === 307) &&
            seen.location.includes(`/${locale}/login`),
          seen.error ||
            `got ${seen.status} ${seen.location} — a 200 here means the person ` +
              "is still being served, which is a live security defect",
        );
      }
    };

    try {
      await measure();
    } finally {
      /**
       * `S111` — the subject ends deactivated whatever happened above, so an
       * early exit cannot leave a live loginable account behind.
       *
       * **It re-reads the page rather than re-posting blindly.** Once the
       * account is inactive the detail screen renders the REACTIVATE form in
       * the same and only slot, so a blind re-post of "the one form" would
       * switch the account back on — the cleanup undoing the thing the section
       * just proved. The handover link renders only on the inactive branch,
       * which is the marker that tells the two apart.
       */
      if (victimId) {
        const page = await get(manager, `/en/users/${victimId}`);
        const stillOn = accountForm(page.body, "account-deactivate");
        if (!stillOn) {
          console.log("  --    the subject is deactivated [S111]");
        } else {
          await fetch(`${BASE}/en/users/${victimId}`, {
            method: "POST",
            headers: { cookie: header(manager), origin: BASE },
            body: envelopeOf(stillOn),
            redirect: "manual",
          });
          // **Re-read rather than announce.** Saying "deactivated now" on the
          // strength of having posted is the same shape of claim this whole
          // section exists to refuse.
          const after = await get(manager, `/en/users/${victimId}`);
          const off = !accountForm(after.body, "account-deactivate");
          console.log(
            `  --    the subject was left active by an early exit at ` +
              `"${setupBroke || "an assertion"}" — ` +
              (off
                ? "deactivated now [S111]"
                : "AND COULD NOT BE DEACTIVATED. Run npm run cleanup:verify [S111]"),
          );
          if (!off) failures += 1;
        }
      }
    }
  }

  /* ── 31 ──────────────────────────────────────────────────────────────── */

  console.log(
    "\n31. /follow-ups — a chip's count is the list it lands on, under a SEARCH [D59], [D33]",
  );
  {
    /*
     * **Driven on a FILTERED state, because the defect was invisible on the
     * default tab** — which is exactly why it survived `S45-5`. `counts` came
     * from the unfiltered `followUpScope` while the list was narrowed by `q`,
     * so a rep searching saw badges summing to 67 over a list of 6.
     *
     * **Nothing checked this before.** No script had ever sent `?q=` to
     * `/follow-ups`; the nearest assertion (`§19`) reads the DASHBOARD tile and
     * fetches `?group=` with no search, so it was green over this defect for
     * its whole life and stays green under the injection that catches it.
     *
     * **It needs neither the pager nor the search box**, both of which drop
     * `group` (`S45-6`, open). Proved rather than assumed: the page reads `q`,
     * `page` and `group` independently and passes all three to `followUps`, so
     * a hand-built URL filters correctly; and `data-total` is the whole
     * FILTERED total in one number, so nothing here pages. The state it drives
     * is one a person reaches by searching and then clicking a chip, which
     * carries the search `D59`.
     */
    const setup = (step: string, ok: boolean, detail = ""): boolean => {
      checks += 1;
      if (ok) {
        console.log(`  setup ${step}`);
        return true;
      }
      failures += 1;
      console.log(`  SETUP FAILED at ${step}${detail ? ` — ${detail}` : ""}`);
      return false;
    };

    // The groups are read from `src/lib/enums.ts`, not typed here — `§24`'s
    // device, for its reason: a copy of a list in an assertion goes stale in
    // silence.
    const groups = (
      readFileSync("src/lib/enums.ts", "utf8").match(
        /export const FOLLOW_UP_GROUPS = \{([\s\S]*?)\n\} as const/,
      )?.[1] ?? ""
    )
      .split("\n")
      .map((line) => line.match(/^\s{2}(\w+):/)?.[1])
      .filter((name): name is string => Boolean(name));
    setup(
      `the four groups were read from enums.ts, not copied into this script`,
      groups.length === 4,
      `${groups.length} found: ${groups.join(",")}`,
    );

    /* Parsed by element, never by attribute ORDER `§24`. */
    const anchors = (body: string) =>
      [...body.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
    const attrOf = (tag: string, name: string) =>
      tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];
    const chipsOf = (body: string): Map<string, number> => {
      const found = new Map<string, number>();
      for (const tag of anchors(body)) {
        const value = attrOf(tag, "data-chip");
        const countValue = attrOf(tag, "data-count");
        if (value === undefined || countValue === undefined) continue;
        found.set(value, Number(countValue));
      }
      return found;
    };
    /**
     * The filtered total, or 0 when the screen says it is empty.
     *
     * **The empty state carries a marker for this reason** — with no rows there
     * is no `list-card` and no `data-total`, and without a marker a group of
     * nothing is indistinguishable from a broken page. `-1` means neither was
     * present, which is a failure and never a zero.
     */
    const totalOf = (body: string): number => {
      const m = body.match(/data-slot="list-card"[^>]*data-total="(\d+)"/);
      if (m) return Number(m[1]);
      return body.includes('data-slot="follow-ups-empty"') ? 0 : -1;
    };

    for (const locale of ["en", "ar"] as const) {
      // The rep, because this is the screen a rep works down `D34`.
      const jar = jars["rep-a@example.test"];
      const base = await get(jar, `/${locale}/follow-ups`);
      if (
        !setup(
          `${locale}: /follow-ups answers 200`,
          base.status === 200,
          `saw ${base.status}`,
        )
      )
        continue;

      const unfilteredTotal = totalOf(base.body);
      const unfilteredChips = chipsOf(base.body);
      if (
        !setup(
          `${locale}: the chips and the total are readable`,
          unfilteredTotal >= 0 && unfilteredChips.size >= groups.length,
          `total ${unfilteredTotal}, ${unfilteredChips.size} chip(s) with counts`,
        )
      )
        continue;

      /* A term harvested from the rows themselves, never invented — the ids
         harvest `§2` and `§17` already own, applied to a name. */
      const names = [
        ...base.body.matchAll(/<td[^>]*data-phone="name"[^>]*>([\s\S]*?)<\/td>/g),
      ]
        .map((m) => m[1].replace(/<[^>]*>/g, "").trim())
        .filter(Boolean);
      const candidates = [
        ...new Set(
          names.map((n) => n.split(/\s+/)[0]).filter((t) => t.length >= 3),
        ),
      ];

      let term = "";
      let searchedTotal = -1;
      for (const candidate of candidates) {
        const probe = await get(
          jar,
          `/${locale}/follow-ups?q=${encodeURIComponent(candidate)}`,
        );
        const found = totalOf(probe.body);
        if (found > 0 && found < unfilteredTotal) {
          term = candidate;
          searchedTotal = found;
          break;
        }
      }

      /* **NOT MEASURED, never `ok`.** A run that only ever sees the default tab
         proves nothing about this defect — that is the whole finding. */
      if (!term) {
        console.log(
          `  --    ${locale}: no search narrows a scope of ${unfilteredTotal} ` +
            `over ${candidates.length} harvested term(s) — the chip counts are NOT MEASURED`,
        );
        continue;
      }

      const searched = await get(
        jar,
        `/${locale}/follow-ups?q=${encodeURIComponent(term)}`,
      );
      const chips = chipsOf(searched.body);

      check(
        `${locale}: the search narrows the scope — saw ${searchedTotal} of ${unfilteredTotal} for "${term}" [D59]`,
        searchedTotal > 0 && searchedTotal < unfilteredTotal,
        `${candidates.length} candidates`,
      );

      /* **The claim.** Each chip's badge against the list that chip's own href
         lands on — the search it carries, the group it sets. */
      const pairs: string[] = [];
      let agreed = true;
      for (const group of groups) {
        const landed = await get(
          jar,
          `/${locale}/follow-ups?q=${encodeURIComponent(term)}&group=${group}`,
        );
        const listed = totalOf(landed.body);
        const badge = chips.get(group);
        pairs.push(`${group} ${badge ?? "?"}/${listed}`);
        if (badge === undefined || listed < 0 || badge !== listed) agreed = false;
      }
      check(
        `${locale}: *** every chip's count is the list it lands on — saw ${pairs.join(" · ")} (badge/list) *** [D59], [D33]`,
        agreed,
        `term "${term}"`,
      );

      const summed = groups.reduce((n, g) => n + (chips.get(g) ?? 0), 0);
      check(
        `${locale}: *** the chips sum to the searched total — saw ${summed} of ${searchedTotal} *** [D59]`,
        chips.size > 0 && summed === searchedTotal,
        `term "${term}"`,
      );

      /* **The count ignores the filter the chip REPLACES.** Clicking a chip
         swaps the group, so a count inside the active group would read 0 on
         every chip but the live one — each kind belongs to exactly one group. */
      const inGroup = await get(
        jar,
        `/${locale}/follow-ups?q=${encodeURIComponent(term)}&group=${groups[0]}`,
      );
      const inGroupChips = chipsOf(inGroup.body);
      const sameUnderGroup = groups.every(
        (g) => inGroupChips.get(g) === chips.get(g),
      );
      check(
        `${locale}: *** the counts ignore the filter the chip replaces — saw ${groups
          .map((g) => `${g} ${inGroupChips.get(g) ?? "?"}`)
          .join(" · ")} under ?group=${groups[0]} *** [D59]`,
        inGroupChips.size > 0 && sameUnderGroup,
        `against ${groups.map((g) => `${g} ${chips.get(g) ?? "?"}`).join(" · ")}`,
      );

      /* The unfiltered path is what the rail badge and `D33`'s tiles read
         through `shellCounts()`, and it must not have moved. */
      const unfilteredSum = groups.reduce(
        (n, g) => n + (unfilteredChips.get(g) ?? 0),
        0,
      );
      check(
        `${locale}: the unfiltered chips still sum to the unfiltered total — saw ${unfilteredSum} of ${unfilteredTotal} [D33]`,
        unfilteredSum === unfilteredTotal,
        "the dashboard reads this same fold",
      );

      /* `CLAUDE.md`'s logical-margin trap, fourth sighting: the count carries
         `dir="ltr"`, so an `ms-*` on it resolves against ITS direction and lands
         outside the number in Arabic. The chip is a flex row with a gap. */
      const countSpans = [
        ...searched.body.matchAll(/<span class="num[^"]*"[^>]*dir="ltr"/g),
      ].map((m) => m[0]);
      check(
        `${locale}: no chip count carries a logical margin — saw ${countSpans.length} count span(s) [D57]`,
        countSpans.length > 0 &&
          countSpans.every((span) => !/\b(ms|me)-/.test(span)),
        countSpans.find((span) => /\b(ms|me)-/.test(span)) ?? "",
      );
    }
  }

  /* ── 32 ──────────────────────────────────────────────────────────────── */

  console.log(
    "\n32. /activity — a day header counts the DAY, not the page it landed on [D45], [D24]",
  );
  {
    /*
     * **The defect needs a page boundary, so this section crosses one.**
     * `stream.tsx` grouped the page it had been handed and printed each day's
     * share of it, while `gather` sorts day-major — so a day cut by the
     * boundary rendered TWICE, once at the foot of one page and once at the
     * head of the next, and neither number was the day's `S45-3`.
     *
     * **Nothing checked this.** `§25` names `data-slot="stream-day"` four times
     * and every one is a boolean `includes()` — *is there a day block at all*.
     * It reads no day's number and crosses no boundary, so it stays green under
     * the injection that catches this, which is the honest version of the
     * artefact `7f51569` and `ce70523` built deliberately.
     *
     * **`data-day` and `data-count` exist for this section.** What renders is a
     * locale-formatted date and a bare text node; `CLAUDE.md` asserts on
     * markers, not translated strings, and the formatted date is not even the
     * same string in `ar`.
     */
    const setup = (step: string, ok: boolean, detail = ""): boolean => {
      checks += 1;
      if (ok) {
        console.log(`  setup ${step}`);
        return true;
      }
      failures += 1;
      console.log(`  SETUP FAILED at ${step}${detail ? ` — ${detail}` : ""}`);
      return false;
    };

    // Read from the data module, never typed here — `§24`'s device.
    const pageSize = Number(
      readFileSync("src/lib/timeline.ts", "utf8").match(
        /const TIMELINE_PAGE_SIZE = (\d+);/,
      )?.[1] ?? "0",
    );
    setup(
      "TIMELINE_PAGE_SIZE was read from timeline.ts, not copied into this script",
      pageSize > 0,
      `${pageSize}`,
    );

    /** The `<li data-slot="stream-day">` opening tags, in render order. */
    const dayTags = (body: string) =>
      [...body.matchAll(/<li\b[^>]*>/g)]
        .map((m) => m[0])
        .filter((tag) => tag.includes('data-slot="stream-day"'));
    const dayOf = (tag: string) => tag.match(/data-day="([^"]*)"/)?.[1] ?? "";
    const countOf = (tag: string) =>
      Number(tag.match(/data-count="([^"]*)"/)?.[1] ?? "-1");
    const totalOf = (body: string) =>
      Number(
        body.match(/data-slot="list-card"[^>]*data-total="(\d+)"/)?.[1] ?? "-1",
      );
    /**
     * How many rows one day's block holds on this page — the segment from that
     * day's own `<li>` up to the next day's, counting row markers. Rows carry
     * no day of their own, so the structure is the only honest link.
     */
    const rowsForDay = (body: string, day: string): number => {
      const at = body.indexOf(`data-day="${day}"`);
      if (at === -1) return 0;
      const rest = body.slice(at);
      const next = rest.slice(1).indexOf('data-slot="stream-day"');
      const block = next === -1 ? rest : rest.slice(0, next + 1);
      return (block.match(/data-timeline-event=""/g) ?? []).length;
    };

    for (const locale of ["en", "ar"] as const) {
      // The manager, whose stream is the widest — `§25` proves a rep's is a
      // strict subset, so this is the identity most likely to span pages.
      const jar = jars["manager@example.test"];
      const first = await get(jar, `/${locale}/activity`);
      if (
        !setup(
          `${locale}: /activity answers 200`,
          first.status === 200,
          `saw ${first.status}`,
        )
      )
        continue;

      const total = totalOf(first.body);
      if (
        !setup(
          `${locale}: the stream's total and its day markers are readable`,
          total > 0 && dayTags(first.body).length > 0,
          `total ${total}, ${dayTags(first.body).length} day block(s)`,
        )
      )
        continue;

      if (!pageSize || total <= pageSize) {
        console.log(
          `  --    ${locale}: ${total} events at ${pageSize}/page is one page — no boundary to cross, NOT MEASURED`,
        );
        continue;
      }

      /* Walk the boundaries looking for a day that spans one. Day-major order
         means a straddle can only ever be the last day of a page against the
         first of the next, and there is at most one per boundary. */
      const lastPage = Math.ceil(total / pageSize);
      const bodies = new Map<number, string>([[1, first.body]]);
      const bodyFor = async (page: number) => {
        const held = bodies.get(page);
        if (held !== undefined) return held;
        const fetched = (await get(jar, `/${locale}/activity?page=${page}`))
          .body;
        bodies.set(page, fetched);
        return fetched;
      };

      let straddle = "";
      let cutPage = 0;
      for (let page = 1; page < lastPage && !straddle; page += 1) {
        const here = dayTags(await bodyFor(page));
        const next = dayTags(await bodyFor(page + 1));
        const tail = here.at(-1);
        const head = next[0];
        if (!tail || !head) continue;
        if (dayOf(tail) && dayOf(tail) === dayOf(head)) {
          straddle = dayOf(tail);
          cutPage = page;
        }
      }

      /* **NOT MEASURED, never `ok`.** A run where no day is cut cannot tell a
         day count from a page count, and that is the whole claim. */
      if (!straddle) {
        console.log(
          `  --    ${locale}: no day spans a boundary over ${lastPage} page(s) of ${total} — NOT MEASURED`,
        );
        continue;
      }

      const cutBody = await bodyFor(cutPage);
      const nextBody = await bodyFor(cutPage + 1);
      const statedHere = countOf(dayTags(cutBody).at(-1) as string);
      const statedNext = countOf(dayTags(nextBody)[0] as string);
      const rowsHere = rowsForDay(cutBody, straddle);
      const rowsNext = rowsForDay(nextBody, straddle);

      check(
        `${locale}: *** a day split across pages reads the SAME count on both — saw ${straddle} ${statedHere} then ${statedNext} across pages ${cutPage}/${cutPage + 1} *** [D45]`,
        statedHere > 0 && statedHere === statedNext,
        `${lastPage} pages of ${total}`,
      );

      /* **The positive control.** A page-local count is `count === rows` on
         every page and can never exceed the rows beneath it; a day count does,
         the moment the boundary cuts the day. */
      check(
        `${locale}: *** the count is the DAY's size, not the page's — saw ${statedHere} over ${rowsHere} row(s) on page ${cutPage} *** [D45]`,
        rowsHere > 0 && statedHere > rowsHere,
        `day ${straddle}`,
      );

      /* Summed across the pages it spans, the day's own rows are the count.
         Walk on while the day keeps appearing — it may span more than two. */
      let spanned = rowsHere;
      let page = cutPage + 1;
      while (page <= lastPage) {
        const body = await bodyFor(page);
        const held = rowsForDay(body, straddle);
        if (held === 0) break;
        spanned += held;
        page += 1;
      }
      check(
        `${locale}: *** and that count is its rows summed across the pages it spans — saw ${spanned} of ${statedHere} *** [D45]`,
        spanned > 0 && spanned === statedHere,
        `${straddle} over pages ${cutPage}..${page - 1}`,
      );

      /*
       * **There is deliberately NO cross-check against `?from=D&to=D` here,
       * and the reason is worth more than the assertion was.** The first cut of
       * this section asserted the day's count against that day's ranged total,
       * on the assumption that narrowing to one day reads the same set. It does
       * not: `companyAddedEvents` opens with
       * `if (!scope.companyId && !range) return []`, so **the unranged stream
       * omits `company_added` entirely** and the ranged one includes it.
       * Measured on the reseeded database as the manager: unranged **299**
       * events over five kinds, all-time ranged **426** over six, the whole
       * difference being **127 `company_added`** and nothing else. The
       * assertion was comparing two sets that differ by construction, and it
       * went red on a correct fold — `S45-1`'s shape, caught before shipping
       * because it was asserted apart from the three above rather than folded
       * into them. `WORKFLOW §5 S45-7` carries whether hiding a third of the
       * stream by default is intended; this section does not re-litigate it.
       */

      /* Nothing above read an empty page. */
      const walked = [...bodies.values()].reduce(
        (n, body) => n + (body.match(/data-timeline-event=""/g) ?? []).length,
        0,
      );
      check(
        `${locale}: the walk read rows on every page it fetched — saw ${walked} row(s) over ${bodies.size} page(s) of ${total} [D45]`,
        walked > 0 && walked >= rowsHere + rowsNext,
        `${bodies.size} fetched`,
      );
    }
  }


  /* ── 33 ──────────────────────────────────────────────────────────────── */

  console.log(
    "\n33. /follow-ups — the search box and the pager carry the filter too, not just the chips [D59]",
  );
  {
    /*
     * **The defect is a LOST parameter, so this asserts what SURVIVES** — and
     * then what the survivor returns, because a correct href that lands on an
     * unfiltered list would pass a URL-only check `S45-6`.
     *
     * `SearchForm`, `FilterNav` and `ListPagination` each build their href from
     * an empty `URLSearchParams`, so a parameter survives only if the page
     * hands it over. `/follow-ups` handed over nothing: searching or paging
     * from `?group=quiet` silently widened the list to every group, which is
     * `D59`'s own stated failure reached through two controls rather than a
     * chip. `/companies`, `/dispatches`, `/projects` and `/quotations` all pass
     * both already.
     *
     * **Nothing checked this, on any screen.** Every `?page=` in this file is
     * hand-built by the script — `§20`, `§24`, `§31`, `§32` included — so no
     * assertion has ever read a rendered pager's href, and none has ever read a
     * search form's hidden fields. `§31` proves the chip counts and deliberately
     * builds its own URLs, which is why it passes unchanged either way.
     */
    const setup = (step: string, ok: boolean, detail = ""): boolean => {
      checks += 1;
      if (ok) {
        console.log(`  setup ${step}`);
        return true;
      }
      failures += 1;
      console.log(`  SETUP FAILED at ${step}${detail ? ` — ${detail}` : ""}`);
      return false;
    };

    const pageSize = Number(
      readFileSync("src/lib/follow-ups.ts", "utf8").match(
        /FOLLOW_UP_PAGE_SIZE = (\d+);/,
      )?.[1] ?? "0",
    );
    setup(
      "FOLLOW_UP_PAGE_SIZE was read from follow-ups.ts, not copied into this script",
      pageSize > 0,
      `${pageSize}`,
    );

    const totalOf = (body: string) => {
      const m = body.match(/data-slot="list-card"[^>]*data-total="(\d+)"/);
      if (m) return Number(m[1]);
      return body.includes('data-slot="follow-ups-empty"') ? 0 : -1;
    };
    /** The one `<form>` that holds the search input, by its own field. */
    const searchForm = (body: string) =>
      body
        .split("<form")
        .slice(1)
        .map((chunk) => chunk.split("</form>")[0])
        .find((chunk) => /name="q"/.test(chunk)) ?? "";
    /**
     * A rendered pager href, as the browser would follow it.
     *
     * **Unescaped, and matched WITHOUT assuming a bare `&`.** The markup holds
     * `?group=quiet&amp;page=2`, so a pattern requiring `[?&]page=` matches
     * nothing and the check reports *NO pager href* on a pager that is present
     * and correct — which is exactly what the first run of this section did.
     */
    const pagerHref = (body: string) =>
      (
        body.match(/href="([^"]*follow-ups[^"]*page=\d+[^"]*)"/)?.[1] ?? ""
      ).replace(/&amp;/g, "&");

    for (const locale of ["en", "ar"] as const) {
      const jar = jars["manager@example.test"];
      const wide = await get(jar, `/${locale}/follow-ups`);
      if (
        !setup(
          `${locale}: /follow-ups answers 200`,
          wide.status === 200,
          `saw ${wide.status}`,
        )
      )
        continue;
      const wideTotal = totalOf(wide.body);
      if (!setup(`${locale}: the unfiltered total is readable`, wideTotal > 0))
        continue;

      /* A group whose own list spans more than one page — paging is half the
         claim and cannot be asserted from a single page. */
      const groups = [
        ...new Set(
          [...wide.body.matchAll(/data-chip="([^"]+)"/g)].map((m) => m[1]),
        ),
      ];
      let group = "";
      let filteredTotal = -1;
      for (const candidate of groups) {
        const body = (await get(jar, `/${locale}/follow-ups?group=${candidate}`))
          .body;
        const found = totalOf(body);
        if (found > pageSize && found < wideTotal) {
          group = candidate;
          filteredTotal = found;
          break;
        }
      }

      /* **NOT MEASURED, never `ok`.** A single-page filtered set cannot show
         whether the pager keeps the filter, and that is half the claim. */
      if (!group) {
        console.log(
          `  --    ${locale}: no group's own list spans more than one page of ${pageSize} (scope ${wideTotal}) — NOT MEASURED`,
        );
        continue;
      }

      const filtered = await get(jar, `/${locale}/follow-ups?group=${group}`);
      const form = searchForm(filtered.body);
      const href = pagerHref(filtered.body);

      check(
        `${locale}: the filter narrows before anything is asserted about it — saw ${filteredTotal} of ${wideTotal} for group=${group} [D59]`,
        filteredTotal > pageSize && filteredTotal < wideTotal,
        `${groups.length} chip(s)`,
      );
      check(
        `${locale}: *** the search box carries the active filter — saw ${
          form.match(/<input[^>]*name="group"[^>]*>/)?.[0] ?? "NO hidden group field"
        } *** [D59]`,
        form !== "" &&
          new RegExp(`name="group"[^>]*value="${group}"|value="${group}"[^>]*name="group"`).test(form),
        `group=${group}`,
      );
      check(
        `${locale}: *** the pager carries it too — saw ${href || "NO pager href"} *** [D59]`,
        href !== "" && href.includes(`group=${group}`),
        `group=${group}`,
      );

      /* **And the href's RESULT, not merely its text.** A link that reads right
         and lands on an unfiltered list is the same defect one step later. */
      const landed = await get(jar, href.replace(/^\/(en|ar)/, `/${locale}`));
      const landedTotal = totalOf(landed.body);
      check(
        `${locale}: *** …and page two of a filtered list is still filtered — saw ${landedTotal} of ${filteredTotal}, against ${wideTotal} unfiltered *** [D59]`,
        landed.status === 200 &&
          landedTotal === filteredTotal &&
          landedTotal !== wideTotal,
        `followed ${href}`,
      );
    }
  }


  /* ── 34 ──────────────────────────────────────────────────────────────── */

  console.log(
    "\n34. Nobody — every (app) surface and every action, with no cookie at all [S44-4]",
  );
  {
    /*
     * **The permanent fourth identity.** `verify:routes` drove three and
     * asserted the anonymous case exactly twice — `§1`'s `/en/companies` and
     * `§26`'s 401 — against a surface session 44's throwaway probe measured at
     * **86**. Two of 86 is the ratio this section exists to close, and the
     * probe that measured it was deleted by design `S44-4`.
     *
     * **UNPROVEN is not passing**, session 44's rule, kept: only an
     * unambiguous redirect to `/login` or a `401` counts as protected. A 404, a
     * 5xx, a connection error or a 200 with an empty body is UNPROVEN — named,
     * counted separately, never folded into the pass. A sweep that mostly could
     * not tell must not read as a sweep that mostly passed.
     *
     * **The positive control is not optional, and this is why.** This section
     * is a wall of negatives, and a server refusing everything for the wrong
     * reason — wrong port, dead container, wrong base URL — reads as a clean
     * sweep. So one route is driven WITH a cookie moments earlier, against the
     * same server, and must answer 200 with a real body. If it does not, the
     * sweep is `NOT MEASURED` and asserts nothing at all. **Do not remove this
     * as redundant**: session 44's probe was licensed by exactly one logged-in
     * line, and without it 86 refusals prove only that something is not there.
     */
    const setup = (step: string, ok: boolean, detail = ""): boolean => {
      checks += 1;
      if (ok) {
        console.log(`  setup ${step}`);
        return true;
      }
      failures += 1;
      console.log(`  SETUP FAILED at ${step}${detail ? ` — ${detail}` : ""}`);
      return false;
    };

    /** No cookie header at all, and no redirect followed — the status is the answer. */
    const asNobody = async (path: string, body?: FormData) => {
      try {
        const response = await fetch(`${BASE}${path}`, {
          method: body ? "POST" : "GET",
          // A correct `Origin` on the POST: a CSRF refusal would be a refusal
          // for the wrong reason, and would pass this section while proving
          // nothing about the gate `S44-4`.
          headers: body ? { origin: BASE } : {},
          body,
          redirect: "manual",
        });
        return {
          status: response.status,
          location: response.headers.get("location") ?? "",
          text: await response.text(),
        };
      } catch (error) {
        return { status: 0, location: "", text: String(error) };
      }
    };

    type Verdict = "PROTECTED" | "ANSWERED" | "UNPROVEN";
    const verdictOf = (r: {
      status: number;
      location: string;
      text: string;
    }): [Verdict, string] => {
      if (r.status === 401) return ["PROTECTED", "401"];
      if (r.status >= 300 && r.status < 400) {
        return /\/(en|ar)\/login/.test(r.location)
          ? ["PROTECTED", `${r.status} -> login`]
          : ["UNPROVEN", `${r.status} -> ${r.location || "nowhere"}`];
      }
      if (r.status === 200) {
        return r.text.length > 0
          ? ["ANSWERED", `200, ${r.text.length}b`]
          : ["UNPROVEN", "200 with an empty body"];
      }
      if (r.status === 0) return ["UNPROVEN", "no reply"];
      return ["UNPROVEN", `${r.status}`];
    };

    /* --- the positive control, first and gating -------------------------- */

    /* Its own base, named, so the control can be pointed somewhere dead to
       prove this section declines rather than reporting a clean sweep. */
    const CONTROL_BASE = BASE;
    const control = await fetch(`${CONTROL_BASE}/en/companies`, {
      headers: { cookie: header(jars["manager@example.test"]) },
      redirect: "manual",
    })
      .then(async (r) => ({ status: r.status, length: (await r.text()).length }))
      .catch((e) => ({ status: 0, length: 0, error: String(e) }));
    const controlHeld = control.status === 200 && control.length > 2000;
    setup(
      `CONTROL: the same server answers a signed-in request — saw ${control.status}, ${control.length} bytes`,
      controlHeld,
    );

    if (!controlHeld) {
      console.log(
        "  ----  NOBODY WAS NOT MEASURED — the control did not hold, so a refusal below" +
          " proves nothing about the gate. No assertion ran.",
      );
    } else {
      /* --- the surface ------------------------------------------------- */

      const manager = jars["manager@example.test"];
      const ids: Record<string, string> = {};
      for (const section of [
        "companies",
        "contacts",
        "projects",
        "quotations",
        "dispatches",
        "reports",
        "users",
      ]) {
        /*
         * **`reports` is harvested from `?kind=typed`, not from the bare
         * stream.** It read page one of `/activity` until `S45-7` put 127
         * `company_added` events back into the default view, at which point
         * page one held no report row and this setup failed — correctly, and
         * apart from the claim, which is how it was found rather than
         * mistaken for a coverage gap.
         */
        const from =
          section === "reports"
            ? "/en/activity?kind=typed"
            : `/en/${LIST_ROUTE[section] ?? section}`;
        const list = await get(manager, from);
        const id = list.status === 200 ? firstId(list.body, section) : null;
        if (id) ids[section] = id;
      }
      setup(
        `harvested a real id for ${Object.keys(ids).length} of 7 sections`,
        Object.keys(ids).length === 7,
        Object.keys(ids).join(","),
      );

      /* Two shapes need an id that is not a list's first row. */
      const quotationBody = ids.quotations
        ? (await get(manager, `/en/quotations/${ids.quotations}`)).body
        : "";
      const versionId =
        quotationBody.match(/\/versions\/([0-9a-f-]{36})/)?.[1] ?? "";
      /* `?kind=said` IS the conversation `D45`, so it is where a comment id is
         certain to be — a company detail page may simply have no comment. */
      const saidBody = (await get(manager, "/en/activity?kind=said")).body;
      const commentId = saidBody.match(/id="comment-([0-9a-f-]{36})"/)?.[1] ?? "";

      const paths: string[] = [];
      for (const locale of ["en", "ar"] as const) {
        for (const route of STATIC_ROUTES) {
          paths.push(`/${locale}${route === "/" ? "" : route}` || `/${locale}`);
        }
        for (const [section, suffixes] of [
          ["companies", ["", "/edit", "/timeline"]],
          ["contacts", ["", "/edit"]],
          ["projects", ["", "/edit", "/timeline"]],
          ["quotations", [""]],
          ["dispatches", ["", "/edit"]],
          ["reports", ["", "/edit"]],
          ["users", ["", "/edit", "/handover"]],
        ] as [string, string[]][]) {
          if (!ids[section]) continue;
          for (const suffix of suffixes) {
            paths.push(`/${locale}/${section}/${ids[section]}${suffix}`);
          }
        }
        if (versionId && ids.quotations) {
          paths.push(
            `/${locale}/quotations/${ids.quotations}/versions/${versionId}`,
          );
        }
        if (commentId) paths.push(`/${locale}/comments/${commentId}/edit`);
      }
      /** The API surface, including the endpoints login cannot work without. */
      const API = [
        "/api/updates?scope=stream&since=2026-01-01T00:00:00.000Z",
        "/api/health",
        "/api/auth/session",
        "/api/auth/csrf",
        "/api/auth/providers",
      ];
      paths.push(...API);

      /* --- the actions, scraped off authenticated renders ---------------- */

      const scraped = new Map<string, { path: string; form: string }>();
      for (const from of [
        "/en",
        "/en/companies",
        "/en/follow-ups",
        "/en/targets",
        "/en/notifications",
        "/en/activity",
        ...(ids.companies ? [`/en/companies/${ids.companies}`] : []),
        ...(ids.projects ? [`/en/projects/${ids.projects}`] : []),
        ...(ids.quotations ? [`/en/quotations/${ids.quotations}`] : []),
        ...(ids.dispatches ? [`/en/dispatches/${ids.dispatches}`] : []),
        ...(ids.users ? [`/en/users/${ids.users}`] : []),
        ...(ids.reports ? [`/en/reports/${ids.reports}`] : []),
      ]) {
        const { body } = await get(manager, from);
        for (const form of body.match(/<form[^>]*>[\s\S]*?<\/form>/g) ?? []) {
          const id = form.match(/name="\$ACTION_ID_([^"]+)"/)?.[1] ??
            form.match(/name="\$ACTION_REF_(\d+)"/)?.[1];
          if (!id) continue;
          const key = `${from}::${id}`;
          if (!scraped.has(key)) scraped.set(key, { path: from, form });
        }
      }
      setup(
        `scraped ${scraped.size} distinct server action(s) off authenticated renders`,
        scraped.size > 0,
      );

      /* --- drive every one of them as nobody ---------------------------- */

      const answered: string[] = [];
      const unproven: string[] = [];
      let protectedCount = 0;
      let driven = 0;

      for (const path of paths) {
        driven += 1;
        const [verdict, why] = verdictOf(await asNobody(path));
        if (verdict === "PROTECTED") protectedCount += 1;
        else if (verdict === "ANSWERED") answered.push(`${path} (${why})`);
        else unproven.push(`${path} (${why})`);
      }
      for (const [key, { path, form }] of scraped) {
        driven += 1;
        const [verdict, why] = verdictOf(await asNobody(path, envelopeOf(form)));
        if (verdict === "PROTECTED") protectedCount += 1;
        else if (verdict === "ANSWERED") answered.push(`action ${key} (${why})`);
        else unproven.push(`action ${key} (${why})`);
      }

      /** The only surfaces allowed to answer, by identity and with a reason. */
      const PUBLIC = [
        // Auth.js's own three: login cannot work without them.
        "/api/auth/session",
        "/api/auth/csrf",
        "/api/auth/providers",
        // Docker's healthcheck hits this every 30s (`docker-compose.yml`) and
        // `§0` reads it before any login. It discloses up/down, never data.
        "/api/health",
      ];
      const answeredPaths = answered.map((a) => a.replace(/ \(.*$/, "")).sort();

      /*
       * **This one is the sweep's arithmetic, NOT the identity claim** — every
       * surface reached a verdict and none was UNPROVEN. Its first label read
       * *nobody is refused everywhere*, which the condition does not test: it
       * balances for any number of answering surfaces, and it stayed green
       * under the injection that made `/api/updates` answer. That is the
       * wrong-assertion shape, caught by feeding this section its defect. The
       * identity claim is the check below, and it is where the exception set
       * is pinned.
       */
      check(
        `*** every surface reached a verdict — saw ${protectedCount} PROTECTED and ${answeredPaths.length} answering of ${driven}, ${unproven.length} UNPROVEN *** [S44-4]`,
        driven > 0 &&
          unproven.length === 0 &&
          protectedCount + answeredPaths.length === driven,
        unproven.length > 0
          ? `UNPROVEN: ${unproven.join(" · ")}`
          : `answered: ${answeredPaths.join(" · ")}`,
      );
      /* **By identity, and as a SET.** A list of exceptions that grows quietly
         is how this gap reopens, so this is equality and not containment. */
      check(
        `*** the only surfaces that answer nobody are the four public ones — saw [${answeredPaths.join(",")}] *** [S44-4]`,
        answeredPaths.join(",") === [...PUBLIC].sort().join(","),
        `expected [${[...PUBLIC].sort().join(",")}]`,
      );
      check(
        `nothing was UNPROVEN — saw ${unproven.length} of ${driven} [S44-4]`,
        unproven.length === 0,
        unproven.join(" · "),
      );

      /*
       * **Coverage measured against the APP, not against this section's own
       * list** `d66e1a0`. A count of routes compared with a count this section
       * derived would be two sides of one computation; the other side here is
       * the filesystem — every `page.tsx` under `(app)`, which is what Next
       * actually serves.
       */
      const onDisk = new Set<string>();
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const full = `${dir}/${entry.name}`;
          if (entry.isDirectory()) walk(full);
          else if (entry.name === "page.tsx") {
            const shape =
              full
                .replace("src/app/[locale]/(app)", "")
                .replace("/page.tsx", "") || "/";
            onDisk.add(shape);
          }
        }
      };
      walk("src/app/[locale]/(app)");
      const shapeOf = (path: string) =>
        path
          .replace(/^\/(en|ar)/, "")
          .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27}/g, "/[id]") || "/";
      const drivenShapes = new Set(
        paths.filter((p) => !p.startsWith("/api")).map(shapeOf),
      );
      const missed = [...onDisk]
        .filter((shape) => !drivenShapes.has(shape.replace(/\[\w+Id\]/g, "[id]")))
        .sort();
      check(
        `*** every (app) route on disk was driven as nobody — saw ${onDisk.size - missed.length} of ${onDisk.size} *** [S44-4]`,
        onDisk.size > 0 && missed.length === 0,
        `not driven: ${missed.join(" · ")}`,
      );
    }
  }


  /* ── 23 ──────────────────────────────────────────────────────────────── */

  console.log(
    "\n23. Operability — every form's fields, with scripts off [D20]",
  );
  {
    // **Last, deliberately.** It reports on everything every section above
    // fetched, the way section 12 reports on the message keys: the scan runs
    // inside `get()`, so by the time this prints, every page this walk reached
    // in either locale as any of the three identities has been through it.
    //
    // A green run here is not "no forms were looked at" — that is what the
    // first assertion is for.
    // **The scan is proved against the two shapes this slice deleted, before
    // it is believed about anything else.** A section that has only ever been
    // green has not been shown to work, and this one's whole value is that it
    // goes red — so it is fed a synthetic page carrying the `Combobox`'s empty
    // hidden input behind a trigger button and Radix's `role="checkbox"` with
    // its `aria-hidden` bubble input, plus two shapes it must NOT flag. If the
    // day comes that a refactor makes this scan inert, this fails first and
    // the 1,000 checks above it stop being reassuring.
    const SELF_TEST = "/en/__operability__";
    scanOperability(
      SELF_TEST,
      `<html><body><form data-slot="self-test">` +
        // The city, as it shipped: required, and nothing a person can fill.
        `<div data-field="cityId" data-required="">` +
        `<input type="hidden" name="cityId" value=""/>` +
        `<button type="button" id="cityId">Pick</button></div>` +
        // A checkbox, as Radix rendered it: the name is on the bubble input.
        `<button type="button" role="checkbox" aria-checked="false"></button>` +
        `<input type="checkbox" aria-hidden="true" tabindex="-1" ` +
        `name="userIds" value="u1" style="pointer-events:none"/>` +
        // Neither of these is a defect and neither may be reported.
        `<select name="fine"><option value="a">a</option></select>` +
        `<input type="hidden" name="known" value="already-decided"/>` +
        `</form></body></html>`,
    );
    const shape = "/:locale/__operability__|self-test";
    const cityFinding = operability.get(`${shape}|cityId`);
    const bubbleFinding = operability.get(`${shape}|userIds`);
    check(
      "the scan catches an empty hidden input standing in for a required field [D20]",
      cityFinding?.required === true,
      cityFinding?.detail ?? "NOT CAUGHT",
    );
    check(
      "the scan catches an aria-hidden input behind a role=checkbox [D20]",
      bubbleFinding !== undefined && bubbleFinding.required === false,
      bubbleFinding?.detail ?? "NOT CAUGHT",
    );
    check(
      "…and it reports neither a native select nor a hidden input with a value",
      !operability.has(`${shape}|fine`) && !operability.has(`${shape}|known`),
    );
    // Out of the report: these are this section's own fixtures, not findings
    // about a screen. The counters go back too, so the totals printed below
    // describe real pages only.
    for (const field of ["cityId", "userIds", "fine", "known"]) {
      operability.delete(`${shape}|${field}`);
    }
    formsScanned -= 1;
    routesScanned -= 1;

    check(
      `the scan reached forms at all — ${formsScanned} forms over ${routesScanned} fetches`,
      formsScanned > 0,
    );

    const findings = [...operability.values()].sort((a, b) =>
      a.route.localeCompare(b.route),
    );
    const failures = findings.filter((finding) => finding.required);
    const notes = findings.filter((finding) => !finding.required);

    // **The named failures.** A field the screen says its action needs, that
    // no native control carries — the person cannot produce the body, whatever
    // the POST replay in §17 says.
    for (const finding of failures) {
      check(
        `*** ${finding.route} ${finding.form}: "${finding.field}" is REQUIRED and has no native control *** [D20]`,
        false,
        finding.detail,
      );
    }
    check(
      `no required field stands behind JavaScript [D20]`,
      failures.length === 0,
      `${failures.length} of ${findings.length} finding(s) are required fields`,
    );

    // **The notes.** Not failures here: each one is a defect on somebody
    // else's screen, and `WORKFLOW §5` is where it is owned rather than fixed
    // by whoever happened to run this.
    if (notes.length > 0) {
      console.log(
        `  note  ${notes.length} non-required field(s) are not operable with scripts off —`,
      );
      console.log("        each becomes a `WORKFLOW §5` row for its screen's session:");
      for (const note of notes) {
        console.log(
          `        ${note.route}  ${note.form}  "${note.field}"  ${note.detail}`,
        );
      }
    }
  }
}

/**
 * The `<form>` carrying one `data-slot`, whole, or null.
 *
 * `envelopeOf` needs the form's own `$ACTION` inputs and nobody else's, so the
 * match is bounded at the first `</form>` after the marker. Used only by §30,
 * where posting the wrong form would reactivate the account it just revoked.
 */
function accountForm(body: string, slot: string): string | null {
  const at = body.indexOf(`data-slot="${slot}"`);
  if (at === -1) return null;
  const start = body.lastIndexOf("<form", at);
  const end = body.indexOf("</form>", at);
  return start === -1 || end === -1 ? null : body.slice(start, end + 7);
}

/** One `data-` attribute off the element carrying `data-slot="…"`. */
function attrOf(body: string, slot: string, attr: string): string | null {
  const tag = body.match(new RegExp(`<[a-z]+[^>]*data-slot="${slot}"[^>]*>`));
  return tag?.[0].match(new RegExp(`${attr}="([^"]*)"`))?.[1] ?? null;
}

/** `common.none` — the same glyph in both locales, so it is a value, not a
 *  translated string this script would be wrong to grep for. */
const DASH = "—";

/**
 * The rendered text of one `Fact`, by its `data-fact` handle.
 *
 * A fact's label is translated and next-intl ships every message to every
 * page, so the label cannot identify a cell. `data-fact` is the DOM marker
 * that can — the same device as the loss reason's `data-code` in section 7.
 */
function factOf(body: string, name: string): string {
  const cell = body.match(
    new RegExp(`<div[^>]*data-fact="${name}"[\\s\\S]*?</div>`),
  )?.[0];
  const value = cell?.match(/<dd[^>]*>([\s\S]*?)<\/dd>/)?.[1] ?? "";
  return value.replace(/<[^>]*>/g, "").trim();
}

/**
 * The raw markup of one `Fact`, by its `data-fact` handle.
 *
 * `factOf` strips the tags, which is right when the assertion is about the
 * VALUE. Where the claim is about ABSENCE it is asserted on a marker inside
 * the cell instead — the difference between "deliberately not there yet" and
 * an em-dash is a `data-slot`, not a string this script may read. `S50`'s
 * project-less quotation was what taught that distinction; a company's
 * un-issued SMAC reference is what still uses it.
 */
function factHtmlOf(body: string, name: string): string {
  return (
    body.match(new RegExp(`<div[^>]*data-fact="${name}"[\\s\\S]*?</div>`))?.[0] ??
    ""
  );
}

/** The strip's position and the state of each of its six nodes, or null. */
function stripOf(
  body: string,
): { position: string; steps: string[] } | null {
  const marker = body.indexOf('data-slot="chain-strip"');
  if (marker < 0) return null;
  const markup = body.slice(
    body.lastIndexOf("<ol", marker),
    body.indexOf("</ol>", marker),
  );
  return {
    position: markup.match(/data-position="([a-zA-Z]+)"/)?.[1] ?? "",
    steps: [...markup.matchAll(/<li[^>]*data-state="([a-z]+)"/g)].map(
      (m) => m[1],
    ),
  };
}

/** The five entities Next escapes into an attribute value. */
function unescapeHtml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");
}

/** The project's own name, off its edit form, so the POST does not rename it. */
function nameOf(body: string): string | undefined {
  const value = body
    .match(/<input[^>]*name="name"[^>]*>/)?.[0]
    .match(/value="([^"]*)"/)?.[1];
  return value === undefined ? undefined : unescapeHtml(value);
}

main()
  .then(async () => {
    console.log(
      failures === 0
        ? `\nAll ${checks} checks passed.`
        : `\n${failures} of ${checks} CHECK(S) FAILED.`,
    );
    // §30 is the only section that opens a connection, and it opens one lazily
    // on its first SELECT. Closing is tidiness rather than necessity — the
    // explicit `process.exit` below ends the process either way.
    await closeDatabase();
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch(async (error) => {
    console.error(error);
    await closeDatabase();
    process.exit(1);
  });


/**
 * Everything after the element carrying `data-slot="…"`, so an assertion can
 * be scoped to one section of a screen rather than to the whole page.
 *
 * `D34` puts two lists on one card, and *"the row is no longer in Slipping"*
 * is only a claim if the substring searched is Slipping — against the whole
 * body it passes the moment the row moves *anywhere*, including into the
 * section it was supposed to leave.
 */
function after(body: string, slot: string): string {
  const at = body.indexOf(`data-slot="${slot}"`);
  return at === -1 ? "" : body.slice(at);
}

/** The same, bounded by the next section's marker. */
function between(body: string, from: string, to: string): string {
  const segment = after(body, from);
  const end = segment.indexOf(`data-slot="${to}"`);
  return end === -1 ? segment : segment.slice(0, end);
}

/** Every `$ACTION…` input of one form, unescaped, as a browser sends it. */
function envelopeOf(form: string): FormData {
  const fields = new FormData();
  for (const input of form.matchAll(/<input[^>]*>/g)) {
    const name = input[0].match(/name="([^"]+)"/)?.[1];
    if (!name?.startsWith("$ACTION")) continue;
    fields.append(
      name,
      unescapeHtml(input[0].match(/value="([^"]*)"/)?.[1] ?? ""),
    );
  }
  return fields;
}
