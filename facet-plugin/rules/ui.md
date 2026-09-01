---
paths:
  - "src/app/**"
  - "src/components/**"
  - "messages/**"
---

# UI source rules — load the facet-ui skill before building or editing a screen

**For:** the traps that live only in UI source. **Prevents:** the silent
failures below, each of which shipped once. **Safe to remove when:** the
mechanism it names is gone (per clause, below).

- **Every user-facing string goes through the translation layer** (EN + AR,
  one shared key tree, `S113`). `check:messages` holds key parity and
  `verify:routes` §12 catches a lookup rendering as `ns.key`; hardcoded
  English that never became a key is caught by NEITHER — that half is prose.

- **Logical utilities and `dir` placement are hook-enforced** (H3/H4 in
  `.claude/hooks/guard-writes.mjs`): physical utilities (`ml-*`, `text-left`…)
  and `ms-*`/`me-*` on an element that itself carries `dir` are denied at the
  edit. The WHY: a logical margin resolves against the element's OWN
  direction, so on a `dir` carrier it lands on the wrong side in one locale —
  four sightings, three different utilities. **Where a flex parent already
  supplies a `gap`, delete the margin** rather than moving it: one less thing
  that can be wrong. Direction itself: `D62` (stored values → `dir="auto"` on
  the inline run, never a block) and `D73` (composed runs; a `dir` never sits
  on an element that lays anything out; locale-formatted dates carry NO `dir`).

- **A Tailwind class that compiles to nothing fails no check.** Tailwind
  scans SOURCE TEXT: a bare `/` inside an arbitrary value reads as the
  opacity modifier, an escaped quote reaches the stylesheet as a literal
  backslash — the declaration is dropped or malformed in silence. The
  checkbox shipped tickless through a green `build`. **When a visual change
  does not appear, read the compiled stylesheet** — `build` cannot tell you.

- **Never type a hex into a component** — every colour is a token in
  `globals.css` (`D5`, `D8`). Exception by shape: a data-URI (the checkbox
  tick) is an image, not a palette entry.

- **No `@/lib/*` data-module import in a client component** — it bundles the
  Postgres driver, and only `build` catches it. Re-declare option types
  client-side.

- Screens are driven **in both locales, laptop widths (1366/1440) first,
  then 375** before being called done — the full pre-flight list is the
  **facet-ui** skill's; load it for any work here.
