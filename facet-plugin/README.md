# facet — the discipline as a plugin

FACET's working setup packaged as a **Claude Code plugin**: the two guard
hooks (H1–H11's enforcement), the four project skills (`facet-ui`,
`facet-verify`, `facet-audit`, `facet-register`), the three mechanical agents
(`classifier`, `conformance-sweeper`, `shot-looker`), the path-scoped rules,
and the `/status` command.

## This is a MIRROR — never edit it directly

The live configuration is `.claude/` in this repository; sessions here load
THAT, not this. This directory is generated from it by
`node scripts/build-plugin.mjs` so the setup can travel to other projects
and machines as one coherent unit; `--check` fails on drift, and the
Phase-6 proofs run it. Edit `.claude/`, then rebuild.

## Installing elsewhere

- Try it for one session: `claude --plugin-dir path/to/facet-plugin`
- Keep it: copy this directory into `~/.claude/skills/` and `/reload-plugins`
  (loads as `facet@skills-dir`), or serve it from a marketplace.
- `rules/` ships as files: path-scoped rules are a project-level mechanism,
  so on another project copy them into that repo's `.claude/rules/` — the
  plugin carries them so nothing about the setup lives only here.
- The hooks assume Node on PATH; guard paths and the H2 allowlist name
  FACET's own layout — review `hooks/guard-writes.mjs` before enforcing it
  on a different tree.

## Why a Claude Code plugin and not Agent Plugins 1.0

Chosen deliberately, and recorded here as the founder's brief asked: the
cross-vendor **Agent Plugins 1.0** standard carries skills and MCP servers
but **not hooks** — and hooks are the enforcement layer that makes this
whole setup work. A portable version of FACET's discipline without its
deterministic guardrails would be the prose-only arrangement this project
just spent a session escaping: a rule is a sentence, and a sentence is a
hope. If the standard grows hook support, revisit; the skills and agents
would port as-is.
