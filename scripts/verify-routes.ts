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
 *   9. The comment box `S114` `D48` posts for real, and its cap refuses rather
 *      than 500s — the one assertion of `readFields`' shape validation
 *      anywhere, because no in-process script crosses the action boundary.
 *  10. The sharing panel `S96` `S99` `S100` grants and revokes for real, and
 *      the rep who may not share is not offered the form.
 *  11. The next follow-up date `OPEN — no rule` is set and cleared for real, over
 *      HTTP, in both locales — the manual date that outranks the automatic
 *      clock, replayed the same way section 7 replays a lost project.
 *  12. No screen renders anything shaped like an unresolved message key.
 *  13. Registering a company replays `S13`, `S14`, `S15`: a POST with no phone
 *      is refused as a message rather than a 500; no form asks for a region at
 *      all; and the same payload sent twice — differing only in country — is
 *      REFUSED for Saudi Arabia, which needs a city, and accepted with neither
 *      city nor region for anywhere else.
 *  14. `S50` and `S74`, end to end: a quotation is raised with **no project**,
 *      paid, and dispatched — the coordinator choosing a project, which is
 *      written back onto the quotation and puts the quotation's company on
 *      that project as a participant carrying a dispatched figure `S26`. Then
 *      the other branch on the same thread: dispatching again takes the
 *      project it gained, and naming a different one is refused as a message.
 *      `S118` rides along on the same form: the stock is posted, refused when
 *      cleared, and read back off the detail screen in both locales.
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
 * This was 11 sections until feature slice 6: the old item 11 (the
 * message-key scan) is now section 12, and section 11 above — the
 * follow-up-date replay — existed in the code for a phase but was never
 * added to this list. Not a renumbering; a correction `[26 §4]`.
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
 * with `VERIFY_BASE_URL`.
 *
 * **Assert on DOM markers, never on translated strings** `[23]`: next-intl
 * ships the whole catalogue to every page, so a string grep proves nothing —
 * it matches the message bundle whether or not the screen rendered it.
 *
 * **Assert the 200, not merely the absence of a 500** `[23]`. Three of stage
 * 1's "failures" were wrong expectations rather than bugs: `/dispatches/new`
 * 404s for a rep AND a manager, because `can_dispatch` belongs to the
 * coordinator and the super admin; a manager 404s on a report's edit screen,
 * because only the author may edit `S39`; and a rep's empty lists yield no
 * id to follow, which is a legitimate empty state rather than a broken link.
 */

import { readFileSync, statSync } from "node:fs";

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
      return { status: followed.status, body, url: next };
    }
  }
  const body = await response.text();
  // **Every page this script touches is scanned**, rather than a chosen few:
  // the fetch is the one choke point, and the failure it guards against does
  // not announce itself on the screen you thought to check.
  scanForUnresolvedKeys(path, body);
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
  "/reports",
  "/reports/new",
  "/activity",
  "/follow-ups",
  "/notifications",
  "/targets",
  "/performance",
  "/users",
  "/users/new",
] as const;

/**
 * Routes a given role legitimately does NOT have. Asserting only the 404 would
 * pass on a broken route, so every one of these is asserted as a 200 by the
 * identity that does hold it.
 */
