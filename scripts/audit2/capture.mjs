/**
 * AUDIT 2 — the capture harness. `node scripts/audit2/capture.mjs`
 *
 * Shoots every declared STATE of every screen — per identity that reaches it,
 * in both locales, both themes, at 1366 / 1440 / 375 — to `audit-shots/`
 * (gitignored), one deterministic filename per shot:
 *
 *   audit-shots/<identity>/<state>-<locale>-<theme>-<width>.png
 *
 * plus `audit-shots/manifest.jsonl`, one line per shot: HTTP status, final
 * URL, page height, and — when a state could not be reached — the NAMED
 * reason. A failed capture must never read as a fine screen (`WORKFLOW §34`'s
 * UNPROVEN discipline).
 *
 * Driven through `playwright-cli` (`@playwright/cli`), chosen over the
 * Playwright library and over Playwright MCP deliberately: screenshots and
 * snapshots go TO DISK, not into context, so an audit session can capture a
 * thousand states and read only the ones it inspects, and the daemon keeps
 * one warm browser per identity (`-s=<identity> open --persistent`) so each
 * identity signs in once and every later shot reuses the session.
 *
 * It drives the BUILT server (`npm run build && npx next start -p 3100`),
 * never `next dev`, and never port 3000: the compose app container publishes
 * `127.0.0.1:3000`, which out-specifies `next start`'s `0.0.0.0:3000` on
 * Windows — `§0`'s second shadow, recorded in `WORKFLOW §5`. Port 3100 has no
 * such holder, and EVERY shot re-asserts `location.host` before shooting, so
 * a stray absolute redirect (AUTH_URL still names :3000) cannot put another
 * server's screen into this audit's evidence.
 *
 * Needs: the db container up, `npm run seed:demo` run, DEV_FIXTURE_PASSWORD
 * and DATABASE_URL in `.env`. Record ids are discovered by SQL at start, so
 * the state list stays true after any re-seed.
 */

process.loadEnvFile(".env");

import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import postgres from "postgres";

const BASE = process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:3100";
const OUT = resolve("audit-shots");
const CLI = resolve("node_modules/@playwright/cli/playwright-cli.js");
const PASSWORD = process.env.DEV_FIXTURE_PASSWORD;
if (!PASSWORD) {
  console.error("Set DEV_FIXTURE_PASSWORD in .env — the fixture accounts' password.");
  process.exit(1);
}

const LOCALES = ["en", "ar"];
const THEMES = ["dark", "light"];
const WIDTHS = [
  { w: 1366, h: 768 },
  { w: 1440, h: 900 },
  { w: 375, h: 812 },
];

const IDENTITIES = {
  "rep-a": "rep-a@example.test",
  manager: "manager@example.test",
  coordinator: "coordinator@example.test",
  admin: "admin@example.test",
  executive: "executive@example.test",
};

/* ── Record ids, discovered rather than hardcoded ────────────────────────── */

async function discoverIds() {
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  const one = async (q) => (await q)[0]?.id ?? null;
  const repA = (await sql`select id from users where email = 'rep-a@example.test'`)[0].id;

  const ids = {
    companyFull: await one(sql`
      select c.id from companies c
        join company_reps cr on cr.company_id = c.id and cr.user_id = ${repA} and cr.removed_at is null
        left join rep_reports r on r.company_id = c.id
      where c.archived_at is null
      group by c.id order by count(r.id) desc limit 1`),
    companySparse: await one(sql`
      select c.id from companies c
        join company_reps cr on cr.company_id = c.id and cr.user_id = ${repA} and cr.removed_at is null
        left join rep_reports r on r.company_id = c.id
      where c.archived_at is null
      group by c.id order by count(r.id) asc, c.created_at desc limit 1`),
    contact: await one(sql`
      select ct.id from contacts ct
        join company_reps cr on cr.company_id = ct.company_id and cr.user_id = ${repA} and cr.removed_at is null
      order by ct.created_at desc limit 1`),
    projectFull: await one(sql`
      select p.id from projects p
        left join quotation_threads t on t.project_id = p.id
      where p.owner_user_id = ${repA} and p.end_state is null
      group by p.id order by count(t.id) desc limit 1`),
    projectSparse: await one(sql`
      select p.id from projects p
        left join quotation_threads t on t.project_id = p.id
      where p.owner_user_id = ${repA}
      group by p.id order by count(t.id) asc, p.created_at desc limit 1`),
    threadFull: await one(sql`
      select t.id from quotation_threads t
        join quotation_versions v on v.thread_id = t.id
      where t.raised_by_user_id = ${repA}
      group by t.id order by count(v.id) desc limit 1`),
    dispatchApproved: await one(sql`
      select d.id from dispatches d where d.user_id = ${repA} and d.status = 'approved'
      order by d.dispatch_date desc limit 1`),
    dispatchDraft: await one(sql`
      select d.id from dispatches d where d.status = 'draft' and d.user_id = ${repA}
      order by d.created_at desc limit 1`),
    dispatchRefused: await one(sql`
      select d.id from dispatches d where d.status = 'refused'
      order by d.created_at desc limit 1`),
    report: await one(sql`
      select r.id from rep_reports r where r.user_id = ${repA} and r.company_id is not null
      order by r.created_at desc limit 1`),
    comment: await one(sql`
      select c.id from comments c where c.author_user_id = ${repA}
      order by c.created_at desc limit 1`),
    userB: await one(sql`select id from users where email = 'rep-b@example.test'`),
    searchTerm: (await sql`
      select split_part(c.name, ' ', 1) as id from companies c
        join company_reps cr on cr.company_id = c.id and cr.user_id = ${repA} and cr.removed_at is null
        join rep_reports r on r.company_id = c.id
      group by c.name order by count(r.id) desc limit 1`)[0]?.id,
  };
  const version = ids.threadFull
    ? (await sql`
        select id from quotation_versions where thread_id = ${ids.threadFull}
        order by version_number desc limit 1`)[0]?.id
    : null;
  await sql.end();
  return { ...ids, version, repA };
}

