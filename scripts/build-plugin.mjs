/**
 * Build facet-plugin/ from .claude/ — the live config is the single source,
 * the plugin is its packaged mirror (SESSION 50, Phase 5). Run after any
 * change under .claude/; `--check` verifies the mirror is current and exits
 * 1 on drift, which is how Phase-6-style proofs keep the two honest.
 *
 * What is copied: hooks (plus a generated hooks/hooks.json), the four
 * PROJECT skills (never installed-dependency skills like playwright-cli),
 * agents, commands, rules. plugin.json is generated. The plugin README is
 * authored by hand and left alone.
 */

import fs from "node:fs";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..");
const SRC = path.join(REPO, ".claude");
const OUT = path.join(REPO, "facet-plugin");
const CHECK = process.argv.includes("--check");

const PROJECT_SKILLS = ["facet-ui", "facet-verify", "facet-audit", "facet-register"];

const files = [];
for (const hook of fs.readdirSync(path.join(SRC, "hooks"))) {
  files.push([`hooks/${hook}`, path.join(SRC, "hooks", hook)]);
}
for (const skill of PROJECT_SKILLS) {
  files.push([`skills/${skill}/SKILL.md`, path.join(SRC, "skills", skill, "SKILL.md")]);
}
for (const dir of ["agents", "commands", "rules"]) {
  for (const f of fs.readdirSync(path.join(SRC, dir))) {
    files.push([`${dir}/${f}`, path.join(SRC, dir, f)]);
  }
}

const generated = {
  ".claude-plugin/plugin.json":
    JSON.stringify(
      {
        name: "facet",
        description:
          "FACET's working discipline as a portable unit: deterministic guard hooks, the four project skills, the three mechanical agents, path-scoped rules and the status command. Chosen as a Claude Code plugin over the cross-vendor Agent Plugins 1.0 standard deliberately: that standard carries skills and MCP servers but NOT hooks, and hooks are the enforcement that makes this work.",
        version: "1.0.0",
        author: { name: "Technopanel / FACET" },
        repository: "https://github.com/technopanel-systems/facet-crm",
      },
      null,
      2,
    ) + "\n",
  "hooks/hooks.json":
    JSON.stringify(
      {
        hooks: {
          PreToolUse: [
            {
              matcher: "Write|Edit|NotebookEdit",
              hooks: [
                {
                  type: "command",
                  command: "node ${CLAUDE_PLUGIN_ROOT}/hooks/guard-writes.mjs",
                  timeout: 15,
                },
              ],
            },
            {
              matcher: "Bash",
              hooks: [
                {
                  type: "command",
                  command: "node ${CLAUDE_PLUGIN_ROOT}/hooks/guard-bash.mjs",
                  timeout: 15,
                },
              ],
            },
          ],
        },
      },
      null,
      2,
    ) + "\n",
};

let drift = 0;
// Compare with \r stripped: git's autocrlf rewrites line endings on checkout,
// and a fresh Windows clone must not read as drift — found by feeding the
// check its defect and watching the RESTORE stay red (session 50, Phase 6).
const norm = (s) => s.replace(/\r/g, "");
function put(rel, content) {
  const dest = path.join(OUT, rel);
  if (CHECK) {
    const current = fs.existsSync(dest) ? fs.readFileSync(dest, "utf8") : null;
    if (current === null || norm(current) !== norm(content)) {
      console.error(`DRIFT: facet-plugin/${rel}`);
      drift++;
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
}

for (const [rel, src] of files) put(rel, fs.readFileSync(src, "utf8"));
for (const [rel, content] of Object.entries(generated)) put(rel, content);

if (CHECK) {
  console.log(drift === 0 ? `plugin mirror current (${files.length + 2} files)` : `${drift} file(s) drifted — run: node scripts/build-plugin.mjs`);
  process.exit(drift === 0 ? 0 : 1);
}
console.log(`built facet-plugin/ — ${files.length} copied + ${Object.keys(generated).length} generated`);
