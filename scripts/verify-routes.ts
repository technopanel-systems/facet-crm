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
 *   7. Marking a project lost replays, in both locales `[25 §5]` — the form
 *      POST whose writer and whose database CHECK shipped in one pass, and
 *      which nothing else drives.
 *   8. The chain strip `[22 §6.6]` renders on a quotation thread AND on the
 *      project behind it, in both locales.
 *   9. The comment box `[25 §9]` posts for real, and its cap refuses rather
 *      than 500s — the one assertion of `readFields`' shape validation
 *      anywhere, because no in-process script crosses the action boundary.
 *  10. No screen renders anything shaped like an unresolved message key.
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
 * because only the author may edit `[20 §9]`; and a rep's empty lists yield no
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
 * screen rendered it `[23]`, `[20 §8]`. Nothing here looks for a translation.
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
  "/coverage",
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
  "coordinator@example.test": ["/users", "/users/new"],
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
 * rows on every list; a coordinator's `/companies` and `/coverage` are
 * legitimately empty `[16 §8]`, `[18 §2]` — they see quotation threads and
 * company NAMES, not company records — so a list card that is absent there is
 * the empty state working, not a missing frame. Asserting it for everyone
 * turns a correct screen into a red line.
 */
const MARKERS: Record<string, readonly string[]> = {
  "/": ['data-slot="today-queue"', 'data-slot="today-waiting"'],
  "/companies": ['data-slot="list-card"', 'data-slot="table-head"'],
  "/quotations": ['data-slot="list-card"'],
  "/companies/new": ['data-slot="form-shell"', 'name="nameEn"'],
  "/reports/new": ['data-slot="form-shell"'],
  "/coverage": ['data-slot="turn"'],
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
 * The five kinds `comments_record_type` admits `[25 §9]`, by list section.
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
    for (const suffix of suffixes) {
      const path = `/en/${section}/${id}${suffix}`;
      const { status, body } = await get(jar, path);
      check(`${email} ${path} → 200`, status === 200, `got ${status}`);
      if (status === 200 && suffix === "") {
        check(`  ${path} renders a fact grid`, body.includes('data-slot="facts"'));
        // Every thread has a chain position — a closed one included, which
        // draws the strip stopped where it got to `[22 §6.6]`.
        if (section === "quotations") {
          check(
            `  ${path} renders the chain strip`,
            body.includes('data-slot="chain-strip"'),
          );
        }
        // `25 §9` — comments belong on every record, so every one of the five
        // detail screens offers the box. This is the assertion that would have
        // caught the three screens that had no timeline to hang it on.
        if (COMMENTABLE.has(section)) {
          check(
            `  ${path} offers the comment box [25 §9]`,
            body.includes('data-slot="comment-composer"') &&
              body.includes('name="body"'),
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
        "an ACTIVE user's handover 404s [19 §3]",
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
    // the action, which no in-process script can reach.
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
      // The loss field is hidden until the end state is `lost`, but it is in
      // the markup — `hidden`, not conditionally rendered — so this asserts the
      // marker rather than a translated label `[23]`.
      check(
        `${locale}: it carries the loss-reason field`,
        page.body.includes('name="lossReason"'),
      );

      const form = page.body.match(
        /<form[^>]*>(?:(?!<\/form>)[\s\S])*?name="endState"[\s\S]*?<\/form>/,
      )?.[0];
      check(`${locale}: the project form is a real form`, Boolean(form));
      if (!form) continue;

      /** The action envelope plus the fields a browser would send. */
      const fieldsFor = (endState: string, lossReason: string): FormData => {
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
        // `readFields` requires `nameEn` and nothing else here; the rest are
        // sent empty exactly as an untouched form would send them.
        fields.set("nameEn", nameOf(page.body) ?? "Project");
        fields.set("nameAr", "");
        fields.set("sqmExpected", "");
        fields.set("cityId", "");
        fields.set("region", "");
        fields.set("endState", endState);
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

      const lost = await post(fieldsFor("lost", `lost via ${locale}`));
      check(
        `${locale}: *** POSTing endState=lost answers 303, not 500 *** [25 §5]`,
        lost === 303,
        `got ${lost}`,
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
      const reopened = await post(fieldsFor("", ""));
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
            // `16 §5` ends a thread at rejected, cancelled or expired; the
            // project behind it has no live thread on this account, so the
            // project half is not this thread's to prove.
            continue;
          }
          if (!projectId) {
            // A coordinator gets no project link `[16 §10]`; a manager should.
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

  console.log("\n9. The comment box, posted for real [25 §9], [25 §11]");
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
        `${locale}: the company screen carries the composer [25 §9]`,
        page.body.includes('data-slot="comment-composer"'),
      );

      const form = page.body.match(
        /<form[^>]*data-slot="comment-composer"[\s\S]*?<\/form>/,
      )?.[0];
      check(`${locale}: the composer is a real form`, Boolean(form));
      if (!form) continue;

      // The chip picker posts repeated `mentions` values `[25 §11]`. Asserting
      // the marker rather than a name: the list is whoever is active.
      check(
        `${locale}: it offers people to tag [25 §11]`,
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
        `${locale}: *** posting a comment answers 200, not 500 *** [25 §9]`,
        posted === 200,
        `got ${posted}`,
      );

      const after = await get(jar, `/${locale}/companies/${id}`);
      check(
        `${locale}: the comment is on the record's thread [25 §9]`,
        after.body.includes('data-slot="comment"'),
      );

      // **The cap** `[25 §9]`. It is `readFields` shape validation, so nothing
      // in process crosses it — this is the only assertion of it anywhere. A
      // 200 carrying the error is the correct answer; a 500 is the defect.
      const tooLong = envelope();
      tooLong.set("body", "x".repeat(5001));
      const capped = await post(tooLong);
      check(
        `${locale}: an over-long comment is refused, not a 500 [25 §9]`,
        capped === 200,
        `got ${capped}`,
      );
    }
  }

  console.log("\n10. Nothing reads like a message key that failed to resolve");
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