/* ── The state list — the one readable declaration ───────────────────────── */

/**
 * A STATE, not a route: a list has many / searched / page two / searched-empty,
 * a form has empty / filled / invalid, a detail has full / sparse. `identities`
 * names who is expected to reach it — an identity that gets 404 is recorded as
 * such, which is `D53` behaving, and never silently dropped. A state whose id
 * came back null from discovery is emitted to the manifest as NOT-REACHED with
 * the reason `no such record in the seed`.
 *
 * `act` runs before the shot: `submit-empty` disables native validation and
 * submits, so the SERVER's error render is what is shot (a person reaches the
 * same render with any value that fails a server rule; native `required`
 * merely gets there first on the happy path); `fill-sample` types a bilingual
 * sample into every text control.
 *
 * True-empty lists are unreachable on a seeded database and are deliberately
 * absent: the searched-empty state is the reachable half of `D52`.
 */
function declareStates(ids) {
  return [
    { name: "login", path: "/login", identities: ["anon"] },
    { name: "login-invalid", path: "/login", identities: ["anon"], act: "login-bad" },

    { name: "dashboard", path: "/", identities: ["rep-a", "manager", "coordinator", "admin", "executive"] },

    { name: "companies-list-many", path: "/companies", identities: ["rep-a", "manager", "coordinator"] },
    { name: "companies-list-searched", path: `/companies?q=${encodeURIComponent(ids.searchTerm ?? "x")}`, identities: ["rep-a"] },
    { name: "companies-list-page2", path: "/companies?page=2", identities: ["rep-a"] },
    { name: "companies-list-searched-empty", path: "/companies?q=zzznothing", identities: ["rep-a"] },
    { name: "company-detail-full", path: ids.companyFull && `/companies/${ids.companyFull}`, identities: ["rep-a", "manager"] },
    { name: "company-detail-sparse", path: ids.companySparse && `/companies/${ids.companySparse}`, identities: ["rep-a"] },
    { name: "company-timeline", path: ids.companyFull && `/companies/${ids.companyFull}/timeline`, identities: ["rep-a"] },
    { name: "company-form-empty", path: "/companies/new", identities: ["rep-a"] },
    { name: "company-form-invalid", path: "/companies/new", identities: ["rep-a"], act: "submit-empty" },
    { name: "company-form-edit", path: ids.companyFull && `/companies/${ids.companyFull}/edit`, identities: ["rep-a"] },

    { name: "contacts-list-many", path: "/contacts", identities: ["rep-a", "coordinator"] },
    { name: "contact-detail", path: ids.contact && `/contacts/${ids.contact}`, identities: ["rep-a"] },
    { name: "contact-form-empty", path: "/contacts/new", identities: ["rep-a"] },

    { name: "projects-board-many", path: "/projects", identities: ["rep-a", "manager"] },
    { name: "projects-table-many", path: "/projects?view=table", identities: ["rep-a"] },
    { name: "projects-board-searched", path: `/projects?q=${encodeURIComponent(ids.searchTerm ?? "x")}`, identities: ["rep-a"] },
    { name: "project-detail-full", path: ids.projectFull && `/projects/${ids.projectFull}`, identities: ["rep-a", "coordinator"] },
    { name: "project-detail-sparse", path: ids.projectSparse && `/projects/${ids.projectSparse}`, identities: ["rep-a"] },
    { name: "project-timeline", path: ids.projectFull && `/projects/${ids.projectFull}/timeline`, identities: ["rep-a"] },
    { name: "project-form-empty", path: "/projects/new", identities: ["rep-a"] },
    { name: "project-form-edit", path: ids.projectFull && `/projects/${ids.projectFull}/edit`, identities: ["rep-a"] },

    { name: "quotations-list-many", path: "/quotations", identities: ["rep-a", "coordinator", "manager"] },
    { name: "quotations-list-page2", path: "/quotations?page=2", identities: ["rep-a"] },
    { name: "quotation-detail-full", path: ids.threadFull && `/quotations/${ids.threadFull}`, identities: ["rep-a", "coordinator"] },
    { name: "quotation-version", path: ids.threadFull && ids.version && `/quotations/${ids.threadFull}/versions/${ids.version}`, identities: ["rep-a"] },
    { name: "quotation-form-empty", path: "/quotations/new", identities: ["rep-a"] },
    { name: "quotation-form-invalid", path: "/quotations/new", identities: ["rep-a"], act: "submit-empty" },

    { name: "dispatches-list-many", path: "/dispatches", identities: ["rep-a", "coordinator", "manager"] },
    { name: "dispatch-detail-approved", path: ids.dispatchApproved && `/dispatches/${ids.dispatchApproved}`, identities: ["rep-a", "coordinator"] },
    { name: "dispatch-detail-draft", path: ids.dispatchDraft && `/dispatches/${ids.dispatchDraft}`, identities: ["rep-a"] },
    { name: "dispatch-detail-refused", path: ids.dispatchRefused && `/dispatches/${ids.dispatchRefused}`, identities: ["rep-a", "coordinator"] },
    { name: "dispatch-form-empty", path: "/dispatches/new", identities: ["rep-a"] },
    { name: "dispatch-form-edit", path: ids.dispatchDraft && `/dispatches/${ids.dispatchDraft}/edit`, identities: ["rep-a"] },

    { name: "log-form-empty", path: "/reports/new", identities: ["rep-a"] },
    { name: "log-form-filled", path: "/reports/new", identities: ["rep-a"], act: "fill-sample" },
    { name: "log-form-invalid", path: "/reports/new", identities: ["rep-a"], act: "submit-empty" },
    { name: "report-detail", path: ids.report && `/reports/${ids.report}`, identities: ["rep-a", "manager"] },
    { name: "report-edit", path: ids.report && `/reports/${ids.report}/edit`, identities: ["rep-a"] },

    { name: "activity-stream", path: "/activity", identities: ["rep-a", "manager"] },
    { name: "activity-by-rep", path: "/activity?view=by-rep", identities: ["manager"] },
    { name: "activity-filtered", path: "/activity?kind=typed", identities: ["manager"] },
    { name: "activity-searched", path: `/activity?q=${encodeURIComponent(ids.searchTerm ?? "x")}`, identities: ["rep-a"] },

    { name: "follow-ups-many", path: "/follow-ups", identities: ["rep-a", "manager"] },
    { name: "follow-ups-grouped", path: "/follow-ups?group=quotations", identities: ["rep-a"] },
    { name: "follow-ups-page2", path: "/follow-ups?page=2", identities: ["rep-a"] },

    { name: "targets", path: "/targets", identities: ["rep-a", "manager", "admin"] },

    { name: "users-list", path: "/users", identities: ["admin", "manager"] },
    { name: "user-detail", path: ids.userB && `/users/${ids.userB}`, identities: ["admin"] },
    { name: "user-form-empty", path: "/users/new", identities: ["admin"] },
    { name: "user-form-edit", path: ids.userB && `/users/${ids.userB}/edit`, identities: ["admin"] },
    { name: "user-handover", path: ids.userB && `/users/${ids.userB}/handover`, identities: ["admin"] },

    { name: "notifications", path: "/notifications", identities: ["rep-a"] },
    { name: "comment-edit", path: ids.comment && `/comments/${ids.comment}/edit`, identities: ["rep-a"] },
  ];
}

