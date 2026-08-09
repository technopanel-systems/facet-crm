/**
 * Verify that `messages/en.json` and `messages/ar.json` carry the same key
 * tree, and the same ICU placeholders in every shared key.
 *
 * The README states the rule ("Both files must carry the same key tree") and
 * nothing enforced it. A missing Arabic key is invisible until someone opens
 * `/ar` on the one screen that uses it, and next-intl fails at render time —
 * so this is the cheapest guard in the project. `npm run check:messages`.
 *
 * Exits 1 and prints every problem, so one run fixes everything.
 */

import { readFileSync } from "node:fs";

type Tree = { [key: string]: unknown };

const LOCALES = ["en", "ar"] as const;

function flatten(node: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const [k, v] of flatten(value as Tree, path)) out.set(k, v);
    } else {
      out.set(path, String(value));
    }
  }
  return out;
}

/** `{name}` and `{count, plural, ...}` alike — the leading identifier. */
function placeholders(message: string): string[] {
  return [...message.matchAll(/\{\s*(\w+)/g)].map((m) => m[1]).sort();
}

function load(locale: string): Map<string, string> {
  const path = new URL(`../messages/${locale}.json`, import.meta.url);
  return flatten(JSON.parse(readFileSync(path, "utf8")) as Tree);
}

const [en, ar] = LOCALES.map(load);
const problems: string[] = [];

for (const key of en.keys()) {
  if (!ar.has(key)) problems.push(`missing in ar.json: ${key}`);
}
for (const key of ar.keys()) {
  if (!en.has(key)) problems.push(`missing in en.json: ${key}`);
}
for (const [key, value] of en) {
  const other = ar.get(key);
  if (other === undefined) continue;
  const [a, b] = [placeholders(value), placeholders(other)];
  if (a.join(",") !== b.join(",")) {
    problems.push(
      `placeholder mismatch at ${key}: en {${a.join(", ")}} vs ar {${b.join(", ")}}`,
    );
  }
}

if (problems.length > 0) {
  console.error(`messages: ${problems.length} problem(s)`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(`messages: ${en.size} keys, en and ar agree.`);