const FORBIDDEN: Record<string, readonly string[]> = {
  "rep-a@example.test": ["/dispatches/new", "/users", "/users/new"],
  "manager@example.test": ["/dispatches/new"],
  // A project needs a company `S27` and a contact belongs to one `[07 A2]`,
  // and the coordinator holds none — so both forms are `D53` 404s for them,
  // and `S76` made the lists behind them worth reading anyway.
  "coordinator@example.test": [
    "/users",
    "/users/new",
    "/projects/new",
    "/contacts/new",
  ],
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
 * rows on every list; a coordinator's `/companies` and `/performance` are
 * legitimately empty — they see quotation threads and company NAMES, not
 * company records `[18 §2]`. So a list card that is absent there is the empty
 * state working, not a missing frame, and asserting it for everyone turns a
 * correct screen into a red line.
 *
 * `S76` moved the line without erasing it: the coordinator now reads projects
 * and contacts in full, so `/projects` and `/contacts` are no longer empty for
 * them — section 14 asserts that directly — while `/companies` still is.
 */
const MARKERS: Record<string, readonly string[]> = {
  "/": ['data-slot="today-queue"', 'data-slot="today-waiting"'],
  "/companies": ['data-slot="list-card"', 'data-slot="table-head"'],
  "/quotations": ['data-slot="list-card"'],
  // One name field `S12` — the input is `name`, not a locale-suffixed pair.
  // `countryId` is `S14`; section 13 asserts it sits before the city.
  "/companies/new": [
    'data-slot="form-shell"',
    'name="name"',
    'name="countryId"',
  ],
  "/reports/new": ['data-slot="form-shell"'],
  // `/coverage` carried this marker until feature slice 6 moved the table
  // it comes from onto `/performance` and deleted the route `[26 §2]`.
  "/performance": ['data-slot="turn"'],
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
 * The five kinds `comments_record_type` admits, by list section.
 *
 * **This is five and `S114` says two.** `S114` and `D48` put comments on
 * quotation threads and projects ONLY — never a company, contact or dispatch.
 * The CHECK, the screens and this walk all predate them and none has caught
 * up. Recorded in `WORKFLOW.md` §5; session 14 narrows it and deletes what is
 * below. Cited here so the gap is legible rather than silent.
 *
 * `reports` and `users` are absent because they are not commentable — a report
 * is already somebody's words, and a colleague is not a record.
 */
const COMMENTABLE = new Set([
  "companies",
  "contacts",
  "projects",
  "quotations",
  "dispatches",
]);

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
    const list = await get(jar, `/en/${section}`);
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
        // Every one of the five detail screens offers the box. This is the
        // assertion that would have caught the three screens that had no
        // timeline to hang it on — and, since `S114` and `D48` allow only two
        // of the five, the assertion session 14 has to invert.
        if (COMMENTABLE.has(section)) {
          const offered =
            body.includes('data-slot="comment-composer"') &&
            body.includes('name="body"');
          check(
            readOnly
              ? `  ${path} offers NO comment box — read, not write [S76] [D51]`
              : `  ${path} offers the comment box [S114] [D48]`,
            readOnly ? !offered : offered,
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
      if (!otherReasonId || !nonOtherReasonId) continue;

      /** The action envelope plus the fields a browser would send. */
      const fieldsFor = (
        endState: string,
        lostReasonId: string,
        lossReason: string,
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
        // `readFields` requires the project's `nameEn` and nothing else here.
        // Projects keep a name pair; only companies and contacts lost theirs
        // `S12` `S19`. The rest are sent empty, exactly as an untouched form
        // would send them.
        fields.set("nameEn", nameOf(page.body) ?? "Project");
        fields.set("nameAr", "");
        fields.set("sqmExpected", "");
        fields.set("cityId", "");
        // No `region`: the project form no longer renders one, so an untouched
        // form sends none `D51`. The city is still sent, because that control
        // is still there and what it posts is still stored.
        fields.set("endState", endState);
        fields.set("lostReasonId", lostReasonId);
        fields.set("lossReason", lossReason);
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
    }
  }

  console.log("\n8. The chain strip, on both screens that draw it");
  {
    // **The two screens are asserted TOGETHER**, which is the only way to make
    // the project half mean anything: reading `data-position` off the
    // quotation's own strip says whether that thread is live, and a live
    // thread obliges the project behind it to draw something. Asserting the
    // project screen on its own would be a tautology — it renders the card
    // only when it has a thread to render it for.
    //
    // **It walks until it has seen each SHAPE once, not each row.** The strip
    // has a shape per chain position and the project half has two — the strip
    // for a single live thread, `25 §22`'s flag as soon as there are two — and
    // which of them the first row reaches is an accident of the data. Twenty-
    // five identical assertions prove nothing the first one did not, and the
    // interesting ones (a `closed` thread, a `dispatched` one) can sort well
    // past page 1. So it pages, and asserts a shape the first time it meets it.
    const jar = jars["manager@example.test"];
    const PAGES = 4;
    const shapes = new Set<string>();
    const seen = { strip: 0, many: 0, closed: 0 };

    for (const locale of ["en", "ar"] as const) {
      let found = 0;

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

        for (const id of ids) {
          const thread = await get(jar, `/${locale}/quotations/${id}`);
          const strip = stripOf(thread.body);
          if (!strip) {
            // Every thread has a chain position, so this is a real failure
            // rather than a shape not worth repeating.
            check(`${locale} ${id.slice(0, 8)}: the quotation draws the strip`, false);
            continue;
          }

          const projectId = firstId(thread.body, "projects");
          const project = projectId
            ? await get(jar, `/${locale}/projects/${projectId}`)
            : null;
          const projectStrip = project ? stripOf(project.body) : null;
          const many = project?.body.includes('data-slot="chain-many"') ?? false;
          const half = projectStrip ? "strip" : many ? "flag" : "none";

          if (projectStrip) seen.strip += 1;
          else if (many) seen.many += 1;
          if (strip.position === "closed") seen.closed += 1;

          const shape = `${locale} ${strip.position}/${half}`;
          if (shapes.has(shape)) continue;
          shapes.add(shape);

          const label = `${shape} (${id.slice(0, 8)})`;
          // Six nodes, one per `25 §3` column. A dropped column fails here.
          check(`${label}: six steps`, strip.steps.length === 6, `got ${strip.steps.length}`);
          // **A node is ringed only while someone owes it** — so a dispatched
          // thread rings none, and a closed one rings none either, showing
          // instead where it stopped.
          const now = strip.steps.filter((state) => state === "now").length;
          const owed =
            strip.position !== "closed" && strip.position !== "dispatched";
          check(`  it rings ${owed ? "one" : "no"} node`, now === (owed ? 1 : 0), `got ${now}`);
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

          if (strip.position === "closed") {
            // `S62` ends a thread at accepted, rejected or cancelled — `S67`
            // took expiry out of that set, so a closed strip is one of three; the
            // project behind it has no live thread on this account, so the
            // project half is not this thread's to prove.
            continue;
          }
          if (!projectId) {
            // Every identity that reaches a thread with a project may now open
            // it — the coordinator too, since `S76`. No project on the thread
            // is the only reason left to skip `S50`.
            console.log(`  skip  ${label}: links no project`);
            continue;
          }
          check(
            "  its project draws the chain",
            projectStrip !== null || many,
            `status ${project?.status}`,
          );
          if (projectStrip) {
            check(
              "    six steps there too",
              projectStrip.steps.length === 6,
              `got ${projectStrip.steps.length}`,
            );
          } else if (many) {
            // `25 §22`'s flag is the count AND the figures behind it.
            check(
              "    the flag carries its figures",
              project?.body.includes('data-slot="chain-many-figures"') ?? false,
            );
          }
        }
      }

      if (found === 0) {
        // `verify:slice2` is what creates threads; without it there is nothing
        // to walk, and that is a missing precondition rather than a failure.
        console.log(`  skip  ${locale}: no quotation thread to drive`);
      }
    }

    // **No silent coverage.** Which shapes exist at all depends on the fixture
    // data, so what was actually reached is printed rather than assumed.
    console.log(
      `  --    reached ${seen.strip} project strip(s), ${seen.many} flag(s), ` +
        `${seen.closed} closed thread(s)`,
    );
    for (const [what, count] of [
      ["a single-thread project (the strip)", seen.strip],
      ["a multi-thread project (`25 §22`'s flag)", seen.many],
      ["a closed thread", seen.closed],
    ] as const) {
      if (count === 0) {
        console.log(
          `  --    NOTE: this data never reached ${what} — that branch is unproven by this run.`,
        );
      }
    }
  }

  // `S114` and `D48` govern; the screens this drives are wider than either
  // allows — see the note above COMMENTABLE.
  console.log("\n9. The comment box, posted for real [S114] [D48]");
  {
    // **`verify:comments` drives `addComment`; this drives the FORM.** The two
    // do not overlap: the in-process script never touches `readFields`, the
    // action, the chip picker's repeated `mentions` values or the body cap —
    // and the cap is shape validation, so the action is the only place it
    // lives. That boundary is where slices 2 and 3 replayed a POST by hand and
    // threw the replay away `[23]`; this one is kept.
    for (const locale of ["en", "ar"] as const) {
      const jar = jars["rep-a@example.test"];
      const list = await get(jar, `/${locale}/companies`);
      const id = firstId(list.body, "companies");
      if (!id) {
        console.log(`  --    ${locale}: rep-a holds no company to comment on`);
        continue;
      }

      const page = await get(jar, `/${locale}/companies/${id}`);
      check(
        `${locale}: the company screen carries the composer [S114] [D48]`,
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

      const envelope = (): FormData => {
        const fields = new FormData();
        for (const input of form.matchAll(/<input[^>]*>/g)) {
          const name = input[0].match(/name="([^"]+)"/)?.[1];
          if (!name?.startsWith("$ACTION")) continue;
          // HTML-unescaped, for the reason section 7 records: a bound action's
          // envelope carries JSON, and replaying `&quot;` verbatim reads as a
          // stale deployment that is not one.
          fields.append(
            name,
            unescapeHtml(input[0].match(/value="([^"]*)"/)?.[1] ?? ""),
          );
        }
        return fields;
      };

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

      const good = envelope();
      good.set("body", `verify-routes ${locale} comment`);
      const posted = await post(good);
      check(
        `${locale}: *** posting a comment answers 200, not 500 *** [S114]`,
        posted === 200,
        `got ${posted}`,
      );

      const after = await get(jar, `/${locale}/companies/${id}`);
      check(
        `${locale}: the comment is on the record's thread [S114]`,
        after.body.includes('data-slot="comment"'),
      );

      // **The cap** `S114`. It is `readFields` shape validation, so nothing
      // in process crosses it — this is the only assertion of it anywhere. A
      // 200 carrying the error is the correct answer; a 500 is the defect.
      const tooLong = envelope();
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
      const envelopeOf = (form: string): FormData => {
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

  // `OPEN — no rule`: nothing in SPEC or DESIGN covers a manually set next
  // follow-up date; archived as `[25 §18]`. `S91` may delete the machinery
  // outright in the waiting-list rebuild.
  console.log("\n11. The next follow-up date, set and cleared for real [OPEN — no rule]");
  {
    // **`verify:followups` drives `setNextFollowUp`; this drives the FORM.**
    // The two do not overlap: the in-process script never touches
    // `readFields`, the bound `$ACTION` envelope, or the native date input —
    // and the panel is on three screens, so a marker check on each is the only
    // thing that catches one wired up wrong.
    const jar = jars["manager@example.test"];

    const envelopeOf = (form: string): FormData => {
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
    // **The city is out of reach here, deliberately.** It is a `Combobox` in a
    // Radix portal, so its options are not in the server HTML and this script
    // has no city id to post. `verify:schema25` §10 proves the positive half in
    // process, where one is a query away.
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
          "vatNumber",
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
    "\n14. A quotation with no project, dispatched into one [S50], [S74]",
  );
  {
    // **The one chain no in-process script can drive.** `verify:slice3` §15
    // proves S74's rules against the data layer; this proves the SCREENS —
    // that a rep can raise a quotation with the project field left alone, that
    // the coordinator is offered a picker for exactly that quotation and not
    // for the others, and that what comes back names the project on three
    // screens: the dispatch, the quotation, and the project's participants.
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

      /**
       * POST a form whose response this script deliberately does not wait for.
       *
       * **`confirmPaymentAction` never answers a raw form POST**, and that is
       * neither this slice's doing nor a rule this section is about: the same
       * request stalls identically on a quotation that has a project, on a
       * build with none of S50 or S74 in it, and on the comment composer's
       * neighbour it does not stall at all. The write lands — the row is
       * updated, and the page renders in 150ms afterwards — so what is broken
       * is the response to the no-JavaScript path of that one action.
       *
       * So the POST is really sent, and what follows asserts the STATE it
       * produced rather than the answer it did not give. Left as a plain
       * check below, not swallowed: if the payment ever fails to land, the
       * next assertion says so.
       */
      const fireAndForget = async (jar: Jar, path: string, body: FormData) => {
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), 5000);
        try {
          const response = await fetch(`${BASE}${path}`, {
            method: "POST",
            headers: { cookie: header(jar), origin: BASE },
            body,
            redirect: "manual",
            signal: abort.signal,
          });
          store(jar, response);
        } catch {
          // The stall described above. The GET that follows is the assertion.
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
      // `S15` — a Saudi company needs a city, and the combobox does not put one
      // in the HTML. Section 13 owns the refusal; this section only needs a
      // company, so it takes an id from the database rather than proving
      // anything about how it got there.
      const cityId = await aCityId();
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
        "vatNumber",
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

      /* --- 1. raised with NO project [S50] ------------------------------ */

      const newQuotation = await get(repJar, `/${locale}/quotations/new`);
      const quotationForm = newQuotation.body.match(
        /<form[^>]*data-slot="form-shell"[\s\S]*?<\/form>/,
      )?.[0];
      check(
        `${locale}: the quotation form renders`,
        Boolean(quotationForm) && newQuotation.status === 200,
      );
      if (!quotationForm || !companyId) continue;

      // `S50` — the company list is no longer the chosen project's links, so
      // the company registered a moment ago is selectable with no project at
      // all. That it is IN the markup is the form half of the rule.
      check(
        `${locale}: the new company is offered with no project chosen [S50]`,
        quotationForm.includes(`value="${companyId}"`),
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
      // **The project is sent EMPTY**, exactly as an untouched form sends it:
      // the combobox posts a hidden input whose value is "" until somebody
      // picks something. This is the POST S50 exists for.
      quotationFields.set("projectId", "");
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

      const raised = await post(
        repJar,
        `/${locale}/quotations/new`,
        quotationFields,
      );
      check(
        `${locale}: *** raising a quotation with NO project answers 303 *** [S50]`,
        raised.status === 303,
        `got ${raised.status} ${raised.location}`,
      );
      if (raised.status !== 303) continue;

      const threadPath = raised.location.replace(BASE, "");
      const threadId = threadPath.match(/[0-9a-f-]{36}/)?.[0] as string;

      /* --- 2. and it READS as absent, not as a blank -------------------- */

      const thread = await get(repJar, threadPath);
      check(
        `${locale}: *** the missing project reads as deliberately absent *** [S50]`,
        factHtmlOf(thread.body, "project").includes('data-slot="fact-absent"'),
        factOf(thread.body, "project"),
      );
      // Not the em-dash every other empty value uses, which is the whole
      // distinction: "nothing here" against "nobody has answered this yet".
      check(
        `${locale}: …and not as the em-dash an empty value takes`,
        factOf(thread.body, "project") !== DASH,
      );

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

      /* --- 3. paid, so it can be dispatched [S73] ----------------------- */

      const paymentForm = thread.body.match(
        /<form[^>]*>(?:(?!<\/form>)[\s\S])*?name="confirmedOn"[\s\S]*?<\/form>/,
      )?.[0];
      check(`${locale}: the payment form is on the rep's screen`, Boolean(paymentForm));
      if (!paymentForm) continue;
      const paymentFields = envelope(paymentForm);
      paymentFields.set("confirmedOn", "2026-08-18");
      await fireAndForget(repJar, threadPath, paymentFields);

      // What the POST actually did, read back off the screen: the form is
      // offered only while the payment is unconfirmed, so its absence is the
      // confirmation — and the chain strip agrees, at `paid` `D27` `D29`.
      const paid = await get(repJar, threadPath);
      check(
        `${locale}: the rep's payment POST confirmed it [S73]`,
        !paid.body.includes('name="confirmedOn"') &&
          stripOf(paid.body)?.position === "paid",
        `chain reads ${stripOf(paid.body)?.position ?? "nothing"}`,
      );

      /* --- 3b. paid is not enough: it must be ISSUED [S126] ------------- */

      // The picker is the first half of the rule: what the action refuses is
      // never offered. `S126` narrowed `listDispatchableThreads` from the live
      // version to the issued one, so a paid thread still being edited `S61`
      // drops out of it.
      const beforeIssue = await get(coordJar, `/${locale}/dispatches/new`);
      check(
        `${locale}: *** a paid but UNISSUED quotation is not offered *** [S126]`,
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
      await fireAndForget(coordJar, threadPath, issueFields);

      /* --- 4. the coordinator's form marks it as having no project ------ */

      const dispatchNew = await get(coordJar, `/${locale}/dispatches/new`);
      const option = dispatchNew.body.match(
        new RegExp(`<option[^>]*value="${threadId}"[^>]*>`),
      )?.[0];
      check(
        `${locale}: the paid, project-less quotation is offered for dispatch [S74]`,
        Boolean(option),
        "not in the list — did the payment POST fail?",
      );
      check(
        `${locale}: …and is marked as carrying no project of its own [S50]`,
        option?.includes('data-project=""') ?? false,
        option ?? "",
      );

      /* --- 5. dispatched, choosing one of rep-a's projects [S74] -------- */

      const projectsList = await get(repJar, `/${locale}/projects`);
      const projectIds = [
        ...new Set(
          [
            ...projectsList.body.matchAll(
              /href="\/(?:en|ar)\/projects\/([0-9a-f-]{36})"/gi,
            ),
          ].map((match) => match[1]),
        ),
      ];
      if (projectIds.length === 0) {
        // A rep with no project is a legitimate empty state; without one there
        // is nothing for the write-back to write.
        console.log(`  --    ${locale}: rep-a owns no project to dispatch into`);
        continue;
      }
      const projectId = projectIds[0];

      const dispatchForm = dispatchNew.body.match(
        /<form[^>]*data-slot="form-shell"[\s\S]*?<\/form>/,
      )?.[0];
      if (!dispatchForm) {
        check(`${locale}: the dispatch form renders`, false);
        continue;
      }
      const dispatchFields = (project: string): FormData => {
        const fields = envelope(dispatchForm);
        fields.set("quotationThreadId", threadId);
        fields.set("projectId", project);
        // `S116` — **no `sqm` field is posted, because the form offers none.**
        // The square metres are the lines', generated by the database. Section
        // 12 asserts the input is gone rather than trusting that it is.
        fields.set("dispatchDate", "2026-08-18");
        for (const [name, value] of Object.entries(dispatchLine)) {
          fields.set(name, value);
        }
        return fields;
      };

      const dispatched = await post(
        coordJar,
        `/${locale}/dispatches/new`,
        dispatchFields(projectId),
      );
      check(
        `${locale}: *** dispatching it answers 303 *** [S74]`,
        dispatched.status === 303,
        `got ${dispatched.status} ${dispatched.location}`,
      );
      if (dispatched.status !== 303) continue;

      const dispatchPath = dispatched.location.replace(BASE, "");
      const dispatchPage = await get(coordJar, dispatchPath);

      // `S116` — the lines landed and the screen shows them. A DOM marker,
      // never the rendered numbers: what is asserted is that the dispatch
      // carries its own lines, and one row is one line.
      const lineRows = [
        ...dispatchPage.body.matchAll(/data-line="[0-9a-f-]{36}"/g),
      ];
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

      /* --- 6. written back onto the quotation [S74] --------------------- */

      const rewritten = await get(repJar, threadPath);
      check(
        `${locale}: *** the quotation now names that project *** [S74]`,
        !factHtmlOf(rewritten.body, "project").includes('data-slot="fact-absent"'),
        factOf(rewritten.body, "project"),
      );
      check(
        `${locale}: …and it links the project the dispatch took`,
        rewritten.body.includes(`/projects/${projectId}"`),
      );

      /* --- 7. the company is a participant, with the derived figure ----- */

      const project = await get(repJar, `/${locale}/projects/${projectId}`);
      check(
        `${locale}: *** the quotation's company joined the project *** [S74], [S27]`,
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

      /* --- 8. the other branch, on the same thread [S74] ---------------- */

      // It has a project now, so a second dispatch takes it with nothing
      // chosen — the "shown, not chosen" half of the rule.
      const again = await post(
        coordJar,
        `/${locale}/dispatches/new`,
        dispatchFields(""),
      );
      check(
        `${locale}: dispatching it again takes the project it gained [S74]`,
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
      const otherId =
        projectIds[1] ?? "00000000-0000-0000-0000-000000000000";
      console.log(
        projectIds[1]
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
      check(
        `the coordinator's /${section} is no longer empty [S76]`,
        list.body.includes('data-slot="list-card"'),
        `status ${list.status}`,
      );
      // `D51` — a New button that always fails is not rendered. The
      // coordinator holds no company, and both records need one. Section 2
      // already asserts the 404 behind it, from `FORBIDDEN`; this is the
      // control, which is the half a route check cannot see.
      check(
        `…and offers them no New button, which would refuse [D51]`,
        !list.body.includes(`/en/${section}/new"`),
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
      check(
        "the participants render for the coordinator — what S76 is for [S26]",
        asCoordinator.body.includes("data-participant="),
      );
    }
  }
}

/**
 * Any seeded city's id, read straight from Postgres.
 *
 * `S15` makes the city mandatory for a Saudi company, and the city control is
 * a `Combobox` in a Radix portal — its options are not in the server HTML, so
 * a black-box POST has no id to send. Section 14 needs a Saudi company to hang
 * a quotation on, so it needs one id.
 *
 * Read over the driver in raw SQL: this is fixture setup, not an assertion, so
 * nothing about what the section proves depends on where it came from. **This
 * file still never imports `src/`.**
 *
 * Section 13 deliberately does NOT use it. Its subject is what a browser can
 * post, and a browser without a city id is precisely the case `S15` must
 * refuse.
 */
async function aCityId(): Promise<string | null> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1 });
  try {
    const rows = await sql`select id from cities order by name_en limit 1`;
    return (rows[0]?.id as string | undefined) ?? null;
  } finally {
    await sql.end({ timeout: 5 });
  }
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
 * VALUE. `S50`'s absent project is asserted on a marker inside the cell
 * instead — the difference between "deliberately not there yet" and an
 * em-dash is a `data-slot`, not a string this script may read.
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
    .match(/<input[^>]*name="nameEn"[^>]*>/)?.[0]
    .match(/value="([^"]*)"/)?.[1];
  return value === undefined ? undefined : unescapeHtml(value);
}

main()
  .then(() => {
    console.log(
      failures === 0
        ? `\nAll ${checks} checks passed.`
        : `\n${failures} of ${checks} CHECK(S) FAILED.`,
    );
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