/* ── playwright-cli plumbing ─────────────────────────────────────────────── */

function cli(session, args, timeoutMs = 240_000) {
  return execFileSync(
    process.execPath,
    [CLI, `-s=${session}`, ...args],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs },
  );
}

/**
 * One run-code call per batch. The generated function logs in when the
 * persistent profile has no live session, then loops the batch: viewport,
 * theme cookie, goto, host guard, settle past `D17`'s 350ms fade, full-page
 * shot. It returns a JSON string of per-shot manifest entries.
 */
function runnerSource(identity, email, batch) {
  return `async page => {
  const BASE = ${JSON.stringify(BASE)};
  const results = [];
  const signIn = async () => {
    await page.goto(BASE + "/en/login", { waitUntil: "load" });
    if (!page.url().includes("/login")) return "already";
    await page.fill('input[name="email"]', ${JSON.stringify(email)});
    await page.fill('input[name="password"]', ${JSON.stringify(PASSWORD)});
    await Promise.all([
      page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 }),
      page.click('button[type="submit"]'),
    ]);
    return "fresh";
  };
  const hostOf = (u) => (u.match(/^https?:\\/\\/([^\\/]+)/) || [])[1];
  ${identity === "anon" ? "" : 'const signedIn = await signIn(); if (hostOf(page.url()) !== "127.0.0.1:3100") throw new Error("login left the audit server: " + page.url());'}
  for (const shot of ${JSON.stringify(batch)}) {
    const entry = { file: shot.file, state: shot.state, identity: ${JSON.stringify(identity)}, locale: shot.locale, theme: shot.theme, width: shot.width, url: shot.url };
    try {
      await page.setViewportSize({ width: shot.width, height: shot.height });
      await page.context().addCookies([{ name: "facet-theme", value: shot.theme, url: BASE }]);
      // "load", never "networkidle": the app router PREFETCHES every visible
      // link (?_rsc= requests) and on force-dynamic routes that traffic never
      // goes quiet, so networkidle timed out on exactly the link-heavy pages.
      let resp = await page.goto(shot.url, { waitUntil: "load", timeout: 30000 });
      // A signed-in state that lands on /login means the session died mid-batch
      // (it happened once: a submit-empty click hit the rail's sign-out form).
      // Recover rather than shooting the login page under the state's name.
      if (${JSON.stringify(identity !== "anon")} && page.url().includes("/login") && !shot.state.startsWith("login")) {
        await signIn();
        resp = await page.goto(shot.url, { waitUntil: "load", timeout: 30000 });
      }
      entry.status = resp ? resp.status() : null;
      await page.waitForTimeout(700);
      if (shot.act === "submit-empty") {
        // "main form" ONLY — a bare "form" fallback matched the rail's
        // sign-out form, which precedes <main> in DOM order, and signed the
        // whole batch out.
        await page.evaluate(() => {
          const f = document.querySelector("main form");
          if (f) f.noValidate = true;
        });
        const btn = page.locator('main form button[type="submit"]').first();
        await btn.click({ timeout: 5000 });
        await page.waitForTimeout(2500);
        entry.acted = "submit-empty";
      } else if (shot.act === "fill-sample") {
        await page.evaluate(() => {
          for (const el of document.querySelectorAll('form input[type="text"], form input:not([type]), form textarea')) {
            const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set;
            setter?.call(el, el.tagName === "TEXTAREA" ? "زار العميل المعرض وطلب عينات ACP بسماكة 4mm" : "شركة الاختبار Test Co 123");
            el.dispatchEvent(new Event("input", { bubbles: true }));
          }
        });
        await page.waitForTimeout(300);
        entry.acted = "fill-sample";
      } else if (shot.act === "login-bad") {
        await page.fill('input[name="email"]', "nobody@example.test");
        await page.fill('input[name="password"]', "wrong-password");
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2500);
        entry.acted = "login-bad";
      }
      const host = hostOf(page.url());
      if (host !== "127.0.0.1:3100") throw new Error("WRONG SERVER: landed on " + host);
      entry.finalUrl = page.url();
      const m = await page.evaluate(() => ({
        sh: document.documentElement.scrollHeight,
        dark: document.documentElement.classList.contains("dark"),
        dir: document.documentElement.getAttribute("dir"),
        lang: document.documentElement.getAttribute("lang"),
        title: document.title,
      }));
      Object.assign(entry, { scrollHeight: m.sh, viewportHeight: shot.height, darkClass: m.dark, dir: m.dir, lang: m.lang, title: m.title });
      try {
        await page.screenshot({ path: shot.file, fullPage: true, timeout: 20000 });
      } catch {
        // A named degradation beats a missing file: fall back to the viewport.
        await page.screenshot({ path: shot.file, timeout: 20000 });
        entry.partial = "viewport-only";
      }
      entry.ok = true;
    } catch (e) {
      entry.ok = false;
      entry.reason = String(e && e.message ? e.message : e).slice(0, 300);
    }
    results.push(entry);
  }
  return JSON.stringify(results);
}`;
}

