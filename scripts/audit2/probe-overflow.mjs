/**
 * A throwaway probe for `A2-17`'s 375 side-scroll: loads one route at 375,
 * measures `document.scrollingElement.scrollWidth`, and names every element
 * whose border box crosses the right edge. Session-48 tooling, kept beside
 * `capture.mjs` because it reuses its daemon and sign-in shape.
 *
 * Usage: node scripts/audit2/probe-overflow.mjs /en/quotations/<id>
 */
process.loadEnvFile(".env");

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import postgres from "postgres";

const BASE = process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:3100";
const CLI = resolve("node_modules/@playwright/cli/playwright-cli.js");
const PASSWORD = process.env.DEV_FIXTURE_PASSWORD;

let path = process.argv[2];
if (!path) {
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  const [row] = await sql`
    select t.id from quotation_threads t
      join users u on u.id = t.raised_by_user_id and u.email = 'rep-a@example.test'
      join quotation_versions v on v.thread_id = t.id
    group by t.id order by count(v.id) desc limit 1`;
  await sql.end();
  path = `/en/quotations/${row.id}`;
}

const source = `async page => {
  const BASE = ${JSON.stringify(BASE)};
  // Reuses the audit's signed-in persistent profile (-s=rep-a); a fresh
  // profile's login bounces to AUTH_URL's host — the container, §0's shadow.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(BASE + ${JSON.stringify(path)}, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(700);
  return await page.evaluate(() => {
    const doc = document.scrollingElement;
    const out = { scrollWidth: doc.scrollWidth, joints: [] };
    for (const el of document.querySelectorAll("body *")) {
      const parent = el.parentElement;
      if (!parent) continue;
      if (el.offsetWidth > parent.clientWidth + 1) {
        out.joints.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || "").toString().slice(0, 110),
          slot: el.getAttribute("data-slot") || null,
          w: el.offsetWidth,
          parentW: parent.clientWidth,
          parentCls: (parent.className || "").toString().slice(0, 80),
          text: (el.textContent || "").trim().slice(0, 40),
        });
      }
    }
    return JSON.stringify(out, null, 1);
  });
}`;

const cli = (args) =>
  execFileSync(process.execPath, [CLI, "-s=rep-a", ...args], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120000,
  });

cli(["open", "--persistent"]);
try {
  console.log(cli(["run-code", source]));
} finally {
  cli(["close"]);
}
