/**
 * Session-51 shot runner for the overseer Today tab (session 53: every shot
 * also reports the top and height of the dashboard's cards as `boxes`, so a
 * built screen can be measured against a drawing without a second script) —
 * capture.mjs's
 * mechanics (persistent per-identity sessions, form login, theme cookie,
 * host assert, wait on `load` never `networkidle`) over an explicit
 * state × identity × locale × theme × width list passed as env:
 *
 *   SHOT_BASE   default http://127.0.0.1:3000
 *   SHOT_OUT    default audit-shots/today
 *   SHOT_SPEC   e.g. "manager:/:en:dark:1366,rep-a:/:ar:light:375"
 *               (identity:path:locale:theme:width; path may carry a query)
 *
 * node scripts/audit2/shoot-today.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { resolve, join } from "node:path";

process.loadEnvFile(".env");

const BASE = process.env.SHOT_BASE ?? "http://127.0.0.1:3000";
const OUT = resolve(process.env.SHOT_OUT ?? "audit-shots/today");
const PASSWORD = process.env.DEV_FIXTURE_PASSWORD;
if (!PASSWORD) {
  console.error("DEV_FIXTURE_PASSWORD missing");
  process.exit(1);
}

const EMAIL = {
  "rep-a": "rep-a@example.test",
  "rep-b": "rep-b@example.test",
  manager: "manager@example.test",
  coordinator: "coordinator@example.test",
  admin: "admin@example.test",
  executive: "executive@example.test",
};

const SPEC = (process.env.SHOT_SPEC ?? "")
  .split(",")
  .map((raw) => raw.trim())
  .filter(Boolean)
  .map((raw) => {
    const [identity, path, locale, theme, width] = raw.split("|");
    return { identity, path, locale, theme, width: Number(width) };
  });
if (SPEC.length === 0) {
  console.error("SHOT_SPEC empty");
  process.exit(1);
}

const CLI = resolve("node_modules/@playwright/cli/playwright-cli.js");
const cli = (session, args, timeout = 900_000) =>
  execFileSync(process.execPath, [CLI, `-s=${session}`, ...args], {
    encoding: "utf8",
    timeout,
    stdio: ["ignore", "pipe", "pipe"],
  });

const HEIGHTS = { 1366: 768, 1440: 900, 375: 812 };

mkdirSync(OUT, { recursive: true });
const tmp = join(os.tmpdir(), `shoot-today-${process.pid}`);
mkdirSync(tmp, { recursive: true });

const byIdentity = new Map();
for (const shot of SPEC) {
  if (!byIdentity.has(shot.identity)) byIdentity.set(shot.identity, []);
  byIdentity.get(shot.identity).push(shot);
}

const results = [];
for (const [identity, shots] of byIdentity) {
  cli(identity, ["open", "--persistent"]);
  try {
    const runner = join(tmp, `${identity}.js`);
    // The run-code file must be an `async page => { … }` expression — a bare
    // script dies with "Unexpected token 'const'" (capture.mjs's shape).
    const code = `async page => {
  const BASE = ${JSON.stringify(BASE)};
  const HOST = BASE.replace(/^https?:\\/\\//, "");
  const shots = ${JSON.stringify(shots)};
  const HEIGHTS = ${JSON.stringify(HEIGHTS)};
  const out = [];
  await page.goto(BASE + "/en/login", { waitUntil: "load" });
  if (page.url().includes("/login")) {
    await page.fill('input[name="email"]', ${JSON.stringify(EMAIL[identity] ?? "")});
    await page.fill('input[name="password"]', ${JSON.stringify(PASSWORD)});
    await Promise.all([
      page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 20000 }),
      page.click('button[type="submit"]'),
    ]);
  }
  for (const shot of shots) {
    await page.context().addCookies([{ name: "facet-theme", value: shot.theme, url: BASE }]);
    await page.setViewportSize({ width: shot.width, height: HEIGHTS[shot.width] ?? 800 });
    const path = "/" + shot.locale + (shot.path === "/" ? "" : shot.path);
    await page.goto(BASE + path, { waitUntil: "load" });
    // No URL global in the run-code sandbox — capture.mjs's regex instead.
    const host = (page.url().match(/^https?:\\/\\/([^\\/]+)/) || [])[1];
    if (host !== HOST) throw new Error("WRONG SERVER: " + host);
    await page.waitForTimeout(600);
    await page.evaluate(() => window.scrollTo(0, 0));
    const name = [shot.identity, shot.path.replace(/[\\/?=&]+/g, "_"), shot.locale, shot.theme, shot.width].join("-");
    const file = ${JSON.stringify(OUT.replace(/\\/g, "/"))} + "/" + name + ".png";
    await page.screenshot({ path: file, fullPage: true, timeout: 20000 });
    const boxes = await page.evaluate(() => Object.fromEntries(["today-band","today-team","today-tabs","today-shortcuts","rep-world","rep-pace","rep-companies","rep-threads","rep-dispatches","rep-targets"].map((s) => { const el = document.querySelector('[data-slot="' + s + '"]'); if (!el) return [s, null]; const r = el.getBoundingClientRect(); return [s, { top: Math.round(r.top + window.scrollY), height: Math.round(r.height) }]; })));
    const meta = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      dir: document.documentElement.getAttribute("dir"),
      lang: document.documentElement.getAttribute("lang"),
    }));
    out.push({ file, url: page.url(), ...meta, boxes });
  }
  return JSON.stringify(out);
}`;
    writeFileSync(runner, code);
    const raw = cli(identity, ["--raw", "run-code", `--filename=${runner}`]);
    // `--raw` double-encodes the returned JSON string.
    const parsed = JSON.parse(JSON.parse(raw.trim()));
    results.push(...parsed);
  } finally {
    cli(identity, ["close"]);
  }
}

rmSync(tmp, { recursive: true, force: true });
for (const entry of results) console.log(JSON.stringify(entry));