/* ── Main ────────────────────────────────────────────────────────────────── */

const health = await fetch(`${BASE}/api/health`).catch(() => null);
if (!health || !health.ok) {
  console.error(`No healthy server at ${BASE} — start the BUILT app: npm run build && npx next start -p 3100`);
  process.exit(1);
}

const ids = await discoverIds();
let states = declareStates(ids);
/** Targeted re-run: AUDIT_ONLY / AUDIT_IDENTITIES append to the manifest. */
const only = process.env.AUDIT_ONLY?.split(",").filter(Boolean);
const onlyWho = process.env.AUDIT_IDENTITIES?.split(",").filter(Boolean);
/** `AUDIT_WIDTHS=1366` — a targeted re-shoot after a type or token change does
    not need all three, and `CLAUDE.md` says read the laptop width first. */
const onlyWidths = process.env.AUDIT_WIDTHS?.split(",").map(Number).filter(Boolean);
if (onlyWidths?.length) {
  const kept = WIDTHS.filter((size) => onlyWidths.includes(size.w));
  WIDTHS.length = 0;
  WIDTHS.push(...kept);
}
if (only?.length) states = states.filter((s) => only.includes(s.name));
if (onlyWho?.length)
  states = states
    .map((s) => ({ ...s, identities: s.identities.filter((i) => onlyWho.includes(i)) }))
    .filter((s) => s.identities.length);
