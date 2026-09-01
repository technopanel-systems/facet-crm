#!/usr/bin/env node
/**
 * PreToolUse guard for Bash.
 *
 * H10 — a commit message cites a rule (CLAUDE.md § Authority: "cite rules by
 * number in every plan, comment and commit message"). One Phase 2 commit
 * broke it and WORKFLOW §5 records the gap as unfixable after the fact —
 * rewriting history would invalidate 62 verified hashes. So it is caught
 * before the commit exists instead.
 *
 * H11 — coordination frameworks by name. claude-flow was installed twice and
 * removed twice, and left a memory store that loaded into twenty sessions
 * (CLAUDE.md § Working style, WORKFLOW §7).
 *
 * Exit 2 + stderr is the documented block contract for PreToolUse.
 */

import fs from "node:fs";

let input;
try {
  input = JSON.parse(fs.readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const command = input.tool_input?.command ?? "";

function deny(rule, message) {
  process.stderr.write(`${rule}: ${message}`);
  process.exit(2);
}

// H11 — the named offenders, install or invoke, any package manager. Matched
// at command or install position only: a commit message that MENTIONS the name
// (this file's own history does) is not an invocation, and the first run of
// this guard blocked exactly that.
const frameworkInvocation =
  /(?:^|[;&|]\s*)(?:claude-flow|ruv-swarm)\b|\b(?:npx|bunx)\s+(?:-{1,2}\S+\s+)*(?:claude-flow|ruv-swarm)\b|\b(?:npm\s+(?:i|install|add)|yarn\s+(?:add|dlx)|pnpm\s+(?:add|dlx))\s+(?:-{1,2}\S+\s+)*(?:claude-flow|ruv-swarm)\b/i;
if (frameworkInvocation.test(command)) {
  deny(
    "H11 (CLAUDE.md § Working style, WORKFLOW §7)",
    "claude-flow / swarm frameworks are banned by name. Installed twice, " +
      "removed twice; its memory store loaded into twenty sessions unaudited. " +
      "Claude Code's own subagents and hooks are the sanctioned mechanisms.",
  );
}

// H10 — a git commit cites a rule. --amend without -m keeps a message that
// already passed; everything else must carry a citation-shaped token.
if (/\bgit\s+commit\b/.test(command)) {
  const amendKeepsMessage = /--amend\b/.test(command) && !/\s-m\b|--message\b/.test(command);
  const cites =
    /S\d|D\d|§|A2-|AD\d|CLAUDE\.md|SPEC|DESIGN|WORKFLOW|README|facet-ui|facet-verify/.test(
      command,
    );
  if (!amendKeepsMessage && !cites) {
    deny(
      "H10 (CLAUDE.md § Authority)",
      "commit message cites no rule. Every commit names the rule numbers it " +
        "ships (S…, D…, §…, or the authority file it amends). A statement that " +
        "cannot cite a rule is not a requirement.",
    );
  }
}

process.exit(0);
