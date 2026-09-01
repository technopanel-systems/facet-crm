#!/usr/bin/env node
/**
 * PreToolUse guard for Write | Edit | NotebookEdit.
 *
 * Enforces the prohibitions CLAUDE.md can only state as prose. Each check is
 * numbered against docs/archive/28-fixation/00-prohibitions.md (H1-H9); the
 * rule it enforces is named in the deny message so a blocked session can cite
 * it. Exit 2 + stderr is the documented block contract for PreToolUse.
 *
 * An Edit is denied only when the offending token is INTRODUCED — present in
 * new_string and absent from old_string — so moving existing code never trips
 * a guard the original site did not.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const raw = fs.readFileSync(0, "utf8");
let input;
try {
  input = JSON.parse(raw);
} catch {
  process.exit(0); // unparseable input is the harness's problem, never a block
}

const toolInput = input.tool_input ?? {};
const filePath = toolInput.file_path ?? toolInput.notebook_path;
if (!filePath) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const norm = (p) => path.resolve(p).replace(/\\/g, "/").toLowerCase();
const repo = norm(projectDir);
const target = norm(path.isAbsolute(filePath) ? filePath : path.join(projectDir, filePath));

function deny(rule, message) {
  process.stderr.write(`${rule}: ${message}`);
  process.exit(2);
}

// H1 — no write outside the repository. The memory store (WORKFLOW §5 S45-2)
// ran twenty sessions in ~/.claude/projects/ against a written prohibition;
// this is the hook that would have caught it on day one. The session
// scratchpad and OS temp are the only sanctioned outside locations.
if (!target.startsWith(repo + "/") && target !== repo) {
  const temp = norm(os.tmpdir());
  const inTemp =
    target.startsWith(temp + "/") ||
    target.includes("/appdata/local/temp/") ||
    target.startsWith("/tmp/");
  if (!inTemp) {
    deny(
      "H1 (CLAUDE.md § Working style)",
      `write outside the repository: ${filePath}. Guidance and records live in ` +
        `git or they do not exist — the memory store failure (WORKFLOW §5 S45-2). ` +
        `Use the repo or the session scratchpad. If the founder explicitly asked ` +
        `for this file, say so and have them approve an override.`,
    );
  }
  process.exit(0); // temp writes are sanctioned; no further checks apply
}

const rel = target.slice(repo.length + 1);

// H2 — no new document. "New decisions go into SPEC.md or DESIGN.md. Never a
// new document. The 27 in docs/archive/ exist because that rule did not"
// (WORKFLOW §7). Editing an existing file is never blocked here.
if (rel.endsWith(".md") && !fs.existsSync(target)) {
  const allowedPrefixes = [
    "docs/archive/",
    "docs/design/",
    ".claude/",
    "facet-plugin/",
    ".agents/",
    "node_modules/",
    "legacy/",
  ];
  const allowedExact = new Set([
    "claude.md",
    "spec.md",
    "design.md",
    "workflow.md",
    "readme.md",
    "agents.md",
    "entry.md",
  ]);
  const ok = allowedExact.has(rel) || allowedPrefixes.some((p) => rel.startsWith(p));
  if (!ok) {
    deny(
      "H2 (WORKFLOW §7)",
      `new document refused: ${rel}. New decisions go into SPEC.md or DESIGN.md; ` +
        `session records go into docs/archive/; skills, rules and agents into ` +
        `.claude/. A new standalone document is how the 27-file archive happened.`,
    );
  }
}

// The added text: Write = whole content, Edit = new_string. The prior text is
// what makes "introduced" testable.
const added = toolInput.content ?? toolInput.new_string ?? "";
let prior = toolInput.old_string ?? "";
if (toolInput.content !== undefined && fs.existsSync(target)) {
  try {
    prior = fs.readFileSync(target, "utf8");
  } catch {
    prior = "";
  }
}
const introduces = (re) => re.test(added) && !re.test(prior);

const isSrcCode = rel.startsWith("src/") && /\.(ts|tsx)$/.test(rel);

if (isSrcCode) {
  // H3 — physical Tailwind utilities. S113 / D57 / CLAUDE.md § Conventions:
  // "the convention that rots fastest if unenforced." The token list is
  // facet-ui's pre-flight grep, tightened to class-token boundaries.
  const physical =
    /(?:^|[\s"'`{:(])(?:-?(?:ml|mr|pl|pr)-(?:\d|px|auto|\[)|text-left\b|text-right\b|border-[lr]\b|(?:left|right)-(?:\d|px|auto|full|\[))/m;
  if (introduces(physical)) {
    deny(
      "H3 (CLAUDE.md § Conventions, S113, D57)",
      `physical Tailwind utility introduced in ${rel}. Use logical utilities — ` +
        `ms-*/me-*, ps-*/pe-*, text-start/text-end, start-*/end-*, border-s/border-e. ` +
        `A physical utility is a layout bug in Arabic.`,
    );
  }

  // H4 — a logical margin on an element that itself carries dir. Four
  // sightings, three different utilities; a logical margin resolves against
  // the element's OWN direction (CLAUDE.md § Conventions).
  const dirMargin =
    /<[a-zA-Z][^>]*\bdir=[^>]*[\s"'`{:]-?(?:ms|me)-|<[a-zA-Z][^>]*[\s"'`{:]-?(?:ms|me)-[^>]*\bdir=/;
  if (introduces(dirMargin)) {
    deny(
      "H4 (CLAUDE.md § Conventions)",
      `ms-*/me-* on an element that itself carries dir, in ${rel}. The margin ` +
        `resolves against the element's own direction and lands on the wrong side ` +
        `in one locale. Where a flex parent supplies a gap, delete the margin; ` +
        `otherwise move it onto a neighbour carrying no dir.`,
    );
  }

  // H5 — raw Next navigation imports drop the locale prefix, silently.
  if (!rel.startsWith("src/i18n/")) {
    const nextLink = /from\s+["']next\/link["']/;
    const nextNav =
      /import\s+(?:type\s+)?\{[^}]*\b(?:redirect|useRouter|usePathname|Link)\b[^}]*\}\s*from\s+["']next\/navigation["']/s;
    if (introduces(nextLink) || introduces(nextNav)) {
      deny(
        "H5 (README § Bilingual and RTL)",
        `raw next/link or next/navigation import of Link/redirect/usePathname/` +
          `useRouter in ${rel}. Import them from @/i18n/navigation — the raw ` +
          `versions drop the locale prefix. (notFound from next/navigation is fine.)`,
      );
    }
  }

  // H6 / H7 — the two silent ways SQL loses Riyadh's "today" (S46-1; three
  // verify scripts red on any small-hours run before the fix).
  if (introduces(/\bcurrent_date\b/i)) {
    deny(
      "H6 (CLAUDE.md § Conventions, S46-1)",
      `current_date introduced in ${rel}. That is the SERVER's UTC day, one ` +
        `behind Riyadh until 03:00. Write (now() at time zone 'Asia/Riyadh')::date.`,
    );
  }
  if (introduces(/::\s*date\s+at\s+time\s+zone/i)) {
    deny(
      "H7 (CLAUDE.md § Conventions, S46-1)",
      `"::date at time zone" introduced in ${rel}. On a bare date AT TIME ZONE ` +
        `lifts to midnight-UTC then STRIPS the zone. The safe shape is ` +
        `\${day}::date::timestamp at time zone 'Asia/Riyadh'.`,
    );
  }
}

// H8 — no database RLS. One authorization layer, in application code (S109).
if (rel.startsWith("drizzle/") || rel.startsWith("src/db/")) {
  if (introduces(/\bcreate\s+policy\b|\benable\s+row\s+level\s+security\b/i)) {
    deny(
      "H8 (S109, CLAUDE.md § Stack)",
      `row-level security introduced in ${rel}. FACET has one authorization ` +
        `layer, in application code. No database policies.`,
    );
  }
}

// H9 — container ports publish on loopback only (README § Deployment: the app
// is 127.0.0.1-bound so Cloudflare Access cannot be skipped over the LAN).
if (rel === "docker-compose.yml") {
  if (introduces(/["']\d{2,5}:\d{2,5}["']/)) {
    deny(
      "H9 (README § Deployment notes)",
      `a port mapping without a loopback prefix in docker-compose.yml. Publish ` +
        `as "127.0.0.1:PORT:PORT" — a bare "PORT:PORT" binds 0.0.0.0 and answers ` +
        `on the LAN, skipping Cloudflare Access.`,
    );
  }
}

process.exit(0);