mkdirSync(OUT, { recursive: true });
const manifestPath = join(OUT, "manifest.jsonl");
if (!only?.length && !onlyWho?.length) writeFileSync(manifestPath, "");

const genDir = join(tmpdir(), `audit2-runner-${process.pid}`);
mkdirSync(genDir, { recursive: true });

/** identity -> [{state, url, file, ...}] */
const plans = new Map();
let planned = 0;
for (const state of states) {
  for (const identity of state.identities) {
    if (!state.path) {
      appendFileSync(
        manifestPath,
        JSON.stringify({ state: state.name, identity, ok: false, reason: "NOT-REACHED: no such record in the seed (id discovery returned null)" }) + "\n",
      );
      continue;
    }
    const list = plans.get(identity) ?? [];
    for (const locale of LOCALES) {
      for (const theme of THEMES) {
        for (const { w, h } of WIDTHS) {
          const localePath = `/${locale}${state.path === "/" ? "" : state.path}`;
          list.push({
            state: state.name,
            act: state.act,
            url: `${BASE}${localePath}`,
            file: join(OUT, identity, `${state.name}-${locale}-${theme}-${w}.png`).replaceAll("\\", "/"),
            locale, theme, width: w, height: h,
          });
          planned += 1;
        }
      }
    }
    plans.set(identity, list);
  }
}

console.log(`Planned ${planned} shots across ${states.length} states, ${plans.size} identities -> ${OUT}`);

let done = 0, okCount = 0, failCount = 0;
for (const [identity, shots] of plans) {
  mkdirSync(join(OUT, identity), { recursive: true });
  const email = IDENTITIES[identity];
  console.log(`\n=== ${identity} (${shots.length} shots) ===`);
  cli(identity, ["open", "--persistent"]);
  try {
    const BATCH = 24;
    for (let i = 0; i < shots.length; i += BATCH) {
      const batch = shots.slice(i, i + BATCH);
      const src = runnerSource(identity, email, batch);
      const file = join(genDir, `${identity}-${i}.js`);
      writeFileSync(file, src);
      const out = cli(identity, ["--raw", "run-code", `--filename=${file}`], 900_000);
      rmSync(file, { force: true });
      // `--raw` prints the function's return value JSON-encoded once, so a
      // returned JSON string arrives double-encoded: parse twice.
      const entries = JSON.parse(JSON.parse(out.trim()));
      for (const entry of entries) {
        appendFileSync(manifestPath, JSON.stringify(entry) + "\n");
        done += 1;
        if (entry.ok) okCount += 1;
        else { failCount += 1; console.log(`  FAIL ${entry.state} ${entry.locale}/${entry.theme}/${entry.width}: ${entry.reason}`); }
      }
      console.log(`  ${done}/${planned} (${okCount} ok, ${failCount} failed)`);
    }
  } finally {
    try { cli(identity, ["close"]); } catch { /* daemon already gone */ }
  }
}

rmSync(genDir, { recursive: true, force: true });
console.log(`\nCapture complete: ${okCount} ok, ${failCount} failed, of ${planned} planned. Manifest: ${manifestPath}`);
