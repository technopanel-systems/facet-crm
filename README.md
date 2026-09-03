# FACET

**The entry document.** Readable by a person, loadable by an agent: what
FACET is, how the business works, how the system is built, how sessions run,
why the discipline exists, and where everything lives. The operational
reference (run, database, deploy, backups) follows the narrative. If you
read only one file, read this one; the rules themselves live in
[CLAUDE.md](CLAUDE.md), [SPEC.md](SPEC.md) and [DESIGN.md](DESIGN.md).

---

## What FACET is

Technopanel is a Saudi supplier of cladding and aluminium composite panel —
about fourteen people, most of them sales reps on laptops at 1366px, some on
phones in a customer's lobby. FACET is their internal operations platform:
the system of record for **work** — who owns which customer relationship,
what stage each deal is at, what was promised, what actually moved.

It is deliberately **not** the system of record for money. Quotations are
priced, invoiced and taxed in **SMAC**, the company's existing ERP, which is
staying. FACET mirrors SMAC's reference numbers, typed by humans, and
assumes they can be wrong. FACET grows **sideways** into new departments
(production, warehouse, marketing are planned) and never down into finance.

## How the business works

A **rep** finds and owns companies. Everything downstream depends on reps
bothering to record things, so the main entry point is a **Log button**
built for a phone: three taps and a text box records a visit, a call, a
WhatsApp. From those recorded events FACET **derives** everything it can —
who has gone quiet, what is stuck, whose move it is — and only ever asks a
human for what genuinely lives in someone's head.

Deals live on **projects** (a building, a contract — several companies can
participate). A rep raises a **quotation** against a project; the **sales
coordinator** — one person, both chains run through her — builds the real
quotation in SMAC, types the number back, and manages issue / return /
accept / reject. "Accepted" means internal signatures only; **a deal is won
when a dispatch is approved**, a real event that cannot be manufactured. The
rep requests a **dispatch**; the coordinator checks it, records how the
customer pays, and approves — the only event that credits a rep's monthly
**target, measured in square metres**, never currency. Approval is final:
wrong afterwards means cancelled, never un-approved, and a cancelled
dispatch un-wins its project and takes back the credit.

Colour on screen means one thing: **how long something has waited** — never
how good the outcome is. The tool's one question, asked of every screen:
*does this help a person finish what is waiting on them?*

## How the system is built

Next.js (App Router) + TypeScript · PostgreSQL + Drizzle · Auth.js
(credentials, database sessions) · Tailwind v4 + shadcn/ui · next-intl —
**every user-facing string ships in English and Arabic, and the whole layout
is RTL-safe by construction** (logical utilities only, hook-enforced).
Server-rendered HTML with JavaScript as enhancement, never enablement: every
screen works with scripts off, which is also what makes the whole product
testable over plain HTTP. It runs in Docker on one Windows PC behind a
Cloudflare Tunnel with Cloudflare Access in front; PostgreSQL and the app
are loopback-bound so the tunnel is the only way in.

The data layer (`src/lib`) is the one authorization layer and the one place
derivations live — quiet thresholds, chain positions, credit — resolved in
SQL before pagination. The audit log is written by the data layer, not by
features. Derived figures are never stored where they can drift: *won* is
computed from dispatches at read time, square metres are generated columns,
and no screen restates a derivation that already has a home.

## How sessions run

Development is founder + AI: Jerom (founder, semi-beginner developer)
directs; Claude Code builds; a planning chat reviews. The loop, every
session (`WORKFLOW.md` §3): one task · plan mode for anything structural,
the plan reviewed before approval · build · run the gates — `typecheck`,
`lint`, `build`, `check:messages`, then the verify scripts · update SPEC or
DESIGN so the spec stays a living file · commit and push · record anything
found-but-not-fixed as a register row (§5) · paste the status block.

Rules are **cited by number** (`S74`, `D28`) in every plan, comment and
commit — an uncited commit is hook-blocked. There is **no test harness**;
verification is ten kept scripts plus `verify:routes`, ~1,800 checks driven
over HTTP in both locales against a built server, and every new check is fed
its own defect before it is believed (the `facet-verify` skill carries that
whole discipline).

## Why the discipline exists

FACET is a second attempt. v1 died of invented logic (an approval gate
nobody asked for, a `branches` table nothing used) and of documentation that
grew on its own until nobody could audit it — twenty-seven planning
documents, later joined by a third-party agent framework installed twice by
accident, whose memory store loaded guidance into twenty sessions from
outside the repository before anyone noticed.

The answer is layered, and became deterministic in session 50:

- **Authority is two files** — SPEC.md (what) and DESIGN.md (how it looks),
  every rule numbered, present tense, contradictions hunted by scheduled
  audits and a standing rule review (`WORKFLOW §6b`) that can rewrite or
  delete rules, because a rule that is merely accumulated is a ratchet.
- **Prohibitions that can be enforced ARE** — Claude Code hooks and
  permissions deny the forbidden thing at the tool call (writes outside the
  repo, physical CSS utilities, uncited commits, the two SQL shapes that
  lose Riyadh's clock…). A rule that stays prose says so, because a
  sentence is a hope.
- **Everything derived, nothing asked twice, nothing unused** — a column
  without a writer is a lie about what the system does, and the
  dead-structure sweeps delete it.
- **Checks are guilty until fed their defect** — the project's wrong-red
  ledger records eighteen checks that were wrong in the direction that
  matters; the discipline that found them is the crown jewel.

## Where everything lives

| Where | What |
|---|---|
| [CLAUDE.md](CLAUDE.md) | the always-loaded index: judgment rules, the layer map |
| [SPEC.md](SPEC.md) / [DESIGN.md](DESIGN.md) | the authority — every numbered rule |
| [WORKFLOW.md](WORKFLOW.md) | the session plan (§4), the OPEN register (§5), audits (§6, §6b) |
| [.claude/rules/](.claude/rules/) | path-scoped rules that load when their files are touched |
| [.claude/skills/](.claude/skills/) | procedures: `facet-ui`, `facet-verify`, `facet-audit`, `facet-register` |
| [.claude/agents/](.claude/agents/) | mechanical workers: `classifier`, `conformance-sweeper`, `shot-looker` |
| [.claude/hooks/](.claude/hooks/) + [.claude/settings.json](.claude/settings.json) | the deterministic guardrails (H1–H11, P1–P7) |
| [facet-plugin/](facet-plugin/) | the same setup packaged as a Claude Code plugin, for carrying to other projects |
| [docs/archive/](docs/archive/) | history — how decisions were reached; never authority. `28-fixation/` is the session-50 rebuild record; `29-closed-register.md` is §5's closed history |
| [docs/design/](docs/design/) | the visual concept (v5 is the target, not authority) |
| [legacy/](legacy/) | the failed v1 — access-gated, real names inside |

---

# Operational reference

## First run

Requires Docker Desktop, and Node 24 to develop outside the container.

```bash
cp .env.example .env      # then edit POSTGRES_PASSWORD
docker compose up --build -d
```

Open <http://localhost:3000>. It redirects to `/en` and the sign-in screen;
signed in, `/` is **Today**. `/ar` is the same product mirrored
right-to-left. Dark is the default theme; the toggle persists in a cookie
read on the server, so there is no flash of the wrong palette.

```bash
curl http://localhost:3000/api/health
# {"ok":true,"app":"up","db":"up","checkedAt":"..."}   (503 when the db is down)
```

> The Docker build downloads fonts from Google Fonts, so the **build** needs
> internet access. The running container does not.

## Two ways to run

| | Command | Use for |
|---|---|---|
| **Container** | `docker compose up --build -d` | What actually runs on the office PC. Verify here before deploying. |
| **Host** | `docker compose up -d db` then `npm install && npm run dev` | Day-to-day work. Hot reload, same database. |

Both talk to the same PostgreSQL; `docker-compose.yml` overrides
`DATABASE_URL` for the container, so `.env` never needs editing when
switching.

Checks: `npm run lint` · `typecheck` · `build` · `check:messages`, verify
scripts per `package.json` (`verify:routes` needs `npm run build && npm run
start` — never `next dev` — and the app **container stopped**, or its
loopback-published port shadows the server under test).

> **Next.js 16 differs from 13–15** — `params` is a Promise, `middleware.ts`
> is `proxy.ts`. Version-correct docs ship at `node_modules/next/dist/docs/`;
> read those rather than memory. (`next dev`'s wish to append notes to
> CLAUDE.md is disabled via `agentRules: false` — that file is hand-written.)

## Database

Schema in `src/db/schema.ts`; the phase it belongs to is `WORKFLOW.md` §4.

```bash
npm run db:generate   # write a migration from schema.ts changes
npm run db:migrate    # apply pending migrations
npm run db:seed       # roles, lookups, settings, notification types
npm run db:studio     # browse data
npm run db:push       # local scratch only — never against a real database
npm run db:reset      # development only — destroy the volume and rebuild
npm run db:clear      # development only — empty every record table, keep one account (§ Day one)
npm run seed:demo     # development only — a realistic dataset to look at
```

Migrations under `drizzle/` are committed — the record of how production
reached its shape. The migration traps (silent failures, the enum-CHECK
rebuild, confirming from `information_schema`) load automatically from
[.claude/rules/migrations.md](.claude/rules/migrations.md) when those files
are touched.

**A dev database only ever grows** — verify scripts leave rows by design
(FACET deletes nothing, its scaffolding included). `npm run db:reset` then
`npm run dev:fixtures` gets a clean one; `npm run seed:demo` builds a
realistic one (~120 companies, Arabic names, 120 days of history, replayed
through the real writers so nothing is in a state the app cannot produce).
It needs `BOOTSTRAP_ADMIN_*` in `.env` before it destroys anything, refuses
outside development, and is idempotent.

## Day one — an empty product

```bash
npm run db:clear -- --database <name>      # keeps BOOTSTRAP_ADMIN_EMAIL's account
npm run db:clear -- --database <name> --keep you@technopanel.com.sa
```

Empties **every record table** — companies, contacts, projects, quotations,
dispatches, reports, comments, notifications, targets, the calendar, the
audit log — and deletes every account but the one kept, with its sessions
intact. Roles, permissions, lookups, settings and the migration ledger stay,
so the product is usable and meets you the way it meets a customer on day
one: the first-run screen (`D81`) on Today, and nothing else. It refuses
outside `NODE_ENV=development`, refuses unless `--database` names the
database it is actually connected to, and asks for the name to be typed
back (or `--yes` with no terminal). Nothing is touched until every check
has passed.

> **With the seed cleared, MOST OF THE VERIFY SUITE GOES RED.** Nearly every
> check asserts against seeded records and the fixture accounts
> (`rep-a@example.test` and friends). That is **expected and is not a
> defect**. Measured on 3 Sep 2026 against an empty database: **eight of the
> ten scripts stop at their first line** (*No user manager@example.test — run
> npm run dev:fixtures*, 0 checks each); `verify:schema25` passes its **134**
> structural checks and stops at its first fixture read; `verify:routes` runs
> **816** of its ~1,980 checks and **445 of them fail** (every check behind a
> fixture login), 371 pass. So roughly **500 checks survive an empty
> database and about 2,800 do not**, and nothing in that count is a defect.
> `npm run seed:demo` restores the world and the suite goes green again.

To restore: `npm run seed:demo` (needs `BOOTSTRAP_ADMIN_*` and
`DEV_FIXTURE_PASSWORD` in `.env`; it truncates the same tables, rebuilds
~120 companies and 120 days of history through the real writers, and
recreates the fixture accounts), then `npm run build && npm run start` and
the suite as usual.

## Bilingual and RTL

- Strings live in [messages/en.json](messages/en.json) and
  [messages/ar.json](messages/ar.json) — the same key tree, enforced by
  `check:messages`. Never hardcode a user-facing string.
- Import `Link`, `redirect`, `usePathname`, `useRouter` from
  [src/i18n/navigation.ts](src/i18n/navigation.ts), never `next/link` or
  `next/navigation` — the raw versions drop the locale prefix
  (hook-enforced).
- **Logical Tailwind utilities only** — `ms-*` not `ml-*`, `text-start` not
  `text-left` (hook-enforced; the full table and the direction rules load
  from [.claude/rules/ui.md](.claude/rules/ui.md)). Arabic then needs no
  `rtl:` variants; check `/ar` before calling a screen done.
- Radix components read `DirectionProvider` from the locale layout.
- Adding a locale: edit [src/i18n/routing.ts](src/i18n/routing.ts), add a
  messages file. Nothing else.

## Deployment

One Windows PC, Docker, Cloudflare Tunnel; `cloudflared` runs on the host,
not in compose. **Both containers are loopback-bound** (`127.0.0.1:3000`,
`127.0.0.1:5432`) — only the tunnel is public, and Cloudflare Access
(free ≤50 users; session duration one month) fronts the tunnel. **Access
protects the tunnel and NOT a re-published port** — that is why loopback
binding matters; the two facts belong together.

Before real users, on the host machine:

- [ ] BIOS: power on after AC loss · Windows Update: no auto-restart ·
      Docker Desktop on boot · `.wslconfig` memory cap · UPS
- [ ] **`cloudflared` ingress points at `http://localhost:3000`** — the app
      no longer answers on the LAN address, so an ingress naming the
      machine's IP stops working
- [ ] **`PUBLIC_URL` set** to the https tunnel hostname — it is what makes
      the session cookie `Secure`, and forgetting it is **silent** (login
      works, the token crosses the tunnel unprotected)
- [ ] Cloudflare Access with a test code to a `technopanel.com` address
      first (cPanel mail — confirm it is not filed as spam)
- [ ] Backups configured (below), then **pull the plug and confirm it comes
      back unattended**

RAID is not a backup.

## Backups

```bash
npm run backup          # one consistent dump into BACKUP_DIR
npm run backup:verify   # restore the newest dump twice and prove it matches
npm run restore -- <dump-file> --to <database> [--force]
```

The Synology NAS sweeps files, but PostgreSQL's data directory is written
while it is copied — a torn copy that may not restore. `npm run backup`
writes one **consistent** dump into a folder the NAS already sweeps
(`BACKUP_DIR` in `.env`); `backup:verify` restores it twice (a scratch
database beside the live one, and a throwaway container on an empty volume)
and compares every table's exact row count, failing on a mismatch or on a
comparison that read nothing. `pg_dump` runs **inside** the `db` container
so the client always matches the server.

**A dump holds every row and every password hash — it is exactly as
sensitive as the database.** The folder needs the database's access control;
nothing prints or shell-passes `POSTGRES_PASSWORD`.

Host-side steps that cannot be scripted from here — choosing the NAS-swept
folder, the Task Scheduler entry (02:00 nightly, `Run whether user is
logged on or not`, start-in the repo root, log to `logs\backup.log`), and
**proving the restore on a second machine** (copy a dump, `docker compose
up -d db`, `npm run restore`, compare row counts + the migration ledger + an
Arabic company name) — are recorded in `WORKFLOW §4` row 43; the row closes
when the second machine has restored one.

## Known advisory

`npm audit` reports a moderate esbuild advisory via `drizzle-kit` — dev-only,
not in the production image; `npm audit fix --force` would downgrade
drizzle-kit breakingly. Left deliberately; revisit when drizzle-kit updates.

`AUTH_URL` in `.env` is right for the host and wrong for the container;
`docker-compose.yml` overrides it from `PUBLIC_URL`, unset locally and set
to the tunnel hostname in production.
